import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.schemas import ReceivableResponse
from app.application.services.receivable_service import ReceivableService
from app.auth.dependencies import require_role
from app.domain.aggregates.user import User
from app.domain.enums import UserRole
from app.infrastructure.database import get_db

router = APIRouter(prefix="/receivables", tags=["receivables"])

AdminOrSecretary = Annotated[User, Depends(require_role(UserRole.ADMIN, UserRole.SECRETARY))]


@router.get("", response_model=list[ReceivableResponse])
async def list_pending(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: AdminOrSecretary,
):
    service = ReceivableService(db)
    return await service.get_pending()


@router.get("/overdue", response_model=list[ReceivableResponse])
async def list_overdue(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: AdminOrSecretary,
):
    service = ReceivableService(db)
    return await service.get_overdue()


@router.get("/client/{client_id}", response_model=list[ReceivableResponse])
async def list_by_client(
    client_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: AdminOrSecretary,
):
    service = ReceivableService(db)
    return await service.get_by_client(client_id)


@router.post("/{receivable_id}/pay", response_model=ReceivableResponse)
async def register_payment(
    receivable_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: AdminOrSecretary,
):
    service = ReceivableService(db)
    try:
        return await service.register_payment(receivable_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
