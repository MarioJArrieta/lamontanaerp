import uuid
from datetime import date
from decimal import Decimal
from typing import Optional

from sqlalchemy import Date, ForeignKey, Numeric, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.domain.aggregates.base import Base


class Production(Base):
    __tablename__ = "productions"

    date: Mapped[date] = mapped_column(Date, nullable=False)
    employee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("employees.id"), nullable=False
    )
    bobina_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("bobinas.id"), nullable=True
    )
    pacas_produced: Mapped[int] = mapped_column(nullable=False, default=0)
    botellones_produced: Mapped[int] = mapped_column(nullable=False, default=0)
    waste_pacas: Mapped[int] = mapped_column(nullable=False, default=0)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    employee = relationship("Employee")
    bobina = relationship("Bobina")
