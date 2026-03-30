import uuid
from datetime import date
from typing import Optional

from sqlalchemy import Date, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.domain.aggregates.base import Base
from app.domain.enums import DeliveryStatus


class Delivery(Base):
    __tablename__ = "deliveries"

    date: Mapped[date] = mapped_column(Date, nullable=False)
    sale_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sales.id"), nullable=False
    )
    delivery_employee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("employees.id"), nullable=False
    )
    pacas_delivered: Mapped[int] = mapped_column(nullable=False, default=0)
    botellones_delivered: Mapped[int] = mapped_column(nullable=False, default=0)
    status: Mapped[DeliveryStatus] = mapped_column(
        nullable=False, default=DeliveryStatus.PENDING
    )
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    sale = relationship("Sale")
    delivery_employee = relationship("Employee")
