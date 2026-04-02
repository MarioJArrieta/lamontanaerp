import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.aggregates.inventory import Inventory, InventoryMovement
from app.domain.enums import InventoryMovementType
from app.infrastructure.repositories import InventoryRepository


class InventoryService:
    def __init__(self, session: AsyncSession) -> None:
        self.repo = InventoryRepository(session)

    async def get_all(self) -> list[Inventory]:
        return await self.repo.get_all()

    async def get_by_product(self, product_id: uuid.UUID) -> Inventory | None:
        return await self.repo.get_by_product(product_id)

    async def adjust(
        self,
        product_id: uuid.UUID,
        quantity: int,
        notes: str | None = None,
    ) -> Inventory:
        return await self.repo.adjust(
            product_id=product_id,
            quantity=quantity,
            movement_type=InventoryMovementType.ADJUSTMENT,
            notes=notes,
        )

    async def recalculate(self) -> list[Inventory]:
        return await self.repo.recalculate_all()

    async def get_movements(
        self, product_id: uuid.UUID | None = None, limit: int = 100
    ) -> list[InventoryMovement]:
        return await self.repo.get_movements(product_id, limit)
