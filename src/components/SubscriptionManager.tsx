import React, { useState } from 'react';
import type { Subscription, Account, Category, BillingCycle } from '../types';
import { supabase } from '../supabaseClient';
import { usePreferences } from '../context/PreferencesContext';
import {
  CreditCard,
  Plus,
  Calendar,
  AlertCircle,
  ExternalLink,
  Trash2,
  Check,
  Loader2,
  Clock,
  Sparkles,
  RotateCcw,
} from 'lucide-react';
import { CurrencyLogo } from './CurrencyLogo';

interface SubscriptionManagerProps {
  userId: string;
  subscriptions: Subscription[];
  accounts: Account[];
  categories: Category[];
  onSubscriptionsUpdated: () => void;
}

export const SubscriptionManager: React.FC<SubscriptionManagerProps> = ({
  userId,
  subscriptions,
  accounts,
  categories,
  onSubscriptionsUpdated,
}) => {
  const { formatCurrency, formatDate } = usePreferences();
  const [isAdding, setIsAdding] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [cost, setCost] = useState<number>(0);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
  const [nextBillingDate, setNextBillingDate] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [cancellationUrl, setCancellationUrl] = useState('');
  const [notes, setNotes] = useState('');

  // Quick Action: Settle/Log current renewal
  const [renewingId, setRenewingId] = useState<string | null>(null);

  const handleCreateSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !nextBillingDate) return;

    setLoading(true);
    setError(null);

    try {
      const { error: insertError } = await supabase.from('subscriptions').insert({
        user_id: userId,
        name: name.trim(),
        cost: Number(cost) || 0,
        billing_cycle: billingCycle,
        next_billing_date: nextBillingDate,
        category_id: categoryId || null,
        account_id: accountId || null,
        cancellation_url: cancellationUrl.trim() || null,
        notes: notes.trim() || null,
        is_active: true,
      });

      if (insertError) throw insertError;

      // Reset
      setName('');
      setCost(0);
      setBillingCycle('monthly');
      setNextBillingDate('');
      setCategoryId('');
      setAccountId('');
      setCancellationUrl('');
      setNotes('');
      setIsAdding(false);

      onSubscriptionsUpdated();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create subscription';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleLogRenewalTransaction = async (sub: Subscription) => {
    setRenewingId(sub.id);
    setError(null);

    try {
      const targetAccountId = sub.account_id || accounts[0]?.id;
      if (!targetAccountId) {
        throw new Error('Please select an account to debit this subscription from.');
      }

      // 1. Log transaction
      const { error: txError } = await supabase.from('transactions').insert({
        user_id: userId,
        account_id: targetAccountId,
        category_id: sub.category_id || null,
        amount: sub.cost,
        type: 'expense',
        description: `[Subscription] ${sub.name}`,
        transaction_date: new Date().toISOString().split('T')[0],
      });

      if (txError) throw txError;

      // 2. Deduct from account balance
      const account = accounts.find((a) => a.id === targetAccountId);
      if (account) {
        await supabase
          .from('accounts')
          .update({ balance: Number(account.balance) - Number(sub.cost) })
          .eq('id', targetAccountId);
      }

      // 3. Advance next billing date based on cycle
      const currentNext = new Date(sub.next_billing_date);
      if (sub.billing_cycle === 'monthly') {
        currentNext.setMonth(currentNext.getMonth() + 1);
      } else if (sub.billing_cycle === 'yearly') {
        currentNext.setFullYear(currentNext.getFullYear() + 1);
      } else if (sub.billing_cycle === 'weekly') {
        currentNext.setDate(currentNext.getDate() + 7);
      } else if (sub.billing_cycle === 'quarterly') {
        currentNext.setMonth(currentNext.getMonth() + 3);
      }

      await supabase
        .from('subscriptions')
        .update({ next_billing_date: currentNext.toISOString().split('T')[0] })
        .eq('id', sub.id);

      onSubscriptionsUpdated();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to log renewal';
      setError(msg);
    } finally {
      setRenewingId(null);
    }
  };

  const handleDeleteSubscription = async (id: string) => {
    try {
      await supabase.from('subscriptions').delete().eq('id', id);
      onSubscriptionsUpdated();
    } catch (err: unknown) {
      console.error('Error deleting subscription:', err);
    }
  };

  const [isResetting, setIsResetting] = useState(false);

  const handleResetSubscriptions = async () => {
    if (subscriptions.length === 0) {
      alert('No subscriptions to reset.');
      return;
    }
    if (
      !window.confirm(
        `Are you sure you want to reset and delete all ${subscriptions.length} recurring subscriptions? This action cannot be undone.`
      )
    ) {
      return;
    }

    setIsResetting(true);
    try {
      const { error } = await supabase.from('subscriptions').delete().eq('user_id', userId);
      if (error) throw error;
      onSubscriptionsUpdated();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to reset subscriptions');
    } finally {
      setIsResetting(false);
    }
  };

  const handleToggleActive = async (sub: Subscription) => {
    try {
      await supabase
        .from('subscriptions')
        .update({ is_active: !sub.is_active })
        .eq('id', sub.id);
      onSubscriptionsUpdated();
    } catch (err: unknown) {
      console.error('Error toggling subscription:', err);
    }
  };

  // Calculations for Monthly & Annualized Burn
  const activeSubs = subscriptions.filter((s) => s.is_active);

  const monthlyBurn = activeSubs.reduce((sum, s) => {
    const cost = Number(s.cost) || 0;
    if (s.billing_cycle === 'weekly') return sum + cost * 4.33;
    if (s.billing_cycle === 'monthly') return sum + cost;
    if (s.billing_cycle === 'quarterly') return sum + cost / 3;
    if (s.billing_cycle === 'yearly') return sum + cost / 12;
    return sum + cost;
  }, 0);

  const yearlyBurn = monthlyBurn * 12;

  return (
    <div className="space-y-6">
      {/* Top Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-rose-400 uppercase tracking-wider">
              Monthly Subscription Burn
            </p>
            <p className="text-2xl font-bold text-white mt-1">
              {formatCurrency(monthlyBurn)}
              <span className="text-xs font-normal text-slate-400"> / month</span>
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {activeSubs.length} active recurring commitments
            </p>
          </div>
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl">
            <CreditCard className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider">
              Annual Recurring Cost
            </p>
            <p className="text-2xl font-bold text-white mt-1">
              {formatCurrency(yearlyBurn)}
              <span className="text-xs font-normal text-slate-400"> / year</span>
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Projected forward 12 months
            </p>
          </div>
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
              Smart ERP Optimization
            </p>
            <p className="text-sm font-semibold text-slate-200 mt-1">
              Contract &amp; SaaS Control
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Store direct cancel URLs &amp; log charges with 1-click
            </p>
          </div>
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl">
            <Sparkles className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Subscriptions Registry */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-800">
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
              <span>Subscriptions &amp; Recurring Commitments</span>
              <span className="text-xs font-normal bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full border border-slate-700">
                ERP Contracts
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Never get caught by surprise renewals. Log recurring charges automatically to your financial ledger.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleResetSubscriptions}
              disabled={isResetting || subscriptions.length === 0}
              title="Reset and clear all recurring subscriptions"
              className="text-xs font-semibold px-3 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/25 flex items-center gap-1.5 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              {isResetting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RotateCcw className="w-3.5 h-3.5" />
              )}
              <span>Reset Subscriptions</span>
            </button>

            <button
              onClick={() => setIsAdding(!isAdding)}
              className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-semibold px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-lg shadow-emerald-500/20 transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{isAdding ? 'Close Form' : 'Add Subscription'}</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Add Subscription Form */}
        {isAdding && (
          <form onSubmit={handleCreateSubscription} className="mt-5 p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Service / Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Netflix, Spotify, Gym, AWS, iCloud"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <span>Cost</span>
                  <CurrencyLogo variant="badge" />
                  <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <CurrencyLogo variant="input-prefix" />
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="14.99"
                    value={cost || ''}
                    onChange={(e) => setCost(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-8 pr-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Billing Cycle
                </label>
                <select
                  value={billingCycle}
                  onChange={(e) => setBillingCycle(e.target.value as BillingCycle)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="weekly">Weekly</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Next Renewal Date *
                </label>
                <input
                  type="date"
                  required
                  value={nextBillingDate}
                  onChange={(e) => setNextBillingDate(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Category
                </label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="">Select Category...</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Payment Account
                </label>
                <select
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="">Select Account...</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Cancellation / Manage URL
                </label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={cancellationUrl}
                  onChange={(e) => setCancellationUrl(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Notes
                </label>
                <input
                  type="text"
                  placeholder="Shared with family, tier, etc."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
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
                <span>Save Subscription</span>
              </button>
            </div>
          </form>
        )}

        {/* Subscription Items Table/Cards */}
        <div className="mt-6 space-y-3">
          {subscriptions.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-sm">
              <CreditCard className="w-10 h-10 mx-auto mb-2 text-slate-700" />
              <p>No subscriptions tracked yet.</p>
              <p className="text-xs text-slate-600 mt-1">
                Keep tabs on your recurring bills, software licenses, and memberships.
              </p>
            </div>
          ) : (
            subscriptions.map((sub) => {
              const renewalDate = new Date(sub.next_billing_date);
              const daysUntil = Math.ceil((renewalDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
              const isUrgent = daysUntil >= 0 && daysUntil <= 3;

              return (
                <div
                  key={sub.id}
                  className={`p-4 rounded-xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                    !sub.is_active
                      ? 'bg-slate-950/40 border-slate-850 opacity-60'
                      : isUrgent
                      ? 'bg-amber-500/5 border-amber-500/30'
                      : 'bg-slate-950 border-slate-800/80 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start sm:items-center gap-3">
                    <div className="p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-emerald-400">
                      <CreditCard className="w-5 h-5" />
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-white">{sub.name}</h4>
                        <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                          {sub.billing_cycle}
                        </span>
                        {!sub.is_active && (
                          <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-400">
                            Paused
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-500" />
                          <span>
                            Renews {formatDate(renewalDate)}
                          </span>
                        </span>

                        {daysUntil >= 0 ? (
                          <span
                            className={`font-medium ${
                              isUrgent ? 'text-amber-400' : 'text-slate-400'
                            }`}
                          >
                            (in {daysUntil} {daysUntil === 1 ? 'day' : 'days'})
                          </span>
                        ) : (
                          <span className="text-rose-400 font-medium">
                            ({Math.abs(daysUntil)} days overdue)
                          </span>
                        )}

                        {sub.categories?.name && (
                          <span className="text-slate-500">• {sub.categories.name}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-0 border-slate-850">
                    <div className="text-right">
                      <span className="text-base font-bold text-white block">
                        {formatCurrency(Number(sub.cost))}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        per {sub.billing_cycle.replace('ly', '')}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {/* One-click Log Renewal Transaction */}
                      <button
                        onClick={() => handleLogRenewalTransaction(sub)}
                        disabled={renewingId === sub.id || !sub.is_active}
                        className="text-xs bg-slate-800 hover:bg-emerald-500 hover:text-slate-950 text-slate-300 font-medium px-2.5 py-1.5 rounded-lg border border-slate-700 transition flex items-center gap-1 cursor-pointer disabled:opacity-40"
                        title="Record this month's renewal transaction into ledger"
                      >
                        {renewingId === sub.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Check className="w-3.5 h-3.5" />
                        )}
                        <span>Log Charge</span>
                      </button>

                      {sub.cancellation_url && (
                        <a
                          href={sub.cancellation_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 text-slate-400 hover:text-white bg-slate-800 rounded-lg transition"
                          title="Open Cancellation / Manage Page"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}

                      <button
                        onClick={() => handleToggleActive(sub)}
                        className={`text-xs px-2 py-1 rounded-lg border transition cursor-pointer ${
                          sub.is_active
                            ? 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                            : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                        }`}
                        title={sub.is_active ? 'Pause subscription' : 'Activate subscription'}
                      >
                        {sub.is_active ? 'Pause' : 'Resume'}
                      </button>

                      <button
                        onClick={() => handleDeleteSubscription(sub.id)}
                        className="text-slate-600 hover:text-rose-400 p-1.5 rounded-lg hover:bg-slate-800 transition cursor-pointer"
                        title="Delete subscription"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
