import uuid
from datetime import date

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.domain.aggregates.production import Production
from app.infrastructure.repositories.base_repository import BaseRepository


class ProductionRepository(BaseRepository[Production]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session, Production)

    async def get_by_date_range(self, from_date: date, to_date: date) -> list[Production]:
        stmt = (
            select(Production)
            .options(selectinload(Production.employee), selectinload(Production.bobina))
            .where(Production.date >= from_date, Production.date <= to_date)
            .order_by(Production.date.desc())
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def get_by_employee(self, employee_id: uuid.UUID, from_date: date, to_date: date) -> list[Production]:
        stmt = (
            select(Production)
            .options(selectinload(Production.employee), selectinload(Production.bobina))
            .where(
                Production.employee_id == employee_id,
                Production.date >= from_date,
                Production.date <= to_date,
            )
            .order_by(Production.date.desc())
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def count_pacas_by_employee(
        self, employee_id: uuid.UUID, from_date: date, to_date: date
    ) -> int:
        stmt = select(func.coalesce(func.sum(Production.pacas_produced), 0)).where(
            Production.employee_id == employee_id,
            Production.date >= from_date,
            Production.date <= to_date,
        )
        result = await self.session.execute(stmt)
        return int(result.scalar_one())

    async def get_summary(self, from_date: date, to_date: date) -> dict:
        stmt = select(
            func.sum(Production.pacas_produced).label("total_pacas"),
            func.sum(Production.botellones_produced).label("total_botellones"),
            func.sum(Production.waste_pacas).label("total_waste"),
            func.count(Production.id).label("total_records"),
        ).where(Production.date >= from_date, Production.date <= to_date)
        result = await self.session.execute(stmt)
        row = result.one()
        return {
            "total_pacas": row.total_pacas or 0,
            "total_botellones": row.total_botellones or 0,
            "total_waste": row.total_waste or 0,
            "total_records": row.total_records or 0,
        }
