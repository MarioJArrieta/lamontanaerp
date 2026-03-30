from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.aggregates.other_income import OtherIncome
from app.domain.enums import IncomeCategory
from app.infrastructure.repositories.base_repository import BaseRepository


class OtherIncomeRepository(BaseRepository[OtherIncome]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session, OtherIncome)

    async def get_by_date_range(
        self,
        from_date: date,
        to_date: date,
        category: IncomeCategory | None = None,
    ) -> list[OtherIncome]:
        stmt = (
            select(OtherIncome)
            .where(OtherIncome.date >= from_date, OtherIncome.date <= to_date)
            .order_by(OtherIncome.date.desc(), OtherIncome.created_at.desc())
        )
        if category:
            stmt = stmt.where(OtherIncome.category == category)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())
