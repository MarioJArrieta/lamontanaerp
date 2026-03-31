import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.aggregates.loyalty_transaction import LoyaltyTransaction
from app.infrastructure.repositories.base_repository import BaseRepository


class LoyaltyRepository(BaseRepository[LoyaltyTransaction]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session, LoyaltyTransaction)

    async def get_by_client(self, client_id: uuid.UUID) -> list[LoyaltyTransaction]:
        stmt = (
            select(LoyaltyTransaction)
            .where(LoyaltyTransaction.client_id == client_id)
            .order_by(LoyaltyTransaction.created_at.desc())
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def get_by_sale(self, sale_id: uuid.UUID) -> list[LoyaltyTransaction]:
        stmt = select(LoyaltyTransaction).where(
            LoyaltyTransaction.sale_id == sale_id
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())
