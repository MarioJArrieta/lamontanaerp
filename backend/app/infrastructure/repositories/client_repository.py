import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.domain.aggregates.client import Client
from app.domain.aggregates.client_price import ClientPrice
from app.infrastructure.repositories.base_repository import BaseRepository


class ClientRepository(BaseRepository[Client]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session, Client)

    async def get_all(self, *, active_only: bool = True) -> list[Client]:
        stmt = select(Client).options(selectinload(Client.prices))
        if active_only:
            stmt = stmt.where(Client.is_active == True)  # noqa: E712
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def get_by_id_with_prices(self, client_id: uuid.UUID) -> Client | None:
        stmt = (
            select(Client)
            .options(selectinload(Client.prices))
            .where(Client.id == client_id)
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_phone(self, phone: str) -> Client | None:
        stmt = select(Client).where(Client.phone == phone)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_cedula_nit(self, cedula_nit: str) -> Client | None:
        stmt = select(Client).where(Client.cedula_nit == cedula_nit)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def set_client_price(
        self, client_id: uuid.UUID, product_id: uuid.UUID, price: float
    ) -> ClientPrice:
        stmt = select(ClientPrice).where(
            ClientPrice.client_id == client_id,
            ClientPrice.product_id == product_id,
        )
        result = await self.session.execute(stmt)
        existing = result.scalar_one_or_none()

        if existing:
            existing.price = price  # type: ignore[assignment]
            await self.session.flush()
            return existing

        client_price = ClientPrice(
            client_id=client_id, product_id=product_id, price=price
        )
        self.session.add(client_price)
        await self.session.flush()
        return client_price

    async def delete_client_price(
        self, client_id: uuid.UUID, product_id: uuid.UUID
    ) -> bool:
        stmt = select(ClientPrice).where(
            ClientPrice.client_id == client_id,
            ClientPrice.product_id == product_id,
        )
        result = await self.session.execute(stmt)
        existing = result.scalar_one_or_none()
        if existing:
            await self.session.delete(existing)
            await self.session.flush()
            return True
        return False
