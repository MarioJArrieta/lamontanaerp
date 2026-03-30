import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.aggregates.bobina import Bobina
from app.infrastructure.repositories import BobinaRepository


class BobinaService:
    def __init__(self, session: AsyncSession) -> None:
        self.repo = BobinaRepository(session)

    async def get_all(self) -> list[Bobina]:
        return await self.repo.get_all(active_only=False)

    async def get_available(self) -> list[Bobina]:
        return await self.repo.get_available()

    async def get_by_id(self, bobina_id: uuid.UUID) -> Bobina | None:
        return await self.repo.get_by_id(bobina_id)

    async def register(
        self,
        weight_kg: Decimal,
        cost: Decimal,
        estimated_pacas: int = 250,
        supplier: str | None = None,
        notes: str | None = None,
        code: str | None = None,
        purchase_date: date | None = None,
    ) -> Bobina:
        bobina = Bobina(
            code=code,
            purchase_date=purchase_date,
            weight_kg=weight_kg,
            cost=cost,
            estimated_pacas=estimated_pacas,
            remaining_pacas=estimated_pacas,
            supplier=supplier,
            notes=notes,
        )
        return await self.repo.create(bobina)

    async def update(self, bobina_id: uuid.UUID, updates: dict) -> Bobina:
        bobina = await self.repo.get_by_id(bobina_id)
        if not bobina:
            raise ValueError("Bobina not found")
        return await self.repo.update(bobina, updates)

    async def consume(self, bobina_id: uuid.UUID, pacas_used: int) -> Bobina:
        bobina = await self.repo.get_by_id(bobina_id)
        if not bobina:
            raise ValueError("Bobina not found")
        if bobina.is_exhausted:
            raise ValueError("Bobina is already exhausted")
        if pacas_used > bobina.remaining_pacas:
            raise ValueError(
                f"Cannot consume {pacas_used} pacas, only {bobina.remaining_pacas} remaining"
            )

        bobina.remaining_pacas -= pacas_used
        if bobina.remaining_pacas <= 0:
            bobina.is_exhausted = True

        await self.repo.session.flush()
        return bobina
