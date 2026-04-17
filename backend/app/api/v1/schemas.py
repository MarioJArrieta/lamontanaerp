import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict, model_validator

from app.domain.enums import (
    ClientType,
    DeliveryStatus,
    EmployeeRole,
    ExpenseCategory,
    IncomeCategory,
    InventoryMovementType,
    LoyaltyTransactionType,
    PaymentMethod,
    PaymentType,
    PayPeriod,
    PayrollStatus,
    ProductType,
    QuoteStatus,
    ReceivableStatus,
    SaleStatus,
    UserRole,
)


# ---- Auth ----
class LoginRequest(BaseModel):
    username: str | None = None
    phone: str | None = None
    password: str

    @model_validator(mode="after")
    def require_username_or_phone(self) -> "LoginRequest":
        if not self.username and not self.phone:
            raise ValueError("Must provide username or phone")
        return self


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str | None = None
    client_id: str | None = None
    client_name: str | None = None


# ---- User ----
class UserCreate(BaseModel):
    username: str
    password: str
    full_name: str
    role: UserRole
    phone: str | None = None


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    username: str
    full_name: str
    role: UserRole
    phone: str | None = None
    is_active: bool
    employee_id: uuid.UUID | None = None
    created_at: datetime


# ---- Employee ----
class EmployeeCreate(BaseModel):
    name: str
    cedula: str
    role: EmployeeRole
    pay_period: PayPeriod
    fixed_salary: Decimal | None = None
    rate_per_paca: Decimal | None = None
    phone: str | None = None


class EmployeeUpdate(BaseModel):
    name: str | None = None
    phone: str | None = None
    fixed_salary: Decimal | None = None
    rate_per_paca: Decimal | None = None
    is_active: bool | None = None


class EmployeeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    name: str
    cedula: str
    role: EmployeeRole
    pay_period: PayPeriod
    fixed_salary: Decimal | None
    rate_per_paca: Decimal | None
    phone: str | None
    is_active: bool
    created_at: datetime


# ---- Product ----
class ProductCreate(BaseModel):
    name: str
    product_type: ProductType
    unit: str
    base_price: Decimal


class ProductUpdate(BaseModel):
    name: str | None = None
    base_price: Decimal | None = None
    is_active: bool | None = None


class ProductResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    name: str
    product_type: ProductType
    unit: str
    base_price: Decimal
    is_active: bool
    created_at: datetime


# ---- Client ----
class ClientCreate(BaseModel):
    name: str
    client_type: ClientType
    cedula_nit: str
    address: str | None = None
    delivery_zone: str | None = None
    phone: str | None = None
    email: str | None = None


class ClientUpdate(BaseModel):
    name: str | None = None
    client_type: ClientType | None = None
    cedula_nit: str | None = None
    address: str | None = None
    delivery_zone: str | None = None
    phone: str | None = None
    email: str | None = None
    latitude: Decimal | None = None
    longitude: Decimal | None = None
    is_active: bool | None = None


class ClientCreateResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    name: str
    client_type: ClientType
    cedula_nit: str
    address: str | None
    delivery_zone: str | None
    phone: str | None
    email: str | None
    latitude: Decimal | None
    longitude: Decimal | None
    loyalty_points: int = 0
    is_active: bool
    prices: list["ClientPriceResponse"] = []
    generated_password: str | None = None


class ClientPasswordResponse(BaseModel):
    client_id: uuid.UUID
    client_name: str
    phone: str | None
    generated_password: str


class ClientPriceSet(BaseModel):
    product_id: uuid.UUID
    price: Decimal


class ClientPriceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    product_id: uuid.UUID
    price: Decimal


class ClientResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    name: str
    client_type: ClientType
    cedula_nit: str
    address: str | None
    delivery_zone: str | None
    phone: str | None
    email: str | None
    latitude: Decimal | None
    longitude: Decimal | None
    loyalty_points: int = 0
    is_active: bool
    prices: list[ClientPriceResponse] = []
    created_at: datetime


# ---- Bobina ----
class BobinaCreate(BaseModel):
    code: str | None = None
    purchase_date: date | None = None
    weight_kg: Decimal
    cost: Decimal
    estimated_pacas: int = 250
    supplier: str | None = None
    notes: str | None = None


