import uuid
from datetime import date
from decimal import Decimal
from typing import Optional

from sqlalchemy import Date, ForeignKey, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.domain.aggregates.base import Base


class Bobina(Base):
    __tablename__ = "bobinas"

    code: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    purchase_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    weight_kg: Mapped[Decimal] = mapped_column(Numeric(8, 2), nullable=False)
    cost: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    estimated_pacas: Mapped[int] = mapped_column(nullable=False, default=250)
    supplier: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    remaining_pacas: Mapped[int] = mapped_column(nullable=False)
    is_exhausted: Mapped[bool] = mapped_column(default=False)
