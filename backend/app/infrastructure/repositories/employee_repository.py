from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.aggregates.employee import Employee
from app.domain.enums import EmployeeRole
from app.infrastructure.repositories.base_repository import BaseRepository


class EmployeeRepository(BaseRepository[Employee]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session, Employee)

    async def get_by_role(self, role: EmployeeRole) -> list[Employee]:
        stmt = select(Employee).where(
            Employee.role == role, Employee.is_active == True  # noqa: E712
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def get_by_cedula(self, cedula: str) -> Employee | None:
        stmt = select(Employee).where(Employee.cedula == cedula)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()
