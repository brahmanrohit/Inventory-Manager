"""Seed the database with a little demo data when it is empty."""
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Customer, Product


def seed_if_empty(db: Session) -> None:
    has_products = db.scalar(select(func.count(Product.id)))
    if has_products:
        return

    products = [
        Product(name="Wireless Mouse", sku="WM-001", price=24.99, quantity=120),
        Product(name="Mechanical Keyboard", sku="KB-002", price=79.50, quantity=45),
        Product(name="USB-C Hub", sku="HUB-003", price=39.00, quantity=8),
        Product(name="27\" Monitor", sku="MON-004", price=199.99, quantity=15),
        Product(name="Laptop Stand", sku="LS-005", price=29.99, quantity=5),
    ]
    customers = [
        Customer(full_name="Alice Johnson", email="alice@example.com", phone="+1-202-555-0101"),
        Customer(full_name="Bob Smith", email="bob@example.com", phone="+1-202-555-0102"),
    ]
    db.add_all(products + customers)
    db.commit()
