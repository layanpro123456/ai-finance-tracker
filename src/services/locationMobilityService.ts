import { supabase } from '../supabaseClient';
import type {
  SavedPlace,
  MobilityTimelineEvent,
  DailyMobilityStats,
  ProximityAlert,
  TransportMode,
  Budget,
  Task,
  ContactsLedger,
  DeviceLocationPing,
  MobilityJourney,
} from '../types';
import { getDeviceId, getDeviceName } from './deviceSessionService';

// ============================================================================
// Constants & Device-Bound Storage Keys
// ============================================================================
export const getPlacesStorageKey = (deviceId: string) => `apex_saved_places_${deviceId}`;
export const getEventsStorageKey = (deviceId: string) => `apex_timeline_events_${deviceId}`;
export const getStatsStorageKey = (deviceId: string, statDate: string) =>
  `apex_daily_mobility_${deviceId}_${statDate}`;


// ============================================================================
// Mathematical Geodesic Distance (Haversine Formula)
// ============================================================================
export function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth's mean radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  return calculateDistanceMeters(lat1, lon1, lat2, lon2) / 1000;
}

// ============================================================================
// Traffic-Resilient Speed & Transport Mode Classifier
// ============================================================================

export interface ClassifiedMobilityState {
  mode: TransportMode;
  inTraffic: boolean;
  statusLabel: string;
  confidence: number;
}

export class MobilityClassifier {
  private peakSpeedKmh = 0;
  private recentSpeeds: number[] = [];
  private currentMode: TransportMode = 'vehicle';
  private inTraffic = false;
  private tripStartTime: number | null = null;
  private lastMovingTime: number = Date.now();

  public getCurrentMode(): TransportMode {
    return this.currentMode;
  }

  public getIsInTraffic(): boolean {
    return this.inTraffic;
  }

  /**
   * Evaluates speed and traffic conditions without stationary or cycling heuristics.
   */
  public evaluate(
    instantSpeedKmh: number,
    manualModeLock: TransportMode | 'auto' = 'auto'
  ): ClassifiedMobilityState {
    const now = Date.now();
    const speed = Math.max(0, instantSpeedKmh);

    // Keep rolling history of last 6 readings
    this.recentSpeeds.push(speed);
    if (this.recentSpeeds.length > 6) {
      this.recentSpeeds.shift();
    }

    // Update peak speed in current moving window
    if (speed > this.peakSpeedKmh) {
      this.peakSpeedKmh = speed;
    }

    if (speed > 1.5) {
      this.lastMovingTime = now;
      if (!this.tripStartTime) {
        this.tripStartTime = now;
      }
    }

    // 1. If user explicitly locked a mode, honor it
    if (manualModeLock !== 'auto') {
      const isCongested = manualModeLock === 'vehicle' && speed < 16;
      this.currentMode = manualModeLock;
      this.inTraffic = isCongested;
      return {
        mode: manualModeLock,
        inTraffic: isCongested,
        statusLabel: isCongested
          ? '🚗 In Vehicle (Heavy Traffic / Congestion)'
          : manualModeLock === 'vehicle'
          ? '🚗 In Vehicle (Free Flowing)'
          : '🚶 Walking',
        confidence: 0.99,
      };
    }

    // 2. High-speed express transit (train, highway)
    if (speed >= 80) {
      this.currentMode = 'high_speed_transit';
      this.inTraffic = false;
      return {
        mode: 'high_speed_transit',
        inTraffic: false,
        statusLabel: '🚄 High-Speed Expressway / Rail',
        confidence: 0.95,
      };
    }

    // 3. Normal vehicle range
    if (speed >= 25) {
      this.currentMode = 'vehicle';
      this.inTraffic = false;
      return {
        mode: 'vehicle',
        inTraffic: false,
        statusLabel: '🚗 Vehicle Commute (Free Flowing)',
        confidence: 0.92,
      };
    }

    // 4. Traffic Jam & Congestion Detection:
    const hasMotorizedHistory = this.peakSpeedKmh >= 24;
    const timeSinceMovement = now - this.lastMovingTime;

    if (hasMotorizedHistory && timeSinceMovement < 4 * 60 * 1000) {
      if (speed <= 1.5) {
        this.currentMode = 'vehicle';
        this.inTraffic = true;
        return {
          mode: 'vehicle',
          inTraffic: true,
          statusLabel: '🚗 Vehicle (Stopped at Red Light / Traffic Jam)',
          confidence: 0.88,
        };
      }
      if (speed < 18) {
        this.currentMode = 'vehicle';
        this.inTraffic = true;
        return {
          mode: 'vehicle',
          inTraffic: true,
          statusLabel: '🚗 Vehicle (Heavy Traffic Crawl)',
          confidence: 0.89,
        };
      }
      this.currentMode = 'vehicle';
      this.inTraffic = false;
      return {
        mode: 'vehicle',
        inTraffic: false,
        statusLabel: '🚗 Vehicle Commute',
        confidence: 0.9,
      };
    }

    // 5. Walking range (1.5 to 8 km/h)
    if (speed >= 1.5 && speed < 8) {
      this.currentMode = 'walking';
      this.inTraffic = false;
      return {
        mode: 'walking',
        inTraffic: false,
        statusLabel: '🚶 Walking / Pedestrian',
        confidence: 0.87,
      };
    }

    // 6. In Transit / Vehicle Default
    return {
      mode: 'vehicle',
      inTraffic: false,
      statusLabel: '🚗 In Transit',
      confidence: 0.95,
    };
  }

