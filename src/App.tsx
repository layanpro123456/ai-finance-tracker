import { useEffect, useState, useCallback } from 'react';
import { supabase } from './supabaseClient';
import type { Account, Category, Transaction, Budget } from './types';
import { AuthModal } from './components/AuthModal';
import { Navbar } from './components/Navbar';
import { MetricCards } from './components/MetricCards';
import { AiTransactionInput } from './components/AiTransactionInput';
import { AccountManager } from './components/AccountManager';
import { TransactionList } from './components/TransactionList';
import { BudgetManager } from './components/BudgetManager';
import { Loader2, ArrowRight } from 'lucide-react';
import type { User } from '@supabase/supabase-js';

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);

  const [activeTab, setActiveTab] = useState<'dashboard' | 'transactions' | 'accounts' | 'budgets'>('dashboard');

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);

  // 1. Check auth status on load
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setAuthChecking(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setAuthChecking(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // 2. Fetch all app data
  const fetchData = useCallback(async () => {
    if (!user) return;
    setDataLoading(true);

    try {
      const currentMonth = new Date().toISOString().slice(0, 7);

      // Fetch accounts
      const { data: accData } = await supabase
        .from('accounts')
        .select('*')
        .order('created_at', { ascending: true });

      // If user has no accounts yet, automatically seed a default primary account
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

      // Fetch categories
      const { data: catData } = await supabase
        .from('categories')
        .select('*')
        .order('name', { ascending: true });
      setCategories(catData || []);

      // Fetch transactions
      const { data: txData } = await supabase
        .from('transactions')
        .select('*, accounts(name, currency), categories(name)')
        .order('transaction_date', { ascending: false })
        .order('created_at', { ascending: false });
      setTransactions(txData || []);

      // Fetch budgets
      const { data: budgetData } = await supabase
        .from('budgets')
        .select('*, categories(name)')
        .eq('month_year', currentMonth);
      setBudgets(budgetData || []);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
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
    await supabase.auth.signOut();
    setUser(null);
  };

  // Auth loading screen
  if (authChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
      </div>
    );
  }

  // If unauthenticated, show Auth Modal
  if (!user) {
    return <AuthModal onSuccess={() => fetchData()} />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-16">
      {/* Top Navbar */}
      <Navbar
        userEmail={user.email || 'User'}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onSignOut={handleSignOut}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        {dataLoading && (
          <div className="flex items-center justify-end text-xs text-slate-500 mb-2 gap-1.5">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
            <span>Syncing database...</span>
          </div>
        )}

        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* Top Financial Metrics */}
            <MetricCards accounts={accounts} transactions={transactions} />

            {/* AI Natural Language Logger */}
            <AiTransactionInput
              userId={user.id}
              accounts={accounts}
              categories={categories}
              onTransactionSaved={fetchData}
            />

            {/* 2-Column Overview */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Recent Transactions (2 cols on desktop) */}
              <div className="lg:col-span-2">
                <div className="flex items-center justify-between mb-3 px-1">
                  <h3 className="text-sm font-semibold text-slate-300">Recent Activity</h3>
                  <button
                    onClick={() => setActiveTab('transactions')}
                    className="text-xs text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1 cursor-pointer"
                  >
                    <span>View all transactions</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
                <TransactionList
                  userId={user.id}
                  transactions={transactions.slice(0, 8)}
                  accounts={accounts}
                  categories={categories}
                  onTransactionsUpdated={fetchData}
                />
              </div>

              {/* Side Column: Accounts & Budgets */}
              <div className="space-y-6">
                <div>
                  <div className="flex items-center justify-between mb-3 px-1">
                    <h3 className="text-sm font-semibold text-slate-300">Your Accounts</h3>
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

        {/* Transactions Tab */}
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

        {/* Accounts Tab */}
        {activeTab === 'accounts' && (
          <div className="space-y-6">
            <AccountManager
              userId={user.id}
              accounts={accounts}
              onAccountUpdated={fetchData}
            />
          </div>
        )}

        {/* Budgets Tab */}
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
      </main>
    </div>
  );
}

export default App;
