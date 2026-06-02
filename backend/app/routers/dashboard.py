"""Dashboard summary endpoint."""
from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import Customer, Order, Product
from app.schemas import ORDER_STATUSES, DashboardStats

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/stats", response_model=DashboardStats)
def get_stats(db: Session = Depends(get_db)):
    total_products = db.scalar(select(func.count(Product.id))) or 0
    total_customers = db.scalar(select(func.count(Customer.id))) or 0
    total_orders = db.scalar(select(func.count(Order.id))) or 0

    # Revenue from all non-cancelled orders.
    total_revenue = db.scalar(
        select(func.coalesce(func.sum(Order.total_amount), 0)).where(Order.status != "cancelled")
    ) or 0

    # Order counts grouped by status (zero-filled for every known status).
    status_rows = db.execute(
        select(Order.status, func.count(Order.id)).group_by(Order.status)
    ).all()
    orders_by_status = {s: 0 for s in ORDER_STATUSES}
    for s, c in status_rows:
        orders_by_status[s] = c

    low_stock = db.scalars(
        select(Product)
        .where(Product.quantity <= settings.LOW_STOCK_THRESHOLD)
        .order_by(Product.quantity.asc())
    ).all()

    return DashboardStats(
        total_products=total_products,
        total_customers=total_customers,
        total_orders=total_orders,
        low_stock_count=len(low_stock),
        total_revenue=float(total_revenue),
        orders_by_status=orders_by_status,
        low_stock_products=low_stock,
    )
