from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.aggregates.product import Product
from app.domain.enums import ProductType
from app.infrastructure.repositories.base_repository import BaseRepository


class ProductRepository(BaseRepository[Product]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session, Product)

    async def get_by_type(self, product_type: ProductType) -> Product | None:
        stmt = select(Product).where(
            Product.product_type == product_type, Product.is_active == True  # noqa: E712
        ).limit(1)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()