  public resetTrip() {
    this.peakSpeedKmh = 0;
    this.recentSpeeds = [];
    this.currentMode = 'vehicle';
    this.inTraffic = false;
    this.tripStartTime = null;
    this.lastMovingTime = Date.now();
  }
}

// Global classifier instance
export const globalClassifier = new MobilityClassifier();

// ============================================================================
// Geofencing Proximity Detector
// ============================================================================
export function evaluateProximityAlerts(
  coords: { latitude: number; longitude: number },
  places: SavedPlace[],
  dismissedPlaceIds: Set<string>,
  budgets: Budget[] = [],
  tasks: Task[] = [],
  contacts: ContactsLedger[] = []
): ProximityAlert[] {
  const alerts: ProximityAlert[] = [];

  for (const place of places) {
    if (dismissedPlaceIds.has(place.id)) {
      continue;
    }

    const dist = calculateDistanceMeters(
      coords.latitude,
      coords.longitude,
      place.latitude,
      place.longitude
    );

    if (dist <= place.radius_meters) {
      let budgetRemaining: number | null = null;
      let taskAmount: number | null = null;
      let contactAmount: number | null = null;
      let actionLabel = 'Review';
      let message = place.reminder_message || `Arrived near ${place.name}`;

      if (place.reminder_type === 'budget') {
        const matchingBudget = budgets.find((b) => b.category_id === place.category_id);
        if (matchingBudget) {
          // If monthly limit exists, we formulate budget message
          budgetRemaining = matchingBudget.monthly_limit;
          message = `You are near ${place.name}. Monthly category budget: ${matchingBudget.monthly_limit.toFixed(
            2
          )}`;
          actionLabel = 'Log Purchase';
        }
      } else if (place.reminder_type === 'task') {
        const matchingTask = tasks.find((t) => t.id === place.linked_task_id && t.status !== 'completed');
        if (matchingTask) {
          taskAmount = matchingTask.amount;
          message = `Pending task: "${matchingTask.title}" (${
            matchingTask.amount > 0 ? `amount: ${matchingTask.amount}` : 'Action required'
          })`;
          actionLabel = 'Complete Task';
        }
      } else if (place.reminder_type === 'contact') {
        const matchingContact = contacts.find((c) => c.id === place.linked_contact_id && !c.is_settled);
        if (matchingContact) {
          contactAmount = matchingContact.amount;
          message = `Social IOU: ${matchingContact.contact_name} (${
            matchingContact.type === 'they_owe_me' ? 'Owes you' : 'You owe'
          } ${matchingContact.amount})`;
          actionLabel = 'Settle IOU';
        }
      }

      alerts.push({
        id: `alert-${place.id}-${Math.floor(Date.now() / (1000 * 60 * 15))}`, // stable per 15-min window
        placeId: place.id,
        placeName: place.name,
        distanceMeters: Math.round(dist),
        reminderType: place.reminder_type,
        reminderMessage: message,
        suggestedActionLabel: actionLabel,
        timestamp: new Date().toISOString(),
        linkedTaskId: place.linked_task_id,
        linkedCategoryId: place.category_id,
        linkedContactId: place.linked_contact_id,
        budgetRemaining,
        taskAmount,
        contactAmount,
      });
    }
  }

  return alerts;
}

// ============================================================================
// Commute Cost Estimator
// ============================================================================
export function estimateCommuteCost(
  distanceKm: number,
  ratePerKm = 0.18, // Default ~0.18 per km (fuel + depreciation / transit fare)
  inTraffic = false
): number {
  if (distanceKm <= 0) return 0;
  // If commute experienced heavy traffic idling, add a 15% traffic congestion factor
  const trafficMultiplier = inTraffic ? 1.15 : 1.0;
  const cost = distanceKm * ratePerKm * trafficMultiplier;
  return Math.round(cost * 100) / 100;
}

// ============================================================================
// LocalStorage & Supabase Persistence Engine (Always Sync with Supabase)
// ============================================================================

export async function loadSavedPlaces(
  userId: string,
  deviceId = getDeviceId()
): Promise<SavedPlace[]> {
  try {
    const { data, error } = await supabase
      .from('saved_places')
      .select('*, categories(name), tasks(title, amount), contacts_ledger(contact_name, amount, type)')
      .eq('user_id', userId)
      .or(`device_id.eq.${deviceId},device_id.is.null`)
      .order('created_at', { ascending: false });

    if (!error && data) {
      return data as SavedPlace[];
    }
    if (error) {
      console.warn('Supabase query error on saved_places:', error.message);
    }
  } catch (err) {
    console.warn('Network error loading saved places from Supabase:', err);
  }

  return [];
}

