"""Seed the database with a little demo data when it is empty."""
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import (
    Category, Customer, Order, OrderItem, Product, StockMovement, Supplier,
)


def _add_order(db: Session, customer: Customer, lines: list[tuple[Product, int]], status: str, days_ago: int):
    """Create a demo order: reduce stock, log sale movements, compute total."""
    when = datetime.now(timezone.utc) - timedelta(days=days_ago)
    order = Order(customer_id=customer.id, status=status, total_amount=Decimal("0"), created_at=when)
    total = Decimal("0")
    for product, qty in lines:
        product.quantity -= qty
        total += Decimal(str(product.price)) * qty
        order.items.append(OrderItem(product_id=product.id, quantity=qty, unit_price=product.price))
        db.add(StockMovement(product_id=product.id, change=-qty, resulting_qty=product.quantity,
                             reason="sale", note="Demo order", created_at=when))
    order.total_amount = total
    db.add(order)


def seed_if_empty(db: Session) -> None:
    has_products = db.scalar(select(func.count(Product.id)))
    if has_products:
        return

    # Categories
    peripherals = Category(name="Peripherals")
    displays = Category(name="Displays")
    accessories = Category(name="Accessories")
    db.add_all([peripherals, displays, accessories])
    db.flush()

    products = [
        Product(name="Wireless Mouse", sku="WM-001", price=24.99, quantity=120, category_id=peripherals.id),
        Product(name="Mechanical Keyboard", sku="KB-002", price=79.50, quantity=45, category_id=peripherals.id),
        Product(name="USB-C Hub", sku="HUB-003", price=39.00, quantity=8, category_id=accessories.id),
        Product(name="27\" Monitor", sku="MON-004", price=199.99, quantity=15, category_id=displays.id),
        Product(name="Laptop Stand", sku="LS-005", price=29.99, quantity=5, category_id=accessories.id),
    ]
    db.add_all(products)
    db.flush()
    by_sku = {p.sku: p for p in products}

    # Opening-stock movements so the audit trail isn't empty.
    for p in products:
        db.add(StockMovement(product_id=p.id, change=p.quantity, resulting_qty=p.quantity,
                             reason="initial", note="Opening stock"))

    customers = [
        Customer(full_name="Alice Johnson", email="alice@example.com", phone="+1-202-555-0101"),
        Customer(full_name="Bob Smith", email="bob@example.com", phone="+1-202-555-0102"),
    ]
    suppliers = [
        Supplier(name="Tech Distributors Inc.", email="sales@techdist.com", phone="+1-800-555-0199"),
        Supplier(name="Global Gadgets Ltd.", email="orders@globalgadgets.com", phone="+44-20-7946-0958"),
    ]
    db.add_all(customers + suppliers)
    db.flush()
    alice, bob = customers

    # A spread of demo orders across the last ~10 days so the charts have shape.
    _add_order(db, alice, [(by_sku["WM-001"], 10), (by_sku["KB-002"], 3)], "delivered", 9)
    _add_order(db, bob, [(by_sku["MON-004"], 2)], "delivered", 7)
    _add_order(db, alice, [(by_sku["WM-001"], 6), (by_sku["HUB-003"], 2)], "shipped", 5)
    _add_order(db, bob, [(by_sku["KB-002"], 4)], "confirmed", 3)
    _add_order(db, alice, [(by_sku["WM-001"], 8)], "delivered", 1)
    _add_order(db, bob, [(by_sku["LS-005"], 1)], "pending", 0)

    db.commit()
