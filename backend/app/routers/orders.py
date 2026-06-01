"""Order management endpoints with inventory business logic."""
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.models import Customer, Order, OrderItem, Product
from app.schemas import OrderCreate, OrderItemOut, OrderOut

router = APIRouter(prefix="/orders", tags=["orders"])


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
    order = Order(customer_id=customer.id, status="confirmed", total_amount=Decimal("0"))

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
        # Reduce stock and record the line at the current price.
        product.quantity -= qty
        line_total = Decimal(str(product.price)) * qty
        total += line_total
        order.items.append(
            OrderItem(product_id=product.id, quantity=qty, unit_price=product.price)
        )

    order.total_amount = total
    db.add(order)
    db.commit()
    return _serialize(_load(db, order.id))


@router.get("", response_model=list[OrderOut])
def list_orders(db: Session = Depends(get_db)):
    orders = db.scalars(
        select(Order)
        .order_by(Order.id.desc())
        .options(selectinload(Order.items).selectinload(OrderItem.product), selectinload(Order.customer))
    ).all()
    return [_serialize(o) for o in orders]


@router.get("/{order_id}", response_model=OrderOut)
def get_order(order_id: int, db: Session = Depends(get_db)):
    return _serialize(_load(db, order_id))


@router.delete("/{order_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_order(order_id: int, db: Session = Depends(get_db)):
    """Cancel/delete an order and restore the reserved stock."""
    order = _load(db, order_id)
    for item in order.items:
        if item.product:
            item.product.quantity += item.quantity
    db.delete(order)
    db.commit()
    return None
