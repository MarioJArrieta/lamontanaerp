import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.aggregates.payroll import Advance, Payroll
from app.domain.enums import EmployeeRole, PayPeriod, PayrollStatus
from app.infrastructure.repositories import (
    AdvanceRepository,
    DeliveryRepository,
    EmployeeRepository,
    PayrollRepository,
    ProductionRepository,
)


class PayrollService:
    def __init__(self, session: AsyncSession) -> None:
        self.payroll_repo = PayrollRepository(session)
        self.advance_repo = AdvanceRepository(session)
        self.employee_repo = EmployeeRepository(session)
        self.production_repo = ProductionRepository(session)
        self.delivery_repo = DeliveryRepository(session)
        self.session = session

    async def get_by_period(self, from_date: date, to_date: date) -> list[Payroll]:
        return await self.payroll_repo.get_by_period(from_date, to_date)

    async def get_by_employee(
        self, employee_id: uuid.UUID, from_date: date, to_date: date
    ) -> list[Payroll]:
        return await self.payroll_repo.get_by_employee(employee_id, from_date, to_date)

    async def calculate_payroll(
        self,
        employee_id: uuid.UUID,
        period_start: date,
        period_end: date,
        deductions: Decimal = Decimal("0"),
        notes: str | None = None,
    ) -> Payroll:
        employee = await self.employee_repo.get_by_id(employee_id)
        if not employee:
            raise ValueError("Employee not found")

        # Determine period type and calculate base pay
        if employee.role == EmployeeRole.SECRETARY:
            period_type = PayPeriod.MONTHLY
            base_pay = employee.fixed_salary or Decimal("0")
            units = 0
            rate = None
        elif employee.role == EmployeeRole.PACKER:
            period_type = PayPeriod.WEEKLY
            units = await self.production_repo.count_pacas_by_employee(
                employee_id, period_start, period_end
            )
            rate = employee.rate_per_paca or Decimal("0")
            base_pay = rate * units
        elif employee.role == EmployeeRole.DELIVERY:
            period_type = PayPeriod.WEEKLY
            units = await self.delivery_repo.count_pacas_by_employee(
                employee_id, period_start, period_end
            )
            rate = employee.rate_per_paca or Decimal("0")
            base_pay = rate * units
        else:
            raise ValueError(f"Unknown employee role: {employee.role}")

        # Deduct unlinked advances
        advances_total = Decimal(str(await self.advance_repo.sum_unlinked(employee_id)))
        net_pay = base_pay - advances_total - deductions

        payroll = Payroll(
            employee_id=employee_id,
            period_start=period_start,
            period_end=period_end,
            period_type=period_type,
            units_in_period=units,
            rate=rate,
            base_pay=base_pay,
            advances_deducted=advances_total,
            deductions=deductions,
            net_pay=net_pay,
            status=PayrollStatus.CALCULATED,
            notes=notes,
        )
        self.session.add(payroll)
        await self.session.flush()

        # Link unlinked advances to this payroll
        unlinked = await self.advance_repo.get_unlinked_by_employee(employee_id)
        for adv in unlinked:
            adv.payroll_id = payroll.id
        await self.session.flush()

        return payroll

    async def mark_paid(self, payroll_id: uuid.UUID) -> Payroll:
        payroll = await self.payroll_repo.get_by_id(payroll_id)
        if not payroll:
            raise ValueError("Payroll not found")
        if payroll.status == PayrollStatus.PAID:
            raise ValueError("Payroll already paid")
        payroll.status = PayrollStatus.PAID
        await self.session.flush()
        return payroll

    # ---- Advances ----
    async def create_advance(
        self,
        employee_id: uuid.UUID,
        amount: Decimal,
        advance_date: date,
        notes: str | None = None,
    ) -> Advance:
        employee = await self.employee_repo.get_by_id(employee_id)
        if not employee:
            raise ValueError("Employee not found")

        advance = Advance(
            employee_id=employee_id,
            amount=amount,
            date=advance_date,
            notes=notes,
        )
        self.session.add(advance)
        await self.session.flush()
        return advance

    async def get_advances(
        self,
        employee_id: uuid.UUID,
        from_date: date | None = None,
        to_date: date | None = None,
    ) -> list[Advance]:
        return await self.advance_repo.get_by_employee(employee_id, from_date, to_date)

    async def get_pending_advances_total(self, employee_id: uuid.UUID) -> float:
        return await self.advance_repo.sum_unlinked(employee_id)
