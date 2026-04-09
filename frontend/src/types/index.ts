export interface User {
  id: string;
  username: string;
  full_name: string;
  role: 'admin' | 'secretary' | 'delivery';
  is_active: boolean;
  employee_id: string | null;
  created_at: string;
}

export interface Employee {
  id: string;
  name: string;
  cedula: string;
  role: 'secretary' | 'delivery' | 'packer';
  pay_period: 'weekly' | 'monthly';
  fixed_salary: string | null;
  rate_per_paca: string | null;
  phone: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Product {
  id: string;
  name: string;
  product_type: 'paca_x40' | 'botellon_20l';
  unit: string;
  base_price: string;
  is_active: boolean;
  created_at: string;
}

export interface ClientPrice {
  id: string;
  product_id: string;
  price: string;
}

export interface Client {
  id: string;
  name: string;
  client_type: 'person' | 'company';
  cedula_nit: string;
  address: string | null;
  delivery_zone: string | null;
  phone: string | null;
  email: string | null;
  latitude: string | null;
  longitude: string | null;
  loyalty_points: number;
  is_active: boolean;
  prices: ClientPrice[];
  created_at: string;
}

export interface LoyaltyTransaction {
  id: string;
  client_id: string;
  transaction_type: 'earn' | 'redeem' | 'reversal';
  points: number;
  sale_id: string | null;
  description: string | null;
  created_at: string;
}

export interface LoyaltyConfig {
  gotas_per_paca: number;
  gotas_per_botellon: number;
  gotas_to_redeem_paca: number;
}

export interface Bobina {
  id: string;
  code: string | null;
  purchase_date: string | null;
  weight_kg: string;
  cost: string;
  estimated_pacas: number;
  remaining_pacas: number;
  is_exhausted: boolean;
  supplier: string | null;
  notes: string | null;
  created_at: string;
}

export interface Production {
  id: string;
  date: string;
  employee_id: string;
  bobina_id: string | null;
  pacas_produced: number;
  botellones_produced: number;
  waste_pacas: number;
  is_paid: boolean;
  payment_amount: string | null;
  notes: string | null;
  created_at: string;
}

export interface ProductionSummary {
  total_pacas: number;
  total_botellones: number;
  total_waste: number;
  total_records: number;
}

export interface Inventory {
  id: string;
  product_id: string;
  quantity: number;
}

export interface InventoryMovement {
  id: string;
  product_id: string;
  movement_type: string;
  quantity: number;
  reference_id: string | null;
  notes: string | null;
  created_at: string;
}

export interface SaleItem {
  id: string;
  product_id: string;
  quantity: number;
  unit_price: string;
  subtotal: string;
}

export interface Sale {
  id: string;
  date: string;
  client_id: string;
  delivery_employee_id: string | null;
  subtotal: string;
  tax: string;
  total: string;
  payment_type: 'cash' | 'credit';
  payment_method: 'cash' | 'transfer' | 'nequi' | 'daviplata' | null;
  status: 'pending' | 'paid';
  notes: string | null;
  items: SaleItem[];
  created_at: string;
}

export interface Receivable {
  id: string;
  sale_id: string;
  client_id: string;
  amount: string;
  due_date: string;
  status: 'pending' | 'paid' | 'overdue';
  paid_date: string | null;
  created_at: string;
}

export interface Delivery {
  id: string;
  date: string;
  sale_id: string;
  delivery_employee_id: string;
  pacas_delivered: number;
  botellones_delivered: number;
  status: 'pending' | 'in_route' | 'delivered';
  notes: string | null;
  created_at: string;
}

export interface Payroll {
  id: string;
  employee_id: string;
  period_start: string;
  period_end: string;
  period_type: 'weekly' | 'monthly';
  units_in_period: number;
  rate: string | null;
  base_pay: string;
  advances_deducted: string;
  deductions: string;
  net_pay: string;
  status: 'calculated' | 'paid';
  notes: string | null;
  created_at: string;
}

export interface Advance {
  id: string;
  employee_id: string;
  amount: string;
  date: string;
  payroll_id: string | null;
  notes: string | null;
  created_at: string;
}

export interface CompanySettings {
  id: string;
  name: string;
  nit: string | null;
  phone: string | null;
  address: string | null;
  logo_url: string | null;
}

export interface Expense {
  id: string;
  date: string;
  category: 'raw_material' | 'services' | 'transport' | 'payroll' | 'other';
  description: string;
  amount: string;
  notes: string | null;
  receipt_url: string | null;
  created_at: string;
}

export interface OtherIncome {
  id: string;
  date: string;
  category: 'rental' | 'interest' | 'refund' | 'subsidy' | 'other';
  description: string;
  amount: string;
  notes: string | null;
  created_at: string;
}

export interface FinanceKPIs {
  total_expenses: number;
  total_sales: number;
  total_other_income: number;
  total_income: number;
  balance: number;
  expense_by_category: Record<string, number>;
}
