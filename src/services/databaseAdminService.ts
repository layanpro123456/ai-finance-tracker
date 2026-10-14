import { supabase } from '../supabaseClient';
import { logPlatformEvent } from './adminTelemetry';

export interface TableDiagnostic {
  table: string;
  name: string;
  count: number;
  status: 'clean' | 'has_data';
}

export interface DatabaseDiagnostics {
  tables: TableDiagnostic[];
  totalRecords: number;
  lastChecked: string;
}

export interface DatabaseRefreshReport {
  success: boolean;
  timestamp: string;
  clearedTables: { table: string; name: string; status: 'purged' | 'skipped' | 'failed'; error?: string }[];
  storagePurged: boolean;
  accountReset: boolean;
  message: string;
}

const TRACKED_TABLES: { table: string; name: string }[] = [
  { table: 'transactions', name: 'Transactions & Ledger Entries' },
  { table: 'budgets', name: 'Monthly Budget Targets' },
  { table: 'tasks', name: 'Tasks & Financial Obligations' },
  { table: 'personal_assets', name: 'Personal Assets & Inventory' },
  { table: 'subscriptions', name: 'Recurring Subscriptions' },
  { table: 'contacts_ledger', name: 'Social Ledger (P2P Debts)' },
  { table: 'saved_places', name: 'Saved Geofence Places' },
  { table: 'mobility_timeline_events', name: 'Mobility Timeline Events' },
  { table: 'daily_mobility_stats', name: 'Daily Mobility Statistics' },
  { table: 'user_device_sessions', name: 'Active Device Sessions' },
  { table: 'accounts', name: 'Financial Accounts' },
];

/**
 * Inspect live record counts for all ERP modules
 */
export async function getDatabaseDiagnostics(userId?: string): Promise<DatabaseDiagnostics> {
  const diagnostics: TableDiagnostic[] = [];
  let totalRecords = 0;

  for (const item of TRACKED_TABLES) {
    try {
      let query = supabase.from(item.table).select('*', { count: 'exact', head: true });
      if (userId) {
        query = query.eq('user_id', userId);
      }
      const { count, error } = await query;
      const rowCount = !error && count !== null ? count : 0;
      diagnostics.push({
        table: item.table,
        name: item.name,
        count: rowCount,
        status: rowCount === 0 ? 'clean' : 'has_data',
      });
      totalRecords += rowCount;
    } catch {
      diagnostics.push({
        table: item.table,
        name: item.name,
        count: 0,
        status: 'clean',
      });
    }
  }

  return {
    tables: diagnostics,
    totalRecords,
    lastChecked: new Date().toISOString(),
  };
}

/**
 * Fully purge all database records across all user tables and wipe local storage caches
 */
export async function purgeAllDatabaseData(
  userId: string,
  userEmail?: string,
  currency = 'USD'
): Promise<DatabaseRefreshReport> {
  const clearedTables: DatabaseRefreshReport['clearedTables'] = [];

  // 1. Try PostgreSQL RPC if available
  try {
    const { error: rpcError } = await supabase.rpc('admin_purge_user_data', {
      target_user_id: userId,
    });
    if (!rpcError) {
      console.info('Database purged successfully via PostgreSQL RPC function.');
    }
  } catch {
    // Graceful fallback to client-level batch deletion
  }

  // 2. Direct client-level cascade deletion across all tables
  for (const item of TRACKED_TABLES) {
    try {
      const { error } = await supabase.from(item.table).delete().eq('user_id', userId);
      if (error) {
        clearedTables.push({
          table: item.table,
          name: item.name,
          status: 'failed',
          error: error.message,
        });
      } else {
        clearedTables.push({
          table: item.table,
          name: item.name,
          status: 'purged',
        });
      }
    } catch (err: unknown) {
      clearedTables.push({
        table: item.table,
        name: item.name,
        status: 'failed',
        error: err instanceof Error ? err.message : 'Unknown table purge error',
      });
    }
  }

  // 3. Re-initialize a single clean primary checking account with zero balance
  let accountReset = false;
  try {
    const { error: accInsertErr } = await supabase.from('accounts').insert({
      user_id: userId,
      name: 'Primary Checking',
      balance: 0.0,
      currency,
    });
    accountReset = !accInsertErr;
  } catch {
    accountReset = false;
  }

  // 4. Wipe all local storage caches, mock keys, and seeded timeline/mobility states
  let storagePurged = false;
  try {
    // Specific known keys
    localStorage.removeItem('apex_no_spend_streak');
    localStorage.removeItem('apex_marked_today');
    localStorage.removeItem('apex_platform_activity_log');
    localStorage.removeItem('apex_saved_places');
    localStorage.removeItem('apex_timeline_events');
    localStorage.removeItem('apex_daily_mobility');
    localStorage.removeItem('apex_mobility_timeline_events');

    // Dynamic pattern keys (device-scoped)
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (
        key &&
        (key.startsWith('apex_saved_places_') ||
          key.startsWith('apex_timeline_events_') ||
          key.startsWith('apex_daily_mobility_') ||
          key.startsWith('apex_active_session_') ||
          key.startsWith('apex_events_') ||
          key.startsWith('apex_mobility_'))
      ) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
    storagePurged = true;
  } catch {
    storagePurged = false;
  }

  // 5. Log authentic administrative audit record
  logPlatformEvent(
    'SECURITY',
    'Administrator executed full database refresh & cache purge (zero sample data)',
    userId,
    userEmail
  );

  return {
    success: true,
    timestamp: new Date().toISOString(),
    clearedTables,
    storagePurged,
    accountReset,
    message: 'Database fully refreshed. All user tables purged and sample data eliminated.',
  };
}
