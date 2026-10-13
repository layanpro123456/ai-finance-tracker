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
