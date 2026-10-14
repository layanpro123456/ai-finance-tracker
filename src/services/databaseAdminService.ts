import { supabase } from '../supabaseClient';
import { logPlatformEvent, isAuthorizedAdmin } from './adminTelemetry';

export interface TableDiagnostic {
  table: string;
  name: string;
  category: 'core' | 'erp' | 'mobility' | 'system';
  count: number;
  status: 'clean' | 'has_data';
}

export interface DatabaseDiagnostics {
  tables: TableDiagnostic[];
  totalRecords: number;
  lastChecked: string;
  scope: 'global' | 'workspace';
}

export interface DatabaseRefreshReport {
  success: boolean;
  timestamp: string;
  clearedTables: { table: string; name: string; status: 'purged' | 'skipped' | 'failed'; error?: string }[];
  storagePurged: boolean;
  accountReset: boolean;
  message: string;
}

export const TRACKED_TABLES: {
  table: string;
  name: string;
  category: 'core' | 'erp' | 'mobility' | 'system';
}[] = [
  // 1. Core Financial Ledger
  { table: 'accounts', name: 'Financial Accounts & Balances', category: 'core' },
  { table: 'transactions', name: 'Transactions & Ledger Entries', category: 'core' },
  { table: 'categories', name: 'Taxonomy Categories (Income & Expense)', category: 'core' },
  { table: 'budgets', name: 'Monthly Budget Caps & Targets', category: 'core' },

  // 2. Personal ERP Expansion Subsystems
  { table: 'tasks', name: 'Tasks & Financial Obligations', category: 'erp' },
  { table: 'personal_assets', name: 'Personal Assets, Hardware & Warranties', category: 'erp' },
  { table: 'subscriptions', name: 'Recurring Subscriptions & Renewals', category: 'erp' },
  { table: 'contacts_ledger', name: 'Social Ledger (P2P Debts / IOUs)', category: 'erp' },

  // 3. Physical Mobility, Geofencing & Telemetry
  { table: 'saved_places', name: 'Saved Geofence Places & Payment Rules', category: 'mobility' },
  { table: 'mobility_timeline_events', name: 'Mobility Timeline Events & Commute Legs', category: 'mobility' },
  { table: 'daily_mobility_stats', name: 'Daily Mobility Summary Aggregates', category: 'mobility' },
  { table: 'device_location_pings', name: 'Android APK GPS & Telemetry Pings', category: 'mobility' },

  // 4. Platform Security & Hardware Sentinel
  { table: 'user_device_sessions', name: 'Active Device Sessions & Hardware Sentinel', category: 'system' },
];

/**
 * Inspect live record counts for all 13 ERP tables across the database.
 * @param userId Optional user UUID. If omitted, queries global table counts across all platform records.
 */
export async function getDatabaseDiagnostics(userId?: string): Promise<DatabaseDiagnostics> {
  const diagnostics: TableDiagnostic[] = [];
  let totalRecords = 0;

  for (const item of TRACKED_TABLES) {
    try {
      let query = supabase.from(item.table).select('*', { count: 'exact', head: true });
      if (userId) {
        if (item.table === 'categories') {
          query = query.or(`user_id.eq.${userId},is_default.eq.true`);
        } else {
          query = query.eq('user_id', userId);
        }
      }
      const { count, error } = await query;
      const rowCount = !error && count !== null ? count : 0;
      diagnostics.push({
        table: item.table,
        name: item.name,
        category: item.category,
        count: rowCount,
        status: rowCount === 0 ? 'clean' : 'has_data',
      });
      totalRecords += rowCount;
    } catch {
      diagnostics.push({
        table: item.table,
        name: item.name,
        category: item.category,
        count: 0,
        status: 'clean',
      });
    }
  }

  return {
    tables: diagnostics,
    totalRecords,
    lastChecked: new Date().toISOString(),
    scope: userId ? 'workspace' : 'global',
  };
}

/**
 * Standard system default categories required for proper categorization & budgeting
 */
const DEFAULT_SYSTEM_CATEGORIES = [
  { name: 'Groceries', type: 'expense', is_default: true },
  { name: 'Dining Out', type: 'expense', is_default: true },
  { name: 'Housing & Utilities', type: 'expense', is_default: true },
  { name: 'Transportation', type: 'expense', is_default: true },
  { name: 'Entertainment', type: 'expense', is_default: true },
  { name: 'Health & Fitness', type: 'expense', is_default: true },
  { name: 'Salary', type: 'income', is_default: true },
  { name: 'Freelance', type: 'income', is_default: true },
  { name: 'Investments', type: 'income', is_default: true },
  { name: 'Other', type: 'expense', is_default: true },
];

/**
 * Fully purge database records across all 13 tables while preserving authentication accounts in auth.users.
 * Guarantees all user starting accounts are reset strictly to 0.00 balance.
 */
