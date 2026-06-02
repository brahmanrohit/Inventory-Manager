"""CSV export & import for products and orders."""
import csv
import io

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.auth import require_admin
from app.database import get_db
from app.inventory import record_movement
from app.models import Category, Order, OrderItem, Product

router = APIRouter(prefix="/data", tags=["data"])


def _csv_response(filename: str, header: list[str], rows: list[list]) -> Response:
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(header)
    writer.writerows(rows)
    return Response(
        content=buf.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/products.csv")
def export_products(db: Session = Depends(get_db)):
    products = db.scalars(select(Product).options(selectinload(Product.category)).order_by(Product.id)).all()
    rows = [
        [p.id, p.name, p.sku, float(p.price), p.quantity, p.category_name or "", p.created_at.isoformat()]
        for p in products
    ]
    return _csv_response("products.csv", ["id", "name", "sku", "price", "quantity", "category", "created_at"], rows)


@router.get("/orders.csv")
def export_orders(db: Session = Depends(get_db)):
    orders = db.scalars(
        select(Order).options(selectinload(Order.items).selectinload(OrderItem.product),
                              selectinload(Order.customer)).order_by(Order.id)
    ).all()
    rows = []
    for o in orders:
        items = "; ".join(f"{it.product.name if it.product else it.product_id} x{it.quantity}" for it in o.items)
        rows.append([
            o.id, o.customer.full_name if o.customer else o.customer_id, o.status,
            float(o.total_amount), o.created_at.isoformat(), items,
        ])
    return _csv_response("orders.csv", ["id", "customer", "status", "total_amount", "created_at", "items"], rows)


@router.post("/products/import", dependencies=[Depends(require_admin)])
async def import_products(db: Session = Depends(get_db), file: UploadFile = File(...)):
    """Bulk create/update products from a CSV with columns: name, sku, price, quantity, category (optional).

    Existing products (matched by SKU) are updated; new SKUs are created.
    """
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Please upload a .csv file")

    content = (await file.read()).decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(content))
    if not reader.fieldnames or "sku" not in [f.strip().lower() for f in reader.fieldnames]:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="CSV must include a 'sku' column")

    created = updated = 0
    errors: list[str] = []
    category_cache: dict[str, Category] = {}

    for i, raw in enumerate(reader, start=2):  # row 1 is the header
        row = {(k or "").strip().lower(): (v or "").strip() for k, v in raw.items()}
        sku = row.get("sku")
        name = row.get("name")
        if not sku or not name:
            errors.append(f"Row {i}: missing name or sku")
            continue
        try:
            price = float(row.get("price") or 0)
            quantity = int(float(row.get("quantity") or 0))
            if price < 0 or quantity < 0:
                raise ValueError
        except ValueError:
            errors.append(f"Row {i}: invalid price/quantity")
            continue

        # Resolve (and lazily create) the category by name.
        category_id = None
        cat_name = row.get("category")
        if cat_name:
            cat = category_cache.get(cat_name.lower())
            if not cat:
                cat = db.scalar(select(Category).where(Category.name == cat_name))
                if not cat:
                    cat = Category(name=cat_name)
                    db.add(cat)
                    db.flush()
                category_cache[cat_name.lower()] = cat
            category_id = cat.id

        product = db.scalar(select(Product).where(Product.sku == sku))
        if product:
            product.name = name
            product.price = price
            product.category_id = category_id
            if quantity != product.quantity:
                record_movement(db, product, quantity - product.quantity, "adjustment", note="CSV import")
            updated += 1
        else:
            product = Product(name=name, sku=sku, price=price, quantity=0, category_id=category_id)
            db.add(product)
            db.flush()
            if quantity:
                record_movement(db, product, quantity, "initial", note="CSV import")
            created += 1

    db.commit()
    return {"created": created, "updated": updated, "errors": errors}
