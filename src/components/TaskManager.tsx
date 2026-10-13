import React, { useState } from 'react';
import type { Task, Account, Category, TaskPriority, FinancialTaskType } from '../types';
import { supabase } from '../supabaseClient';
import { usePreferences } from '../context/PreferencesContext';
import {
  CheckCircle2,
  Circle,
  Plus,
  Calendar,
  DollarSign,
  AlertCircle,
  Clock,
  Trash2,
  Tag,
  ArrowUpRight,
  ArrowDownLeft,
  Flame,
  Check,
  X,
  Loader2,
  Filter,
} from 'lucide-react';

interface TaskManagerProps {
  userId: string;
  tasks: Task[];
  accounts: Account[];
  categories: Category[];
  onTasksUpdated: () => void;
}

export const TaskManager: React.FC<TaskManagerProps> = ({
  userId,
  tasks,
  accounts,
  categories,
  onTasksUpdated,
}) => {
  const { formatCurrency, formatDate } = usePreferences();
  const [filter, setFilter] = useState<'all' | 'financial' | 'personal' | 'completed'>('all');
  const [isAdding, setIsAdding] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Settlement Confirmation State
  const [settlingTask, setSettlingTask] = useState<Task | null>(null);
  const [settleAccountId, setSettleAccountId] = useState<string>('');
  const [isSettling, setIsSettling] = useState(false);

  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [isFinancial, setIsFinancial] = useState(false);
  const [financialType, setFinancialType] = useState<FinancialTaskType>('payable');
  const [amount, setAmount] = useState<number>(0);
  const [categoryId, setCategoryId] = useState<string>('');
  const [accountId, setAccountId] = useState<string>('');
  const [recurrenceRule, setRecurrenceRule] = useState<string>('none');

  // Daily Streak mock state (persists in localStorage)
  const [noSpendStreak, setNoSpendStreak] = useState<number>(() => {
    return parseInt(localStorage.getItem('apex_no_spend_streak') || '4', 10);
  });
  const [markedTodayNoSpend, setMarkedTodayNoSpend] = useState<boolean>(() => {
    return localStorage.getItem('apex_marked_today') === new Date().toISOString().split('T')[0];
  });

  const handleToggleNoSpendToday = () => {
    const today = new Date().toISOString().split('T')[0];
    if (markedTodayNoSpend) {
      setMarkedTodayNoSpend(false);
      localStorage.removeItem('apex_marked_today');
    } else {
      setMarkedTodayNoSpend(true);
      setNoSpendStreak((prev) => prev + 1);
      localStorage.setItem('apex_marked_today', today);
      localStorage.setItem('apex_no_spend_streak', String(noSpendStreak + 1));
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const { error: insertError } = await supabase.from('tasks').insert({
        user_id: userId,
        title: title.trim(),
        description: description.trim() || null,
        due_date: dueDate ? new Date(dueDate).toISOString() : null,
        priority,
        status: 'todo',
        is_financial: isFinancial,
        financial_type: isFinancial ? financialType : 'none',
        amount: isFinancial ? Number(amount) : 0,
        category_id: isFinancial && categoryId ? categoryId : null,
        account_id: isFinancial && accountId ? accountId : null,
        recurrence_rule: recurrenceRule,
      });

      if (insertError) throw insertError;

      // Reset form
      setTitle('');
      setDescription('');
      setDueDate('');
      setPriority('medium');
      setIsFinancial(false);
      setFinancialType('payable');
      setAmount(0);
      setCategoryId('');
      setAccountId('');
      setRecurrenceRule('none');
      setIsAdding(false);

      onTasksUpdated();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create task';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleTaskStatus = async (task: Task) => {
    // If it's a financial task and being marked as completed, open settlement modal
    if (task.status !== 'completed' && task.is_financial && task.amount > 0) {
      setSettlingTask(task);
      setSettleAccountId(task.account_id || (accounts[0]?.id ?? ''));
      return;
    }

    // Otherwise toggle between completed and todo
    const newStatus = task.status === 'completed' ? 'todo' : 'completed';
    const completedAt = newStatus === 'completed' ? new Date().toISOString() : null;

    try {
      const { error: updateError } = await supabase
        .from('tasks')
        .update({ status: newStatus, completed_at: completedAt })
        .eq('id', task.id);

      if (updateError) throw updateError;
      onTasksUpdated();
    } catch (err: unknown) {
      console.error('Error toggling task:', err);
    }
  };

  const handleConfirmFinancialSettlement = async (logTransaction: boolean) => {
    if (!settlingTask) return;
    setIsSettling(true);
    setError(null);

    try {
      let createdTxId: string | null = null;

      if (logTransaction && settleAccountId) {
        const txType = settlingTask.financial_type === 'receivable' ? 'income' : 'expense';

        // 1. Insert transaction into ledger
        const { data: newTx, error: txError } = await supabase
          .from('transactions')
          .insert({
            user_id: userId,
            account_id: settleAccountId,
            category_id: settlingTask.category_id || null,
            amount: settlingTask.amount,
            type: txType,
            description: `[Task Settled] ${settlingTask.title}`,
            transaction_date: new Date().toISOString().split('T')[0],
          })
          .select('id')
          .single();

        if (txError) throw txError;
        createdTxId = newTx?.id || null;

        // 2. Adjust Account Balance
        const account = accounts.find((a) => a.id === settleAccountId);
        if (account) {
          const delta = txType === 'income' ? settlingTask.amount : -settlingTask.amount;
          await supabase
            .from('accounts')
            .update({ balance: Number(account.balance) + delta })
            .eq('id', settleAccountId);
        }
      }

      // 3. Mark task completed and link transaction
      const { error: taskError } = await supabase
        .from('tasks')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          related_transaction_id: createdTxId,
        })
        .eq('id', settlingTask.id);

      if (taskError) throw taskError;

      setSettlingTask(null);
      onTasksUpdated();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Settlement failed';
      setError(msg);
    } finally {
      setIsSettling(false);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      await supabase.from('tasks').delete().eq('id', taskId);
      onTasksUpdated();
    } catch (err: unknown) {
      console.error('Error deleting task:', err);
    }
  };

  const filteredTasks = tasks.filter((t) => {
    if (filter === 'completed') return t.status === 'completed';
    if (t.status === 'completed') return false; // don't show completed in active filters
    if (filter === 'financial') return t.is_financial;
    if (filter === 'personal') return !t.is_financial;
    return true;
  });

  const pendingPayablesTotal = tasks
    .filter((t) => t.status !== 'completed' && t.is_financial && t.financial_type === 'payable')
    .reduce((sum, t) => sum + Number(t.amount || 0), 0);

  const pendingReceivablesTotal = tasks
    .filter((t) => t.status !== 'completed' && t.is_financial && t.financial_type === 'receivable')
    .reduce((sum, t) => sum + Number(t.amount || 0), 0);

  return (
    <div className="space-y-6">
      {/* Top Operations Header & Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Active Tasks</p>
            <p className="text-2xl font-bold text-white mt-1">
              {tasks.filter((t) => t.status !== 'completed').length}
            </p>
          </div>
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-rose-400 uppercase tracking-wider">Pending Bills / Outflow</p>
            <p className="text-2xl font-bold text-white mt-1">
              {formatCurrency(pendingPayablesTotal)}
            </p>
          </div>
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl">
            <ArrowDownLeft className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Pending Freelance / Inflow</p>
            <p className="text-2xl font-bold text-white mt-1">
              {formatCurrency(pendingReceivablesTotal)}
            </p>
          </div>
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl">
            <ArrowUpRight className="w-5 h-5" />
          </div>
        </div>

        {/* Daily Financial Habit Widget */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5">
              <Flame className="w-4 h-4 text-amber-400 fill-amber-400" />
              <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider">No-Spend Streak</p>
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold text-white">{noSpendStreak}</span>
              <span className="text-xs text-slate-400">days</span>
            </div>
          </div>
          <button
            onClick={handleToggleNoSpendToday}
            className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition cursor-pointer ${
              markedTodayNoSpend
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
            }`}
          >
            {markedTodayNoSpend ? 'Done Today ✓' : '+ Check-in'}
          </button>
        </div>
      </div>

      {/* Main Operations Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-800">
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
              <span>Daily Tasks &amp; Financial Obligations</span>
              <span className="text-xs font-normal bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full border border-slate-700">
                ERP Operations
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Connect daily to-dos, bills to pay, freelance milestones, and routines directly with your ledger.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsAdding(!isAdding)}
              className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-semibold px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-lg shadow-emerald-500/20 transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{isAdding ? 'Close Form' : 'New Task / Bill'}</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Add Task Form */}
        {isAdding && (
          <form onSubmit={handleCreateTask} className="mt-5 p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Task Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Pay WiFi Bill ($60), Review Tax Receipts, Client Landing Page Milestone"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Due Date
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Priority
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as TaskPriority)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Recurrence
                </label>
                <select
                  value={recurrenceRule}
                  onChange={(e) => setRecurrenceRule(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="none">One-time</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Notes / Description
                </label>
                <input
                  type="text"
                  placeholder="Optional context or links..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* Financial Bridge Section */}
            <div className="pt-3 border-t border-slate-800">
              <div className="flex items-center gap-2 mb-3">
                <input
                  type="checkbox"
                  id="isFinancialCheckbox"
                  checked={isFinancial}
                  onChange={(e) => setIsFinancial(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-700 text-emerald-500 focus:ring-emerald-500 cursor-pointer"
                />
                <label htmlFor="isFinancialCheckbox" className="text-xs font-semibold text-emerald-400 cursor-pointer flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5" />
                  <span>Link this task to Financial Ledger (Bill, Receivable, or Budget)</span>
                </label>
              </div>

              {isFinancial && (
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-slate-900/60 border border-emerald-500/20">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                      Type
                    </label>
                    <select
                      value={financialType}
                      onChange={(e) => setFinancialType(e.target.value as FinancialTaskType)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
                    >
                      <option value="payable">Bill to Pay (Expense)</option>
                      <option value="receivable">Income Expected (Receivable)</option>
                      <option value="budget_task">Budgeted Action</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                      Amount ($)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required={isFinancial}
                      placeholder="0.00"
                      value={amount || ''}
                      onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                      Category
                    </label>
                    <select
                      value={categoryId}
                      onChange={(e) => setCategoryId(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
                    >
                      <option value="">Select Category...</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.type})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                      Primary Account
                    </label>
                    <select
                      value={accountId}
                      onChange={(e) => setAccountId(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
                    >
                      <option value="">Select Account...</option>
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} (${Number(a.balance).toFixed(2)})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2 text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl transition shadow-lg shadow-emerald-500/20 disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
              >
                {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Save Task</span>
              </button>
            </div>
          </form>
        )}

        {/* Filter Navigation */}
        <div className="flex items-center gap-2 mt-6 overflow-x-auto pb-1 text-xs">
          <Filter className="w-3.5 h-3.5 text-slate-500 mr-1" />
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
              filter === 'all'
                ? 'bg-slate-800 text-emerald-400 border border-slate-700'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            All Active ({tasks.filter((t) => t.status !== 'completed').length})
          </button>
          <button
            onClick={() => setFilter('financial')}
            className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
              filter === 'financial'
                ? 'bg-slate-800 text-emerald-400 border border-slate-700'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Bills &amp; Finances ({tasks.filter((t) => t.status !== 'completed' && t.is_financial).length})
          </button>
          <button
            onClick={() => setFilter('personal')}
            className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
              filter === 'personal'
                ? 'bg-slate-800 text-emerald-400 border border-slate-700'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Personal &amp; Work ({tasks.filter((t) => t.status !== 'completed' && !t.is_financial).length})
          </button>
          <button
            onClick={() => setFilter('completed')}
            className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
              filter === 'completed'
                ? 'bg-slate-800 text-emerald-400 border border-slate-700'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Archive / Completed ({tasks.filter((t) => t.status === 'completed').length})
          </button>
        </div>

        {/* Task List */}
        <div className="mt-4 divide-y divide-slate-800/60">
          {filteredTasks.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-sm">
              <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-slate-700" />
              <p>No tasks found in this view.</p>
              <p className="text-xs text-slate-600 mt-1">
                Click &ldquo;New Task / Bill&rdquo; to schedule upcoming obligations.
              </p>
            </div>
          ) : (
            filteredTasks.map((task) => {
              const isOverdue =
                task.due_date &&
                new Date(task.due_date).getTime() < Date.now() &&
                task.status !== 'completed';

              return (
                <div
                  key={task.id}
                  className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 group hover:bg-slate-850/40 px-2 rounded-xl transition"
                >
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <button
                      onClick={() => handleToggleTaskStatus(task)}
                      className="mt-0.5 text-slate-400 hover:text-emerald-400 transition cursor-pointer flex-shrink-0"
                    >
                      {task.status === 'completed' ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-400 fill-emerald-400/20" />
                      ) : (
                        <Circle className="w-5 h-5 text-slate-500 hover:text-emerald-400" />
                      )}
                    </button>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-sm font-medium ${
                            task.status === 'completed'
                              ? 'line-through text-slate-500'
                              : 'text-slate-200'
                          }`}
                        >
                          {task.title}
                        </span>

                        {/* Priority Badge */}
                        {task.priority !== 'medium' && (
                          <span
                            className={`text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded ${
                              task.priority === 'urgent'
                                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                : task.priority === 'high'
                                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {task.priority}
                          </span>
                        )}

                        {/* Financial Bridge Tag */}
                        {task.is_financial && (
                          <span
                            className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                              task.financial_type === 'receivable'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            }`}
                          >
                            <DollarSign className="w-3 h-3" />
                            {task.financial_type === 'receivable' ? '+' : '-'}
                            {formatCurrency(Number(task.amount))}
                          </span>
                        )}

                        {task.recurrence_rule && task.recurrence_rule !== 'none' && (
                          <span className="text-[10px] text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">
                            {task.recurrence_rule}
                          </span>
                        )}
                      </div>

                      {task.description && (
                        <p className="text-xs text-slate-400 mt-0.5 truncate">{task.description}</p>
                      )}

                      <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500">
                        {task.due_date && (
                          <div
                            className={`flex items-center gap-1 ${
                              isOverdue ? 'text-rose-400 font-semibold' : 'text-slate-400'
                            }`}
                          >
                            <Calendar className="w-3 h-3" />
                            <span>{formatDate(task.due_date)}</span>
                            {isOverdue && <span className="text-[10px]">(Overdue)</span>}
                          </div>
                        )}

                        {task.categories?.name && (
                          <div className="flex items-center gap-1 text-slate-400">
                            <Tag className="w-3 h-3" />
                            <span>{task.categories.name}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <button
                      onClick={() => handleDeleteTask(task.id)}
                      className="text-slate-600 hover:text-rose-400 p-1.5 rounded-lg hover:bg-slate-800 transition cursor-pointer"
                      title="Delete task"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Financial Settlement Confirmation Modal */}
      {settlingTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <DollarSign className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-white">Financial Settlement</h3>
                  <p className="text-xs text-slate-400">Task marked as complete</p>
                </div>
              </div>
              <button
                onClick={() => setSettlingTask(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <p className="text-sm text-slate-200">
                You marked <span className="font-semibold text-white">&ldquo;{settlingTask.title}&rdquo;</span> as complete.
              </p>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Amount:</span>
                  <span className="font-bold text-white">
                    ${Number(settlingTask.amount).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Action:</span>
                  <span className="text-emerald-400 font-semibold">
                    {settlingTask.financial_type === 'receivable' ? 'Record Income (+)' : 'Record Expense (-)'}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Deduct from / Deposit into Account:
                </label>
                <select
                  value={settleAccountId}
                  onChange={(e) => setSettleAccountId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
                >
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} (${Number(acc.balance).toFixed(2)})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-6 flex flex-col sm:flex-row gap-2 pt-3 border-t border-slate-800">
              <button
                onClick={() => handleConfirmFinancialSettlement(false)}
                disabled={isSettling}
                className="flex-1 py-2 text-xs font-medium text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-750 rounded-xl transition cursor-pointer"
              >
                Just Complete Task (No Transaction)
              </button>
              <button
                onClick={() => handleConfirmFinancialSettlement(true)}
                disabled={isSettling || !settleAccountId}
                className="flex-1 py-2 text-xs font-semibold text-slate-950 bg-emerald-500 hover:bg-emerald-400 rounded-xl shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                {isSettling ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                <span>Log to Ledger &amp; Settle</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
