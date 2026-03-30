import uuid
from datetime import date

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.domain.aggregates.delivery import Delivery
from app.domain.enums import DeliveryStatus
from app.infrastructure.repositories.base_repository import BaseRepository


class DeliveryRepository(BaseRepository[Delivery]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session, Delivery)

    async def get_by_employee_date(
        self, employee_id: uuid.UUID, target_date: date
    ) -> list[Delivery]:
        stmt = (
            select(Delivery)
            .options(selectinload(Delivery.sale), selectinload(Delivery.delivery_employee))
            .where(
                Delivery.delivery_employee_id == employee_id,
                Delivery.date == target_date,
            )
            .order_by(Delivery.created_at)
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def get_by_date_range(self, from_date: date, to_date: date) -> list[Delivery]:
        stmt = (
            select(Delivery)
            .options(selectinload(Delivery.sale), selectinload(Delivery.delivery_employee))
            .where(Delivery.date >= from_date, Delivery.date <= to_date)
            .order_by(Delivery.date.desc())
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def count_pacas_by_employee(
        self, employee_id: uuid.UUID, from_date: date, to_date: date
    ) -> int:
        stmt = select(func.coalesce(func.sum(Delivery.pacas_delivered), 0)).where(
            Delivery.delivery_employee_id == employee_id,
            Delivery.status == DeliveryStatus.DELIVERED,
            Delivery.date >= from_date,
            Delivery.date <= to_date,
        )
        result = await self.session.execute(stmt)
        return int(result.scalar_one())
