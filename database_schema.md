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
```