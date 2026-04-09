import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.aggregates.expense import Expense
from app.domain.aggregates.production import Production
from app.domain.enums import ExpenseCategory, InventoryMovementType, ProductType
from app.infrastructure.repositories import (
    BobinaRepository,
    EmployeeRepository,
    ExpenseRepository,
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
        self.employee_repo = EmployeeRepository(session)
        self.expense_repo = ExpenseRepository(session)
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

    async def update_production(
        self, production_id: uuid.UUID, updates: dict
    ) -> Production:
        production = await self.production_repo.get_by_id(production_id)
        if not production:
            raise ValueError("Produccion no encontrada")
        if production.is_paid:
            raise ValueError("No se puede editar una produccion ya pagada")
        for key, value in updates.items():
            if value is not None and hasattr(production, key):
                setattr(production, key, value)
        await self.session.flush()
        return production

    async def delete_production(self, production_id: uuid.UUID) -> None:
        from sqlalchemy import delete as sa_delete
        from app.domain.aggregates.inventory import InventoryMovement

        production = await self.production_repo.get_by_id(production_id)
        if not production:
            raise ValueError("Produccion no encontrada")
        if production.is_paid:
            raise ValueError("No se puede eliminar una produccion ya pagada")

        # Reverse inventory movements linked to this production
        await self.session.execute(
            sa_delete(InventoryMovement).where(
                InventoryMovement.reference_id == production_id
            )
        )

        # Restore bobina pacas if applicable
        if production.bobina_id:
            bobina = await self.bobina_repo.get_by_id(production.bobina_id)
            if bobina:
                total_consumed = production.pacas_produced + production.waste_pacas
                bobina.remaining_pacas += total_consumed
                if bobina.remaining_pacas > 0:
                    bobina.is_exhausted = False

        await self.production_repo.delete(production)

    async def pay_production(self, production_id: uuid.UUID) -> Production:
        # Lock the row to prevent concurrent double-pay (SELECT ... FOR UPDATE)
        from sqlalchemy import select as sa_select

        stmt = (
            sa_select(Production)
            .where(Production.id == production_id)
            .with_for_update()
        )
        result = await self.session.execute(stmt)
        production = result.scalar_one_or_none()
        if not production:
            raise ValueError("Produccion no encontrada")
        if production.is_paid:
            raise ValueError("Esta produccion ya fue pagada")

        employee = await self.employee_repo.get_by_id(production.employee_id)
        if not employee:
            raise ValueError("Empleado no encontrado")

        # Calculate payment: pacas * rate_per_paca
        rate = employee.rate_per_paca or Decimal("0")
        amount = Decimal(production.pacas_produced) * rate

        if amount <= 0:
            raise ValueError("El monto a pagar es 0. Verifique la tarifa por paca del empleado.")

        # Mark production as paid
        production.is_paid = True
        production.payment_amount = amount
        await self.session.flush()

        # Create expense record
        expense = Expense(
            date=production.date,
            category=ExpenseCategory.PAYROLL,
            description=f"Pago produccion {production.pacas_produced} pacas - {employee.name}",
            amount=amount,
            notes=f"Produccion ID: {production.id}",
        )
        await self.expense_repo.create(expense)

        return production
