"""FastAPI application entrypoint."""
import logging
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError

from app.auth import get_current_user
from app.config import settings
from app.database import Base, SessionLocal, engine
from app.routers import auth, customers, dashboard, orders, products
from app.seed import seed_if_empty

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("inventory")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create tables on startup. For this assessment we manage the schema with
    # SQLAlchemy's metadata; a larger system would use Alembic migrations.
    Base.metadata.create_all(bind=engine)
    if settings.SEED_ON_STARTUP:
        db = SessionLocal()
        try:
            seed_if_empty(db)
        except Exception as exc:  # pragma: no cover - seeding is best-effort
            logger.warning("Seeding skipped: %s", exc)
        finally:
            db.close()
    yield


app = FastAPI(
    title="Inventory & Order Management API",
    description="Manage products, customers, orders, and inventory tracking.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(IntegrityError)
async def integrity_error_handler(request: Request, exc: IntegrityError):
    # Catch DB-level constraint violations (e.g. unique race conditions) and
    # return a clean 409 instead of a 500.
    return JSONResponse(
        status_code=status.HTTP_409_CONFLICT,
        content={"detail": "A database constraint was violated (duplicate or invalid reference)."},
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": exc.errors()},
    )


@app.get("/", tags=["meta"])
def root():
    return {"service": "Inventory & Order Management API", "docs": "/docs", "health": "/health"}


@app.get("/health", tags=["meta"])
def health():
    return {"status": "ok"}


# Public auth routes.
app.include_router(auth.router)

# Business routes are protected — every request needs a valid bearer token.
protected = [Depends(get_current_user)]
app.include_router(products.router, dependencies=protected)
app.include_router(customers.router, dependencies=protected)
app.include_router(orders.router, dependencies=protected)
app.include_router(dashboard.router, dependencies=protected)
