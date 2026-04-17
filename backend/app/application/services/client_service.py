import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.security import generate_password, hash_password
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
    ) -> tuple[Client, str]:
        existing = await self.repo.get_by_cedula_nit(cedula_nit)
        if existing:
            raise ValueError(f"Client with cedula/NIT '{cedula_nit}' already exists")

        plain_password = generate_password()
        client = Client(
            name=name,
            client_type=client_type,
            cedula_nit=cedula_nit,
            address=address,
            delivery_zone=delivery_zone,
            phone=phone,
            email=email,
            hashed_password=hash_password(plain_password),
            prices=[],
        )
        created = await self.repo.create(client)
        return created, plain_password

    async def reset_password(self, client_id: uuid.UUID) -> tuple[Client, str]:
        client = await self.repo.get_by_id_with_prices(client_id)
        if not client:
            raise ValueError("Client not found")
        plain_password = generate_password()
        client.hashed_password = hash_password(plain_password)
        await self.repo.update(client, {})
        return client, plain_password

    async def update(self, client_id: uuid.UUID, updates: dict) -> Client:
        client = await self.repo.get_by_id_with_prices(client_id)
        if not client:
            raise ValueError("Client not found")

        new_cedula_nit = updates.get("cedula_nit")
        if new_cedula_nit and new_cedula_nit != client.cedula_nit:
            existing = await self.repo.get_by_cedula_nit(new_cedula_nit)
            if existing and existing.id != client_id:
                raise ValueError(
                    f"Client with cedula/NIT '{new_cedula_nit}' already exists"
                )

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

    async def delete_price(
        self, client_id: uuid.UUID, product_id: uuid.UUID
    ) -> bool:
        return await self.repo.delete_client_price(client_id, product_id)
