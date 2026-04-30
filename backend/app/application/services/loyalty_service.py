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
            total_pacas * settings.puntos_per_paca
            + total_botellones * settings.puntos_per_botellon
        )
        if points <= 0:
            return 0

        tx = LoyaltyTransaction(
            client_id=client_id,
            transaction_type=LoyaltyTransactionType.EARN,
            points=points,
            sale_id=sale_id,
            description=f"+{points} puntos por compra ({total_pacas} pacas, {total_botellones} botellones)",
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
            description=f"Reversa de {total_earned} puntos por eliminacion de venta",
        )
        self.session.add(reversal)

        client = await self.client_repo.get_by_id_with_prices(client_id)
        if client:
            client.loyalty_points = max(0, client.loyalty_points - total_earned)

        await self.session.flush()

    async def redeem(
        self,
        client_id: uuid.UUID,
        points_to_redeem: int,
        description: str | None = None,
    ) -> LoyaltyTransaction:
        client = await self.client_repo.get_by_id_with_prices(client_id)
        if not client:
            raise ValueError("Cliente no encontrado")

        if points_to_redeem <= 0:
            raise ValueError("Cantidad de puntos debe ser positiva")

        if client.loyalty_points < points_to_redeem:
            raise ValueError(
                f"Puntos insuficientes. Tiene {client.loyalty_points}, necesita {points_to_redeem}"
            )

        if description is None:
            settings = get_settings()
            pacas = points_to_redeem // settings.puntos_to_redeem_paca
            description = (
                f"Canje de {points_to_redeem} puntos por {pacas} paca(s) gratis"
            )

        tx = LoyaltyTransaction(
            client_id=client_id,
            transaction_type=LoyaltyTransactionType.REDEEM,
            points=-points_to_redeem,
            description=description,
        )
        self.session.add(tx)
        client.loyalty_points -= points_to_redeem
        await self.session.flush()
        return tx
