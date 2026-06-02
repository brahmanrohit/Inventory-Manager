"""Purchase order (restocking) endpoints."""
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.auth import require_admin
from app.database import get_db
from app.inventory import record_movement
from app.models import Product, PurchaseOrder, PurchaseOrderItem, Supplier
from app.schemas import Page, PurchaseOrderCreate, PurchaseOrderItemOut, PurchaseOrderOut

router = APIRouter(prefix="/purchase-orders", tags=["purchase-orders"])


def _serialize(po: PurchaseOrder) -> PurchaseOrderOut:
    return PurchaseOrderOut(
        id=po.id,
        supplier_id=po.supplier_id,
        supplier_name=po.supplier.name if po.supplier else None,
        status=po.status,
        total_cost=float(po.total_cost),
        created_at=po.created_at,
        received_at=po.received_at,
        items=[
            PurchaseOrderItemOut(
                id=it.id,
                product_id=it.product_id,
                product_name=it.product.name if it.product else None,
                quantity=it.quantity,
                unit_cost=float(it.unit_cost),
            )
            for it in po.items
        ],
    )


def _load(db: Session, po_id: int) -> PurchaseOrder:
    po = db.scalar(
        select(PurchaseOrder)
        .where(PurchaseOrder.id == po_id)
        .options(
            selectinload(PurchaseOrder.items).selectinload(PurchaseOrderItem.product),
            selectinload(PurchaseOrder.supplier),
        )
    )
    if not po:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Purchase order not found")
    return po


@router.post("", response_model=PurchaseOrderOut, status_code=status.HTTP_201_CREATED,
             dependencies=[Depends(require_admin)])
def create_purchase_order(payload: PurchaseOrderCreate, db: Session = Depends(get_db)):
    supplier = db.get(Supplier, payload.supplier_id)
    if not supplier:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplier not found")

    total = Decimal("0")
    po = PurchaseOrder(supplier_id=supplier.id, status="ordered", total_cost=Decimal("0"))
    for line in payload.items:
        product = db.get(Product, line.product_id)
        if not product:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Product {line.product_id} not found",
            )
        total += Decimal(str(line.unit_cost)) * line.quantity
        po.items.append(
            PurchaseOrderItem(product_id=product.id, quantity=line.quantity, unit_cost=line.unit_cost)
        )
    po.total_cost = total
    db.add(po)
    db.commit()
    return _serialize(_load(db, po.id))


@router.get("", response_model=Page[PurchaseOrderOut])
def list_purchase_orders(
    db: Session = Depends(get_db),
    status_filter: str | None = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
):
    stmt = select(PurchaseOrder)
    if status_filter:
        stmt = stmt.where(PurchaseOrder.status == status_filter)
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    stmt = (
        stmt.order_by(PurchaseOrder.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .options(
            selectinload(PurchaseOrder.items).selectinload(PurchaseOrderItem.product),
            selectinload(PurchaseOrder.supplier),
        )
    )
    items = db.scalars(stmt).all()
    return Page(
        items=[_serialize(po) for po in items], total=total, page=page,
        page_size=page_size, pages=(total + page_size - 1) // page_size,
    )


@router.get("/{po_id}", response_model=PurchaseOrderOut)
def get_purchase_order(po_id: int, db: Session = Depends(get_db)):
    return _serialize(_load(db, po_id))


@router.post("/{po_id}/receive", response_model=PurchaseOrderOut, dependencies=[Depends(require_admin)])
def receive_purchase_order(po_id: int, db: Session = Depends(get_db)):
    """Mark a PO as received — increases stock for each line and logs movements."""
    po = _load(db, po_id)
    if po.status == "received":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Purchase order already received")
    if po.status == "cancelled":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot receive a cancelled purchase order")

    for it in po.items:
        if it.product:
            record_movement(db, it.product, it.quantity, "purchase", note=f"Received PO #{po.id}")
    po.status = "received"
    po.received_at = func.now()
    db.commit()
    return _serialize(_load(db, po.id))


@router.delete("/{po_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_admin)])
def delete_purchase_order(po_id: int, db: Session = Depends(get_db)):
    po = _load(db, po_id)
    if po.status == "received":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot delete a received purchase order (stock already added)",
        )
    db.delete(po)
    db.commit()
    return None
