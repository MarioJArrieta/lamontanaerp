import uuid
from datetime import date
from decimal import Decimal
from typing import Optional

from sqlalchemy import Date, ForeignKey, Numeric
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.domain.aggregates.base import Base
from app.domain.enums import ReceivableStatus


class Receivable(Base):
    __tablename__ = "receivables"

    sale_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sales.id"), unique=True, nullable=False
    )
    client_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clients.id"), nullable=False
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    due_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[ReceivableStatus] = mapped_column(
        nullable=False, default=ReceivableStatus.PENDING
    )
    paid_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)

    sale = relationship("Sale")
    client = relationship("Client")
