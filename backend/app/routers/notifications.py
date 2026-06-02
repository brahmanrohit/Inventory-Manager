"""Lightweight notifications feed — derived alerts, no storage needed."""
from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import Product, PurchaseOrder

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("")
def list_notifications(db: Session = Depends(get_db)):
    """Build a live alert list from current inventory state."""
    alerts = []

    out_of_stock = db.scalars(
        select(Product).where(Product.quantity == 0).order_by(Product.name)
    ).all()
    for p in out_of_stock:
        alerts.append({
            "type": "out_of_stock",
            "severity": "danger",
            "title": f"{p.name} is out of stock",
            "detail": f"SKU {p.sku} — reorder needed",
            "product_id": p.id,
        })

    low_stock = db.scalars(
        select(Product)
        .where(Product.quantity > 0, Product.quantity <= settings.LOW_STOCK_THRESHOLD)
        .order_by(Product.quantity)
    ).all()
    for p in low_stock:
        alerts.append({
            "type": "low_stock",
            "severity": "warn",
            "title": f"{p.name} is low on stock",
            "detail": f"Only {p.quantity} left (SKU {p.sku})",
            "product_id": p.id,
        })

    pending_pos = db.scalar(
        select(func.count(PurchaseOrder.id)).where(PurchaseOrder.status == "ordered")
    ) or 0
    if pending_pos:
        alerts.append({
            "type": "pending_po",
            "severity": "info",
            "title": f"{pending_pos} purchase order(s) awaiting delivery",
            "detail": "Mark them received once stock arrives",
        })

    return {"count": len(alerts), "alerts": alerts}
