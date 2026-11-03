import React, { useState } from 'react';
import {
  Navigation,
  Car,
  Footprints,
  Train,
  Clock,
  Gauge,
  Zap,
  Edit2,
  CheckCircle2,
  Check,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  Briefcase,
  MapPin,
  Map as MapIcon,
  Sparkles,
  Layers,
  X,
  Smartphone,
  Eye,
  EyeOff,
} from 'lucide-react';
import type { TransportMode } from '../types';
import {
  type JourneySummaryItem,
  journeySummaryToTelemetryMetrics,
  updateMobilityJourney,
  type JourneyTelemetryMetrics,
} from '../services/locationMobilityService';

interface JourneyWiseSummaryProps {
  userId: string;
  selectedDate: string;
  journeys: JourneySummaryItem[];
  currencySymbol: string;
  selectedJourneyId: string | null;
  onSelectJourney: (journeyId: string | null) => void;
  onStraightAwaySubmit: (metrics: JourneyTelemetryMetrics) => Promise<void>;
  onEditAndSubmit: (metrics: JourneyTelemetryMetrics) => void;
  onRefreshJourneys?: () => void;
  onSimulateScenario?: () => void;
  isLoading?: boolean;
}

export const JourneyWiseSummary: React.FC<JourneyWiseSummaryProps> = ({
  userId: _userId,
  selectedDate,
  journeys,
  currencySymbol,
  selectedJourneyId,
  onSelectJourney,
  onStraightAwaySubmit,
  onEditAndSubmit,
  onRefreshJourneys,
  onSimulateScenario,
  isLoading = false,
}) => {
  // Local states
  const [filterStatus, setFilterStatus] = useState<'all' | 'completed' | 'in_progress'>('all');
  const [filterMode, setFilterMode] = useState<'all' | TransportMode>('all');
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [tempTitle, setTempTitle] = useState<string>('');
  const [expandedWaypointsId, setExpandedWaypointsId] = useState<string | null>(null);
  const [submittingJourneyId, setSubmittingJourneyId] = useState<string | null>(null);

  // Filter journeys
  const filteredJourneys = journeys.filter((j) => {
    if (filterStatus !== 'all' && j.status !== filterStatus) return false;
    if (filterMode !== 'all' && j.primaryTransportMode !== filterMode) return false;
    return true;
  });

  // Calculate Aggregates
  const totalJourneysCount = journeys.length;
  const completedCount = journeys.filter((j) => j.status === 'completed').length;
  const inProgressCount = journeys.filter((j) => j.status === 'in_progress').length;
  const totalDistanceKm = journeys.reduce((sum, j) => sum + (j.totalDistanceKm || 0), 0);
  const totalTravelTimeSeconds = journeys.reduce((sum, j) => sum + (j.travelTimeSeconds || 0), 0);
  const totalEstimatedCost = journeys.reduce((sum, j) => sum + (j.estimatedCost || 0), 0);
  const totalLoggedCost = journeys.reduce((sum, j) => (j.isCostLogged ? sum + (j.loggedTransitCost || j.estimatedCost || 0) : sum), 0);
  const totalPendingCost = Math.max(0, totalEstimatedCost - totalLoggedCost);

  // Time & Duration Formatters
  const formatTime = (isoString?: string | null) => {
    if (!isoString) return '--:--';
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '--:--';
    }
  };

  const formatDuration = (seconds: number) => {
    if (!seconds || seconds <= 0) return '0m';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${hrs}h ${mins}m`;
    }
    if (mins > 0) {
      return `${mins}m ${secs}s`;
    }
    return `${secs}s`;
  };

  // Render Transport Mode Badge
  const renderModeBadge = (mode: TransportMode) => {
    switch (mode) {
      case 'walking':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            <Footprints className="w-3.5 h-3.5 text-emerald-400" />
            <span>Walking</span>
          </span>
        );
      case 'vehicle':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/15 text-blue-300 border border-blue-500/30">
            <Car className="w-3.5 h-3.5 text-blue-400" />
            <span>Vehicle</span>
          </span>
        );
      case 'high_speed_transit':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/15 text-purple-300 border border-purple-500/30">
            <Train className="w-3.5 h-3.5 text-purple-400" />
            <span>Express Transit</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700">
            <Car className="w-3.5 h-3.5 text-slate-400" />
            <span>In Transit</span>
          </span>
        );
    }
  };

  // Handle Straight-Away Submit for a specific journey
  const handleStraightAway = async (journey: JourneySummaryItem) => {
    setSubmittingJourneyId(journey.id);
    try {
      const metrics = journeySummaryToTelemetryMetrics(journey);
      await onStraightAwaySubmit(metrics);
      onRefreshJourneys?.();
    } finally {
      setSubmittingJourneyId(null);
    }
  };

  // Handle inline title edit save
  const handleSaveTitle = async (journeyId: string) => {
    if (!tempTitle.trim()) {
      setEditingTitleId(null);
      return;
    }
    await updateMobilityJourney(journeyId, { title: tempTitle.trim() });
    setEditingTitleId(null);
    onRefreshJourneys?.();
  };

  // Handle Business Trip toggle
  const handleToggleBusinessTrip = async (journey: JourneySummaryItem) => {
    const nextVal = !journey.isBusinessTrip;
    const taxDeduction = nextVal ? Number((journey.totalDistanceKm * 0.67).toFixed(2)) : 0;
    await updateMobilityJourney(journey.id, {
      is_business_trip: nextVal,
      tax_deduction_amount: taxDeduction,
    });
    onRefreshJourneys?.();
  };

  // Scroll to map when focusing a journey
  const handleFocusOnMap = (journeyId: string) => {
    if (selectedJourneyId === journeyId) {
      onSelectJourney(null);
    } else {
      onSelectJourney(journeyId);
      const mapEl = document.getElementById('sri-lanka-mobility-map');
      if (mapEl) {
        mapEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  };

  return (
    <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-6">
      {/* ===================================================================== */}
      {/* 1. SECTION HEADER & AGGREGATE SUMMARY RIBBON */}
      {/* ===================================================================== */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-gradient-to-tr from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 text-cyan-400 shadow-inner">
            <Navigation className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                Journey-Wise Summary
              </h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 uppercase tracking-wider">
                {totalJourneysCount} {totalJourneysCount === 1 ? 'Journey' : 'Journeys'}
              </span>
              {selectedDate && (
                <span className="text-[11px] font-mono font-medium text-slate-400 bg-slate-950 px-2 py-0.5 rounded-lg border border-slate-800">
                  {selectedDate}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Individual origin-to-destination commute segments, route telemetry, and 1-click ledger logging
            </p>
          </div>
        </div>

        {/* Global Journey Actions & Filters */}
        <div className="flex items-center gap-2 flex-wrap text-xs">
          {selectedJourneyId && (
            <button
              onClick={() => onSelectJourney(null)}
              className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition flex items-center gap-1 cursor-pointer border border-slate-700"
            >
              <EyeOff className="w-3.5 h-3.5 text-slate-400" />
              <span>Reset Map Focus</span>
            </button>
          )}

          {onSimulateScenario && (
            <button
              onClick={onSimulateScenario}
              className="px-3 py-1.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/25 font-semibold transition flex items-center gap-1.5 cursor-pointer"
              title="Simulate a test journey scenario"
            >
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>Simulate Journey</span>
            </button>
          )}
        </div>
      </div>

      {/* Aggregate Metrics KPI Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-850 space-y-1">
          <span className="text-xs text-slate-400 block">Total Journeys</span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-bold font-mono text-white">{totalJourneysCount}</span>
            <span className="text-[11px] text-slate-500">
              ({completedCount} done{inProgressCount > 0 ? `, ${inProgressCount} active` : ''})
            </span>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-850 space-y-1">
          <span className="text-xs text-slate-400 block">Total Travelled</span>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-bold font-mono text-white">{totalDistanceKm.toFixed(1)}</span>
            <span className="text-xs text-slate-400 font-mono">km</span>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-850 space-y-1">
          <span className="text-xs text-slate-400 block">Transit Time</span>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-bold font-mono text-white">
              {formatDuration(totalTravelTimeSeconds)}
            </span>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-850 space-y-1">
          <span className="text-xs text-slate-400 block">Est. Commute Cost</span>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-bold font-mono text-emerald-400">
              {currencySymbol}{totalEstimatedCost.toFixed(2)}
            </span>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-850 space-y-1 col-span-2 sm:col-span-1">
          <span className="text-xs text-slate-400 block">Ledger Status</span>
          <div className="flex items-baseline gap-1 text-xs font-mono">
            <span className="font-bold text-blue-400">{currencySymbol}{totalLoggedCost.toFixed(2)} Logged</span>
            <span className="text-slate-500">•</span>
            <span className="text-amber-400 font-semibold">{currencySymbol}{totalPendingCost.toFixed(2)} Pend</span>
          </div>
        </div>
      </div>

      {/* Filter and View Control Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 pb-1">
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <span className="text-slate-400 font-semibold text-[11px] uppercase tracking-wider">
            Filter:
          </span>
          <div className="p-1 rounded-xl bg-slate-950 border border-slate-800 flex items-center">
            {(['all', 'completed', 'in_progress'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-2.5 py-1 rounded-lg capitalize transition cursor-pointer font-medium ${
                  filterStatus === status
                    ? 'bg-slate-800 text-white font-bold shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {status === 'all'
                  ? `All (${journeys.length})`
                  : status === 'completed'
                  ? `Completed (${completedCount})`
                  : `Active (${inProgressCount})`}
              </button>
            ))}
          </div>

          <div className="p-1 rounded-xl bg-slate-950 border border-slate-800 flex items-center">
            {(['all', 'vehicle', 'walking', 'high_speed_transit'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setFilterMode(m)}
                className={`px-2.5 py-1 rounded-lg capitalize transition cursor-pointer font-medium ${
                  filterMode === m
                    ? 'bg-slate-800 text-white font-bold shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {m === 'all'
                  ? 'All Modes'
                  : m === 'vehicle'
                  ? '🚗 Vehicle'
                  : m === 'walking'
                  ? '🚶 Walk'
                  : '🚄 Transit'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 2. THE JOURNEYS FLEX GRID: ONE JOURNEY UNDER ONE */}
      {/* ===================================================================== */}
      <div className="flex flex-col gap-4.5 w-full">
        {filteredJourneys.map((journey, index) => {
          const isFocusedOnMap = selectedJourneyId === journey.id;
          const isExpanded = expandedWaypointsId === journey.id;
          const isEditingTitle = editingTitleId === journey.id;
          const isOngoing = journey.status === 'in_progress';

          return (
            <div
              key={journey.id}
              className={`w-full rounded-2xl border transition-all duration-200 overflow-hidden ${
                isFocusedOnMap
                  ? 'bg-slate-950/95 border-emerald-500/60 shadow-lg shadow-emerald-500/5 ring-1 ring-emerald-500/30'
                  : 'bg-slate-950/90 border-slate-800/80 hover:border-slate-700/80 shadow-md'
              }`}
            >
              {/* Journey Card Header Row */}
              <div className="p-4 sm:p-5 border-b border-slate-850/80 space-y-3.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  {/* Left Title, Index & Status Badges */}
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-750 text-slate-300 font-mono font-bold text-xs shadow-inner">
                      #{index + 1}
                    </span>

                    {isEditingTitle ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          value={tempTitle}
                          onChange={(e) => setTempTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveTitle(journey.id);
                            if (e.key === 'Escape') setEditingTitleId(null);
                          }}
                          className="px-2 py-0.5 rounded-lg bg-slate-900 border border-slate-700 text-sm font-bold text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          autoFocus
                        />
                        <button
                          onClick={() => handleSaveTitle(journey.id)}
                          className="p-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setEditingTitleId(null)}
                          className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <h3 className="text-sm sm:text-base font-bold text-white tracking-tight">
                          {journey.title}
                        </h3>
                        <button
                          onClick={() => {
                            setEditingTitleId(journey.id);
                            setTempTitle(journey.title);
                          }}
                          className="p-1 text-slate-500 hover:text-slate-300 transition cursor-pointer"
                          title="Rename journey"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}

                    {/* Status Badge */}
                    {isOngoing ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 animate-pulse">
                        <span className="w-2 h-2 rounded-full bg-amber-400" />
                        <span>Active Tracking</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Completed</span>
                      </span>
                    )}

                    {/* Mode Badge */}
                    {renderModeBadge(journey.primaryTransportMode)}

                    {/* Device Badge */}
                    {journey.deviceName && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-mono text-slate-400 bg-slate-900 border border-slate-800">
                        <Smartphone className="w-3 h-3 text-cyan-400" />
                        <span>{journey.deviceName}</span>
                      </span>
                    )}

                    {/* Business Trip Pill */}
                    {journey.isBusinessTrip && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30">
                        <Briefcase className="w-3 h-3 text-purple-400" />
                        <span>Business ({currencySymbol}{journey.taxDeductionAmount?.toFixed(2)} Tax Ded.)</span>
                      </span>
                    )}
                  </div>

                  {/* Right: Timestamp & Duration */}
                  <div className="flex items-center gap-3 text-xs font-mono text-slate-400 flex-wrap">
                    <div className="flex items-center gap-1.5 text-slate-300">
                      <Clock className="w-3.5 h-3.5 text-amber-400" />
                      <span className="text-white font-semibold">{formatTime(journey.startTime)}</span>
                      <span>→</span>
                      <span className="text-white font-semibold">
                        {isOngoing ? 'Now (In Transit)' : formatTime(journey.endTime)}
                      </span>
                    </div>

                    <span className="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-cyan-300 font-semibold text-[11px]">
                      {formatDuration(journey.travelTimeSeconds)}
                    </span>
                  </div>
                </div>

                {/* Origin to Destination Route Ribbon */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3 rounded-xl bg-slate-900/80 border border-slate-850">
                  {/* Origin */}
                  <div className="flex items-center gap-2 text-xs flex-1 min-w-0">
                    <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex-shrink-0">
                      <MapPin className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1">
                        <span className="text-emerald-400 font-bold text-[11px] uppercase tracking-wide">
                          Start Pin:
                        </span>
                        <span className="text-slate-400 text-[11px]">
                          {formatTime(journey.startTime)}
                        </span>
                      </div>
                      <div className="text-slate-200 font-mono text-[11px] truncate">
                        {journey.startAddress ||
                          (journey.startLatitude !== null && journey.startLatitude !== undefined
                            ? `${journey.startLatitude.toFixed(4)}°, ${journey.startLongitude?.toFixed(4)}°`
                            : 'Initial GPS lock')}
                      </div>
                    </div>
                  </div>

                  <ArrowRight className="w-4 h-4 text-slate-600 hidden md:block flex-shrink-0" />

                  {/* Destination */}
                  <div className="flex items-center gap-2 text-xs flex-1 min-w-0">
                    <div className="p-1.5 rounded-lg bg-rose-500/20 text-rose-400 border border-rose-500/30 flex-shrink-0">
                      <MapPin className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1">
                        <span className="text-rose-400 font-bold text-[11px] uppercase tracking-wide">
                          {isOngoing ? 'Current Pin:' : 'End Pin:'}
                        </span>
                        <span className="text-slate-400 text-[11px]">
                          {isOngoing ? 'Active' : formatTime(journey.endTime)}
                        </span>
                      </div>
                      <div className="text-slate-200 font-mono text-[11px] truncate">
                        {journey.endAddress ||
                          (journey.endLatitude !== null && journey.endLatitude !== undefined
                            ? `${journey.endLatitude.toFixed(4)}°, ${journey.endLongitude?.toFixed(4)}°`
                            : isOngoing
                            ? 'Tracking current position...'
                            : 'Arrival coordinate lock')}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Telemetry Metrics Grid (Responsive 2 to 6 columns) */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                  <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-850">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                      Distance
                    </span>
                    <span className="text-base font-bold font-mono text-white">
                      {journey.totalDistanceKm.toFixed(2)}
                    </span>
                    <span className="text-[10px] text-slate-400 ml-1">km</span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-850">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                      Travel Time
                    </span>
                    <span className="text-base font-bold font-mono text-cyan-300">
                      {formatDuration(journey.travelTimeSeconds)}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-850">
                    <div className="flex items-center justify-between text-[10px] text-slate-400 uppercase tracking-wider">
                      <span>Avg Speed</span>
                      <Gauge className="w-3 h-3 text-cyan-400" />
                    </div>
                    <span className="text-base font-bold font-mono text-white">
                      {journey.avgSpeedKmh.toFixed(1)}
                    </span>
                    <span className="text-[10px] text-slate-400 ml-1">km/h</span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-850">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                      Max Velocity
                    </span>
                    <span className="text-base font-bold font-mono text-white">
                      {journey.maxSpeedKmh.toFixed(1)}
                    </span>
                    <span className="text-[10px] text-slate-400 ml-1">km/h</span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-850">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                      Calculated Cost
                    </span>
                    <span className="text-base font-bold font-mono text-emerald-400">
                      {currencySymbol}{journey.estimatedCost.toFixed(2)}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-850">
                    <div className="flex items-center justify-between text-[10px] text-slate-400 uppercase tracking-wider">
                      <span>Waypoints</span>
                      <Layers className="w-3 h-3 text-indigo-400" />
                    </div>
                    <span className="text-base font-bold font-mono text-white">
                      {journey.pingsCount || (journey.inTravelPings?.length ? journey.inTravelPings.length + 2 : 2)}
                    </span>
                    <span className="text-[10px] text-slate-400 ml-1">pings</span>
                  </div>
                </div>
              </div>

              {/* Action Controls & Financial Ledger Footer */}
              <div className="px-4 sm:px-5 py-3 bg-slate-900/50 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                {/* Left: Financial Ledger Status & Quick Submit */}
                <div className="flex items-center gap-2 flex-wrap">
                  {journey.isCostLogged ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-950/80 border border-emerald-800/80 text-emerald-300 font-semibold text-xs">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>
                        Recorded to Ledger: {currencySymbol}
                        {(journey.loggedTransitCost || journey.estimatedCost).toFixed(2)}
                      </span>
                    </span>
                  ) : (
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => handleStraightAway(journey)}
                        disabled={submittingJourneyId === journey.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-md transition cursor-pointer disabled:opacity-50"
                        title="Instantly deduct commute expense and post to financial ledger"
                      >
                        <Zap className="w-3.5 h-3.5 fill-slate-950" />
                        <span>
                          Straight-Away Submit ({currencySymbol}{journey.estimatedCost.toFixed(2)})
                        </span>
                      </button>

                      <button
                        onClick={() => onEditAndSubmit(journeySummaryToTelemetryMetrics(journey))}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-750 font-medium transition cursor-pointer"
                        title="Customize account, category, notes, and log"
                      >
                        <Edit2 className="w-3 h-3 text-slate-400" />
                        <span>Edit &amp; Submit</span>
                      </button>
                    </div>
                  )}

                  {/* Business Commute Switch */}
                  <button
                    onClick={() => handleToggleBusinessTrip(journey)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border transition cursor-pointer text-xs ${
                      journey.isBusinessTrip
                        ? 'bg-purple-950/60 border-purple-500/50 text-purple-300 font-semibold'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                    title="Tag as business expense for tax deduction tracking"
                  >
                    <Briefcase className="w-3.5 h-3.5" />
                    <span>{journey.isBusinessTrip ? 'Business Commute' : 'Mark Business'}</span>
                  </button>
                </div>

                {/* Right: Map Focus & Waypoints Inspection Drawer */}
                <div className="flex items-center gap-2 justify-end">
                  <button
                    onClick={() => handleFocusOnMap(journey.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition cursor-pointer text-xs ${
                      isFocusedOnMap
                        ? 'bg-emerald-500 text-slate-950 shadow-md'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                    }`}
                    title="Focus and zoom Sri Lanka Mobility Map to this journey"
                  >
                    {isFocusedOnMap ? (
                      <>
                        <Eye className="w-3.5 h-3.5" />
                        <span>Focused on Map</span>
                      </>
                    ) : (
                      <>
                        <MapIcon className="w-3.5 h-3.5 text-slate-400" />
                        <span>Focus on Map</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => setExpandedWaypointsId(isExpanded ? null : journey.id)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs transition cursor-pointer"
                  >
                    <span>Waypoints</span>
                    {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                </div>
              </div>

              {/* Waypoints Expansion Drawer */}
              {isExpanded && (
                <div className="p-4 bg-slate-950 border-t border-slate-850 space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-400 pb-2 border-b border-slate-850">
                    <span className="font-semibold text-white">
                      Recorded Pin Classification &amp; Telemetry Sequence
                    </span>
                    <span className="font-mono text-[11px]">
                      {journey.inTravelPings?.length ?? 0} intermediate in-travel route fixes
                    </span>
                  </div>

                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1 text-xs">
                    {/* Start Pin */}
                    {journey.startPing && (
                      <div className="flex items-center justify-between p-2 rounded-xl bg-emerald-950/20 border border-emerald-500/20 text-emerald-300 font-mono">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-400" />
                          <span className="font-bold text-white">Start Pin</span>
                          <span>({journey.startPing.latitude.toFixed(4)}, {journey.startPing.longitude.toFixed(4)})</span>
                        </div>
                        <span className="text-slate-400 text-[11px]">
                          {formatTime(journey.startPing.recorded_at)}
                        </span>
                      </div>
                    )}

                    {/* Intermediate In-Travel Pings */}
                    {journey.inTravelPings && journey.inTravelPings.length > 0 ? (
                      journey.inTravelPings.map((p, pIdx) => (
                        <div
                          key={p.id || `wp-${pIdx}`}
                          className="flex items-center justify-between p-1.5 px-2 rounded-lg bg-slate-900/60 border border-slate-850 text-slate-300 font-mono text-[11px]"
                        >
                          <div className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                            <span>Fix #{pIdx + 1}</span>
                            <span className="text-slate-400">
                              ({p.latitude.toFixed(4)}, {p.longitude.toFixed(4)})
                            </span>
                            <span className="text-cyan-400 font-semibold">{p.speed_kmh.toFixed(1)} km/h</span>
                          </div>
                          <span className="text-slate-500">{formatTime(p.recorded_at)}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-[11px] text-slate-500 italic p-1">
                        Direct point-to-point journey record. No intermediate sub-second waypoints logged.
                      </p>
                    )}

                    {/* End Pin */}
                    {journey.endPing && (
                      <div className="flex items-center justify-between p-2 rounded-xl bg-rose-950/20 border border-rose-500/20 text-rose-300 font-mono">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-rose-400" />
                          <span className="font-bold text-white">
                            {isOngoing ? 'Latest Ping (In Transit)' : 'End Pin'}
                          </span>
                          <span>({journey.endPing.latitude.toFixed(4)}, {journey.endPing.longitude.toFixed(4)})</span>
                        </div>
                        <span className="text-slate-400 text-[11px]">
                          {formatTime(journey.endPing.recorded_at)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Empty State */}
        {filteredJourneys.length === 0 && !isLoading && (
          <div className="p-8 rounded-2xl bg-slate-950/80 border border-slate-850 text-center space-y-3">
            <div className="inline-flex p-3 rounded-2xl bg-slate-900 border border-slate-800 text-slate-500">
              <Navigation className="w-6 h-6 text-slate-400" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">
                No Journeys Recorded for {selectedDate}
              </h4>
              <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                Journeys are automatically captured when movement is detected by the Android Location Tracker APK,
                or recorded via Browser GPS or Simulation.
              </p>
            </div>
            {onSimulateScenario && (
              <div className="pt-2">
                <button
                  onClick={onSimulateScenario}
                  className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs inline-flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Generate Test Simulated Journey</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
