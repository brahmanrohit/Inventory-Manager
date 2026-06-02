"""Product management endpoints."""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.auth import require_admin
from app.config import settings
from app.database import get_db
from app.inventory import record_movement
from app.models import Category, Product, StockMovement
from app.schemas import (
    Page, ProductCreate, ProductOut, ProductUpdate, StockAdjust, StockMovementOut,
)

router = APIRouter(prefix="/products", tags=["products"])

SORT_FIELDS = {"id": Product.id, "name": Product.name, "price": Product.price, "quantity": Product.quantity}


def _get_or_404(db: Session, product_id: int) -> Product:
    product = db.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    return product


def _validate_category(db: Session, category_id: int | None) -> None:
    if category_id is not None and not db.get(Category, category_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")


@router.post("", response_model=ProductOut, status_code=status.HTTP_201_CREATED,
             dependencies=[Depends(require_admin)])
def create_product(payload: ProductCreate, db: Session = Depends(get_db)):
    existing = db.scalar(select(Product).where(Product.sku == payload.sku))
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"A product with SKU '{payload.sku}' already exists",
        )
    _validate_category(db, payload.category_id)

    # Create with zero stock, then log the opening balance as an "initial" movement.
    opening = payload.quantity
    product = Product(
        name=payload.name, sku=payload.sku, price=payload.price,
        quantity=0, category_id=payload.category_id,
    )
    db.add(product)
    db.flush()  # assign product.id before recording the movement
    if opening:
        record_movement(db, product, opening, "initial", note="Opening stock")
    else:
        product.quantity = 0
    db.commit()
    db.refresh(product)
    return product


@router.get("", response_model=Page[ProductOut])
def list_products(
    db: Session = Depends(get_db),
    q: str | None = Query(None, description="Search by name or SKU"),
    low_stock: bool = Query(False, description="Only products at/below the low-stock threshold"),
    category_id: int | None = Query(None, description="Filter by category"),
    sort: str = Query("id", description="Sort field: id|name|price|quantity"),
    order: str = Query("desc", description="asc|desc"),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
):
    stmt = select(Product).options(selectinload(Product.category))
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(or_(Product.name.ilike(like), Product.sku.ilike(like)))
    if low_stock:
        stmt = stmt.where(Product.quantity <= settings.LOW_STOCK_THRESHOLD)
    if category_id is not None:
        stmt = stmt.where(Product.category_id == category_id)

    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0

    col = SORT_FIELDS.get(sort, Product.id)
    stmt = stmt.order_by(col.asc() if order == "asc" else col.desc())
    stmt = stmt.offset((page - 1) * page_size).limit(page_size)
    items = db.scalars(stmt).all()

    return Page(
        items=items, total=total, page=page, page_size=page_size,
        pages=(total + page_size - 1) // page_size,
    )


@router.get("/{product_id}", response_model=ProductOut)
def get_product(product_id: int, db: Session = Depends(get_db)):
    return _get_or_404(db, product_id)


@router.get("/{product_id}/movements", response_model=list[StockMovementOut])
def product_movements(product_id: int, db: Session = Depends(get_db)):
    """Full stock-movement audit trail for a product (newest first)."""
    _get_or_404(db, product_id)
    rows = db.scalars(
        select(StockMovement)
        .where(StockMovement.product_id == product_id)
        .order_by(StockMovement.id.desc())
    ).all()
    return rows


@router.post("/{product_id}/adjust", response_model=ProductOut, dependencies=[Depends(require_admin)])
def adjust_stock(product_id: int, payload: StockAdjust, db: Session = Depends(get_db)):
    """Manually add or remove stock, logged with a reason."""
    product = _get_or_404(db, product_id)
    if product.quantity + payload.change < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Adjustment would make stock negative (current {product.quantity})",
        )
    record_movement(db, product, payload.change, "adjustment", note=payload.note)
    db.commit()
    db.refresh(product)
    return product


@router.put("/{product_id}", response_model=ProductOut, dependencies=[Depends(require_admin)])
def update_product(product_id: int, payload: ProductUpdate, db: Session = Depends(get_db)):
    product = _get_or_404(db, product_id)
    data = payload.model_dump(exclude_unset=True)

    if "sku" in data and data["sku"] != product.sku:
        clash = db.scalar(select(Product).where(Product.sku == data["sku"]))
        if clash:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"A product with SKU '{data['sku']}' already exists",
            )
    if "category_id" in data:
        _validate_category(db, data["category_id"])

    # If quantity is edited directly, log the delta as an adjustment.
    if "quantity" in data and data["quantity"] != product.quantity:
        delta = data.pop("quantity") - product.quantity
        record_movement(db, product, delta, "adjustment", note="Edited via product form")

    for key, value in data.items():
        setattr(product, key, value)
    db.commit()
    db.refresh(product)
    return product


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT,
               dependencies=[Depends(require_admin)])
def delete_product(product_id: int, db: Session = Depends(get_db)):
    product = _get_or_404(db, product_id)
    if product.order_items:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot delete a product that is referenced by existing orders",
        )
    db.delete(product)
    db.commit()
    return None