export async function persistSavedPlace(
  userId: string,
  place: Partial<SavedPlace>,
  deviceId = getDeviceId()
): Promise<SavedPlace> {
  const newPlace: SavedPlace = {
    id: place.id || `place-${Date.now()}`,
    user_id: userId,
    device_id: deviceId,
    name: place.name || 'New Geofence Place',
    latitude: place.latitude !== undefined ? place.latitude : 0,
    longitude: place.longitude !== undefined ? place.longitude : 0,
    radius_meters: place.radius_meters || 300,
    category_id: place.category_id || null,
    linked_task_id: place.linked_task_id || null,
    linked_contact_id: place.linked_contact_id || null,
    reminder_type: place.reminder_type || 'budget',
    reminder_message: place.reminder_message || '',
    icon_type: place.icon_type || 'map-pin',
    created_at: new Date().toISOString(),
  };

  const { error } = await supabase.from('saved_places').upsert(newPlace);
  if (error) {
    console.error('Error persisting place to Supabase:', error.message);
  }

  return newPlace;
}

export async function removeSavedPlace(
  userId: string,
  placeId: string,
  _deviceId = getDeviceId()
): Promise<void> {
  const { error } = await supabase
    .from('saved_places')
    .delete()
    .eq('id', placeId)
    .eq('user_id', userId);

  if (error) {
    console.error('Error deleting place from Supabase:', error.message);
  }
}

// ----------------------------------------------------------------------------
// Timeline Events Persistence (Always Sync Directly with Supabase)
// ----------------------------------------------------------------------------
export async function loadTimelineEvents(
  userId: string,
  deviceId = getDeviceId()
): Promise<MobilityTimelineEvent[]> {
  try {
    const { data, error } = await supabase
      .from('mobility_timeline_events')
      .select('*')
      .eq('user_id', userId)
      .eq('device_id', deviceId)
      .order('start_time', { ascending: false });

    if (!error && data) {
      return data as MobilityTimelineEvent[];
    }
    if (error) {
      console.warn('Supabase query error on mobility_timeline_events:', error.message);
    }
  } catch (err) {
    console.warn('Network error loading timeline events from Supabase:', err);
  }

  return [];
}

export async function persistTimelineEvent(
  userId: string,
  event: MobilityTimelineEvent,
  deviceId = getDeviceId()
): Promise<void> {
  const enrichedEvent: MobilityTimelineEvent = {
    ...event,
    user_id: userId,
    device_id: deviceId,
    device_name: event.device_name || getDeviceName(),
  };

  const { error } = await supabase.from('mobility_timeline_events').upsert(enrichedEvent);
  if (error) {
    console.error('Error persisting timeline event to Supabase:', error.message);
  }
}

