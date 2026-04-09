import uuid
from datetime import date, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.schemas import SaleAssignDelivery, SaleCreate, SaleDeleteConfirm, SaleMarkPaid, SaleResponse, SaleUpdate
from app.application.services.sale_service import SaleService
from app.auth.dependencies import get_current_user, require_role
from app.domain.aggregates.user import User
from app.domain.enums import SaleStatus, UserRole
from app.infrastructure.database import get_db

router = APIRouter(prefix="/sales", tags=["sales"])

AdminOrSecretary = Annotated[User, Depends(require_role(UserRole.ADMIN, UserRole.SECRETARY))]


@router.get("", response_model=list[SaleResponse])
async def list_sales(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
    from_date: date = Query(default_factory=lambda: date.today() - timedelta(days=30)),
    to_date: date = Query(default_factory=date.today),
    sale_status: SaleStatus | None = Query(default=None, alias="status"),
):
    service = SaleService(db)
    return await service.get_by_date_range(from_date, to_date, sale_status)


@router.get("/{sale_id}", response_model=SaleResponse)
async def get_sale(
    sale_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
):
    service = SaleService(db)
    sale = await service.get_by_id(sale_id)
    if not sale:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sale not found")
    return sale


@router.post("", response_model=SaleResponse, status_code=status.HTTP_201_CREATED)
async def create_sale(
    body: SaleCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: AdminOrSecretary,
):
    service = SaleService(db)
    try:
        sale = await service.create_sale(
            sale_date=body.date,
            client_id=body.client_id,
            delivery_employee_id=body.delivery_employee_id,
            items=[item.model_dump() for item in body.items],
            payment_type=body.payment_type,
            notes=body.notes,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    return sale


@router.put("/{sale_id}", response_model=SaleResponse)
async def update_sale(
    sale_id: uuid.UUID,
    body: SaleUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: AdminOrSecretary,
):
    service = SaleService(db)
    try:
        return await service.update_sale(sale_id, body.model_dump(exclude_unset=True))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/{sale_id}/assign-delivery", response_model=SaleResponse)
async def assign_delivery(
    sale_id: uuid.UUID,
    body: SaleAssignDelivery,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: AdminOrSecretary,
):
    service = SaleService(db)
    try:
        return await service.assign_delivery(sale_id, body.delivery_employee_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/{sale_id}/pay", response_model=SaleResponse)
async def mark_paid(
    sale_id: uuid.UUID,
    body: SaleMarkPaid,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_role(UserRole.ADMIN, UserRole.SECRETARY, UserRole.DELIVERY))],
):
    service = SaleService(db)
    try:
        return await service.mark_paid(sale_id, body.payment_method)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/{sale_id}/delete", status_code=status.HTTP_204_NO_CONTENT)
async def delete_sale(
    sale_id: uuid.UUID,
    body: SaleDeleteConfirm,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: AdminOrSecretary,
):
    service = SaleService(db)
    try:
        await service.delete_sale(sale_id, body.admin_password)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
