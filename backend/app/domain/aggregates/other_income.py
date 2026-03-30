from datetime import date
from decimal import Decimal
from typing import Optional

from sqlalchemy import Date, Numeric, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.domain.aggregates.base import Base
from app.domain.enums import IncomeCategory


class OtherIncome(Base):
    __tablename__ = "other_income"

    date: Mapped[date] = mapped_column(Date, nullable=False)
    category: Mapped[IncomeCategory] = mapped_column(nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
