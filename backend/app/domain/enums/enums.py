import enum


class UserRole(str, enum.Enum):
    ADMIN = "admin"
    SECRETARY = "secretary"
    DELIVERY = "delivery"


class EmployeeRole(str, enum.Enum):
    SECRETARY = "secretary"
    DELIVERY = "delivery"
    PACKER = "packer"


class PayPeriod(str, enum.Enum):
    WEEKLY = "weekly"
    MONTHLY = "monthly"


class ClientType(str, enum.Enum):
    PERSON = "person"
    COMPANY = "company"


class ProductType(str, enum.Enum):
    PACA_X40 = "paca_x40"
    BOTELLON_20L = "botellon_20l"
    PIEDRA_FILTRO = "piedra_filtro"
    RECARGA_BOTELLON = "recarga_botellon"


class PaymentType(str, enum.Enum):
    CASH = "cash"
    CREDIT = "credit"


class PaymentMethod(str, enum.Enum):
    CASH = "cash"
    TRANSFER = "transfer"
    NEQUI = "nequi"
    DAVIPLATA = "daviplata"


class SaleStatus(str, enum.Enum):
    PENDING = "pending"
    PARTIAL = "partial"
    PAID = "paid"


class DeliveryStatus(str, enum.Enum):
    PENDING = "pending"
    IN_ROUTE = "in_route"
    DELIVERED = "delivered"


class PayrollStatus(str, enum.Enum):
    CALCULATED = "calculated"
    PAID = "paid"


class InvoiceType(str, enum.Enum):
    ELECTRONIC = "electronic"
    EQUIVALENT_DOCUMENT = "equivalent_document"


class InvoiceStatus(str, enum.Enum):
    DRAFT = "draft"
    SENT_TO_DIAN = "sent_to_dian"
    ACCEPTED = "accepted"
    REJECTED = "rejected"


class ExpenseCategory(str, enum.Enum):
    RAW_MATERIAL = "raw_material"
    SERVICES = "services"
    TRANSPORT = "transport"
    PAYROLL = "payroll"
    OTHER = "other"


class InventoryMovementType(str, enum.Enum):
    PRODUCTION_IN = "production_in"
    SALE_OUT = "sale_out"
    ADJUSTMENT = "adjustment"
    RAW_MATERIAL_IN = "raw_material_in"
    RAW_MATERIAL_OUT = "raw_material_out"


class ReceivableStatus(str, enum.Enum):
    PENDING = "pending"
    PAID = "paid"
    OVERDUE = "overdue"


class IncomeCategory(str, enum.Enum):
    RENTAL = "rental"
    INTEREST = "interest"
    REFUND = "refund"
    SUBSIDY = "subsidy"
    OTHER = "other"


class LoyaltyTransactionType(str, enum.Enum):
    EARN = "earn"
    REDEEM = "redeem"
    REVERSAL = "reversal"
