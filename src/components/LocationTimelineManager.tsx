import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type {
  SavedPlace,
  MobilityTimelineEvent,
  DailyMobilityStats,
  TransportMode,
  ReminderType,
  Account,
  Category,
  Budget,
  Task,
  ContactsLedger,
  DeviceLocationPing,
} from '../types';
import { usePreferences } from '../context/PreferencesContext';
import { CurrencyLogo } from './CurrencyLogo';
import {
  calculateDistanceMeters,
  MobilityClassifier,
  loadSavedPlaces,
  persistSavedPlace,
  removeSavedPlace,
  loadTimelineEvents,
  persistTimelineEvent,
  loadDailyMobilityStats,
  updateDailyMobilityStats,
  loadLatestDevicePing,
  subscribeToDevicePings,
  SIMULATION_SCENARIOS,
  getEventsStorageKey,
  getStatsStorageKey,
} from '../services/locationMobilityService';
import { getCurrentDeviceInfo } from '../services/deviceSessionService';
import { supabase, supabaseUrl, supabaseAnonKey } from '../supabaseClient';
import {
  Navigation,
  MapPin,
  Compass,
  Play,
  Pause,
  RotateCcw,
  Plus,
  Trash2,
  CheckCircle2,
  Sparkles,
  Car,
  Bike,
  Footprints,
  Train,
  Clock,
  Gauge,
  ArrowRight,
  AlertTriangle,
  Radio,
  Sliders,
  ChevronRight,
  X,
  Loader2,
  Smartphone,
  ShieldCheck,
  Battery,
  BatteryCharging,
  Copy,
  Check,
  QrCode,
  Lock,
} from 'lucide-react';
import {
  generatePairingToken,
  generatePairingQrDataUrl,
} from '../services/mobilePairingService';

interface LocationTimelineManagerProps {
  userId: string;
  accounts: Account[];
  categories: Category[];
  budgets: Budget[];

  tasks: Task[];
  contactsLedger: ContactsLedger[];
  onTransactionsUpdated: () => void;
  onTasksUpdated?: () => void;
}

