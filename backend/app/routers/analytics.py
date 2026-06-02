"""Analytics endpoints powering the dashboard charts."""
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import Category, Order, OrderItem, Product

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/sales-trend")
def sales_trend(db: Session = Depends(get_db), days: int = Query(14, ge=1, le=365)):
    """Revenue and order count per day for the last `days` days (non-cancelled)."""
    since = datetime.now(timezone.utc) - timedelta(days=days - 1)
    day = func.date(Order.created_at)
    rows = db.execute(
        select(day.label("d"),
               func.coalesce(func.sum(Order.total_amount), 0),
               func.count(Order.id))
        .where(Order.status != "cancelled", Order.created_at >= since)
        .group_by(day)
        .order_by(day)
    ).all()

    by_day = {str(d): (float(rev), int(cnt)) for d, rev, cnt in rows}
    # Zero-fill every day in the window so the chart is continuous.
    out = []
    for i in range(days):
        d = (since + timedelta(days=i)).strftime("%Y-%m-%d")
        rev, cnt = by_day.get(d, (0.0, 0))
        out.append({"date": d, "revenue": round(rev, 2), "orders": cnt})
    return out


@router.get("/top-products")
def top_products(db: Session = Depends(get_db), limit: int = Query(5, ge=1, le=20)):
    """Best-selling products by units sold (non-cancelled orders)."""
    rows = db.execute(
        select(Product.name,
               func.sum(OrderItem.quantity),
               func.sum(OrderItem.quantity * OrderItem.unit_price))
        .join(OrderItem, OrderItem.product_id == Product.id)
        .join(Order, Order.id == OrderItem.order_id)
        .where(Order.status != "cancelled")
        .group_by(Product.id)
        .order_by(func.sum(OrderItem.quantity).desc())
        .limit(limit)
    ).all()
    return [{"name": name, "units": int(units), "revenue": float(rev)} for name, units, rev in rows]


@router.get("/inventory-value")
def inventory_value(db: Session = Depends(get_db)):
    """Total value tied up in stock + a few inventory headline numbers."""
    total_value = db.scalar(select(func.coalesce(func.sum(Product.price * Product.quantity), 0))) or 0
    total_units = db.scalar(select(func.coalesce(func.sum(Product.quantity), 0))) or 0
    product_count = db.scalar(select(func.count(Product.id))) or 0
    low_stock = db.scalar(
        select(func.count(Product.id)).where(Product.quantity <= settings.LOW_STOCK_THRESHOLD)
    ) or 0
    return {
        "total_value": float(total_value),
        "total_units": int(total_units),
        "product_count": int(product_count),
        "low_stock_count": int(low_stock),
    }


@router.get("/category-distribution")
def category_distribution(db: Session = Depends(get_db)):
    """How many products sit in each category (plus 'Uncategorized')."""
    rows = db.execute(
        select(Category.name, func.count(Product.id))
        .outerjoin(Product, Product.category_id == Category.id)
        .group_by(Category.id)
        .order_by(func.count(Product.id).desc())
    ).all()
    out = [{"name": name, "count": int(c)} for name, c in rows]

    uncategorized = db.scalar(
        select(func.count(Product.id)).where(Product.category_id.is_(None))
    ) or 0
    if uncategorized:
        out.append({"name": "Uncategorized", "count": int(uncategorized)})
    return out
