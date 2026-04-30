import uuid
from datetime import date
from decimal import Decimal
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Date, ForeignKey, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.domain.aggregates.base import Base
from app.domain.enums import PaymentMethod, PaymentType, SaleStatus

if TYPE_CHECKING:
    from app.domain.aggregates.sale_item import SaleItem


class Sale(Base):
    __tablename__ = "sales"

    date: Mapped[date] = mapped_column(Date, nullable=False)
    client_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clients.id"), nullable=False
    )
    delivery_employee_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("employees.id"), nullable=True
    )
    subtotal: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False, default=0)
    tax: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False, default=0)
    total: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False, default=0)
    payment_type: Mapped[PaymentType] = mapped_column(nullable=False)
    payment_method: Mapped[Optional[PaymentMethod]] = mapped_column(nullable=True)
    paid_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False, default=0)
    status: Mapped[SaleStatus] = mapped_column(nullable=False, default=SaleStatus.PENDING)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # DIAN electronic invoice (filled after POST to facturador-dian)
    dian_document_number: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    dian_cufe: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    dian_status: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    dian_status_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    dian_external_ref: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    dian_pdf_path: Mapped[Optional[str]] = mapped_column(String(300), nullable=True)

    client = relationship("Client")
    delivery_employee = relationship("Employee")
    items: Mapped[list["SaleItem"]] = relationship(
        back_populates="sale", cascade="all, delete-orphan"
    )