export const LocationTimelineManager: React.FC<LocationTimelineManagerProps> = ({
  userId,
  accounts,
  categories,
  budgets,
  tasks,
  contactsLedger,
  onTransactionsUpdated,
  onTasksUpdated,
}) => {
  const { preferences, formatCurrency } = usePreferences();
  const symbol = preferences.currencySymbol || '$';

  // State: Saved Places & Events
  const [places, setPlaces] = useState<SavedPlace[]>([]);
  const [events, setEvents] = useState<MobilityTimelineEvent[]>([]);
  const [dailyStats, setDailyStats] = useState<DailyMobilityStats | null>(null);
  const [loading, setLoading] = useState(true);

  // Telemetry & GPS State
  const [isTracking, setIsTracking] = useState(true);
  const [trackingSource, setTrackingSource] = useState<'simulation' | 'real_gps' | 'phone_apk'>('phone_apk');
  const [latestPhonePing, setLatestPhonePing] = useState<DeviceLocationPing | null>(null);
  const [showPairPhoneModal, setShowPairPhoneModal] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState(false);

  const pairingToken = useMemo(
    () => generatePairingToken(supabaseUrl, supabaseAnonKey, userId),
    [userId]
  );

  useEffect(() => {
    if (showPairPhoneModal && pairingToken) {
      generatePairingQrDataUrl(pairingToken)
        .then(setQrCodeDataUrl)
        .catch((err) => console.warn('QR code generation failed:', err));
    }
  }, [showPairPhoneModal, pairingToken]);
  const [manualModeLock, setManualModeLock] = useState<TransportMode | 'auto'>('auto');
  const [currentCoords, setCurrentCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [currentSpeedKmh, setCurrentSpeedKmh] = useState<number>(0);
  const [classifiedMode, setClassifiedMode] = useState<TransportMode>('stationary');
  const [isInTraffic, setIsInTraffic] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('Listening to background Android APK telemetry...');

  // Simulation State (Anchor dynamically centered around user device)
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>(SIMULATION_SCENARIOS[0].id);
  const [isSimPlaying, setIsSimPlaying] = useState<boolean>(false);
  const [simWaypointIndex, setSimWaypointIndex] = useState<number>(0);
  const [simSpeedOverride, setSimSpeedOverride] = useState<number | null>(null);

  // Modals
  const [showAddPlaceModal, setShowAddPlaceModal] = useState<boolean>(false);
  const [newPlaceName, setNewPlaceName] = useState('');
  const [newPlaceLat, setNewPlaceLat] = useState<number>(0);
  const [newPlaceLng, setNewPlaceLng] = useState<number>(0);
  const [newPlaceRadius, setNewPlaceRadius] = useState(300);
  const [newPlaceReminderType, setNewPlaceReminderType] = useState<ReminderType>('budget');
  const [newPlaceMessage, setNewPlaceMessage] = useState('');
  const [newPlaceCategoryId, setNewPlaceCategoryId] = useState('');
  const [newPlaceTaskId, setNewPlaceTaskId] = useState('');
  const [newPlaceContactId, setNewPlaceContactId] = useState('');

  // Commute Expense Logging Modal
  const [loggingTrip, setLoggingTrip] = useState<MobilityTimelineEvent | null>(null);
  const [commuteAccountId, setCommuteAccountId] = useState<string>('');
  const [isLoggingExpense, setIsLoggingExpense] = useState(false);

  // Hardware Device Info (for Unique Partitioning)
  const deviceInfo = useMemo(() => getCurrentDeviceInfo(), []);

  // Filter for timeline
  const [timelineFilter, setTimelineFilter] = useState<'all' | 'trip' | 'stay' | 'alert'>('all');

  // Refs for tracking continuity & relative simulation anchor
  const classifierRef = useRef(new MobilityClassifier());
  const simTimerRef = useRef<number | null>(null);
  const simAnchorCoords = useRef<{ latitude: number; longitude: number } | null>(null);

  // 1. Initial Load of Places & Events (Scoped to this Physical Device)
  const fetchInitialData = useCallback(async () => {
    setLoading(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const [loadedPlaces, loadedEvents, loadedStats] = await Promise.all([
        loadSavedPlaces(userId, deviceInfo.deviceId),
        loadTimelineEvents(userId, deviceInfo.deviceId),
        loadDailyMobilityStats(userId, today, deviceInfo.deviceId),
      ]);
      setPlaces(loadedPlaces);
      setEvents(loadedEvents);
      setDailyStats(loadedStats);

      // Clean any stale cached mobility keys from localStorage to guarantee pure Supabase state
      try {
        localStorage.removeItem('apex_saved_places');
        localStorage.removeItem('apex_timeline_events');
        localStorage.removeItem('apex_daily_mobility');
        localStorage.removeItem('apex_mobility_timeline_events');
        for (let i = localStorage.length - 1; i >= 0; i--) {
          const k = localStorage.key(i);
          if (
            k &&
            (k.startsWith('apex_daily_mobility') ||
              k.startsWith('apex_timeline_events') ||
              k.startsWith('apex_saved_places') ||
              k.startsWith('apex_mobility_'))
          ) {
            localStorage.removeItem(k);
          }
        }
      } catch {
        // ignore
      }
    } catch (err) {
      console.error('Error initializing location timeline:', err);
    } finally {
      setLoading(false);
    }
  }, [userId, deviceInfo.deviceId]);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);


  // Set default account when accounts change
  useEffect(() => {
    if (accounts.length > 0 && !commuteAccountId) {
      setCommuteAccountId(accounts[0].id);
    }
  }, [accounts, commuteAccountId]);

  // 2.0 Remote Phone APK Realtime Stream Watcher
  useEffect(() => {
    if (trackingSource !== 'phone_apk' || !isTracking || !userId) return;

    setStatusMessage('Connecting to Android APK background stream...');

    loadLatestDevicePing(userId).then((ping) => {
      if (ping) {
        setLatestPhonePing(ping);
        const coords = { latitude: ping.latitude, longitude: ping.longitude };
        setCurrentCoords(coords);
        simAnchorCoords.current = coords;
        setCurrentSpeedKmh(ping.speed_kmh);
        if (ping.transport_mode && ping.transport_mode !== 'unknown') {
          setClassifiedMode(ping.transport_mode as TransportMode);
        }
        const battText = ping.battery_level !== null && ping.battery_level !== undefined
          ? ` • 🔋 ${Math.round(ping.battery_level)}%`
          : '';
        setStatusMessage(
          `Phone APK Active: ${ping.device_name || 'Android Device'} (${ping.speed_kmh.toFixed(1)} km/h • ${ping.transport_mode || 'moving'}${battText})`
        );
      } else {
        setStatusMessage('Waiting for first location ping from Android APK...');
      }
    });

    const unsubscribe = subscribeToDevicePings(userId, (ping) => {
      setLatestPhonePing(ping);
      const coords = { latitude: ping.latitude, longitude: ping.longitude };
      setCurrentCoords(coords);
      simAnchorCoords.current = coords;
      setCurrentSpeedKmh(ping.speed_kmh);

      if (ping.transport_mode && ping.transport_mode !== 'unknown') {
        setClassifiedMode(ping.transport_mode as TransportMode);
      }

      const battLabel = ping.battery_level !== null && ping.battery_level !== undefined
        ? ` • 🔋 ${Math.round(ping.battery_level)}%${ping.is_charging ? ' ⚡' : ''}`
        : '';

      setStatusMessage(
        `Live Phone Fix: ${ping.speed_kmh.toFixed(1)} km/h (${ping.transport_mode || 'moving'})${battLabel}`
      );
    });

    return () => {
      unsubscribe();
    };
  }, [trackingSource, isTracking, userId]);

  // 2. Real GPS Hardware Watcher
  useEffect(() => {
    if (trackingSource !== 'real_gps' || !isTracking) return;

    if (!navigator.geolocation) {
      setStatusMessage('Geolocation is not supported by your browser.');
      return;
    }

    // Immediate initial lock
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const speedKmh = pos.coords.speed !== null && pos.coords.speed !== undefined
          ? Math.max(0, pos.coords.speed * 3.6)
          : 0;
        const coords = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        };
        setCurrentCoords(coords);
        simAnchorCoords.current = coords;
        setCurrentSpeedKmh(speedKmh);

        const evaluation = classifierRef.current.evaluate(speedKmh, manualModeLock);
        setClassifiedMode(evaluation.mode);
        setIsInTraffic(evaluation.inTraffic);
        setStatusMessage(evaluation.statusLabel);
      },
      (err) => {
        setStatusMessage(`GPS Notice: ${err.message}.`);
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 5000 }
    );

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const speedKmh = pos.coords.speed !== null && pos.coords.speed !== undefined
          ? Math.max(0, pos.coords.speed * 3.6)
          : 0;
        const coords = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        };
        setCurrentCoords(coords);
        simAnchorCoords.current = coords;
        setCurrentSpeedKmh(speedKmh);

        const evaluation = classifierRef.current.evaluate(speedKmh, manualModeLock);
        setClassifiedMode(evaluation.mode);
        setIsInTraffic(evaluation.inTraffic);
        setStatusMessage(evaluation.statusLabel);
      },
      (err) => {
        setStatusMessage(`GPS Notice: ${err.message}. (Use Simulated Route Player for testing)`);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 1000,
      }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [trackingSource, isTracking, manualModeLock]);

  // 3. Simulated Route Stepper (Relative to User Device Position)
  const activeScenario = useMemo(() => {
    return SIMULATION_SCENARIOS.find((s) => s.id === selectedScenarioId) || SIMULATION_SCENARIOS[0];
  }, [selectedScenarioId]);

  const stepSimulation = useCallback(() => {
    if (!activeScenario || activeScenario.waypoints.length === 0) return;

    setSimWaypointIndex((prevIdx) => {
      const nextIdx = (prevIdx + 1) % activeScenario.waypoints.length;
      const wp = activeScenario.waypoints[nextIdx];
      const speed = simSpeedOverride !== null ? simSpeedOverride : wp.speedKmh;

      const baseLat = simAnchorCoords.current?.latitude ?? places[0]?.latitude ?? 0;
      const baseLng = simAnchorCoords.current?.longitude ?? places[0]?.longitude ?? 0;
      const nextLat = Number((baseLat + (wp.deltaLat ?? 0)).toFixed(6));
      const nextLng = Number((baseLng + (wp.deltaLng ?? 0)).toFixed(6));

      setCurrentCoords({ latitude: nextLat, longitude: nextLng });
      setCurrentSpeedKmh(speed);

      const evaluation = classifierRef.current.evaluate(speed, manualModeLock);
      setClassifiedMode(evaluation.mode);
      setIsInTraffic(evaluation.inTraffic);
      setStatusMessage(`${evaluation.statusLabel} • ${wp.description}`);

      return nextIdx;
    });
  }, [activeScenario, simSpeedOverride, manualModeLock, places]);

  useEffect(() => {
    if (trackingSource !== 'simulation' || !isTracking || !isSimPlaying) {
      if (simTimerRef.current) clearInterval(simTimerRef.current);
      return;
    }

    simTimerRef.current = window.setInterval(() => {
      stepSimulation();
    }, 2800);

    return () => {
      if (simTimerRef.current) clearInterval(simTimerRef.current);
    };
  }, [trackingSource, isTracking, isSimPlaying, stepSimulation]);

  // Switch Scenario handler
  const handleSelectScenario = (scenarioId: string) => {
    setSelectedScenarioId(scenarioId);
    setSimWaypointIndex(0);
    classifierRef.current.resetTrip();
    const sc = SIMULATION_SCENARIOS.find((s) => s.id === scenarioId);
    if (sc && sc.waypoints[0]) {
      const wp = sc.waypoints[0];
      const baseLat = simAnchorCoords.current?.latitude ?? places[0]?.latitude ?? 0;
      const baseLng = simAnchorCoords.current?.longitude ?? places[0]?.longitude ?? 0;
      const nextLat = Number((baseLat + (wp.deltaLat ?? 0)).toFixed(6));
      const nextLng = Number((baseLng + (wp.deltaLng ?? 0)).toFixed(6));

      setCurrentCoords({ latitude: nextLat, longitude: nextLng });
      setCurrentSpeedKmh(wp.speedKmh);
      const evalState = classifierRef.current.evaluate(wp.speedKmh, manualModeLock);
      setClassifiedMode(evalState.mode);
      setIsInTraffic(evalState.inTraffic);
      setStatusMessage(`${evalState.statusLabel} • ${wp.description}`);
    }
  };

  // 4. Proximity Radar Calculation for Saved Places
  const placesWithProximity = useMemo(() => {
    return places.map((place) => {
      const distMeters = currentCoords
        ? Math.round(
            calculateDistanceMeters(
              currentCoords.latitude,
              currentCoords.longitude,
              place.latitude,
              place.longitude
            )
          )
        : null;
      const isInside = distMeters !== null && distMeters <= place.radius_meters;
      return {
        ...place,
        distanceMeters: distMeters,
        isInside,
      };
    });
  }, [places, currentCoords]);

  // 5. Add New Geofenced Place
  const handleCreatePlace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlaceName.trim()) return;

    try {
      const created = await persistSavedPlace(
        userId,
        {
          name: newPlaceName.trim(),
          latitude: newPlaceLat,
          longitude: newPlaceLng,
          radius_meters: newPlaceRadius,
          reminder_type: newPlaceReminderType,
          reminder_message: newPlaceMessage.trim(),
          category_id: newPlaceCategoryId || null,
          linked_task_id: newPlaceTaskId || null,
          linked_contact_id: newPlaceContactId || null,
        },
        deviceInfo.deviceId
      );

      setPlaces((prev) => [created, ...prev.filter((p) => p.id !== created.id)]);
      setShowAddPlaceModal(false);
      setNewPlaceName('');
      setNewPlaceMessage('');
    } catch (err) {
      console.error('Failed to save place:', err);
    }
  };

  // Delete Place
  const handleDeletePlace = async (placeId: string) => {
    try {
      await removeSavedPlace(userId, placeId, deviceInfo.deviceId);
      setPlaces((prev) => prev.filter((p) => p.id !== placeId));
    } catch (err) {
      console.error('Failed to delete place:', err);
    }
  };

  // 6. Commute Expense 1-Click Logging to Ledger
  const handleConfirmLogExpense = async () => {
    if (!loggingTrip || !commuteAccountId) return;
    setIsLoggingExpense(true);

    try {
      // Find or assign transportation category
      const transportCat = categories.find((c) =>
        c.name.toLowerCase().includes('transport') || c.name.toLowerCase().includes('commute')
      ) || categories[0];

      const amountToLog = loggingTrip.estimated_cost || 2.5;
      const desc = `Commute: ${loggingTrip.title} (${loggingTrip.distance_km || 0} km${
        loggingTrip.in_traffic ? ', Traffic Delay' : ''
      })`;

      // Insert transaction into Supabase
      const { error: txErr } = await supabase
        .from('transactions')
        .insert({
          user_id: userId,
          account_id: commuteAccountId,
          category_id: transportCat?.id || null,
          amount: amountToLog,
          type: 'expense',
          description: desc,
          transaction_date: new Date().toISOString().slice(0, 10),
        })
        .select('*')
        .single();

      if (!txErr) {
        // Deduct from account balance in database
        const selectedAcc = accounts.find((a) => a.id === commuteAccountId);
        if (selectedAcc) {
          const newBalance = Number(selectedAcc.balance) - amountToLog;
          await supabase.from('accounts').update({ balance: newBalance }).eq('id', commuteAccountId);
        }

        // Mark trip as logged in timeline
        const updatedTrip: MobilityTimelineEvent = {
          ...loggingTrip,
          is_cost_logged: true,
          device_id: deviceInfo.deviceId,
          device_name: deviceInfo.deviceName,
        };
        await persistTimelineEvent(userId, updatedTrip, deviceInfo.deviceId);
        setEvents((prev) => prev.map((ev) => (ev.id === updatedTrip.id ? updatedTrip : ev)));

        // Update daily mobility stats
        await updateDailyMobilityStats(
          userId,
          { logged_transit_cost: amountToLog },
          deviceInfo.deviceId
        );
        const today = new Date().toISOString().slice(0, 10);
        const refreshedStats = await loadDailyMobilityStats(userId, today, deviceInfo.deviceId);
        setDailyStats(refreshedStats);

        // Notify parent to refresh transactions & balances
        onTransactionsUpdated();
      }


      setLoggingTrip(null);
    } catch (err) {
      console.error('Error logging commute expense:', err);
    } finally {
      setIsLoggingExpense(false);
    }
  };

  const [isResetting, setIsResetting] = useState(false);

  const handleResetTimeline = async () => {
    if (
      !window.confirm(
        'Are you sure you want to reset all timeline events, commute trips, and mobility statistics for this device? This action cannot be undone.'
      )
    ) {
      return;
    }

    setIsResetting(true);
    try {
      const devId = deviceInfo.deviceId;
      const today = new Date().toISOString().split('T')[0];

      // 1. Clear Supabase timeline events and daily mobility stats for this device
      try {
        await supabase.from('mobility_timeline_events').delete().eq('user_id', userId).eq('device_id', devId);
        await supabase.from('daily_mobility_stats').delete().eq('user_id', userId).eq('device_id', devId);
      } catch {
        // ignore
      }

      // 2. Clear all device-scoped and legacy local storage keys
      localStorage.removeItem(getEventsStorageKey(devId));
      localStorage.removeItem(getStatsStorageKey(devId, today));
      localStorage.removeItem('apex_timeline_events');
      localStorage.removeItem('apex_daily_mobility');
      localStorage.removeItem(`apex_daily_mobility_${today}`);
      localStorage.removeItem(`apex_events_${devId}`);
      localStorage.removeItem(`apex_mobility_events_${devId}`);
      localStorage.removeItem('apex_mobility_timeline_events');
      localStorage.removeItem(`apex_daily_mobility_stats_${today}_${devId}`);
      localStorage.removeItem(`apex_daily_mobility_stats_${today}`);

      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (
          k &&
          (k.startsWith('apex_daily_mobility') ||
            k.startsWith('apex_timeline_events') ||
            k.startsWith('apex_mobility_') ||
            k.startsWith('apex_events_'))
        ) {
          localStorage.removeItem(k);
        }
      }

      // 3. Reset React state strictly to zero
      const cleanStats: DailyMobilityStats = {
        user_id: userId,
        device_id: devId,
        stat_date: today,
        total_distance_km: 0,
        transit_time_minutes: 0,
        walking_km: 0,
        cycling_km: 0,
        vehicle_km: 0,
        estimated_transit_cost: 0,
        logged_transit_cost: 0,
        top_speed_kmh: 0,
        active_stops_count: 0,
        created_at: new Date().toISOString(),
      };
      setEvents([]);
      setDailyStats(cleanStats);
      classifierRef.current.resetTrip();
      setCurrentSpeedKmh(0);
      setClassifiedMode('stationary');
      setIsInTraffic(false);
      setStatusMessage('Timeline and daily mobility reset strictly to zero.');
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to reset timeline');
    } finally {
      setIsResetting(false);
    }
  };

  // Mode badge renderer
  const renderModeBadge = (mode: TransportMode, inTraffic = false) => {
    if (mode === 'vehicle' && inTraffic) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 animate-pulse">
          <Car className="w-3.5 h-3.5 text-amber-400" />
          <span>Vehicle (Traffic Congestion)</span>
        </span>
      );
    }

    switch (mode) {
      case 'walking':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            <Footprints className="w-3.5 h-3.5 text-emerald-400" />
            <span>Walking / Pedestrian</span>
          </span>
        );
      case 'cycling':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
            <Bike className="w-3.5 h-3.5 text-cyan-400" />
            <span>Cycling / Micro-Mobility</span>
          </span>
        );
      case 'vehicle':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-500/15 text-blue-300 border border-blue-500/30">
            <Car className="w-3.5 h-3.5 text-blue-400" />
            <span>Vehicle / Commute</span>
          </span>
        );
      case 'high_speed_transit':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30">
            <Train className="w-3.5 h-3.5 text-purple-400" />
            <span>Express Rail / Highway</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-800 text-slate-300 border border-slate-700">
            <MapPin className="w-3.5 h-3.5 text-slate-400" />
            <span>Stationary / Dwell</span>
          </span>
        );
    }
  };

  const filteredEvents = useMemo(() => {
    if (timelineFilter === 'all') return events;
    return events.filter((e) => e.event_type === timelineFilter);
  }, [events, timelineFilter]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* ===================================================================== */}
      {/* 1. HEADER & REAL-TIME TELEMETRY CONSOLE */}
      {/* ===================================================================== */}
      <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-gradient-to-tr from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 text-emerald-400 shadow-inner">
              <Navigation className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-white tracking-tight">Location Timeline &amp; Mobility</h1>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  LIVE TELEMETRY
                </span>
                <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-slate-800/90 text-slate-300 border border-slate-700 flex items-center gap-1.5 shadow-sm">
                  <Smartphone className="w-3 h-3 text-emerald-400" />
                  <span>{deviceInfo.deviceName}</span>
                  <span className="text-slate-500">•</span>
                  <span className="text-emerald-400">{deviceInfo.deviceId.slice(0, 10)}</span>
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Speed-based transport detection, commute expenditure, and hardware-bound geofence payment alerts
              </p>
            </div>
          </div>


          {/* Right Controls: Ingestion Mode & Tracking Toggle */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="p-1 rounded-xl bg-slate-950 border border-slate-800 flex items-center text-xs">
              <button
                onClick={() => setTrackingSource('phone_apk')}
                className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer flex items-center gap-1.5 ${
                  trackingSource === 'phone_apk'
                    ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>Phone APK Daemon</span>
              </button>
              <button
                onClick={() => setTrackingSource('real_gps')}
                className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer flex items-center gap-1.5 ${
                  trackingSource === 'real_gps'
                    ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Radio className="w-3.5 h-3.5" />
                <span>Browser GPS</span>
              </button>
              <button
                onClick={() => setTrackingSource('simulation')}
                className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer flex items-center gap-1.5 ${
                  trackingSource === 'simulation'
                    ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Simulator</span>
              </button>
            </div>

            <button
              onClick={() => setShowPairPhoneModal(true)}
              className="text-xs font-semibold px-3 py-2 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/25 flex items-center gap-1.5 transition cursor-pointer"
              title="Pair with Android Location Tracker APK"
            >
              <QrCode className="w-3.5 h-3.5 text-purple-400" />
              <span>Pair Phone APK</span>
            </button>

            <button
              onClick={handleResetTimeline}
              disabled={isResetting}
              title="Reset recorded timeline events, commutes, and daily mobility stats for this device"
              className="text-xs font-semibold px-3 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/25 flex items-center gap-1.5 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              {isResetting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RotateCcw className="w-3.5 h-3.5" />
              )}
              <span>Reset Timeline</span>
            </button>

            <button
              onClick={() => setIsTracking(!isTracking)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                isTracking
                  ? 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                  : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${isTracking ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
              <span>{isTracking ? 'Tracking Active' : 'Start Tracking'}</span>
            </button>
          </div>
        </div>

        {/* Device Lock & Location Uniqueness Alert */}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 text-xs">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <div className="leading-snug">
              <span className="text-white font-semibold">Device-Unique Telemetry: </span>
              <span className="text-slate-400">
                All coordinates, speed history, and travel ledgers are bound to this hardware device (<code className="text-emerald-400 font-mono">{deviceInfo.deviceName}</code>).
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto flex-shrink-0">
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>1 Device Active</span>
            </span>
          </div>
        </div>

        {/* Phone APK Live Stream Ribbon */}
        {trackingSource === 'phone_apk' && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-gradient-to-r from-purple-950/40 via-slate-900 to-slate-950 border border-purple-500/30 text-xs">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30 flex-shrink-0">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white text-sm">
                    {latestPhonePing?.device_name || 'Android Companion Beacon'}
                  </span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Realtime Telemetry Stream</span>
                  </span>
                </div>
                <p className="text-slate-400 text-xs mt-0.5">
                  Native Android Foreground Service running in pocket • Bypasses browser tab throttling
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap text-xs">
              {latestPhonePing?.battery_level !== undefined && latestPhonePing.battery_level !== null && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700/80 text-slate-200">
                  {latestPhonePing.is_charging ? (
                    <BatteryCharging className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Battery className="w-4 h-4 text-amber-400" />
                  )}
                  <span className="font-mono font-bold">{Math.round(latestPhonePing.battery_level)}%</span>
                  {latestPhonePing.is_charging && <span className="text-[10px] text-emerald-400 font-semibold">(Charging)</span>}
                </div>
              )}

              {latestPhonePing?.accuracy_meters !== undefined && latestPhonePing.accuracy_meters !== null && (
                <div className="px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700/80 text-slate-300 font-mono">
                  <span>±{latestPhonePing.accuracy_meters.toFixed(1)}m GPS</span>
                </div>
              )}

              <button
                onClick={() => setShowPairPhoneModal(true)}
                className="px-3 py-1.5 rounded-xl bg-purple-500 hover:bg-purple-400 text-slate-950 font-bold transition flex items-center gap-1 cursor-pointer"
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>Pairing Info</span>
              </button>
            </div>
          </div>
        )}

        {/* Real-Time Speedometer & Telemetry Ribbon */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

          {/* Gauge 1: Current Speed */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800/80 space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                <Gauge className="w-4 h-4 text-emerald-400" />
                <span>Instant Velocity</span>
              </span>
              <span className="text-[10px] font-mono text-slate-500">GPS / Sim</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-white font-mono tracking-tight">
                {currentSpeedKmh.toFixed(1)}
              </span>
              <span className="text-xs font-bold text-slate-400">km/h</span>
              <span className="text-xs text-slate-500 font-mono">
                ({(currentSpeedKmh * 0.621371).toFixed(1)} mph)
              </span>
            </div>
          </div>

          {/* Gauge 2: Classified Transport Mode with Traffic Alert */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800/80 space-y-1.5">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Detected Transport Mode</span>
              {isInTraffic && (
                <span className="flex items-center gap-1 text-[10px] text-amber-400 font-bold">
                  <AlertTriangle className="w-3 h-3" />
                  <span>Traffic Jam</span>
                </span>
              )}
            </div>
            <div>{renderModeBadge(classifiedMode, isInTraffic)}</div>
          </div>

          {/* Gauge 3: Current GPS Coordinates & Heading */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800/80 space-y-1">
            <div className="text-xs text-slate-400 flex items-center gap-1.5">
              <Compass className="w-4 h-4 text-teal-400" />
              <span>Spatial Coordinates</span>
            </div>
            <div className="text-xs font-mono text-slate-200 truncate pt-1">
              {currentCoords ? (
                <>
                  Lat: <span className="text-white">{currentCoords.latitude.toFixed(4)}</span>, Lng:{' '}
                  <span className="text-white">{currentCoords.longitude.toFixed(4)}</span>
                </>
              ) : (
                <span className="text-amber-400 font-medium">Acquiring Device GPS...</span>
              )}
            </div>
            <div className="text-[10px] text-slate-400 truncate">{statusMessage}</div>
          </div>

          {/* Gauge 4: Mode Lock Selector */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800/80 space-y-1.5">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Mode Lock Override</span>
              <span className="text-[10px] text-emerald-400">Traffic-Safe</span>
            </div>
            <select
              value={manualModeLock}
              onChange={(e) => setManualModeLock(e.target.value as TransportMode | 'auto')}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="auto">Auto-Detect (Smart)</option>
              <option value="vehicle">🚗 Lock: Driving / Transit</option>
              <option value="cycling">🚲 Lock: Cycling</option>
              <option value="walking">🚶 Lock: Walking</option>
              <option value="stationary">⏸️ Lock: Stationary</option>
            </select>
          </div>
        </div>

        {/* Simulator Controller Console (When Simulation is Active) */}
        {trackingSource === 'simulation' && (
          <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border border-emerald-500/20 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  Interactive Route Simulation Controller
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                  Waypoint {simWaypointIndex + 1}/{activeScenario.waypoints.length}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsSimPlaying(!isSimPlaying)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                    isSimPlaying
                      ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                      : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                  }`}
                >
                  {isSimPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  <span>{isSimPlaying ? 'Pause Movement' : 'Play Movement'}</span>
                </button>
                <button
                  onClick={stepSimulation}
                  title="Advance single waypoint"
                  className="px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 transition cursor-pointer flex items-center gap-1"
                >
                  <span>Step</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => {
                    setSimWaypointIndex(0);
                    handleSelectScenario(selectedScenarioId);
                  }}
                  title="Reset to scenario start"
                  className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Scenario Picker & Live Speed Override Slider */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                  Preset Route Scenario
                </label>
                <select
                  value={selectedScenarioId}
                  onChange={(e) => handleSelectScenario(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-750 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  {SIMULATION_SCENARIOS.map((sc) => (
                    <option key={sc.id} value={sc.id}>
                      {sc.name}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400 mt-1">{activeScenario.description}</p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Dynamic Velocity Slider
                  </label>
                  <span className="text-xs font-mono font-bold text-emerald-400">
                    {simSpeedOverride !== null ? `${simSpeedOverride} km/h` : 'Scenario Auto'}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={simSpeedOverride !== null ? simSpeedOverride : Math.round(currentSpeedKmh)}
                    onChange={(e) => setSimSpeedOverride(Number(e.target.value))}
                    className="w-full accent-emerald-500 cursor-pointer"
                  />
                  {simSpeedOverride !== null && (
                    <button
                      onClick={() => setSimSpeedOverride(null)}
                      className="text-[10px] text-slate-400 hover:text-white underline cursor-pointer whitespace-nowrap"
                    >
                      Reset
                    </button>
                  )}
                </div>
                <div className="flex justify-between text-[10px] text-slate-500 mt-1 font-mono">
                  <span>0 (Jam / Red Light)</span>
                  <span>5 (Walk)</span>
                  <span>15 (Traffic Crawl)</span>
                  <span>50 (City Drive)</span>
                  <span>80+ (Highway)</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ===================================================================== */}
      {/* 2. DAILY MOBILITY & COMMUTE EXPENDITURE CARD */}
      {/* ===================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Car className="w-5 h-5 text-emerald-400" />
              <h2 className="text-base font-bold text-white">Daily Commute &amp; Movement Summary</h2>
            </div>
            <span className="text-xs font-mono text-slate-400">Today: {dailyStats?.stat_date}</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-850">
              <span className="text-xs text-slate-400 block mb-1">Total Distance</span>
              <span className="text-xl font-bold font-mono text-white">
                {(dailyStats?.total_distance_km ?? 0).toFixed(1)}
              </span>
              <span className="text-xs text-slate-500 ml-1">km</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-850">
              <span className="text-xs text-slate-400 block mb-1">Transit Time</span>
              <span className="text-xl font-bold font-mono text-white">
                {dailyStats?.transit_time_minutes ?? 0}
              </span>
              <span className="text-xs text-slate-500 ml-1">mins</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-850">
              <span className="text-xs text-slate-400 block mb-1">Est. Commute Cost</span>
              <span className="text-xl font-bold font-mono text-emerald-400">
                {symbol}{(dailyStats?.estimated_transit_cost ?? 0).toFixed(2)}
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-850">
              <span className="text-xs text-slate-400 block mb-1">Logged to Ledger</span>
              <span className="text-xl font-bold font-mono text-blue-400">
                {symbol}{(dailyStats?.logged_transit_cost ?? 0).toFixed(2)}
              </span>
            </div>
          </div>

          {/* Modal Split Breakdown Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Transport Modal Split</span>
              <div className="flex items-center gap-3 font-mono text-[11px]">
                <span className="text-blue-400">🚗 {dailyStats?.vehicle_km ?? 0} km vehicle</span>
                <span className="text-emerald-400">🚶 {dailyStats?.walking_km ?? 0} km walk</span>
                <span className="text-cyan-400">🚲 {dailyStats?.cycling_km ?? 0} km bike</span>
              </div>
            </div>
            <div className="h-2.5 rounded-full bg-slate-950 flex overflow-hidden border border-slate-800">
              {dailyStats && dailyStats.total_distance_km > 0 ? (
                <>
                  <div
                    style={{
                      width: `${(dailyStats.vehicle_km / dailyStats.total_distance_km) * 100}%`,
                    }}
                    className="bg-blue-500 h-full transition-all"
                    title="Vehicle"
                  />
                  <div
                    style={{
                      width: `${(dailyStats.walking_km / dailyStats.total_distance_km) * 100}%`,
                    }}
                    className="bg-emerald-500 h-full transition-all"
                    title="Walking"
                  />
                  <div
                    style={{
                      width: `${(dailyStats.cycling_km / dailyStats.total_distance_km) * 100}%`,
                    }}
                    className="bg-cyan-500 h-full transition-all"
                    title="Cycling"
                  />
                </>
              ) : (
                <div className="w-full h-full bg-slate-950" />
              )}
            </div>
            {(!dailyStats || dailyStats.total_distance_km === 0) && (
              <p className="text-[11px] text-slate-500 font-mono text-center pt-0.5">
                0.0 km recorded movement today
              </p>
            )}
          </div>
        </div>

        {/* Quick Commute Cost Ledger Logger */}
        <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <CurrencyLogo variant="icon" size="sm" />
              <h3 className="text-sm font-bold text-white">1-Click Commute Ledger</h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Auto-log estimated fuel, toll, or transit fares directly to your financial ledger based on detected vehicle
              commute distances.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-850 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Pending Commute Balance:</span>
              <span className="font-mono font-bold text-emerald-400 text-sm">
                {symbol}
                {Math.max(
                  0,
                  (dailyStats?.estimated_transit_cost || 0) - (dailyStats?.logged_transit_cost || 0)
                ).toFixed(2)}
              </span>
            </div>

            {(() => {
              const pendingCommute = Math.max(
                0,
                (dailyStats?.estimated_transit_cost || 0) - (dailyStats?.logged_transit_cost || 0)
              );
              const hasPending = pendingCommute > 0;
              return (
                <button
                  disabled={!hasPending}
                  onClick={() => {
                    if (!hasPending) return;
                    setLoggingTrip({
                      id: `commute-summary-${Date.now()}`,
                      user_id: userId,
                      event_type: 'trip',
                      title: "Today's Cumulative Commute",
                      start_time: new Date().toISOString(),
                      distance_km: dailyStats?.vehicle_km || 0,
                      estimated_cost: pendingCommute,
                      mode: 'vehicle',
                      in_traffic: true,
                    });
                  }}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-md shadow-emerald-500/10 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>{hasPending ? 'Log Commute Expense Now' : 'No Pending Commute Expenses'}</span>
                </button>
              );
            })()}
          </div>
        </div>
      </div>



      {/* ===================================================================== */}
      {/* 3. GEOFENCED PLACES & PROXIMITY PAYMENT REMINDERS */}
      {/* ===================================================================== */}
      <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-emerald-400" />
              <h2 className="text-base font-bold text-white">Geofenced Places &amp; Payment Triggers</h2>
            </div>
            <p className="text-xs text-slate-400">
              When entering these perimeters, Apex LifeOS fires payment alerts for tasks, budgets, and social debts.
            </p>
          </div>
          <button
            onClick={() => {
              if (currentCoords) {
                setNewPlaceLat(currentCoords.latitude);
                setNewPlaceLng(currentCoords.longitude);
              } else if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                  (pos) => {
                    setNewPlaceLat(Number(pos.coords.latitude.toFixed(6)));
                    setNewPlaceLng(Number(pos.coords.longitude.toFixed(6)));
                  },
                  () => {},
                  { timeout: 3000 }
                );
              }
              setShowAddPlaceModal(true);
            }}
            className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer self-start sm:self-auto shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Add Geofenced Place</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {placesWithProximity.map((place) => {
            const matchingBudget = place.reminder_type === 'budget' && place.category_id
              ? budgets.find((b) => b.category_id === place.category_id)
              : null;
            const matchingTask = place.linked_task_id
              ? tasks.find((t) => t.id === place.linked_task_id)
              : null;

            return (
              <div
                key={place.id}
                className={`p-4 rounded-2xl border transition-all ${
                  place.isInside
                    ? 'bg-emerald-950/30 border-emerald-500/50 shadow-lg shadow-emerald-500/5'
                    : 'bg-slate-950 border-slate-800/80 hover:border-slate-700'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div
                      className={`p-2.5 rounded-xl border flex-shrink-0 ${
                        place.isInside
                          ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 animate-pulse'
                          : 'bg-slate-900 text-slate-400 border-slate-800'
                      }`}
                    >
                      <MapPin className="w-4 h-4" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-bold text-white">{place.name}</h4>
                        {place.isInside ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            Inside Geofence ({place.distanceMeters}m)
                          </span>
                        ) : place.distanceMeters !== null ? (
                          <span className="text-[10px] font-mono text-slate-400">
                            {place.distanceMeters}m away
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono text-slate-500">
                            Awaiting GPS
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-300">{place.reminder_message}</p>
                      <div className="flex items-center gap-2 pt-1 text-[11px] text-slate-400 font-mono flex-wrap">
                        <span>Radius: {place.radius_meters}m</span>
                        <span>•</span>
                        <span className="capitalize">Type: {place.reminder_type}</span>
                        {matchingBudget && (
                          <span className="text-emerald-400 font-semibold">
                            • Budget: {formatCurrency(matchingBudget.monthly_limit)}
                          </span>
                        )}
                      </div>

                      {place.isInside && matchingTask && matchingTask.status !== 'completed' && (
                        <button
                          onClick={async () => {
                            await supabase.from('tasks').update({ status: 'completed' }).eq('id', matchingTask.id);
                            onTasksUpdated?.();
                          }}
                          className="mt-1 text-[11px] text-amber-300 hover:text-amber-200 font-semibold underline flex items-center gap-1 cursor-pointer"
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Complete Linked Task ({matchingTask.title})</span>
                        </button>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => handleDeletePlace(place.id)}
                    title="Remove place"
                    className="p-1 rounded-lg text-slate-500 hover:text-rose-400 transition cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 4. CHRONOLOGICAL MOVEMENT & ACTIVITY TIMELINE FEED */}
      {/* ===================================================================== */}
      <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-teal-400" />
              <h2 className="text-base font-bold text-white">Chronological Movement Timeline</h2>
            </div>
            <p className="text-xs text-slate-400">
              Stays, commutes, and location-triggered payment alerts recorded throughout the day
            </p>
          </div>

          <div className="p-1 rounded-xl bg-slate-950 border border-slate-800 flex items-center text-xs self-start sm:self-auto">
            {(['all', 'trip', 'stay'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTimelineFilter(t)}
                className={`px-3 py-1 rounded-lg capitalize transition cursor-pointer ${
                  timelineFilter === t
                    ? 'bg-slate-800 text-white font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {t === 'all' ? 'All Events' : `${t}s`}
              </button>
            ))}
          </div>
        </div>

        {/* Timeline Event Cards */}
        <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-800">
          {filteredEvents.map((ev) => {
            const isTrip = ev.event_type === 'trip';
            return (
              <div key={ev.id} className="relative group">
                {/* Timeline node dot */}
                <div
                  className={`absolute -left-6 top-1 w-5 h-5 rounded-full border-2 border-slate-900 flex items-center justify-center ${
                    isTrip ? 'bg-blue-500' : 'bg-emerald-500'
                  }`}
                >
                  {isTrip ? (
                    <Car className="w-2.5 h-2.5 text-slate-950" />
                  ) : (
                    <MapPin className="w-2.5 h-2.5 text-slate-950" />
                  )}
                </div>

                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-850 hover:border-slate-750 transition space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm font-bold text-white">{ev.title}</h4>
                      {ev.mode && renderModeBadge(ev.mode, ev.in_traffic)}
                    </div>
                    <span className="text-[11px] font-mono text-slate-400">
                      {new Date(ev.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  {/* Trip Details & Commute Ledger CTA */}
                  {isTrip && (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                      <div className="flex items-center gap-4 text-xs font-mono text-slate-300 flex-wrap">
                        <span>Distance: <strong className="text-white">{ev.distance_km} km</strong></span>
                        <span>Avg Speed: <strong className="text-white">{ev.avg_speed_kmh} km/h</strong></span>
                        {ev.estimated_cost && (
                          <span className="text-emerald-400 font-bold">
                            Est. Fuel: {symbol}{ev.estimated_cost.toFixed(2)}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        {ev.mode === 'vehicle' && (
                          <div>
                            {ev.is_cost_logged ? (
                              <span className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Logged to Ledger</span>
                              </span>
                            ) : (
                              <button
                                onClick={() => setLoggingTrip(ev)}
                                className="px-3 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1 transition cursor-pointer"
                              >
                                <span>Log {symbol}{ev.estimated_cost?.toFixed(2) || '2.50'}</span>
                                <ArrowRight className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {ev.notes && <p className="text-xs text-slate-400">{ev.notes}</p>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ===================================================================== */}
      {/* MODAL: ADD GEOFENCED PLACE */}
      {/* ===================================================================== */}
      {showAddPlaceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl relative space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">

              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold text-white">Add Geofenced Place</h3>
              </div>
              <button
                onClick={() => setShowAddPlaceModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreatePlace} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Place Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Costco Wholesale, Office HQ, Landlord Apartment"
                  value={newPlaceName}
                  onChange={(e) => setNewPlaceName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Geographic Coordinates *
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (currentCoords) {
                        setNewPlaceLat(Number(currentCoords.latitude.toFixed(6)));
                        setNewPlaceLng(Number(currentCoords.longitude.toFixed(6)));
                      } else if (typeof navigator !== 'undefined' && navigator.geolocation) {
                        navigator.geolocation.getCurrentPosition(
                          (pos) => {
                            setNewPlaceLat(Number(pos.coords.latitude.toFixed(6)));
                            setNewPlaceLng(Number(pos.coords.longitude.toFixed(6)));
                          },
                          (err) => {
                            alert(`Could not acquire GPS: ${err.message}`);
                          },
                          { enableHighAccuracy: true, timeout: 8000 }
                        );
                      }
                    }}
                    className="text-[11px] text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <Navigation className="w-3 h-3" />
                    <span>Use Current Device GPS</span>
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      Latitude
                    </label>
                    <input
                      type="number"
                      step="0.000001"
                      required
                      placeholder="e.g. 6.9271"
                      value={newPlaceLat}
                      onChange={(e) => setNewPlaceLat(parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      Longitude
                    </label>
                    <input
                      type="number"
                      step="0.000001"
                      required
                      placeholder="e.g. 79.8612"
                      value={newPlaceLng}
                      onChange={(e) => setNewPlaceLng(parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                    />
                  </div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>Geofence Radius: {newPlaceRadius} meters</span>
                  <span className="text-[10px] text-emerald-400">Proximity trigger distance</span>
                </div>
                <input
                  type="range"
                  min="100"
                  max="1500"
                  step="50"
                  value={newPlaceRadius}
                  onChange={(e) => setNewPlaceRadius(Number(e.target.value))}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Payment Reminder Type
                </label>
                <select
                  value={newPlaceReminderType}
                  onChange={(e) => setNewPlaceReminderType(e.target.value as ReminderType)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white"
                >
                  <option value="budget">Budget Category Allowance (e.g. Groceries)</option>
                  <option value="task">Linked Task (e.g. Pay Rent, Collect Check)</option>
                  <option value="contact">Social Contact IOU (e.g. Settle Debt)</option>
                  <option value="custom">Custom Notification</option>
                </select>
              </div>

              {/* Dynamic link selector based on type */}
              {newPlaceReminderType === 'budget' && (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                    Linked Budget Category
                  </label>
                  <select
                    value={newPlaceCategoryId}
                    onChange={(e) => setNewPlaceCategoryId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white"
                  >
                    <option value="">Select Category...</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {newPlaceReminderType === 'task' && (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                    Linked Task
                  </label>
                  <select
                    value={newPlaceTaskId}
                    onChange={(e) => setNewPlaceTaskId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white"
                  >
                    <option value="">Select Task...</option>
                    {tasks.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title} ({symbol}{t.amount})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {newPlaceReminderType === 'contact' && (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                    Linked Contact IOU
                  </label>
                  <select
                    value={newPlaceContactId}
                    onChange={(e) => setNewPlaceContactId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white"
                  >
                    <option value="">Select Contact...</option>
                    {contactsLedger.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.contact_name} ({symbol}{c.amount})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Reminder Message
                </label>
                <input
                  type="text"
                  placeholder="e.g. Check produce budget before entering store!"
                  value={newPlaceMessage}
                  onChange={(e) => setNewPlaceMessage(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white"
                />
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddPlaceModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-md transition"
                >
                  Save Place &amp; Geofence
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL: COMMUTE EXPENSE LEDGER CONFIRMATION */}
      {/* ===================================================================== */}
      {loggingTrip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl relative space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">

              <div className="flex items-center gap-2">
                <Car className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold text-white">Log Commute Expense</h3>
              </div>
              <button
                onClick={() => setLoggingTrip(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-xs text-slate-300">
                Record travel expenditure for <strong className="text-white">&ldquo;{loggingTrip.title}&rdquo;</strong> into
                your balance sheet:
              </p>

              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Trip Distance:</span>
                  <span className="font-mono text-white font-bold">{loggingTrip.distance_km || 14.8} km</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Estimated Cost:</span>
                  <span className="font-mono text-emerald-400 font-bold text-sm">
                    {symbol}{loggingTrip.estimated_cost?.toFixed(2) || '2.50'}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Category:</span>
                  <span className="text-blue-400 font-medium">Transportation</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Deduct From Account *
                </label>
                <select
                  value={commuteAccountId}
                  onChange={(e) => setCommuteAccountId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white"
                >
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({formatCurrency(acc.balance)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setLoggingTrip(null)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmLogExpense}
                  disabled={isLoggingExpense}
                  className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-md transition flex items-center gap-1.5"
                >
                  {isLoggingExpense && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Deduct &amp; Record to Ledger</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL: PAIR ANDROID LOCATION TRACKER APK */}
      {/* ===================================================================== */}
      {showPairPhoneModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl relative space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <span>Pair Android Tracker APK</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold flex items-center gap-1">
                      <Lock className="w-2.5 h-2.5" /> Zero-Exposure
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">Encrypted background GPS pairing with no plain text credentials</p>
                </div>
              </div>
              <button
                onClick={() => setShowPairPhoneModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick 1-Scan QR Code Section */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-center space-y-3">
              <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-purple-300">
                <QrCode className="w-4 h-4 text-purple-400" />
                <span>Scan with Camera or Apex Tracker APK</span>
              </div>

              <div className="flex justify-center py-1">
                {qrCodeDataUrl ? (
                  <div className="p-2 bg-slate-950 rounded-2xl border-2 border-purple-500/30 shadow-xl shadow-purple-500/10 inline-block">
                    <img
                      src={qrCodeDataUrl}
                      alt="Companion Pairing QR Code"
                      className="w-44 h-44 rounded-xl"
                    />
                  </div>
                ) : (
                  <div className="w-44 h-44 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center">
                    <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
                  </div>
                )}
              </div>

              {/* 1-Click Secure Pairing Token Button */}
              <button
                onClick={() => {
                  navigator.clipboard.writeText(pairingToken);
                  setCopiedToken(true);
                  setTimeout(() => setCopiedToken(false), 2500);
                }}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-purple-500/20 transition cursor-pointer"
              >
                {copiedToken ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-300" />
                    <span className="text-emerald-300">Copied Secure Pairing Token!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copy Encrypted Pairing Token (1-Tap Sideload)</span>
                  </>
                )}
              </button>
              <p className="text-[11px] text-slate-500">
                Contains an obfuscated connection envelope. Never exposes raw database credentials or URLs.
              </p>
            </div>



            {/* Step-by-Step Instructions */}
            <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800/80 space-y-2 text-xs text-slate-300">
              <span className="font-bold text-white block">Fast Pairing Workflow:</span>
              <ol className="list-decimal list-inside space-y-1 text-slate-400 text-[11px]">
                <li>Install the <strong>Apex Location Tracker</strong> APK on your phone.</li>
                <li>Tap <strong>Settings (⚙️)</strong> in the app and tap <strong>&ldquo;Import &amp; Connect&rdquo;</strong> with the token copied above (or scan QR).</li>
                <li>Tap <strong>START BACKGROUND TRACKING</strong>. Telemetry begins streaming live to your dashboard without browser sleep!</li>
              </ol>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setShowPairPhoneModal(false)}
                className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
