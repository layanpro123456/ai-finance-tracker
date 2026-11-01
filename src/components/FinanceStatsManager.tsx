import React, { useState, useMemo } from 'react';
import type {
  Account,
  Category,
  Transaction,
  PersonalAsset,
  ContactsLedger,
  Task,
} from '../types';
import { usePreferences } from '../context/PreferencesContext';
import { MonthlyExpensePieChart } from './MonthlyExpensePieChart';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  PiggyBank,
  Wallet,
  ShieldCheck,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Flame,
  Award,
  CircleDollarSign,
} from 'lucide-react';

interface FinanceStatsManagerProps {
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  assets?: PersonalAsset[];
  contactsLedger?: ContactsLedger[];
  tasks?: Task[];
  onNavigateTab?: (tab: any) => void;
}

type TimeframeFilter = 'all' | 'ytd' | '6m' | '3m';

export const FinanceStatsManager: React.FC<FinanceStatsManagerProps> = ({
  accounts,
  categories,
  transactions,
  assets = [],
  contactsLedger = [],
  tasks = [],
  onNavigateTab,
}) => {
  const { formatCurrency } = usePreferences();
  const [timeframe, setTimeframe] = useState<TimeframeFilter>('all');
  const [selectedPieMonth, setSelectedPieMonth] = useState<string>('all');

  // Filter transactions based on selected timeframe
  const filteredTransactions = useMemo(() => {
    if (timeframe === 'all') return transactions;

    const now = new Date();
    let cutoffDate = new Date();

    if (timeframe === 'ytd') {
      cutoffDate = new Date(now.getFullYear(), 0, 1);
    } else if (timeframe === '6m') {
      cutoffDate = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    } else if (timeframe === '3m') {
      cutoffDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    }

    const cutoffStr = cutoffDate.toISOString().split('T')[0];
    return transactions.filter((t) => t.transaction_date >= cutoffStr);
  }, [transactions, timeframe]);

  // All recorded unique months from filtered transactions
  const recordedMonths = useMemo(() => {
    const set = new Set<string>();
    filteredTransactions.forEach((t) => {
      if (t.transaction_date) {
        set.add(t.transaction_date.slice(0, 7));
      }
    });
    // Ensure current month is present
    const currentM = new Date().toISOString().slice(0, 7);
    set.add(currentM);
    return Array.from(set).sort();
  }, [filteredTransactions]);

  // Aggregate stats by month for charts and history
  const monthlyData = useMemo(() => {
    const map = new Map<
      string,
      {
        month: string;
        income: number;
        expenses: number;
        net: number;
        savingsRate: number;
        topExpenseDesc?: string;
        topExpenseAmt?: number;
      }
    >();

    recordedMonths.forEach((m) => {
      map.set(m, {
        month: m,
        income: 0,
        expenses: 0,
        net: 0,
        savingsRate: 0,
      });
    });

    filteredTransactions.forEach((t) => {
      const m = t.transaction_date?.slice(0, 7);
      if (!m) return;
      const stat = map.get(m);
      if (!stat) return;

      const amt = Number(t.amount || 0);
      if (t.type === 'income') {
        stat.income += amt;
      } else if (t.type === 'expense') {
        stat.expenses += amt;
        if (!stat.topExpenseAmt || amt > stat.topExpenseAmt) {
          stat.topExpenseAmt = amt;
          stat.topExpenseDesc = t.description;
        }
      }
    });

    map.forEach((stat) => {
      stat.net = stat.income - stat.expenses;
      stat.savingsRate = stat.income > 0 ? (stat.net / stat.income) * 100 : 0;
    });

    return Array.from(map.values());
  }, [recordedMonths, filteredTransactions]);

  // Overall Financial Macro Metrics
  const macroStats = useMemo(() => {
    const totalIncome = filteredTransactions
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + Number(t.amount || 0), 0);

    const totalExpenses = filteredTransactions
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + Number(t.amount || 0), 0);

    const netCashflow = totalIncome - totalExpenses;
    const savingsRate = totalIncome > 0 ? (netCashflow / totalIncome) * 100 : 0;

    // Largest single expense
    const expensesList = filteredTransactions.filter((t) => t.type === 'expense');
    let maxExpense = expensesList[0] || null;
    expensesList.forEach((t) => {
      if (!maxExpense || Number(t.amount) > Number(maxExpense.amount)) {
        maxExpense = t;
      }
    });

    // Liquid Balance across accounts
    const totalLiquid = accounts.reduce((sum, a) => sum + Number(a.balance || 0), 0);

    // Active Assets Value
    const totalAssets = assets
      .filter((a) => a.status === 'active')
      .reduce((sum, a) => sum + Number(a.current_value || 0), 0);

    // Social Receivables and Payables
    const socialReceivables = contactsLedger
      .filter((c) => !c.is_settled && c.type === 'they_owe_me')
      .reduce((sum, c) => sum + Number(c.amount || 0), 0);

    const socialPayables = contactsLedger
      .filter((c) => !c.is_settled && c.type === 'i_owe_them')
      .reduce((sum, c) => sum + Number(c.amount || 0), 0);

    const comprehensiveNetWorth = totalLiquid + totalAssets + socialReceivables - socialPayables;

    // Average Monthly Expenses and Runway
    const monthCount = Math.max(recordedMonths.length, 1);
    const avgMonthlyExpense = totalExpenses / monthCount;
    const avgMonthlyIncome = totalIncome / monthCount;

    const runwayMonths = avgMonthlyExpense > 0 ? totalLiquid / avgMonthlyExpense : 999;

    const pendingBills = tasks
      .filter((t) => t.status !== 'completed' && t.is_financial && t.financial_type === 'payable')
      .reduce((sum, t) => sum + Number(t.amount || 0), 0);

    return {
      totalIncome,
      totalExpenses,
      netCashflow,
      savingsRate,
      totalLiquid,
      totalAssets,
      comprehensiveNetWorth,
      avgMonthlyExpense,
      avgMonthlyIncome,
      runwayMonths,
      maxExpense,
      monthCount,
      pendingBills,
    };
  }, [filteredTransactions, accounts, assets, contactsLedger, recordedMonths, tasks]);

  // Income Breakdown by Category
  const incomeCategoryStats = useMemo(() => {
    const map = new Map<string, { name: string; total: number; count: number }>();
    const incomeTxs = filteredTransactions.filter((t) => t.type === 'income');

    incomeTxs.forEach((t) => {
      const name = t.categories?.name || 'Other Income';
      const item = map.get(name) || { name, total: 0, count: 0 };
      item.total += Number(t.amount || 0);
      item.count += 1;
      map.set(name, item);
    });

    const total = macroStats.totalIncome;
    return Array.from(map.values())
      .map((item) => ({
        ...item,
        percentage: total > 0 ? (item.total / total) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [filteredTransactions, macroStats.totalIncome]);

  // Ranked Expense Categories
  const expenseCategoryRanking = useMemo(() => {
    const map = new Map<string, { name: string; total: number; count: number }>();
    const expenseTxs = filteredTransactions.filter((t) => t.type === 'expense');

    expenseTxs.forEach((t) => {
      const name = t.categories?.name || 'Uncategorized';
      const item = map.get(name) || { name, total: 0, count: 0 };
      item.total += Number(t.amount || 0);
      item.count += 1;
      map.set(name, item);
    });

    const total = macroStats.totalExpenses;
    return Array.from(map.values())
      .map((item) => ({
        ...item,
        percentage: total > 0 ? (item.total / total) * 100 : 0,
        average: item.count > 0 ? item.total / item.count : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [filteredTransactions, macroStats.totalExpenses]);

  // Account Liquidity Distribution
  const accountDistribution = useMemo(() => {
    const total = macroStats.totalLiquid;
    return accounts
      .map((acc) => {
        const bal = Number(acc.balance || 0);
        return {
          id: acc.id,
          name: acc.name,
          currency: acc.currency,
          balance: bal,
          percentage: total > 0 ? (bal / total) * 100 : 0,
        };
      })
      .sort((a, b) => b.balance - a.balance);
  }, [accounts, macroStats.totalLiquid]);

  // Format month for display (e.g. "2026-11" -> "Nov 2026")
  const formatMonthShort = (mStr: string) => {
    try {
      const [year, month] = mStr.split('-');
      const date = new Date(Number(year), Number(month) - 1, 1);
      return date.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
    } catch {
      return mStr;
    }
  };

  const formatMonthLong = (mStr: string) => {
    try {
      const [year, month] = mStr.split('-');
      const date = new Date(Number(year), Number(month) - 1, 1);
      return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    } catch {
      return mStr;
    }
  };

  // SVG Bar Chart Dimensions for Monthly Inflow vs Outflow
  const maxChartVal = useMemo(() => {
    let max = 100;
    monthlyData.forEach((d) => {
      if (d.income > max) max = d.income;
      if (d.expenses > max) max = d.expenses;
    });
    return max * 1.15; // 15% headroom
  }, [monthlyData]);

  const [hoveredBarIndex, setHoveredBarIndex] = useState<number | null>(null);

  return (
    <div className="space-y-6">
      {/* Module Executive Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
              <BarChart3 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-white tracking-tight">
                  Financial Statistics &amp; Analytics
                </h2>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
                  Macro Portfolio
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Comprehensive whole-finance intelligence: cash flow curves, expense allocation, monthly performance &amp; runway
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap self-start lg:self-auto">
            {onNavigateTab && (
              <button
                type="button"
                onClick={() => onNavigateTab('dashboard')}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700/60 transition cursor-pointer"
              >
                &larr; Overview
              </button>
            )}

            {/* Timeframe Filter Controls */}
            <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-1 gap-1 text-xs">
            <button
              onClick={() => setTimeframe('all')}
              className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                timeframe === 'all'
                  ? 'bg-slate-800 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              All Time
            </button>
            <button
              onClick={() => setTimeframe('ytd')}
              className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                timeframe === 'ytd'
                  ? 'bg-slate-800 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              This Year
            </button>
            <button
              onClick={() => setTimeframe('6m')}
              className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                timeframe === '6m'
                  ? 'bg-slate-800 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Last 6 Months
            </button>
            <button
              onClick={() => setTimeframe('3m')}
              className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                timeframe === '3m'
                  ? 'bg-slate-800 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Last 3 Months
            </button>
          </div>
        </div>
      </div>

        {/* Macro KPIs Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 mt-6 pt-5 border-t border-slate-800">
          {/* Total Inflow */}
          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-850">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1.5">
              <span className="font-semibold uppercase tracking-wider text-[10px]">
                Total Inflow
              </span>
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-xl sm:text-2xl font-bold text-emerald-400">
              +{formatCurrency(macroStats.totalIncome)}
            </div>
            <span className="text-[11px] text-slate-500 mt-1 block">
              Avg {formatCurrency(macroStats.avgMonthlyIncome)} / mo
            </span>
          </div>

          {/* Total Outflow */}
          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-850">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1.5">
              <span className="font-semibold uppercase tracking-wider text-[10px]">
                Total Outflow
              </span>
              <TrendingDown className="w-4 h-4 text-rose-400" />
            </div>
            <div className="text-xl sm:text-2xl font-bold text-rose-400">
              -{formatCurrency(macroStats.totalExpenses)}
            </div>
            <span className="text-[11px] text-slate-500 mt-1 block">
              Avg {formatCurrency(macroStats.avgMonthlyExpense)} / mo
            </span>
          </div>

          {/* Net Cash Flow */}
          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-850">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1.5">
              <span className="font-semibold uppercase tracking-wider text-[10px]">
                Net Cash Flow
              </span>
              <PiggyBank className="w-4 h-4 text-purple-400" />
            </div>
            <div
              className={`text-xl sm:text-2xl font-bold ${
                macroStats.netCashflow >= 0 ? 'text-purple-400' : 'text-rose-400'
              }`}
            >
              {macroStats.netCashflow >= 0 ? '+' : ''}
              {formatCurrency(macroStats.netCashflow)}
            </div>
            <span className="text-[11px] text-slate-500 mt-1 block">
              {macroStats.totalIncome > 0
                ? `${Math.round(macroStats.savingsRate)}% overall savings rate`
                : 'No income logged'}
            </span>
          </div>

          {/* Liquid Runway & Safety Buffer */}
          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-850">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1.5">
              <span className="font-semibold uppercase tracking-wider text-[10px]">
                Liquid Runway
              </span>
              <ShieldCheck className="w-4 h-4 text-sky-400" />
            </div>
            <div className="text-xl sm:text-2xl font-bold text-white">
              {macroStats.runwayMonths >= 99
                ? '99+ mo'
                : `${macroStats.runwayMonths.toFixed(1)} mo`}
            </div>
            <span className="text-[11px] text-slate-500 mt-1 block">
              Liquid: {formatCurrency(macroStats.totalLiquid)}
            </span>
          </div>
        </div>
      </div>

      {/* Monthly Cash Flow Comparison Bar Chart (Interactive SVG) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
          <div>
            <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              <span>Monthly Inflow vs. Outflow Trend</span>
              <span className="text-xs font-normal text-slate-400">
                ({monthlyData.length} active {monthlyData.length === 1 ? 'month' : 'months'})
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Visual comparison of monthly income earnings against total spending
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs font-medium">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-emerald-500" />
              <span className="text-slate-300">Income</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-rose-500" />
              <span className="text-slate-300">Expense</span>
            </div>
          </div>
        </div>

        {/* SVG Bar Chart */}
        <div className="relative w-full overflow-x-auto pb-2">
          {monthlyData.length === 0 ? (
            <p className="text-xs text-slate-500 py-10 text-center">
              No financial data available for this timeframe.
            </p>
          ) : (
            <div className="min-w-[500px]">
              <svg viewBox={`0 0 ${Math.max(monthlyData.length * 90, 500)} 220`} className="w-full h-56">
                {/* Horizontal Grid lines */}
                {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
                  const y = 180 - pct * 150;
                  return (
                    <g key={i}>
                      <line
                        x1="40"
                        y1={y}
                        x2={Math.max(monthlyData.length * 90, 500) - 20}
                        y2={y}
                        stroke="#334155"
                        strokeDasharray="4 4"
                        strokeWidth="0.7"
                      />
                      <text x="35" y={y + 3} textAnchor="end" className="fill-slate-500 text-[9px]">
                        {formatCurrency(Math.round(pct * maxChartVal))}
                      </text>
                    </g>
                  );
                })}

                {/* Bars for each month */}
                {monthlyData.map((d, index) => {
                  const totalWidth = Math.max(monthlyData.length * 90, 500);
                  const availableWidth = totalWidth - 60;
                  const groupWidth = availableWidth / monthlyData.length;
                  const groupX = 50 + index * groupWidth + groupWidth / 2;

                  const barWidth = Math.min(22, groupWidth * 0.35);
                  const incomeH = maxChartVal > 0 ? (d.income / maxChartVal) * 150 : 0;
                  const expenseH = maxChartVal > 0 ? (d.expenses / maxChartVal) * 150 : 0;

                  const isHovered = hoveredBarIndex === index;

                  return (
                    <g
                      key={d.month}
                      className="cursor-pointer transition-all"
                      onMouseEnter={() => setHoveredBarIndex(index)}
                      onMouseLeave={() => setHoveredBarIndex(null)}
                    >
                      {/* Background highlight pill when hovered */}
                      {isHovered && (
                        <rect
                          x={groupX - barWidth * 1.5 - 6}
                          y={20}
                          width={barWidth * 3 + 12}
                          height={170}
                          rx={8}
                          fill="#1e293b"
                          opacity={0.6}
                        />
                      )}

                      {/* Income Bar */}
                      <rect
                        x={groupX - barWidth - 2}
                        y={180 - incomeH}
                        width={barWidth}
                        height={Math.max(incomeH, 2)}
                        rx={4}
                        fill="#10b981"
                        className="transition-all duration-300 hover:filter hover:brightness-110"
                      />

                      {/* Expense Bar */}
                      <rect
                        x={groupX + 2}
                        y={180 - expenseH}
                        width={barWidth}
                        height={Math.max(expenseH, 2)}
                        rx={4}
                        fill="#f43f5e"
                        className="transition-all duration-300 hover:filter hover:brightness-110"
                      />

                      {/* Month Label */}
                      <text
                        x={groupX}
                        y={198}
                        textAnchor="middle"
                        className={`text-[10px] font-semibold ${
                          isHovered ? 'fill-emerald-400 font-bold' : 'fill-slate-400'
                        }`}
                      >
                        {formatMonthShort(d.month)}
                      </text>
                    </g>
                  );
                })}
              </svg>

              {/* Hover Tooltip Details Banner */}
              {hoveredBarIndex !== null && monthlyData[hoveredBarIndex] && (
                <div className="mt-2 p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs flex items-center justify-between gap-4 animate-fadeIn">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-emerald-400" />
                    <span className="font-bold text-white">
                      {formatMonthLong(monthlyData[hoveredBarIndex].month)}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-emerald-400 font-semibold">
                      Income: +{formatCurrency(monthlyData[hoveredBarIndex].income)}
                    </span>
                    <span className="text-rose-400 font-semibold">
                      Expenses: -{formatCurrency(monthlyData[hoveredBarIndex].expenses)}
                    </span>
                    <span
                      className={`font-bold ${
                        monthlyData[hoveredBarIndex].net >= 0
                          ? 'text-purple-400'
                          : 'text-rose-400'
                      }`}
                    >
                      Net: {monthlyData[hoveredBarIndex].net >= 0 ? '+' : ''}
                      {formatCurrency(monthlyData[hoveredBarIndex].net)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Two Column Section: Pie Chart & Ranked Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Monthly Expense Categories Pie Chart */}
        <MonthlyExpensePieChart
          transactions={filteredTransactions}
          categories={categories}
          selectedMonth={selectedPieMonth}
          onSelectMonth={setSelectedPieMonth}
          showMonthSelector={true}
          title="Expense Category Pie Chart"
          subtitle="Interactive category distribution for any chosen month or all time"
        />

        {/* Right: Income Source Distribution & Accounts Breakdown */}
        <div className="space-y-6">
          {/* Income Streams */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <CircleDollarSign className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Income Sources Distribution</h3>
                  <p className="text-xs text-slate-400">Inflow breakdown across revenue channels</p>
                </div>
              </div>
              <span className="text-xs font-bold text-emerald-400">
                +{formatCurrency(macroStats.totalIncome)}
              </span>
            </div>

            {incomeCategoryStats.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center">
                No income transactions recorded for this period.
              </p>
            ) : (
              <div className="space-y-3">
                {incomeCategoryStats.map((item) => (
                  <div key={item.name} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-200">{item.name}</span>
                        <span className="text-[10px] text-slate-500">({item.count} events)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">{formatCurrency(item.total)}</span>
                        <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                          {item.percentage.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                    <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden border border-slate-800">
                      <div
                        className="bg-emerald-500 h-full rounded-full transition-all"
                        style={{ width: `${Math.max(item.percentage, 2)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Account Liquidity & Wealth Allocation */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  <Wallet className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Account Balances &amp; Distribution</h3>
                  <p className="text-xs text-slate-400">Liquid reserves distribution across accounts</p>
                </div>
              </div>
              <span className="text-xs font-bold text-white">
                {formatCurrency(macroStats.totalLiquid)}
              </span>
            </div>

            <div className="space-y-2.5">
              {accountDistribution.map((acc) => (
                <div
                  key={acc.id}
                  className="p-2.5 rounded-xl bg-slate-950 border border-slate-850 flex items-center justify-between text-xs"
                >
                  <div className="min-w-0">
                    <span className="font-semibold text-slate-200 block truncate">{acc.name}</span>
                    <span className="text-[10px] text-slate-500">{acc.currency}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-white block">
                      {formatCurrency(acc.balance)}
                    </span>
                    <span className="text-[10px] text-purple-400 font-semibold">
                      {acc.percentage.toFixed(1)}% of liquid funds
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Ranked Expense Categories Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <Flame className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Expense Category Hierarchy</h3>
              <p className="text-xs text-slate-400">
                Ranked by cumulative spending volume with average ticket size
              </p>
            </div>
          </div>
          <span className="text-xs text-slate-400">
            {expenseCategoryRanking.length} categories active
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 uppercase font-semibold text-[10px]">
                <th className="py-2.5 px-3">Rank</th>
                <th className="py-2.5 px-3">Category Name</th>
                <th className="py-2.5 px-3">Total Spent</th>
                <th className="py-2.5 px-3">Share (%)</th>
                <th className="py-2.5 px-3">Tx Count</th>
                <th className="py-2.5 px-3 text-right">Avg / Transaction</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {expenseCategoryRanking.map((item, idx) => (
                <tr key={item.name} className="hover:bg-slate-850/40 transition">
                  <td className="py-3 px-3">
                    <span className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center font-bold text-[11px] text-slate-300">
                      #{idx + 1}
                    </span>
                  </td>
                  <td className="py-3 px-3 font-semibold text-white">{item.name}</td>
                  <td className="py-3 px-3 font-bold text-rose-400">
                    -{formatCurrency(item.total)}
                  </td>
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-rose-500 h-full rounded-full"
                          style={{ width: `${Math.max(item.percentage, 3)}%` }}
                        />
                      </div>
                      <span className="font-bold text-slate-300 text-[11px]">
                        {item.percentage.toFixed(1)}%
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-3 text-slate-400">{item.count}</td>
                  <td className="py-3 px-3 text-right font-medium text-slate-300">
                    {formatCurrency(item.average)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Historical Monthly Performance Full Ledger */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Historical Monthly Performance Ledger</h3>
              <p className="text-xs text-slate-400">
                Detailed monthly history with inflow, outflow, savings rate, and largest ticket item
              </p>
            </div>
          </div>
          <span className="text-xs text-slate-400">
            {monthlyData.length} recorded {monthlyData.length === 1 ? 'month' : 'months'}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 uppercase font-semibold text-[10px]">
                <th className="py-2.5 px-3">Month</th>
                <th className="py-2.5 px-3">Income</th>
                <th className="py-2.5 px-3">Expenses</th>
                <th className="py-2.5 px-3">Net Cashflow</th>
                <th className="py-2.5 px-3">Savings Rate</th>
                <th className="py-2.5 px-3">Largest Expense</th>
                <th className="py-2.5 px-3 text-right">Health Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {monthlyData
                .slice()
                .reverse()
                .map((row) => (
                  <tr key={row.month} className="hover:bg-slate-850/40 transition">
                    <td className="py-3 px-3 font-semibold text-white">
                      {formatMonthLong(row.month)}
                    </td>
                    <td className="py-3 px-3 text-emerald-400 font-semibold">
                      +{formatCurrency(row.income)}
                    </td>
                    <td className="py-3 px-3 text-rose-400 font-semibold">
                      -{formatCurrency(row.expenses)}
                    </td>
                    <td
                      className={`py-3 px-3 font-bold ${
                        row.net >= 0 ? 'text-purple-400' : 'text-rose-400'
                      }`}
                    >
                      {row.net >= 0 ? '+' : ''}
                      {formatCurrency(row.net)}
                    </td>
                    <td className="py-3 px-3">
                      {row.income > 0 ? (
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                            row.savingsRate >= 20
                              ? 'bg-emerald-500/15 text-emerald-300'
                              : row.savingsRate >= 0
                              ? 'bg-blue-500/15 text-blue-300'
                              : 'bg-rose-500/15 text-rose-300'
                          }`}
                        >
                          {Math.round(row.savingsRate)}%
                        </span>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-slate-300">
                      {row.topExpenseAmt ? (
                        <span className="truncate block max-w-[150px]">
                          {row.topExpenseDesc || 'Expense'}: {formatCurrency(row.topExpenseAmt)}
                        </span>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                          row.net >= 0
                            ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-300 border border-rose-500/20'
                        }`}
                      >
                        {row.net >= 0 ? (
                          <>
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            <span>Surplus</span>
                          </>
                        ) : (
                          <>
                            <AlertCircle className="w-3 h-3 text-rose-400" />
                            <span>Deficit</span>
                          </>
                        )}
                      </span>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Automated Diagnostic Smart Observations */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Runway */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck className="w-4 h-4 text-sky-400" />
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
              Capital Runway Rating
            </h4>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            {macroStats.runwayMonths >= 6
              ? `Healthy capital buffer: your liquid balances cover approximately ${macroStats.runwayMonths.toFixed(1)} months of average monthly expenses.`
              : macroStats.runwayMonths >= 3
              ? `Moderate safety cushion (${macroStats.runwayMonths.toFixed(1)} months). Aiming for 6+ months of reserves strengthens financial resilience.`
              : `Caution: Current liquid funds cover under 3 months (${macroStats.runwayMonths.toFixed(1)} mo) of average burn.`}
          </p>
        </div>

        {/* Card 2: Top Expense Pressure */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
          <div className="flex items-center gap-2 mb-2">
            <Flame className="w-4 h-4 text-amber-400" />
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
              Top Outflow Pressure
            </h4>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            {expenseCategoryRanking.length > 0
              ? `${expenseCategoryRanking[0].name} is your largest expense category, consuming ${expenseCategoryRanking[0].percentage.toFixed(1)}% of all expenditures (${formatCurrency(expenseCategoryRanking[0].total)}).`
              : 'No categorized expense pressure detected.'}
          </p>
        </div>

        {/* Card 3: Cash Flow Discipline */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
          <div className="flex items-center gap-2 mb-2">
            <Award className="w-4 h-4 text-emerald-400" />
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
              Cashflow Discipline
            </h4>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            {macroStats.savingsRate >= 20
              ? `Outstanding savings discipline with a ${Math.round(macroStats.savingsRate)}% cumulative retention rate across all logged periods.`
              : macroStats.savingsRate > 0
              ? `Positive cashflow maintained (${Math.round(macroStats.savingsRate)}% savings rate). Look for recurring optimizations in top categories.`
              : 'Cashflow is currently negative. Review non-essential expenses to restore net savings.'}
          </p>
        </div>
      </div>
    </div>
  );
};
