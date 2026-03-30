from contextlib import asynccontextmanager
from collections.abc import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.auth_router import router as auth_router
from app.api.v1.bobina_router import router as bobina_router
from app.api.v1.client_router import router as client_router
from app.api.v1.employee_router import router as employee_router
from app.api.v1.inventory_router import router as inventory_router
from app.api.v1.product_router import router as product_router
from app.api.v1.production_router import router as production_router
from app.api.v1.receivable_router import router as receivable_router
from app.api.v1.sale_router import router as sale_router
from app.api.v1.delivery_router import router as delivery_router
from app.api.v1.payroll_router import router as payroll_router
from app.api.v1.settings_router import router as settings_router
from app.api.v1.finance_router import router as finance_router
from app.config import get_settings
from app.domain.aggregates import Base
from app.infrastructure.database import engine


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    # Create tables on startup (dev only; use Alembic in prod)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    await engine.dispose()


settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    lifespan=lifespan,
)

import os
cors_origins = os.environ.get("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(auth_router, prefix="/api/v1")
app.include_router(employee_router, prefix="/api/v1")
app.include_router(product_router, prefix="/api/v1")
app.include_router(client_router, prefix="/api/v1")
app.include_router(bobina_router, prefix="/api/v1")
app.include_router(production_router, prefix="/api/v1")
app.include_router(inventory_router, prefix="/api/v1")
app.include_router(sale_router, prefix="/api/v1")
app.include_router(receivable_router, prefix="/api/v1")
app.include_router(delivery_router, prefix="/api/v1")
app.include_router(payroll_router, prefix="/api/v1")
app.include_router(settings_router, prefix="/api/v1")
app.include_router(finance_router, prefix="/api/v1")


@app.get("/health")
async def health():
    return {"status": "ok", "app": settings.app_name}
