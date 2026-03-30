from datetime import date, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.schemas import ProductionCreate, ProductionResponse, ProductionSummaryResponse
from app.application.services.production_service import ProductionService
from app.auth.dependencies import require_role
from app.domain.aggregates.user import User
from app.domain.enums import UserRole
from app.infrastructure.database import get_db

router = APIRouter(prefix="/production", tags=["production"])

AdminUser = Annotated[User, Depends(require_role(UserRole.ADMIN))]


@router.get("", response_model=list[ProductionResponse])
async def list_production(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: AdminUser,
    from_date: date = Query(default_factory=lambda: date.today() - timedelta(days=30)),
    to_date: date = Query(default_factory=date.today),
):
    service = ProductionService(db)
    return await service.get_by_date_range(from_date, to_date)


@router.post("", response_model=ProductionResponse, status_code=status.HTTP_201_CREATED)
async def register_production(
    body: ProductionCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: AdminUser,
):
    service = ProductionService(db)
    try:
        production = await service.register_production(
            production_date=body.date,
            employee_id=body.employee_id,
            pacas_produced=body.pacas_produced,
            botellones_produced=body.botellones_produced,
            waste_pacas=body.waste_pacas,
            bobina_id=body.bobina_id,
            notes=body.notes,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    return production


@router.get("/summary", response_model=ProductionSummaryResponse)
async def production_summary(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: AdminUser,
    from_date: date = Query(default_factory=lambda: date.today() - timedelta(days=30)),
    to_date: date = Query(default_factory=date.today),
):
    service = ProductionService(db)
    return await service.get_summary(from_date, to_date)
