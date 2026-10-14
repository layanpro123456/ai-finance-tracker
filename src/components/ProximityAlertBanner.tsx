import React from 'react';
import type { ProximityAlert } from '../types';
import { usePreferences } from '../context/PreferencesContext';
import {
  MapPin,
  X,
  Sparkles,
  CheckCircle2,
  Users,
  PieChart,
  ArrowRight,
  Navigation,
} from 'lucide-react';

interface ProximityAlertBannerProps {
  alerts: ProximityAlert[];
  onDismissAlert: (placeId: string) => void;
  onNavigateToTab?: (tab: 'dashboard' | 'transactions' | 'tasks' | 'budgets' | 'contacts' | 'timeline') => void;
}

export const ProximityAlertBanner: React.FC<ProximityAlertBannerProps> = ({
  alerts,
  onDismissAlert,
  onNavigateToTab,
}) => {
  const { preferences } = usePreferences();
  const symbol = preferences.currencySymbol || '$';

  if (!alerts || alerts.length === 0) {
    return null;
  }

  // Display top prioritized alert
  const activeAlert = alerts[0];

  const getAlertIcon = () => {
    switch (activeAlert.reminderType) {
      case 'budget':
        return <PieChart className="w-4 h-4 text-emerald-400" />;
      case 'task':
        return <CheckCircle2 className="w-4 h-4 text-amber-400" />;
      case 'contact':
        return <Users className="w-4 h-4 text-purple-400" />;
      default:
        return <Navigation className="w-4 h-4 text-blue-400" />;
    }
  };

  const getActionButton = () => {
    switch (activeAlert.reminderType) {
      case 'budget':
        return (
          <button
            onClick={() => onNavigateToTab?.('dashboard')}
            className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-sm"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Log Purchase</span>
          </button>
        );
      case 'task':
        return (
          <button
            onClick={() => onNavigateToTab?.('tasks')}
            className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-sm"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>View Task</span>
          </button>
        );
      case 'contact':
        return (
          <button
            onClick={() => onNavigateToTab?.('contacts')}
            className="px-3 py-1.5 rounded-lg bg-purple-500 hover:bg-purple-400 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-sm"
          >
            <Users className="w-3.5 h-3.5" />
            <span>Settle IOU</span>
          </button>
        );
      default:
        return (
          <button
            onClick={() => onNavigateToTab?.('timeline')}
            className="px-3 py-1.5 rounded-lg bg-blue-500 hover:bg-blue-400 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-sm"
          >
            <span>Timeline</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        );
    }
  };

  return (
    <div className="relative xl:sticky xl:top-16 z-30 px-3 sm:px-4 py-2 bg-gradient-to-r from-emerald-950/90 via-slate-900/95 to-teal-950/90 backdrop-blur-md border-b border-emerald-500/30 text-white shadow-lg animate-in fade-in slide-in-from-top-2 duration-300">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        {/* Left side: Location & Radar Icon + Context */}
        <div className="flex items-center gap-3 min-w-0 w-full sm:w-auto">
          <div className="relative flex items-center justify-center w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 shrink-0">
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full animate-ping" />
            <MapPin className="w-4 h-4" />
          </div>

          <div className="space-y-0.5 min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1 shrink-0">
                {getAlertIcon()}
                <span>Proximity Payment Alert</span>
              </span>
              <span className="text-xs text-slate-400 font-medium truncate max-w-full">
                {activeAlert.distanceMeters}m away from <strong className="text-white">{activeAlert.placeName}</strong>
              </span>
            </div>
            <p className="text-xs text-slate-200 break-words">
              {activeAlert.reminderMessage}
              {activeAlert.budgetRemaining !== null && activeAlert.budgetRemaining !== undefined && (
                <span className="ml-1 font-mono text-emerald-300 font-semibold whitespace-nowrap">
                  (Budget remaining: {symbol}{activeAlert.budgetRemaining.toLocaleString()})
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Right side: Action Button & Dismiss */}
        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
          {alerts.length > 1 && (
            <span className="text-[10px] text-slate-400 font-mono hidden md:inline">
              +{alerts.length - 1} more nearby
            </span>
          )}
          {getActionButton()}
          <button
            onClick={() => onDismissAlert(activeAlert.placeId)}
            title="Dismiss proximity alert"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
