import uuid
from typing import Generic, TypeVar

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.aggregates.base import Base

T = TypeVar("T", bound=Base)


class BaseRepository(Generic[T]):
    def __init__(self, session: AsyncSession, model: type[T]) -> None:
        self.session = session
        self.model = model

    async def get_by_id(self, entity_id: uuid.UUID) -> T | None:
        return await self.session.get(self.model, entity_id)

    async def get_all(self, *, active_only: bool = True) -> list[T]:
        stmt = select(self.model)
        if active_only and hasattr(self.model, "is_active"):
            stmt = stmt.where(self.model.is_active == True)  # noqa: E712
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def create(self, entity: T) -> T:
        self.session.add(entity)
        await self.session.flush()
        return entity

    async def update(self, entity: T, updates: dict) -> T:
        for key, value in updates.items():
            if hasattr(entity, key):
                setattr(entity, key, value)
        await self.session.flush()
        return entity

    async def delete(self, entity: T) -> None:
        await self.session.delete(entity)
        await self.session.flush()
