import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.aggregates.expense import Expense
from app.domain.aggregates.other_income import OtherIncome
from app.domain.aggregates.payroll import Payroll
from app.domain.aggregates.sale import Sale
from app.domain.enums import ExpenseCategory, IncomeCategory, PayrollStatus
from app.infrastructure.repositories import ExpenseRepository, OtherIncomeRepository


class FinanceService:
    def __init__(self, session: AsyncSession) -> None:
        self.expense_repo = ExpenseRepository(session)
        self.income_repo = OtherIncomeRepository(session)
        self.session = session

    # ---- Expenses ----

    async def list_expenses(
        self, from_date: date, to_date: date, category: ExpenseCategory | None = None
    ) -> list[Expense]:
        return await self.expense_repo.get_by_date_range(from_date, to_date, category)

    async def get_expense(self, expense_id: uuid.UUID) -> Expense | None:
        return await self.expense_repo.get_by_id(expense_id)

    async def create_expense(
        self,
        expense_date: date,
        category: ExpenseCategory,
        description: str,
        amount: Decimal,
        notes: str | None = None,
    ) -> Expense:
        expense = Expense(
            date=expense_date,
            category=category,
            description=description,
            amount=amount,
            notes=notes,
        )
        self.session.add(expense)
        await self.session.flush()
        return expense

    async def update_expense(self, expense_id: uuid.UUID, updates: dict) -> Expense:
        expense = await self.expense_repo.get_by_id(expense_id)
        if not expense:
            raise ValueError("Expense not found")
        return await self.expense_repo.update(expense, updates)

    async def delete_expense(self, expense_id: uuid.UUID) -> None:
        expense = await self.expense_repo.get_by_id(expense_id)
        if not expense:
            raise ValueError("Expense not found")
        await self.expense_repo.delete(expense)

    # ---- Other Income ----

    async def list_income(
        self, from_date: date, to_date: date, category: IncomeCategory | None = None
    ) -> list[OtherIncome]:
        return await self.income_repo.get_by_date_range(from_date, to_date, category)

    async def get_income(self, income_id: uuid.UUID) -> OtherIncome | None:
        return await self.income_repo.get_by_id(income_id)

    async def create_income(
        self,
        income_date: date,
        category: IncomeCategory,
        description: str,
        amount: Decimal,
        notes: str | None = None,
    ) -> OtherIncome:
        income = OtherIncome(
            date=income_date,
            category=category,
            description=description,
            amount=amount,
            notes=notes,
        )
        self.session.add(income)
        await self.session.flush()
        return income

    async def update_income(self, income_id: uuid.UUID, updates: dict) -> OtherIncome:
        income = await self.income_repo.get_by_id(income_id)
        if not income:
            raise ValueError("Income not found")
        return await self.income_repo.update(income, updates)

    async def delete_income(self, income_id: uuid.UUID) -> None:
        income = await self.income_repo.get_by_id(income_id)
        if not income:
            raise ValueError("Income not found")
        await self.income_repo.delete(income)

    # ---- KPIs ----

    async def get_kpis(self, from_date: date, to_date: date) -> dict:
        # Total manual expenses
        expense_stmt = (
            select(func.coalesce(func.sum(Expense.amount), 0))
            .where(Expense.date >= from_date, Expense.date <= to_date)
        )
        total_manual_expenses = float(
            (await self.session.execute(expense_stmt)).scalar_one()
        )

        # Expenses by category (manual)
        expense_by_cat_stmt = (
            select(Expense.category, func.sum(Expense.amount))
            .where(Expense.date >= from_date, Expense.date <= to_date)
            .group_by(Expense.category)
        )
        expense_by_category = {
            row[0].value: float(row[1])
            for row in (await self.session.execute(expense_by_cat_stmt)).all()
        }

        # Payroll paid in period (net_pay, filtered by period_end)
        payroll_stmt = (
            select(func.coalesce(func.sum(Payroll.net_pay), 0))
            .where(
                Payroll.period_end >= from_date,
                Payroll.period_end <= to_date,
                Payroll.status == PayrollStatus.PAID,
            )
        )
        total_payroll = float(
            (await self.session.execute(payroll_stmt)).scalar_one()
        )

        # Add payroll to category breakdown
        if total_payroll > 0:
            expense_by_category["payroll"] = (
                expense_by_category.get("payroll", 0) + total_payroll
            )

        total_expenses = total_manual_expenses + total_payroll

        # Total other income
        income_stmt = (
            select(func.coalesce(func.sum(OtherIncome.amount), 0))
            .where(OtherIncome.date >= from_date, OtherIncome.date <= to_date)
        )
        total_other_income = float(
            (await self.session.execute(income_stmt)).scalar_one()
        )

        # Total sales income
        sales_stmt = (
            select(func.coalesce(func.sum(Sale.total), 0))
            .where(Sale.date >= from_date, Sale.date <= to_date)
        )
        total_sales = float(
            (await self.session.execute(sales_stmt)).scalar_one()
        )

        total_income = total_sales + total_other_income
        balance = total_income - total_expenses

        return {
            "total_expenses": total_expenses,
            "total_sales": total_sales,
            "total_other_income": total_other_income,
            "total_income": total_income,
            "balance": balance,
            "expense_by_category": expense_by_category,
        }
