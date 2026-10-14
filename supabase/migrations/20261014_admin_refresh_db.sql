-- ============================================================================
-- Supabase Migration: Admin Database Full Refresh & Zero-Sample Data Policy
-- ============================================================================

-- Function to completely purge all user data across all ERP modules
-- and re-initialize a single clean primary checking account with 0.00 balance.
CREATE OR REPLACE FUNCTION public.admin_purge_user_data(target_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSONB;
BEGIN
    -- 1. Cascade delete all personal financial records
    DELETE FROM public.transactions WHERE user_id = target_user_id;
    DELETE FROM public.budgets WHERE user_id = target_user_id;

    -- 2. Cascade delete all ERP expansion records
    DELETE FROM public.tasks WHERE user_id = target_user_id;
    DELETE FROM public.personal_assets WHERE user_id = target_user_id;
    DELETE FROM public.subscriptions WHERE user_id = target_user_id;
    DELETE FROM public.contacts_ledger WHERE user_id = target_user_id;

    -- 3. Cascade delete all location & mobility tracking records
    DELETE FROM public.saved_places WHERE user_id = target_user_id;
    DELETE FROM public.mobility_timeline_events WHERE user_id = target_user_id;
    DELETE FROM public.daily_mobility_stats WHERE user_id = target_user_id;

    -- 4. Purge active device sessions for this user
    DELETE FROM public.user_device_sessions WHERE user_id = target_user_id;

    -- 5. Delete all existing accounts
    DELETE FROM public.accounts WHERE user_id = target_user_id;

    -- 6. Initialize single clean Primary Checking account with 0.00 balance (zero hallucinated money)
    INSERT INTO public.accounts (user_id, name, balance, currency)
    VALUES (target_user_id, 'Primary Checking', 0.00, 'USD');

    result := jsonb_build_object(
        'success', true,
        'message', 'User tables successfully purged and clean zero-balance checking account initialized.',
        'target_user_id', target_user_id
    );

    RETURN result;
END;
$$;
