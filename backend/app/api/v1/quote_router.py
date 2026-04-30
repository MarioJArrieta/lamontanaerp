import uuid
from datetime import date, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.schemas import (
    QuoteCreate,
    QuoteResponse,
    QuoteStatusUpdate,
    QuoteUpdate,
)
from app.application.services.quote_service import QuoteService
from app.auth.dependencies import get_current_user, require_role
from app.domain.aggregates.user import User
from app.domain.enums import QuoteStatus, UserRole
from app.infrastructure.database import get_db

router = APIRouter(prefix="/quotes", tags=["quotes"])

AdminOrSecretary = Annotated[User, Depends(require_role(UserRole.ADMIN, UserRole.SECRETARY))]


@router.get("", response_model=list[QuoteResponse])
async def list_quotes(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
    from_date: date = Query(default_factory=lambda: date.today() - timedelta(days=30)),
    to_date: date = Query(default_factory=date.today),
    quote_status: str | None = Query(default=None, alias="status"),
) -> list:
    service = QuoteService(db)
    statuses: list[QuoteStatus] | None = None
    if quote_status:
        statuses = [QuoteStatus(s.strip()) for s in quote_status.split(",")]
    return await service.get_by_date_range(from_date, to_date, statuses)


@router.get("/{quote_id}", response_model=QuoteResponse)
async def get_quote(
    quote_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
):
    service = QuoteService(db)
    quote = await service.get_by_id(quote_id)
    if not quote:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quote not found")
    return quote


@router.post("", response_model=QuoteResponse, status_code=status.HTTP_201_CREATED)
async def create_quote(
    body: QuoteCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: AdminOrSecretary,
):
    service = QuoteService(db)
    try:
        quote = await service.create_quote(
            quote_date=body.date,
            client_id=body.client_id,
            items=[item.model_dump() for item in body.items],
            valid_until=body.valid_until,
            status=body.status,
            notes=body.notes,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    return quote


@router.put("/{quote_id}", response_model=QuoteResponse)
async def update_quote(
    quote_id: uuid.UUID,
    body: QuoteUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: AdminOrSecretary,
):
    service = QuoteService(db)
    try:
        updates = body.model_dump(exclude_unset=True)
        return await service.update_quote(quote_id, updates)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.patch("/{quote_id}/status", response_model=QuoteResponse)
async def update_status(
    quote_id: uuid.UUID,
    body: QuoteStatusUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: AdminOrSecretary,
):
    service = QuoteService(db)
    try:
        return await service.set_status(quote_id, body.status)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{quote_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_quote(
    quote_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: AdminOrSecretary,
):
    service = QuoteService(db)
    try:
        await service.delete_quote(quote_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
