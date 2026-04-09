import uuid
from datetime import date

from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.aggregates.delivery import Delivery
from app.domain.enums import DeliveryStatus
from app.infrastructure.repositories import DeliveryRepository, SaleRepository, EmployeeRepository


class DeliveryService:
    def __init__(self, session: AsyncSession) -> None:
        self.delivery_repo = DeliveryRepository(session)
        self.sale_repo = SaleRepository(session)
        self.employee_repo = EmployeeRepository(session)
        self.session = session

    async def get_by_date_range(self, from_date: date, to_date: date) -> list[Delivery]:
        return await self.delivery_repo.get_by_date_range(from_date, to_date)

    async def get_by_employee_date(
        self, employee_id: uuid.UUID, target_date: date
    ) -> list[Delivery]:
        return await self.delivery_repo.get_by_employee_date(employee_id, target_date)

    async def get_by_employee_date_range(
        self, employee_id: uuid.UUID, from_date: date, to_date: date
    ) -> list[Delivery]:
        return await self.delivery_repo.get_by_employee_date_range(employee_id, from_date, to_date)

    async def create_delivery(
        self,
        delivery_date: date,
        sale_id: uuid.UUID,
        delivery_employee_id: uuid.UUID,
        pacas_delivered: int,
        botellones_delivered: int = 0,
        notes: str | None = None,
    ) -> Delivery:
        sale = await self.sale_repo.get_by_id(sale_id)
        if not sale:
            raise ValueError("Sale not found")

        employee = await self.employee_repo.get_by_id(delivery_employee_id)
        if not employee:
            raise ValueError("Employee not found")

        delivery = Delivery(
            date=delivery_date,
            sale_id=sale_id,
            delivery_employee_id=delivery_employee_id,
            pacas_delivered=pacas_delivered,
            botellones_delivered=botellones_delivered,
            status=DeliveryStatus.PENDING,
            notes=notes,
        )
        self.session.add(delivery)
        await self.session.flush()
        return delivery

    async def mark_in_route(self, delivery_id: uuid.UUID) -> Delivery:
        delivery = await self.delivery_repo.get_by_id(delivery_id)
        if not delivery:
            raise ValueError("Delivery not found")
        if delivery.status != DeliveryStatus.PENDING:
            raise ValueError("Delivery is not in pending status")
        delivery.status = DeliveryStatus.IN_ROUTE
        await self.session.flush()
        return delivery

    async def mark_delivered(self, delivery_id: uuid.UUID) -> Delivery:
        delivery = await self.delivery_repo.get_by_id(delivery_id)
        if not delivery:
            raise ValueError("Delivery not found")
        if delivery.status == DeliveryStatus.DELIVERED:
            raise ValueError("Delivery already marked as delivered")
        delivery.status = DeliveryStatus.DELIVERED
        await self.session.flush()
        return delivery
