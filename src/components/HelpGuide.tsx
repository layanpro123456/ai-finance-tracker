import React, { useState, useMemo } from 'react';
import type { ErpTab } from './Navbar';
import {
  HelpCircle,
  BookOpen,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  Wallet,
  CheckSquare,
  Package,
  CreditCard,
  Users,
  Copy,
  Check,
  Search,
  Zap,
  ShieldCheck,
  Smartphone,
  TrendingUp,
  Flame,
  AlertCircle,
} from 'lucide-react';

interface HelpGuideProps {
  onNavigateTab: (tab: ErpTab) => void;
}

type GuideSection =
  | 'quickstart'
  | 'finance'
  | 'tasks'
  | 'assets'
  | 'subscriptions'
  | 'contacts'
  | 'prompts'
  | 'faq';

const SECTIONS: { id: GuideSection; label: string; icon: React.ReactNode; desc: string; keywords: string }[] = [
  {
    id: 'quickstart',
    label: 'Quick Start',
    icon: <Zap className="w-4 h-4 text-emerald-400" />,
    desc: '3-step getting started guide',
    keywords: 'getting started setup onboarding steps quickstart',
  },
  {
    id: 'finance',
    label: 'Finance & Ledger',
    icon: <Wallet className="w-4 h-4 text-blue-400" />,
    desc: 'Accounts, budgets, net worth',
    keywords: 'finance ledger accounts balance net worth cash bank credit card budgets limits categories',
  },
  {
    id: 'tasks',
    label: 'Daily Tasks & Bills',
    icon: <CheckSquare className="w-4 h-4 text-teal-400" />,
    desc: 'Operations, bills, streaks',
    keywords: 'tasks bills payable receivable due dates operations habits no-spend streak checkoff',
  },
  {
    id: 'assets',
    label: 'Asset Vault',
    icon: <Package className="w-4 h-4 text-sky-400" />,
    desc: 'Possessions & warranties',
    keywords: 'assets inventory electronics vehicles valuations warranty serial number possessions equipment',
  },
  {
    id: 'subscriptions',
    label: 'Subscriptions',
    icon: <CreditCard className="w-4 h-4 text-rose-400" />,
    desc: 'Burn rate & renewals',
    keywords: 'subscriptions recurring burn rate renewals billing monthly annual cancel links netflix gym',
  },
  {
    id: 'contacts',
    label: 'Social IOU',
    icon: <Users className="w-4 h-4 text-purple-400" />,
    desc: 'Peer debts & splits',
    keywords: 'social iou contacts friends debts lend borrow dinner split settle payments',
  },
  {
    id: 'prompts',
    label: 'AI Prompts Guide',
    icon: <Sparkles className="w-4 h-4 text-amber-400" />,
    desc: 'Natural language tips',
    keywords: 'ai natural language prompts cookbook logger assistant automated typing examples',
  },
  {
    id: 'faq',
    label: 'FAQ & Tips',
    icon: <HelpCircle className="w-4 h-4 text-slate-400" />,
    desc: 'Frequently asked questions',
    keywords: 'faq questions help privacy security theme dark light currency timezone mobile phone edit delete',
  },
];

