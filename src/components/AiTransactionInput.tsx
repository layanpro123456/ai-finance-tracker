import React, { useState } from 'react';
import type { Account, Category } from '../types';
import { parseTransaction, supabase, type ParsedTransaction } from '../supabaseClient';
import { usePreferences } from '../context/PreferencesContext';
import { CurrencyLogo } from './CurrencyLogo';
import { Sparkles, ArrowRight, Check, X, AlertCircle, Loader2 } from 'lucide-react';

interface AiTransactionInputProps {
  userId: string;
  accounts: Account[];
  categories: Category[];
  onTransactionSaved: () => void;
}

export const AiTransactionInput: React.FC<AiTransactionInputProps> = ({
  userId,
  accounts,
  categories,
  onTransactionSaved,
}) => {
  const { preferences, formatCurrency } = usePreferences();
  const [prompt, setPrompt] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Review state
  const [parsedItem, setParsedItem] = useState<ParsedTransaction | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [editedAmount, setEditedAmount] = useState<number>(0);
  const [editedType, setEditedType] = useState<'income' | 'expense'>('expense');
  const [editedDescription, setEditedDescription] = useState<string>('');
  const [editedDate, setEditedDate] = useState<string>('');

  // ERP Cross-Module Bridges
  const [alsoCreateAsset, setAlsoCreateAsset] = useState(false);
  const [alsoCreateTask, setAlsoCreateTask] = useState(false);

  const samplePrompts = [
    `Spent ${preferences.currencySymbol}14.50 on lunch at Chipotle today`,
    `Paid ${preferences.currencySymbol}82 for groceries at supermarket`,
    `Bought ${preferences.currencySymbol}1,200 Mirrorless Camera on credit card`,
    `Received ${preferences.currencySymbol}3,200 monthly salary deposit`,
    `Paid ${preferences.currencySymbol}65 for car maintenance`,
  ];

  const handleParse = async (inputPrompt?: string) => {
    const textToParse = inputPrompt || prompt;
    if (!textToParse.trim()) return;

    setIsParsing(true);
    setError(null);
    setParsedItem(null);

    try {
      const result = await parseTransaction(textToParse);

      // Pre-fill review form
      setParsedItem(result);
      setEditedAmount(result.amount);
      setEditedType(result.type);
      setEditedDescription(result.description);
      setEditedDate(result.transaction_date || new Date().toISOString().split('T')[0]);

      // Find matching category or default
      const matchedCategory = categories.find(
        (c) => c.name.toLowerCase() === result.category?.toLowerCase()
      );
      if (matchedCategory) {
        setSelectedCategoryId(matchedCategory.id);
      } else if (categories.length > 0) {
        setSelectedCategoryId(categories[0].id);
      }

      // Default to first account
      if (accounts.length > 0 && !selectedAccountId) {
        setSelectedAccountId(accounts[0].id);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to parse natural language prompt';
      setError(msg);
    } finally {
      setIsParsing(false);
    }
  };

  const handleSaveTransaction = async () => {
    if (!selectedAccountId) {
      setError('Please select an account for this transaction.');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      // 1. Insert transaction
      const { error: insertError } = await supabase.from('transactions').insert({
        user_id: userId,
        account_id: selectedAccountId,
        category_id: selectedCategoryId || null,
        amount: editedAmount,
        type: editedType,
        description: editedDescription,
        raw_prompt: parsedItem?.raw_prompt || prompt,
        transaction_date: editedDate,
      });

      if (insertError) throw insertError;

      // 2. ERP Cross-Module Bridge: Auto-register Personal Asset
      if (alsoCreateAsset && editedType === 'expense' && editedAmount > 0) {
        try {
          await supabase.from('personal_assets').insert({
            user_id: userId,
            name: editedDescription,
            purchase_price: editedAmount,
            current_value: editedAmount,
            purchase_date: editedDate,
            category: 'Electronics',
            status: 'active',
          });
        } catch (assetErr) {
          console.warn('Auto-asset registration error:', assetErr);
        }
      }

      // 3. ERP Cross-Module Bridge: Auto-create Task
      if (alsoCreateTask) {
        try {
          await supabase.from('tasks').insert({
            user_id: userId,
            title: `Follow-up: ${editedDescription}`,
            amount: editedAmount,
            status: 'todo',
            priority: 'medium',
            is_financial: false,
          });
        } catch (taskErr) {
          console.warn('Auto-task creation error:', taskErr);
        }
      }

      // 4. Update account balance
      const account = accounts.find((a) => a.id === selectedAccountId);
      if (account) {
        const delta = editedType === 'income' ? editedAmount : -editedAmount;
        const newBalance = Number(account.balance) + delta;

        const { error: updateError } = await supabase
          .from('accounts')
          .update({ balance: newBalance })
          .eq('id', selectedAccountId);

        if (updateError) {
          console.warn('Could not update account balance:', updateError.message);
        }
      }

      // Reset state and notify parent
      setParsedItem(null);
      setPrompt('');
      setAlsoCreateAsset(false);
      setAlsoCreateTask(false);
      onTransactionSaved();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save transaction';
      setError(msg);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
      {/* Decorative gradient header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-xl bg-gradient-to-tr from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 text-emerald-400">
          <Sparkles className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight">AI Natural Language Logger</h2>
          <p className="text-xs text-slate-400">
            Type anything like &ldquo;Spent {preferences.currencySymbol}14.50 on lunch at Chipotle today&rdquo;
          </p>
        </div>
      </div>

      {/* Input bar */}
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleParse()}
          placeholder={`e.g. Paid ${preferences.currencySymbol}65 for groceries or Spent ${preferences.currencySymbol}14.50 on lunch...`}
          className="flex-1 bg-slate-950 border border-slate-850 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition"
        />
        <button
          onClick={() => handleParse()}
          disabled={isParsing || !prompt.trim()}
          className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-semibold px-5 py-3 rounded-xl shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 transition disabled:opacity-50 cursor-pointer text-sm flex-shrink-0"
        >
          {isParsing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Analyzing...</span>
            </>
          ) : (
            <>
              <span>Parse with AI</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>

      {/* Quick click suggestions */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-slate-500 mr-1">Try example:</span>
        {samplePrompts.map((p, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => {
              setPrompt(p);
              handleParse(p);
            }}
            className="text-xs bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 px-2.5 py-1 rounded-lg border border-slate-700/60 transition cursor-pointer"
          >
            &ldquo;{p}&rdquo;
          </button>
        ))}
      </div>

      {error && (
        <div className="mt-4 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* AI Parsed Review Dialog */}
      {parsedItem && (
        <div className="mt-6 p-5 rounded-2xl bg-slate-950 border border-emerald-500/30 relative">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Check className="w-3.5 h-3.5" />
                AI Extraction Ready
              </span>
              <span className="text-xs text-slate-400">Review &amp; Confirm</span>
            </div>
            <button
              onClick={() => setParsedItem(null)}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-left">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                Description
              </label>
              <input
                type="text"
                value={editedDescription}
                onChange={(e) => setEditedDescription(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1.5">
                <span>Amount</span>
                <CurrencyLogo variant="badge" />
              </label>
              <div className="relative">
                <CurrencyLogo variant="input-prefix" />
                <input
                  type="number"
                  step="0.01"
                  value={editedAmount}
                  onChange={(e) => setEditedAmount(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-8 pr-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                Type
              </label>
              <select
                value={editedType}
                onChange={(e) => setEditedType(e.target.value as 'income' | 'expense')}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="expense">Expense (-)</option>
                <option value="income">Income (+)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                Category
              </label>
              <select
                value={selectedCategoryId}
                onChange={(e) => setSelectedCategoryId(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name} ({cat.type})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                Account
              </label>
              <select
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                {accounts.length === 0 ? (
                  <option value="">No accounts found (Create one below)</option>
                ) : (
                  accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({formatCurrency(Number(acc.balance))})
                    </option>
                  ))
                )}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                Date
              </label>
              <input
                type="date"
                value={editedDate}
                onChange={(e) => setEditedDate(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* ERP Cross-Module Bridges */}
          <div className="mt-4 pt-3 border-t border-slate-850 flex flex-col sm:flex-row gap-4 text-xs text-slate-300">
            {editedType === 'expense' && (
              <label className="flex items-center gap-2 cursor-pointer hover:text-white transition">
                <input
                  type="checkbox"
                  checked={alsoCreateAsset}
                  onChange={(e) => setAlsoCreateAsset(e.target.checked)}
                  className="rounded border-slate-700 text-emerald-500 focus:ring-emerald-500/20"
                />
                <span>Also register as <strong>Personal Asset</strong> (Vault &amp; Net Worth)</span>
              </label>
            )}

            <label className="flex items-center gap-2 cursor-pointer hover:text-white transition">
              <input
                type="checkbox"
                checked={alsoCreateTask}
                onChange={(e) => setAlsoCreateTask(e.target.checked)}
                className="rounded border-slate-700 text-emerald-500 focus:ring-emerald-500/20"
              />
              <span>Also add <strong>Follow-up Task</strong> in Operations</span>
            </label>
          </div>

          <div className="mt-5 flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              onClick={() => setParsedItem(null)}
              className="text-xs px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveTransaction}
              disabled={isSaving || accounts.length === 0}
              className="text-xs px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold shadow-lg shadow-emerald-500/20 flex items-center gap-1.5 transition disabled:opacity-50 cursor-pointer"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Confirm &amp; Save Transaction</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
