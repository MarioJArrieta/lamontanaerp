from decimal import Decimal
from typing import Optional

from sqlalchemy import Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.domain.aggregates.base import Base
from app.domain.enums import EmployeeRole, PayPeriod


class Employee(Base):
    __tablename__ = "employees"

    name: Mapped[str] = mapped_column(String(100), nullable=False)
    cedula: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    role: Mapped[EmployeeRole] = mapped_column(nullable=False)
    pay_period: Mapped[PayPeriod] = mapped_column(nullable=False)
    fixed_salary: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(12, 2), nullable=True
    )
    rate_per_paca: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(10, 2), nullable=True
    )
    phone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    is_active: Mapped[bool] = mapped_column(default=True)
