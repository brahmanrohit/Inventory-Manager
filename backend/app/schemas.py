"""Pydantic schemas for request validation and response serialization."""
from datetime import datetime
from typing import Generic, Literal, TypeVar

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

# Order status lifecycle.
ORDER_STATUSES = ["pending", "confirmed", "shipped", "delivered", "cancelled"]
OrderStatus = Literal["pending", "confirmed", "shipped", "delivered", "cancelled"]

T = TypeVar("T")


class Page(BaseModel, Generic[T]):
    """Generic pagination envelope returned by list endpoints."""
    items: list[T]
    total: int
    page: int
    page_size: int
    pages: int


# ---------- Product ----------
class ProductBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    sku: str = Field(..., min_length=1, max_length=100)
    price: float = Field(..., ge=0)
    quantity: int = Field(..., ge=0)

    @field_validator("name", "sku")
    @classmethod
    def not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("must not be blank")
        return v.strip()


class ProductCreate(ProductBase):
    category_id: int | None = None


class ProductUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=255)
    sku: str | None = Field(None, min_length=1, max_length=100)
    price: float | None = Field(None, ge=0)
    quantity: int | None = Field(None, ge=0)
    category_id: int | None = None


class ProductOut(ProductBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    category_id: int | None = None
    category_name: str | None = None
    created_at: datetime


# ---------- Customer ----------
class CustomerBase(BaseModel):
    full_name: str = Field(..., min_length=1, max_length=255)
    email: EmailStr
    phone: str = Field(..., min_length=3, max_length=50)


class CustomerCreate(CustomerBase):
    pass


class CustomerOut(CustomerBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: datetime


# ---------- Order ----------
class OrderItemCreate(BaseModel):
    product_id: int
    quantity: int = Field(..., gt=0)


class OrderCreate(BaseModel):
    customer_id: int
    items: list[OrderItemCreate] = Field(..., min_length=1)


class OrderItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    product_id: int
    quantity: int
    unit_price: float
    product_name: str | None = None


class OrderOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    customer_id: int
    customer_name: str | None = None
    total_amount: float
    status: str
    created_at: datetime
    items: list[OrderItemOut] = []


class OrderStatusUpdate(BaseModel):
    status: OrderStatus


# ---------- Dashboard ----------
class DashboardStats(BaseModel):
    total_products: int
    total_customers: int
    total_orders: int
    low_stock_count: int
    total_revenue: float
    orders_by_status: dict[str, int]
    low_stock_products: list[ProductOut]


# ---------- Auth ----------
class UserRegister(BaseModel):
    full_name: str = Field(..., min_length=1, max_length=255)
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=128)


class UserLogin(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1, max_length=128)


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    full_name: str
    email: EmailStr
    role: str
    created_at: datetime


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# ---------- Categories ----------
class CategoryCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)

    @field_validator("name")
    @classmethod
    def not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("must not be blank")
        return v.strip()


class CategoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    created_at: datetime
    product_count: int = 0


# ---------- Stock movements ----------
class StockMovementOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    product_id: int
    product_name: str | None = None
    change: int
    resulting_qty: int
    reason: str
    note: str | None = None
    created_at: datetime


class StockAdjust(BaseModel):
    change: int = Field(..., description="Positive to add stock, negative to remove (cannot make stock negative)")
    note: str | None = Field(None, max_length=255)

    @field_validator("change")
    @classmethod
    def non_zero(cls, v: int) -> int:
        if v == 0:
            raise ValueError("change must not be zero")
        return v


# ---------- Suppliers ----------
class SupplierBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    email: EmailStr | None = None
    phone: str | None = Field(None, max_length=50)


class SupplierCreate(SupplierBase):
    pass


class SupplierOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    email: str | None = None
    phone: str | None = None
    created_at: datetime


# ---------- Purchase orders ----------
class PurchaseOrderItemCreate(BaseModel):
    product_id: int
    quantity: int = Field(..., gt=0)
    unit_cost: float = Field(..., ge=0)


class PurchaseOrderCreate(BaseModel):
    supplier_id: int
    items: list[PurchaseOrderItemCreate] = Field(..., min_length=1)


class PurchaseOrderItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    product_id: int
    product_name: str | None = None
    quantity: int
    unit_cost: float


class PurchaseOrderOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    supplier_id: int
    supplier_name: str | None = None
    status: str
    total_cost: float
    created_at: datetime
    received_at: datetime | None = None
    items: list[PurchaseOrderItemOut] = []


# ---------- Errors ----------
class ErrorResponse(BaseModel):
    detail: str
