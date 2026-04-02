import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.domain.aggregates.inventory import Inventory, InventoryMovement
from app.domain.enums import InventoryMovementType


class InventoryRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_all(self) -> list[Inventory]:
        stmt = select(Inventory).options(selectinload(Inventory.product))
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def get_by_product(self, product_id: uuid.UUID) -> Inventory | None:
        stmt = select(Inventory).where(Inventory.product_id == product_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def ensure_exists(self, product_id: uuid.UUID) -> Inventory:
        inv = await self.get_by_product(product_id)
        if not inv:
            inv = Inventory(product_id=product_id, quantity=0)
            self.session.add(inv)
            await self.session.flush()
        return inv

    async def adjust(
        self,
        product_id: uuid.UUID,
        quantity: int,
        movement_type: InventoryMovementType,
        reference_id: uuid.UUID | None = None,
        notes: str | None = None,
    ) -> Inventory:
        inv = await self.ensure_exists(product_id)
        inv.quantity += quantity

        movement = InventoryMovement(
            product_id=product_id,
            movement_type=movement_type,
            quantity=quantity,
            reference_id=reference_id,
            notes=notes,
        )
        self.session.add(movement)
        await self.session.flush()
        return inv

    async def recalculate_all(self) -> list[Inventory]:
        """Recalculate inventory quantities from movement history."""
        from sqlalchemy import func
        # Sum all movements per product
        stmt = (
            select(InventoryMovement.product_id, func.sum(InventoryMovement.quantity))
            .group_by(InventoryMovement.product_id)
        )
        result = await self.session.execute(stmt)
        totals = {row[0]: int(row[1]) for row in result.all()}

        # Update each inventory record
        inventories = await self.get_all()
        for inv in inventories:
            inv.quantity = totals.get(inv.product_id, 0)

        await self.session.flush()
        return inventories

    async def get_movements(
        self, product_id: uuid.UUID | None = None, limit: int = 100
    ) -> list[InventoryMovement]:
        stmt = (
            select(InventoryMovement)
            .options(selectinload(InventoryMovement.product))
            .order_by(InventoryMovement.created_at.desc())
            .limit(limit)
        )
        if product_id:
            stmt = stmt.where(InventoryMovement.product_id == product_id)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())
