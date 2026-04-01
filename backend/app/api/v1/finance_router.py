import uuid
from datetime import date, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.schemas import (
    ExpenseCreate,
    ExpenseResponse,
    ExpenseUpdate,
    FinanceKPIsResponse,
    OtherIncomeCreate,
    OtherIncomeResponse,
    OtherIncomeUpdate,
)
from app.application.services.finance_service import FinanceService
from app.auth.dependencies import get_current_user, require_role
from app.domain.aggregates.user import User
from app.domain.enums import ExpenseCategory, IncomeCategory, UserRole
from app.infrastructure.database import get_db

router = APIRouter(prefix="/finance", tags=["finance"])

AdminOnly = Annotated[User, Depends(require_role(UserRole.ADMIN))]


# ---- Expenses ----

@router.get("/expenses", response_model=list[ExpenseResponse])
async def list_expenses(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: AdminOnly,
    from_date: date = Query(default_factory=lambda: date.today() - timedelta(days=30)),
    to_date: date = Query(default_factory=date.today),
    category: ExpenseCategory | None = Query(default=None),
):
    service = FinanceService(db)
    return await service.list_expenses(from_date, to_date, category)


@router.post("/expenses", response_model=ExpenseResponse, status_code=status.HTTP_201_CREATED)
async def create_expense(
    body: ExpenseCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: AdminOnly,
):
    service = FinanceService(db)
    return await service.create_expense(
        expense_date=body.date,
        category=body.category,
        description=body.description,
        amount=body.amount,
        notes=body.notes,
        receipt_url=body.receipt_url,
    )


@router.put("/expenses/{expense_id}", response_model=ExpenseResponse)
async def update_expense(
    expense_id: uuid.UUID,
    body: ExpenseUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: AdminOnly,
):
    service = FinanceService(db)
    try:
        return await service.update_expense(expense_id, body.model_dump(exclude_unset=True))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.delete("/expenses/{expense_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_expense(
    expense_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: AdminOnly,
):
    service = FinanceService(db)
    try:
        await service.delete_expense(expense_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


# ---- Other Income ----

@router.get("/income", response_model=list[OtherIncomeResponse])
async def list_income(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: AdminOnly,
    from_date: date = Query(default_factory=lambda: date.today() - timedelta(days=30)),
    to_date: date = Query(default_factory=date.today),
    category: IncomeCategory | None = Query(default=None),
):
    service = FinanceService(db)
    return await service.list_income(from_date, to_date, category)


@router.post("/income", response_model=OtherIncomeResponse, status_code=status.HTTP_201_CREATED)
async def create_income(
    body: OtherIncomeCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: AdminOnly,
):
    service = FinanceService(db)
    return await service.create_income(
        income_date=body.date,
        category=body.category,
        description=body.description,
        amount=body.amount,
        notes=body.notes,
    )


@router.put("/income/{income_id}", response_model=OtherIncomeResponse)
async def update_income(
    income_id: uuid.UUID,
    body: OtherIncomeUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: AdminOnly,
):
    service = FinanceService(db)
    try:
        return await service.update_income(income_id, body.model_dump(exclude_unset=True))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.delete("/income/{income_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_income(
    income_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: AdminOnly,
):
    service = FinanceService(db)
    try:
        await service.delete_income(income_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


# ---- KPIs ----

@router.get("/kpis", response_model=FinanceKPIsResponse)
async def get_kpis(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: AdminOnly,
    from_date: date = Query(default_factory=lambda: date.today() - timedelta(days=30)),
    to_date: date = Query(default_factory=date.today),
):
    service = FinanceService(db)
    return await service.get_kpis(from_date, to_date)
