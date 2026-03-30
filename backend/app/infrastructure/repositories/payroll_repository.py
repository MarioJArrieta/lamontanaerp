import uuid
from datetime import date

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.domain.aggregates.payroll import Advance, Payroll
from app.domain.enums import PayrollStatus
from app.infrastructure.repositories.base_repository import BaseRepository


class PayrollRepository(BaseRepository[Payroll]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session, Payroll)

    async def get_by_period(self, from_date: date, to_date: date) -> list[Payroll]:
        stmt = (
            select(Payroll)
            .options(selectinload(Payroll.employee))
            .where(Payroll.period_start >= from_date, Payroll.period_end <= to_date)
            .order_by(Payroll.period_start.desc())
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def get_by_employee(
        self, employee_id: uuid.UUID, from_date: date, to_date: date
    ) -> list[Payroll]:
        stmt = (
            select(Payroll)
            .where(
                Payroll.employee_id == employee_id,
                Payroll.period_start >= from_date,
                Payroll.period_end <= to_date,
            )
            .order_by(Payroll.period_start.desc())
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())


class AdvanceRepository(BaseRepository[Advance]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session, Advance)

    async def get_unlinked_by_employee(self, employee_id: uuid.UUID) -> list[Advance]:
        """Get advances not yet deducted from a payroll."""
        stmt = (
            select(Advance)
            .where(Advance.employee_id == employee_id, Advance.payroll_id.is_(None))
            .order_by(Advance.date)
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def get_by_employee(
        self, employee_id: uuid.UUID, from_date: date | None = None, to_date: date | None = None
    ) -> list[Advance]:
        stmt = select(Advance).where(Advance.employee_id == employee_id).order_by(Advance.date.desc())
        if from_date:
            stmt = stmt.where(Advance.date >= from_date)
        if to_date:
            stmt = stmt.where(Advance.date <= to_date)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def sum_unlinked(self, employee_id: uuid.UUID) -> float:
        stmt = select(func.coalesce(func.sum(Advance.amount), 0)).where(
            Advance.employee_id == employee_id, Advance.payroll_id.is_(None)
        )
        result = await self.session.execute(stmt)
        return float(result.scalar_one())
