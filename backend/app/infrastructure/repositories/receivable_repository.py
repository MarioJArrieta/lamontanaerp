import uuid
from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.domain.aggregates.receivable import Receivable
from app.domain.enums import ReceivableStatus
from app.infrastructure.repositories.base_repository import BaseRepository


class ReceivableRepository(BaseRepository[Receivable]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session, Receivable)

    async def get_pending(self) -> list[Receivable]:
        stmt = (
            select(Receivable)
            .options(selectinload(Receivable.client), selectinload(Receivable.sale))
            .where(Receivable.status == ReceivableStatus.PENDING)
            .order_by(Receivable.due_date)
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def get_overdue(self, as_of: date | None = None) -> list[Receivable]:
        ref_date = as_of or date.today()
        stmt = (
            select(Receivable)
            .options(selectinload(Receivable.client), selectinload(Receivable.sale))
            .where(
                Receivable.status == ReceivableStatus.PENDING,
                Receivable.due_date < ref_date,
            )
            .order_by(Receivable.due_date)
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def get_by_client(self, client_id: uuid.UUID) -> list[Receivable]:
        stmt = (
            select(Receivable)
            .options(selectinload(Receivable.sale))
            .where(Receivable.client_id == client_id)
            .order_by(Receivable.due_date.desc())
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def get_by_sale(self, sale_id: uuid.UUID) -> Receivable | None:
        stmt = select(Receivable).where(Receivable.sale_id == sale_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()
