import uuid
from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.aggregates.employee import Employee
from app.domain.enums import EmployeeRole, PayPeriod
from app.infrastructure.repositories import EmployeeRepository


class EmployeeService:
    def __init__(self, session: AsyncSession) -> None:
        self.repo = EmployeeRepository(session)

    async def get_all(self) -> list[Employee]:
        return await self.repo.get_all()

    async def get_by_id(self, employee_id: uuid.UUID) -> Employee | None:
        return await self.repo.get_by_id(employee_id)

    async def get_by_role(self, role: EmployeeRole) -> list[Employee]:
        return await self.repo.get_by_role(role)

    async def create(
        self,
        name: str,
        cedula: str,
        role: EmployeeRole,
        pay_period: PayPeriod,
        fixed_salary: Decimal | None = None,
        rate_per_paca: Decimal | None = None,
        phone: str | None = None,
    ) -> Employee:
        existing = await self.repo.get_by_cedula(cedula)
        if existing:
            raise ValueError(f"Employee with cedula '{cedula}' already exists")

        if role == EmployeeRole.SECRETARY and fixed_salary is None:
            raise ValueError("Secretary must have a fixed salary")
        if role in (EmployeeRole.PACKER, EmployeeRole.DELIVERY) and rate_per_paca is None:
            raise ValueError(f"{role.value} must have a rate per paca")

        employee = Employee(
            name=name,
            cedula=cedula,
            role=role,
            pay_period=pay_period,
            fixed_salary=fixed_salary,
            rate_per_paca=rate_per_paca,
            phone=phone,
        )
        return await self.repo.create(employee)

    async def update(self, employee_id: uuid.UUID, updates: dict) -> Employee:
        employee = await self.repo.get_by_id(employee_id)
        if not employee:
            raise ValueError("Employee not found")
        return await self.repo.update(employee, updates)
