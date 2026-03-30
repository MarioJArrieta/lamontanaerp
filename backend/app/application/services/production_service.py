import uuid
from datetime import date

from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.aggregates.production import Production
from app.domain.enums import InventoryMovementType, ProductType
from app.infrastructure.repositories import (
    BobinaRepository,
    InventoryRepository,
    ProductionRepository,
    ProductRepository,
)


class ProductionService:
    def __init__(self, session: AsyncSession) -> None:
        self.production_repo = ProductionRepository(session)
        self.bobina_repo = BobinaRepository(session)
        self.inventory_repo = InventoryRepository(session)
        self.product_repo = ProductRepository(session)
        self.session = session

    async def get_by_date_range(self, from_date: date, to_date: date) -> list[Production]:
        return await self.production_repo.get_by_date_range(from_date, to_date)

    async def get_summary(self, from_date: date, to_date: date) -> dict:
        return await self.production_repo.get_summary(from_date, to_date)

    async def register_production(
        self,
        production_date: date,
        employee_id: uuid.UUID,
        pacas_produced: int = 0,
        botellones_produced: int = 0,
        waste_pacas: int = 0,
        bobina_id: uuid.UUID | None = None,
        notes: str | None = None,
    ) -> Production:
        # If bobina is specified, consume pacas from it
        if bobina_id and pacas_produced > 0:
            bobina = await self.bobina_repo.get_by_id(bobina_id)
            if not bobina:
                raise ValueError("Bobina not found")
            if bobina.is_exhausted:
                raise ValueError("Bobina is already exhausted")

            total_consumed = pacas_produced + waste_pacas
            if total_consumed > bobina.remaining_pacas:
                raise ValueError(
                    f"Cannot consume {total_consumed} pacas (produced + waste), "
                    f"only {bobina.remaining_pacas} remaining in bobina"
                )

            bobina.remaining_pacas -= total_consumed
            if bobina.remaining_pacas <= 0:
                bobina.is_exhausted = True

        # Create production record
        production = Production(
            date=production_date,
            employee_id=employee_id,
            bobina_id=bobina_id,
            pacas_produced=pacas_produced,
            botellones_produced=botellones_produced,
            waste_pacas=waste_pacas,
            notes=notes,
        )
        await self.production_repo.create(production)

        # Update inventory: add produced items
        if pacas_produced > 0:
            paca_product = await self.product_repo.get_by_type(ProductType.PACA_X40)
            if paca_product:
                await self.inventory_repo.adjust(
                    product_id=paca_product.id,
                    quantity=pacas_produced,
                    movement_type=InventoryMovementType.PRODUCTION_IN,
                    reference_id=production.id,
                    notes=f"Production: {pacas_produced} pacas by employee",
                )

        if botellones_produced > 0:
            botellon_product = await self.product_repo.get_by_type(ProductType.BOTELLON_20L)
            if botellon_product:
                await self.inventory_repo.adjust(
                    product_id=botellon_product.id,
                    quantity=botellones_produced,
                    movement_type=InventoryMovementType.PRODUCTION_IN,
                    reference_id=production.id,
                    notes=f"Production: {botellones_produced} botellones by employee",
                )

        return production
