from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.aggregates.expense import Expense
from app.domain.enums import ExpenseCategory
from app.infrastructure.repositories.base_repository import BaseRepository


class ExpenseRepository(BaseRepository[Expense]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session, Expense)

    async def get_by_date_range(
        self,
        from_date: date,
        to_date: date,
        category: ExpenseCategory | None = None,
    ) -> list[Expense]:
        stmt = (
            select(Expense)
            .where(Expense.date >= from_date, Expense.date <= to_date)
            .order_by(Expense.date.desc(), Expense.created_at.desc())
        )
        if category:
            stmt = stmt.where(Expense.category == category)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())
