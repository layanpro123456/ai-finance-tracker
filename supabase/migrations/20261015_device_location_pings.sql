-- ============================================================================
-- Apex LifeOS: Device Location Pings & Realtime Background Telemetry
-- ============================================================================

-- 1. Dedicated Raw Telemetry Pings Table
CREATE TABLE IF NOT EXISTS public.device_location_pings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    device_id TEXT NOT NULL,
    device_name TEXT,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    altitude DOUBLE PRECISION,
    accuracy_meters REAL,
    speed_kmh REAL DEFAULT 0,
    heading REAL,
    battery_level REAL,
    is_charging BOOLEAN DEFAULT FALSE,
    transport_mode TEXT DEFAULT 'unknown',
    recorded_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Row Level Security (RLS)
ALTER TABLE public.device_location_pings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own location pings"
    ON public.device_location_pings FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own location pings"
    ON public.device_location_pings FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own location pings"
    ON public.device_location_pings FOR DELETE
    USING (auth.uid() = user_id);

-- 3. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_device_pings_user_time 
    ON public.device_location_pings (user_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_device_pings_device_time 
    ON public.device_location_pings (device_id, recorded_at DESC);

-- 4. Supabase Realtime Publication for Live Dashboard Streaming
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_tables 
            WHERE pubname = 'supabase_realtime' 
              AND schemaname = 'public' 
              AND tablename = 'device_location_pings'
        ) THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE public.device_location_pings;
        END IF;
    END IF;
END $$;

-- 5. Automated 14-Day Rolling TTL Pruning
-- Prevents long-term database bloat by purging high-frequency breadcrumbs older than 14 days
CREATE OR REPLACE FUNCTION public.prune_old_location_pings()
RETURNS trigger AS $$
BEGIN
    DELETE FROM public.device_location_pings
    WHERE recorded_at < NOW() - INTERVAL '14 days';
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prune_location_pings ON public.device_location_pings;
CREATE TRIGGER trg_prune_location_pings
    AFTER INSERT ON public.device_location_pings
    FOR EACH STATEMENT
    EXECUTE FUNCTION public.prune_old_location_pings();
