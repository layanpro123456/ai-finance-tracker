import { useEffect, useState, useCallback } from 'react';
import { supabase } from './supabaseClient';
import type {
  Account,
  Category,
  Transaction,
  Budget,
  Task,
  PersonalAsset,
  Subscription,
  ContactsLedger,
} from './types';
import { AuthModal } from './components/AuthModal';
import { Navbar, type ErpTab } from './components/Navbar';
import { MetricCards } from './components/MetricCards';
import { AiTransactionInput } from './components/AiTransactionInput';
import { AccountManager } from './components/AccountManager';
import { TransactionList } from './components/TransactionList';
import { BudgetManager } from './components/BudgetManager';
import { TaskManager } from './components/TaskManager';
import { AssetManager } from './components/AssetManager';
import { SubscriptionManager } from './components/SubscriptionManager';
import { ContactsLedgerManager } from './components/ContactsLedgerManager';
import { HelpGuide } from './components/HelpGuide';
import { LocationTimelineManager } from './components/LocationTimelineManager';
import { ProximityAlertBanner } from './components/ProximityAlertBanner';
import {
  evaluateProximityAlerts,
  loadSavedPlaces,
  DEFAULT_ANCHOR_COORDS,
} from './services/locationMobilityService';
import type { ProximityAlert } from './types';
import { AdminPortal } from './components/AdminPortal';
import { AdminAuthModal } from './components/AdminAuthModal';
import { isUserAdminSession, logPlatformEvent } from './services/adminTelemetry';
import {
  checkDeviceSessionValidity,
  terminateDeviceSession,
  getDeviceId,
} from './services/deviceSessionService';

import { usePreferences } from './context/PreferencesContext';
import {
  Loader2,
  ArrowRight,
  CheckSquare,
  CreditCard,
} from 'lucide-react';
import type { User } from '@supabase/supabase-js';

