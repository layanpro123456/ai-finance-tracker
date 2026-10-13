export interface Account {
  id: string;
  user_id: string;
  name: string;
  currency: string;
  balance: number;
  created_at?: string;
}

export interface Category {
  id: string;
  user_id: string | null;
  name: string;
  type: 'income' | 'expense';
  is_default: boolean;
  created_at?: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  account_id: string;
  category_id: string | null;
  amount: number;
  type: 'income' | 'expense';
  description: string;
  raw_prompt?: string;
  transaction_date: string;
  created_at?: string;
  accounts?: { name: string; currency: string };
  categories?: { name: string };
}

export interface Budget {
  id: string;
  user_id: string;
  category_id: string;
  monthly_limit: number;
  month_year: string;
  created_at?: string;
  categories?: { name: string };
}

export interface ParsedTransactionData {
  amount: number;
  type: 'income' | 'expense';
  category: string;
  description: string;
  transaction_date: string;
  raw_prompt: string;
}

export type TaskStatus = 'todo' | 'in_progress' | 'completed' | 'cancelled';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type FinancialTaskType = 'payable' | 'receivable' | 'budget_task' | 'none';

export interface Task {
  id: string;
  user_id: string;
  title: string;
  description?: string | null;
  due_date?: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  is_financial: boolean;
  financial_type: FinancialTaskType;
  amount: number;
  category_id?: string | null;
  account_id?: string | null;
  related_transaction_id?: string | null;
  recurrence_rule?: string;
  completed_at?: string | null;
  created_at?: string;
  categories?: { name: string };
  accounts?: { name: string; currency: string };
}

export type AssetCategory = 'Electronics' | 'Vehicles' | 'Real Estate' | 'Home & Tools' | 'Jewelry & Collectibles' | 'Other';
export type AssetStatus = 'active' | 'sold' | 'donated' | 'disposed';

export interface PersonalAsset {
  id: string;
  user_id: string;
  name: string;
  category: AssetCategory;
  purchase_price: number;
  current_value: number;
  purchase_date?: string | null;
  warranty_expiry?: string | null;
  serial_number?: string | null;
  location?: string | null;
  notes?: string | null;
  status: AssetStatus;
  linked_transaction_id?: string | null;
  created_at?: string;
}

export type BillingCycle = 'weekly' | 'monthly' | 'quarterly' | 'yearly';

export interface Subscription {
  id: string;
  user_id: string;
  name: string;
  cost: number;
  billing_cycle: BillingCycle;
  next_billing_date: string;
  category_id?: string | null;
  account_id?: string | null;
  is_active: boolean;
  cancellation_url?: string | null;
  notes?: string | null;
  created_at?: string;
  categories?: { name: string };
  accounts?: { name: string; currency: string };
}

export type ContactDebtType = 'they_owe_me' | 'i_owe_them';

export interface ContactsLedger {
  id: string;
  user_id: string;
  contact_name: string;
  type: ContactDebtType;
  amount: number;
  description?: string | null;
  due_date?: string | null;
  is_settled: boolean;
  settled_at?: string | null;
  settled_transaction_id?: string | null;
  created_at?: string;
}

export interface PlatformUserSummary {
  id: string;
  email: string;
  maskedId: string;
  role: 'admin' | 'user';
  status: 'active' | 'inactive';
  joinedDate: string;
  lastActive: string;
  totalTransactions: number;
  totalAccounts: number;
  totalTasks: number;
  totalSubscriptions: number;
  aiUsageRate: number; // percentage
}

export type ActivityEventType =
  | 'AUTH'
  | 'TRANSACTION'
  | 'BUDGET'
  | 'TASK'
  | 'ASSET'
  | 'SUBSCRIPTION'
  | 'SOCIAL_IOU'
  | 'SECURITY';

export interface PlatformActivityLog {
  id: string;
  timestamp: string;
  type: ActivityEventType;
  userId: string;
  userEmailMasked: string;
  action: string;
  platform: string;
  status: 'success' | 'warning' | 'info';
}
