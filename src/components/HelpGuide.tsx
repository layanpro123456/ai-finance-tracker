import React, { useState } from 'react';
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
} from 'lucide-react';

interface HelpGuideProps {
  onNavigateTab: (tab: ErpTab) => void;
  onOpenSettings?: () => void;
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

export const HelpGuide: React.FC<HelpGuideProps> = ({ onNavigateTab }) => {
  const [activeSection, setActiveSection] = useState<GuideSection>('quickstart');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const sections: { id: GuideSection; label: string; icon: React.ReactNode; desc: string }[] = [
    { id: 'quickstart', label: 'Quick Start', icon: <Zap className="w-4 h-4 text-emerald-400" />, desc: '3-step setup guide' },
    { id: 'finance', label: 'Finance & Ledger', icon: <Wallet className="w-4 h-4 text-blue-400" />, desc: 'Ledger, accounts, budgets' },
    { id: 'tasks', label: 'Daily Tasks & Bills', icon: <CheckSquare className="w-4 h-4 text-teal-400" />, desc: 'Operations & settlements' },
    { id: 'assets', label: 'Asset Vault', icon: <Package className="w-4 h-4 text-sky-400" />, desc: 'Inventory & net worth' },
    { id: 'subscriptions', label: 'Subscriptions', icon: <CreditCard className="w-4 h-4 text-rose-400" />, desc: 'Burn rate & renewals' },
    { id: 'contacts', label: 'Social IOU', icon: <Users className="w-4 h-4 text-purple-400" />, desc: 'Peer debts & splits' },
    { id: 'prompts', label: 'AI Prompts Guide', icon: <Sparkles className="w-4 h-4 text-amber-400" />, desc: 'Cookbook & prompt tips' },
    { id: 'faq', label: 'FAQ & Help', icon: <HelpCircle className="w-4 h-4 text-slate-400" />, desc: 'Common questions' },
  ];

  return (
    <div className="space-y-6">
      {/* Hero Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="absolute -top-24 -right-24 w-60 h-60 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
              <BookOpen className="w-3.5 h-3.5" />
              <span>Step-by-Step System Documentation</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Apex LifeOS User Manual &amp; Help Center
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 max-w-2xl">
              Learn how to connect your daily operations, fixed assets, and recurring commitments to your financial ledger for complete personal intelligence.
            </p>
          </div>

          {/* Quick Search */}
          <div className="w-full md:w-72">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search guide &amp; topics..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-750 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Sidebar Navigator + Content Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Navigation Sidebar */}
        <div className="space-y-2 lg:sticky lg:top-24 self-start">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-2 mb-2">
            Table of Contents
          </p>
          {sections.map((sec) => (
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
                <div className={`p-2 rounded-xl ${activeSection === sec.id ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-900 border border-slate-800'}`}>
                  {sec.icon}
                </div>
                <div>
                  <div className={`text-xs font-bold ${activeSection === sec.id ? 'text-white' : 'text-slate-300'}`}>
                    {sec.label}
                  </div>
                  <div className="text-[10px] text-slate-500 truncate max-w-[130px]">{sec.desc}</div>
                </div>
              </div>
              <ArrowRight className={`w-3.5 h-3.5 ${activeSection === sec.id ? 'text-emerald-400' : 'text-slate-600'}`} />
            </button>
          ))}
        </div>

        {/* Content Container */}
        <div className="lg:col-span-3 space-y-6">
          {/* ========================================================================= */}
          {/* 1. QUICK START */}
          {/* ========================================================================= */}
          {activeSection === 'quickstart' && (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-8 shadow-xl">
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                  <Zap className="w-5 h-5 text-emerald-400" />
                  <span>Getting Started in 3 Steps</span>
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Follow this checklist to initialize your Personal ERP in less than 2 minutes.
                </p>
              </div>

              {/* Step 1 */}
              <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 rounded-xl bg-emerald-500 text-slate-950 font-extrabold text-xs flex items-center justify-center">
                      1
                    </span>
                    <h3 className="text-sm font-bold text-white">Apply Supabase Database Migration</h3>
                  </div>
                  <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                    Required for Cloud Sync
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  To persist your <strong>Tasks</strong>, <strong>Assets</strong>, <strong>Subscriptions</strong>, and <strong>Social IOU debts</strong> in Supabase, execute the SQL migration script:
                </p>
                <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 flex items-center justify-between font-mono text-xs text-slate-300 overflow-x-auto">
                  <span className="truncate">supabase/migrations/20261013_personal_erp_expansion.sql</span>
                  <button
                    onClick={() => handleCopy('supabase/migrations/20261013_personal_erp_expansion.sql')}
                    className="ml-2 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] flex items-center gap-1 cursor-pointer flex-shrink-0"
                  >
                    {copiedText === 'supabase/migrations/20261013_personal_erp_expansion.sql' ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span className="text-emerald-400">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy Path</span>
                      </>
                    )}
                  </button>
                </div>
                <p className="text-[11px] text-slate-400">
                  👉 Go to your <strong>Supabase Dashboard &gt; SQL Editor &gt; New Query</strong>, paste the script content, and click <strong>Run</strong>.
                </p>
              </div>

              {/* Step 2 */}
              <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 rounded-xl bg-emerald-500 text-slate-950 font-extrabold text-xs flex items-center justify-center">
                      2
                    </span>
                    <h3 className="text-sm font-bold text-white">Adjust Currency, Country &amp; Timezone</h3>
                  </div>
                  <button
                    onClick={() => onNavigateTab('dashboard')}
                    className="text-xs text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1 cursor-pointer"
                  >
                    <span>Open Settings</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Click the <strong>Currency pill</strong> in the top navigation bar to choose your primary currency (USD, EUR, GBP, INR, JPY, CAD, AUD, etc.), auto-detect your local timezone, and pick your preferred theme (Dark or Light mode).
                </p>
              </div>

              {/* Step 3 */}
              <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 rounded-xl bg-emerald-500 text-slate-950 font-extrabold text-xs flex items-center justify-center">
                      3
                    </span>
                    <h3 className="text-sm font-bold text-white">Configure Your Accounts &amp; Log First Item</h3>
                  </div>
                  <button
                    onClick={() => onNavigateTab('accounts')}
                    className="text-xs text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1 cursor-pointer"
                  >
                    <span>Manage Accounts</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Head over to the <strong>Accounts</strong> tab to add your bank accounts, cash wallets, or credit cards. Once configured, you can use the AI logger on the Overview dashboard to log your first transaction in natural language!
                </p>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* 2. FINANCE ENGINE */}
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
                    Whenever an expense or income transaction is confirmed, the selected account balance updates automatically. You never need to do manual arithmetic.
                  </p>
                </div>

                <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Comprehensive Net Worth Formula</span>
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Unlike standard expense apps that only count liquid cash, Apex LifeOS calculates:
                  </p>
                  <div className="p-2.5 bg-slate-900 rounded-xl font-mono text-[11px] text-emerald-300">
                    Net Worth = Liquid Cash + Asset Valuations + Social Receivables - Payables
                  </div>
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                <h3 className="text-sm font-bold text-white">Monthly Budgets &amp; Over-Spend Warnings</h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Go to the <strong>Budgets</strong> tab to set monthly limits for categories like Groceries, Dining Out, or Utilities. Progress bars visually warn you when you exceed 80% or 100% of your planned limit.
                </p>
                <button
                  onClick={() => onNavigateTab('budgets')}
                  className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <span>Go to Budget Manager</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
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
                    <h3 className="text-sm font-bold text-white">The "Financial Task Bridge" Feature</h3>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    When creating any task, toggle <strong>"Link this task to Financial Ledger"</strong>:
                  </p>
                  <ul className="text-xs text-slate-400 space-y-2 list-disc list-inside">
                    <li>
                      <strong>Payable (Bill to Pay):</strong> e.g., "Pay WiFi Bill ($60)". When you check this task off, a popup prompts: <em>"Deduct $60 from Checking Account?"</em> One click automatically creates an expense transaction and reduces your bank balance!
                    </li>
                    <li>
                      <strong>Receivable (Income Expected):</strong> e.g., "Deliver Client Website Milestone ($800)". When completed, prompts to record the income deposit.
                    </li>
                  </ul>
                </div>

                <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                  <h3 className="text-sm font-bold text-white">Daily "No-Spend" Streak Habit</h3>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Build financial discipline with the built-in streak widget. Check in each day you make zero discretionary purchases to keep your streak glowing!
                  </p>
                </div>
              </div>

              <button
                onClick={() => onNavigateTab('tasks')}
                className="text-xs px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold transition flex items-center gap-1.5 cursor-pointer"
              >
                <span>Open Daily Tasks &amp; Operations</span>
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
                  <span className="text-xs font-bold text-white block">1. Inventory Tracking</span>
                  <p className="text-xs text-slate-400">
                    Store serial numbers, purchase receipts, storage location, and purchase date.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5">
                  <span className="text-xs font-bold text-white block">2. Real-Time Net Worth</span>
                  <p className="text-xs text-slate-400">
                    The current value of all active assets automatically factors into your total net worth score.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5">
                  <span className="text-xs font-bold text-white block">3. Warranty Alerts</span>
                  <p className="text-xs text-slate-400">
                    Visual badge countdown notifies you before manufacturer or credit card warranties expire.
                  </p>
                </div>
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
                  Take control of recurring SaaS, streaming, gym, and utility memberships.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                <h3 className="text-sm font-bold text-white">Monthly &amp; Annualized Burn Rate</h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  The subscription manager normalizes weekly, monthly, and yearly cycles to show your exact monthly burn rate and 12-month projected commitment.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 text-xs">
                    <span className="font-bold text-emerald-400 block mb-1">1-Click "Log Charge"</span>
                    <span className="text-slate-400">
                      When a renewal date arrives, click "Log Charge" to immediately record the expense into your ledger and advance the billing date to next month!
                    </span>
                  </div>
                  <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 text-xs">
                    <span className="font-bold text-amber-400 block mb-1">Cancellation Links</span>
                    <span className="text-slate-400">
                      Store direct cancellation portal URLs for each service so you can cancel unused software in 1 click without digging through settings.
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
          {/* 6. SOCIAL LEDGER */}
          {/* ========================================================================= */}
          {activeSection === 'contacts' && (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl">
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                  <Users className="w-5 h-5 text-purple-400" />
                  <span>Social Ledger &amp; Peer Debts (IOUs)</span>
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Keep track of dinner splits, money lent to friends, and shared group purchases.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                <h3 className="text-sm font-bold text-white">How Settlement Works</h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Record who owes you or who you owe with a target due date. When someone pays you back:
                </p>
                <ol className="text-xs text-slate-400 space-y-1.5 list-decimal list-inside">
                  <li>Click <strong>Settle</strong> next to the contact.</li>
                  <li>Select the bank or cash account where the money was received.</li>
                  <li>Click <strong>"Log to Ledger &amp; Settle"</strong> — this updates your cash balance and archives the debt.</li>
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
                  The AI prompt bar parses conversational English into structured financial records.
                </p>
              </div>

              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Try These Sample Prompts (Click to Copy):
                </p>

                {[
                  { prompt: 'Spent $14.50 on lunch at Chipotle today', tag: 'Dining Out Expense' },
                  { prompt: 'Paid $82 for groceries at Trader Joe’s', tag: 'Groceries Expense' },
                  { prompt: 'Bought $1,200 Sony Mirrorless Camera on credit card', tag: 'Expense + Asset Registration' },
                  { prompt: 'Received $3,200 monthly salary', tag: 'Income Event' },
                  { prompt: 'Paid $65 for car oil change yesterday', tag: 'Transportation Expense' },
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
                <span className="font-bold text-white block">ERP Multi-Module Toggles</span>
                <p>
                  When the review modal appears, you can tick <strong>"Also register as Personal Asset"</strong> or <strong>"Also add Follow-up Task"</strong> to dispatch records across your ERP in one operation!
                </p>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* 8. FAQ & TROUBLESHOOTING */}
          {/* ========================================================================= */}
          {activeSection === 'faq' && (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl">
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                  <HelpCircle className="w-5 h-5 text-slate-400" />
                  <span>Frequently Asked Questions &amp; Troubleshooting</span>
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Quick answers to common questions about data storage, security, and usage.
                </p>
              </div>

              <div className="space-y-3">
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5">
                  <h4 className="text-xs font-bold text-white">Why do I see a banner about database tables?</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    This banner indicates that the extended tables (Tasks, Assets, Subscriptions, Contacts) have not yet been created in your Supabase project. Open your Supabase SQL Editor and run <code className="text-emerald-400">supabase/migrations/20261013_personal_erp_expansion.sql</code> to dismiss the banner and enable cloud persistence.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5">
                  <h4 className="text-xs font-bold text-white">Is my financial data private and secure?</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Yes. All tables in Supabase use strict Row-Level Security (RLS) policies. Only your authenticated user account (<code className="text-emerald-400">auth.uid()</code>) can read, insert, update, or delete your records.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5">
                  <h4 className="text-xs font-bold text-white">How do I switch between Dark and Light mode?</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Click the <strong>Sun / Moon</strong> toggle icon in the top-right header at any time. Your preference is automatically remembered on your device.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5">
                  <h4 className="text-xs font-bold text-white">Can I change my default currency later?</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Yes! Click the <strong>Currency pill</strong> in the navigation header to open System Preferences, pick any currency (USD, EUR, GBP, INR, JPY, CAD, AUD, etc.), and click Apply Changes. All numbers across the app will adapt instantly.
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
