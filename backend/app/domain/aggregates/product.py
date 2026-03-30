from decimal import Decimal

from sqlalchemy import Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.domain.aggregates.base import Base
from app.domain.enums import ProductType


class Product(Base):
    __tablename__ = "products"

    name: Mapped[str] = mapped_column(String(100), nullable=False)
    product_type: Mapped[ProductType] = mapped_column(nullable=False)
    unit: Mapped[str] = mapped_column(String(20), nullable=False)
    base_price: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    is_active: Mapped[bool] = mapped_column(default=True)
