import React, { useState, useMemo } from 'react';
import type { Transaction, Category } from '../types';
import { usePreferences } from '../context/PreferencesContext';
import { MonthlyExpensePieChart } from './MonthlyExpensePieChart';
import {
  Calendar,
  TrendingUp,
  TrendingDown,
  PiggyBank,
  History,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';

interface MonthlyStatsHistoryProps {
  transactions: Transaction[];
  categories: Category[];
  onNavigateToStats?: () => void;
}

export const MonthlyStatsHistory: React.FC<MonthlyStatsHistoryProps> = ({
  transactions,
  categories,
  onNavigateToStats,
}) => {
  const { formatCurrency } = usePreferences();

  // All unique recorded months from transactions (YYYY-MM), sorted descending
  const recordedMonths = useMemo(() => {
    const set = new Set<string>();
    transactions.forEach((t) => {
      if (t.transaction_date) {
        set.add(t.transaction_date.slice(0, 7));
      }
    });
    // Ensure current month is always present
    const currentM = new Date().toISOString().slice(0, 7);
    set.add(currentM);
    return Array.from(set).sort().reverse();
  }, [transactions]);

  // Selected active month in history
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    return recordedMonths[0] || new Date().toISOString().slice(0, 7);
  });

  // Calculate stats for all recorded months
  const monthlyAggregates = useMemo(() => {
    const map = new Map<
      string,
      {
        month: string;
        income: number;
        expenses: number;
        incomeCount: number;
        expenseCount: number;
        netSavings: number;
        savingsRate: number;
      }
    >();

    recordedMonths.forEach((m) => {
      map.set(m, {
        month: m,
        income: 0,
        expenses: 0,
        incomeCount: 0,
        expenseCount: 0,
        netSavings: 0,
        savingsRate: 0,
      });
    });

    transactions.forEach((t) => {
      const m = t.transaction_date?.slice(0, 7);
      if (!m) return;
      const stat = map.get(m);
      if (stat) {
        const amt = Number(t.amount || 0);
        if (t.type === 'income') {
          stat.income += amt;
          stat.incomeCount += 1;
        } else if (t.type === 'expense') {
          stat.expenses += amt;
          stat.expenseCount += 1;
        }
      }
    });

    // Compute net and rates
    map.forEach((stat) => {
      stat.netSavings = stat.income - stat.expenses;
      stat.savingsRate = stat.income > 0 ? (stat.netSavings / stat.income) * 100 : 0;
    });

    return map;
  }, [recordedMonths, transactions]);

  // Stats for the currently selected month
  const activeStats = useMemo(() => {
    return (
      monthlyAggregates.get(selectedMonth) || {
        month: selectedMonth,
        income: 0,
        expenses: 0,
        incomeCount: 0,
        expenseCount: 0,
        netSavings: 0,
        savingsRate: 0,
      }
    );
  }, [monthlyAggregates, selectedMonth]);

  // Format month string (e.g. "2026-11" -> "November 2026")
  const formatMonthLong = (mStr: string) => {
    try {
      const [year, month] = mStr.split('-');
      const date = new Date(Number(year), Number(month) - 1, 1);
      return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    } catch {
      return mStr;
    }
  };

  // Next / Prev Month Navigation
  const currentIndex = recordedMonths.indexOf(selectedMonth);
  const hasNewer = currentIndex > 0;
  const hasOlder = currentIndex < recordedMonths.length - 1;

  const handlePrevMonth = () => {
    if (hasOlder) {
      setSelectedMonth(recordedMonths[currentIndex + 1]);
    }
  };

  const handleNextMonth = () => {
    if (hasNewer) {
      setSelectedMonth(recordedMonths[currentIndex - 1]);
    }
  };

  return (
    <div className="space-y-5">
      {/* Overview Module Card Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
              <History className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white tracking-tight">
                  Monthly Performance &amp; History
                </h3>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-300 border border-sky-500/25">
                  Overview
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Browse historical monthly records, inspect expense categories, and monitor cashflow trends
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap self-stretch sm:self-auto justify-between sm:justify-end">
            {/* Quick Month Switcher */}
            <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-1 gap-1">
              <button
                type="button"
                onClick={handlePrevMonth}
                disabled={!hasOlder}
                title="Older Month"
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-850 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="relative">
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="bg-transparent text-xs font-semibold text-white px-2 py-0.5 focus:outline-none cursor-pointer"
                >
                  {recordedMonths.map((m) => (
                    <option key={m} value={m} className="bg-slate-900 text-white">
                      {formatMonthLong(m)}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={handleNextMonth}
                disabled={!hasNewer}
                title="Newer Month"
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-850 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {onNavigateToStats && (
              <button
                type="button"
                onClick={onNavigateToStats}
                className="text-xs font-semibold px-3 py-2 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 border border-sky-500/25 flex items-center gap-1.5 transition cursor-pointer"
              >
                <span>All Finance Stats</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Selected Month Key Metrics Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-5 pt-4 border-t border-slate-800/80">
          {/* Income */}
          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-850">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
              <span className="font-semibold uppercase tracking-wider text-[10px]">
                {formatMonthLong(selectedMonth)} Inflow
              </span>
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="text-lg font-bold text-emerald-400">
              +{formatCurrency(activeStats.income)}
            </div>
            <span className="text-[10px] text-slate-500 block mt-0.5">
              {activeStats.incomeCount} income {activeStats.incomeCount === 1 ? 'event' : 'events'}
            </span>
          </div>

          {/* Expenses */}
          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-850">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
              <span className="font-semibold uppercase tracking-wider text-[10px]">
                {formatMonthLong(selectedMonth)} Outflow
              </span>
              <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
            </div>
            <div className="text-lg font-bold text-rose-400">
              -{formatCurrency(activeStats.expenses)}
            </div>
            <span className="text-[10px] text-slate-500 block mt-0.5">
              {activeStats.expenseCount} expense {activeStats.expenseCount === 1 ? 'event' : 'events'}
            </span>
          </div>

          {/* Net Savings */}
          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-850">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
              <span className="font-semibold uppercase tracking-wider text-[10px]">
                Net Cash Flow
              </span>
              <PiggyBank className="w-3.5 h-3.5 text-purple-400" />
            </div>
            <div
              className={`text-lg font-bold ${
                activeStats.netSavings >= 0 ? 'text-purple-400' : 'text-rose-400'
              }`}
            >
              {activeStats.netSavings >= 0 ? '+' : ''}
              {formatCurrency(activeStats.netSavings)}
            </div>
            <span className="text-[10px] text-slate-500 block mt-0.5">
              {activeStats.income > 0
                ? `${Math.round(activeStats.savingsRate)}% savings rate`
                : 'No income logged'}
            </span>
          </div>

          {/* Health Status */}
          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-850 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
              <span className="font-semibold uppercase tracking-wider text-[10px]">
                Monthly Balance
              </span>
              {activeStats.netSavings >= 0 ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <span
                className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                  activeStats.netSavings >= 0
                    ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/25'
                    : 'bg-rose-500/15 text-rose-300 border border-rose-500/25'
                }`}
              >
                {activeStats.netSavings >= 0 ? 'Cash Positive' : 'Deficit Burn'}
              </span>
            </div>
            <span className="text-[10px] text-slate-500 block mt-0.5">
              {activeStats.incomeCount + activeStats.expenseCount} total ledger records
            </span>
          </div>
        </div>
      </div>

      {/* Monthly Expense Pie Chart Module */}
      <MonthlyExpensePieChart
        transactions={transactions}
        categories={categories}
        selectedMonth={selectedMonth}
        onSelectMonth={(m) => setSelectedMonth(m)}
        title={`Expense Category Breakdown (${formatMonthLong(selectedMonth)})`}
        subtitle="Visual pie chart showing where money went during this month"
      />

      {/* Monthly Stats History Table / Ledger */}
      {recordedMonths.length > 1 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-400" />
              <h4 className="text-sm font-bold text-white">Monthly Ledger History</h4>
            </div>
            <span className="text-xs text-slate-500">
              {recordedMonths.length} recorded {recordedMonths.length === 1 ? 'month' : 'months'}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 uppercase font-semibold text-[10px]">
                  <th className="py-2.5 px-3">Month</th>
                  <th className="py-2.5 px-3">Inflow (Income)</th>
                  <th className="py-2.5 px-3">Outflow (Expense)</th>
                  <th className="py-2.5 px-3">Net Savings</th>
                  <th className="py-2.5 px-3">Savings Rate</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {recordedMonths.map((m) => {
                  const s = monthlyAggregates.get(m);
                  if (!s) return null;
                  const isCurrentSelected = m === selectedMonth;

                  return (
                    <tr
                      key={m}
                      className={`hover:bg-slate-850/40 transition ${
                        isCurrentSelected ? 'bg-sky-500/10 font-medium' : ''
                      }`}
                    >
                      <td className="py-3 px-3 flex items-center gap-2">
                        {isCurrentSelected && (
                          <span className="w-1.5 h-1.5 rounded-full bg-sky-400 shrink-0" />
                        )}
                        <span className="text-white font-semibold">{formatMonthLong(m)}</span>
                      </td>
                      <td className="py-3 px-3 text-emerald-400 font-semibold">
                        +{formatCurrency(s.income)}
                      </td>
                      <td className="py-3 px-3 text-rose-400 font-semibold">
                        -{formatCurrency(s.expenses)}
                      </td>
                      <td
                        className={`py-3 px-3 font-semibold ${
                          s.netSavings >= 0 ? 'text-purple-400' : 'text-rose-400'
                        }`}
                      >
                        {s.netSavings >= 0 ? '+' : ''}
                        {formatCurrency(s.netSavings)}
                      </td>
                      <td className="py-3 px-3">
                        {s.income > 0 ? (
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                              s.savingsRate >= 20
                                ? 'bg-emerald-500/15 text-emerald-300'
                                : s.savingsRate >= 0
                                ? 'bg-blue-500/15 text-blue-300'
                                : 'bg-rose-500/15 text-rose-300'
                            }`}
                          >
                            {Math.round(s.savingsRate)}%
                          </span>
                        ) : (
                          <span className="text-slate-500 text-[11px]">—</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedMonth(m)}
                          className={`text-[11px] px-2.5 py-1 rounded-lg transition cursor-pointer font-medium ${
                            isCurrentSelected
                              ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                              : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700'
                          }`}
                        >
                          {isCurrentSelected ? 'Inspecting' : 'Inspect'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
