import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.schemas import (
    LoyaltyConfigResponse,
    LoyaltyRedeemRequest,
    LoyaltyTransactionResponse,
)
from app.application.services.loyalty_service import LoyaltyService
from app.auth.dependencies import get_current_user, require_role
from app.config import get_settings
from app.domain.aggregates.user import User
from app.domain.enums import UserRole
from app.infrastructure.database import get_db

router = APIRouter(prefix="/loyalty", tags=["loyalty"])

AdminOrSecretary = Annotated[
    User, Depends(require_role(UserRole.ADMIN, UserRole.SECRETARY))
]


@router.get("/config", response_model=LoyaltyConfigResponse)
async def get_loyalty_config(
    _: Annotated[User, Depends(get_current_user)],
):
    settings = get_settings()
    return LoyaltyConfigResponse(
        puntos_per_paca=settings.puntos_per_paca,
        puntos_per_botellon=settings.puntos_per_botellon,
        puntos_to_redeem_paca=settings.puntos_to_redeem_paca,
    )


@router.get(
    "/{client_id}/history", response_model=list[LoyaltyTransactionResponse]
)
async def get_loyalty_history(
    client_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
):
    service = LoyaltyService(db)
    return await service.get_history(client_id)


@router.post(
    "/{client_id}/redeem",
    response_model=LoyaltyTransactionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def redeem_points(
    client_id: uuid.UUID,
    body: LoyaltyRedeemRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: AdminOrSecretary,
):
    service = LoyaltyService(db)
    try:
        return await service.redeem(client_id, body.points, body.description)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)
        )
