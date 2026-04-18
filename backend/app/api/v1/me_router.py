from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.schemas import (
    ClientResponse,
    LoyaltyConfigResponse,
    LoyaltyRedeemRequest,
    LoyaltyTransactionResponse,
)
from app.application.services.loyalty_service import LoyaltyService
from app.auth.dependencies import get_current_client
from app.config import get_settings
from app.domain.aggregates.client import Client
from app.infrastructure.database import get_db

router = APIRouter(prefix="/me", tags=["me (client app)"])


@router.get("", response_model=ClientResponse)
async def get_my_profile(
    client: Annotated[Client, Depends(get_current_client)],
):
    return client


@router.get("/loyalty", response_model=LoyaltyConfigResponse)
async def get_my_loyalty(
    client: Annotated[Client, Depends(get_current_client)],
):
    settings = get_settings()
    return LoyaltyConfigResponse(
        gotas_per_paca=settings.gotas_per_paca,
        gotas_per_botellon=settings.gotas_per_botellon,
        gotas_to_redeem_paca=settings.gotas_to_redeem_paca,
    )


@router.get("/loyalty/history", response_model=list[LoyaltyTransactionResponse])
async def get_my_loyalty_history(
    client: Annotated[Client, Depends(get_current_client)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    service = LoyaltyService(db)
    return await service.get_history(client.id)


@router.post(
    "/loyalty/redeem",
    response_model=LoyaltyTransactionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def redeem_my_points(
    body: LoyaltyRedeemRequest,
    client: Annotated[Client, Depends(get_current_client)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    service = LoyaltyService(db)
    try:
        return await service.redeem(client.id, body.points)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)
        )