class BobinaUpdate(BaseModel):
    code: str | None = None
    purchase_date: date | None = None
    weight_kg: Decimal | None = None
    cost: Decimal | None = None
    supplier: str | None = None
    notes: str | None = None
    is_exhausted: bool | None = None


class BobinaResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    code: str | None
    purchase_date: date | None
    weight_kg: Decimal
    cost: Decimal
    estimated_pacas: int
    remaining_pacas: int
    is_exhausted: bool
    supplier: str | None
    notes: str | None
    created_at: datetime


# ---- Production ----
class ProductionCreate(BaseModel):
    date: date
    employee_id: uuid.UUID
    pacas_produced: int = 0
    botellones_produced: int = 0
    waste_pacas: int = 0
    bobina_id: uuid.UUID | None = None
    notes: str | None = None


class ProductionUpdate(BaseModel):
    date: Optional[date] = None
    employee_id: uuid.UUID | None = None
    pacas_produced: int | None = None
    botellones_produced: int | None = None
    waste_pacas: int | None = None
    notes: str | None = None


class ProductionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    date: date
    employee_id: uuid.UUID
    bobina_id: uuid.UUID | None
    pacas_produced: int
    botellones_produced: int
    waste_pacas: int
    is_paid: bool
    payment_amount: Decimal | None
    notes: str | None
    created_at: datetime


class ProductionSummaryResponse(BaseModel):
    total_pacas: int
    total_botellones: int
    total_waste: int
    total_records: int


# ---- Inventory ----
class InventoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    product_id: uuid.UUID
    quantity: int


class InventoryAdjust(BaseModel):
    product_id: uuid.UUID
    quantity: int
    notes: str | None = None


class InventoryMovementResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    product_id: uuid.UUID
    movement_type: InventoryMovementType
    quantity: int
    reference_id: uuid.UUID | None
    notes: str | None
    created_at: datetime


# ---- Sale ----
class SaleItemCreate(BaseModel):
    product_id: uuid.UUID
    quantity: int
    unit_price: Decimal | None = None  # Override client/base price


class SaleItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    product_id: uuid.UUID
    quantity: int
    unit_price: Decimal
    subtotal: Decimal


class SaleCreate(BaseModel):
    date: date
    client_id: uuid.UUID
    delivery_employee_id: uuid.UUID
    items: list[SaleItemCreate]
    payment_type: PaymentType
    notes: str | None = None


class SaleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    date: date
    client_id: uuid.UUID
    delivery_employee_id: uuid.UUID | None
    subtotal: Decimal
    tax: Decimal
    total: Decimal
    paid_amount: Decimal
    balance: Decimal = Decimal("0")
    payment_type: PaymentType
    payment_method: PaymentMethod | None
    status: SaleStatus
    notes: str | None
    items: list[SaleItemResponse] = []
    created_at: datetime

    def model_post_init(self, __context: object) -> None:
        self.balance = self.total - self.paid_amount


class SaleUpdate(BaseModel):
    date: Optional[date] = None
    delivery_employee_id: uuid.UUID | None = None
    notes: str | None = None


class SaleAssignDelivery(BaseModel):
    delivery_employee_id: uuid.UUID


class SaleMarkPaid(BaseModel):
    payment_method: PaymentMethod
    amount: Decimal | None = None  # None = pago total del saldo restante


class SaleDeleteConfirm(BaseModel):
    admin_password: str


# ---- Receivable ----
class ReceivableResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    sale_id: uuid.UUID
    client_id: uuid.UUID
    amount: Decimal
    due_date: date
    status: ReceivableStatus
    paid_date: date | None
    created_at: datetime


# ---- Delivery ----
class DeliveryCreate(BaseModel):
    date: date
    sale_id: uuid.UUID
    delivery_employee_id: uuid.UUID
    pacas_delivered: int
    botellones_delivered: int = 0
    notes: str | None = None


class DeliveryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    date: date
    sale_id: uuid.UUID
    delivery_employee_id: uuid.UUID
    pacas_delivered: int
    botellones_delivered: int
    status: DeliveryStatus
    notes: str | None
    created_at: datetime


