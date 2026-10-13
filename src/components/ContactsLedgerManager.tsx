import React, { useState } from 'react';
import type { ContactsLedger, Account, ContactDebtType } from '../types';
import { supabase } from '../supabaseClient';
import {
  Users,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  Calendar,
  AlertCircle,
  Trash2,
  Check,
  Loader2,
  DollarSign,
  X,
} from 'lucide-react';

interface ContactsLedgerManagerProps {
  userId: string;
  contactsLedger: ContactsLedger[];
  accounts: Account[];
  onLedgerUpdated: () => void;
}

export const ContactsLedgerManager: React.FC<ContactsLedgerManagerProps> = ({
  userId,
  contactsLedger,
  accounts,
  onLedgerUpdated,
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Settlement Modal State
  const [settlingItem, setSettlingItem] = useState<ContactsLedger | null>(null);
  const [settleAccountId, setSettleAccountId] = useState('');
  const [isSettling, setIsSettling] = useState(false);

  // Form State
  const [contactName, setContactName] = useState('');
  const [type, setType] = useState<ContactDebtType>('they_owe_me');
  const [amount, setAmount] = useState<number>(0);
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');

  const handleCreateEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactName.trim() || !amount) return;

    setLoading(true);
    setError(null);

    try {
      const { error: insertError } = await supabase.from('contacts_ledger').insert({
        user_id: userId,
        contact_name: contactName.trim(),
        type,
        amount: Number(amount) || 0,
        description: description.trim() || null,
        due_date: dueDate || null,
        is_settled: false,
      });

      if (insertError) throw insertError;

      setContactName('');
      setType('they_owe_me');
      setAmount(0);
      setDescription('');
      setDueDate('');
      setIsAdding(false);

      onLedgerUpdated();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to record entry';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleSettleDebt = async (logTransaction: boolean) => {
    if (!settlingItem) return;
    setIsSettling(true);
    setError(null);

    try {
      let createdTxId: string | null = null;

      if (logTransaction && settleAccountId) {
        // If they owed me -> settling means money IN (income)
        // If I owed them -> settling means money OUT (expense)
        const txType = settlingItem.type === 'they_owe_me' ? 'income' : 'expense';

        const { data: newTx, error: txError } = await supabase
          .from('transactions')
          .insert({
            user_id: userId,
            account_id: settleAccountId,
            amount: settlingItem.amount,
            type: txType,
            description: `[P2P Settled] ${settlingItem.contact_name}: ${settlingItem.description || 'Settlement'}`,
            transaction_date: new Date().toISOString().split('T')[0],
          })
          .select('id')
          .single();

        if (txError) throw txError;
        createdTxId = newTx?.id || null;

        // Adjust Account Balance
        const account = accounts.find((a) => a.id === settleAccountId);
        if (account) {
          const delta = txType === 'income' ? settlingItem.amount : -settlingItem.amount;
          await supabase
            .from('accounts')
            .update({ balance: Number(account.balance) + delta })
            .eq('id', settleAccountId);
        }
      }

      // Mark settled in contacts ledger
      const { error: updateError } = await supabase
        .from('contacts_ledger')
        .update({
          is_settled: true,
          settled_at: new Date().toISOString(),
          settled_transaction_id: createdTxId,
        })
        .eq('id', settlingItem.id);

      if (updateError) throw updateError;

      setSettlingItem(null);
      onLedgerUpdated();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to settle debt';
      setError(msg);
    } finally {
      setIsSettling(false);
    }
  };

  const handleDeleteEntry = async (id: string) => {
    try {
      await supabase.from('contacts_ledger').delete().eq('id', id);
      onLedgerUpdated();
    } catch (err: unknown) {
      console.error('Error deleting entry:', err);
    }
  };

  const activeItems = contactsLedger.filter((item) => !item.is_settled);
  const totalTheyOweMe = activeItems
    .filter((i) => i.type === 'they_owe_me')
    .reduce((sum, i) => sum + Number(i.amount || 0), 0);

  const totalIOweThem = activeItems
    .filter((i) => i.type === 'i_owe_them')
    .reduce((sum, i) => sum + Number(i.amount || 0), 0);

  const netBalance = totalTheyOweMe - totalIOweThem;

  return (
    <div className="space-y-6">
      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
              They Owe You (Receivables)
            </p>
            <p className="text-2xl font-bold text-white mt-1">
              ${totalTheyOweMe.toFixed(2)}
            </p>
            <p className="text-xs text-slate-400 mt-1">Money expected back</p>
          </div>
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl">
            <ArrowUpRight className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-rose-400 uppercase tracking-wider">
              You Owe Others (Payables)
            </p>
            <p className="text-2xl font-bold text-white mt-1">
              ${totalIOweThem.toFixed(2)}
            </p>
            <p className="text-xs text-slate-400 mt-1">Pending payments to friends</p>
          </div>
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl">
            <ArrowDownLeft className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Net Social Balance
            </p>
            <p
              className={`text-2xl font-bold mt-1 ${
                netBalance >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {netBalance >= 0 ? '+' : ''}${netBalance.toFixed(2)}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {netBalance >= 0 ? 'You are in the green' : 'You have outstanding debts'}
            </p>
          </div>
          <div className="p-3 bg-slate-800 border border-slate-700 text-slate-300 rounded-xl">
            <Users className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Ledger Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-800">
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
              <span>Social Ledger &amp; P2P Debts</span>
              <span className="text-xs font-normal bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full border border-slate-700">
                ERP Shared Balances
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Keep track of money lent to or borrowed from friends, dinner splits, and informal IOUs.
            </p>
          </div>

          <button
            onClick={() => setIsAdding(!isAdding)}
            className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-semibold px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-lg shadow-emerald-500/20 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{isAdding ? 'Close Form' : 'Record IOU / Split'}</span>
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Add Entry Form */}
        {isAdding && (
          <form onSubmit={handleCreateEntry} className="mt-5 p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Contact Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Alex, Mom, Roommate"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Type *
                </label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as ContactDebtType)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="they_owe_me">They owe me (Receivable)</option>
                  <option value="i_owe_them">I owe them (Payable)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Amount ($) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="0.00"
                  value={amount || ''}
                  onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Target Due Date
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Reason / Note
              </label>
              <input
                type="text"
                placeholder="e.g. Dinner bill split, Concert tickets, Borrowed for parking"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
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
                <span>Record Entry</span>
              </button>
            </div>
          </form>
        )}

        {/* Entries List */}
        <div className="mt-6 space-y-3">
          {contactsLedger.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-sm">
              <Users className="w-10 h-10 mx-auto mb-2 text-slate-700" />
              <p>No P2P debts or shared expenses recorded.</p>
              <p className="text-xs text-slate-600 mt-1">
                Record who owes who to keep your relationships and wallets clean.
              </p>
            </div>
          ) : (
            contactsLedger.map((item) => (
              <div
                key={item.id}
                className={`p-4 rounded-xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                  item.is_settled
                    ? 'bg-slate-950/40 border-slate-850 opacity-60'
                    : 'bg-slate-950 border-slate-800/80 hover:border-slate-700'
                }`}
              >
                <div className="flex items-start sm:items-center gap-3">
                  <div
                    className={`p-2.5 rounded-xl border ${
                      item.type === 'they_owe_me'
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                        : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                    }`}
                  >
                    {item.type === 'they_owe_me' ? (
                      <ArrowUpRight className="w-5 h-5" />
                    ) : (
                      <ArrowDownLeft className="w-5 h-5" />
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-white">{item.contact_name}</h4>
                      <span
                        className={`text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full ${
                          item.type === 'they_owe_me'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}
                      >
                        {item.type === 'they_owe_me' ? 'Owes you' : 'You owe'}
                      </span>
                      {item.is_settled && (
                        <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                          Settled ✓
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-400 mt-0.5">
                      {item.description || 'No description provided'}
                    </p>

                    {item.due_date && (
                      <div className="flex items-center gap-1 text-[11px] text-slate-500 mt-1">
                        <Calendar className="w-3 h-3" />
                        <span>Due {new Date(item.due_date).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-0 border-slate-850">
                  <div className="text-right">
                    <span
                      className={`text-base font-bold ${
                        item.type === 'they_owe_me' ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      ${Number(item.amount).toFixed(2)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {!item.is_settled && (
                      <button
                        onClick={() => {
                          setSettlingItem(item);
                          setSettleAccountId(accounts[0]?.id || '');
                        }}
                        className="text-xs bg-slate-800 hover:bg-emerald-500 hover:text-slate-950 text-slate-300 font-semibold px-3 py-1.5 rounded-lg border border-slate-700 transition flex items-center gap-1 cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Settle</span>
                      </button>
                    )}

                    <button
                      onClick={() => handleDeleteEntry(item.id)}
                      className="text-slate-600 hover:text-rose-400 p-1.5 rounded-lg hover:bg-slate-800 transition cursor-pointer"
                      title="Delete entry"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Settle Debt Modal */}
      {settlingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <DollarSign className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-white">Settle Social Balance</h3>
                  <p className="text-xs text-slate-400">{settlingItem.contact_name}</p>
                </div>
              </div>
              <button
                onClick={() => setSettlingItem(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <p className="text-sm text-slate-200">
                Settling <span className="font-bold text-white">${Number(settlingItem.amount).toFixed(2)}</span> with{' '}
                <span className="font-semibold text-white">{settlingItem.contact_name}</span>.
              </p>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  {settlingItem.type === 'they_owe_me'
                    ? 'Deposit money into account:'
                    : 'Deduct money from account:'}
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
                onClick={() => handleSettleDebt(false)}
                disabled={isSettling}
                className="flex-1 py-2 text-xs font-medium text-slate-400 hover:text-white bg-slate-800 rounded-xl transition cursor-pointer"
              >
                Just Mark Settled
              </button>
              <button
                onClick={() => handleSettleDebt(true)}
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
