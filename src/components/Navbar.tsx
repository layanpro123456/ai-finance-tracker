import React, { useState } from 'react';
import { usePreferences } from '../context/PreferencesContext';
import { SettingsModal } from './SettingsModal';
import {
  Sparkles,
  LogOut,
  LayoutDashboard,
  Receipt,
  Wallet,
  PieChart,
  CheckSquare,
  Package,
  CreditCard,
  Users,
  Sun,
  Moon,
  Settings,
  HelpCircle,
  Shield,
  Navigation,
  Smartphone,
} from 'lucide-react';
import { getDeviceName } from '../services/deviceSessionService';

export type ErpTab =

  | 'dashboard'
  | 'transactions'
  | 'accounts'
  | 'budgets'
  | 'tasks'
  | 'timeline'
  | 'assets'
  | 'subscriptions'
  | 'contacts'
  | 'help'
  | 'admin';

interface NavbarProps {
  userEmail: string;
  activeTab: ErpTab;
  setActiveTab: (tab: ErpTab) => void;
  onSignOut: () => void;
  isAdmin?: boolean;
  onOpenAdminAuth?: () => void;
  activeAlertCount?: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  userEmail,
  activeTab,
  setActiveTab,
  onSignOut,
  isAdmin = false,
  onOpenAdminAuth,
  activeAlertCount = 0,
}) => {
  const { preferences, toggleTheme } = usePreferences();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const baseNavItems: { id: ErpTab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'dashboard', label: 'Overview', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'tasks', label: 'Daily Tasks', icon: <CheckSquare className="w-4 h-4" /> },
    {
      id: 'timeline',
      label: 'Timeline & Mobility',
      icon: <Navigation className="w-4 h-4" />,
      badge: activeAlertCount > 0 ? activeAlertCount : undefined,
    },
    { id: 'transactions', label: 'Ledger', icon: <Receipt className="w-4 h-4" /> },
    { id: 'accounts', label: 'Accounts', icon: <Wallet className="w-4 h-4" /> },
    { id: 'budgets', label: 'Budgets', icon: <PieChart className="w-4 h-4" /> },
    { id: 'assets', label: 'Assets', icon: <Package className="w-4 h-4" /> },
    { id: 'subscriptions', label: 'Subscriptions', icon: <CreditCard className="w-4 h-4" /> },
    { id: 'contacts', label: 'Social IOU', icon: <Users className="w-4 h-4" /> },
    { id: 'help', label: 'Help & Guide', icon: <HelpCircle className="w-4 h-4" /> },
  ];

  type NavItem = { id: ErpTab; label: string; icon: React.ReactNode; badge?: number };

  const navItems: NavItem[] = isAdmin
    ? [...baseNavItems, { id: 'admin' as ErpTab, label: 'Admin', icon: <Shield className="w-4 h-4 text-purple-400" /> }]
    : baseNavItems;

  return (
    <>
      <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo & Brand: Apex LifeOS */}
            <div
              onClick={() => setActiveTab('dashboard')}
              className="flex items-center gap-3 cursor-pointer select-none"
            >
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-950 font-bold shadow-lg shadow-emerald-500/20">
                <Sparkles className="w-5 h-5 text-slate-950" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-lg text-white tracking-tight">Apex LifeOS</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase tracking-wider">
                    ERP
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 -mt-0.5 hidden sm:block">Personal Finance &amp; Operations</p>
              </div>
            </div>

            {/* Desktop Navigation Links */}
            <nav className="hidden xl:flex items-center gap-1 bg-slate-800/60 p-1 rounded-xl border border-slate-700/60">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer relative ${
                    activeTab === item.id
                      ? 'bg-slate-700 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                  {item.badge && (
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  )}
                </button>
              ))}
            </nav>

            {/* User profile, Theme Toggle, Settings & Sign Out */}
            <div className="flex items-center gap-2 sm:gap-2.5">
              {/* Light / Dark Mode Toggle */}
              <button
                onClick={toggleTheme}
                type="button"
                title={`Switch to ${preferences.theme === 'dark' ? 'Light' : 'Dark'} mode`}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700/60 transition cursor-pointer"
              >
                {preferences.theme === 'dark' ? (
                  <Sun className="w-4 h-4 text-amber-400" />
                ) : (
                  <Moon className="w-4 h-4 text-sky-400" />
                )}
              </button>

              {/* Currency & System Settings Pill */}
              <button
                onClick={() => setIsSettingsOpen(true)}
                type="button"
                title="Adjust Currency, Country & Timezone"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700/60 transition cursor-pointer text-xs font-semibold"
              >
                <Settings className="w-3.5 h-3.5 text-emerald-400" />
                <span>{preferences.currency}</span>
              </button>

              {/* Admin Console Quick Button */}
              <button
                onClick={() => {
                  if (isAdmin) {
                    setActiveTab('admin');
                  } else if (onOpenAdminAuth) {
                    onOpenAdminAuth();
                  }
                }}
                type="button"
                title={isAdmin ? 'Admin Console (Authorized)' : 'Administrator Access'}
                className={`p-2 rounded-xl border transition cursor-pointer ${
                  activeTab === 'admin'
                    ? 'bg-purple-600/20 text-purple-300 border-purple-500/50 shadow-sm'
                    : isAdmin
                    ? 'bg-purple-950/40 text-purple-400 hover:text-purple-300 border-purple-500/30'
                    : 'bg-slate-800 hover:bg-slate-750 text-slate-400 hover:text-purple-300 border-slate-700/60'
                }`}
              >
                <Shield className="w-4 h-4" />
              </button>

              {/* Help & Guide Quick Button */}
              <button
                onClick={() => setActiveTab('help')}
                type="button"
                title="Step-by-Step Help & Guide"
                className={`p-2 rounded-xl border transition cursor-pointer ${
                  activeTab === 'help'
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shadow-sm'
                    : 'bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white border-slate-700/60'
                }`}
              >
                <HelpCircle className="w-4 h-4" />
              </button>

              {/* Active Single Device Badge */}
              <span
                className="hidden lg:inline-flex items-center gap-1.5 text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-1.5 rounded-xl border border-emerald-500/20"
                title="Single Active Device Lock: Location data is bound to this device"
              >
                <Smartphone className="w-3 h-3 text-emerald-400" />
                <span className="max-w-[110px] truncate">{getDeviceName()}</span>
              </span>

              <span className="hidden sm:inline-block text-xs font-medium text-slate-400 bg-slate-800/80 px-2.5 py-1.5 rounded-xl border border-slate-700/50 max-w-[150px] truncate">
                {userEmail}
              </span>

              <button
                onClick={onSignOut}
                title="Sign Out"
                className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 border border-slate-700 hover:border-rose-500/30 transition cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Logout</span>
              </button>

            </div>
          </div>

          {/* Medium-screen Secondary Horizontal Scroll Bar */}
          <div className="hidden md:flex xl:hidden overflow-x-auto py-2 border-t border-slate-850 gap-1.5 no-scrollbar">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition cursor-pointer ${
                  activeTab === item.id
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'text-slate-400 hover:text-white bg-slate-800/40'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Mobile nav scrollable bar */}
        <div className="md:hidden flex items-center overflow-x-auto border-t border-slate-800/80 py-2 bg-slate-900 px-3 gap-2 no-scrollbar">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex items-center gap-1 text-xs py-1.5 px-2.5 rounded-lg whitespace-nowrap ${
                activeTab === item.id
                  ? 'bg-emerald-500/20 text-emerald-400 font-semibold border border-emerald-500/30'
                  : 'text-slate-400 bg-slate-800/40'
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </header>

      {/* Settings Modal */}
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </>
  );
};
