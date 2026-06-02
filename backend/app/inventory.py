"""Shared inventory helpers — apply a stock change and log it to the audit trail."""
from sqlalchemy.orm import Session

from app.models import Product, StockMovement

# Recognized movement reasons (kept here for a single source of truth).
REASONS = {"initial", "sale", "order_cancel", "purchase", "adjustment"}


def record_movement(
    db: Session, product: Product, change: int, reason: str, note: str | None = None
) -> StockMovement:
    """Apply `change` to the product's quantity and append a StockMovement row.

    The caller is responsible for committing the transaction. The product must
    already be persisted (have an id) before calling this.
    """
    product.quantity += change
    movement = StockMovement(
        product_id=product.id,
        change=change,
        resulting_qty=product.quantity,
        reason=reason,
        note=note,
    )
    db.add(movement)
    return movement
