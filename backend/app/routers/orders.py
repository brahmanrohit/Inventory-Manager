"""Order management endpoints with inventory business logic."""
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import Response
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.inventory import record_movement
from app.invoices import build_invoice_pdf
from app.models import Customer, Order, OrderItem, Product
from app.schemas import OrderCreate, OrderItemOut, OrderOut, OrderStatusUpdate, Page

router = APIRouter(prefix="/orders", tags=["orders"])

# Allowed forward transitions in the order lifecycle. Any non-terminal status
# may also move to "cancelled" (handled separately, since it restocks).
TRANSITIONS = {
    "pending": {"confirmed", "cancelled"},
    "confirmed": {"shipped", "cancelled"},
    "shipped": {"delivered", "cancelled"},
    "delivered": set(),
    "cancelled": set(),
}


def _serialize(order: Order) -> OrderOut:
    """Build an OrderOut with denormalized customer/product names."""
    return OrderOut(
        id=order.id,
        customer_id=order.customer_id,
        customer_name=order.customer.full_name if order.customer else None,
        total_amount=float(order.total_amount),
        status=order.status,
        created_at=order.created_at,
        items=[
            OrderItemOut(
                id=item.id,
                product_id=item.product_id,
                quantity=item.quantity,
                unit_price=float(item.unit_price),
                product_name=item.product.name if item.product else None,
            )
            for item in order.items
        ],
    )


def _load(db: Session, order_id: int) -> Order:
    order = db.scalar(
        select(Order)
        .where(Order.id == order_id)
        .options(selectinload(Order.items).selectinload(OrderItem.product), selectinload(Order.customer))
    )
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    return order


@router.post("", response_model=OrderOut, status_code=status.HTTP_201_CREATED)
def create_order(payload: OrderCreate, db: Session = Depends(get_db)):
    customer = db.get(Customer, payload.customer_id)
    if not customer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")

    # Collapse duplicate product lines into a single requested quantity.
    requested: dict[int, int] = {}
    for line in payload.items:
        requested[line.product_id] = requested.get(line.product_id, 0) + line.quantity

    total = Decimal("0")
    order = Order(customer_id=customer.id, status="pending", total_amount=Decimal("0"))

    for product_id, qty in requested.items():
        product = db.get(Product, product_id)
        if not product:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Product {product_id} not found",
            )
        if product.quantity < qty:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Insufficient stock for '{product.name}': "
                    f"requested {qty}, available {product.quantity}"
                ),
            )
        # Reduce stock (logged to the audit trail) and record the line price.
        record_movement(db, product, -qty, "sale", note="Order placed")
        line_total = Decimal(str(product.price)) * qty
        total += line_total
        order.items.append(
            OrderItem(product_id=product.id, quantity=qty, unit_price=product.price)
        )

    order.total_amount = total
    db.add(order)
    db.commit()
    return _serialize(_load(db, order.id))


@router.get("", response_model=Page[OrderOut])
def list_orders(
    db: Session = Depends(get_db),
    q: str | None = Query(None, description="Search by customer name"),
    status_filter: str | None = Query(None, alias="status", description="Filter by order status"),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
):
    stmt = select(Order).join(Customer)
    if q:
        stmt = stmt.where(Customer.full_name.ilike(f"%{q.strip()}%"))
    if status_filter:
        stmt = stmt.where(Order.status == status_filter)

    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0

    stmt = (
        stmt.order_by(Order.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .options(selectinload(Order.items).selectinload(OrderItem.product), selectinload(Order.customer))
    )
    orders = db.scalars(stmt).all()
    return Page(
        items=[_serialize(o) for o in orders], total=total, page=page,
        page_size=page_size, pages=(total + page_size - 1) // page_size,
    )


@router.get("/{order_id}", response_model=OrderOut)
def get_order(order_id: int, db: Session = Depends(get_db)):
    return _serialize(_load(db, order_id))


@router.get("/{order_id}/invoice")
def order_invoice(order_id: int, db: Session = Depends(get_db)):
    """Generate a printable PDF invoice for an order."""
    order = _load(db, order_id)
    pdf = build_invoice_pdf(order)
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="invoice-{order.id}.pdf"'},
    )


@router.patch("/{order_id}/status", response_model=OrderOut)
def update_order_status(order_id: int, payload: OrderStatusUpdate, db: Session = Depends(get_db)):
    """Advance an order through its lifecycle. Cancelling restores stock."""
    order = _load(db, order_id)
    new_status = payload.status

    if new_status == order.status:
        return _serialize(order)

    if new_status not in TRANSITIONS.get(order.status, set()):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot change status from '{order.status}' to '{new_status}'",
        )

    # Cancelling an order returns its reserved stock to inventory.
    if new_status == "cancelled":
        for item in order.items:
            if item.product:
                record_movement(db, item.product, item.quantity, "order_cancel",
                                 note=f"Order #{order.id} cancelled")

    order.status = new_status
    db.commit()
    return _serialize(_load(db, order.id))


@router.delete("/{order_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_order(order_id: int, db: Session = Depends(get_db)):
    """Delete an order. Restores reserved stock unless it was already cancelled."""
    order = _load(db, order_id)
    if order.status != "cancelled":
        for item in order.items:
            if item.product:
                record_movement(db, item.product, item.quantity, "order_cancel",
                                 note=f"Order #{order.id} deleted")
    db.delete(order)
    db.commit()
    return None
