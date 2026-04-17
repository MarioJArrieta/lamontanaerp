from decimal import Decimal
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.domain.aggregates.base import Base
from app.domain.enums import ClientType

if TYPE_CHECKING:
    from app.domain.aggregates.client_price import ClientPrice


class Client(Base):
    __tablename__ = "clients"

    name: Mapped[str] = mapped_column(String(150), nullable=False)
    client_type: Mapped[ClientType] = mapped_column(nullable=False)
    cedula_nit: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    delivery_zone: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    latitude: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 7), nullable=True)
    longitude: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 7), nullable=True)
    hashed_password: Mapped[Optional[str]] = mapped_column(
        String(255), nullable=True
    )
    loyalty_points: Mapped[int] = mapped_column(default=0)
    is_active: Mapped[bool] = mapped_column(default=True)

    prices: Mapped[list["ClientPrice"]] = relationship(
        back_populates="client", cascade="all, delete-orphan"
    )
