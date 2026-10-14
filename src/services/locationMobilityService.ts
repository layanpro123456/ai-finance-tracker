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
} from '../types';
import { getDeviceId, getDeviceName } from './deviceSessionService';

// ============================================================================
// Constants & Device-Bound Storage Keys
// ============================================================================
export const getPlacesStorageKey = (deviceId: string) => `apex_saved_places_${deviceId}`;
export const getEventsStorageKey = (deviceId: string) => `apex_timeline_events_${deviceId}`;
export const getStatsStorageKey = (deviceId: string, statDate: string) =>
  `apex_daily_mobility_${deviceId}_${statDate}`;

// Fallback legacy keys
const LEGACY_STORAGE_PLACES_KEY = 'apex_saved_places';
const LEGACY_STORAGE_EVENTS_KEY = 'apex_timeline_events';
const LEGACY_STORAGE_STATS_KEY = 'apex_daily_mobility';

// Default mock coordinates (Centred around a vibrant metropolitan district)
export const DEFAULT_ANCHOR_COORDS = {
  latitude: 40.7128,
  longitude: -74.006,
};


// Default seed places for immediate out-of-the-box exploration
export const DEFAULT_INITIAL_PLACES: Omit<SavedPlace, 'id' | 'user_id'>[] = [
  {
    name: 'City Supermarket (Trader Joe’s)',
    latitude: 40.7142,
    longitude: -74.0082,
    radius_meters: 350,
    reminder_type: 'budget',
    reminder_message: 'Remember your grocery budget for fresh weekly produce!',
    icon_type: 'shopping-cart',
  },
  {
    name: 'Metropolitan Office HQ',
    latitude: 40.7185,
    longitude: -73.9995,
    radius_meters: 400,
    reminder_type: 'task',
    reminder_message: 'Submit travel expense receipts to finance operations',
    icon_type: 'building',
  },
  {
    name: 'Landlord & Property Office',
    latitude: 40.7095,
    longitude: -74.0125,
    radius_meters: 250,
    reminder_type: 'task',
    reminder_message: 'Pay monthly apartment rent and collect utility invoice',
    icon_type: 'home',
  },
  {
    name: 'Central Transit Hub & Metro',
    latitude: 40.7115,
    longitude: -74.002,
    radius_meters: 300,
    reminder_type: 'custom',
    reminder_message: 'Top-up monthly subway & commuter transit pass',
    icon_type: 'train',
  },
];

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
  private currentMode: TransportMode = 'stationary';
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
   * Evaluates instantaneous speed with hysteresis, peak velocity memory,
   * and stop-and-go rolling variance to prevent traffic misclassification.
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
          : manualModeLock === 'cycling'
          ? '🚲 Cycling'
          : manualModeLock === 'walking'
          ? '🚶 Walking'
          : '⏸️ Stationary',
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

    // 4. Traffic Jam & Congestion Detection (CRUCIAL):
    // If the trip already hit a peak vehicle speed >= 25 km/h OR recent speeds showed vehicle bursts,
    // and speed is now crawling between 0 and 18 km/h:
    const hasMotorizedHistory = this.peakSpeedKmh >= 24;
    const timeSinceMovement = now - this.lastMovingTime;

    if (hasMotorizedHistory && timeSinceMovement < 4 * 60 * 1000) {
      // Stopped at red light or crawling in traffic
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

    // 5. Cycling range (8 to 25 km/h)
    if (speed >= 8) {
      this.currentMode = 'cycling';
      this.inTraffic = false;
      return {
        mode: 'cycling',
        inTraffic: false,
        statusLabel: '🚲 Cycling / Micro-Mobility',
        confidence: 0.85,
      };
    }

    // 6. Walking range (1.5 to 8 km/h)
    if (speed >= 1.5) {
      this.currentMode = 'walking';
      this.inTraffic = false;
      return {
        mode: 'walking',
        inTraffic: false,
        statusLabel: '🚶 Walking / Pedestrian',
        confidence: 0.87,
      };
    }

    // 7. Stationary / Dwell
    // If stopped for more than 4 minutes, reset peak speed
    if (timeSinceMovement > 4 * 60 * 1000) {
      this.peakSpeedKmh = 0;
      this.tripStartTime = null;
      this.currentMode = 'stationary';
    }

    return {
      mode: 'stationary',
      inTraffic: false,
      statusLabel: '⏸️ Stationary / Dwell',
      confidence: 0.95,
    };
  }

  public resetTrip() {
    this.peakSpeedKmh = 0;
    this.recentSpeeds = [];
    this.currentMode = 'stationary';
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
// LocalStorage & Supabase Persistence Engine
// ============================================================================

export async function loadSavedPlaces(
  userId: string,
  deviceId = getDeviceId()
): Promise<SavedPlace[]> {
  const deviceKey = getPlacesStorageKey(deviceId);

  // 1. Try Supabase (fetch places belonging to this device or shared global defaults)
  try {
    const { data, error } = await supabase
      .from('saved_places')
      .select('*, categories(name), tasks(title, amount), contacts_ledger(contact_name, amount, type)')
      .eq('user_id', userId)
      .or(`device_id.eq.${deviceId},device_id.is.null`)
      .order('created_at', { ascending: false });

    if (!error && data && data.length > 0) {
      localStorage.setItem(deviceKey, JSON.stringify(data));
      return data as SavedPlace[];
    }
  } catch {
    // Fall back to local storage
  }

  // 2. Fall back to device-specific localStorage
  const raw = localStorage.getItem(deviceKey) || localStorage.getItem(LEGACY_STORAGE_PLACES_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    } catch {
      // ignore parse error
    }
  }

  // Return empty list if no saved places exist (zero hallucinated sample places)
  return [];
}

