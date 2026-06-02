"""Category management endpoints."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.auth import require_admin
from app.database import get_db
from app.models import Category, Product
from app.schemas import CategoryCreate, CategoryOut

router = APIRouter(prefix="/categories", tags=["categories"])


@router.post("", response_model=CategoryOut, status_code=status.HTTP_201_CREATED,
             dependencies=[Depends(require_admin)])
def create_category(payload: CategoryCreate, db: Session = Depends(get_db)):
    if db.scalar(select(Category).where(func.lower(Category.name) == payload.name.lower())):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"A category named '{payload.name}' already exists",
        )
    category = Category(name=payload.name)
    db.add(category)
    db.commit()
    db.refresh(category)
    return CategoryOut(id=category.id, name=category.name, created_at=category.created_at, product_count=0)


@router.get("", response_model=list[CategoryOut])
def list_categories(db: Session = Depends(get_db)):
    # Category + how many products it holds.
    rows = db.execute(
        select(Category, func.count(Product.id))
        .outerjoin(Product, Product.category_id == Category.id)
        .group_by(Category.id)
        .order_by(Category.name.asc())
    ).all()
    return [
        CategoryOut(id=c.id, name=c.name, created_at=c.created_at, product_count=count)
        for c, count in rows
    ]


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT,
               dependencies=[Depends(require_admin)])
def delete_category(category_id: int, db: Session = Depends(get_db)):
    category = db.get(Category, category_id)
    if not category:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")
    # Products keep existing; their category_id is set to NULL by the FK rule.
    db.delete(category)
    db.commit()
    return None
