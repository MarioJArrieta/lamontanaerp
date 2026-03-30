import uuid
from datetime import date
from decimal import Decimal
from typing import Optional

from sqlalchemy import Date, ForeignKey, Numeric, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.domain.aggregates.base import Base
from app.domain.enums import PayPeriod, PayrollStatus


class Payroll(Base):
    __tablename__ = "payrolls"

    employee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("employees.id"), nullable=False
    )
    period_start: Mapped[date] = mapped_column(Date, nullable=False)
    period_end: Mapped[date] = mapped_column(Date, nullable=False)
    period_type: Mapped[PayPeriod] = mapped_column(nullable=False)
    units_in_period: Mapped[int] = mapped_column(nullable=False, default=0)
    rate: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2), nullable=True)
    base_pay: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    advances_deducted: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    deductions: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    net_pay: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    status: Mapped[PayrollStatus] = mapped_column(
        nullable=False, default=PayrollStatus.CALCULATED
    )
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    employee = relationship("Employee")


class Advance(Base):
    __tablename__ = "advances"

    employee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("employees.id"), nullable=False
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    payroll_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("payrolls.id"), nullable=True
    )
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    employee = relationship("Employee")
    payroll = relationship("Payroll")
