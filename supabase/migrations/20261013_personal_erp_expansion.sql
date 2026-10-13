-- ================================================================
-- Supabase Migration: Personal ERP Expansion
-- Extends the core finance system with:
-- 1. Daily Tasks & Financial Obligations (public.tasks)
-- 2. Personal Assets & Inventory Valuation (public.personal_assets)
-- 3. Subscriptions & Recurring Commitments (public.subscriptions)
-- 4. Social Ledger / P2P Debts (public.contacts_ledger)
-- ================================================================

-- 1. Tasks & Operations (with Financial Bridges)
CREATE TABLE IF NOT EXISTS public.tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    due_date TIMESTAMPTZ,
    status VARCHAR(20) DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'completed', 'cancelled')),
    priority VARCHAR(10) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    
    -- Financial Bridges
    is_financial BOOLEAN DEFAULT FALSE,
    financial_type VARCHAR(20) DEFAULT 'none' CHECK (financial_type IN ('payable', 'receivable', 'budget_task', 'none')),
    amount NUMERIC(12, 2) DEFAULT 0.00,
    category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
    related_transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
    
    -- Recurrence & Metadata
    recurrence_rule VARCHAR(50) DEFAULT 'none', -- 'none', 'daily', 'weekly', 'monthly'
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Personal Assets & Inventory (Feeds Net Worth & Warranties)
CREATE TABLE IF NOT EXISTS public.personal_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    category VARCHAR(50) NOT NULL DEFAULT 'Other', -- 'Electronics', 'Vehicles', 'Real Estate', 'Home & Tools', 'Jewelry & Collectibles', 'Other'
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

-- 3. Subscriptions & Recurring Commitments
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

-- 4. Social Ledger (P2P Debts / Receivables / Shared Expenses)
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

-- 5. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_tasks_user ON public.tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON public.tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_assets_user ON public.personal_assets(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_next_date ON public.subscriptions(next_billing_date);
CREATE INDEX IF NOT EXISTS idx_contacts_user ON public.contacts_ledger(user_id);

-- 6. Enable Row-Level Security (RLS)
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts_ledger ENABLE ROW LEVEL SECURITY;

-- 7. RLS Access Control Policies
CREATE POLICY "Users can manage their own tasks"
ON public.tasks FOR ALL
USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own personal assets"
ON public.personal_assets FOR ALL
USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own subscriptions"
ON public.subscriptions FOR ALL
USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own contacts ledger"
ON public.contacts_ledger FOR ALL
USING (auth.uid() = user_id);
