import uuid
from datetime import date, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from sqlalchemy import select, update

from app.api.v1.schemas import DeliveryCreate, DeliveryResponse
from app.application.services.delivery_service import DeliveryService
from app.auth.dependencies import get_current_user, require_role
from app.domain.aggregates.delivery import Delivery
from app.domain.aggregates.sale import Sale
from app.domain.aggregates.user import User
from app.domain.enums import DeliveryStatus, SaleStatus, UserRole
from app.infrastructure.database import get_db

router = APIRouter(prefix="/deliveries", tags=["deliveries"])

AdminOrSecretary = Annotated[User, Depends(require_role(UserRole.ADMIN, UserRole.SECRETARY))]
AnyAuth = Annotated[User, Depends(get_current_user)]


@router.get("", response_model=list[DeliveryResponse])
async def list_deliveries(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: AnyAuth,
    from_date: date = Query(default_factory=lambda: date.today() - timedelta(days=7)),
    to_date: date = Query(default_factory=date.today),
):
    service = DeliveryService(db)
    # Delivery users only see their own deliveries
    if current_user.role == UserRole.DELIVERY and current_user.employee_id:
        return await service.get_by_employee_date_range(
            current_user.employee_id, from_date, to_date
        )
    return await service.get_by_date_range(from_date, to_date)


@router.get("/employee/{employee_id}", response_model=list[DeliveryResponse])
async def list_by_employee(
    employee_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: AnyAuth,
    target_date: date = Query(default_factory=date.today),
):
    service = DeliveryService(db)
    return await service.get_by_employee_date(employee_id, target_date)


@router.post("", response_model=DeliveryResponse, status_code=status.HTTP_201_CREATED)
async def create_delivery(
    body: DeliveryCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: AdminOrSecretary,
):
    service = DeliveryService(db)
    try:
        return await service.create_delivery(
            delivery_date=body.date,
            sale_id=body.sale_id,
            delivery_employee_id=body.delivery_employee_id,
            pacas_delivered=body.pacas_delivered,
            botellones_delivered=body.botellones_delivered,
            notes=body.notes,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/{delivery_id}/in-route", response_model=DeliveryResponse)
async def mark_in_route(
    delivery_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_role(UserRole.ADMIN, UserRole.SECRETARY, UserRole.DELIVERY))],
):
    service = DeliveryService(db)
    try:
        return await service.mark_in_route(delivery_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/{delivery_id}/delivered", response_model=DeliveryResponse)
async def mark_delivered(
    delivery_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_role(UserRole.ADMIN, UserRole.SECRETARY, UserRole.DELIVERY))],
):
    service = DeliveryService(db)
    try:
        return await service.mark_delivered(delivery_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/sync-paid", status_code=status.HTTP_200_OK)
async def sync_paid_deliveries(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_role(UserRole.ADMIN))],
):
    """Mark all deliveries as delivered if their sale is already paid."""
    stmt = (
        update(Delivery)
        .where(
            Delivery.status != DeliveryStatus.DELIVERED,
            Delivery.sale_id.in_(
                select(Sale.id).where(Sale.status == SaleStatus.PAID)
            ),
        )
        .values(status=DeliveryStatus.DELIVERED)
    )
    result = await db.execute(stmt)
    await db.commit()
    return {"updated": result.rowcount}
