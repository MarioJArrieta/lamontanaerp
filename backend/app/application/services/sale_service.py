import uuid
from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import delete as sa_delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.security import verify_password
from app.domain.aggregates.delivery import Delivery
from app.domain.aggregates.inventory import InventoryMovement
from app.domain.aggregates.loyalty_transaction import LoyaltyTransaction
from app.domain.aggregates.receivable import Receivable
from app.domain.aggregates.sale import Sale
from app.domain.aggregates.sale_item import SaleItem
from app.domain.aggregates.user import User
from app.domain.enums import (
    DeliveryStatus,
    InventoryMovementType,
    PaymentMethod,
    PaymentType,
    ReceivableStatus,
    SaleStatus,
    UserRole,
)
from app.config import get_settings
from app.config.timezone import bogota_today
from app.application.services.loyalty_service import LoyaltyService
from app.infrastructure.repositories import (
    ClientRepository,
    DeliveryRepository,
    EmployeeRepository,
    InventoryRepository,
    ProductRepository,
    ReceivableRepository,
    SaleRepository,
)


class SaleService:
    def __init__(self, session: AsyncSession) -> None:
        self.sale_repo = SaleRepository(session)
        self.client_repo = ClientRepository(session)
        self.product_repo = ProductRepository(session)
        self.employee_repo = EmployeeRepository(session)
        self.inventory_repo = InventoryRepository(session)
        self.receivable_repo = ReceivableRepository(session)
        self.delivery_repo = DeliveryRepository(session)
        self.loyalty_service = LoyaltyService(session)
        self.session = session

    async def get_by_date_range(
        self, from_date: date, to_date: date, statuses: list[SaleStatus] | None = None
    ) -> list[Sale]:
        return await self.sale_repo.get_by_date_range(from_date, to_date, statuses)

    async def get_collections_by_date(self, target_date: date) -> list[Sale]:
        return await self.sale_repo.get_paid_on_date(target_date)

    async def get_by_id(self, sale_id: uuid.UUID) -> Sale | None:
        return await self.sale_repo.get_by_id_with_items(sale_id)

    async def create_sale(
        self,
        sale_date: date,
        client_id: uuid.UUID,
        delivery_employee_id: uuid.UUID,
        items: list[dict],
        payment_type: PaymentType,
        notes: str | None = None,
        mark_paid: bool = False,
        payment_method: PaymentMethod | None = None,
    ) -> Sale:
        if mark_paid and payment_method is None:
            raise ValueError("Se requiere el medio de pago para cobrar la venta")

        # Validate client
        client = await self.client_repo.get_by_id_with_prices(client_id)
        if not client:
            raise ValueError("Client not found")

        # Validate delivery employee
        employee = await self.employee_repo.get_by_id(delivery_employee_id)
        if not employee:
            raise ValueError("Delivery employee not found")

        # Build price lookup from client-specific prices
        client_prices: dict[uuid.UUID, Decimal] = {}
        for cp in client.prices:
            client_prices[cp.product_id] = cp.price

        # Build sale items and calculate totals
        sale_items: list[SaleItem] = []
        subtotal = Decimal("0")
        tax_total = Decimal("0")
        total_pacas = 0
        total_botellones = 0

        for item_data in items:
            product = await self.product_repo.get_by_id(item_data["product_id"])
            if not product:
                raise ValueError(f"Product {item_data['product_id']} not found")

            quantity = item_data["quantity"]
            if quantity <= 0:
                raise ValueError("Quantity must be positive")

            # Track quantities by product type for delivery
            if product.product_type.value == "paca_x40":
                total_pacas += quantity
            elif product.product_type.value == "botellon_20l":
                total_botellones += quantity

            # Use client price if exists, otherwise product base price
            display_price = client_prices.get(product.id, product.base_price)
            # Allow explicit price override from request
            if "unit_price" in item_data and item_data["unit_price"] is not None:
                display_price = Decimal(str(item_data["unit_price"]))

            tax_rate = product.tax_rate or Decimal("0")
            tax_factor = Decimal("1") + tax_rate / Decimal("100")
            if product.tax_included and tax_rate > 0:
                # display_price already includes IVA → split into net + tax
                unit_price = display_price / tax_factor
            else:
                unit_price = display_price

            item_subtotal = (unit_price * quantity).quantize(Decimal("0.01"))
            item_tax = (item_subtotal * tax_rate / Decimal("100")).quantize(Decimal("0.01"))
            subtotal += item_subtotal
            tax_total += item_tax

            sale_items.append(SaleItem(
                product_id=product.id,
                quantity=quantity,
                unit_price=unit_price,
                subtotal=item_subtotal,
            ))

        # Create sale
        sale = Sale(
            date=sale_date,
            client_id=client_id,
            delivery_employee_id=delivery_employee_id,
            subtotal=subtotal,
            tax=tax_total,
            total=subtotal + tax_total,
            payment_type=payment_type,
            status=SaleStatus.PENDING,
            notes=notes,
            items=sale_items,
        )
        self.session.add(sale)
        await self.session.flush()

        # Deduct inventory for each item
        for item in sale_items:
            await self.inventory_repo.adjust(
                product_id=item.product_id,
                quantity=-item.quantity,
                movement_type=InventoryMovementType.SALE_OUT,
                reference_id=sale.id,
                notes=f"Sale to {client.name}: {item.quantity} units",
            )

        # Auto-create delivery record
        delivery = Delivery(
            date=sale_date,
            sale_id=sale.id,
            delivery_employee_id=delivery_employee_id,
            pacas_delivered=total_pacas,
            botellones_delivered=total_botellones,
            status=DeliveryStatus.PENDING,
        )
        self.session.add(delivery)
        await self.session.flush()

        # Earn loyalty points (puntos)
        await self.loyalty_service.earn_points_for_sale(
            client_id=client_id,
            sale_id=sale.id,
            total_pacas=total_pacas,
            total_botellones=total_botellones,
        )

        # If credit sale, create receivable
        receivable: Receivable | None = None
        if payment_type == PaymentType.CREDIT:
            settings = get_settings()
            receivable = Receivable(
                sale_id=sale.id,
                client_id=client_id,
                amount=sale.total,
                due_date=sale_date + timedelta(days=settings.default_credit_days),
                status=ReceivableStatus.PENDING,
            )
            self.session.add(receivable)
            await self.session.flush()

        # Cobrar la venta al momento de crearla (mismo efecto que mark_paid)
        if mark_paid and payment_method is not None:
            sale.paid_amount = sale.total
            sale.payment_method = payment_method
            sale.status = SaleStatus.PAID
            # La entrega queda completada al cobrar
            delivery.status = DeliveryStatus.DELIVERED
            # Si era a credito, liquidar la cuenta por cobrar recien creada
            if receivable is not None:
                receivable.status = ReceivableStatus.PAID
                receivable.paid_date = bogota_today()
            await self.session.flush()

        return sale

    async def update_sale(
        self, sale_id: uuid.UUID, updates: dict
    ) -> Sale:
        sale = await self.sale_repo.get_by_id_with_items(sale_id)
        if not sale:
            raise ValueError("Sale not found")
        if sale.status == SaleStatus.PAID:
            raise ValueError("No se puede editar una venta ya cobrada")
        for key, value in updates.items():
            if hasattr(sale, key):
                setattr(sale, key, value)
        await self.session.flush()
        return sale

    async def assign_delivery(
        self, sale_id: uuid.UUID, delivery_employee_id: uuid.UUID
    ) -> Sale:
        sale = await self.sale_repo.get_by_id_with_items(sale_id)
        if not sale:
            raise ValueError("Sale not found")
        sale.delivery_employee_id = delivery_employee_id
        await self.session.flush()
        return sale

    async def mark_paid(
        self, sale_id: uuid.UUID, payment_method: PaymentMethod,
        amount: Decimal | None = None,
    ) -> Sale:
        sale = await self.sale_repo.get_by_id_with_items(sale_id)
        if not sale:
            raise ValueError("Sale not found")
        await self._apply_payment(sale, payment_method, amount)
        return sale

    async def _apply_payment(
        self, sale: Sale, payment_method: PaymentMethod,
        amount: Decimal | None = None,
    ) -> Decimal:
        """Liquida un pago sobre una venta ya cargada y ejecuta la cascada
        (delivery -> delivered, receivable -> paid). Devuelve el monto cobrado.
        amount=None cobra el saldo completo."""
        if sale.status == SaleStatus.PAID:
            raise ValueError("Sale is already paid")

        balance = sale.total - sale.paid_amount
        pay_amount = amount if amount is not None else balance

        if pay_amount <= Decimal("0"):
            raise ValueError("El monto debe ser mayor a 0")
        if pay_amount > balance:
            raise ValueError(f"El monto ({pay_amount}) supera el saldo pendiente ({balance})")

        sale.paid_amount += pay_amount
        sale.payment_method = payment_method

        if sale.paid_amount >= sale.total:
            sale.status = SaleStatus.PAID
        else:
            sale.status = SaleStatus.PARTIAL

        await self.session.flush()

        if sale.status == SaleStatus.PAID:
            # Mark delivery as delivered
            delivery = await self._get_delivery_by_sale(sale.id)
            if delivery and delivery.status != DeliveryStatus.DELIVERED:
                delivery.status = DeliveryStatus.DELIVERED
                await self.session.flush()

            # If credit sale, mark receivable as paid
            if sale.payment_type == PaymentType.CREDIT:
                receivable = await self.receivable_repo.get_by_sale(sale.id)
                if receivable:
                    receivable.status = ReceivableStatus.PAID
                    receivable.paid_date = bogota_today()
                    await self.session.flush()

        return pay_amount

    async def bulk_mark_paid(
        self, sale_ids: list[uuid.UUID], payment_method: PaymentMethod,
    ) -> tuple[list[Sale], list[tuple[uuid.UUID, str]], Decimal]:
        """Cobra en su totalidad cada venta seleccionada con un mismo metodo de
        pago. Las ventas ya pagadas o invalidas se omiten (no rompen el lote).
        Todo corre en el mismo request => atomico via el commit de get_db.
        Devuelve (ventas_cobradas, omitidas[(id, motivo)], total_recaudado)."""
        paid: list[Sale] = []
        skipped: list[tuple[uuid.UUID, str]] = []
        total_collected = Decimal("0")
        # Dedup preservando orden por si el front manda ids repetidos.
        for sale_id in dict.fromkeys(sale_ids):
            sale = await self.sale_repo.get_by_id_with_items(sale_id)
            if not sale:
                skipped.append((sale_id, "Venta no encontrada"))
                continue
            try:
                collected = await self._apply_payment(sale, payment_method, None)
            except ValueError as e:
                skipped.append((sale_id, str(e)))
                continue
            paid.append(sale)
            total_collected += collected
        return paid, skipped, total_collected

    async def _get_delivery_by_sale(self, sale_id: uuid.UUID) -> Delivery | None:
        stmt = select(Delivery).where(Delivery.sale_id == sale_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def delete_sale(self, sale_id: uuid.UUID, admin_password: str) -> None:
        # Verify admin password
        stmt = select(User).where(User.role == UserRole.ADMIN)
        result = await self.session.execute(stmt)
        admin = result.scalar_one_or_none()
        if not admin or not verify_password(admin_password, admin.hashed_password):
            raise ValueError("Contraseña de administrador incorrecta")

        sale = await self.sale_repo.get_by_id_with_items(sale_id)
        if not sale:
            raise ValueError("Venta no encontrada")

        # Only allow deletion on the same day as the sale.
        # "Hoy" se calcula en America/Bogota: el servidor corre en UTC y despues
        # de las 7pm COT (00:00 UTC) date.today() ya seria el dia siguiente,
        # bloqueando ventas legitimamente creadas hoy.
        if sale.date != bogota_today():
            raise ValueError("Solo se pueden eliminar ventas del dia actual")

        # Reverse loyalty points
        await self.loyalty_service.reverse_points_for_sale(sale.client_id, sale_id)

        # Restore inventory for each item
        for item in sale.items:
            await self.inventory_repo.adjust(
                product_id=item.product_id,
                quantity=item.quantity,
                movement_type=InventoryMovementType.ADJUSTMENT,
                reference_id=sale.id,
                notes=f"Reversal: sale deleted",
            )

        # Delete related records
        await self.session.execute(
            sa_delete(LoyaltyTransaction).where(LoyaltyTransaction.sale_id == sale_id)
        )
        await self.session.execute(
            sa_delete(InventoryMovement).where(InventoryMovement.reference_id == sale_id)
        )
        await self.session.execute(
            sa_delete(Delivery).where(Delivery.sale_id == sale_id)
        )
        await self.session.execute(
            sa_delete(Receivable).where(Receivable.sale_id == sale_id)
        )
        await self.session.execute(
            sa_delete(SaleItem).where(SaleItem.sale_id == sale_id)
        )
        await self.session.execute(
            sa_delete(Sale).where(Sale.id == sale_id)
        )
