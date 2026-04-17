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

from app.api.v1.settings_router import router as settings_router
from app.api.v1.finance_router import router as finance_router
from app.api.v1.loyalty_router import router as loyalty_router
from app.api.v1.quote_router import router as quote_router
from app.config import get_settings
from app.domain.aggregates import Base
from app.infrastructure.database import engine


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    from sqlalchemy import text

    # ALTER TYPE ... ADD VALUE cannot run inside a transaction block,
    # so we use AUTOCOMMIT isolation level.
    async with engine.connect() as conn:
        await conn.execution_options(isolation_level="AUTOCOMMIT")
        try:
            await conn.execute(text(
                "ALTER TYPE salestatus ADD VALUE IF NOT EXISTS 'PARTIAL'"
            ))
        except Exception:
            pass  # value already exists or type doesn't exist yet

    # Create tables on startup (dev only; use Alembic in prod)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # Add new columns if they don't exist (create_all won't alter existing tables)
        for col, coldef in [
            ("is_paid", "BOOLEAN NOT NULL DEFAULT false"),
            ("payment_amount", "NUMERIC(12,2)"),
        ]:
            await conn.execute(text(
                f"ALTER TABLE productions ADD COLUMN IF NOT EXISTS {col} {coldef}"
            ))
        # Add paid_amount to sales if not exists
        await conn.execute(text(
            "ALTER TABLE sales ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(14,2) NOT NULL DEFAULT 0"
        ))
        # Backfill paid_amount for already-paid sales
        await conn.execute(text(
            "UPDATE sales SET paid_amount = total WHERE status = 'PAID' AND paid_amount = 0"
        ))
        # Add hashed_password to clients if not exists and backfill
        await conn.execute(text(
            "ALTER TABLE clients ADD COLUMN IF NOT EXISTS hashed_password VARCHAR(255)"
        ))
        # Backfill: set a placeholder hash for clients without password
        # Admin must use POST /clients/{id}/password/reset to generate real passwords
        from app.auth.security import generate_password, hash_password as _hp
        result = await conn.execute(text(
            "SELECT id FROM clients WHERE hashed_password IS NULL"
        ))
        for row in result:
            pwd = generate_password()
            hashed = _hp(pwd)
            await conn.execute(
                text("UPDATE clients SET hashed_password = :hp WHERE id = :cid"),
                {"hp": hashed, "cid": row[0]},
            )
        # Add phone to users if not exists
        await conn.execute(text(
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20) UNIQUE"
        ))
        # Add employee_id to users if not exists
        await conn.execute(text(
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS employee_id UUID REFERENCES employees(id)"
        ))
        # Link Esteban01 user to Esteban Barroso employee
        await conn.execute(text(
            "UPDATE users SET full_name = 'Esteban Barroso', "
            "employee_id = (SELECT id FROM employees WHERE name = 'Esteban Barroso' LIMIT 1) "
            "WHERE username = 'Esteban01' AND employee_id IS NULL"
        ))
        # Sync deliveries: mark as delivered if sale is already paid
        await conn.execute(text(
            "UPDATE deliveries SET status = 'DELIVERED' "
            "WHERE status != 'DELIVERED' "
            "AND sale_id IN (SELECT id FROM sales WHERE status = 'PAID')"
        ))
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

app.include_router(settings_router, prefix="/api/v1")
app.include_router(finance_router, prefix="/api/v1")
app.include_router(loyalty_router, prefix="/api/v1")
app.include_router(quote_router, prefix="/api/v1")


@app.get("/health")
async def health():
    return {"status": "ok", "app": settings.app_name}
