import React, { useMemo } from 'react';
import type { Account, Transaction } from '../types';
import { Wallet, TrendingUp, TrendingDown, PiggyBank } from 'lucide-react';

interface MetricCardsProps {
  accounts: Account[];
  transactions: Transaction[];
}

export const MetricCards: React.FC<MetricCardsProps> = ({ accounts, transactions }) => {
  // Calculate total balance
  const totalBalance = accounts.reduce((sum, acc) => sum + Number(acc.balance || 0), 0);

  // Current month filter (YYYY-MM)
  const currentMonth = useMemo(() => new Date().toISOString().slice(0, 7), []);
  const currentMonthTransactions = transactions.filter((t) =>
    t.transaction_date.startsWith(currentMonth)
  );

  const monthlyIncome = currentMonthTransactions
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + Number(t.amount || 0), 0);

  const monthlyExpense = currentMonthTransactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + Number(t.amount || 0), 0);

  const netSavings = monthlyIncome - monthlyExpense;

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(val);
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Total Balance */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Total Net Worth
          </span>
          <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <Wallet className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-3">
          <div className="text-2xl font-bold text-white tracking-tight">
            {formatCurrency(totalBalance)}
          </div>
          <div className="text-xs text-slate-500 mt-1">Across {accounts.length} active accounts</div>
        </div>
      </div>

      {/* Monthly Income */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            This Month Income
          </span>
          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-3">
          <div className="text-2xl font-bold text-emerald-400 tracking-tight">
            +{formatCurrency(monthlyIncome)}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {currentMonthTransactions.filter((t) => t.type === 'income').length} income events
          </div>
        </div>
      </div>

      {/* Monthly Expenses */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            This Month Expenses
          </span>
          <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <TrendingDown className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-3">
          <div className="text-2xl font-bold text-rose-400 tracking-tight">
            -{formatCurrency(monthlyExpense)}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {currentMonthTransactions.filter((t) => t.type === 'expense').length} expense events
          </div>
        </div>
      </div>

      {/* Net Savings */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Net Savings
          </span>
          <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <PiggyBank className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-3">
          <div
            className={`text-2xl font-bold tracking-tight ${
              netSavings >= 0 ? 'text-purple-400' : 'text-rose-400'
            }`}
          >
            {formatCurrency(netSavings)}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {monthlyIncome > 0
              ? `${Math.round((netSavings / monthlyIncome) * 100)}% savings rate`
              : 'No income recorded this month'}
          </div>
        </div>
      </div>
    </div>
  );
};
