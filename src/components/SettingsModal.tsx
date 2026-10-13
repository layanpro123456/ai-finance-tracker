import React, { useState } from 'react';
import {
  usePreferences,
  CURRENCIES,
  COUNTRIES,
  TIMEZONES,
} from '../context/PreferencesContext';
import {
  X,
  Settings,
  Globe,
  Clock,
  Sun,
  Moon,
  Check,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { CurrencyLogo } from './CurrencyLogo';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const { preferences, updatePreferences, formatCurrency, formatDate } = usePreferences();

  // Local draft state
  const [currency, setCurrency] = useState(preferences.currency);
  const [country, setCountry] = useState(preferences.country);
  const [timezone, setTimezone] = useState(preferences.timezone);
  const [theme, setTheme] = useState<'dark' | 'light'>(preferences.theme);
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen) return null;

  const handleAutoDetectTimezone = () => {
    try {
      const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (detected) {
        setTimezone(detected);
      }
    } catch (e) {
      console.warn('Could not detect timezone:', e);
    }
  };

  const handleSave = () => {
    updatePreferences({
      currency,
      country,
      timezone,
      theme,
    });
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 600);
  };

  const handleResetDefaults = () => {
    setCurrency('USD');
    setCountry('United States');
    handleAutoDetectTimezone();
    setTheme('dark');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl relative">
        {/* Glow accent */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 text-emerald-400">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">System Preferences</h2>
              <p className="text-xs text-slate-400">Customize localization, currency, and display theme</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="mt-5 space-y-5">
          {/* 1. Theme Selection */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Appearance &amp; Theme
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setTheme('dark')}
                className={`p-3 rounded-xl border flex items-center gap-3 transition cursor-pointer ${
                  theme === 'dark'
                    ? 'bg-slate-800 border-emerald-500/60 text-white shadow-sm'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className={`p-2 rounded-lg ${theme === 'dark' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400'}`}>
                  <Moon className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <div className="text-xs font-bold text-white">Dark Mode</div>
                  <div className="text-[10px] text-slate-400">High contrast slate</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setTheme('light')}
                className={`p-3 rounded-xl border flex items-center gap-3 transition cursor-pointer ${
                  theme === 'light'
                    ? 'bg-slate-800 border-emerald-500/60 text-white shadow-sm'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className={`p-2 rounded-lg ${theme === 'light' ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-800 text-slate-400'}`}>
                  <Sun className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <div className="text-xs font-bold text-white">Light Mode</div>
                  <div className="text-[10px] text-slate-400">Clean bright canvas</div>
                </div>
              </button>
            </div>
          </div>

          {/* 2. Currency */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <CurrencyLogo variant="icon" size="xs" />
                <span>Primary Currency</span>
              </label>
              <span className="text-[11px] text-emerald-400 font-medium">
                Active: {currency}
              </span>
            </div>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full bg-slate-950 border border-slate-750 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} - {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* 3. Country */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-sky-400" />
                <span>Country / Region</span>
              </label>
            </div>
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="w-full bg-slate-950 border border-slate-750 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              {COUNTRIES.map((cntry) => (
                <option key={cntry} value={cntry}>
                  {cntry}
                </option>
              ))}
            </select>
          </div>

          {/* 4. Timezone */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span>Timezone</span>
              </label>
              <button
                type="button"
                onClick={handleAutoDetectTimezone}
                className="text-[11px] text-emerald-400 hover:text-emerald-300 font-medium cursor-pointer"
              >
                Auto-detect
              </button>
            </div>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full bg-slate-950 border border-slate-750 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              {TIMEZONES.map((tz) => (
                <option key={tz.id} value={tz.id}>
                  {tz.label}
                </option>
              ))}
              {!TIMEZONES.some((tz) => tz.id === timezone) && (
                <option value={timezone}>{timezone} (System)</option>
              )}
            </select>
          </div>

          {/* Live Preview Box */}
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1">
            <div className="flex items-center justify-between text-slate-400">
              <span>Preview Sample Amount:</span>
              <span className="font-bold text-white text-sm">
                {formatCurrency(12450.75)}
              </span>
            </div>
            <div className="flex items-center justify-between text-slate-400">
              <span>Time in {timezone}:</span>
              <span className="font-semibold text-emerald-400">
                {formatDate(new Date(), { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1.5 transition cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Defaults</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl transition shadow-lg shadow-emerald-500/20 flex items-center gap-1.5 cursor-pointer"
            >
              {savedSuccess ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Preferences Saved!</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Apply Changes</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
