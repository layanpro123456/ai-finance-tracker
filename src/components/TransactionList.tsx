import React, { useState, useMemo } from 'react';
import type { Transaction, Account, Category } from '../types';
import { supabase } from '../supabaseClient';
import { usePreferences } from '../context/PreferencesContext';
import { useAlert } from '../context/AlertContext';
import { UiAlert } from './UiAlert';
import {
  Receipt,
  Search,
  Plus,
  Sparkles,
  ArrowDownLeft,
  ArrowUpRight,
  Calendar,
  X,
  Loader2,
  RotateCcw,
  CheckCircle2,
  Edit3,
  ArrowRight,
} from 'lucide-react';
import { CurrencyLogo } from './CurrencyLogo';
import {
  undoAccountTransaction,
  previewTransactionUndo,
  previewTransactionUpdate,
  updateAccountTransaction,
  type UndoPreview,
  type UpdatePreview,
} from '../services/transactionUndoService';

interface TransactionListProps {
  userId: string;
  userEmail?: string;
  transactions: Transaction[];
  accounts: Account[];
  categories: Category[];
  onTransactionsUpdated: () => void;
}

export const TransactionList: React.FC<TransactionListProps> = ({
  userId,
  userEmail,
  transactions,
  accounts,
  categories,
  onTransactionsUpdated,
}) => {
  const { showError, showWarning, showSuccess } = useAlert();
  const { formatCurrency, formatDate } = usePreferences();

  const [manualError, setManualError] = useState<string | null>(null);
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

  // Edit transaction modal state
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editDescription, setEditDescription] = useState('');
  const [editAmount, setEditAmount] = useState<number>(0);
  const [editType, setEditType] = useState<'income' | 'expense'>('expense');
  const [editAccountId, setEditAccountId] = useState('');
  const [editCategoryId, setEditCategoryId] = useState('');
  const [editDate, setEditDate] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Undo transaction state
  const [undoTargetTx, setUndoTargetTx] = useState<Transaction | null>(null);
  const [undoPreview, setUndoPreview] = useState<UndoPreview | null>(null);
  const [isUndoing, setIsUndoing] = useState(false);
  const [undoFeedback, setUndoFeedback] = useState<string | null>(null);

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

  const handleInitiateUndo = (t: Transaction) => {
    const account = accounts.find((a) => a.id === t.account_id);
    const currentBal = account ? Number(account.balance) : 0;
    const preview = previewTransactionUndo(t, currentBal);
    setUndoTargetTx(t);
    setUndoPreview(preview);
    setUndoFeedback(null);
  };

  const handleConfirmUndo = async () => {
    if (!undoTargetTx) return;

    setIsUndoing(true);
    try {
      const account = accounts.find((a) => a.id === undoTargetTx.account_id);
      const res = await undoAccountTransaction(undoTargetTx, account, {
        userId,
        userEmail,
        isAdminAction: false,
      });

      setUndoFeedback(res.message);
      setUndoTargetTx(null);
      setUndoPreview(null);
      onTransactionsUpdated();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to undo transaction';
      showError(msg, 'Transaction Undo Failed');
    } finally {
      setIsUndoing(false);
    }
  };

  const handleInitiateEdit = (t: Transaction) => {
    setEditingTx(t);
    setEditDescription(t.description || '');
    setEditAmount(Number(t.amount) || 0);
    setEditType(t.type);
    setEditAccountId(t.account_id);
    setEditCategoryId(t.category_id || '');
    setEditDate(t.transaction_date || new Date().toISOString().split('T')[0]);
    setEditError(null);
    setShowEditModal(true);
  };

  // Compute live balance projection preview for editing modal
  const editPreview: UpdatePreview | null = useMemo(() => {
    if (!editingTx || !editAccountId) return null;
    const oldAcc = accounts.find((a) => a.id === editingTx.account_id);
    const newAcc = accounts.find((a) => a.id === editAccountId);
    const oldBal = oldAcc ? Number(oldAcc.balance) : 0;
    const newBal = newAcc ? Number(newAcc.balance) : 0;

    return previewTransactionUpdate(
      editingTx,
      editAmount,
      editType,
      editAccountId,
      oldBal,
      newBal
    );
  }, [editingTx, editAmount, editType, editAccountId, accounts]);

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTx) return;

    if (!editAccountId) {
      setEditError('Please select an account.');
      return;
    }
    if (!editAmount || editAmount <= 0) {
      setEditError('Please enter an amount greater than zero.');
      return;
    }
    setEditError(null);
    setIsSavingEdit(true);

    try {
      await updateAccountTransaction({
        transactionId: editingTx.id,
        originalTransaction: editingTx,
        newDescription: editDescription || 'Transaction',
        newAmount: editAmount,
        newType: editType,
        newAccountId: editAccountId,
        newCategoryId: editCategoryId || null,
        newTransactionDate: editDate,
        accountsFallback: accounts,
        operator: {
          userId,
          userEmail,
          isAdminAction: false,
        },
      });

      setShowEditModal(false);
      setEditingTx(null);
      showSuccess(`Transaction "${editDescription || 'Transaction'}" updated and saved.`);
      onTransactionsUpdated();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update transaction';
      setEditError(msg);
      showError(msg, 'Transaction Update Failed');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualAccountId) {
      setManualError('Please select a payment account.');
      return;
    }
    if (!manualAmount || manualAmount <= 0) {
      setManualError('Please enter an amount greater than zero.');
      return;
    }
    setManualError(null);

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
      showSuccess('Transaction recorded successfully.');
      onTransactionsUpdated();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save transaction';
      setManualError(msg);
      showError(msg, 'Transaction Save Failed');
    } finally {
      setIsSubmittingManual(false);
    }
  };

  const [isResetting, setIsResetting] = useState(false);

  const handleResetTransactions = async () => {
    if (transactions.length === 0) {
      showWarning('No transactions to reset.', 'Empty Ledger');
      return;
    }
    if (
      !window.confirm(
        `Are you sure you want to reset and delete all ${transactions.length} transaction entries? This action cannot be undone.`
      )
    ) {
      return;
    }

    setIsResetting(true);
    try {
      const { error } = await supabase.from('transactions').delete().eq('user_id', userId);
      if (error) throw error;
      onTransactionsUpdated();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to reset transactions';
      showError(msg, 'Transaction Reset Failed');
    } finally {
      setIsResetting(false);
    }
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
              {transactions.length} total entries recorded &bull; Edit transaction details &bull; Undo transaction-wise
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleResetTransactions}
            disabled={isResetting || transactions.length === 0}
            title="Reset and clear all transaction history records"
            className="text-xs font-semibold px-3 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/25 flex items-center gap-1.5 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            {isResetting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RotateCcw className="w-3.5 h-3.5" />
            )}
            <span>Reset Transactions</span>
          </button>

          <button
            onClick={() => {
              if (accounts.length > 0 && !manualAccountId) {
                setManualAccountId(accounts[0].id);
              }
              if (categories.length > 0 && !manualCategoryId) {
                setManualCategoryId(categories[0].id);
              }
              setManualError(null);
              setShowManualModal(true);
            }}
            className="text-xs font-semibold px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1.5 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Manual Entry</span>
          </button>
        </div>
      </div>

      {/* Undo Feedback Notice */}
      {undoFeedback && (
        <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>{undoFeedback}</span>
          </div>
          <button
            onClick={() => setUndoFeedback(null)}
            className="text-slate-400 hover:text-white text-[11px] cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Active Undo Confirmation Banner */}
      {undoTargetTx && undoPreview && (
        <div className="mb-5 p-4 rounded-2xl bg-purple-950/40 border border-purple-500/30 text-xs space-y-3 animate-fadeIn">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-purple-300 text-sm">
              <RotateCcw className="w-4 h-4 text-purple-400" />
              <span>Undo Transaction &bull; Balance Reversal Confirmation</span>
            </div>
            <button
              onClick={() => {
                setUndoTargetTx(null);
                setUndoPreview(null);
              }}
              className="text-slate-400 hover:text-white text-xs cursor-pointer"
            >
              Cancel
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-slate-500 block text-[10px] uppercase font-semibold">Description</span>
              <span className="text-white font-semibold truncate block">{undoTargetTx.description}</span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-slate-500 block text-[10px] uppercase font-semibold">Account</span>
              <span className="text-white font-semibold truncate block">{undoTargetTx.accounts?.name || 'Account'}</span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-slate-500 block text-[10px] uppercase font-semibold">Current Balance</span>
              <span className="text-slate-300 font-mono font-bold">
                {formatCurrency(undoPreview.previousBalance)}
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-950 border border-purple-500/40">
              <span className="text-purple-400 block text-[10px] uppercase font-semibold">Resulting Balance</span>
              <span className="text-white font-mono font-bold">
                {formatCurrency(undoPreview.projectedBalance)}
              </span>
            </div>
          </div>

          <p className="text-slate-300 text-[11px]">
            {undoPreview.actionDescription}. The transaction will be removed from your ledger and associated ERP links cleared.
          </p>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              disabled={isUndoing}
              onClick={() => {
                setUndoTargetTx(null);
                setUndoPreview(null);
              }}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold cursor-pointer text-xs"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isUndoing}
              onClick={handleConfirmUndo}
              className="px-4 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold flex items-center gap-1.5 cursor-pointer shadow-lg shadow-purple-600/20 text-xs"
            >
              {isUndoing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RotateCcw className="w-3.5 h-3.5" />
              )}
              <span>Confirm &amp; Revert Balance</span>
            </button>
          </div>
        </div>
      )}

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

        <div className="flex items-center gap-2 flex-wrap">
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
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
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
                    <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5 flex-wrap">
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-medium text-[11px]">
                        {categoryName}
                      </span>
                      <span>•</span>
                      <span>{accountName}</span>
                      <span>•</span>
                      <span className="flex items-center gap-1 text-slate-500">
                        <Calendar className="w-3 h-3" />
                        {formatDate(t.transaction_date)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 flex-shrink-0">
                  <span
                    className={`font-bold text-sm sm:text-base mr-1 ${
                      isIncome ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {isIncome ? '+' : '-'}
                    {formatCurrency(Number(t.amount))}
                  </span>

                  {/* Option to Edit Transaction Details */}
                  <button
                    type="button"
                    onClick={() => handleInitiateEdit(t)}
                    title={`Edit transaction details for "${t.description}"`}
                    className="px-2.5 py-1.5 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 border border-sky-500/25 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-sky-400" />
                    <span className="hidden sm:inline">Edit</span>
                  </button>

                  {/* Option to Undo Transaction */}
                  <button
                    type="button"
                    onClick={() => handleInitiateUndo(t)}
                    title={`Undo this transaction and ${isIncome ? 'deduct' : 'refund'} ${formatCurrency(Number(t.amount))} on ${accountName}`}
                    className="px-2.5 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/25 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
                    <span className="hidden sm:inline">Undo</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Transaction Modal */}
      {showEditModal && editingTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
                  <Edit3 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Edit Transaction Details</h3>
                  <p className="text-xs text-slate-400">
                    Modify transaction fields and automatically synchronize balances
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowEditModal(false);
                  setEditingTx(null);
                }}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              {editError && (
                <UiAlert
                  type="error"
                  message={editError}
                  onClose={() => setEditError(null)}
                />
              )}

              {/* Dynamic Account Balance Preview Badge */}
              {editPreview && (
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1.5">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                    Real-time Balance Synchronization Impact
                  </span>
                  {editPreview.isSameAccount ? (
                    <div className="flex items-center justify-between text-slate-300">
                      <span>
                        Current: <strong className="text-white">{formatCurrency(editPreview.previousBalance)}</strong>
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                      <span>
                        Projected: <strong className="text-emerald-400">{formatCurrency(editPreview.projectedBalance)}</strong>
                      </span>
                      <span
                        className={`font-semibold px-2 py-0.5 rounded text-[11px] ${
                          editPreview.netDelta >= 0
                            ? 'bg-emerald-500/15 text-emerald-300'
                            : 'bg-rose-500/15 text-rose-300'
                        }`}
                      >
                        {editPreview.netDelta >= 0 ? '+' : ''}
                        {formatCurrency(editPreview.netDelta)}
                      </span>
                    </div>
                  ) : (
                    <div className="space-y-1 text-slate-300">
                      <div className="flex items-center justify-between">
                        <span>Revert Previous Account:</span>
                        <span className="text-emerald-400 font-semibold">
                          {formatCurrency(editPreview.oldAccountPrevBalance)} ➔ {formatCurrency(editPreview.oldAccountProjectedBalance)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Apply New Account:</span>
                        <span className="text-rose-400 font-semibold">
                          {formatCurrency(editPreview.newAccountPrevBalance)} ➔ {formatCurrency(editPreview.newAccountProjectedBalance)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Description
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dinner, Monthly Rent, Salary"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500/50"
                />
              </div>

              {/* Amount and Type */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Amount
                    </label>
                    <CurrencyLogo variant="badge" />
                  </div>
                  <div className="relative">
                    <CurrencyLogo variant="input-prefix" />
                    <input
                      type="number"
                      step="0.01"
                      required
                      min="0.01"
                      value={editAmount}
                      onChange={(e) => setEditAmount(parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-8 pr-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500/50 font-semibold"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                    Type
                  </label>
                  <select
                    value={editType}
                    onChange={(e) => setEditType(e.target.value as 'income' | 'expense')}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500/50 cursor-pointer"
                  >
                    <option value="expense">Expense (-)</option>
                    <option value="income">Income (+)</option>
                  </select>
                </div>
              </div>

              {/* Account Selection */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Payment Account
                </label>
                <select
                  required
                  value={editAccountId}
                  onChange={(e) => setEditAccountId(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500/50 cursor-pointer"
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({formatCurrency(Number(a.balance))})
                    </option>
                  ))}
                </select>
              </div>

              {/* Category and Date */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                    Category
                  </label>
                  <select
                    value={editCategoryId}
                    onChange={(e) => setEditCategoryId(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500/50 cursor-pointer"
                  >
                    <option value="">Uncategorized</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                    Transaction Date
                  </label>
                  <input
                    type="date"
                    required
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500/50 cursor-pointer"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingTx(null);
                  }}
                  className="text-xs px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="text-xs px-5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold flex items-center gap-2 transition disabled:opacity-50 cursor-pointer shadow-lg shadow-sky-500/20"
                >
                  {isSavingEdit && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manual Entry Modal */}
      {showManualModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-md max-h-[90vh] overflow-y-auto bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">Manual Transaction Entry</h3>
              <button
                onClick={() => setShowManualModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleManualSubmit} className="space-y-4">
              {manualError && (
                <UiAlert
                  type="error"
                  message={manualError}
                  onClose={() => setManualError(null)}
                />
              )}
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
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Amount
                    </label>
                    <CurrencyLogo variant="badge" />
                  </div>
                  <div className="relative">
                    <CurrencyLogo variant="input-prefix" />
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={manualAmount}
                      onChange={(e) => setManualAmount(parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-8 pr-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                    Type
                  </label>
                  <select
                    value={manualType}
                    onChange={(e) => setManualType(e.target.value as 'income' | 'expense')}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 cursor-pointer"
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
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 cursor-pointer"
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({formatCurrency(Number(a.balance))})
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
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 cursor-pointer"
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
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 cursor-pointer"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
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
