import React, { useState, useMemo } from 'react';
import type { Account, Category, Transaction } from '../types';
import { supabase } from '../supabaseClient';
import { usePreferences } from '../context/PreferencesContext';
import {
  Banknote,
  ArrowDownToLine,
  ArrowUpFromLine,
  Coins,
  Wallet,
  Plus,
  Minus,
  AlertCircle,
  Loader2,
  Receipt,
  Scale,
  X,
  RotateCcw,
  Mic,
  MicOff,
} from 'lucide-react';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';

interface CashManagerProps {
  userId: string;
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  onDataUpdated: () => void;
}

export const CashManager: React.FC<CashManagerProps> = ({
  userId,
  accounts,
  categories,
  transactions,
  onDataUpdated,
}) => {
  const { preferences, formatCurrency } = usePreferences();
  const symbol = preferences.currencySymbol || '$';

  // 1. Locate or define the dedicated "In-Hand Cash" account
  const inHandCashAccount = useMemo(() => {
    return (
      accounts.find((a) => /\b(cash|in-hand|wallet|petty)\b/i.test(a.name)) ||
      null
    );
  }, [accounts]);

  const bankAccounts = useMemo(() => {
    return accounts.filter((a) => a.id !== inHandCashAccount?.id);
  }, [accounts, inHandCashAccount]);

  const inHandBalance = Number(inHandCashAccount?.balance || 0);
  const totalBankBalance = bankAccounts.reduce((sum, a) => sum + Number(a.balance || 0), 0);
  const totalLiquid = inHandBalance + totalBankBalance;
  const cashPercent = totalLiquid > 0 ? Math.round((inHandBalance / totalLiquid) * 100) : 0;

  // Modals state
  const [showAtmModal, setShowAtmModal] = useState<boolean>(false);
  const [showDepositModal, setShowDepositModal] = useState<boolean>(false);
  const [showSpendModal, setShowSpendModal] = useState<boolean>(false);
  const [showAuditModal, setShowAuditModal] = useState<boolean>(false);
  const [isInitializingCash, setIsInitializingCash] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Form states: ATM Withdrawal
  const [atmSourceAccountId, setAtmSourceAccountId] = useState<string>(bankAccounts[0]?.id || '');
  const [atmAmount, setAtmAmount] = useState<number>(0);
  const [atmFee, setAtmFee] = useState<number>(0);
  const [atmLocation, setAtmLocation] = useState<string>('');

  // Form states: Deposit to Bank
  const [depositDestAccountId, setDepositDestAccountId] = useState<string>(bankAccounts[0]?.id || '');
  const [depositAmount, setDepositAmount] = useState<number>(0);

  // Form states: Quick Cash Spend
  const [spendDescription, setSpendDescription] = useState<string>('');
  const [spendAmount, setSpendAmount] = useState<number>(0);
  const [spendCategoryId, setSpendCategoryId] = useState<string>(categories[0]?.id || '');
  const [spendDate, setSpendDate] = useState<string>(() => new Date().toISOString().split('T')[0]);

  // Voice input for Quick Cash Spend
  const {
    isSupported: isCashVoiceSupported,
    isListening: isCashVoiceListening,
    startListening: startCashVoice,
    stopListening: stopCashVoice,
  } = useSpeechRecognition({
    continuous: false,
    interimResults: true,
    onResult: (text) => {
      if (text) {
        setSpendDescription(text);
      }
    },
  });

  // Form states: Physical Denomination Audit
  // Multipliers for counting
  const denominationValues = useMemo(() => {
    if (['LKR', 'INR', 'PKR', 'BDT', 'JPY', 'KRW'].includes(preferences.currency)) {
      return [5000, 1000, 500, 100, 50, 20, 10];
    }
    return [100, 50, 20, 10, 5, 2, 1];
  }, [preferences.currency]);

  const [denominationCounts, setDenominationCounts] = useState<Record<number, number>>({});

  const countedTotal = useMemo(() => {
    return Object.entries(denominationCounts).reduce((sum, [denom, count]) => {
      return sum + Number(denom) * (Number(count) || 0);
    }, 0);
  }, [denominationCounts]);

  const auditVariance = countedTotal - inHandBalance;

  // Filter for Cash Transactions
  const [historyFilter, setHistoryFilter] = useState<'all' | 'atm' | 'spend' | 'deposit'>('all');

  const cashTransactions = useMemo(() => {
    if (!inHandCashAccount) return [];
    return transactions.filter((t) => {
      const isRelated =
        t.account_id === inHandCashAccount.id ||
        t.description.toLowerCase().includes('atm') ||
        t.description.toLowerCase().includes('cash');

      if (!isRelated) return false;

      if (historyFilter === 'atm') return t.description.toLowerCase().includes('atm');
      if (historyFilter === 'deposit') return t.description.toLowerCase().includes('deposit');
      if (historyFilter === 'spend') return t.type === 'expense';
      return true;
    });
  }, [transactions, inHandCashAccount, historyFilter]);

  // Ensure "In-Hand Cash" Account exists helper
  const getOrCreateCashAccount = async (): Promise<Account> => {
    if (inHandCashAccount) return inHandCashAccount;

    const { data: created, error: createError } = await supabase
      .from('accounts')
      .insert({
        user_id: userId,
        name: 'In-Hand Cash (Physical Wallet)',
        balance: 0,
        currency: preferences.currency || 'USD',
      })
      .select()
      .single();

    if (createError) throw createError;
    return created as Account;
  };

  // 1-Click Initialize Cash Account button
  const handleInitializeCashAccount = async () => {
    setIsInitializingCash(true);
    setError(null);
    try {
      await getOrCreateCashAccount();
      onDataUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create cash account');
    } finally {
      setIsInitializingCash(false);
    }
  };

  // 🏧 Execute ATM Cash Withdrawal
  const handleExecuteAtmWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (atmAmount <= 0) {
      setError('Please enter a valid withdrawal amount.');
      return;
    }
    if (!atmSourceAccountId) {
      setError('Please select the bank account from which you withdrew cash.');
      return;
    }

    const sourceAccount = accounts.find((a) => a.id === atmSourceAccountId);
    if (!sourceAccount) return;

    const totalToDeduct = atmAmount + (atmFee > 0 ? atmFee : 0);
    if (Number(sourceAccount.balance) < totalToDeduct) {
      if (
        !window.confirm(
          `Withdrawal amount (${formatCurrency(totalToDeduct)}) exceeds the available balance of ${sourceAccount.name} (${formatCurrency(sourceAccount.balance)}). Proceed anyway?`
        )
      ) {
        return;
      }
    }

    setSubmitting(true);
    setError(null);

    try {
      const cashAcc = await getOrCreateCashAccount();
      const today = new Date().toISOString().split('T')[0];
      const atmLabel = atmLocation.trim() ? ` (${atmLocation.trim()})` : '';

      // 1. Deduct from Bank Account
      const newBankBalance = Number(sourceAccount.balance) - totalToDeduct;
      const { error: bankErr } = await supabase
        .from('accounts')
        .update({ balance: newBankBalance })
        .eq('id', sourceAccount.id);
      if (bankErr) throw bankErr;

      // 2. Add to In-Hand Cash Account
      const newCashBalance = Number(cashAcc.balance) + atmAmount;
      const { error: cashErr } = await supabase
        .from('accounts')
        .update({ balance: newCashBalance })
        .eq('id', cashAcc.id);
      if (cashErr) throw cashErr;

      // 3. Log Transfer Transaction on Bank Account
      const { error: tx1Err } = await supabase.from('transactions').insert({
        user_id: userId,
        account_id: sourceAccount.id,
        amount: atmAmount,
        type: 'expense',
        description: `[ATM Cash Out] Withdrew cash to wallet${atmLabel}`,
        transaction_date: today,
      });
      if (tx1Err) throw tx1Err;

      // 4. Log Inflow Transaction on Cash Account
      const { error: tx2Err } = await supabase.from('transactions').insert({
        user_id: userId,
        account_id: cashAcc.id,
        amount: atmAmount,
        type: 'income',
        description: `[ATM Cash In] Pocketed cash from ${sourceAccount.name}${atmLabel}`,
        transaction_date: today,
      });
      if (tx2Err) throw tx2Err;

      // 5. If there was an ATM Operator Fee, record it as a standalone expense
      if (atmFee > 0) {
        await supabase.from('transactions').insert({
          user_id: userId,
          account_id: sourceAccount.id,
          amount: atmFee,
          type: 'expense',
          description: `[ATM Operator Fee] Surcharge at ATM${atmLabel}`,
          transaction_date: today,
        });
      }

      setShowAtmModal(false);
      setAtmAmount(0);
      setAtmFee(0);
      setAtmLocation('');
      onDataUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ATM withdrawal failed');
    } finally {
      setSubmitting(false);
    }
  };

  // 🏦 Execute Deposit Cash to Bank
  const handleExecuteCashDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (depositAmount <= 0) {
      setError('Please enter a valid deposit amount.');
      return;
    }
    if (!depositDestAccountId) {
      setError('Please select destination bank account.');
      return;
    }
    if (!inHandCashAccount || inHandBalance < depositAmount) {
      if (!window.confirm('Deposit amount exceeds your recorded in-hand cash balance. Proceed anyway?')) {
        return;
      }
    }

    const destAccount = accounts.find((a) => a.id === depositDestAccountId);
    if (!destAccount || !inHandCashAccount) return;

    setSubmitting(true);
    setError(null);

    try {
      const today = new Date().toISOString().split('T')[0];

      // 1. Deduct from In-Hand Cash
      const newCashBalance = Number(inHandCashAccount.balance) - depositAmount;
      await supabase.from('accounts').update({ balance: newCashBalance }).eq('id', inHandCashAccount.id);

      // 2. Add to Bank Account
      const newBankBalance = Number(destAccount.balance) + depositAmount;
      await supabase.from('accounts').update({ balance: newBankBalance }).eq('id', destAccount.id);

      // 3. Log Outflow from Cash
      await supabase.from('transactions').insert({
        user_id: userId,
        account_id: inHandCashAccount.id,
        amount: depositAmount,
        type: 'expense',
        description: `[Bank Cash Deposit] Deposited physical cash into ${destAccount.name}`,
        transaction_date: today,
      });

      // 4. Log Inflow to Bank
      await supabase.from('transactions').insert({
        user_id: userId,
        account_id: destAccount.id,
        amount: depositAmount,
        type: 'income',
        description: `[Cash Deposit] Received cash from In-Hand Wallet`,
        transaction_date: today,
      });

      setShowDepositModal(false);
      setDepositAmount(0);
      onDataUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cash deposit failed');
    } finally {
      setSubmitting(false);
    }
  };

  // ⚡ Execute Quick Cash Spend
  const handleExecuteCashSpend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (spendAmount <= 0) {
      setError('Please enter a valid spending amount.');
      return;
    }
    if (!spendDescription.trim()) {
      setError('Please provide a description.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const cashAcc = await getOrCreateCashAccount();

      // 1. Insert transaction
      const { error: txErr } = await supabase.from('transactions').insert({
        user_id: userId,
        account_id: cashAcc.id,
        category_id: spendCategoryId || null,
        amount: spendAmount,
        type: 'expense',
        description: `[Cash] ${spendDescription.trim()}`,
        transaction_date: spendDate,
      });
      if (txErr) throw txErr;

      // 2. Deduct from Cash account
      const newBal = Number(cashAcc.balance) - spendAmount;
      await supabase.from('accounts').update({ balance: newBal }).eq('id', cashAcc.id);

      setShowSpendModal(false);
      setSpendAmount(0);
      setSpendDescription('');
      onDataUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record cash expense');
    } finally {
      setSubmitting(false);
    }
  };

  // 🧮 Reconcile Cash Variance
  const handleReconcileWallet = async () => {
    if (!inHandCashAccount) return;
    if (auditVariance === 0) {
      alert('Wallet is already 100% balanced with system recorded cash!');
      return;
    }

    setSubmitting(true);
    try {
      const today = new Date().toISOString().split('T')[0];

      // 1. Update in-hand cash account balance directly to counted total
      await supabase.from('accounts').update({ balance: countedTotal }).eq('id', inHandCashAccount.id);

      // 2. Log reconciliation transaction
      const isShortfall = auditVariance < 0;
      await supabase.from('transactions').insert({
        user_id: userId,
        account_id: inHandCashAccount.id,
        amount: Math.abs(auditVariance),
        type: isShortfall ? 'expense' : 'income',
        description: `[Cash Wallet Audit] ${isShortfall ? 'Shortfall adjusted' : 'Surplus found'} (${formatCurrency(Math.abs(auditVariance))})`,
        transaction_date: today,
      });

      setShowAuditModal(false);
      onDataUpdated();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Reconciliation failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Banner / Missing Cash Account Prompt */}
      {!inHandCashAccount && (
        <div className="p-4 sm:p-5 rounded-3xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-amber-200 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-500/20 text-amber-300">
              <Banknote className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-amber-100">
                In-Hand Physical Wallet Not Initialized
              </h3>
              <p className="text-xs text-amber-300/80 mt-0.5">
                Enable physical cash tracking to monitor ATM withdrawals, petty cash, and pocket funds separately from bank accounts.
              </p>
            </div>
          </div>
          <button
            onClick={handleInitializeCashAccount}
            disabled={isInitializingCash}
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-2 transition cursor-pointer self-start sm:self-auto shrink-0 shadow-md"
          >
            {isInitializingCash ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            <span>Initialize Cash Wallet</span>
          </button>
        </div>
      )}

      {/* 4-KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* In Hand Cash */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
              Cash in Hand (Wallet)
            </span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Banknote className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-white tracking-tight">
              {formatCurrency(inHandBalance)}
            </div>
            <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Physical pocket cash</span>
            </div>
          </div>
        </div>

        {/* Liquid Bank Accounts */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider">
              Bank Accounts (Digital)
            </span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-white tracking-tight">
              {formatCurrency(totalBankBalance)}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              {bankAccounts.length} checking &amp; savings accounts
            </div>
          </div>
        </div>

        {/* Cash vs Bank Ratio */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">
              Cash Liquidity Ratio
            </span>
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Scale className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-white tracking-tight">
              {cashPercent}% <span className="text-xs font-normal text-slate-400">Cash in Hand</span>
            </div>
            <div className="w-full bg-slate-950 h-2 rounded-full mt-2 overflow-hidden border border-slate-800">
              <div
                style={{ width: `${Math.min(100, cashPercent)}%` }}
                className="bg-emerald-500 h-full transition-all"
              />
            </div>
          </div>
        </div>

        {/* Quick Action Hub Indicator */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">
              ATM &amp; Cash Status
            </span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Coins className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-sm font-bold text-white">
              {inHandBalance > 0 ? 'Cash Available' : 'No Cash in Hand'}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Use 1-click ATM Cash-out to pocket cash without skewing expenses.
            </p>
          </div>
        </div>
      </div>

      {/* Main Operations Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
              <span>In-Hand Cash &amp; ATM Operations</span>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Physical Wallet
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Withdraw money at ATMs, spend cash on street vendors, and audit physical bills in your wallet.
            </p>
          </div>

          {/* 4 Operations Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setShowAtmModal(true)}
              className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition shadow-lg shadow-emerald-500/20 cursor-pointer"
            >
              <ArrowDownToLine className="w-4 h-4" />
              <span>Withdraw from ATM</span>
            </button>

            <button
              onClick={() => setShowDepositModal(true)}
              disabled={inHandBalance <= 0}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs flex items-center gap-1.5 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <ArrowUpFromLine className="w-4 h-4 text-blue-400" />
              <span>Deposit to Bank</span>
            </button>

            <button
              onClick={() => setShowSpendModal(true)}
              className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center gap-1.5 transition shadow-sm cursor-pointer"
            >
              <Receipt className="w-4 h-4" />
              <span>Spend Cash</span>
            </button>

            <button
              onClick={() => setShowAuditModal(true)}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs flex items-center gap-1.5 transition cursor-pointer"
              title="Audit and count physical bills in your wallet"
            >
              <Scale className="w-4 h-4 text-amber-400" />
              <span>Count Wallet</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Cash History & ATM Feed */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Banknote className="w-4 h-4 text-emerald-400" />
              <span>Cash Flow &amp; ATM Ledger Feed</span>
            </h3>

            {/* Filter */}
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
              {(['all', 'atm', 'spend', 'deposit'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setHistoryFilter(mode)}
                  className={`px-3 py-1 rounded-lg font-medium capitalize transition cursor-pointer ${
                    historyFilter === mode
                      ? 'bg-slate-800 text-white font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {mode === 'all' ? 'All Cash' : mode === 'atm' ? 'ATM Withdrawals' : mode === 'spend' ? 'Cash Spent' : 'Deposits'}
                </button>
              ))}
            </div>
          </div>

          {cashTransactions.length === 0 ? (
            <div className="text-center py-12 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-2">
              <Coins className="w-8 h-8 text-slate-600 mx-auto" />
              <p className="text-xs text-slate-400 font-medium">No cash transactions recorded yet</p>
              <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                Withdraw money at an ATM or log a small street cash expense to start populating your cash timeline.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {cashTransactions.slice(0, 15).map((t) => {
                const isAtm = t.description.toLowerCase().includes('atm');
                const isDeposit = t.description.toLowerCase().includes('deposit');
                const isIncome = t.type === 'income';

                return (
                  <div
                    key={t.id}
                    className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800/80 hover:border-slate-700 transition flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`p-2 rounded-xl shrink-0 ${
                          isAtm
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : isDeposit
                            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}
                      >
                        {isAtm ? (
                          <ArrowDownToLine className="w-4 h-4" />
                        ) : isDeposit ? (
                          <ArrowUpFromLine className="w-4 h-4" />
                        ) : (
                          <Receipt className="w-4 h-4" />
                        )}
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-white">
                          {t.description}
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                          <span>{t.transaction_date}</span>
                          <span>•</span>
                          <span className="capitalize">{t.categories?.name || 'Cash Transfer'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span
                        className={`text-sm font-bold font-mono ${
                          isIncome ? 'text-emerald-400' : 'text-white'
                        }`}
                      >
                        {isIncome ? '+' : '-'}
                        {formatCurrency(t.amount)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ===================================================================== */}
      {/* MODAL 1: WITHDRAW CASH FROM ATM */}
      {/* ===================================================================== */}
      {showAtmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl relative space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
                  <ArrowDownToLine className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Withdraw Cash from ATM</h3>
                  <p className="text-xs text-slate-400">Transfers money from your bank account into your physical wallet.</p>
                </div>
              </div>
              <button
                onClick={() => setShowAtmModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleExecuteAtmWithdrawal} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Source Bank Account (Card used at ATM) *
                </label>
                <select
                  value={atmSourceAccountId}
                  onChange={(e) => setAtmSourceAccountId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                >
                  {bankAccounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({formatCurrency(acc.balance)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Withdrawal Amount ({symbol}) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  required
                  placeholder="0.00"
                  value={atmAmount || ''}
                  onChange={(e) => setAtmAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm font-bold text-white focus:outline-none focus:border-emerald-500"
                />

                {/* Quick amount chips */}
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  <span className="text-[10px] text-slate-500">Quick pick:</span>
                  {[20, 50, 100, 200, 500].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setAtmAmount(amt)}
                      className="text-[10px] px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition cursor-pointer"
                    >
                      {symbol}{amt}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    ATM Operator Fee (if any)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={atmFee || ''}
                    onChange={(e) => setAtmFee(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    ATM Location / Notes
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Airport ATM, Chase Bank"
                    value={atmLocation}
                    onChange={(e) => setAtmLocation(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white"
                  />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1">
                <div className="flex justify-between text-slate-400">
                  <span>Cash arriving in Hand:</span>
                  <span className="font-bold text-emerald-400">+{formatCurrency(atmAmount)}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Deduction from Bank:</span>
                  <span className="font-bold text-rose-400">-{formatCurrency(atmAmount + atmFee)}</span>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAtmModal(false)}
                  className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || atmAmount <= 0}
                  className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition shadow-lg shadow-emerald-500/20 disabled:opacity-40 cursor-pointer"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Confirm ATM Cash-Out</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 2: DEPOSIT CASH TO BANK */}
      {/* ===================================================================== */}
      {showDepositModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl relative space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
                  <ArrowUpFromLine className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Deposit Cash into Bank</h3>
                  <p className="text-xs text-slate-400">Transfers physical cash from your wallet into a bank account.</p>
                </div>
              </div>
              <button
                onClick={() => setShowDepositModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleExecuteCashDeposit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Destination Bank Account *
                </label>
                <select
                  value={depositDestAccountId}
                  onChange={(e) => setDepositDestAccountId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                >
                  {bankAccounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({formatCurrency(acc.balance)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-semibold text-slate-300">Deposit Amount ({symbol}) *</span>
                  <button
                    type="button"
                    onClick={() => setDepositAmount(inHandBalance)}
                    className="text-[11px] text-blue-400 hover:underline cursor-pointer"
                  >
                    Deposit All ({formatCurrency(inHandBalance)})
                  </button>
                </div>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  max={inHandBalance}
                  required
                  placeholder="0.00"
                  value={depositAmount || ''}
                  onChange={(e) => setDepositAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm font-bold text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowDepositModal(false)}
                  className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || depositAmount <= 0}
                  className="px-5 py-2 rounded-xl bg-blue-500 hover:bg-blue-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition shadow-lg shadow-blue-500/20 disabled:opacity-40 cursor-pointer"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Confirm Cash Deposit</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 3: QUICK CASH SPEND LOGGER */}
      {/* ===================================================================== */}
      {showSpendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl relative space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Log Physical Cash Expense</h3>
                  <p className="text-xs text-slate-400">Deducts immediately from your In-Hand Cash wallet.</p>
                </div>
              </div>
              <button
                onClick={() => setShowSpendModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleExecuteCashSpend} className="space-y-4">
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-semibold text-slate-300">Description / What was purchased *</span>
                  {isCashVoiceSupported && (
                    <button
                      type="button"
                      onClick={() => {
                        if (isCashVoiceListening) {
                          stopCashVoice();
                        } else {
                          startCashVoice();
                        }
                      }}
                      className={`flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-lg transition cursor-pointer ${
                        isCashVoiceListening
                          ? 'bg-rose-500 text-white animate-pulse'
                          : 'bg-slate-800 text-emerald-400 hover:text-emerald-300'
                      }`}
                      title={isCashVoiceListening ? 'Stop Voice Typing' : 'Voice Dictate Description'}
                    >
                      {isCashVoiceListening ? <MicOff className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
                      <span>{isCashVoiceListening ? 'Listening...' : 'Voice'}</span>
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  required
                  placeholder={
                    isCashVoiceListening
                      ? '🎙️ Listening... Speak purchase description'
                      : 'e.g. Street food, Parking meter, Barber tip'
                  }
                  value={spendDescription}
                  onChange={(e) => setSpendDescription(e.target.value)}
                  className={`w-full bg-slate-950 border rounded-xl px-3 py-2 text-xs text-white transition ${
                    isCashVoiceListening ? 'border-rose-500 ring-1 ring-rose-500/50' : 'border-slate-800'
                  }`}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Amount ({symbol}) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    placeholder="0.00"
                    value={spendAmount || ''}
                    onChange={(e) => setSpendAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Category
                  </label>
                  <select
                    value={spendCategoryId}
                    onChange={(e) => setSpendCategoryId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Transaction Date
                </label>
                <input
                  type="date"
                  value={spendDate}
                  onChange={(e) => setSpendDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowSpendModal(false)}
                  className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || spendAmount <= 0}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 transition shadow-sm cursor-pointer"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Record Cash Spend</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 4: PHYSICAL WALLET DENOMINATION AUDIT */}
      {/* ===================================================================== */}
      {showAuditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl relative space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
                  <Scale className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Count My Physical Wallet</h3>
                  <p className="text-xs text-slate-400">Reconcile bills in your wallet with the recorded system balance.</p>
                </div>
              </div>
              <button
                onClick={() => setShowAuditModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Bill counter grid */}
            <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
              <div className="grid grid-cols-2 gap-2 text-xs">
                {denominationValues.map((val) => {
                  const currentCount = denominationCounts[val] || 0;
                  return (
                    <div
                      key={val}
                      className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between"
                    >
                      <span className="font-bold text-white">
                        {symbol}{val} bill
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            setDenominationCounts((prev) => ({
                              ...prev,
                              [val]: Math.max(0, (prev[val] || 0) - 1),
                            }))
                          }
                          className="w-6 h-6 rounded-lg bg-slate-800 text-slate-300 hover:text-white flex items-center justify-center cursor-pointer"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <input
                          type="number"
                          min="0"
                          value={currentCount || ''}
                          placeholder="0"
                          onChange={(e) =>
                            setDenominationCounts((prev) => ({
                              ...prev,
                              [val]: Math.max(0, parseInt(e.target.value) || 0),
                            }))
                          }
                          className="w-10 text-center bg-slate-900 border border-slate-700 rounded-lg py-0.5 text-xs text-white font-bold"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setDenominationCounts((prev) => ({
                              ...prev,
                              [val]: (prev[val] || 0) + 1,
                            }))
                          }
                          className="w-6 h-6 rounded-lg bg-slate-800 text-slate-300 hover:text-white flex items-center justify-center cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Audit Summary Box */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>Physically Counted Total:</span>
                  <span className="font-bold text-white text-sm">{formatCurrency(countedTotal)}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>System Recorded Balance:</span>
                  <span className="font-semibold text-slate-300">{formatCurrency(inHandBalance)}</span>
                </div>
                <div className="pt-1 border-t border-slate-800/80 flex justify-between">
                  <span className="font-bold text-slate-300">Variance / Difference:</span>
                  <span
                    className={`font-bold ${
                      auditVariance === 0
                        ? 'text-emerald-400'
                        : auditVariance > 0
                        ? 'text-emerald-400'
                        : 'text-rose-400'
                    }`}
                  >
                    {auditVariance >= 0 ? '+' : ''}
                    {formatCurrency(auditVariance)}
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-between items-center gap-2">
              <button
                type="button"
                onClick={() => setDenominationCounts({})}
                className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset Counts</span>
              </button>

              <button
                type="button"
                onClick={handleReconcileWallet}
                disabled={submitting}
                className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition shadow-sm cursor-pointer"
              >
                {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Auto-Reconcile Balance</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
