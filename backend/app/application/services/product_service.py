import uuid
from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.aggregates.product import Product
from app.domain.enums import ProductType
from app.infrastructure.repositories import ProductRepository


class ProductService:
    def __init__(self, session: AsyncSession) -> None:
        self.repo = ProductRepository(session)

    async def get_all(self) -> list[Product]:
        return await self.repo.get_all()

    async def get_by_id(self, product_id: uuid.UUID) -> Product | None:
        return await self.repo.get_by_id(product_id)

    async def create(
        self,
        name: str,
        product_type: ProductType,
        unit: str,
        base_price: Decimal,
        tax_rate: Decimal = Decimal("0"),
        dian_tax_type: str = "ZZ",
        tax_included: bool = False,
    ) -> Product:
        product = Product(
            name=name,
            product_type=product_type,
            unit=unit,
            base_price=base_price,
            tax_rate=tax_rate,
            dian_tax_type=dian_tax_type,
            tax_included=tax_included,
        )
        return await self.repo.create(product)

    async def update(self, product_id: uuid.UUID, updates: dict) -> Product:
        product = await self.repo.get_by_id(product_id)
        if not product:
            raise ValueError("Product not found")
        return await self.repo.update(product, updates)
