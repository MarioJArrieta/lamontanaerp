import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.domain.aggregates.loyalty_transaction import LoyaltyTransaction
from app.domain.enums import LoyaltyTransactionType
from app.infrastructure.repositories import ClientRepository
from app.infrastructure.repositories.loyalty_repository import LoyaltyRepository


class LoyaltyService:
    def __init__(self, session: AsyncSession) -> None:
        self.loyalty_repo = LoyaltyRepository(session)
        self.client_repo = ClientRepository(session)
        self.session = session

    async def get_history(
        self, client_id: uuid.UUID
    ) -> list[LoyaltyTransaction]:
        return await self.loyalty_repo.get_by_client(client_id)

    async def earn_points_for_sale(
        self,
        client_id: uuid.UUID,
        sale_id: uuid.UUID,
        total_pacas: int,
        total_botellones: int,
    ) -> int:
        settings = get_settings()
        points = (
            total_pacas * settings.gotas_per_paca
            + total_botellones * settings.gotas_per_botellon
        )
        if points <= 0:
            return 0

        tx = LoyaltyTransaction(
            client_id=client_id,
            transaction_type=LoyaltyTransactionType.EARN,
            points=points,
            sale_id=sale_id,
            description=f"+{points} gotas por compra ({total_pacas} pacas, {total_botellones} botellones)",
        )
        self.session.add(tx)

        client = await self.client_repo.get_by_id_with_prices(client_id)
        if client:
            client.loyalty_points += points

        await self.session.flush()
        return points

    async def reverse_points_for_sale(
        self, client_id: uuid.UUID, sale_id: uuid.UUID
    ) -> None:
        txs = await self.loyalty_repo.get_by_sale(sale_id)
        total_earned = sum(
            t.points
            for t in txs
            if t.transaction_type == LoyaltyTransactionType.EARN
        )
        if total_earned <= 0:
            return

        reversal = LoyaltyTransaction(
            client_id=client_id,
            transaction_type=LoyaltyTransactionType.REVERSAL,
            points=-total_earned,
            sale_id=sale_id,
            description=f"Reversa de {total_earned} gotas por eliminacion de venta",
        )
        self.session.add(reversal)

        client = await self.client_repo.get_by_id_with_prices(client_id)
        if client:
            client.loyalty_points = max(0, client.loyalty_points - total_earned)

        await self.session.flush()

    async def redeem(
        self, client_id: uuid.UUID, points_to_redeem: int
    ) -> LoyaltyTransaction:
        client = await self.client_repo.get_by_id_with_prices(client_id)
        if not client:
            raise ValueError("Cliente no encontrado")

        if points_to_redeem <= 0:
            raise ValueError("Cantidad de gotas debe ser positiva")

        if client.loyalty_points < points_to_redeem:
            raise ValueError(
                f"Gotas insuficientes. Tiene {client.loyalty_points}, necesita {points_to_redeem}"
            )

        settings = get_settings()
        pacas = points_to_redeem // settings.gotas_to_redeem_paca

        tx = LoyaltyTransaction(
            client_id=client_id,
            transaction_type=LoyaltyTransactionType.REDEEM,
            points=-points_to_redeem,
            description=f"Canje de {points_to_redeem} gotas por {pacas} paca(s) gratis",
        )
        self.session.add(tx)
        client.loyalty_points -= points_to_redeem
        await self.session.flush()
        return tx
