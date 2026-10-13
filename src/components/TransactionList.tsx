import React, { useState } from 'react';
import type { Transaction, Account, Category } from '../types';
import { supabase } from '../supabaseClient';
import {
  Receipt,
  Search,
  Trash2,
  Plus,
  Sparkles,
  ArrowDownLeft,
  ArrowUpRight,
  Calendar,
  X,
  Loader2,
} from 'lucide-react';

interface TransactionListProps {
  userId: string;
  transactions: Transaction[];
  accounts: Account[];
  categories: Category[];
  onTransactionsUpdated: () => void;
}

export const TransactionList: React.FC<TransactionListProps> = ({
  userId,
  transactions,
  accounts,
  categories,
  onTransactionsUpdated,
}) => {
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all');

  // Manual transaction modal state
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualAmount, setManualAmount] = useState<number>(0);
  const [manualType, setManualType] = useState<'income' | 'expense'>('expense');
  const [manualDescription, setManualDescription] = useState('');
  const [manualAccountId, setManualAccountId] = useState('');
  const [manualCategoryId, setManualCategoryId] = useState('');
  const [manualDate, setManualDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [isSubmittingManual, setIsSubmittingManual] = useState(false);

  const filteredTransactions = transactions.filter((t) => {
    if (filterType !== 'all' && t.type !== filterType) return false;
    if (selectedCategoryFilter !== 'all' && t.category_id !== selectedCategoryFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const descMatch = t.description?.toLowerCase().includes(q);
      const promptMatch = t.raw_prompt?.toLowerCase().includes(q);
      if (!descMatch && !promptMatch) return false;
    }
    return true;
  });

  const handleDelete = async (t: Transaction) => {
    if (!window.confirm(`Delete "${t.description}"?`)) return;

    try {
      // 1. Delete transaction
      const { error: delError } = await supabase.from('transactions').delete().eq('id', t.id);
      if (delError) throw delError;

      // 2. Reverse account balance
      const account = accounts.find((a) => a.id === t.account_id);
      if (account) {
        // If it was income, deleting it reduces balance. If it was expense, deleting it increases balance.
        const delta = t.type === 'income' ? -Number(t.amount) : Number(t.amount);
        const newBalance = Number(account.balance) + delta;
        await supabase.from('accounts').update({ balance: newBalance }).eq('id', t.account_id);
      }

      onTransactionsUpdated();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete transaction';
      alert(msg);
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualAccountId || !manualAmount) return;

    setIsSubmittingManual(true);
    try {
      const { error: insertError } = await supabase.from('transactions').insert({
        user_id: userId,
        account_id: manualAccountId,
        category_id: manualCategoryId || null,
        amount: manualAmount,
        type: manualType,
        description: manualDescription || 'Transaction',
        transaction_date: manualDate,
      });

      if (insertError) throw insertError;

      // Update account balance
      const account = accounts.find((a) => a.id === manualAccountId);
      if (account) {
        const delta = manualType === 'income' ? manualAmount : -manualAmount;
        const newBalance = Number(account.balance) + delta;
        await supabase.from('accounts').update({ balance: newBalance }).eq('id', manualAccountId);
      }

      setShowManualModal(false);
      setManualDescription('');
      setManualAmount(0);
      onTransactionsUpdated();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save transaction';
      alert(msg);
    } finally {
      setIsSubmittingManual(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
            <Receipt className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">Transaction History</h2>
            <p className="text-xs text-slate-400">
              {transactions.length} total entries recorded
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            if (accounts.length > 0 && !manualAccountId) {
              setManualAccountId(accounts[0].id);
            }
            if (categories.length > 0 && !manualCategoryId) {
              setManualCategoryId(categories[0].id);
            }
            setShowManualModal(true);
          }}
          className="text-xs font-semibold px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1.5 transition cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Manual Entry</span>
        </button>
      </div>

      {/* Filter and search bar */}
      <div className="flex flex-col md:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by description or prompt..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Type Toggle */}
          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => setFilterType('all')}
              className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                filterType === 'all' ? 'bg-slate-800 text-white font-medium' : 'text-slate-400'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilterType('income')}
              className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                filterType === 'income' ? 'bg-emerald-500/20 text-emerald-400 font-medium' : 'text-slate-400'
              }`}
            >
              Income
            </button>
            <button
              onClick={() => setFilterType('expense')}
              className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                filterType === 'expense' ? 'bg-rose-500/20 text-rose-400 font-medium' : 'text-slate-400'
              }`}
            >
              Expense
            </button>
          </div>

          {/* Category Filter */}
          <div className="relative">
            <select
              value={selectedCategoryFilter}
              onChange={(e) => setSelectedCategoryFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="all">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Transactions List */}
      {filteredTransactions.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-slate-800 rounded-xl">
          <Receipt className="w-10 h-10 text-slate-600 mx-auto mb-2" />
          <p className="text-sm text-slate-400 font-medium">No transactions found</p>
          <p className="text-xs text-slate-500 mt-1">
            {transactions.length === 0
              ? 'Use the AI input above to log your first transaction!'
              : 'Try clearing your active filters.'}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-slate-800/80">
          {filteredTransactions.map((t) => {
            const isIncome = t.type === 'income';
            const categoryName = t.categories?.name || 'Uncategorized';
            const accountName = t.accounts?.name || 'Account';

            return (
              <div
                key={t.id}
                className="py-3.5 flex items-center justify-between gap-4 hover:bg-slate-850/40 px-2 rounded-xl transition"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`p-2.5 rounded-xl flex-shrink-0 ${
                      isIncome
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                    }`}
                  >
                    {isIncome ? (
                      <ArrowDownLeft className="w-4 h-4" />
                    ) : (
                      <ArrowUpRight className="w-4 h-4" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-white text-sm truncate">
                        {t.description || 'Transaction'}
                      </span>
                      {t.raw_prompt && (
                        <span
                          title={`Parsed from prompt: "${t.raw_prompt}"`}
                          className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium"
                        >
                          <Sparkles className="w-2.5 h-2.5" />
                          AI
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-medium text-[11px]">
                        {categoryName}
                      </span>
                      <span>•</span>
                      <span>{accountName}</span>
                      <span>•</span>
                      <span className="flex items-center gap-1 text-slate-500">
                        <Calendar className="w-3 h-3" />
                        {t.transaction_date}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 flex-shrink-0">
                  <span
                    className={`font-bold text-sm sm:text-base ${
                      isIncome ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {isIncome ? '+' : '-'}
                    {formatCurrency(Number(t.amount))}
                  </span>
                  <button
                    onClick={() => handleDelete(t)}
                    title="Delete transaction"
                    className="text-slate-600 hover:text-rose-400 p-1.5 rounded-lg hover:bg-slate-800 transition cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Manual Entry Modal */}
      {showManualModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">Manual Transaction Entry</h3>
              <button
                onClick={() => setShowManualModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleManualSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Description
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dinner, Rent, Freelance Payment"
                  value={manualDescription}
                  onChange={(e) => setManualDescription(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                    Amount ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={manualAmount}
                    onChange={(e) => setManualAmount(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                    Type
                  </label>
                  <select
                    value={manualType}
                    onChange={(e) => setManualType(e.target.value as 'income' | 'expense')}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  >
                    <option value="expense">Expense (-)</option>
                    <option value="income">Income (+)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Account
                </label>
                <select
                  required
                  value={manualAccountId}
                  onChange={(e) => setManualAccountId(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} (${Number(a.balance).toFixed(2)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                    Category
                  </label>
                  <select
                    value={manualCategoryId}
                    onChange={(e) => setManualCategoryId(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    required
                    value={manualDate}
                    onChange={(e) => setManualDate(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowManualModal(false)}
                  className="text-xs px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingManual}
                  className="text-xs px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold flex items-center gap-2 transition disabled:opacity-50 cursor-pointer shadow-lg shadow-emerald-500/20"
                >
                  {isSubmittingManual && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Entry</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
