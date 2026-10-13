from decimal import Decimal
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.domain.aggregates.base import Base
from app.domain.aggregates.tenant import TenantScoped
from app.domain.enums import ClientType

if TYPE_CHECKING:
    from app.domain.aggregates.client_price import ClientPrice


class Client(TenantScoped, Base):
    __tablename__ = "clients"
    __table_args__ = (UniqueConstraint("tenant_id", "cedula_nit", name="uq_clients_tenant_cedula_nit"),)

    name: Mapped[str] = mapped_column(String(150), nullable=False)
    client_type: Mapped[ClientType] = mapped_column(nullable=False)
    cedula_nit: Mapped[str] = mapped_column(String(20), nullable=False)
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
    electronic_invoicing_enabled: Mapped[bool] = mapped_column(default=False, nullable=False)
    dian_id_type: Mapped[Optional[str]] = mapped_column(String(5), nullable=True)
    # Dígito de verificación (DV), only meaningful when dian_id_type == "31" (NIT)
    dian_dv: Mapped[Optional[str]] = mapped_column(String(1), nullable=True)

    prices: Mapped[list["ClientPrice"]] = relationship(
        back_populates="client", cascade="all, delete-orphan"
    )
