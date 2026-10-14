import React, { useState, useMemo } from 'react';
import type {
  Account,
  Subscription,
  Task,
  Transaction,
  CashFlowForecastPoint,
  CashFlowForecastSummary,
} from '../types';
import { usePreferences } from '../context/PreferencesContext';
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  ShieldCheck,
  Calendar,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Sliders,
  RotateCcw,
  Clock,
  ArrowUpRight,
  ArrowDownLeft,
} from 'lucide-react';

interface PredictiveCashFlowProps {
  accounts: Account[];
  subscriptions: Subscription[];
  tasks: Task[];
  transactions: Transaction[];
}

export const PredictiveCashFlow: React.FC<PredictiveCashFlowProps> = ({
  accounts,
  subscriptions,
  tasks,
  transactions,
}) => {
  const { preferences, formatCurrency } = usePreferences();
  const [horizonDays, setHorizonDays] = useState<30 | 60 | 90>(30);
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [showSandbox, setShowSandbox] = useState<boolean>(false);

  // What-If Sandbox adjustments
  const [burnRateMultiplier, setBurnRateMultiplier] = useState<number>(1.0); // 0.5 to 1.5
  const [simulatedExpenseAmount, setSimulatedExpenseAmount] = useState<number>(0);
  const [simulatedExpenseDay, setSimulatedExpenseDay] = useState<number>(10);
  const [simulatedExpenseLabel, setSimulatedExpenseLabel] = useState<string>('Unexpected Expense');

  // Interactive chart hover state
  const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(null);

  // 1. Calculate Liquid Starting Balance
  const startingLiquidBalance = useMemo(() => {
    return accounts.reduce((sum, acc) => sum + Number(acc.balance || 0), 0);
  }, [accounts]);

  // 2. Calculate Baseline Historical Daily Discretionary Burn Rate
  const dailyAverageBurnRate = useMemo(() => {
    const now = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(now.getDate() - 30);
    const thirtyDaysStr = thirtyDaysAgo.toISOString().split('T')[0];

    // Transactions in the last 30 days
    const recentExpenses = transactions.filter(
      (t) => t.type === 'expense' && t.transaction_date >= thirtyDaysStr
    );

    const totalRecentExpense = recentExpenses.reduce(
      (sum, t) => sum + Number(t.amount || 0),
      0
    );

    // If transactions exist, use the daily average, else default to 0
    return recentExpenses.length > 0 ? totalRecentExpense / 30 : 0;
  }, [transactions]);

  // 3. Build Day-by-Day Forecast Model
  const { points, summary } = useMemo(() => {
    const forecastPoints: CashFlowForecastPoint[] = [];
    let runningBalance = startingLiquidBalance;
    let minBalance = startingLiquidBalance;
    let minDate: string | null = null;
    let overdraftDate: string | null = null;
    let totalInflow = 0;
    let totalOutflow = 0;

    const today = new Date();
    const activeSubs = subscriptions.filter((s) => s.is_active);
    const activeTasks = tasks.filter((t) => t.status !== 'completed' && t.is_financial);

    const adjustedDailyBurn = dailyAverageBurnRate * burnRateMultiplier;

    for (let dayOffset = 0; dayOffset <= horizonDays; dayOffset++) {
      const targetDate = new Date(today);
      targetDate.setDate(today.getDate() + dayOffset);
      const dateStr = targetDate.toISOString().split('T')[0];
      const dayLabel = targetDate.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      });

      const dayEvents: CashFlowForecastPoint['events'] = [];
      let dayScheduledIncome = 0;
      let dayScheduledExpenses = 0;

      // A. Scheduled Recurring Subscriptions
      for (const sub of activeSubs) {
        let isDueToday = false;
        if (sub.next_billing_date) {
          const subDate = new Date(sub.next_billing_date);
          if (sub.billing_cycle === 'monthly') {
            // Triggers every month on the same day of month
            if (subDate.getDate() === targetDate.getDate() && targetDate >= subDate) {
              isDueToday = true;
            }
          } else if (sub.billing_cycle === 'weekly') {
            const diffDays = Math.round(
              (targetDate.getTime() - subDate.getTime()) / (1000 * 60 * 60 * 24)
            );
            if (diffDays >= 0 && diffDays % 7 === 0) {
              isDueToday = true;
            }
          } else if (sub.billing_cycle === 'yearly') {
            if (
              subDate.getDate() === targetDate.getDate() &&
              subDate.getMonth() === targetDate.getMonth() &&
              targetDate >= subDate
            ) {
              isDueToday = true;
            }
          } else {
            // Default check exact date match
            if (sub.next_billing_date === dateStr) {
              isDueToday = true;
            }
          }
        }

        if (isDueToday) {
          const subCost = Number(sub.cost || 0);
          dayScheduledExpenses += subCost;
          dayEvents.push({
            name: `Subscription: ${sub.name}`,
            amount: subCost,
            type: 'expense',
            source: 'subscription',
          });
        }
      }

      // B. Scheduled Financial Tasks / Bills / Receivables
      for (const task of activeTasks) {
        if (task.due_date === dateStr) {
          const taskAmt = Number(task.amount || 0);
          if (task.financial_type === 'payable') {
            dayScheduledExpenses += taskAmt;
            dayEvents.push({
              name: `Bill: ${task.title}`,
              amount: taskAmt,
              type: 'expense',
              source: 'task',
            });
          } else if (task.financial_type === 'receivable') {
            dayScheduledIncome += taskAmt;
            dayEvents.push({
              name: `Receivable: ${task.title}`,
              amount: taskAmt,
              type: 'income',
              source: 'task',
            });
          }
        }
      }

      // C. Simulated One-time Sandbox Expense
      if (simulatedExpenseAmount > 0 && dayOffset === simulatedExpenseDay) {
        dayScheduledExpenses += simulatedExpenseAmount;
        dayEvents.push({
          name: `Simulated: ${simulatedExpenseLabel}`,
          amount: simulatedExpenseAmount,
          type: 'expense',
          source: 'simulated',
        });
      }

      // D. Baseline Daily Burn
      if (dayOffset > 0 && adjustedDailyBurn > 0) {
        dayScheduledExpenses += adjustedDailyBurn;
      }

      // Update Running Balance for day
      if (dayOffset > 0) {
        runningBalance = runningBalance + dayScheduledIncome - dayScheduledExpenses;
      }

      totalInflow += dayScheduledIncome;
      totalOutflow += dayScheduledExpenses;

      if (runningBalance < minBalance) {
        minBalance = runningBalance;
        minDate = dateStr;
      }

      if (runningBalance < 0 && !overdraftDate) {
        overdraftDate = dateStr;
      }

      forecastPoints.push({
        date: dateStr,
        dayLabel,
        projectedBalance: runningBalance,
        scheduledIncome: dayScheduledIncome,
        scheduledExpenses: dayScheduledExpenses,
        dailyBurn: adjustedDailyBurn,
        events: dayEvents,
        isOverdraft: runningBalance < 0,
      });
    }

    // Runway Calculation
    const netDailyDrain = adjustedDailyBurn + (totalOutflow - totalInflow) / horizonDays;
    let runwayDays: number | null = null;
    let runwayMonths: number | null = null;

    if (startingLiquidBalance > 0 && netDailyDrain > 0) {
      runwayDays = Math.max(0, Math.round(startingLiquidBalance / netDailyDrain));
      runwayMonths = parseFloat((runwayDays / 30.4).toFixed(1));
    } else if (startingLiquidBalance <= 0) {
      runwayDays = 0;
      runwayMonths = 0;
    }

    const forecastSummary: CashFlowForecastSummary = {
      startingBalance: startingLiquidBalance,
      endingBalance: runningBalance,
      minProjectedBalance: minBalance,
      minBalanceDate: minDate,
      isOverdraftRisk: overdraftDate !== null,
      overdraftDate,
      runwayDays,
      runwayMonths,
      dailyAverageBurnRate: adjustedDailyBurn,
      totalScheduledInflow: totalInflow,
      totalScheduledOutflow: totalOutflow,
    };

    return { points: forecastPoints, summary: forecastSummary };
  }, [
    startingLiquidBalance,
    dailyAverageBurnRate,
    burnRateMultiplier,
    horizonDays,
    subscriptions,
    tasks,
    simulatedExpenseAmount,
    simulatedExpenseDay,
    simulatedExpenseLabel,
  ]);

  // SVG Chart Geometry Calculations
  const chartHeight = 180;
  const chartWidth = 720;
  const paddingX = 20;
  const paddingTop = 25;
  const paddingBottom = 30;

  const { minVal, maxVal, svgPoints, zeroLineY } = useMemo(() => {
    if (points.length === 0) {
      return { minVal: 0, maxVal: 100, svgPoints: '', zeroLineY: chartHeight / 2 };
    }

    const balances = points.map((p) => p.projectedBalance);
    let rawMin = Math.min(...balances);
    let rawMax = Math.max(...balances);

    // Ensure zero is considered in min/max scale
    if (rawMin > 0) rawMin = 0;
    if (rawMax < 0) rawMax = 0;

    // Buffer
    const buffer = (rawMax - rawMin) * 0.1 || 100;
    const computedMin = rawMin - buffer;
    const computedMax = rawMax + buffer;
    const range = computedMax - computedMin || 1;

    const availableHeight = chartHeight - paddingTop - paddingBottom;
    const stepX = (chartWidth - paddingX * 2) / (points.length - 1 || 1);

    const coords = points.map((p, idx) => {
      const x = paddingX + idx * stepX;
      const normalizedY = (p.projectedBalance - computedMin) / range;
      const y = chartHeight - paddingBottom - normalizedY * availableHeight;
      return { x, y, point: p };
    });

    const pathString = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ');

    const zeroNormalized = (0 - computedMin) / range;
    const calculatedZeroY = chartHeight - paddingBottom - zeroNormalized * availableHeight;

    return {
      minVal: computedMin,
      maxVal: computedMax,
      svgPoints: pathString,
      coords,
      zeroLineY: calculatedZeroY,
    };
  }, [points]);

  const activeHoverPoint = hoveredPointIndex !== null ? points[hoveredPointIndex] : null;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl relative overflow-hidden transition-all duration-300">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                Predictive Cash Flow & Overdraft Radar
              </h2>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                Phase 3 Engine
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Simulates liquid cash trajectory combining active subscriptions, bill tasks, and historical burn rate.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {/* Horizon Selector */}
          <div className="bg-slate-950 p-1 rounded-xl border border-slate-800 flex items-center text-xs">
            {([30, 60, 90] as const).map((days) => (
              <button
                key={days}
                onClick={() => setHorizonDays(days)}
                className={`px-3 py-1 rounded-lg font-medium transition cursor-pointer ${
                  horizonDays === days
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {days}D
              </button>
            ))}
          </div>

          {/* Sandbox Toggle */}
          <button
            onClick={() => setShowSandbox((prev) => !prev)}
            className={`p-2 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition cursor-pointer ${
              showSandbox
                ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                : 'bg-slate-800/60 border-slate-700/80 text-slate-300 hover:bg-slate-800'
            }`}
            title="Toggle What-If Scenario Stress-Test"
          >
            <Sliders className="w-4 h-4" />
            <span className="hidden md:inline">Stress-Test</span>
          </button>

          {/* Expand/Collapse */}
          <button
            onClick={() => setIsExpanded((prev) => !prev)}
            className="p-2 rounded-xl bg-slate-800/60 border border-slate-700/80 text-slate-300 hover:text-white transition cursor-pointer"
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Main Content Body */}
      {isExpanded && (
        <div className="mt-5 space-y-5">
          {/* Overdraft Alert Banner (if risk exists) */}
          {summary.isOverdraftRisk ? (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-start sm:items-center justify-between gap-3 text-rose-300">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-rose-500/20 text-rose-400 shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-rose-200">
                    Overdraft Risk Detected on {summary.overdraftDate}
                  </h4>
                  <p className="text-xs text-rose-300/90 mt-0.5">
                    Projected balance dips below {preferences.currencySymbol}0.00. Lowest projected point will reach{' '}
                    <span className="font-bold underline">
                      {formatCurrency(summary.minProjectedBalance)}
                    </span>{' '}
                    around {summary.minBalanceDate}.
                  </p>
                </div>
              </div>
              <div className="text-right shrink-0 hidden sm:block">
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  Action Required
                </span>
              </div>
            </div>
          ) : (
            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between gap-3 text-emerald-300">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div className="text-xs font-medium text-emerald-200">
                  Cash flow resilient for the next {horizonDays} days. Minimum projected liquidity stays at{' '}
                  <span className="font-bold">{formatCurrency(summary.minProjectedBalance)}</span>.
                </div>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400/80 px-2 py-0.5 rounded-md bg-emerald-500/10">
                Safe Horizon
              </span>
            </div>
          )}

          {/* Metric KPI Chips */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Runway */}
            <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800">
              <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
                <span>Liquid Runway</span>
                <Clock className="w-3.5 h-3.5 text-indigo-400" />
              </div>
              <div className="mt-1 text-lg sm:text-xl font-bold text-white tracking-tight">
                {summary.runwayDays !== null ? (
                  <>
                    {summary.runwayDays} <span className="text-xs font-normal text-slate-400">Days</span>{' '}
                    <span className="text-xs font-medium text-indigo-400">({summary.runwayMonths} mo)</span>
                  </>
                ) : (
                  <span className="text-sm font-semibold text-emerald-400">Sustainable (Inflow &gt; Outflow)</span>
                )}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Daily burn: {formatCurrency(summary.dailyAverageBurnRate)}/day
              </div>
            </div>

            {/* Ending Balance */}
            <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800">
              <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
                <span>Projected ({horizonDays}D)</span>
                {summary.endingBalance >= summary.startingBalance ? (
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
                )}
              </div>
              <div
                className={`mt-1 text-lg sm:text-xl font-bold tracking-tight ${
                  summary.endingBalance < 0
                    ? 'text-rose-400'
                    : summary.endingBalance >= summary.startingBalance
                    ? 'text-emerald-400'
                    : 'text-white'
                }`}
              >
                {formatCurrency(summary.endingBalance)}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Net delta:{' '}
                <span
                  className={
                    summary.endingBalance - summary.startingBalance >= 0
                      ? 'text-emerald-400'
                      : 'text-rose-400'
                  }
                >
                  {summary.endingBalance - summary.startingBalance >= 0 ? '+' : ''}
                  {formatCurrency(summary.endingBalance - summary.startingBalance)}
                </span>
              </div>
            </div>

            {/* Scheduled Inflows */}
            <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800">
              <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
                <span>Scheduled Inflows</span>
                <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <div className="mt-1 text-lg sm:text-xl font-bold text-white tracking-tight">
                {formatCurrency(summary.totalScheduledInflow)}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Pending tasks & receivables
              </div>
            </div>

            {/* Scheduled Outflows */}
            <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800">
              <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
                <span>Scheduled Commitments</span>
                <ArrowUpRight className="w-3.5 h-3.5 text-rose-400" />
              </div>
              <div className="mt-1 text-lg sm:text-xl font-bold text-white tracking-tight">
                {formatCurrency(summary.totalScheduledOutflow)}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Subscriptions + bills + burn
              </div>
            </div>
          </div>

          {/* Interactive What-If Stress-Test Sandbox */}
          {showSandbox && (
            <div className="p-4 rounded-2xl bg-slate-950 border border-amber-500/30 space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-300">
                    What-If Stress-Testing Sandbox
                  </span>
                </div>
                <button
                  onClick={() => {
                    setBurnRateMultiplier(1.0);
                    setSimulatedExpenseAmount(0);
                    setSimulatedExpenseDay(10);
                  }}
                  className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  Reset Simulation
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Burn rate adjustment slider */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-300">Discretionary Daily Burn Adjustment</span>
                    <span className="font-semibold text-indigo-400">
                      {Math.round((burnRateMultiplier - 1.0) * 100) > 0 ? '+' : ''}
                      {Math.round((burnRateMultiplier - 1.0) * 100)}% ({formatCurrency(dailyAverageBurnRate * burnRateMultiplier)}/day)
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="1.5"
                    step="0.05"
                    value={burnRateMultiplier}
                    onChange={(e) => setBurnRateMultiplier(parseFloat(e.target.value))}
                    className="w-full accent-indigo-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500">
                    <span>-50% (Frugal)</span>
                    <span>Baseline (100%)</span>
                    <span>+50% (Splurge)</span>
                  </div>
                </div>

                {/* Simulated Sudden Expense */}
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">
                        Expense Description
                      </label>
                      <input
                        type="text"
                        value={simulatedExpenseLabel}
                        placeholder="e.g. Laptop Repair"
                        onChange={(e) => setSimulatedExpenseLabel(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">
                        Amount ({preferences.currencySymbol})
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="50"
                        value={simulatedExpenseAmount || ''}
                        placeholder="e.g. 500"
                        onChange={(e) => setSimulatedExpenseAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">
                      Occurs on Day (1 - {horizonDays})
                    </label>
                    <input
                      type="number"
                      min="1"
                      max={horizonDays}
                      value={simulatedExpenseDay}
                      onChange={(e) => setSimulatedExpenseDay(Math.min(horizonDays, Math.max(1, parseInt(e.target.value) || 1)))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SVG Trajectory Chart */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 relative">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                Trajectory Timeline (Day 0 to Day {horizonDays})
              </span>
              <span className="text-[11px] text-slate-500">
                Hover or tap curve to view daily cash breakdown
              </span>
            </div>

            {/* SVG Plot */}
            <div className="relative w-full overflow-hidden select-none">
              <svg
                viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                className="w-full h-44 sm:h-52 overflow-visible"
              >
                <defs>
                  <linearGradient id="cashGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity="0.4" />
                    <stop offset="85%" stopColor="#6366f1" stopOpacity="0.0" />
                  </linearGradient>
                  <linearGradient id="overdraftGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.05" />
                  </linearGradient>
                </defs>

                {/* Zero Baseline */}
                {zeroLineY >= 0 && zeroLineY <= chartHeight && (
                  <g>
                    <line
                      x1={paddingX}
                      y1={zeroLineY}
                      x2={chartWidth - paddingX}
                      y2={zeroLineY}
                      stroke="#ef4444"
                      strokeWidth="1.5"
                      strokeDasharray="4 4"
                      opacity="0.6"
                    />
                    <text
                      x={chartWidth - paddingX - 4}
                      y={zeroLineY - 4}
                      fill="#ef4444"
                      fontSize="9"
                      fontWeight="bold"
                      textAnchor="end"
                    >
                      {preferences.currencySymbol}0.00 Overdraft Line
                    </text>
                  </g>
                )}

                {/* Path Area Fill */}
                <path
                  d={`${svgPoints} L ${chartWidth - paddingX} ${chartHeight - paddingBottom} L ${paddingX} ${chartHeight - paddingBottom} Z`}
                  fill="url(#cashGradient)"
                />

                {/* Main Curve Line */}
                <path
                  d={svgPoints}
                  fill="none"
                  stroke={summary.isOverdraftRisk ? '#f43f5e' : '#6366f1'}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* Interactive Points */}
                {points.map((p, idx) => {
                  const stepX = (chartWidth - paddingX * 2) / (points.length - 1 || 1);
                  const x = paddingX + idx * stepX;
                  const range = maxVal - minVal || 1;
                  const availableHeight = chartHeight - paddingTop - paddingBottom;
                  const normalizedY = (p.projectedBalance - minVal) / range;
                  const y = chartHeight - paddingBottom - normalizedY * availableHeight;

                  const hasEvents = p.events.length > 0;
                  const isHovered = hoveredPointIndex === idx;

                  return (
                    <g
                      key={p.date}
                      className="cursor-pointer"
                      onMouseEnter={() => setHoveredPointIndex(idx)}
                      onTouchStart={() => setHoveredPointIndex(idx)}
                    >
                      {/* Invisible larger hit target */}
                      <circle cx={x} cy={y} r="10" fill="transparent" />

                      {/* Visible node */}
                      {(hasEvents || isHovered || idx === 0 || idx === points.length - 1) && (
                        <circle
                          cx={x}
                          cy={y}
                          r={isHovered ? 5.5 : hasEvents ? 3.5 : 2.5}
                          fill={p.isOverdraft ? '#ef4444' : hasEvents ? '#fbbf24' : '#6366f1'}
                          stroke="#0f172a"
                          strokeWidth="2"
                        />
                      )}
                    </g>
                  );
                })}

                {/* Date Axis Markers */}
                <g className="text-[9px] fill-slate-500 font-medium">
                  <text x={paddingX} y={chartHeight - 8} textAnchor="start">
                    Today ({points[0]?.dayLabel})
                  </text>
                  {points.length > 15 && (
                    <text
                      x={chartWidth / 2}
                      y={chartHeight - 8}
                      textAnchor="middle"
                    >
                      Day {Math.round(horizonDays / 2)} ({points[Math.round(points.length / 2)]?.dayLabel})
                    </text>
                  )}
                  <text x={chartWidth - paddingX} y={chartHeight - 8} textAnchor="end">
                    Day {horizonDays} ({points[points.length - 1]?.dayLabel})
                  </text>
                </g>
              </svg>
            </div>

            {/* Hovered Date Detail Tooltip Card */}
            {activeHoverPoint && (
              <div className="mt-3 p-3 rounded-xl bg-slate-900 border border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-2 animate-in fade-in duration-150">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-300">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-white">
                      {activeHoverPoint.dayLabel} ({activeHoverPoint.date})
                    </span>
                    <div className="text-[11px] text-slate-400">
                      Projected balance:{' '}
                      <span
                        className={`font-semibold ${
                          activeHoverPoint.projectedBalance < 0
                            ? 'text-rose-400'
                            : 'text-indigo-300'
                        }`}
                      >
                        {formatCurrency(activeHoverPoint.projectedBalance)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Events breakdown on this day */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {activeHoverPoint.events.length > 0 ? (
                    activeHoverPoint.events.map((ev, i) => (
                      <span
                        key={i}
                        className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                          ev.type === 'income'
                            ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                            : ev.source === 'simulated'
                            ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                            : 'bg-rose-500/10 text-rose-300 border border-rose-500/20'
                        }`}
                      >
                        {ev.type === 'income' ? '+' : '-'}
                        {formatCurrency(ev.amount)} ({ev.name})
                      </span>
                    ))
                  ) : (
                    <span className="text-[11px] text-slate-500 italic">
                      Standard daily baseline burn only ({formatCurrency(activeHoverPoint.dailyBurn)})
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
