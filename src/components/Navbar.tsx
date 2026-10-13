import React from 'react';
import { Sparkles, LogOut, LayoutDashboard, Receipt, Wallet, PieChart } from 'lucide-react';

interface NavbarProps {
  userEmail: string;
  activeTab: 'dashboard' | 'transactions' | 'accounts' | 'budgets';
  setActiveTab: (tab: 'dashboard' | 'transactions' | 'accounts' | 'budgets') => void;
  onSignOut: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  userEmail,
  activeTab,
  setActiveTab,
  onSignOut,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-950 font-bold shadow-lg shadow-emerald-500/20">
              <Sparkles className="w-5 h-5 text-slate-950" />
            </div>
            <div>
              <span className="font-bold text-lg text-white tracking-tight">AI Finance</span>
              <span className="text-xs ml-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Tracker
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-1 bg-slate-800/60 p-1 rounded-xl border border-slate-700/60">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition cursor-pointer ${
                activeTab === 'dashboard'
                  ? 'bg-slate-700 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              Dashboard
            </button>
            <button
              onClick={() => setActiveTab('transactions')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition cursor-pointer ${
                activeTab === 'transactions'
                  ? 'bg-slate-700 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Receipt className="w-4 h-4" />
              Transactions
            </button>
            <button
              onClick={() => setActiveTab('accounts')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition cursor-pointer ${
                activeTab === 'accounts'
                  ? 'bg-slate-700 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Wallet className="w-4 h-4" />
              Accounts
            </button>
            <button
              onClick={() => setActiveTab('budgets')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition cursor-pointer ${
                activeTab === 'budgets'
                  ? 'bg-slate-700 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <PieChart className="w-4 h-4" />
              Budgets
            </button>
          </nav>

          {/* User profile & Sign Out */}
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline-block text-xs font-medium text-slate-400 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700/50">
              {userEmail}
            </span>
            <button
              onClick={onSignOut}
              title="Sign Out"
              className="flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 border border-slate-700 hover:border-rose-500/30 transition cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile nav */}
      <div className="md:hidden flex items-center justify-around border-t border-slate-800/80 py-2 bg-slate-900 px-2">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`flex flex-col items-center gap-1 text-xs py-1 px-3 rounded-lg ${
            activeTab === 'dashboard' ? 'text-emerald-400 font-semibold' : 'text-slate-400'
          }`}
        >
          <LayoutDashboard className="w-4 h-4" />
          Home
        </button>
        <button
          onClick={() => setActiveTab('transactions')}
          className={`flex flex-col items-center gap-1 text-xs py-1 px-3 rounded-lg ${
            activeTab === 'transactions' ? 'text-emerald-400 font-semibold' : 'text-slate-400'
          }`}
        >
          <Receipt className="w-4 h-4" />
          History
        </button>
        <button
          onClick={() => setActiveTab('accounts')}
          className={`flex flex-col items-center gap-1 text-xs py-1 px-3 rounded-lg ${
            activeTab === 'accounts' ? 'text-emerald-400 font-semibold' : 'text-slate-400'
          }`}
        >
          <Wallet className="w-4 h-4" />
          Accounts
        </button>
        <button
          onClick={() => setActiveTab('budgets')}
          className={`flex flex-col items-center gap-1 text-xs py-1 px-3 rounded-lg ${
            activeTab === 'budgets' ? 'text-emerald-400 font-semibold' : 'text-slate-400'
          }`}
        >
          <PieChart className="w-4 h-4" />
          Budgets
        </button>
      </div>
    </header>
  );
};
