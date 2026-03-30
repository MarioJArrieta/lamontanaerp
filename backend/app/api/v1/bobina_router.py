import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.schemas import BobinaCreate, BobinaUpdate, BobinaResponse
from app.application.services.bobina_service import BobinaService
from app.auth.dependencies import require_role
from app.domain.aggregates.user import User
from app.domain.enums import UserRole
from app.infrastructure.database import get_db

router = APIRouter(prefix="/bobinas", tags=["bobinas"])

AdminUser = Annotated[User, Depends(require_role(UserRole.ADMIN))]


@router.get("", response_model=list[BobinaResponse])
async def list_bobinas(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: AdminUser,
    available_only: bool = False,
):
    service = BobinaService(db)
    if available_only:
        return await service.get_available()
    return await service.get_all()


@router.post("", response_model=BobinaResponse, status_code=status.HTTP_201_CREATED)
async def register_bobina(
    body: BobinaCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: AdminUser,
):
    service = BobinaService(db)
    return await service.register(
        weight_kg=body.weight_kg,
        cost=body.cost,
        estimated_pacas=body.estimated_pacas,
        supplier=body.supplier,
        notes=body.notes,
        code=body.code,
        purchase_date=body.purchase_date,
    )


@router.get("/{bobina_id}", response_model=BobinaResponse)
async def get_bobina(
    bobina_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: AdminUser,
):
    service = BobinaService(db)
    bobina = await service.get_by_id(bobina_id)
    if not bobina:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bobina not found")
    return bobina


@router.put("/{bobina_id}", response_model=BobinaResponse)
async def update_bobina(
    bobina_id: uuid.UUID,
    body: BobinaUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: AdminUser,
):
    service = BobinaService(db)
    try:
        return await service.update(bobina_id, body.model_dump(exclude_none=True))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
