import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.aggregates.client import Client
from app.domain.aggregates.client_price import ClientPrice
from app.domain.enums import ClientType
from app.infrastructure.repositories import ClientRepository


class ClientService:
    def __init__(self, session: AsyncSession) -> None:
        self.repo = ClientRepository(session)

    async def get_all(self) -> list[Client]:
        return await self.repo.get_all()

    async def get_by_id(self, client_id: uuid.UUID) -> Client | None:
        return await self.repo.get_by_id_with_prices(client_id)

    async def create(
        self,
        name: str,
        client_type: ClientType,
        cedula_nit: str,
        address: str | None = None,
        delivery_zone: str | None = None,
        phone: str | None = None,
        email: str | None = None,
    ) -> Client:
        existing = await self.repo.get_by_cedula_nit(cedula_nit)
        if existing:
            raise ValueError(f"Client with cedula/NIT '{cedula_nit}' already exists")

        client = Client(
            name=name,
            client_type=client_type,
            cedula_nit=cedula_nit,
            address=address,
            delivery_zone=delivery_zone,
            phone=phone,
            email=email,
            prices=[],
        )
        return await self.repo.create(client)

    async def update(self, client_id: uuid.UUID, updates: dict) -> Client:
        client = await self.repo.get_by_id_with_prices(client_id)
        if not client:
            raise ValueError("Client not found")
        return await self.repo.update(client, updates)

    async def set_price(
        self, client_id: uuid.UUID, product_id: uuid.UUID, price: float
    ) -> ClientPrice:
        return await self.repo.set_client_price(client_id, product_id, price)

    async def get_prices(self, client_id: uuid.UUID) -> list[ClientPrice]:
        client = await self.repo.get_by_id_with_prices(client_id)
        if not client:
            raise ValueError("Client not found")
        return client.prices
