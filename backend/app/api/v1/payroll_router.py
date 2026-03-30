import uuid
from datetime import date, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.schemas import (
    AdvanceCreate,
    AdvanceResponse,
    PayrollCalculate,
    PayrollResponse,
)
from app.application.services.payroll_service import PayrollService
from app.auth.dependencies import require_role
from app.domain.aggregates.user import User
from app.domain.enums import UserRole
from app.infrastructure.database import get_db

router = APIRouter(prefix="/payroll", tags=["payroll"])

AdminOnly = Annotated[User, Depends(require_role(UserRole.ADMIN))]


@router.get("", response_model=list[PayrollResponse])
async def list_payrolls(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: AdminOnly,
    from_date: date = Query(default_factory=lambda: date.today() - timedelta(days=30)),
    to_date: date = Query(default_factory=date.today),
):
    service = PayrollService(db)
    return await service.get_by_period(from_date, to_date)


@router.get("/employee/{employee_id}", response_model=list[PayrollResponse])
async def list_by_employee(
    employee_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: AdminOnly,
    from_date: date = Query(default_factory=lambda: date.today() - timedelta(days=90)),
    to_date: date = Query(default_factory=date.today),
):
    service = PayrollService(db)
    return await service.get_by_employee(employee_id, from_date, to_date)


@router.post("/calculate", response_model=PayrollResponse, status_code=status.HTTP_201_CREATED)
async def calculate_payroll(
    body: PayrollCalculate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: AdminOnly,
):
    service = PayrollService(db)
    try:
        return await service.calculate_payroll(
            employee_id=body.employee_id,
            period_start=body.period_start,
            period_end=body.period_end,
            deductions=body.deductions,
            notes=body.notes,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/{payroll_id}/pay", response_model=PayrollResponse)
async def mark_paid(
    payroll_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: AdminOnly,
):
    service = PayrollService(db)
    try:
        return await service.mark_paid(payroll_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


# ---- Advances ----
@router.post("/advances", response_model=AdvanceResponse, status_code=status.HTTP_201_CREATED)
async def create_advance(
    body: AdvanceCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: AdminOnly,
):
    service = PayrollService(db)
    try:
        return await service.create_advance(
            employee_id=body.employee_id,
            amount=body.amount,
            advance_date=body.date,
            notes=body.notes,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/advances/{employee_id}", response_model=list[AdvanceResponse])
async def list_advances(
    employee_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: AdminOnly,
    from_date: date | None = Query(default=None),
    to_date: date | None = Query(default=None),
):
    service = PayrollService(db)
    return await service.get_advances(employee_id, from_date, to_date)


@router.get("/advances/{employee_id}/pending-total")
async def pending_advances_total(
    employee_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: AdminOnly,
):
    service = PayrollService(db)
    total = await service.get_pending_advances_total(employee_id)
    return {"employee_id": str(employee_id), "pending_total": total}
