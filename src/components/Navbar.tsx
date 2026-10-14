import React, { useState, useRef, useEffect, useCallback } from 'react';
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
  Menu,
  X,
  Layers,
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
  activeAlertCount?: number;
  showAdminNavTab?: boolean;
  onToggleAdminNavTab?: (show: boolean) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  userEmail,
  activeTab,
  setActiveTab,
  onSignOut,
  isAdmin = false,
  activeAlertCount = 0,
  showAdminNavTab = false,
  onToggleAdminNavTab,
}) => {
  const { preferences, toggleTheme } = usePreferences();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Scroll indicators and auto-scroll ref for horizontal tabs
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const tabButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const headerRef = useRef<HTMLElement>(null);
  const [showLeftFade, setShowLeftFade] = useState(false);
  const [showRightFade, setShowRightFade] = useState(false);

  const baseNavItems: { id: ErpTab; label: string; icon: React.ReactNode; badge?: number; description?: string }[] = [
    { id: 'dashboard', label: 'Overview', icon: <LayoutDashboard className="w-4 h-4" />, description: 'Metrics & AI Logger' },
    { id: 'tasks', label: 'Daily Tasks', icon: <CheckSquare className="w-4 h-4" />, description: 'Agenda & Bill Reminders' },
    {
      id: 'timeline',
      label: 'Timeline & Mobility',
      icon: <Navigation className="w-4 h-4" />,
      badge: activeAlertCount > 0 ? activeAlertCount : undefined,
      description: 'Device GPS & Route Stats',
    },
    { id: 'transactions', label: 'Ledger', icon: <Receipt className="w-4 h-4" />, description: 'Financial Entries & History' },
    { id: 'accounts', label: 'Accounts', icon: <Wallet className="w-4 h-4" />, description: 'Banks, Cards & Cash' },
    { id: 'budgets', label: 'Budgets', icon: <PieChart className="w-4 h-4" />, description: 'Monthly Category Targets' },
    { id: 'assets', label: 'Assets', icon: <Package className="w-4 h-4" />, description: 'Vault & Physical Property' },
    { id: 'subscriptions', label: 'Subscriptions', icon: <CreditCard className="w-4 h-4" />, description: 'Recurring Payment Cycles' },
    { id: 'contacts', label: 'Social IOU', icon: <Users className="w-4 h-4" />, description: 'P2P Debts & Shared Costs' },
    { id: 'help', label: 'Help & Guide', icon: <HelpCircle className="w-4 h-4" />, description: 'Documentation & Tips' },
  ];

  type NavItem = { id: ErpTab; label: string; icon: React.ReactNode; badge?: number; description?: string };

  const navItems: NavItem[] = (isAdmin && showAdminNavTab)
    ? [...baseNavItems, { id: 'admin' as ErpTab, label: 'Admin', icon: <Shield className="w-4 h-4 text-purple-400" />, description: 'System Diagnostics & Telemetry' }]
    : baseNavItems;

  // Auto-scroll selected tab into view when activeTab changes
  useEffect(() => {
    const el = tabButtonRefs.current[activeTab];
    if (el && scrollContainerRef.current) {
      el.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      });
    }
  }, [activeTab]);

  // Monitor horizontal scroll to show left/right gradient shadows
  const checkScrollFades = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setShowLeftFade(scrollLeft > 6);
    setShowRightFade(scrollLeft < scrollWidth - clientWidth - 6);
  }, []);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    checkScrollFades();
    el.addEventListener('scroll', checkScrollFades, { passive: true });
    window.addEventListener('resize', checkScrollFades, { passive: true });
    return () => {
      el.removeEventListener('scroll', checkScrollFades);
      window.removeEventListener('resize', checkScrollFades);
    };
  }, [checkScrollFades, navItems.length]);

  // Close mobile drawer on desktop resize
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1280) {
        setIsMobileMenuOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Close mobile drawer when clicking outside header
  useEffect(() => {
    if (!isMobileMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) {
        setIsMobileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMobileMenuOpen]);

  return (
    <>
      <header
        ref={headerRef}
        className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 transition-colors"
      >
        <div className="max-w-7xl mx-auto px-2.5 sm:px-4 lg:px-8">
          <div className="flex items-center justify-between h-14 sm:h-16 gap-2">
            {/* Logo & Brand: Apex LifeOS (Responsive scaling for small screens) */}
            <div
              onClick={() => {
                setActiveTab('dashboard');
                setIsMobileMenuOpen(false);
              }}
              className="flex items-center gap-2 sm:gap-3 cursor-pointer select-none min-w-0"
            >
              <div className="flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-950 font-bold shadow-lg shadow-emerald-500/20 shrink-0">
                <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-slate-950" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-sm xs:text-base sm:text-lg text-white tracking-tight truncate">
                    Apex LifeOS
                  </span>
                  <span className="text-[9px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase tracking-wider shrink-0">
                    ERP
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 -mt-0.5 hidden md:block truncate">
                  Personal Finance &amp; Operations
                </p>
              </div>
            </div>

            {/* Desktop Navigation Links (Visible exclusively on >= 1280px xl screens) */}
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

            {/* Right Action Controls: Theme, Settings, Device Lock, Logout & Mobile Menu Toggle */}
            <div className="flex items-center gap-1 sm:gap-1.5 md:gap-2 shrink-0">
              {/* Light / Dark Mode Toggle */}
              <button
                onClick={toggleTheme}
                type="button"
                title={`Switch to ${preferences.theme === 'dark' ? 'Light' : 'Dark'} mode`}
                className="p-1.5 sm:p-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700/60 transition cursor-pointer shrink-0"
              >
                {preferences.theme === 'dark' ? (
                  <Sun className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400" />
                ) : (
                  <Moon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-sky-400" />
                )}
              </button>

              {/* Currency & System Settings Pill */}
              <button
                onClick={() => setIsSettingsOpen(true)}
                type="button"
                title="Adjust Currency, Country & Timezone"
                className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700/60 transition cursor-pointer text-xs font-semibold shrink-0"
              >
                <Settings className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="text-[11px] sm:text-xs hidden xs:inline">{preferences.currency}</span>
              </button>

              {/* Help & Guide Quick Button (Hidden on smaller screens to prevent crowding; accessible via tabs & drawer) */}
              <button
                onClick={() => setActiveTab('help')}
                type="button"
                title="Step-by-Step Help & Guide"
                className={`hidden lg:flex p-1.5 sm:p-2 rounded-xl border transition cursor-pointer shrink-0 ${
                  activeTab === 'help'
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shadow-sm'
                    : 'bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white border-slate-700/60'
                }`}
              >
                <HelpCircle className="w-4 h-4" />
              </button>

              {/* Active Single Device Badge (Large screens) */}
              <span
                className="hidden 2xl:inline-flex items-center gap-1.5 text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-1.5 rounded-xl border border-emerald-500/20 shrink-0"
                title="Single Active Device Lock: Location data is bound to this device"
              >
                <Smartphone className="w-3 h-3 text-emerald-400" />
                <span className="max-w-[100px] truncate">{getDeviceName()}</span>
              </span>

              {/* User Email Pill (Hidden on mobile to save toolbar space; accessible in mobile menu drawer) */}
              {isAdmin ? (
                <button
                  type="button"
                  onClick={() => setActiveTab(activeTab === 'admin' ? 'dashboard' : 'admin')}
                  className="hidden md:inline-block text-xs font-medium text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-750 px-2.5 py-1.5 rounded-xl border border-slate-700/50 hover:border-purple-500/30 transition cursor-pointer max-w-[140px] truncate shrink-0"
                  title="Click to toggle Executive Admin Console (Ctrl+Shift+A)"
                >
                  {userEmail}
                </button>
              ) : (
                <span className="hidden md:inline-block text-xs font-medium text-slate-400 bg-slate-800/80 px-2.5 py-1.5 rounded-xl border border-slate-700/50 max-w-[140px] truncate shrink-0">
                  {userEmail}
                </span>
              )}

              {/* Mobile All-Modules Drawer Toggle Button (Visible on screens < 1280px) */}
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                title={isMobileMenuOpen ? 'Close Menu' : 'Browse All ERP Modules'}
                className={`xl:hidden flex items-center gap-1 p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl border transition cursor-pointer text-xs font-semibold shrink-0 ${
                  isMobileMenuOpen
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm'
                    : 'bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white border-slate-700/60'
                }`}
              >
                {isMobileMenuOpen ? (
                  <X className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <Menu className="w-4 h-4 shrink-0" />
                )}
                <span className="hidden sm:inline">Modules</span>
              </button>

              {/* Sign Out Button */}
              <button
                onClick={onSignOut}
                title="Sign Out"
                className="flex items-center gap-1 sm:gap-1.5 text-xs font-semibold p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl bg-slate-800 hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 border border-slate-700 hover:border-rose-500/30 transition cursor-pointer shrink-0"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* UNIFIED SECONDARY HORIZONTAL TAB SCROLLBAR (< 1280px Tablet & Mobile) */}
        {/* ========================================================================= */}
        <div className="xl:hidden relative border-t border-slate-800/80 bg-slate-900/90 backdrop-blur-md">
          {/* Smooth Left Overflow Fade Shadow */}
          <div
            className={`pointer-events-none absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-slate-900 via-slate-900/80 to-transparent z-10 transition-opacity duration-200 ${
              showLeftFade ? 'opacity-100' : 'opacity-0'
            }`}
          />

          {/* Smooth Right Overflow Fade Shadow */}
          <div
            className={`pointer-events-none absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-slate-900 via-slate-900/80 to-transparent z-10 transition-opacity duration-200 ${
              showRightFade ? 'opacity-100' : 'opacity-0'
            }`}
          />

          {/* Scrollable Tab Strip */}
          <div
            ref={scrollContainerRef}
            className="flex items-center overflow-x-auto py-2 px-2.5 sm:px-4 gap-1.5 no-scrollbar scroll-smooth flex-nowrap"
          >
            {navItems.map((item) => (
              <button
                key={item.id}
                ref={(el) => {
                  tabButtonRefs.current[item.id] = el;
                }}
                onClick={() => {
                  setActiveTab(item.id);
                  setIsMobileMenuOpen(false);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 transition cursor-pointer select-none ${
                  activeTab === item.id
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 bg-slate-800/50 border border-slate-800/80 hover:bg-slate-800'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
                {item.badge && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse ml-0.5" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* MOBILE & TABLET EXPANDABLE MODULE DRAWER (Grid Sheet on Menu Click) */}
        {/* ========================================================================= */}
        {isMobileMenuOpen && (
          <div className="xl:hidden border-t border-slate-800 bg-slate-900/98 backdrop-blur-xl animate-in fade-in slide-in-from-top-3 duration-200 shadow-2xl">
            <div className="max-w-7xl mx-auto p-3.5 sm:p-5 space-y-4">
              <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-2.5">
                <div className="flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-emerald-400" />
                  <span>Apex LifeOS Modules</span>
                </div>
                <span className="text-[11px] font-normal text-slate-500">Tap to switch view</span>
              </div>

              {/* 2-Column (Mobile) / 3-Column (Tablet) Clean Touch Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-2.5">
                {navItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id);
                      setIsMobileMenuOpen(false);
                    }}
                    className={`flex items-start gap-2.5 p-3 rounded-2xl text-xs font-semibold transition cursor-pointer text-left border ${
                      activeTab === item.id
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-md shadow-emerald-500/5'
                        : 'bg-slate-800/60 hover:bg-slate-800 text-slate-300 border-slate-700/60 hover:text-white'
                    }`}
                  >
                    <div
                      className={`p-2 rounded-xl shrink-0 ${
                        activeTab === item.id
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-slate-900 text-slate-400'
                      }`}
                    >
                      {item.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate">{item.label}</span>
                        {item.badge && (
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                        )}
                      </div>
                      {item.description && (
                        <p className="text-[10px] text-slate-500 font-normal line-clamp-1 mt-0.5">
                          {item.description}
                        </p>
                      )}
                    </div>
                  </button>
                ))}
              </div>

              {/* Mobile Drawer Footer: Device Lock Status & Account Details */}
              <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2.5 text-xs text-slate-400">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1 text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-xl border border-emerald-500/20">
                    <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{getDeviceName()}</span>
                  </span>
                  <span className="text-slate-400 text-[11px] font-medium truncate max-w-[170px]">
                    {userEmail}
                  </span>
                </div>

                {isAdmin && (
                  <button
                    onClick={() => {
                      setActiveTab('admin');
                      setIsMobileMenuOpen(false);
                    }}
                    className="text-[11px] font-semibold text-purple-300 bg-purple-950/40 hover:bg-purple-900/40 px-3 py-1.5 rounded-xl border border-purple-800/40 transition cursor-pointer flex items-center gap-1.5"
                  >
                    <Shield className="w-3 h-3 text-purple-400" />
                    <span>Admin Console</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        userEmail={userEmail}
        onOpenAdmin={() => {
          setIsSettingsOpen(false);
          setActiveTab('admin');
        }}
        showAdminNavTab={showAdminNavTab}
        onToggleAdminNavTab={onToggleAdminNavTab}
      />
    </>
  );
};
