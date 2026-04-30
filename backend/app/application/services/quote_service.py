import uuid
from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import delete as sa_delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.aggregates.quote import Quote
from app.domain.aggregates.quote_item import QuoteItem
from app.domain.enums import QuoteStatus
from app.infrastructure.repositories import (
    ClientRepository,
    ProductRepository,
    QuoteRepository,
)


DEFAULT_VALID_DAYS = 15


class QuoteService:
    def __init__(self, session: AsyncSession) -> None:
        self.quote_repo = QuoteRepository(session)
        self.client_repo = ClientRepository(session)
        self.product_repo = ProductRepository(session)
        self.session = session

    async def get_by_date_range(
        self, from_date: date, to_date: date, statuses: list[QuoteStatus] | None = None
    ) -> list[Quote]:
        return await self.quote_repo.get_by_date_range(from_date, to_date, statuses)

    async def get_by_id(self, quote_id: uuid.UUID) -> Quote | None:
        return await self.quote_repo.get_by_id_with_items(quote_id)

    async def create_quote(
        self,
        quote_date: date,
        client_id: uuid.UUID,
        items: list[dict],
        valid_until: date | None = None,
        status: QuoteStatus = QuoteStatus.DRAFT,
        notes: str | None = None,
    ) -> Quote:
        client = await self.client_repo.get_by_id_with_prices(client_id)
        if not client:
            raise ValueError("Client not found")

        client_prices: dict[uuid.UUID, Decimal] = {
            cp.product_id: cp.price for cp in client.prices
        }

        quote_items: list[QuoteItem] = []
        subtotal = Decimal("0")

        for item_data in items:
            product = await self.product_repo.get_by_id(item_data["product_id"])
            if not product:
                raise ValueError(f"Product {item_data['product_id']} not found")

            quantity = item_data["quantity"]
            if quantity <= 0:
                raise ValueError("Quantity must be positive")

            unit_price = client_prices.get(product.id, product.base_price)
            if "unit_price" in item_data and item_data["unit_price"] is not None:
                unit_price = Decimal(str(item_data["unit_price"]))

            item_subtotal = unit_price * quantity
            subtotal += item_subtotal

            quote_items.append(
                QuoteItem(
                    product_id=product.id,
                    quantity=quantity,
                    unit_price=unit_price,
                    subtotal=item_subtotal,
                )
            )

        effective_valid_until = valid_until or (
            quote_date + timedelta(days=DEFAULT_VALID_DAYS)
        )

        quote = Quote(
            date=quote_date,
            client_id=client_id,
            valid_until=effective_valid_until,
            subtotal=subtotal,
            tax=Decimal("0"),
            total=subtotal,
            status=status,
            notes=notes,
            items=quote_items,
        )
        self.session.add(quote)
        await self.session.flush()
        return quote

    async def update_quote(self, quote_id: uuid.UUID, updates: dict) -> Quote:
        quote = await self.quote_repo.get_by_id_with_items(quote_id)
        if not quote:
            raise ValueError("Quote not found")

        new_items = updates.pop("items", None)

        for key, value in updates.items():
            if hasattr(quote, key):
                setattr(quote, key, value)

        if new_items is not None:
            await self.session.execute(
                sa_delete(QuoteItem).where(QuoteItem.quote_id == quote.id)
            )
            await self.session.flush()

            client = await self.client_repo.get_by_id_with_prices(quote.client_id)
            client_prices: dict[uuid.UUID, Decimal] = {
                cp.product_id: cp.price for cp in (client.prices if client else [])
            }

            rebuilt: list[QuoteItem] = []
            subtotal = Decimal("0")
            for item_data in new_items:
                product = await self.product_repo.get_by_id(item_data["product_id"])
                if not product:
                    raise ValueError(f"Product {item_data['product_id']} not found")
                quantity = item_data["quantity"]
                if quantity <= 0:
                    raise ValueError("Quantity must be positive")
                unit_price = client_prices.get(product.id, product.base_price)
                if "unit_price" in item_data and item_data["unit_price"] is not None:
                    unit_price = Decimal(str(item_data["unit_price"]))
                line = unit_price * quantity
                subtotal += line
                rebuilt.append(
                    QuoteItem(
                        quote_id=quote.id,
                        product_id=product.id,
                        quantity=quantity,
                        unit_price=unit_price,
                        subtotal=line,
                    )
                )
            for it in rebuilt:
                self.session.add(it)
            quote.subtotal = subtotal
            quote.total = subtotal

        await self.session.flush()
        return quote

    async def set_status(self, quote_id: uuid.UUID, status: QuoteStatus) -> Quote:
        quote = await self.quote_repo.get_by_id_with_items(quote_id)
        if not quote:
            raise ValueError("Quote not found")
        quote.status = status
        await self.session.flush()
        return quote

    async def delete_quote(self, quote_id: uuid.UUID) -> None:
        quote = await self.quote_repo.get_by_id_with_items(quote_id)
        if not quote:
            raise ValueError("Quote not found")
        await self.session.execute(
            sa_delete(QuoteItem).where(QuoteItem.quote_id == quote_id)
        )
        await self.session.execute(sa_delete(Quote).where(Quote.id == quote_id))
