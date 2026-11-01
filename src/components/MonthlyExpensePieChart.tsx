import React, { useState, useMemo } from 'react';
import type { Transaction, Category } from '../types';
import { usePreferences } from '../context/PreferencesContext';
import { PieChart, Calendar } from 'lucide-react';

interface MonthlyExpensePieChartProps {
  transactions: Transaction[];
  categories: Category[];
  selectedMonth?: string; // e.g. "2026-11" or "all"
  onSelectMonth?: (month: string) => void;
  showMonthSelector?: boolean;
  title?: string;
  subtitle?: string;
}

const PALETTE = [
  '#10b981', // emerald
  '#3b82f6', // blue
  '#f59e0b', // amber
  '#ec4899', // pink
  '#8b5cf6', // purple
  '#06b6d4', // cyan
  '#f97316', // orange
  '#a855f7', // violet
  '#14b8a6', // teal
  '#64748b', // slate
  '#e11d48', // rose
  '#84cc16', // lime
];

export const MonthlyExpensePieChart: React.FC<MonthlyExpensePieChartProps> = ({
  transactions,
  categories,
  selectedMonth: controlledMonth,
  onSelectMonth,
  showMonthSelector = true,
  title = 'Monthly Expense Distribution',
  subtitle = 'Category breakdown of expenses for the selected month',
}) => {
  const { formatCurrency } = usePreferences();

  // Internal state for selected month if not controlled externally
  const [internalMonth, setInternalMonth] = useState<string>(() => {
    return new Date().toISOString().slice(0, 7);
  });

  const activeMonth = controlledMonth !== undefined ? controlledMonth : internalMonth;

  const handleMonthChange = (month: string) => {
    if (onSelectMonth) {
      onSelectMonth(month);
    } else {
      setInternalMonth(month);
    }
  };

  // Discover all unique months present in transactions
  const availableMonths = useMemo(() => {
    const monthSet = new Set<string>();
    transactions.forEach((t) => {
      if (t.transaction_date) {
        monthSet.add(t.transaction_date.slice(0, 7));
      }
    });
    // Ensure current month is always an option
    const currentM = new Date().toISOString().slice(0, 7);
    monthSet.add(currentM);

    return Array.from(monthSet).sort().reverse();
  }, [transactions]);

  // Filter transactions for expenses in selected month
  const filteredExpenses = useMemo(() => {
    return transactions.filter((t) => {
      if (t.type !== 'expense') return false;
      if (activeMonth === 'all') return true;
      return t.transaction_date?.startsWith(activeMonth);
    });
  }, [transactions, activeMonth]);

  // Category name map
  const categoryMap = useMemo(() => {
    const map = new Map<string, string>();
    categories.forEach((c) => map.set(c.id, c.name));
    return map;
  }, [categories]);

  // Aggregate by category
  const categoryStats = useMemo(() => {
    const map = new Map<string, { categoryId: string; name: string; total: number; count: number }>();

    filteredExpenses.forEach((t) => {
      const catId = t.category_id || 'uncategorized';
      const catName = t.categories?.name || categoryMap.get(catId) || 'Uncategorized';
      const existing = map.get(catId) || { categoryId: catId, name: catName, total: 0, count: 0 };
      existing.total += Number(t.amount || 0);
      existing.count += 1;
      map.set(catId, existing);
    });

    const totalExpense = Array.from(map.values()).reduce((sum, item) => sum + item.total, 0);

    const items = Array.from(map.values())
      .map((item, index) => ({
        ...item,
        percentage: totalExpense > 0 ? (item.total / totalExpense) * 100 : 0,
        color: PALETTE[index % PALETTE.length],
      }))
      .sort((a, b) => b.total - a.total);

    return {
      items,
      totalExpense,
      count: filteredExpenses.length,
    };
  }, [filteredExpenses, categoryMap]);

  // Hover state
  const [hoveredCategoryId, setHoveredCategoryId] = useState<string | null>(null);

  const hoveredItem = useMemo(() => {
    if (!hoveredCategoryId) return null;
    return categoryStats.items.find((item) => item.categoryId === hoveredCategoryId) || null;
  }, [hoveredCategoryId, categoryStats.items]);

  // Format month for display
  const formatMonthLabel = (monthStr: string) => {
    if (monthStr === 'all') return 'All Time';
    try {
      const [year, month] = monthStr.split('-');
      const date = new Date(Number(year), Number(month) - 1, 1);
      return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    } catch {
      return monthStr;
    }
  };

  // SVG Donut calculation
  const size = 260;
  const center = size / 2;
  const radius = 95;
  const innerRadius = 58;

  // Compute angles for each item
  const slices = useMemo(() => {
    let currentAngle = -Math.PI / 2; // start at top 12 o'clock
    return categoryStats.items.map((item) => {
      const angleLength = (item.percentage / 100) * 2 * Math.PI;
      const startAngle = currentAngle;
      const endAngle = currentAngle + angleLength;
      currentAngle = endAngle;

      return {
        ...item,
        startAngle,
        endAngle,
      };
    });
  }, [categoryStats.items]);

  const renderPath = (slice: (typeof slices)[0], isHovered: boolean) => {
    const r = isHovered ? radius + 5 : radius;
    const ir = isHovered ? innerRadius - 2 : innerRadius;

    // Single item handling (covers 100%)
    if (categoryStats.items.length === 1 || slice.percentage >= 99.9) {
      return (
        <circle
          key={slice.categoryId}
          cx={center}
          cy={center}
          r={(r + ir) / 2}
          fill="none"
          stroke={slice.color}
          strokeWidth={r - ir}
          className="transition-all duration-200 cursor-pointer"
          onMouseEnter={() => setHoveredCategoryId(slice.categoryId)}
          onMouseLeave={() => setHoveredCategoryId(null)}
        />
      );
    }

    const x0 = center + r * Math.cos(slice.startAngle);
    const y0 = center + r * Math.sin(slice.startAngle);
    const x1 = center + r * Math.cos(slice.endAngle);
    const y1 = center + r * Math.sin(slice.endAngle);

    const ix0 = center + ir * Math.cos(slice.endAngle);
    const iy0 = center + ir * Math.sin(slice.endAngle);
    const ix1 = center + ir * Math.cos(slice.startAngle);
    const iy1 = center + ir * Math.sin(slice.startAngle);

    const largeArc = slice.endAngle - slice.startAngle > Math.PI ? 1 : 0;

    const d = `
      M ${x0} ${y0}
      A ${r} ${r} 0 ${largeArc} 1 ${x1} ${y1}
      L ${ix0} ${iy0}
      A ${ir} ${ir} 0 ${largeArc} 0 ${ix1} ${iy1}
      Z
    `;

    return (
      <path
        key={slice.categoryId}
        d={d}
        fill={slice.color}
        opacity={hoveredCategoryId && !isHovered ? 0.45 : 1}
        className="transition-all duration-200 cursor-pointer hover:filter hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.2)]"
        onMouseEnter={() => setHoveredCategoryId(slice.categoryId)}
        onMouseLeave={() => setHoveredCategoryId(null)}
      />
    );
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
      {/* Header with Title and Month Picker */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <PieChart className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white tracking-tight">{title}</h3>
            <p className="text-xs text-slate-400">{subtitle}</p>
          </div>
        </div>

        {showMonthSelector && (
          <div className="flex items-center gap-2">
            <div className="relative">
              <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                value={activeMonth}
                onChange={(e) => handleMonthChange(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer font-medium"
              >
                <option value="all">All Time</option>
                {availableMonths.map((m) => (
                  <option key={m} value={m}>
                    {formatMonthLabel(m)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {categoryStats.items.length === 0 ? (
        <div className="py-12 flex flex-col items-center justify-center text-center border border-dashed border-slate-800 rounded-xl p-6">
          <div className="w-12 h-12 rounded-full bg-slate-800/60 flex items-center justify-center text-slate-500 mb-2">
            <PieChart className="w-6 h-6" />
          </div>
          <p className="text-xs font-semibold text-slate-300">
            No expenses recorded for {formatMonthLabel(activeMonth)}
          </p>
          <p className="text-[11px] text-slate-500 mt-1 max-w-xs">
            Log an expense transaction using the AI prompt or manual entry to see category breakdown.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
          {/* Donut Chart SVG */}
          <div className="md:col-span-5 flex flex-col items-center justify-center relative">
            <svg
              width={size}
              height={size}
              viewBox={`0 0 ${size} ${size}`}
              className="overflow-visible"
            >
              {slices.map((slice) => {
                const isHovered = hoveredCategoryId === slice.categoryId;
                return renderPath(slice, isHovered);
              })}

              {/* Center Content in Donut */}
              <g pointerEvents="none">
                {hoveredItem ? (
                  <>
                    <text
                      x={center}
                      y={center - 14}
                      textAnchor="middle"
                      className="fill-slate-400 text-[10px] font-semibold uppercase tracking-wider"
                    >
                      {hoveredItem.name}
                    </text>
                    <text
                      x={center}
                      y={center + 8}
                      textAnchor="middle"
                      className="fill-white text-base font-extrabold"
                    >
                      {formatCurrency(hoveredItem.total)}
                    </text>
                    <text
                      x={center}
                      y={center + 24}
                      textAnchor="middle"
                      className="fill-rose-400 text-xs font-bold"
                    >
                      {hoveredItem.percentage.toFixed(1)}%
                    </text>
                  </>
                ) : (
                  <>
                    <text
                      x={center}
                      y={center - 12}
                      textAnchor="middle"
                      className="fill-slate-400 text-[10px] font-semibold uppercase tracking-wider"
                    >
                      Total Spent
                    </text>
                    <text
                      x={center}
                      y={center + 9}
                      textAnchor="middle"
                      className="fill-rose-400 text-base font-extrabold"
                    >
                      {formatCurrency(categoryStats.totalExpense)}
                    </text>
                    <text
                      x={center}
                      y={center + 25}
                      textAnchor="middle"
                      className="fill-slate-400 text-[10px]"
                    >
                      {categoryStats.count} {categoryStats.count === 1 ? 'expense' : 'expenses'}
                    </text>
                  </>
                )}
              </g>
            </svg>
            <span className="text-[10px] text-slate-500 mt-2">
              Hover over slices to inspect category totals
            </span>
          </div>

          {/* Category Breakdown & Legend */}
          <div className="md:col-span-7 space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
            {categoryStats.items.map((item) => {
              const isHovered = hoveredCategoryId === item.categoryId;
              return (
                <div
                  key={item.categoryId}
                  onMouseEnter={() => setHoveredCategoryId(item.categoryId)}
                  onMouseLeave={() => setHoveredCategoryId(null)}
                  className={`p-2.5 rounded-xl border transition cursor-pointer ${
                    isHovered
                      ? 'bg-slate-800/90 border-slate-700 shadow-md'
                      : 'bg-slate-950/60 border-slate-850 hover:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="font-semibold text-slate-200 truncate">{item.name}</span>
                      <span className="text-[10px] text-slate-500 shrink-0">
                        ({item.count} tx)
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-bold text-white">{formatCurrency(item.total)}</span>
                      <span
                        className="text-[11px] font-bold px-1.5 py-0.5 rounded"
                        style={{
                          backgroundColor: `${item.color}20`,
                          color: item.color,
                        }}
                      >
                        {item.percentage.toFixed(1)}%
                      </span>
                    </div>
                  </div>

                  {/* Percentage Bar */}
                  <div className="w-full bg-slate-850 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.max(item.percentage, 3)}%`,
                        backgroundColor: item.color,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
