import React, { useState } from 'react';
import type { Account } from '../types';
import { supabase } from '../supabaseClient';
import { usePreferences, CURRENCIES } from '../context/PreferencesContext';
import { Wallet, Plus, Trash2, AlertCircle, Loader2 } from 'lucide-react';

interface AccountManagerProps {
  userId: string;
  accounts: Account[];
  onAccountUpdated: () => void;
}

export const AccountManager: React.FC<AccountManagerProps> = ({
  userId,
  accounts,
  onAccountUpdated,
}) => {
  const { preferences } = usePreferences();
  const [showAddModal, setShowAddModal] = useState(false);
  const [name, setName] = useState('');
  const [balance, setBalance] = useState<number>(0);
  const [currency, setCurrency] = useState(preferences.currency || 'USD');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const { error: insertError } = await supabase.from('accounts').insert({
        user_id: userId,
        name: name.trim(),
        balance: Number(balance) || 0,
        currency,
      });

      if (insertError) throw insertError;

      setName('');
      setBalance(0);
      setShowAddModal(false);
      onAccountUpdated();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to add account';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this account? Associated transactions will be affected.')) {
      return;
    }

    try {
      const { error: delError } = await supabase.from('accounts').delete().eq('id', id);
      if (delError) throw delError;
      onAccountUpdated();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete account';
      alert(msg);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
            <Wallet className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">Financial Accounts</h2>
            <p className="text-xs text-slate-400">Manage checking, savings, credit, and cash accounts</p>
          </div>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="text-xs font-semibold px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 flex items-center gap-1.5 transition shadow-lg shadow-emerald-500/10 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>New Account</span>
        </button>
      </div>

      {accounts.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-slate-800 rounded-xl">
          <Wallet className="w-10 h-10 text-slate-600 mx-auto mb-2" />
          <p className="text-sm text-slate-400 font-medium">No accounts found</p>
          <p className="text-xs text-slate-500 mt-1">Create an account to start tracking transactions</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="mt-4 text-xs font-semibold px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 transition cursor-pointer"
          >
            + Add First Account
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {accounts.map((acc) => (
            <div
              key={acc.id}
              className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col justify-between hover:border-slate-700 transition"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-white text-sm">{acc.name}</h3>
                  <span className="text-xs text-slate-500 uppercase tracking-wider font-mono">
                    {acc.currency}
                  </span>
                </div>
                <button
                  onClick={() => handleDeleteAccount(acc.id)}
                  title="Delete account"
                  className="text-slate-600 hover:text-rose-400 transition p-1 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="mt-4">
                <span className="text-xs text-slate-500 block">Current Balance</span>
                <span className="text-xl font-bold text-white tracking-tight">
                  {new Intl.NumberFormat(undefined, {
                    style: 'currency',
                    currency: acc.currency || preferences.currency || 'USD',
                  }).format(Number(acc.balance))}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Account Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-1">Add New Account</h3>
            <p className="text-xs text-slate-400 mb-4">
              Enter account details and starting balance
            </p>

            {error && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleAddAccount} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Account Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Checking Account, Main Cash, Credit Card"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Initial Balance
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={balance}
                  onChange={(e) => setBalance(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Currency
                </label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                >
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code} - {c.name}
                    </option>
                  ))}
                </select>
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
                  <span>Save Account</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