export function App() {

  const { formatCurrency, formatDate } = usePreferences();
  const [user, setUser] = useState<User | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);

  const [activeTab, setActiveTab] = useState<ErpTab>('dashboard');
  const [isAdmin, setIsAdmin] = useState<boolean>(() => isUserAdminSession());
  const [isAdminAuthModalOpen, setIsAdminAuthModalOpen] = useState(false);

  // Core Financial State
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);

  // Personal ERP Expansion State
  const [tasks, setTasks] = useState<Task[]>([]);
  const [assets, setAssets] = useState<PersonalAsset[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [contactsLedger, setContactsLedger] = useState<ContactsLedger[]>([]);

  // Location Timeline & Proximity Alerts State
  const [dismissedAlertPlaces, setDismissedAlertPlaces] = useState<Set<string>>(new Set());
  const [activeAlerts, setActiveAlerts] = useState<ProximityAlert[]>([]);

  const handleDismissAlert = (placeId: string) => {
    setDismissedAlertPlaces((prev) => new Set(prev).add(placeId));
    setActiveAlerts((prev) => prev.filter((a) => a.placeId !== placeId));
  };

  // Single Active Device Session State
  const [deviceKickoutNotice, setDeviceKickoutNotice] = useState<{ activeDeviceName: string } | null>(null);


  // 1. Check auth status on load & enforce single-device session
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const currentUser = session?.user ?? null;
      if (currentUser) {
        // Enforce single-device ownership
        const validity = await checkDeviceSessionValidity(currentUser.id);
        if (!validity.isValid) {
          setDeviceKickoutNotice({
            activeDeviceName: validity.activeDeviceName || 'Another Device',
          });
          await supabase.auth.signOut();
          setUser(null);
          setAuthChecking(false);
          return;
        }

        if (currentUser.email?.toLowerCase().includes('admin') || isUserAdminSession()) {
          setIsAdmin(true);
        }
        logPlatformEvent('AUTH', 'User session active on Apex LifeOS', currentUser.id, currentUser.email || undefined);
      }
      setUser(currentUser);
      setAuthChecking(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const currentUser = session?.user ?? null;
      if (currentUser) {
        const validity = await checkDeviceSessionValidity(currentUser.id);
        if (!validity.isValid) {
          setDeviceKickoutNotice({
            activeDeviceName: validity.activeDeviceName || 'Another Device',
          });
          await supabase.auth.signOut();
          setUser(null);
          setAuthChecking(false);
          return;
        }

        if (currentUser.email?.toLowerCase().includes('admin') || isUserAdminSession()) {
          setIsAdmin(true);
        }
      }
      setUser(currentUser);
      setAuthChecking(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // 2. Periodic Single-Device Enforcement Heartbeat & Visibility Check
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(async () => {
      const validity = await checkDeviceSessionValidity(user.id);
      if (!validity.isValid) {
        setDeviceKickoutNotice({
          activeDeviceName: validity.activeDeviceName || 'Another Device',
        });
        await supabase.auth.signOut();
        setUser(null);
      }
    }, 20000); // Check every 20 seconds

    const handleFocus = async () => {
      if (document.visibilityState === 'visible' && user) {
        const validity = await checkDeviceSessionValidity(user.id);
        if (!validity.isValid) {
          setDeviceKickoutNotice({
            activeDeviceName: validity.activeDeviceName || 'Another Device',
          });
          await supabase.auth.signOut();
          setUser(null);
        }
      }
    };

    document.addEventListener('visibilitychange', handleFocus);
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleFocus);
      window.removeEventListener('focus', handleFocus);
    };
  }, [user]);


  // 2. Fetch all app and ERP data
  const fetchData = useCallback(async () => {
    if (!user) return;
    setDataLoading(true);

    try {
      const currentMonth = new Date().toISOString().slice(0, 7);

      // A. Fetch accounts
      const { data: accData } = await supabase
        .from('accounts')
        .select('*')
        .order('created_at', { ascending: true });

      if (accData && accData.length === 0) {
        const { data: newAcc } = await supabase
          .from('accounts')
          .insert({
            user_id: user.id,
            name: 'Primary Checking',
            balance: 1000.0,
            currency: 'USD',
          })
          .select('*')
          .single();

        setAccounts(newAcc ? [newAcc] : []);
      } else {
        setAccounts(accData || []);
      }

      // B. Fetch categories
      const { data: catData } = await supabase
        .from('categories')
        .select('*')
        .order('name', { ascending: true });
      setCategories(catData || []);

      // C. Fetch transactions
      const { data: txData } = await supabase
        .from('transactions')
        .select('*, accounts(name, currency), categories(name)')
        .order('transaction_date', { ascending: false })
        .order('created_at', { ascending: false });
      setTransactions(txData || []);

      // D. Fetch budgets
      const { data: budgetData } = await supabase
        .from('budgets')
        .select('*, categories(name)')
        .eq('month_year', currentMonth);
      setBudgets(budgetData || []);

      // E. Personal ERP: Fetch Tasks (graceful fallback if table not yet migrated)
      let fetchedTasks: Task[] = [];
      try {
        const { data: taskData, error: taskErr } = await supabase
          .from('tasks')
          .select('*, categories(name), accounts(name, currency)')
          .order('due_date', { ascending: true, nullsFirst: false })
          .order('created_at', { ascending: false });

        if (taskErr) {
          console.warn('Tasks table unavailable:', taskErr);
        } else {
          fetchedTasks = (taskData || []) as Task[];
          setTasks(fetchedTasks);
        }
      } catch (e) {
        console.warn('Tasks table unavailable:', e);
      }

      // F. Personal ERP: Fetch Assets
      try {
        const { data: assetData } = await supabase
          .from('personal_assets')
          .select('*')
          .order('current_value', { ascending: false });
        setAssets(assetData || []);
      } catch (e) {
        console.warn('Assets table unavailable:', e);
      }

      // G. Personal ERP: Fetch Subscriptions
      try {
        const { data: subData } = await supabase
          .from('subscriptions')
          .select('*, categories(name), accounts(name, currency)')
          .order('next_billing_date', { ascending: true });
        setSubscriptions(subData || []);
      } catch (e) {
        console.warn('Subscriptions table unavailable:', e);
      }

      // H. Personal ERP: Fetch Contacts Ledger
      let fetchedLedger: ContactsLedger[] = [];
      try {
        const { data: ledgerData } = await supabase
          .from('contacts_ledger')
          .select('*')
          .order('created_at', { ascending: false });
        fetchedLedger = (ledgerData || []) as ContactsLedger[];
        setContactsLedger(fetchedLedger);
      } catch (e) {
        console.warn('Contacts ledger table unavailable:', e);
      }

      // I. Personal ERP: Fetch Saved Places & Check Proximity Alerts (Device-Bound)
      try {
        const loadedPlaces = await loadSavedPlaces(user.id, getDeviceId());
        const alerts = evaluateProximityAlerts(
          DEFAULT_ANCHOR_COORDS,
          loadedPlaces,
          dismissedAlertPlaces,
          budgetData || [],
          fetchedTasks || [],
          fetchedLedger || []
        );
        setActiveAlerts(alerts);
      } catch (e) {
        console.warn('Saved places unavailable:', e);
      }
    } catch (err) {
      console.error('Error fetching ERP dashboard data:', err);
    } finally {
      setDataLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user, fetchData]);

  const handleSignOut = async () => {
    if (user) {
      await terminateDeviceSession(user.id);
    }
    await supabase.auth.signOut();
    setUser(null);
    setDeviceKickoutNotice(null);
  };

  // Auth loading screen
  if (authChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
      </div>
    );
  }

  // If unauthenticated, show Auth Modal with conflict notice if applicable
  if (!user) {
    return (
      <AuthModal
        onSuccess={() => {
          setDeviceKickoutNotice(null);
          fetchData();
        }}
        initialConflictNotice={deviceKickoutNotice}
      />
    );
  }


  // Active Pending Tasks Count
  const pendingTasks = tasks.filter((t) => t.status !== 'completed');
  const pendingBills = pendingTasks.filter((t) => t.is_financial && t.financial_type === 'payable');
  const activeSubs = subscriptions.filter((s) => s.is_active);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-16">
      {/* Top ERP Navbar */}
      <Navbar
        userEmail={user.email || 'User'}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onSignOut={handleSignOut}
        isAdmin={isAdmin}
        onOpenAdminAuth={() => setIsAdminAuthModalOpen(true)}
        activeAlertCount={activeAlerts.length}
      />

      {/* Global Proximity Payment Alert Banner */}
      <ProximityAlertBanner
        alerts={activeAlerts}
        onDismissAlert={handleDismissAlert}
        onNavigateToTab={setActiveTab}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        {dataLoading && (
          <div className="flex items-center justify-end text-xs text-slate-500 mb-2 gap-1.5">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
            <span>Syncing ERP ledger...</span>
          </div>
        )}



        {/* ========================================================================= */}
        {/* EXECUTIVE DASHBOARD (OVERVIEW) */}
        {/* ========================================================================= */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* Top Comprehensive Metrics */}
            <MetricCards
              accounts={accounts}
              transactions={transactions}
              assets={assets}
              contactsLedger={contactsLedger}
              tasks={tasks}
            />

            {/* AI Natural Language Logger */}
            <AiTransactionInput
              userId={user.id}
              accounts={accounts}
              categories={categories}
              onTransactionSaved={fetchData}
            />

            {/* Cross-Module Operations Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left 2 Columns: Recent Transactions & Pending ERP Operations */}
              <div className="lg:col-span-2 space-y-6">
                {/* 1. Daily Agenda & Pending Bills */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl">
                        <CheckSquare className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-white">Daily Tasks &amp; Bill Reminders</h3>
                        <p className="text-xs text-slate-400">
                          {pendingTasks.length} active tasks • {pendingBills.length} upcoming bills
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setActiveTab('tasks')}
                      className="text-xs text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1 cursor-pointer"
                    >
                      <span>Open Operations</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>

                  {pendingTasks.length === 0 ? (
                    <p className="text-xs text-slate-500 py-3 text-center">
                      No pending tasks today. You are all caught up!
                    </p>
                  ) : (
                    <div className="divide-y divide-slate-800">
                      {pendingTasks.slice(0, 4).map((task) => (
                        <div
                          key={task.id}
                          className="py-2.5 flex items-center justify-between text-xs gap-3"
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                            <span className="font-medium text-slate-200 truncate">{task.title}</span>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {task.is_financial && (
                              <span
                                className={`font-semibold px-2 py-0.5 rounded ${
                                  task.financial_type === 'receivable'
                                    ? 'bg-emerald-500/10 text-emerald-400'
                                    : 'bg-rose-500/10 text-rose-400'
                                }`}
                              >
                                {task.financial_type === 'receivable' ? '+' : '-'}
                                {formatCurrency(Number(task.amount))}
                              </span>
                            )}
                            {task.due_date && (
                              <span className="text-slate-500">
                                {formatDate(task.due_date)}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 2. Recent Transactions */}
                <div>
                  <div className="flex items-center justify-between mb-3 px-1">
                    <h3 className="text-sm font-semibold text-slate-300">Recent Financial Activity</h3>
                    <button
                      onClick={() => setActiveTab('transactions')}
                      className="text-xs text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1 cursor-pointer"
                    >
                      <span>View full ledger</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                  <TransactionList
                    userId={user.id}
                    transactions={transactions.slice(0, 6)}
                    accounts={accounts}
                    categories={categories}
                    onTransactionsUpdated={fetchData}
                  />
                </div>
              </div>

              {/* Right Column: Accounts, Subscriptions, and Quick Widgets */}
              <div className="space-y-6">
                {/* Accounts Manager */}
                <div>
                  <div className="flex items-center justify-between mb-3 px-1">
                    <h3 className="text-sm font-semibold text-slate-300">Bank &amp; Cash Accounts</h3>
                    <button
                      onClick={() => setActiveTab('accounts')}
                      className="text-xs text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1 cursor-pointer"
                    >
                      <span>Manage</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                  <AccountManager
                    userId={user.id}
                    accounts={accounts}
                    onAccountUpdated={fetchData}
                  />
                </div>

                {/* Subscriptions Glance */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-rose-500/10 text-rose-400 rounded-xl">
                        <CreditCard className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-white">Active Subscriptions</h3>
                        <p className="text-xs text-slate-400">{activeSubs.length} ongoing services</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setActiveTab('subscriptions')}
                      className="text-xs text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1 cursor-pointer"
                    >
                      <span>Details</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>

                  {activeSubs.length === 0 ? (
                    <p className="text-xs text-slate-500 py-2">No recurring subscriptions added yet.</p>
                  ) : (
                    <div className="space-y-2 mt-2">
                      {activeSubs.slice(0, 3).map((sub) => (
                        <div
                          key={sub.id}
                          className="flex items-center justify-between text-xs p-2 rounded-lg bg-slate-950 border border-slate-850"
                        >
                          <span className="font-medium text-slate-200">{sub.name}</span>
                          <span className="font-bold text-white">
                            {formatCurrency(Number(sub.cost))}
                            <span className="text-[10px] text-slate-500 font-normal">
                              /{sub.billing_cycle === 'monthly' ? 'mo' : 'yr'}
                            </span>
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Budgets */}
                <div>
                  <div className="flex items-center justify-between mb-3 px-1">
                    <h3 className="text-sm font-semibold text-slate-300">Monthly Budgets</h3>
                    <button
                      onClick={() => setActiveTab('budgets')}
                      className="text-xs text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1 cursor-pointer"
                    >
                      <span>Details</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                  <BudgetManager
                    userId={user.id}
                    budgets={budgets}
                    categories={categories}
                    transactions={transactions}
                    onBudgetsUpdated={fetchData}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* DAILY TASKS & OPERATIONS TAB */}
        {/* ========================================================================= */}
        {activeTab === 'tasks' && (
          <TaskManager
            userId={user.id}
            tasks={tasks}
            accounts={accounts}
            categories={categories}
            onTasksUpdated={fetchData}
          />
        )}

        {/* ========================================================================= */}
        {/* FINANCIAL TRANSACTIONS LEDGER TAB */}
        {/* ========================================================================= */}
        {activeTab === 'transactions' && (
          <div className="space-y-6">
            <TransactionList
              userId={user.id}
              transactions={transactions}
              accounts={accounts}
              categories={categories}
              onTransactionsUpdated={fetchData}
            />
          </div>
        )}

        {/* ========================================================================= */}
        {/* ACCOUNTS TAB */}
        {/* ========================================================================= */}
        {activeTab === 'accounts' && (
          <div className="space-y-6">
            <AccountManager
              userId={user.id}
              accounts={accounts}
              onAccountUpdated={fetchData}
            />
          </div>
        )}

        {/* ========================================================================= */}
        {/* BUDGETS TAB */}
        {/* ========================================================================= */}
        {activeTab === 'budgets' && (
          <div className="space-y-6">
            <BudgetManager
              userId={user.id}
              budgets={budgets}
              categories={categories}
              transactions={transactions}
              onBudgetsUpdated={fetchData}
            />
          </div>
        )}

        {/* ========================================================================= */}
        {/* PERSONAL ASSETS & INVENTORY TAB */}
        {/* ========================================================================= */}
        {activeTab === 'assets' && (
          <AssetManager
            userId={user.id}
            assets={assets}
            onAssetsUpdated={fetchData}
          />
        )}

        {/* ========================================================================= */}
        {/* SUBSCRIPTIONS TAB */}
        {/* ========================================================================= */}
        {activeTab === 'subscriptions' && (
          <SubscriptionManager
            userId={user.id}
            subscriptions={subscriptions}
            accounts={accounts}
            categories={categories}
            onSubscriptionsUpdated={fetchData}
          />
        )}

        {/* ========================================================================= */}
        {/* SOCIAL LEDGER (P2P DEBTS) TAB */}
        {/* ========================================================================= */}
        {activeTab === 'contacts' && (
          <ContactsLedgerManager
            userId={user.id}
            contactsLedger={contactsLedger}
            accounts={accounts}
            onLedgerUpdated={fetchData}
          />
        )}

        {/* ========================================================================= */}
        {/* LOCATION TIMELINE & MOBILITY TAB */}
        {/* ========================================================================= */}
        {activeTab === 'timeline' && (
          <LocationTimelineManager
            userId={user.id}
            accounts={accounts}
            categories={categories}
            budgets={budgets}
            tasks={tasks}
            contactsLedger={contactsLedger}
            onTransactionsUpdated={fetchData}
            onTasksUpdated={fetchData}
          />
        )}

        {/* ========================================================================= */}
        {/* HELP & DOCUMENTATION MODULE TAB */}
        {/* ========================================================================= */}
        {activeTab === 'help' && (
          <HelpGuide onNavigateTab={setActiveTab} />
        )}

        {/* ========================================================================= */}
        {/* EXECUTIVE ADMIN CONSOLE TAB */}
        {/* ========================================================================= */}
        {activeTab === 'admin' && (
          <AdminPortal
            currentUserId={user.id}
            currentUserEmail={user.email || undefined}
            userStats={{
              transactionsCount: transactions.length,
              accountsCount: accounts.length,
              tasksCount: tasks.length,
              subsCount: subscriptions.length,
            }}
            onLockSession={() => {
              setIsAdmin(false);
              setActiveTab('dashboard');
            }}
          />
        )}
      </main>

      {/* Admin Passkey Verification Modal */}
      <AdminAuthModal
        isOpen={isAdminAuthModalOpen}
        onClose={() => setIsAdminAuthModalOpen(false)}
        onAuthorized={() => {
          setIsAdmin(true);
          setActiveTab('admin');
        }}
      />
    </div>
  );
}

export default App;