export const HelpGuide: React.FC<HelpGuideProps> = ({ onNavigateTab }) => {
  const [activeSection, setActiveSection] = useState<GuideSection>('quickstart');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 2000);
  };

  // Filter sections by search query
  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return SECTIONS;
    const q = searchQuery.toLowerCase();
    return SECTIONS.filter(
      (s) =>
        s.label.toLowerCase().includes(q) ||
        s.desc.toLowerCase().includes(q) ||
        s.keywords.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  return (
    <div className="space-y-6">
      {/* Hero Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="absolute -top-24 -right-24 w-60 h-60 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
              <BookOpen className="w-3.5 h-3.5" />
              <span>User Manual &amp; Walkthrough</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Apex LifeOS User Guide
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 max-w-2xl">
              Learn how to track your personal finances, organize daily tasks, catalog assets, monitor subscriptions, and settle shared expenses in one unified system.
            </p>
          </div>

          {/* Quick Search */}
          <div className="w-full md:w-80">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search guide (e.g. bills, currency, IOU)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-750 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white text-xs cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Sidebar Navigator + Content Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Navigation Sidebar */}
        <div className="space-y-2 lg:sticky lg:top-24 self-start">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-2 mb-2">
            User Guide Chapters
          </p>
          {filteredSections.length === 0 ? (
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-center text-xs text-slate-500">
              No topics matching &ldquo;{searchQuery}&rdquo;.
            </div>
          ) : (
            filteredSections.map((sec) => (
              <button
                key={sec.id}
                onClick={() => setActiveSection(sec.id)}
                className={`w-full p-3 rounded-2xl border text-left transition flex items-center justify-between cursor-pointer ${
                  activeSection === sec.id
                    ? 'bg-slate-900 border-emerald-500/40 shadow-sm'
                    : 'bg-slate-950/60 border-slate-850 hover:bg-slate-900/60 hover:border-slate-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`p-2 rounded-xl ${
                      activeSection === sec.id
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-slate-900 border border-slate-800'
                    }`}
                  >
                    {sec.icon}
                  </div>
                  <div>
                    <div
                      className={`text-xs font-bold ${
                        activeSection === sec.id ? 'text-white' : 'text-slate-300'
                      }`}
                    >
                      {sec.label}
                    </div>
                    <div className="text-[10px] text-slate-500 truncate max-w-[130px]">{sec.desc}</div>
                  </div>
                </div>
                <ArrowRight
                  className={`w-3.5 h-3.5 ${
                    activeSection === sec.id ? 'text-emerald-400' : 'text-slate-600'
                  }`}
                />
              </button>
            ))
          )}
        </div>

        {/* Content Container */}
        <div className="lg:col-span-3 space-y-6">
          {/* ========================================================================= */}
          {/* 1. QUICK START (100% USER-FOCUSED) */}
          {/* ========================================================================= */}
          {activeSection === 'quickstart' && (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-8 shadow-xl">
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                  <Zap className="w-5 h-5 text-emerald-400" />
                  <span>Getting Started in 3 Simple Steps</span>
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Follow this quick checklist to personalize and set up your system in under 2 minutes.
                </p>
              </div>

              {/* Step 1: Accounts Setup */}
              <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 rounded-xl bg-emerald-500 text-slate-950 font-extrabold text-xs flex items-center justify-center">
                      1
                    </span>
                    <h3 className="text-sm font-bold text-white">Add Your Accounts &amp; Cash Wallets</h3>
                  </div>
                  <button
                    onClick={() => onNavigateTab('accounts')}
                    className="text-xs text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1 cursor-pointer"
                  >
                    <span>Add Accounts</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Head to the <strong>Accounts</strong> tab to add your everyday financial accounts (e.g. Primary Checking, High-Yield Savings, Physical Cash Wallet, Credit Cards) along with your starting balance. This provides the foundation for accurate net worth and expense tracking.
                </p>
                <div className="p-3 bg-slate-900 rounded-xl border border-slate-850 text-[11px] text-slate-400 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span>You can track both positive balances (Cash, Savings) and credit lines (Credit Cards).</span>
                </div>
              </div>

              {/* Step 2: Personalize Currency & Theme */}
              <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 rounded-xl bg-emerald-500 text-slate-950 font-extrabold text-xs flex items-center justify-center">
                      2
                    </span>
                    <h3 className="text-sm font-bold text-white">Choose Your Currency &amp; Display Theme</h3>
                  </div>
                  <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                    Customizable
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Look at the top navigation bar:
                </p>
                <ul className="text-xs text-slate-400 space-y-1.5 list-disc list-inside">
                  <li>
                    Click the <strong>Currency pill</strong> (e.g. <span className="text-emerald-400 font-mono font-medium">$ USD</span>) to select from 16+ global currencies, pick your country, and set your timezone.
                  </li>
                  <li>
                    Click the <strong>Sun / Moon icon</strong> to toggle between modern Dark mode and clean Light mode at any time.
                  </li>
                </ul>
              </div>

              {/* Step 3: Log Your First Entry */}
              <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 rounded-xl bg-emerald-500 text-slate-950 font-extrabold text-xs flex items-center justify-center">
                      3
                    </span>
                    <h3 className="text-sm font-bold text-white">Log Your First Transaction or Bill</h3>
                  </div>
                  <button
                    onClick={() => onNavigateTab('dashboard')}
                    className="text-xs text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1 cursor-pointer"
                  >
                    <span>Go to Overview</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  On the <strong>Overview</strong> screen, use the AI logger bar to type a purchase in plain words (e.g. <em className="text-slate-200">&ldquo;Spent $14 on lunch at Chipotle&rdquo;</em>). The system automatically selects the category, deducts your balance, and updates your monthly budget!
                </p>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* 2. FINANCE & LEDGER */}
          {/* ========================================================================= */}
          {activeSection === 'finance' && (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl">
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-blue-400" />
                  <span>The Core Financial Hub</span>
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  How accounts, transactions, category budgets, and net worth calculations work together.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Automatic Balance Deductions</span>
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Whenever an expense or income transaction is logged, the selected account balance updates automatically. You never need to do manual arithmetic.
                  </p>
                </div>

                <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                    <span>Comprehensive Net Worth Formula</span>
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Unlike standard apps that only count liquid cash, Apex LifeOS calculates your true financial position:
                  </p>
                  <div className="p-2.5 bg-slate-900 rounded-xl font-mono text-[11px] text-emerald-300">
                    Net Worth = Liquid Cash + Asset Valuations + Social Receivables - Payables
                  </div>
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                <h3 className="text-sm font-bold text-white">Monthly Budgets &amp; Over-Spend Warnings</h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Go to the <strong>Budgets</strong> tab to set monthly limits for spending categories like Groceries, Dining Out, or Entertainment. Progress bars visually warn you when you exceed 80% (Amber) or 100% (Red) of your planned budget.
                </p>
                <div className="flex flex-wrap gap-3 pt-2">
                  <button
                    onClick={() => onNavigateTab('budgets')}
                    className="text-xs px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>Manage Budgets</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onNavigateTab('transactions')}
                    className="text-xs px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>View All Transactions</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* 3. DAILY TASKS & BILLS */}
          {/* ========================================================================= */}
          {activeSection === 'tasks' && (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl">
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                  <CheckSquare className="w-5 h-5 text-teal-400" />
                  <span>Daily Tasks &amp; Financial Obligations</span>
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  How daily productivity items trigger ledger transactions and habit tracking.
                </p>
              </div>

              <div className="space-y-4">
                <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
                      <Zap className="w-4 h-4" />
                    </span>
                    <h3 className="text-sm font-bold text-white">The Financial Task Bridge</h3>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    When creating any task, you can switch on <strong>&ldquo;Link this task to Financial Ledger&rdquo;</strong>:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div className="p-3.5 bg-slate-900 rounded-xl border border-slate-850 space-y-1">
                      <span className="text-xs font-bold text-rose-400 block">Payable (Bill to Pay)</span>
                      <p className="text-xs text-slate-400">
                        e.g., &ldquo;Pay Electricity Bill ($85)&rdquo;. When you check this task off, a 1-click prompt appears: <em>&ldquo;Deduct $85 from Checking Account?&rdquo;</em> It instantly logs the expense and lowers your account balance!
                      </p>
                    </div>
                    <div className="p-3.5 bg-slate-900 rounded-xl border border-slate-850 space-y-1">
                      <span className="text-xs font-bold text-emerald-400 block">Receivable (Income Expected)</span>
                      <p className="text-xs text-slate-400">
                        e.g., &ldquo;Deliver Freelance Project Milestone ($500)&rdquo;. Completing the task prompts you to record the deposit directly into your bank account.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex items-center gap-2">
                    <Flame className="w-4 h-4 text-amber-400" />
                    <h3 className="text-sm font-bold text-white">Daily &ldquo;No-Spend&rdquo; Streak Challenge</h3>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Build financial discipline and mindful spending habits. Each day you make zero non-essential discretionary purchases, check in with the streak button on the Tasks tab to build up your consecutive streak!
                  </p>
                </div>
              </div>

              <button
                onClick={() => onNavigateTab('tasks')}
                className="text-xs px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold transition flex items-center gap-1.5 cursor-pointer"
              >
                <span>Open Daily Tasks &amp; Bills</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* ========================================================================= */}
          {/* 4. ASSET VAULT */}
          {/* ========================================================================= */}
          {activeSection === 'assets' && (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl">
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                  <Package className="w-5 h-5 text-sky-400" />
                  <span>Personal Data &amp; Fixed Assets Vault</span>
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Catalog valuable physical gear, vehicles, electronics, and monitor warranty coverage.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5">
                  <span className="text-xs font-bold text-white block">1. Inventory &amp; Receipts</span>
                  <p className="text-xs text-slate-400">
                    Store serial numbers, purchase dates, original receipts, and storage locations so you always have documentation ready for insurance or resale.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5">
                  <span className="text-xs font-bold text-white block">2. Real-Time Net Worth</span>
                  <p className="text-xs text-slate-400">
                    The current estimated market value of all active assets automatically boosts your total Net Worth on the Overview dashboard.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5">
                  <span className="text-xs font-bold text-white block">3. Warranty Alerts</span>
                  <p className="text-xs text-slate-400">
                    Visual status badges alert you when manufacturer or credit card warranty periods are approaching expiration so you can file claims in time.
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-slate-400">
                <strong className="text-white">Pro-Tip:</strong> When logging a large purchase via the AI Assistant (e.g. <em className="text-slate-300">&ldquo;Bought $1,200 Laptop&rdquo;</em>), check the <strong>&ldquo;Also register as Personal Asset&rdquo;</strong> box to add it to your Asset Vault and ledger in one step!
              </div>

              <button
                onClick={() => onNavigateTab('assets')}
                className="text-xs px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold transition flex items-center gap-1.5 cursor-pointer"
              >
                <span>Open Asset Vault</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* ========================================================================= */}
          {/* 5. SUBSCRIPTIONS */}
          {/* ========================================================================= */}
          {activeSection === 'subscriptions' && (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl">
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-rose-400" />
                  <span>Subscriptions &amp; Recurring Commitments</span>
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Take control of recurring SaaS, streaming, gym, internet, and cloud services.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                <h3 className="text-sm font-bold text-white">Monthly &amp; Annualized Burn Rate</h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  The subscription manager normalizes weekly, monthly, and yearly cycles to show your exact monthly burn rate and 12-month projected commitment.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 text-xs">
                    <span className="font-bold text-emerald-400 block mb-1">1-Click &ldquo;Log Renewal&rdquo;</span>
                    <span className="text-slate-400">
                      When a renewal date arrives, click &ldquo;Log Renewal&rdquo; to immediately record the expense into your financial ledger and advance the billing date to next month automatically!
                    </span>
                  </div>
                  <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 text-xs">
                    <span className="font-bold text-amber-400 block mb-1">Direct Cancellation Links</span>
                    <span className="text-slate-400">
                      Save direct cancellation portal URLs for each service so you can cancel unused software in 1 click without digging through billing menus.
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => onNavigateTab('subscriptions')}
                className="text-xs px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold transition flex items-center gap-1.5 cursor-pointer"
              >
                <span>Open Subscriptions Manager</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* ========================================================================= */}
          {/* 6. SOCIAL LEDGER (IOUs) */}
          {/* ========================================================================= */}
          {activeSection === 'contacts' && (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl">
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                  <Users className="w-5 h-5 text-purple-400" />
                  <span>Social Ledger &amp; Peer Debts (IOUs)</span>
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Keep track of shared dinner splits, money lent to friends, and mutual group purchases.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                <h3 className="text-sm font-bold text-white">How 1-Click Settlement Works</h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Record who owes you (Receivables) or who you owe (Payables). When someone pays you back:
                </p>
                <ol className="text-xs text-slate-400 space-y-2 list-decimal list-inside">
                  <li>Navigate to the <strong>Social IOU</strong> tab.</li>
                  <li>Click <strong>Settle</strong> next to the friend&apos;s name.</li>
                  <li>Select the bank or cash wallet where the payment was received.</li>
                  <li>Click <strong>&ldquo;Log to Ledger &amp; Settle&rdquo;</strong> — this records the deposit and updates your cash balance!</li>
                </ol>
              </div>

              <button
                onClick={() => onNavigateTab('contacts')}
                className="text-xs px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold transition flex items-center gap-1.5 cursor-pointer"
              >
                <span>Open Social IOU Ledger</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* ========================================================================= */}
          {/* 7. AI PROMPTS COOKBOOK */}
          {/* ========================================================================= */}
          {activeSection === 'prompts' && (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl">
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-amber-400" />
                  <span>AI Natural Language Logger Guide</span>
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  The AI assistant bar understands everyday English and turns conversational sentences into categorized records.
                </p>
              </div>

              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Try These Sample Prompts (Click Copy to Test):
                </p>

                {[
                  { prompt: 'Spent $14.50 on lunch at Chipotle today', tag: 'Dining Out Expense' },
                  { prompt: 'Paid $82 for groceries at Trader Joe’s', tag: 'Groceries Expense' },
                  { prompt: 'Bought $1,200 Sony Mirrorless Camera on credit card', tag: 'Expense + Asset Registration' },
                  { prompt: 'Received $3,200 monthly salary deposit', tag: 'Income Deposit' },
                  { prompt: 'Paid $65 for car oil change yesterday', tag: 'Transportation Expense' },
                  { prompt: 'Lent $45 to Sarah for dinner bill', tag: 'Social IOU' },
                ].map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="text-slate-200 font-mono">&ldquo;{item.prompt}&rdquo;</span>
                      <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 hidden sm:inline">
                        {item.tag}
                      </span>
                    </div>
                    <button
                      onClick={() => handleCopy(item.prompt)}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] flex items-center gap-1 cursor-pointer flex-shrink-0"
                    >
                      {copiedText === item.prompt ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span className="text-emerald-400">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                ))}
              </div>

              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-slate-400 space-y-2">
                <span className="font-bold text-white block">Multi-Module Dispatch Checkboxes</span>
                <p>
                  Before saving any AI entry, a review dialog appears allowing you to verify the amount, date, account, and category. You can also tick <strong>&ldquo;Also register as Personal Asset&rdquo;</strong> or <strong>&ldquo;Also add Follow-up Task&rdquo;</strong> to update multiple areas of your life in one action!
                </p>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* 8. FAQ & USER TIPS (100% USER-FOCUSED) */}
          {/* ========================================================================= */}
          {activeSection === 'faq' && (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl">
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                  <HelpCircle className="w-5 h-5 text-slate-400" />
                  <span>Frequently Asked Questions &amp; User Tips</span>
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Common questions about using Apex LifeOS in your daily life.
                </p>
              </div>

              <div className="space-y-3">
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5">
                  <h4 className="text-xs font-bold text-white flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>Is my financial and personal data private?</span>
                  </h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Yes, absolutely. Your account is protected by strict user authentication and private cloud encryption. Your financial data, accounts, tasks, and assets are completely private and only accessible when you are logged into your account.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5">
                  <h4 className="text-xs font-bold text-white flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-blue-400" />
                    <span>Can I use Apex LifeOS on my mobile phone?</span>
                  </h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Yes! The application is fully responsive on iOS and Android smartphones. You can open your mobile browser, tap <strong>&ldquo;Share &gt; Add to Home Screen&rdquo;</strong> on iPhone or <strong>&ldquo;Install App&rdquo;</strong> on Android to use it just like a native app.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5">
                  <h4 className="text-xs font-bold text-white">How do I switch between Dark and Light mode?</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Click the <strong>Sun / Moon</strong> toggle icon in the top-right header at any time. Your preference is automatically saved on your device.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5">
                  <h4 className="text-xs font-bold text-white">Can I change my currency and timezone?</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Yes! Click the <strong>Currency pill</strong> in the navigation header to open Preferences, select from over 16 global currencies (USD, EUR, GBP, INR, JPY, CAD, AUD, etc.), and set your preferred timezone. All numbers across the app will adapt instantly.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5">
                  <h4 className="text-xs font-bold text-white">Can I edit or delete a transaction after creating it?</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Yes. Navigate to the <strong>Ledger (Transactions)</strong> tab, locate the item in the list, and use the edit or trash icons to update the details or remove it. Your account balances will automatically recalculate.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5">
                  <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-amber-400" />
                    <span>What happens if I spend more than my budget?</span>
                  </h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Apex LifeOS will visually highlight the category with a red warning badge in the Budgets tab to inform you that you have exceeded your target limit. However, your transaction will still be recorded accurately so your bank balances remain 100% true.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