// ----------------------------------------------------------------------------
// Daily Mobility Statistics (Always Sync Directly with Supabase)
// ----------------------------------------------------------------------------
export async function loadDailyMobilityStats(
  userId: string,
  statDate: string,
  deviceId = getDeviceId()
): Promise<DailyMobilityStats> {
  const cleanStats: DailyMobilityStats = {
    user_id: userId,
    device_id: deviceId,
    stat_date: statDate,
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

  try {
    const { data, error } = await supabase
      .from('daily_mobility_stats')
      .select('*')
      .eq('user_id', userId)
      .eq('stat_date', statDate)
      .eq('device_id', deviceId)
      .maybeSingle();

    if (!error && data) {
      return data as DailyMobilityStats;
    }
  } catch (err) {
    console.warn('Error loading daily mobility stats from Supabase:', err);
  }

  return cleanStats;
}

export async function updateDailyMobilityStats(
  userId: string,
  delta: Partial<DailyMobilityStats>,
  deviceId = getDeviceId()
): Promise<DailyMobilityStats> {
  const today = new Date().toISOString().slice(0, 10);
  const current = await loadDailyMobilityStats(userId, today, deviceId);

  const updated: DailyMobilityStats = {
    ...current,
    device_id: deviceId,
    total_distance_km: Number((current.total_distance_km + (delta.total_distance_km || 0)).toFixed(2)),
    transit_time_minutes: current.transit_time_minutes + (delta.transit_time_minutes || 0),
    walking_km: Number((current.walking_km + (delta.walking_km || 0)).toFixed(2)),
    cycling_km: Number((current.cycling_km + (delta.cycling_km || 0)).toFixed(2)),
    vehicle_km: Number((current.vehicle_km + (delta.vehicle_km || 0)).toFixed(2)),
    estimated_transit_cost: Number(
      (current.estimated_transit_cost + (delta.estimated_transit_cost || 0)).toFixed(2)
    ),
    logged_transit_cost: Number(
      (current.logged_transit_cost + (delta.logged_transit_cost || 0)).toFixed(2)
    ),
    top_speed_kmh: Math.max(current.top_speed_kmh, delta.top_speed_kmh || 0),
    active_stops_count: current.active_stops_count + (delta.active_stops_count || 0),
  };

  try {
    const { error } = await supabase.from('daily_mobility_stats').upsert(updated);
    if (error) {
      console.error('Error upserting daily mobility stats to Supabase:', error.message);
    }
  } catch (err) {
    console.warn('Network error saving daily mobility stats to Supabase:', err);
  }

  return updated;
}


// ============================================================================
// GPS Route Simulation Engine (Dynamic Relative Waypoints)
// ============================================================================
export interface SimulationWaypoint {
  deltaLat: number;
  deltaLng: number;
  latitude: number;
  longitude: number;
  speedKmh: number;
  description: string;
}

export interface SimulationScenario {
  id: string;
  name: string;
  description: string;
  expectedMode: TransportMode;
  waypoints: SimulationWaypoint[];
}

export const SIMULATION_SCENARIOS: SimulationScenario[] = [
  {
    id: 'walk_supermarket',
    name: '🚶 Pedestrian Walk (4.5 km/h Pace)',
    description: 'Walking at pedestrian velocity to verify walking mode classifier and nearby geofence detection.',
    expectedMode: 'walking',
    waypoints: [
      { deltaLat: 0.0000, deltaLng: 0.0000, latitude: 0, longitude: 0, speedKmh: 4.2, description: 'Departing origin sidewalk' },
      { deltaLat: 0.0004, deltaLng: 0.0008, latitude: 0.0004, longitude: 0.0008, speedKmh: 4.8, description: 'Crossing pedestrian walkway' },
      { deltaLat: 0.0009, deltaLng: 0.0015, latitude: 0.0009, longitude: 0.0015, speedKmh: 4.5, description: 'Approaching commercial avenue' },
      { deltaLat: 0.0014, deltaLng: 0.0022, latitude: 0.0014, longitude: 0.0022, speedKmh: 2.1, description: 'Entering geofenced destination' },
      { deltaLat: 0.0015, deltaLng: 0.0023, latitude: 0.0015, longitude: 0.0023, speedKmh: 0.5, description: 'Inside destination' },
    ],
  },
  {
    id: 'traffic_commute',
    name: '🚗 City Commute with Traffic Congestion (0–15 km/h)',
    description: 'Stop-and-go urban traffic test. Confirms vehicle mode remains locked despite crawling & red lights.',
    expectedMode: 'vehicle',
    waypoints: [
      { deltaLat: 0.0000, deltaLng: 0.0000, latitude: 0, longitude: 0, speedKmh: 28.5, description: 'Pulling out of parking garage' },
      { deltaLat: 0.0012, deltaLng: 0.0010, latitude: 0.0012, longitude: 0.0010, speedKmh: 12.0, description: 'Hit morning rush hour congestion' },
      { deltaLat: 0.0022, deltaLng: 0.0018, latitude: 0.0022, longitude: 0.0018, speedKmh: 0.0, description: 'Halted at red light (Waiting in traffic)' },
      { deltaLat: 0.0030, deltaLng: 0.0025, latitude: 0.0030, longitude: 0.0025, speedKmh: 8.5, description: 'Crawling in stop-and-go traffic' },
      { deltaLat: 0.0042, deltaLng: 0.0042, latitude: 0.0042, longitude: 0.0042, speedKmh: 14.2, description: 'Slow acceleration through intersection' },
      { deltaLat: 0.0057, deltaLng: 0.0065, latitude: 0.0057, longitude: 0.0065, speedKmh: 1.0, description: 'Pulling into destination parking spot' },
    ],
  },
  {
    id: 'highway_express',
    name: '🚄 Highway Express Commute (65 km/h)',
    description: 'Fast arterial vehicle commute to calculate distance & fuel cost accurately.',
    expectedMode: 'vehicle',
    waypoints: [
      { deltaLat: 0.0000, deltaLng: 0.0000, latitude: 0, longitude: 0, speedKmh: 35.0, description: 'Entering highway on-ramp' },
      { deltaLat: 0.0032, deltaLng: 0.0050, latitude: 0.0032, longitude: 0.0050, speedKmh: 68.0, description: 'Cruising at highway speed' },
      { deltaLat: 0.0092, deltaLng: 0.0140, latitude: 0.0092, longitude: 0.0140, speedKmh: 74.5, description: 'Express expressway transit' },
      { deltaLat: 0.0152, deltaLng: 0.0210, latitude: 0.0152, longitude: 0.0210, speedKmh: 52.0, description: 'Taking downtown exit ramp' },
      { deltaLat: 0.0182, deltaLng: 0.0260, latitude: 0.0182, longitude: 0.0260, speedKmh: 22.0, description: 'Arriving at regional business park' },
    ],
  },
  {
    id: 'visit_errand',
    name: '🏠 Short Vehicle Errand (35 km/h to Dwell Stop)',
    description: 'Vehicle trip followed by stationary arrival to trigger geofence reminder.',
    expectedMode: 'vehicle',
    waypoints: [
      { deltaLat: 0.0000, deltaLng: 0.0000, latitude: 0, longitude: 0, speedKmh: 32.0, description: 'Driving down avenue' },
      { deltaLat: 0.0018, deltaLng: 0.0030, latitude: 0.0018, longitude: 0.0030, speedKmh: 24.0, description: 'Approaching destination area' },
      { deltaLat: 0.0033, deltaLng: 0.0065, latitude: 0.0033, longitude: 0.0065, speedKmh: 0.0, description: 'Parked outside destination (Geofenced)' },
    ],
  },
];

// ============================================================================
// Android APK Companion & Telemetry Stream Sync
// ============================================================================

export async function loadLatestDevicePing(
  userId: string,
  deviceId?: string
): Promise<DeviceLocationPing | null> {
  try {
    let query = supabase
      .from('device_location_pings')
      .select('*')
      .eq('user_id', userId)
      .order('recorded_at', { ascending: false })
      .limit(1);

    if (deviceId) {
      query = query.eq('device_id', deviceId);
    }

    const { data, error } = await query.maybeSingle();
    if (!error && data) {
      return data as DeviceLocationPing;
    }
  } catch (err) {
    console.warn('Error loading latest device ping:', err);
  }
  return null;
}

export async function recordDevicePing(
  userId: string,
  ping: Partial<DeviceLocationPing>,
  deviceId = getDeviceId()
): Promise<DeviceLocationPing | null> {
  const newPing: Partial<DeviceLocationPing> = {
    user_id: userId,
    device_id: ping.device_id || deviceId,
    device_name: ping.device_name || getDeviceName(),
    latitude: ping.latitude || 0,
    longitude: ping.longitude || 0,
    altitude: ping.altitude || null,
    accuracy_meters: ping.accuracy_meters || null,
    speed_kmh: ping.speed_kmh || 0,
    heading: ping.heading || null,
    battery_level: ping.battery_level || null,
    is_charging: ping.is_charging || false,
    transport_mode: ping.transport_mode || 'unknown',
    recorded_at: ping.recorded_at || new Date().toISOString(),
  };

  try {
    const { data, error } = await supabase
      .from('device_location_pings')
      .insert(newPing)
      .select()
      .single();

    if (!error && data) {
      return data as DeviceLocationPing;
    }
    if (error) {
      console.warn('Error recording device ping to Supabase:', error.message);
    }
  } catch (err) {
    console.warn('Network error pushing device ping:', err);
  }
  return null;
}

export function subscribeToDevicePings(
  userId: string,
  onPing: (ping: DeviceLocationPing) => void
) {
  const channel = supabase
    .channel(`device_location_pings_${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'device_location_pings',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        if (payload.new) {
          onPing(payload.new as DeviceLocationPing);
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}



// ============================================================================
// Historical Travelling Analytics & Pings Querying
// ============================================================================

export async function loadDevicePingsForDate(
  userId: string,
  dateStr: string, // YYYY-MM-DD
  deviceId?: string
): Promise<DeviceLocationPing[]> {
  try {
    // Construct local-time based ISO bounds for the given calendar date
    const startOfDay = new Date(`${dateStr}T00:00:00`);
    const endOfDay = new Date(`${dateStr}T23:59:59.999`);
    const startIso = isNaN(startOfDay.getTime()) ? `${dateStr}T00:00:00.000Z` : startOfDay.toISOString();
    const endIso = isNaN(endOfDay.getTime()) ? `${dateStr}T23:59:59.999Z` : endOfDay.toISOString();

    let query = supabase
      .from('device_location_pings')
      .select('*')
      .eq('user_id', userId)
      .gte('recorded_at', startIso)
      .lte('recorded_at', endIso)
      .order('recorded_at', { ascending: true })
      .limit(3000);

    if (deviceId) {
      query = query.eq('device_id', deviceId);
    }

    const { data, error } = await query;
    if (error) {
      console.warn('Error loading device pings for date:', error.message);
      return [];
    }
    return (data || []) as DeviceLocationPing[];
  } catch (err) {
    console.warn('Network error loading device pings:', err);
    return [];
  }
}

export async function loadAvailablePingDates(
  userId: string,
  limit = 30
): Promise<string[]> {
  const datesSet = new Set<string>();
  const todayStr = new Date().toISOString().slice(0, 10);
  datesSet.add(todayStr);

  try {
    // 1. Fetch available dates from daily_mobility_stats
    const { data: statRows } = await supabase
      .from('daily_mobility_stats')
      .select('stat_date')
      .eq('user_id', userId)
      .order('stat_date', { ascending: false })
      .limit(limit);

    if (statRows) {
      statRows.forEach((r: { stat_date: string }) => {
        if (r.stat_date) datesSet.add(r.stat_date);
      });
    }

    // 2. Fetch recent distinct ping recorded_at dates
    const { data: pingRows } = await supabase
      .from('device_location_pings')
      .select('recorded_at')
      .eq('user_id', userId)
      .order('recorded_at', { ascending: false })
      .limit(1000);

    if (pingRows) {
      pingRows.forEach((p: { recorded_at: string }) => {
        if (p.recorded_at) {
          try {
            const d = new Date(p.recorded_at);
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            datesSet.add(`${y}-${m}-${day}`);
          } catch {
            datesSet.add(p.recorded_at.slice(0, 10));
          }
        }
      });
    }
  } catch (err) {
    console.warn('Error loading available ping dates:', err);
  }

  // Sort dates descending (newest first)
  return Array.from(datesSet).sort((a, b) => b.localeCompare(a));
}

export function computeDailyStatsFromPings(
  pings: DeviceLocationPing[],
  statDate: string,
  userId: string,
  deviceId = getDeviceId()
): DailyMobilityStats {
  const stats: DailyMobilityStats = {
    user_id: userId,
    device_id: deviceId,
    stat_date: statDate,
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

  if (!pings || pings.length === 0) {
    return stats;
  }

  const sorted = [...pings].sort(
    (a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()
  );

  let totalDistKm = 0;
  let transitMins = 0;
  let walkKm = 0;
  let cycleKm = 0;
  let vehicleKm = 0;
  let maxSpeed = 0;
  let stopCount = 0;
  let dwellStartPing: DeviceLocationPing | null = null;

  for (let i = 0; i < sorted.length; i++) {
    const current = sorted[i];
    const speed = current.speed_kmh || 0;
    if (speed > maxSpeed) {
      maxSpeed = speed;
    }

    if (i === 0) continue;
    const prev = sorted[i - 1];

    const distKm = calculateDistanceKm(
      prev.latitude,
      prev.longitude,
      current.latitude,
      current.longitude
    );

    const prevTime = new Date(prev.recorded_at).getTime();
    const currTime = new Date(current.recorded_at).getTime();
    const deltaMins = Math.max(0, (currTime - prevTime) / (1000 * 60));

    if (deltaMins > 0 && deltaMins < 90) {
      const distFromDwell = dwellStartPing
        ? calculateDistanceMeters(
            dwellStartPing.latitude,
            dwellStartPing.longitude,
            current.latitude,
            current.longitude
          )
        : distKm * 1000;

      if (distFromDwell < 50) {
        if (!dwellStartPing) dwellStartPing = prev;
        const dwellDurationMins = (currTime - new Date(dwellStartPing.recorded_at).getTime()) / (1000 * 60);
        if (dwellDurationMins >= 4 && dwellDurationMins - deltaMins < 4) {
          stopCount += 1;
        }
      } else {
        dwellStartPing = null;
      }

      if (distKm > 0.02) {
        totalDistKm += distKm;
        transitMins += deltaMins;

        const mode = current.transport_mode || 'unknown';
        if (mode === 'walking' || (speed < 6.5 && mode !== 'vehicle')) {
          walkKm += distKm;
        } else {
          vehicleKm += distKm;
        }
      }
    }
  }

  // Estimated fuel / transit cost: ~ LKR 75 per vehicle km in Sri Lanka
  const estimatedCost = Math.round(vehicleKm * 75);

  stats.total_distance_km = Number(totalDistKm.toFixed(2));
  stats.transit_time_minutes = Math.round(transitMins);
  stats.walking_km = Number(walkKm.toFixed(2));
  stats.cycling_km = Number(cycleKm.toFixed(2));
  stats.vehicle_km = Number(vehicleKm.toFixed(2));
  stats.top_speed_kmh = Number(maxSpeed.toFixed(1));
  stats.active_stops_count = stopCount;
  stats.estimated_transit_cost = estimatedCost;

  return stats;
}

// ============================================================================
// Journey Telemetry & Three-Tier Pin Extraction
// ============================================================================

export interface JourneyTelemetryMetrics {
  journeyId?: string | null;
  startPing: DeviceLocationPing | null;
  endPing: DeviceLocationPing | null;
  inTravelPings: DeviceLocationPing[];
  travelTimeSeconds: number;
  totalDistanceKm: number;
  avgSpeedKmh: number;
  maxSpeedKmh: number;
  estimatedCost: number;
  primaryTransportMode: TransportMode;
}

export function computeJourneyTelemetry(pings: DeviceLocationPing[]): JourneyTelemetryMetrics | null {
  if (pings.length === 0) return null;

  const sorted = [...pings].sort(
    (a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()
  );

  // Identify Start Pin, End Pin, and any intermediate pins (if any)
  const startPing = sorted.find((p) => p.pin_type === 'start') || sorted[0];
  const endPing =
    [...sorted].reverse().find((p) => p.pin_type === 'end') || sorted[sorted.length - 1];

  const inTravelPings = sorted.filter((p) => p !== startPing && p !== endPing);

  // Calculate route distance:
  // When 10s intermediate route pings exist, sum sequential segment distances to accurately track the route path.
  // Otherwise, fall back to straight-line distance between Start Pin and End Pin.
  let totalDistanceKm = 0;
  if (sorted.length > 2) {
    for (let i = 0; i < sorted.length - 1; i++) {
      totalDistanceKm += calculateDistanceKm(
        sorted[i].latitude,
        sorted[i].longitude,
        sorted[i + 1].latitude,
        sorted[i + 1].longitude
      );
    }
  } else {
    totalDistanceKm = calculateDistanceKm(
      startPing.latitude,
      startPing.longitude,
      endPing.latitude,
      endPing.longitude
    );
  }

  // Travel time calculation (monotonic delta in seconds between start and end)
  const startMs = new Date(startPing.recorded_at).getTime();
  const endMs = new Date(endPing.recorded_at).getTime();
  const travelTimeSeconds = Math.max(1, Math.round((endMs - startMs) / 1000));

  // Average speed calculation (km / h) based on start and end point times:
  // Speed = Distance / Delta_T
  const hours = travelTimeSeconds / 3600;
  const avgSpeedKmh = hours > 0 ? Number((totalDistanceKm / hours).toFixed(1)) : 0;
  const maxSpeedKmh = avgSpeedKmh;

  // Derive mode from calculated speed (without stationary or cycling)
  let primaryTransportMode: TransportMode = 'vehicle';
  if (avgSpeedKmh < 8) {
    primaryTransportMode = 'walking';
  } else if (avgSpeedKmh >= 80) {
    primaryTransportMode = 'high_speed_transit';
  } else {
    primaryTransportMode = 'vehicle';
  }

  // Cost estimation: zero for pedestrian, $0.18/km default with $2.50 base
  const ratePerKm = primaryTransportMode === 'walking' ? 0 : 0.18;
  const estimatedCost = Number(
    Math.max(
      primaryTransportMode === 'walking' ? 0 : 2.5,
      totalDistanceKm * ratePerKm
    ).toFixed(2)
  );

  return {
    journeyId: startPing.journey_id || null,
    startPing,
    endPing,
    inTravelPings,
    travelTimeSeconds,
    totalDistanceKm: Number(totalDistanceKm.toFixed(2)),
    avgSpeedKmh,
    maxSpeedKmh: Number(maxSpeedKmh.toFixed(1)),
    estimatedCost,
    primaryTransportMode,
  };
}

// ============================================================================
// Journey Partitioning, Synthesis, and Ledger Persistence
// ============================================================================

export interface JourneySummaryItem {
  id: string;
  title: string;
  status: 'in_progress' | 'completed' | 'cancelled';
  startTime: string;
  endTime?: string | null;
  travelTimeSeconds: number;
  totalDistanceKm: number;
  avgSpeedKmh: number;
  maxSpeedKmh: number;
  estimatedCost: number;
  isCostLogged: boolean;
  loggedTransitCost?: number;
  primaryTransportMode: TransportMode;
  isBusinessTrip?: boolean;
  taxDeductionAmount?: number;
  relatedTransactionId?: string | null;
  startAddress?: string | null;
  endAddress?: string | null;
  startLatitude?: number | null;
  startLongitude?: number | null;
  endLatitude?: number | null;
  endLongitude?: number | null;
  notes?: string | null;
  deviceId?: string;
  deviceName?: string;
  pingsCount: number;
  startPing?: DeviceLocationPing | null;
  endPing?: DeviceLocationPing | null;
  inTravelPings?: DeviceLocationPing[];
}

export function journeySummaryToTelemetryMetrics(item: JourneySummaryItem): JourneyTelemetryMetrics {
  return {
    journeyId: item.id,
    startPing: item.startPing || null,
    endPing: item.endPing || null,
    inTravelPings: item.inTravelPings || [],
    travelTimeSeconds: item.travelTimeSeconds,
    totalDistanceKm: item.totalDistanceKm,
    avgSpeedKmh: item.avgSpeedKmh,
    maxSpeedKmh: item.maxSpeedKmh,
    estimatedCost: item.estimatedCost,
    primaryTransportMode: item.primaryTransportMode,
  };
}

export function partitionPingsIntoJourneys(
  pings: DeviceLocationPing[]
): Map<string, DeviceLocationPing[]> {
  const journeyMap = new Map<string, DeviceLocationPing[]>();
  if (pings.length === 0) return journeyMap;

  const sorted = [...pings].sort(
    (a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()
  );

  let currentSynthId: string | null = null;
  let lastPingTime: number | null = null;

  for (let i = 0; i < sorted.length; i++) {
    const p = sorted[i];
    const pingTime = new Date(p.recorded_at).getTime();

    if (p.journey_id) {
      const list = journeyMap.get(p.journey_id) || [];
      list.push(p);
      journeyMap.set(p.journey_id, list);
      currentSynthId = null;
    } else {
      // Begin a new journey on 'start' pin or significant time gap (>20 mins)
      const isStartPin = p.pin_type === 'start';
      const isTimeGap = lastPingTime !== null && pingTime - lastPingTime > 20 * 60 * 1000;

      if (!currentSynthId || isStartPin || isTimeGap) {
        currentSynthId = `session-${new Date(p.recorded_at).toISOString().slice(0, 16)}-${i}`;
      }

      const list = journeyMap.get(currentSynthId) || [];
      list.push(p);
      journeyMap.set(currentSynthId, list);

      if (p.pin_type === 'end') {
        currentSynthId = null;
      }
    }
    lastPingTime = pingTime;
  }

  return journeyMap;
}

export function synthesizeJourneysFromPingsAndRecords(
  mobilityJourneys: MobilityJourney[],
  pings: DeviceLocationPing[]
): JourneySummaryItem[] {
  const pingGroups = partitionPingsIntoJourneys(pings);
  const items: JourneySummaryItem[] = [];
  const processedJourneyIds = new Set<string>();

  // 1. Process database records from mobility_journeys
  for (const mj of mobilityJourneys) {
    processedJourneyIds.add(mj.id);
    const matchingPings = pingGroups.get(mj.id) || [];
    const telemetry = matchingPings.length > 0 ? computeJourneyTelemetry(matchingPings) : null;

    const totalDistance = telemetry
      ? telemetry.totalDistanceKm
      : Number(mj.total_distance_km || 0);

    const travelTimeSeconds = telemetry
      ? telemetry.travelTimeSeconds
      : mj.travel_time_seconds || 0;

    const avgSpeed = telemetry
      ? telemetry.avgSpeedKmh
      : Number(mj.avg_speed_kmh || 0);

    const maxSpeed = telemetry
      ? telemetry.maxSpeedKmh
      : Number(mj.max_speed_kmh || avgSpeed);

    const estimatedCost = telemetry
      ? telemetry.estimatedCost
      : Number(mj.estimated_cost || 0);

    const mode = telemetry?.primaryTransportMode || (mj.primary_transport_mode as TransportMode) || 'vehicle';

    items.push({
      id: mj.id,
      title: mj.title || 'Recorded Journey',
      status: mj.status || 'completed',
      startTime: mj.start_time,
      endTime: mj.end_time || (telemetry?.endPing ? telemetry.endPing.recorded_at : null),
      travelTimeSeconds,
      totalDistanceKm: Number(totalDistance.toFixed(2)),
      avgSpeedKmh: Number(avgSpeed.toFixed(1)),
      maxSpeedKmh: Number(maxSpeed.toFixed(1)),
      estimatedCost: Number(estimatedCost.toFixed(2)),
      isCostLogged: !!mj.is_cost_logged,
      loggedTransitCost: mj.logged_transit_cost ? Number(mj.logged_transit_cost) : undefined,
      primaryTransportMode: mode,
      isBusinessTrip: mj.is_business_trip,
      taxDeductionAmount: mj.tax_deduction_amount
        ? Number(mj.tax_deduction_amount)
        : Number((totalDistance * 0.67).toFixed(2)),
      relatedTransactionId: mj.related_transaction_id,
      startAddress: mj.start_address,
      endAddress: mj.end_address,
      startLatitude: telemetry?.startPing?.latitude ?? mj.start_latitude,
      startLongitude: telemetry?.startPing?.longitude ?? mj.start_longitude,
      endLatitude: telemetry?.endPing?.latitude ?? mj.end_latitude,
      endLongitude: telemetry?.endPing?.longitude ?? mj.end_longitude,
      notes: mj.notes,
      deviceId: mj.device_id,
      deviceName: mj.device_name,
      pingsCount: matchingPings.length,
      startPing: telemetry?.startPing || null,
      endPing: telemetry?.endPing || null,
      inTravelPings: telemetry?.inTravelPings || [],
    });
  }

  // 2. Process any ping clusters that don't have a record in mobility_journeys
  let synthCounter = 1;
  for (const [journeyId, groupPings] of pingGroups.entries()) {
    if (processedJourneyIds.has(journeyId)) continue;

    const telemetry = computeJourneyTelemetry(groupPings);
    if (!telemetry) continue;

    const lastPing = groupPings[groupPings.length - 1];
    const isOngoing =
      lastPing?.pin_type !== 'end' &&
      Date.now() - new Date(lastPing.recorded_at).getTime() < 10 * 60 * 1000;

    const startPing = telemetry.startPing;
    const endPing = telemetry.endPing;
    const firstPing = groupPings[0];

    items.push({
      id: journeyId,
      title: groupPings[0]?.pin_type === 'start' ? `Journey #${synthCounter}` : `Commute Session #${synthCounter}`,
      status: isOngoing ? 'in_progress' : 'completed',
      startTime: startPing?.recorded_at || firstPing.recorded_at,
      endTime: isOngoing ? null : endPing?.recorded_at || lastPing.recorded_at,
      travelTimeSeconds: telemetry.travelTimeSeconds,
      totalDistanceKm: telemetry.totalDistanceKm,
      avgSpeedKmh: telemetry.avgSpeedKmh,
      maxSpeedKmh: telemetry.maxSpeedKmh,
      estimatedCost: telemetry.estimatedCost,
      isCostLogged: false,
      primaryTransportMode: telemetry.primaryTransportMode,
      startLatitude: startPing?.latitude,
      startLongitude: startPing?.longitude,
      endLatitude: endPing?.latitude,
      endLongitude: endPing?.longitude,
      deviceId: firstPing.device_id,
      deviceName: firstPing.device_name,
      pingsCount: groupPings.length,
      startPing,
      endPing,
      inTravelPings: telemetry.inTravelPings,
      taxDeductionAmount: Number((telemetry.totalDistanceKm * 0.67).toFixed(2)),
    });
    synthCounter++;
  }

  // Sort descending by start time (newest journeys first)
  return items.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
}