# ---- Payroll ----
class PayrollCalculate(BaseModel):
    employee_id: uuid.UUID
    period_start: date
    period_end: date
    deductions: Decimal = Decimal("0")
    notes: str | None = None


class PayrollResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    employee_id: uuid.UUID
    period_start: date
    period_end: date
    period_type: PayPeriod
    units_in_period: int
    rate: Decimal | None
    base_pay: Decimal
    advances_deducted: Decimal
    deductions: Decimal
    net_pay: Decimal
    status: PayrollStatus
    notes: str | None
    created_at: datetime


# ---- Advance ----
class AdvanceCreate(BaseModel):
    employee_id: uuid.UUID
    amount: Decimal
    date: date
    notes: str | None = None


class AdvanceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    employee_id: uuid.UUID
    amount: Decimal
    date: date
    payroll_id: uuid.UUID | None
    notes: str | None
    created_at: datetime


# ---- Company Settings ----
class CompanySettingsUpdate(BaseModel):
    name: str
    nit: str | None = None
    phone: str | None = None
    address: str | None = None
    logo_url: str | None = None


class CompanySettingsResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    name: str
    nit: str | None
    phone: str | None
    address: str | None
    logo_url: str | None


# ---- Expense ----
class ExpenseCreate(BaseModel):
    date: date
    category: ExpenseCategory
    description: str
    amount: Decimal
    notes: str | None = None
    receipt_url: str | None = None


class ExpenseUpdate(BaseModel):
    date: Optional[date] = None
    category: ExpenseCategory | None = None
    description: str | None = None
    amount: Decimal | None = None
    notes: str | None = None
    receipt_url: str | None = None


class ExpenseResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    date: date
    category: ExpenseCategory
    description: str
    amount: Decimal
    notes: str | None
    receipt_url: str | None
    created_at: datetime


# ---- Other Income ----
class OtherIncomeCreate(BaseModel):
    date: date
    category: IncomeCategory
    description: str
    amount: Decimal
    notes: str | None = None


class OtherIncomeUpdate(BaseModel):
    date: Optional[date] = None
    category: IncomeCategory | None = None
    description: str | None = None
    amount: Decimal | None = None
    notes: str | None = None


class OtherIncomeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    date: date
    category: IncomeCategory
    description: str
    amount: Decimal
    notes: str | None
    created_at: datetime


# ---- Loyalty (Gotas) ----
class LoyaltyTransactionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    client_id: uuid.UUID
    transaction_type: LoyaltyTransactionType
    points: int
    sale_id: uuid.UUID | None
    description: str | None
    created_at: datetime


class LoyaltyRedeemRequest(BaseModel):
    points: int


class LoyaltyConfigResponse(BaseModel):
    gotas_per_paca: int
    gotas_per_botellon: int
    gotas_to_redeem_paca: int


# ---- Finance KPIs ----
class FinanceKPIsResponse(BaseModel):
    total_expenses: float
    total_sales: float
    total_other_income: float
    total_income: float
    balance: float
    expense_by_category: dict[str, float]


# ---- Quote ----
class QuoteItemCreate(BaseModel):
    product_id: uuid.UUID
    quantity: int
    unit_price: Decimal | None = None  # Override client/base price


class QuoteItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    product_id: uuid.UUID
    quantity: int
    unit_price: Decimal
    subtotal: Decimal


class QuoteCreate(BaseModel):
    date: date
    client_id: uuid.UUID
    items: list[QuoteItemCreate]
    valid_until: Optional[date] = None
    status: QuoteStatus = QuoteStatus.DRAFT
    notes: str | None = None


class QuoteUpdate(BaseModel):
    date: Optional[date] = None
    valid_until: Optional[date] = None
    status: Optional[QuoteStatus] = None
    notes: str | None = None
    items: Optional[list[QuoteItemCreate]] = None


class QuoteStatusUpdate(BaseModel):
    status: QuoteStatus


class QuoteResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    date: date
    client_id: uuid.UUID
    valid_until: date
    subtotal: Decimal
    tax: Decimal
    total: Decimal
    status: QuoteStatus
    notes: str | None
    items: list[QuoteItemResponse] = []
    created_at: datetime
