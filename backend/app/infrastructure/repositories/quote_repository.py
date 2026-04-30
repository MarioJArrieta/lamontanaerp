import uuid
from datetime import date

from sqlalchemy import case, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.domain.aggregates.quote import Quote
from app.domain.enums import QuoteStatus
from app.infrastructure.repositories.base_repository import BaseRepository


class QuoteRepository(BaseRepository[Quote]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session, Quote)

    async def get_by_id_with_items(self, quote_id: uuid.UUID) -> Quote | None:
        stmt = (
            select(Quote)
            .options(
                selectinload(Quote.items),
                selectinload(Quote.client),
            )
            .where(Quote.id == quote_id)
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_date_range(
        self, from_date: date, to_date: date, statuses: list[QuoteStatus] | None = None
    ) -> list[Quote]:
        stmt = (
            select(Quote)
            .options(selectinload(Quote.items), selectinload(Quote.client))
            .where(Quote.date >= from_date, Quote.date <= to_date)
            .order_by(
                case(
                    (Quote.status == QuoteStatus.DRAFT, 0),
                    (Quote.status == QuoteStatus.SENT, 1),
                    (Quote.status == QuoteStatus.ACCEPTED, 2),
                    (Quote.status == QuoteStatus.REJECTED, 3),
                    else_=4,
                ),
                Quote.date.desc(),
                Quote.created_at.desc(),
            )
        )
        if statuses:
            stmt = stmt.where(Quote.status.in_(statuses))
        result = await self.session.execute(stmt)
        return list(result.scalars().all())
