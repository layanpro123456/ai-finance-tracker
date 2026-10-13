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

-- ================================================================
-- 11. Location Timeline, Geofences & Mobility Telemetry
-- ================================================================

-- Saved Places with Geofences & Payment Rules
CREATE TABLE IF NOT EXISTS public.saved_places (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    radius_meters INTEGER DEFAULT 300,
    category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    linked_task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
    linked_contact_id UUID REFERENCES public.contacts_ledger(id) ON DELETE SET NULL,
    reminder_type TEXT DEFAULT 'budget' CHECK (reminder_type IN ('budget', 'task', 'contact', 'custom')),
    reminder_message TEXT,
    icon_type TEXT DEFAULT 'store',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Mobility Timeline Events (Trips, Stays, Alerts)
CREATE TABLE IF NOT EXISTS public.mobility_timeline_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    event_type TEXT NOT NULL CHECK (event_type IN ('trip', 'stay', 'payment_alert')),
    title TEXT NOT NULL,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ,
    duration_seconds INTEGER,
    mode TEXT CHECK (mode IN ('stationary', 'walking', 'cycling', 'vehicle', 'high_speed_transit')),
    in_traffic BOOLEAN DEFAULT FALSE,
    distance_km NUMERIC(8, 2) DEFAULT 0,
    avg_speed_kmh NUMERIC(6, 1) DEFAULT 0,
    max_speed_kmh NUMERIC(6, 1) DEFAULT 0,
    estimated_cost NUMERIC(10, 2) DEFAULT 0,
    is_cost_logged BOOLEAN DEFAULT FALSE,
    place_name TEXT,
    notes TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Daily Mobility Statistics
CREATE TABLE IF NOT EXISTS public.daily_mobility_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    stat_date DATE NOT NULL,
    total_distance_km NUMERIC(8, 2) DEFAULT 0,
    transit_time_minutes INTEGER DEFAULT 0,
    walking_km NUMERIC(8, 2) DEFAULT 0,
    cycling_km NUMERIC(8, 2) DEFAULT 0,
    vehicle_km NUMERIC(8, 2) DEFAULT 0,
    estimated_transit_cost NUMERIC(10, 2) DEFAULT 0,
    logged_transit_cost NUMERIC(10, 2) DEFAULT 0,
    top_speed_kmh NUMERIC(6, 1) DEFAULT 0,
    active_stops_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, stat_date)
);

-- Mobility Row Level Security (RLS)
ALTER TABLE public.saved_places ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mobility_timeline_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_mobility_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own saved places" ON public.saved_places FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own mobility events" ON public.mobility_timeline_events FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own mobility stats" ON public.daily_mobility_stats FOR ALL USING (auth.uid() = user_id);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_saved_places_user ON public.saved_places(user_id);
CREATE INDEX IF NOT EXISTS idx_mobility_events_user_time ON public.mobility_timeline_events(user_id, start_time DESC);
CREATE INDEX IF NOT EXISTS idx_mobility_stats_user_date ON public.daily_mobility_stats(user_id, stat_date DESC);
```

---

## 12. Single-Device Session Enforcement & Device-Bound Location Data

To maintain spatial telemetry integrity and prevent route crosstalk, simultaneous multi-device logins are strictly locked out, and location data is partitioned by hardware `device_id`.

```sql
-- Active User Device Sessions (1 Active Session Allowed per User)
CREATE TABLE IF NOT EXISTS public.user_device_sessions (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    active_device_id TEXT NOT NULL,
    device_name TEXT NOT NULL,
    platform TEXT DEFAULT 'web',
    last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Row Level Security
ALTER TABLE public.user_device_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view and manage their active device session"
    ON public.user_device_sessions FOR ALL
    USING (auth.uid() = user_id);

-- Device-Partitioning Columns on Location Tables
ALTER TABLE public.mobility_timeline_events ADD COLUMN IF NOT EXISTS device_id TEXT;
ALTER TABLE public.mobility_timeline_events ADD COLUMN IF NOT EXISTS device_name TEXT;
ALTER TABLE public.daily_mobility_stats ADD COLUMN IF NOT EXISTS device_id TEXT;
ALTER TABLE public.saved_places ADD COLUMN IF NOT EXISTS device_id TEXT;

-- Hardware Isolation Indexes
CREATE INDEX IF NOT EXISTS idx_mobility_events_device 
    ON public.mobility_timeline_events(user_id, device_id, start_time DESC);

CREATE INDEX IF NOT EXISTS idx_daily_mobility_stats_device 
    ON public.daily_mobility_stats(user_id, device_id, stat_date DESC);

CREATE INDEX IF NOT EXISTS idx_saved_places_device 
    ON public.saved_places(user_id, device_id);
```