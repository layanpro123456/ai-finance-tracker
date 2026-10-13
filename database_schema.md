# Database Schema & Security Policies

Execute the following SQL code in the **Supabase SQL Editor** to set up tables, foreign key constraints, indexes, and Row-Level Security (RLS) policies.

---

```sql
-- 1. Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Accounts (Bank, Cash, Credit Card, Wallet)
CREATE TABLE public.accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    balance NUMERIC(12, 2) DEFAULT 0.00,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Categories (Income / Expense)
CREATE TABLE public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type VARCHAR(10) CHECK (type IN ('income', 'expense')) NOT NULL,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Transactions
CREATE TABLE public.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE NOT NULL,
    category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    amount NUMERIC(12, 2) NOT NULL,
    type VARCHAR(10) CHECK (type IN ('income', 'expense')) NOT NULL,
    description TEXT,
    raw_prompt TEXT,
    transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Budgets
CREATE TABLE public.budgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    category_id UUID REFERENCES public.categories(id) ON DELETE CASCADE NOT NULL,
    monthly_limit NUMERIC(12, 2) NOT NULL,
    month_year VARCHAR(7) NOT NULL, -- Format: YYYY-MM
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, category_id, month_year)
);

-- 6. Performance Indexes
CREATE INDEX idx_transactions_user ON public.transactions(user_id);
CREATE INDEX idx_transactions_date ON public.transactions(transaction_date);
CREATE INDEX idx_accounts_user ON public.accounts(user_id);
CREATE INDEX idx_budgets_lookup ON public.budgets(user_id, month_year);

-- 7. Enable Row-Level Security (RLS)
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;

-- 8. Access Control Policies
CREATE POLICY "Users can manage their own accounts" 
ON public.accounts FOR ALL 
USING (auth.uid() = user_id);

CREATE POLICY "Users can view default categories and manage their own" 
ON public.categories FOR ALL 
USING (auth.uid() = user_id OR is_default = TRUE);

CREATE POLICY "Users can manage their own transactions" 
ON public.transactions FOR ALL 
USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own budgets" 
ON public.budgets FOR ALL 
USING (auth.uid() = user_id);

-- 9. Seed Default Categories
INSERT INTO public.categories (name, type, is_default) VALUES
('Groceries', 'expense', TRUE),
('Dining Out', 'expense', TRUE),
('Housing & Utilities', 'expense', TRUE),
('Transportation', 'expense', TRUE),
('Entertainment', 'expense', TRUE),
('Health & Fitness', 'expense', TRUE),
('Salary', 'income', TRUE),
('Freelance', 'income', TRUE),
('Investments', 'income', TRUE);

-- ================================================================
-- 10. Personal ERP Expansion Tables
-- ================================================================

-- Tasks & Operations (with Financial Bridges)
CREATE TABLE IF NOT EXISTS public.tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    due_date TIMESTAMPTZ,
    status VARCHAR(20) DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'completed', 'cancelled')),
    priority VARCHAR(10) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    is_financial BOOLEAN DEFAULT FALSE,
    financial_type VARCHAR(20) DEFAULT 'none' CHECK (financial_type IN ('payable', 'receivable', 'budget_task', 'none')),
    amount NUMERIC(12, 2) DEFAULT 0.00,
    category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
    related_transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
    recurrence_rule VARCHAR(50) DEFAULT 'none',
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Personal Assets & Inventory (Feeds Net Worth & Warranties)
CREATE TABLE IF NOT EXISTS public.personal_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    category VARCHAR(50) NOT NULL DEFAULT 'Other',
    purchase_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    current_value NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    purchase_date DATE,
    warranty_expiry DATE,
    serial_number TEXT,
    location TEXT,
    notes TEXT,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'sold', 'donated', 'disposed')),
    linked_transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Subscriptions & Recurring Commitments
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    cost NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    billing_cycle VARCHAR(20) DEFAULT 'monthly' CHECK (billing_cycle IN ('weekly', 'monthly', 'quarterly', 'yearly')),
    next_billing_date DATE NOT NULL,
    category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT TRUE,
    cancellation_url TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Social Ledger (P2P Debts / Receivables)
CREATE TABLE IF NOT EXISTS public.contacts_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    contact_name TEXT NOT NULL,
    type VARCHAR(20) CHECK (type IN ('they_owe_me', 'i_owe_them')) NOT NULL,
    amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    description TEXT,
    due_date DATE,
    is_settled BOOLEAN DEFAULT FALSE,
    settled_at TIMESTAMPTZ,
    settled_transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ERP Security Policies
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own tasks" ON public.tasks FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own personal assets" ON public.personal_assets FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own subscriptions" ON public.subscriptions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own contacts ledger" ON public.contacts_ledger FOR ALL USING (auth.uid() = user_id);
```