import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.schemas import EmployeeCreate, EmployeeResponse, EmployeeUpdate
from app.application.services.employee_service import EmployeeService
from app.auth.dependencies import require_role
from app.domain.aggregates.user import User
from app.domain.enums import UserRole
from app.infrastructure.database import get_db

router = APIRouter(prefix="/employees", tags=["employees"])

AdminUser = Annotated[User, Depends(require_role(UserRole.ADMIN))]


@router.get("", response_model=list[EmployeeResponse])
async def list_employees(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: AdminUser,
):
    service = EmployeeService(db)
    return await service.get_all()


@router.post("", response_model=EmployeeResponse, status_code=status.HTTP_201_CREATED)
async def create_employee(
    body: EmployeeCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: AdminUser,
):
    service = EmployeeService(db)
    try:
        employee = await service.create(
            name=body.name,
            cedula=body.cedula,
            role=body.role,
            pay_period=body.pay_period,
            fixed_salary=body.fixed_salary,
            rate_per_paca=body.rate_per_paca,
            phone=body.phone,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    return employee


@router.put("/{employee_id}", response_model=EmployeeResponse)
async def update_employee(
    employee_id: uuid.UUID,
    body: EmployeeUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: AdminUser,
):
    service = EmployeeService(db)
    try:
        employee = await service.update(employee_id, body.model_dump(exclude_unset=True))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    return employee