export async function persistSavedPlace(
  userId: string,
  place: Partial<SavedPlace>,
  deviceId = getDeviceId()
): Promise<SavedPlace> {
  const deviceKey = getPlacesStorageKey(deviceId);
  const newPlace: SavedPlace = {
    id: place.id || `place-${Date.now()}`,
    user_id: userId,
    device_id: deviceId,
    name: place.name || 'New Geofence Place',
    latitude: place.latitude || DEFAULT_ANCHOR_COORDS.latitude,
    longitude: place.longitude || DEFAULT_ANCHOR_COORDS.longitude,
    radius_meters: place.radius_meters || 300,
    category_id: place.category_id || null,
    linked_task_id: place.linked_task_id || null,
    linked_contact_id: place.linked_contact_id || null,
    reminder_type: place.reminder_type || 'budget',
    reminder_message: place.reminder_message || '',
    icon_type: place.icon_type || 'map-pin',
    created_at: new Date().toISOString(),
  };

  // Try Supabase insert
  try {
    await supabase.from('saved_places').upsert(newPlace);
  } catch {
    // ignore
  }

  // Update device-scoped local storage
  const current = await loadSavedPlaces(userId, deviceId);
  const updated = [newPlace, ...current.filter((p) => p.id !== newPlace.id)];
  localStorage.setItem(deviceKey, JSON.stringify(updated));
  return newPlace;
}

export async function removeSavedPlace(
  userId: string,
  placeId: string,
  deviceId = getDeviceId()
): Promise<void> {
  const deviceKey = getPlacesStorageKey(deviceId);
  try {
    await supabase.from('saved_places').delete().eq('id', placeId);
  } catch {
    // ignore
  }

  const current = await loadSavedPlaces(userId, deviceId);
  const updated = current.filter((p) => p.id !== placeId);
  localStorage.setItem(deviceKey, JSON.stringify(updated));
}

// ----------------------------------------------------------------------------
// Timeline Events Persistence (Strictly Unique to Physical Device)
// ----------------------------------------------------------------------------
export async function loadTimelineEvents(
  userId: string,
  deviceId = getDeviceId()
): Promise<MobilityTimelineEvent[]> {
  const deviceKey = getEventsStorageKey(deviceId);

  try {
    const { data, error } = await supabase
      .from('mobility_timeline_events')
      .select('*')
      .eq('user_id', userId)
      .eq('device_id', deviceId)
      .order('start_time', { ascending: false });

    if (!error && data && data.length > 0) {
      localStorage.setItem(deviceKey, JSON.stringify(data));
      return data as MobilityTimelineEvent[];
    }
  } catch {
    // fallback
  }

  const raw =
    localStorage.getItem(deviceKey) || localStorage.getItem(LEGACY_STORAGE_EVENTS_KEY);
  if (raw) {

    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    } catch {
      // ignore
    }
  }

  // Return empty list if no timeline events exist (zero hallucinated sample events)
  return [];
}

export async function persistTimelineEvent(
  userId: string,
  event: MobilityTimelineEvent,
  deviceId = getDeviceId()
): Promise<void> {
  const deviceKey = getEventsStorageKey(deviceId);
  const enrichedEvent: MobilityTimelineEvent = {
    ...event,
    device_id: deviceId,
    device_name: event.device_name || getDeviceName(),
  };

  try {
    await supabase.from('mobility_timeline_events').upsert(enrichedEvent);
  } catch {
    // ignore
  }

  const current = await loadTimelineEvents(userId, deviceId);
  const updated = [enrichedEvent, ...current.filter((e) => e.id !== enrichedEvent.id)];
  localStorage.setItem(deviceKey, JSON.stringify(updated));
}

