import React, { useState, useMemo } from 'react';
import type { Account } from '../types';
import { supabase } from '../supabaseClient';
import { usePreferences } from '../context/PreferencesContext';
import {
  Users,
  Plus,
  Trash2,
  Share2,
  Copy,
  Check,
  X,
  AlertCircle,
  Loader2,
} from 'lucide-react';

interface SplitBillModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  accounts: Account[];
  existingContacts: string[];
  onSuccess: () => void;
}

export const SplitBillModal: React.FC<SplitBillModalProps> = ({
  isOpen,
  onClose,
  userId,
  accounts,
  existingContacts,
  onSuccess,
}) => {
  const { preferences, formatCurrency } = usePreferences();
  const symbol = preferences.currencySymbol || '$';

  // Form State
  const [billTotal, setBillTotal] = useState<number>(0);
  const [description, setDescription] = useState<string>('');
  const [splitMode, setSplitMode] = useState<'equal' | 'exact' | 'percentage'>('equal');
  const [paidBy, setPaidBy] = useState<'user' | 'contact'>('user');
  const [selectedAccountId, setSelectedAccountId] = useState<string>(
    accounts[0]?.id || ''
  );
  const [deductUserShareFromAccount, setDeductUserShareFromAccount] = useState<boolean>(true);

  // Payment Handles for Quick-Pay Link Generation
  const [paymentHandleType, setPaymentHandleType] = useState<'upi' | 'venmo' | 'paypal' | 'cashapp' | 'generic'>('generic');
  const [paymentHandle, setPaymentHandle] = useState<string>(() => {
    try {
      return localStorage.getItem('apex_user_pay_handle') || '';
    } catch {
      return '';
    }
  });

  // Participants State
  const [participants, setParticipants] = useState<Array<{ name: string; amount: number; percentage: number; isUser: boolean }>>([
    { name: 'You (Self)', amount: 0, percentage: 50, isUser: true },
    { name: 'Friend 1', amount: 0, percentage: 50, isUser: false },
  ]);

  const [newContactInput, setNewContactInput] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [copiedBreakdown, setCopiedBreakdown] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Keep payment handle saved
  const handleSavePaymentHandle = (val: string) => {
    setPaymentHandle(val);
    try {
      localStorage.setItem('apex_user_pay_handle', val);
    } catch {
      // ignore
    }
  };

  // Re-calculate participant amounts based on splitMode
  const calculatedParticipants = useMemo(() => {
    const count = participants.length || 1;
    if (splitMode === 'equal') {
      const perPerson = billTotal > 0 ? parseFloat((billTotal / count).toFixed(2)) : 0;
      // Adjust last person by remainder cents to make exact sum
      const remainder = billTotal > 0 ? parseFloat((billTotal - perPerson * (count - 1)).toFixed(2)) : 0;

      return participants.map((p, idx) => ({
        ...p,
        amount: idx === count - 1 ? remainder : perPerson,
        percentage: parseFloat((100 / count).toFixed(1)),
      }));
    } else if (splitMode === 'percentage') {
      return participants.map((p) => ({
        ...p,
        amount: parseFloat(((billTotal * (p.percentage || 0)) / 100).toFixed(2)),
      }));
    }
    return participants;
  }, [participants, billTotal, splitMode]);

  // Total allocated sum
  const totalAllocated = useMemo(() => {
    return calculatedParticipants.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  }, [calculatedParticipants]);

  const allocationDelta = parseFloat((billTotal - totalAllocated).toFixed(2));
  const isAllocationBalanced = Math.abs(allocationDelta) < 0.05;

  // Add participant
  const handleAddParticipant = (name: string) => {
    if (!name.trim()) return;
    if (participants.some((p) => p.name.toLowerCase() === name.trim().toLowerCase())) {
      setError(`"${name}" is already in the split.`);
      return;
    }
    setError(null);
    const newCount = participants.length + 1;
    const equalPct = parseFloat((100 / newCount).toFixed(1));
    const updated = [
      ...participants.map((p) => ({ ...p, percentage: equalPct })),
      { name: name.trim(), amount: 0, percentage: equalPct, isUser: false },
    ];
    setParticipants(updated);
    setNewContactInput('');
  };

  // Remove participant
  const handleRemoveParticipant = (index: number) => {
    if (participants[index].isUser) return; // Cannot remove self
    const updated = participants.filter((_, i) => i !== index);
    setParticipants(updated);
  };

  // Update participant amount / percentage
  const handleUpdateParticipantVal = (index: number, val: number, field: 'amount' | 'percentage') => {
    setParticipants((prev) =>
      prev.map((p, i) => (i === index ? { ...p, [field]: val } : p))
    );
  };

  // Formatted Breakdown Text for Social Sharing
  const formattedBreakdownText = useMemo(() => {
    const lines: string[] = [];
    lines.push(`🧾 Bill Split: ${description || 'Group Expense'}`);
    lines.push(`Total Bill: ${formatCurrency(billTotal)}`);
    lines.push('──────────────────────');
    calculatedParticipants.forEach((p) => {
      lines.push(`• ${p.name}: ${formatCurrency(p.amount)}`);
    });
    lines.push('──────────────────────');

    if (paymentHandle) {
      if (paymentHandleType === 'upi') {
        lines.push(`💸 Pay via UPI: ${paymentHandle}`);
      } else if (paymentHandleType === 'venmo') {
        lines.push(`💸 Pay via Venmo: https://venmo.com/u/${paymentHandle.replace('@', '')}`);
      } else if (paymentHandleType === 'paypal') {
        lines.push(`💸 Pay via PayPal: https://paypal.me/${paymentHandle}`);
      } else if (paymentHandleType === 'cashapp') {
        lines.push(`💸 Pay via CashApp: https://cash.app/$${paymentHandle.replace('$', '')}`);
      } else {
        lines.push(`💸 Pay via: ${paymentHandle}`);
      }
    }
    lines.push('Tracked on Apex LifeOS');
    return lines.join('\n');
  }, [description, billTotal, calculatedParticipants, paymentHandle, paymentHandleType, formatCurrency]);

  // Copy breakdown to clipboard
  const handleCopyBreakdown = async () => {
    try {
      await navigator.clipboard.writeText(formattedBreakdownText);
      setCopiedBreakdown(true);
      setTimeout(() => setCopiedBreakdown(false), 2500);
    } catch {
      alert('Failed to copy to clipboard.');
    }
  };

  // Native Web Share API
  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Bill Split: ${description || 'Group Expense'}`,
          text: formattedBreakdownText,
        });
      } catch {
        // User cancelled or failed
      }
    } else {
      handleCopyBreakdown();
    }
  };

  // Submit and Sync to Supabase
  const handleSyncToLedger = async () => {
    if (billTotal <= 0) {
      setError('Please enter a valid bill total.');
      return;
    }
    if (!description.trim()) {
      setError('Please provide a short description for this bill.');
      return;
    }
    if (!isAllocationBalanced && splitMode !== 'equal') {
      setError(`Split amounts do not balance. Difference: ${formatCurrency(allocationDelta)}`);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const today = new Date().toISOString().split('T')[0];
      const otherParticipants = calculatedParticipants.filter((p) => !p.isUser);
      const userShare = calculatedParticipants.find((p) => p.isUser)?.amount || 0;

      // 1. If User paid full bill:
      if (paidBy === 'user') {
        // A. Insert each friend's share into contacts_ledger as 'they_owe_me'
        const recordsToInsert = otherParticipants.map((friend) => ({
          user_id: userId,
          contact_name: friend.name,
          type: 'they_owe_me',
          amount: friend.amount,
          description: `[Split: ${description}]`,
          is_settled: false,
        }));

        if (recordsToInsert.length > 0) {
          const { error: insertError } = await supabase.from('contacts_ledger').insert(recordsToInsert);
          if (insertError) throw insertError;
        }

        // B. Optional: Log user's personal share to transactions & deduct from account
        if (deductUserShareFromAccount && selectedAccountId && userShare > 0) {
          const { error: txError } = await supabase.from('transactions').insert({
            user_id: userId,
            account_id: selectedAccountId,
            amount: userShare,
            type: 'expense',
            description: `[My Share] ${description}`,
            transaction_date: today,
          });
          if (txError) throw txError;

          // Deduct from account balance
          const targetAccount = accounts.find((a) => a.id === selectedAccountId);
          if (targetAccount) {
            const newBal = Number(targetAccount.balance) - userShare;
            await supabase.from('accounts').update({ balance: newBal }).eq('id', selectedAccountId);
          }
        }
      } else {
        // Someone else paid -> User owes the payer
        const payer = otherParticipants[0]?.name || 'Friend';
        const { error: insertError } = await supabase.from('contacts_ledger').insert({
          user_id: userId,
          contact_name: payer,
          type: 'i_owe_them',
          amount: userShare,
          description: `[Split: ${description}]`,
          is_settled: false,
        });
        if (insertError) throw insertError;
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to record split in ledger');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 w-full max-w-xl shadow-2xl relative my-8">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Split Group Bill
                </h3>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Splitwise Alt
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Divide bills, generate instant payment links, and record IOUs automatically.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="mt-5 space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          {/* Bill Total & Description */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Total Bill Amount ({symbol})
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-sm">
                  {symbol}
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={billTotal || ''}
                  placeholder="0.00"
                  onChange={(e) => setBillTotal(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-2 text-sm text-white font-bold focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Description / Merchant
              </label>
              <input
                type="text"
                value={description}
                placeholder="e.g. Dinner with team, Roadtrip Fuel"
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Paid By Selection & Account deduction */}
          <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800/80 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-300">Who Paid the Full Bill?</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPaidBy('user')}
                  className={`px-3 py-1 rounded-lg font-medium transition cursor-pointer ${
                    paidBy === 'user'
                      ? 'bg-emerald-500 text-slate-950 font-bold'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  I Paid Full
                </button>
                <button
                  type="button"
                  onClick={() => setPaidBy('contact')}
                  className={`px-3 py-1 rounded-lg font-medium transition cursor-pointer ${
                    paidBy === 'contact'
                      ? 'bg-rose-500 text-white font-bold'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  Friend Paid
                </button>
              </div>
            </div>

            {paidBy === 'user' && accounts.length > 0 && (
              <div className="pt-2 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={deductUserShareFromAccount}
                    onChange={(e) => setDeductUserShareFromAccount(e.target.checked)}
                    className="rounded accent-emerald-500"
                  />
                  <span>Deduct my share from account:</span>
                </label>
                {deductUserShareFromAccount && (
                  <select
                    value={selectedAccountId}
                    onChange={(e) => setSelectedAccountId(e.target.value)}
                    className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none"
                  >
                    {accounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} ({formatCurrency(acc.balance)})
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}
          </div>

          {/* Split Mode Selector */}
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="font-semibold text-slate-400">Split Method:</span>
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
              {(['equal', 'exact', 'percentage'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setSplitMode(mode)}
                  className={`px-2.5 py-1 rounded-lg font-medium capitalize transition cursor-pointer ${
                    splitMode === mode
                      ? 'bg-indigo-600 text-white font-semibold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          {/* Participants Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Participants ({calculatedParticipants.length})</span>
              <span>
                Allocated: {formatCurrency(totalAllocated)} / {formatCurrency(billTotal)}
                {!isAllocationBalanced && splitMode !== 'equal' && (
                  <span className="text-rose-400 ml-1 font-bold">
                    (Diff: {formatCurrency(allocationDelta)})
                  </span>
                )}
              </span>
            </div>

            <div className="space-y-2">
              {calculatedParticipants.map((p, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-300 font-bold flex items-center justify-center text-[10px]">
                      {p.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="font-semibold text-white">
                      {p.name} {p.isUser && <span className="text-[10px] text-slate-400 font-normal">(You)</span>}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {splitMode === 'percentage' && (
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="1"
                          min="0"
                          max="100"
                          value={p.percentage || ''}
                          onChange={(e) =>
                            handleUpdateParticipantVal(idx, parseFloat(e.target.value) || 0, 'percentage')
                          }
                          className="w-14 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-right text-white"
                        />
                        <span className="text-slate-400">%</span>
                      </div>
                    )}

                    {splitMode === 'exact' ? (
                      <div className="flex items-center gap-1">
                        <span className="text-slate-500">{symbol}</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={p.amount || ''}
                          onChange={(e) =>
                            handleUpdateParticipantVal(idx, parseFloat(e.target.value) || 0, 'amount')
                          }
                          className="w-20 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-right text-white font-bold"
                        />
                      </div>
                    ) : (
                      <span className="font-bold text-white text-sm">
                        {formatCurrency(p.amount)}
                      </span>
                    )}

                    {!p.isUser && (
                      <button
                        type="button"
                        onClick={() => handleRemoveParticipant(idx)}
                        className="text-slate-500 hover:text-rose-400 p-1 rounded-md transition cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Quick Add Friend Input */}
            <div className="flex items-center gap-2 pt-1">
              <input
                type="text"
                value={newContactInput}
                placeholder="Add friend name (e.g. Alex)..."
                onChange={(e) => setNewContactInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddParticipant(newContactInput);
                  }
                }}
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
              <button
                type="button"
                onClick={() => handleAddParticipant(newContactInput)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold px-3 py-1.5 rounded-xl flex items-center gap-1 transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add</span>
              </button>
            </div>

            {/* Quick Contacts Chips */}
            {existingContacts.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[10px] text-slate-500">Quick pick:</span>
                {existingContacts.slice(0, 5).map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => handleAddParticipant(name)}
                    className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition cursor-pointer"
                  >
                    + {name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Social Settlement Hub (Payment Handle & Share) */}
          <div className="p-4 rounded-2xl bg-indigo-950/20 border border-indigo-500/30 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-indigo-300 flex items-center gap-1.5">
                <Share2 className="w-4 h-4 text-indigo-400" />
                Social Share &amp; Instant Settlement Links
              </span>
              <span className="text-[10px] text-indigo-400">WhatsApp • SMS • Telegram</span>
            </div>

            {/* Payment link config */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <select
                value={paymentHandleType}
                onChange={(e) => setPaymentHandleType(e.target.value as any)}
                className="bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none"
              >
                <option value="upi">UPI (India / SE Asia)</option>
                <option value="venmo">Venmo (@handle)</option>
                <option value="paypal">PayPal (paypal.me)</option>
                <option value="cashapp">Cash App ($cashtag)</option>
                <option value="generic">Bank / Other Note</option>
              </select>

              <div className="sm:col-span-2">
                <input
                  type="text"
                  value={paymentHandle}
                  placeholder={
                    paymentHandleType === 'upi'
                      ? 'yourname@okhdfcbank'
                      : paymentHandleType === 'venmo'
                      ? '@yourname'
                      : paymentHandleType === 'paypal'
                      ? 'username'
                      : 'Payment handle or account info'
                  }
                  onChange={(e) => handleSavePaymentHandle(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Share action buttons */}
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleCopyBreakdown}
                className="flex-1 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                {copiedBreakdown ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Copied Breakdown!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-slate-400" />
                    <span>Copy Breakdown Text</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleNativeShare}
                className="py-2 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition shadow-sm cursor-pointer"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Share via App</span>
              </button>
            </div>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="mt-5 pt-4 border-t border-slate-800 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white transition cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSyncToLedger}
            disabled={isSubmitting || billTotal <= 0}
            className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition shadow-lg shadow-emerald-500/20 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Check className="w-4 h-4" />
            )}
            <span>Sync Split to Social Ledger</span>
          </button>
        </div>
      </div>
    </div>
  );
};
