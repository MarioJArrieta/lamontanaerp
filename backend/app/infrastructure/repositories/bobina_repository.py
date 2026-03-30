from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.aggregates.bobina import Bobina
from app.infrastructure.repositories.base_repository import BaseRepository


class BobinaRepository(BaseRepository[Bobina]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session, Bobina)

    async def get_available(self) -> list[Bobina]:
        stmt = select(Bobina).where(Bobina.is_exhausted == False).order_by(Bobina.created_at)  # noqa: E712
        result = await self.session.execute(stmt)
        return list(result.scalars().all())
