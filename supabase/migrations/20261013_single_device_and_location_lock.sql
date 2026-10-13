-- ============================================================================
-- Apex LifeOS: Single-Device Session Enforcement & Device-Bound Location Data
-- ============================================================================

-- 1. Active User Device Sessions (Enforces 1 Active Device per User)
CREATE TABLE IF NOT EXISTS public.user_device_sessions (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    active_device_id TEXT NOT NULL,
    device_name TEXT NOT NULL,
    platform TEXT DEFAULT 'web',
    last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Row Level Security for user_device_sessions
ALTER TABLE public.user_device_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view and manage their active device session"
    ON public.user_device_sessions FOR ALL
    USING (auth.uid() = user_id);

-- Performance Index
CREATE INDEX IF NOT EXISTS idx_user_device_sessions_user ON public.user_device_sessions(user_id);

-- 2. Add device_id to Location-based Tables for Hardware-Unique Partitioning
-- Mobility Timeline Events
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'mobility_timeline_events' AND column_name = 'device_id'
    ) THEN
        ALTER TABLE public.mobility_timeline_events ADD COLUMN device_id TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'mobility_timeline_events' AND column_name = 'device_name'
    ) THEN
        ALTER TABLE public.mobility_timeline_events ADD COLUMN device_name TEXT;
    END IF;
END $$;

-- Daily Mobility Stats
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'daily_mobility_stats' AND column_name = 'device_id'
    ) THEN
        ALTER TABLE public.daily_mobility_stats ADD COLUMN device_id TEXT;
    END IF;
END $$;

-- Saved Places
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'saved_places' AND column_name = 'device_id'
    ) THEN
        ALTER TABLE public.saved_places ADD COLUMN device_id TEXT;
    END IF;
END $$;

-- Performance Indexes for Device-Scoped Location Queries
CREATE INDEX IF NOT EXISTS idx_mobility_events_device 
    ON public.mobility_timeline_events(user_id, device_id, start_time DESC);

CREATE INDEX IF NOT EXISTS idx_daily_mobility_stats_device 
    ON public.daily_mobility_stats(user_id, device_id, stat_date DESC);

CREATE INDEX IF NOT EXISTS idx_saved_places_device 
    ON public.saved_places(user_id, device_id);