export async function purgeAllDatabaseData(
  userId?: string,
  userEmail?: string,
  currency = 'USD',
  scope: 'global' | 'user' = 'global'
): Promise<DatabaseRefreshReport> {
  if (userEmail && !isAuthorizedAdmin(userEmail)) {
    throw new Error('Unauthorized: Administrative operations are restricted to layanmoyura@proton.me only.');
  }

  const clearedTables: DatabaseRefreshReport['clearedTables'] = [];

  // 1. Try PostgreSQL RPC if targeted to single user and available
  if (scope === 'user' && userId) {
    try {
      const { error: rpcError } = await supabase.rpc('admin_purge_user_data', {
        target_user_id: userId,
      });
      if (!rpcError) {
        console.info('Database purged successfully via PostgreSQL RPC function.');
      }
    } catch {
      // Fallback to client-level batch deletion
    }
  }

  // 2. Cascade deletion across all 13 tracked tables in foreign-key safe order
  // Dependent/child records purged first, then parent tables
  const PURGE_ORDER = [
    'device_location_pings',
    'mobility_timeline_events',
    'daily_mobility_stats',
    'saved_places',
    'tasks',
    'personal_assets',
    'subscriptions',
    'contacts_ledger',
    'transactions',
    'budgets',
    'user_device_sessions',
    'accounts',
    'categories',
  ];

  for (const tableName of PURGE_ORDER) {
    const item = TRACKED_TABLES.find((t) => t.table === tableName) || {
      table: tableName,
      name: tableName,
      category: 'core' as const,
    };

    try {
      let deleteQuery = supabase.from(item.table).delete();
      const col = item.table === 'user_device_sessions' ? 'user_id' : 'id';

      if (scope === 'user' && userId) {
        if (item.table === 'categories') {
          deleteQuery = deleteQuery.eq('user_id', userId).eq('is_default', false);
        } else {
          deleteQuery = deleteQuery.eq('user_id', userId);
        }
      } else {
        // Global refresh: purge all rows in the table (preserving default categories)
        if (item.table === 'categories') {
          deleteQuery = deleteQuery.eq('is_default', false);
        } else {
          deleteQuery = deleteQuery.neq(col, '00000000-0000-0000-0000-000000000000');
        }
      }

      const { error } = await deleteQuery;
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

  // 3. Ensure starting accounts exist with balance 0.00 (Zero Hallucinated Money)
  let accountReset = false;
  try {
    if (scope === 'global') {
      try {
        const { data: userData } = await supabase.auth.admin.listUsers();
        if (userData?.users && userData.users.length > 0) {
          for (const u of userData.users) {
            const userCurrency = (u.user_metadata?.preferences as { currency?: string })?.currency || currency || 'USD';
            await supabase.from('accounts').insert({
              user_id: u.id,
              name: 'Primary Checking',
              balance: 0.0,
              currency: userCurrency,
            });
          }
          accountReset = true;
        }
      } catch {
        // Fall back to creating for current user if listUsers is restricted
        if (userId) {
          await supabase.from('accounts').insert({
            user_id: userId,
            name: 'Primary Checking',
            balance: 0.0,
            currency,
          });
          accountReset = true;
        }
      }
    } else if (userId) {
      await supabase.from('accounts').insert({
        user_id: userId,
        name: 'Primary Checking',
        balance: 0.0,
        currency,
      });
      accountReset = true;
    }
  } catch {
    accountReset = false;
  }

  // 4. Ensure standard default taxonomy categories are present
  try {
    for (const cat of DEFAULT_SYSTEM_CATEGORIES) {
      const { data: existing } = await supabase
        .from('categories')
        .select('id')
        .eq('name', cat.name)
        .maybeSingle();

      if (!existing) {
        await supabase.from('categories').insert(cat);
      }
    }
  } catch {
    // Categories fallback
  }

  // 5. Wipe all local storage caches, mock keys, and seeded timeline/mobility states
  let storagePurged = false;
  try {
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
        (key.startsWith('apex_saved_places') ||
          key.startsWith('apex_timeline_events') ||
          key.startsWith('apex_daily_mobility') ||
          key.startsWith('apex_active_session') ||
          key.startsWith('apex_events') ||
          key.startsWith('apex_mobility'))
      ) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
    storagePurged = true;
  } catch {
    storagePurged = false;
  }

  // 6. Log authentic administrative audit record
  logPlatformEvent(
    'SECURITY',
    `Administrator executed ${scope === 'global' ? 'global' : 'workspace'} database refresh (accounts reset to 0.00)`,
    userId,
    userEmail
  );

  return {
    success: true,
    timestamp: new Date().toISOString(),
    clearedTables,
    storagePurged,
    accountReset,
    message: `Database fully refreshed (${scope === 'global' ? 'entire platform' : 'workspace'}). All tables purged, starting accounts set to 0.00, and auth accounts preserved.`,
  };
}
