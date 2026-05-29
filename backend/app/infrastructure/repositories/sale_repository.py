import uuid
from datetime import date

from sqlalchemy import case, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config.timezone import bogota_day_bounds
from app.domain.aggregates.sale import Sale
from app.domain.enums import SaleStatus
from app.infrastructure.repositories.base_repository import BaseRepository


class SaleRepository(BaseRepository[Sale]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session, Sale)

    async def get_by_id_with_items(self, sale_id: uuid.UUID) -> Sale | None:
        stmt = (
            select(Sale)
            .options(
                selectinload(Sale.items),
                selectinload(Sale.client),
                selectinload(Sale.delivery_employee),
            )
            .where(Sale.id == sale_id)
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_date_range(
        self, from_date: date, to_date: date, statuses: list[SaleStatus] | None = None
    ) -> list[Sale]:
        # No selectinload(Sale.client): el response SaleResponse solo expone
        # client_id; cargar el Client (y sus client_prices) por cada venta
        # genera consultas IN (...) muy grandes que no se serializan.
        stmt = (
            select(Sale)
            .options(selectinload(Sale.items))
            .where(Sale.date >= from_date, Sale.date <= to_date)
            .order_by(
                case(
                    (Sale.status == SaleStatus.PENDING, 0),
                    (Sale.status == SaleStatus.PARTIAL, 1),
                    else_=2,
                ),
                Sale.date.desc(),
                Sale.created_at.desc(),
            )
        )
        if statuses:
            stmt = stmt.where(Sale.status.in_(statuses))
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def get_paid_on_date(self, target_date: date) -> list[Sale]:
        # Cobros registrados hoy cuya venta NO se hizo hoy: excluye ventas
        # creadas y cobradas el mismo dia para mostrar solo recaudo de credito
        # / saldos previos. updated_at se compara en limites UTC del dia Bogota.
        start, end = bogota_day_bounds(target_date)
        stmt = (
            select(Sale)
            .options(selectinload(Sale.items))
            .where(
                Sale.status.in_([SaleStatus.PAID, SaleStatus.PARTIAL]),
                Sale.updated_at >= start,
                Sale.updated_at <= end,
                Sale.date < target_date,
            )
            .order_by(Sale.updated_at.desc())
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def get_pending_delivery(self) -> list[Sale]:
        stmt = (
            select(Sale)
            .options(selectinload(Sale.items))
            .where(Sale.status.in_([SaleStatus.PENDING, SaleStatus.ASSIGNED]))
            .order_by(Sale.date)
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())
