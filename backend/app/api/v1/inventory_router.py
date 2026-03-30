import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.schemas import InventoryAdjust, InventoryMovementResponse, InventoryResponse
from app.application.services.inventory_service import InventoryService
from app.auth.dependencies import get_current_user, require_role
from app.domain.aggregates.user import User
from app.domain.enums import UserRole
from app.infrastructure.database import get_db

router = APIRouter(prefix="/inventory", tags=["inventory"])

AdminUser = Annotated[User, Depends(require_role(UserRole.ADMIN))]


@router.get("", response_model=list[InventoryResponse])
async def list_inventory(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
):
    service = InventoryService(db)
    return await service.get_all()


@router.post("/adjustments", response_model=InventoryResponse, status_code=status.HTTP_201_CREATED)
async def adjust_inventory(
    body: InventoryAdjust,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: AdminUser,
):
    service = InventoryService(db)
    return await service.adjust(
        product_id=body.product_id,
        quantity=body.quantity,
        notes=body.notes,
    )


@router.get("/movements", response_model=list[InventoryMovementResponse])
async def list_movements(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
    product_id: uuid.UUID | None = Query(default=None),
    limit: int = Query(default=100, le=500),
):
    service = InventoryService(db)
    return await service.get_movements(product_id, limit)