export async function loadMobilityJourneys(
  userId: string,
  dateStr?: string,
  deviceId?: string
): Promise<MobilityJourney[]> {
  try {
    let query = supabase
      .from('mobility_journeys')
      .select('*')
      .eq('user_id', userId)
      .order('start_time', { ascending: false });

    if (dateStr) {
      const startOfDay = new Date(`${dateStr}T00:00:00`);
      const endOfDay = new Date(`${dateStr}T23:59:59.999`);
      const startIso = isNaN(startOfDay.getTime()) ? `${dateStr}T00:00:00.000Z` : startOfDay.toISOString();
      const endIso = isNaN(endOfDay.getTime()) ? `${dateStr}T23:59:59.999Z` : endOfDay.toISOString();

      query = query.gte('start_time', startIso).lte('start_time', endIso);
    }

    if (deviceId) {
      query = query.eq('device_id', deviceId);
    }

    const { data, error } = await query;
    if (error) {
      console.warn('Error loading mobility journeys:', error.message);
      return [];
    }
    return (data || []) as MobilityJourney[];
  } catch (err) {
    console.warn('Network error loading mobility journeys:', err);
    return [];
  }
}

export async function updateMobilityJourney(
  journeyId: string,
  updates: Partial<MobilityJourney>
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('mobility_journeys')
      .update(updates)
      .eq('id', journeyId);
    if (error) {
      console.warn('Error updating mobility journey:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Network error updating mobility journey:', err);
    return false;
  }
}

export async function deleteMobilityJourney(journeyId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('mobility_journeys')
      .delete()
      .eq('id', journeyId);
    if (error) {
      console.warn('Error deleting mobility journey:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Network error deleting mobility journey:', err);
    return false;
  }
}

export function subscribeToMobilityJourneys(
  userId: string,
  onUpdate: () => void
): () => void {
  const channel = supabase
    .channel(`mobility_journeys_realtime_${userId}_${Math.random()}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'mobility_journeys',
        filter: `user_id=eq.${userId}`,
      },
      () => {
        onUpdate();
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
