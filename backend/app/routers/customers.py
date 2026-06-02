"""Customer management endpoints."""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.auth import require_admin
from app.database import get_db
from app.models import Customer
from app.schemas import CustomerCreate, CustomerOut, Page

router = APIRouter(prefix="/customers", tags=["customers"])


def _get_or_404(db: Session, customer_id: int) -> Customer:
    customer = db.get(Customer, customer_id)
    if not customer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")
    return customer


@router.post("", response_model=CustomerOut, status_code=status.HTTP_201_CREATED)
def create_customer(payload: CustomerCreate, db: Session = Depends(get_db)):
    existing = db.scalar(select(Customer).where(Customer.email == payload.email))
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"A customer with email '{payload.email}' already exists",
        )
    customer = Customer(
        full_name=payload.full_name,
        email=str(payload.email),
        phone=payload.phone,
    )
    db.add(customer)
    db.commit()
    db.refresh(customer)
    return customer


@router.get("", response_model=Page[CustomerOut])
def list_customers(
    db: Session = Depends(get_db),
    q: str | None = Query(None, description="Search by name, email or phone"),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
):
    stmt = select(Customer)
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(
            or_(Customer.full_name.ilike(like), Customer.email.ilike(like), Customer.phone.ilike(like))
        )
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    stmt = stmt.order_by(Customer.id.desc()).offset((page - 1) * page_size).limit(page_size)
    items = db.scalars(stmt).all()
    return Page(
        items=items, total=total, page=page, page_size=page_size,
        pages=(total + page_size - 1) // page_size,
    )


@router.get("/{customer_id}", response_model=CustomerOut)
def get_customer(customer_id: int, db: Session = Depends(get_db)):
    return _get_or_404(db, customer_id)


@router.delete("/{customer_id}", status_code=status.HTTP_204_NO_CONTENT,
               dependencies=[Depends(require_admin)])
def delete_customer(customer_id: int, db: Session = Depends(get_db)):
    customer = _get_or_404(db, customer_id)
    if customer.orders:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot delete a customer that has existing orders",
        )
    db.delete(customer)
    db.commit()
    return None
