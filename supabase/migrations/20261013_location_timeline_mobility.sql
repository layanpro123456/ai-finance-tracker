-- ============================================================================
-- Apex LifeOS: Location Timeline, Mobility & Geofence Payment Reminders
-- ============================================================================

-- 1. Saved Places with Geofences & Payment Rules
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

-- 2. Mobility Timeline Events (Trips, Stays, Alerts)
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

-- 3. Daily Mobility Statistics
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

-- Row Level Security (RLS)
ALTER TABLE public.saved_places ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mobility_timeline_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_mobility_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own saved places" 
    ON public.saved_places FOR ALL 
    USING (auth.uid() = user_id);

CREATE POLICY "Users manage own mobility events" 
    ON public.mobility_timeline_events FOR ALL 
    USING (auth.uid() = user_id);

CREATE POLICY "Users manage own mobility stats" 
    ON public.daily_mobility_stats FOR ALL 
    USING (auth.uid() = user_id);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_saved_places_user ON public.saved_places(user_id);
CREATE INDEX IF NOT EXISTS idx_mobility_events_user_time ON public.mobility_timeline_events(user_id, start_time DESC);
CREATE INDEX IF NOT EXISTS idx_mobility_stats_user_date ON public.daily_mobility_stats(user_id, stat_date DESC);
