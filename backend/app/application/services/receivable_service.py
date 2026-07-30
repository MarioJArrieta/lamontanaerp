import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.config.timezone import bogota_today
from app.domain.aggregates.receivable import Receivable
from app.domain.enums import ReceivableStatus, SaleStatus
from app.infrastructure.repositories import ReceivableRepository, SaleRepository


class ReceivableService:
    def __init__(self, session: AsyncSession) -> None:
        self.repo = ReceivableRepository(session)
        self.sale_repo = SaleRepository(session)
        self.session = session

    async def get_pending(self) -> list[Receivable]:
        return await self.repo.get_pending()

    async def get_overdue(self) -> list[Receivable]:
        return await self.repo.get_overdue()

    async def get_by_client(self, client_id: uuid.UUID) -> list[Receivable]:
        return await self.repo.get_by_client(client_id)

    async def register_payment(self, receivable_id: uuid.UUID) -> Receivable:
        receivable = await self.repo.get_by_id(receivable_id)
        if not receivable:
            raise ValueError("Receivable not found")
        if receivable.status == ReceivableStatus.PAID:
            raise ValueError("Already paid")

        receivable.status = ReceivableStatus.PAID
        receivable.paid_date = bogota_today()

        # Mark sale as paid
        sale = await self.sale_repo.get_by_id_with_items(receivable.sale_id)
        if sale:
            sale.status = SaleStatus.PAID

        await self.session.flush()
        return receivable
