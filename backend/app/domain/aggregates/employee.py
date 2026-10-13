from decimal import Decimal
from typing import Optional

from sqlalchemy import Numeric, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.domain.aggregates.base import Base
from app.domain.aggregates.tenant import TenantScoped
from app.domain.enums import EmployeeRole, PayPeriod


class Employee(TenantScoped, Base):
    __tablename__ = "employees"
    __table_args__ = (UniqueConstraint("tenant_id", "cedula", name="uq_employees_tenant_cedula"),)

    name: Mapped[str] = mapped_column(String(100), nullable=False)
    cedula: Mapped[str] = mapped_column(String(20), nullable=False)
    role: Mapped[EmployeeRole] = mapped_column(nullable=False)
    pay_period: Mapped[PayPeriod] = mapped_column(nullable=False)
    fixed_salary: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(12, 2), nullable=True
    )
    rate_per_paca: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(10, 2), nullable=True
    )
    rate_per_botellon: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(10, 2), nullable=True
    )
    phone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    is_active: Mapped[bool] = mapped_column(default=True)
