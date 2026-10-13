import React, { useState, useMemo } from 'react';
import type { Budget, Category, Transaction } from '../types';
import { supabase } from '../supabaseClient';
import { usePreferences } from '../context/PreferencesContext';
import { CurrencyLogo } from './CurrencyLogo';
import { PieChart, Plus, AlertTriangle, CheckCircle2, X, Loader2, RotateCcw } from 'lucide-react';

interface BudgetManagerProps {
  userId: string;
  budgets: Budget[];
  categories: Category[];
  transactions: Transaction[];
  onBudgetsUpdated: () => void;
}

export const BudgetManager: React.FC<BudgetManagerProps> = ({
  userId,
  budgets,
  categories,
  transactions,
  onBudgetsUpdated,
}) => {
  const currentMonthYear = useMemo(() => new Date().toISOString().slice(0, 7), []); // "YYYY-MM"
  const currentMonthTitle = useMemo(
    () => new Date().toLocaleString('default', { month: 'long', year: 'numeric' }),
    []
  );
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [monthlyLimit, setMonthlyLimit] = useState<number>(500);
  const [loading, setLoading] = useState(false);

  // Filter current month transactions
  const currentMonthExpenses = transactions.filter(
    (t) => t.type === 'expense' && t.transaction_date.startsWith(currentMonthYear)
  );

  // Compute spending per category
  const spendingByCategory = currentMonthExpenses.reduce<Record<string, number>>((acc, t) => {
    if (t.category_id) {
      acc[t.category_id] = (acc[t.category_id] || 0) + Number(t.amount);
    }
    return acc;
  }, {});

  const handleSaveBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCategoryId || !monthlyLimit) return;

    setLoading(true);
    try {
      const { error } = await supabase.from('budgets').upsert(
        {
          user_id: userId,
          category_id: selectedCategoryId,
          monthly_limit: monthlyLimit,
          month_year: currentMonthYear,
        },
        { onConflict: 'user_id,category_id,month_year' }
      );

      if (error) throw error;

      setShowAddModal(false);
      onBudgetsUpdated();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save budget';
      alert(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBudget = async (id: string) => {
    if (!window.confirm('Remove this monthly budget?')) return;
    try {
      const { error } = await supabase.from('budgets').delete().eq('id', id);
      if (error) throw error;
      onBudgetsUpdated();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to remove budget';
      alert(msg);
    }
  };

  const { formatCurrency } = usePreferences();

  // Only expense categories can have budgets
  const expenseCategories = categories.filter((c) => c.type === 'expense');

  const [isResetting, setIsResetting] = useState(false);

  const handleResetBudgets = async () => {
    if (budgets.length === 0) {
      alert('No budgets set for this month.');
      return;
    }
    if (
      !window.confirm(
        `Are you sure you want to reset and delete all ${budgets.length} budget limits for ${currentMonthTitle}? This action cannot be undone.`
      )
    ) {
      return;
    }

    setIsResetting(true);
    try {
      const { error } = await supabase.from('budgets').delete().eq('user_id', userId);
      if (error) throw error;
      onBudgetsUpdated();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to reset budgets';
      alert(msg);
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
            <PieChart className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">Monthly Budgets</h2>
            <p className="text-xs text-slate-400">
              Track category limits for {currentMonthTitle}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleResetBudgets}
            disabled={isResetting || budgets.length === 0}
            title="Reset and clear all monthly budgets"
            className="text-xs font-semibold px-3 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/25 flex items-center gap-1.5 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            {isResetting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RotateCcw className="w-3.5 h-3.5" />
            )}
            <span>Reset Budgets</span>
          </button>

          <button
            onClick={() => {
              if (expenseCategories.length > 0 && !selectedCategoryId) {
                setSelectedCategoryId(expenseCategories[0].id);
              }
              setShowAddModal(true);
            }}
            className="text-xs font-semibold px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 flex items-center gap-1.5 transition shadow-lg shadow-emerald-500/10 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Set Budget</span>
          </button>
        </div>
      </div>

      {budgets.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-slate-800 rounded-xl">
          <PieChart className="w-10 h-10 text-slate-600 mx-auto mb-2" />
          <p className="text-sm text-slate-400 font-medium">No budgets set for this month</p>
          <p className="text-xs text-slate-500 mt-1">
            Define monthly limits for categories like Groceries, Dining, etc.
          </p>
          <button
            onClick={() => {
              if (expenseCategories.length > 0 && !selectedCategoryId) {
                setSelectedCategoryId(expenseCategories[0].id);
              }
              setShowAddModal(true);
            }}
            className="mt-4 text-xs font-semibold px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 transition cursor-pointer"
          >
            + Create First Budget
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {budgets.map((b) => {
            const categoryName = b.categories?.name || 'Category';
            const spent = spendingByCategory[b.category_id] || 0;
            const limit = Number(b.monthly_limit);
            const percent = Math.min(Math.round((spent / limit) * 100), 100);
            const isExceeded = spent > limit;

            return (
              <div
                key={b.id}
                className="bg-slate-950 border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white text-sm">{categoryName}</span>
                    {isExceeded ? (
                      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 font-medium">
                        <AlertTriangle className="w-3 h-3" />
                        Exceeded by {formatCurrency(spent - limit)}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                        <CheckCircle2 className="w-3 h-3" />
                        {100 - percent}% remaining
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-400">
                      <strong className="text-white">{formatCurrency(spent)}</strong> / {formatCurrency(limit)}
                    </span>
                    <button
                      onClick={() => handleDeleteBudget(b.id)}
                      className="text-slate-600 hover:text-rose-400 p-1 cursor-pointer transition"
                      title="Remove budget"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      isExceeded
                        ? 'bg-rose-500'
                        : percent > 75
                        ? 'bg-amber-400'
                        : 'bg-emerald-500'
                    }`}
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Budget Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-md max-h-[90vh] overflow-y-auto bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">Set Monthly Budget</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveBudget} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Category
                </label>
                <select
                  value={selectedCategoryId}
                  onChange={(e) => setSelectedCategoryId(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                >
                  {expenseCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1.5">
                  <span>Monthly Limit</span>
                  <CurrencyLogo variant="badge" />
                </label>
                <div className="relative">
                  <CurrencyLogo variant="input-prefix" />
                  <input
                    type="number"
                    step="10"
                    required
                    value={monthlyLimit}
                    onChange={(e) => setMonthlyLimit(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-8 pr-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="text-xs px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="text-xs px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold flex items-center gap-2 transition disabled:opacity-50 cursor-pointer shadow-lg shadow-emerald-500/20"
                >
                  {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Budget</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