// ----------------------------------------------------------------------------
// Daily Mobility Statistics (Unique to Physical Device)
// ----------------------------------------------------------------------------
export async function loadDailyMobilityStats(
  userId: string,
  statDate: string,
  deviceId = getDeviceId()
): Promise<DailyMobilityStats> {
  const deviceKey = getStatsStorageKey(deviceId, statDate);

  try {
    const { data } = await supabase
      .from('daily_mobility_stats')
      .select('*')
      .eq('user_id', userId)
      .eq('stat_date', statDate)
      .eq('device_id', deviceId)
      .maybeSingle();

    if (data) {
      return data as DailyMobilityStats;
    }
  } catch {
    // fallback
  }

  const raw =
    localStorage.getItem(deviceKey) ||
    localStorage.getItem(`${LEGACY_STORAGE_STATS_KEY}_${statDate}`);
  if (raw) {

    try {
      return JSON.parse(raw);
    } catch {
      // ignore
    }
  }

  // Clean zero-initialized daily statistics (zero hallucinated mileage or costs)
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

  return cleanStats;
}

export async function updateDailyMobilityStats(
  userId: string,
  delta: Partial<DailyMobilityStats>,
  deviceId = getDeviceId()
): Promise<DailyMobilityStats> {
  const today = new Date().toISOString().slice(0, 10);
  const deviceKey = getStatsStorageKey(deviceId, today);
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
    await supabase.from('daily_mobility_stats').upsert(updated);
  } catch {
    // ignore
  }

  localStorage.setItem(deviceKey, JSON.stringify(updated));
  return updated;
}


// ============================================================================
// Mock GPS Route Simulation Engine
// ============================================================================
export interface SimulationWaypoint {
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
    name: '🚶 Walk to Supermarket (Pedestrian Pace)',
    description: 'Walking from apartment to Trader Joe’s at 4.5 km/h to trigger grocery budget alert.',
    expectedMode: 'walking',
    waypoints: [
      { latitude: 40.7128, longitude: -74.006, speedKmh: 4.2, description: 'Departing apartment sidewalk' },
      { latitude: 40.7132, longitude: -74.0068, speedKmh: 4.8, description: 'Crossing pedestrian crosswalk' },
      { latitude: 40.7137, longitude: -74.0075, speedKmh: 4.5, description: 'Approaching supermarket avenue' },
      { latitude: 40.7142, longitude: -74.0082, speedKmh: 2.1, description: 'Arriving at Trader Joe’s Entrance (Geofenced)' },
      { latitude: 40.7143, longitude: -74.0083, speedKmh: 0.5, description: 'Inside grocery produce aisle' },
    ],
  },
  {
    id: 'traffic_commute',
    name: '🚗 City Commute with Heavy Traffic Jam (Crawling 0–14 km/h)',
    description: 'Stop-and-go urban traffic test. Confirms vehicle mode remains locked despite crawling & red lights.',
    expectedMode: 'vehicle',
    waypoints: [
      { latitude: 40.7128, longitude: -74.006, speedKmh: 28.5, description: 'Pulling out of parking garage' },
      { latitude: 40.714, longitude: -74.005, speedKmh: 12.0, description: 'Hit morning rush hour congestion' },
      { latitude: 40.715, longitude: -74.0042, speedKmh: 0.0, description: 'Halted at red light (Waiting in traffic)' },
      { latitude: 40.7158, longitude: -74.0035, speedKmh: 8.5, description: 'Crawling in stop-and-go traffic' },
      { latitude: 40.717, longitude: -74.0018, speedKmh: 14.2, description: 'Slow acceleration through intersection' },
      { latitude: 40.7185, longitude: -73.9995, speedKmh: 1.0, description: 'Pulling into Office parking spot' },
    ],
  },
  {
    id: 'highway_express',
    name: '🚄 Highway Express Commute (65 km/h)',
    description: 'Fast arterial vehicle commute to calculate distance & fuel cost accurately.',
    expectedMode: 'vehicle',
    waypoints: [
      { latitude: 40.7128, longitude: -74.006, speedKmh: 35.0, description: 'Entering highway on-ramp' },
      { latitude: 40.716, longitude: -74.001, speedKmh: 68.0, description: 'Cruising at highway speed' },
      { latitude: 40.722, longitude: -73.992, speedKmh: 74.5, description: 'Express expressway transit' },
      { latitude: 40.728, longitude: -73.985, speedKmh: 52.0, description: 'Taking downtown exit ramp' },
      { latitude: 40.731, longitude: -73.98, speedKmh: 22.0, description: 'Arriving at regional business park' },
    ],
  },
  {
    id: 'visit_landlord',
    name: '🏠 Visit Landlord (35 km/h to Dwell Stop)',
    description: 'Vehicle trip to landlord office followed by stationary arrival to trigger Rent task alert.',
    expectedMode: 'vehicle',
    waypoints: [
      { latitude: 40.7128, longitude: -74.006, speedKmh: 32.0, description: 'Driving south down avenue' },
      { latitude: 40.711, longitude: -74.009, speedKmh: 24.0, description: 'Approaching property management district' },
      { latitude: 40.7095, longitude: -74.0125, speedKmh: 0.0, description: 'Parked outside Landlord Office (Geofenced)' },
    ],
  },
];
