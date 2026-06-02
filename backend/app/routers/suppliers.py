"""Supplier management endpoints."""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.auth import require_admin
from app.database import get_db
from app.models import Supplier
from app.schemas import Page, SupplierCreate, SupplierOut

router = APIRouter(prefix="/suppliers", tags=["suppliers"])


def _get_or_404(db: Session, supplier_id: int) -> Supplier:
    supplier = db.get(Supplier, supplier_id)
    if not supplier:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplier not found")
    return supplier


@router.post("", response_model=SupplierOut, status_code=status.HTTP_201_CREATED,
             dependencies=[Depends(require_admin)])
def create_supplier(payload: SupplierCreate, db: Session = Depends(get_db)):
    supplier = Supplier(
        name=payload.name,
        email=str(payload.email) if payload.email else None,
        phone=payload.phone,
    )
    db.add(supplier)
    db.commit()
    db.refresh(supplier)
    return supplier


@router.get("", response_model=Page[SupplierOut])
def list_suppliers(
    db: Session = Depends(get_db),
    q: str | None = Query(None, description="Search by name, email or phone"),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
):
    stmt = select(Supplier)
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(
            or_(Supplier.name.ilike(like), Supplier.email.ilike(like), Supplier.phone.ilike(like))
        )
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    stmt = stmt.order_by(Supplier.id.desc()).offset((page - 1) * page_size).limit(page_size)
    items = db.scalars(stmt).all()
    return Page(
        items=items, total=total, page=page, page_size=page_size,
        pages=(total + page_size - 1) // page_size,
    )


@router.get("/{supplier_id}", response_model=SupplierOut)
def get_supplier(supplier_id: int, db: Session = Depends(get_db)):
    return _get_or_404(db, supplier_id)


@router.delete("/{supplier_id}", status_code=status.HTTP_204_NO_CONTENT,
               dependencies=[Depends(require_admin)])
def delete_supplier(supplier_id: int, db: Session = Depends(get_db)):
    supplier = _get_or_404(db, supplier_id)
    if supplier.purchase_orders:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot delete a supplier that has purchase orders",
        )
    db.delete(supplier)
    db.commit()
    return None
