import { describe, it, expect } from 'vitest';
import {
  calculateDistanceMeters,
  calculateDistanceKm,
  MobilityClassifier,
  computeDailyStatsFromPings,
  computeJourneyTelemetry,
  partitionPingsIntoJourneys,
  synthesizeJourneysFromPingsAndRecords,
  journeySummaryToTelemetryMetrics,
} from './locationMobilityService';
import type { DeviceLocationPing, MobilityJourney } from '../types';

describe('Location & Mobility Calculations', () => {
  it('should calculate geodesic distance between two GPS coordinates correctly', () => {
    // New York (Empire State Building) to Times Square (~1 km)
    const lat1 = 40.748817;
    const lon1 = -73.985428;
    const lat2 = 40.758896;
    const lon2 = -73.985130;

    const meters = calculateDistanceMeters(lat1, lon1, lat2, lon2);
    const km = calculateDistanceKm(lat1, lon1, lat2, lon2);

    expect(meters).toBeGreaterThan(1000);
    expect(meters).toBeLessThan(1200);
    expect(km).toBeCloseTo(meters / 1000, 3);
  });

  it('should return 0 meters for identical coordinates', () => {
    const lat = 6.9271;
    const lon = 79.8612;
    expect(calculateDistanceMeters(lat, lon, lat, lon)).toBe(0);
  });

  it('should classify vehicle transit state when speed is 0', () => {
    const classifier = new MobilityClassifier();
    const state = classifier.evaluate(0);

    expect(state.mode).toBe('vehicle');
    expect(state.statusLabel).toContain('In Transit');
  });

  it('should classify vehicle mode when moving at driving speed', () => {
    const classifier = new MobilityClassifier();
    const state = classifier.evaluate(60);

    expect(state.mode).toBe('vehicle');
    expect(state.statusLabel).toContain('Vehicle');
  });

  it('should classify high speed transit when moving over 80 km/h', () => {
    const classifier = new MobilityClassifier();
    const state = classifier.evaluate(95);

    expect(state.mode).toBe('high_speed_transit');
    expect(state.statusLabel).toContain('High-Speed');
  });

  it('should compute daily mobility stats correctly from sequential pings', () => {
    // Pings along Colombo - Galle road (Western Province, Sri Lanka)
    const mockPings: DeviceLocationPing[] = [
      {
        id: 'p1',
        user_id: 'usr-1',
        device_id: 'dev-1',
        latitude: 6.9271,
        longitude: 79.8612,
        speed_kmh: 0,
        recorded_at: '2026-10-25T08:00:00.000Z',
      },
      {
        id: 'p2',
        user_id: 'usr-1',
        device_id: 'dev-1',
        latitude: 6.9000,
        longitude: 79.8550,
        speed_kmh: 35,
        transport_mode: 'vehicle',
        recorded_at: '2026-10-25T08:10:00.000Z',
      },
      {
        id: 'p3',
        user_id: 'usr-1',
        device_id: 'dev-1',
        latitude: 6.8700,
        longitude: 79.8600,
        speed_kmh: 40,
        transport_mode: 'vehicle',
        recorded_at: '2026-10-25T08:20:00.000Z',
      },
      {
        id: 'p4',
        user_id: 'usr-1',
        device_id: 'dev-1',
        latitude: 6.8680,
        longitude: 79.8605,
        speed_kmh: 3.5,
        transport_mode: 'walking',
        recorded_at: '2026-10-25T08:30:00.000Z',
      },
    ];

    const stats = computeDailyStatsFromPings(mockPings, '2026-10-25', 'usr-1', 'dev-1');

    expect(stats.user_id).toBe('usr-1');
    expect(stats.stat_date).toBe('2026-10-25');
    expect(stats.total_distance_km).toBeGreaterThan(5);
    expect(stats.vehicle_km).toBeGreaterThan(4);
    expect(stats.walking_km).toBeGreaterThan(0.1);
    expect(stats.top_speed_kmh).toBe(40);
    expect(stats.transit_time_minutes).toBe(30);
    expect(stats.estimated_transit_cost).toBeGreaterThan(0);
  });

  it('should compute journey telemetry strictly from Start Pin and End Pin with time-based speed', () => {
    const journeyPings: DeviceLocationPing[] = [
      {
        id: 'start-1',
        user_id: 'usr-1',
        device_id: 'dev-1',
        journey_id: 'jrn-123',
        pin_type: 'start',
        latitude: 6.9271,
        longitude: 79.8612,
        speed_kmh: 0,
        transport_mode: 'vehicle',
        recorded_at: '2026-10-25T09:00:00.000Z',
      },
      {
        id: 'end-1',
        user_id: 'usr-1',
        device_id: 'dev-1',
        journey_id: 'jrn-123',
        pin_type: 'end',
        latitude: 6.8700,
        longitude: 79.8600,
        speed_kmh: 0,
        transport_mode: 'vehicle',
        recorded_at: '2026-10-25T09:10:00.000Z',
      },
    ];

    const metrics = computeJourneyTelemetry(journeyPings);
    expect(metrics).not.toBeNull();
    if (!metrics) return;

    expect(metrics.journeyId).toBe('jrn-123');
    expect(metrics.startPing?.id).toBe('start-1');
    expect(metrics.endPing?.id).toBe('end-1');
    expect(metrics.inTravelPings.length).toBe(0);
    expect(metrics.travelTimeSeconds).toBe(600); // 10 minutes
    expect(metrics.totalDistanceKm).toBeGreaterThan(6);
    expect(metrics.avgSpeedKmh).toBeGreaterThan(35);
    expect(metrics.maxSpeedKmh).toBe(metrics.avgSpeedKmh);
    expect(metrics.estimatedCost).toBeGreaterThan(0);
    expect(metrics.primaryTransportMode).toBe('vehicle');
  });

  it('should compute journey telemetry with 10s intermediate waypoints tracking the route', () => {
    const journeyPings: DeviceLocationPing[] = [
      {
        id: 'start-1',
        user_id: 'usr-1',
        device_id: 'dev-1',
        journey_id: 'jrn-456',
        pin_type: 'start',
        latitude: 6.9271,
        longitude: 79.8612,
        speed_kmh: 0,
        transport_mode: 'vehicle',
        recorded_at: '2026-10-25T10:00:00.000Z',
      },
      {
        id: 'wp-10s-1',
        user_id: 'usr-1',
        device_id: 'dev-1',
        journey_id: 'jrn-456',
        pin_type: 'in_travel',
        latitude: 6.9100,
        longitude: 79.8580,
        speed_kmh: 36,
        transport_mode: 'vehicle',
        recorded_at: '2026-10-25T10:00:10.000Z',
      },
      {
        id: 'wp-10s-2',
        user_id: 'usr-1',
        device_id: 'dev-1',
        journey_id: 'jrn-456',
        pin_type: 'in_travel',
        latitude: 6.8900,
        longitude: 79.8560,
        speed_kmh: 38,
        transport_mode: 'vehicle',
        recorded_at: '2026-10-25T10:00:20.000Z',
      },
      {
        id: 'end-1',
        user_id: 'usr-1',
        device_id: 'dev-1',
        journey_id: 'jrn-456',
        pin_type: 'end',
        latitude: 6.8700,
        longitude: 79.8600,
        speed_kmh: 37,
        transport_mode: 'vehicle',
        recorded_at: '2026-10-25T10:00:30.000Z',
      },
    ];

    const metrics = computeJourneyTelemetry(journeyPings);
    expect(metrics).not.toBeNull();
    if (!metrics) return;

    expect(metrics.journeyId).toBe('jrn-456');
    expect(metrics.startPing?.id).toBe('start-1');
    expect(metrics.endPing?.id).toBe('end-1');
    expect(metrics.inTravelPings.length).toBe(2);
    expect(metrics.inTravelPings[0].id).toBe('wp-10s-1');
    expect(metrics.inTravelPings[1].id).toBe('wp-10s-2');
    expect(metrics.travelTimeSeconds).toBe(30);
    expect(metrics.totalDistanceKm).toBeGreaterThan(6);
    expect(metrics.estimatedCost).toBeGreaterThan(0);
  });

  it('should partition pings by journey_id and temporal clusters', () => {
    const testPings: DeviceLocationPing[] = [
      {
        id: 'p1',
        user_id: 'usr-1',
        device_id: 'dev-1',
        journey_id: 'jrn-alpha',
        pin_type: 'start',
        latitude: 6.9271,
        longitude: 79.8612,
        speed_kmh: 0,
        recorded_at: '2026-10-25T08:00:00.000Z',
      },
      {
        id: 'p2',
        user_id: 'usr-1',
        device_id: 'dev-1',
        journey_id: 'jrn-alpha',
        pin_type: 'end',
        latitude: 6.9000,
        longitude: 79.8550,
        speed_kmh: 30,
        recorded_at: '2026-10-25T08:15:00.000Z',
      },
      {
        id: 'p3',
        user_id: 'usr-1',
        device_id: 'dev-1',
        journey_id: 'jrn-beta',
        pin_type: 'start',
        latitude: 6.9000,
        longitude: 79.8550,
        speed_kmh: 0,
        recorded_at: '2026-10-25T14:00:00.000Z',
      },
      {
        id: 'p4',
        user_id: 'usr-1',
        device_id: 'dev-1',
        journey_id: 'jrn-beta',
        pin_type: 'end',
        latitude: 6.9271,
        longitude: 79.8612,
        speed_kmh: 35,
        recorded_at: '2026-10-25T14:20:00.000Z',
      },
    ];

    const partitioned = partitionPingsIntoJourneys(testPings);
    expect(partitioned.size).toBe(2);
    expect(partitioned.has('jrn-alpha')).toBe(true);
    expect(partitioned.has('jrn-beta')).toBe(true);
    expect(partitioned.get('jrn-alpha')?.length).toBe(2);
    expect(partitioned.get('jrn-beta')?.length).toBe(2);
  });

  it('should synthesize journey summary items merging database records and telemetry', () => {
    const mockDbJourneys: MobilityJourney[] = [
      {
        id: 'jrn-alpha',
        user_id: 'usr-1',
        device_id: 'dev-1',
        title: 'Morning Office Commute',
        status: 'completed',
        start_time: '2026-10-25T08:00:00.000Z',
        end_time: '2026-10-25T08:15:00.000Z',
        start_latitude: 6.9271,
        start_longitude: 79.8612,
        end_latitude: 6.9000,
        end_longitude: 79.8550,
        total_distance_km: 3.2,
        travel_time_seconds: 900,
        avg_speed_kmh: 12.8,
        max_speed_kmh: 30,
        estimated_cost: 2.50,
        is_cost_logged: true,
        logged_transit_cost: 2.50,
        primary_transport_mode: 'vehicle',
        is_business_trip: true,
        tax_deduction_amount: 2.14,
      },
    ];

    const mockPings: DeviceLocationPing[] = [
      {
        id: 'p1',
        user_id: 'usr-1',
        device_id: 'dev-1',
        journey_id: 'jrn-alpha',
        pin_type: 'start',
        latitude: 6.9271,
        longitude: 79.8612,
        speed_kmh: 0,
        recorded_at: '2026-10-25T08:00:00.000Z',
      },
      {
        id: 'p2',
        user_id: 'usr-1',
        device_id: 'dev-1',
        journey_id: 'jrn-alpha',
        pin_type: 'end',
        latitude: 6.9000,
        longitude: 79.8550,
        speed_kmh: 30,
        recorded_at: '2026-10-25T08:15:00.000Z',
      },
      {
        id: 'p-standalone-1',
        user_id: 'usr-1',
        device_id: 'dev-1',
        journey_id: 'jrn-gamma',
        pin_type: 'start',
        latitude: 6.8500,
        longitude: 79.8600,
        speed_kmh: 0,
        recorded_at: '2026-10-25T18:00:00.000Z',
      },
      {
        id: 'p-standalone-2',
        user_id: 'usr-1',
        device_id: 'dev-1',
        journey_id: 'jrn-gamma',
        pin_type: 'end',
        latitude: 6.8000,
        longitude: 79.8700,
        speed_kmh: 40,
        recorded_at: '2026-10-25T18:15:00.000Z',
      },
    ];

    const items = synthesizeJourneysFromPingsAndRecords(mockDbJourneys, mockPings);
    expect(items.length).toBe(2);

    const alphaItem = items.find((i) => i.id === 'jrn-alpha');
    expect(alphaItem).toBeDefined();
    expect(alphaItem?.title).toBe('Morning Office Commute');
    expect(alphaItem?.isCostLogged).toBe(true);
    expect(alphaItem?.isBusinessTrip).toBe(true);
    expect(alphaItem?.pingsCount).toBe(2);

    const gammaItem = items.find((i) => i.id === 'jrn-gamma');
    expect(gammaItem).toBeDefined();
    expect(gammaItem?.totalDistanceKm).toBeGreaterThan(5);
    expect(gammaItem?.isCostLogged).toBe(false);

    // Test conversion to telemetry metrics
    if (alphaItem) {
      const telemetry = journeySummaryToTelemetryMetrics(alphaItem);
      expect(telemetry.journeyId).toBe('jrn-alpha');
      expect(telemetry.startPing?.id).toBe('p1');
      expect(telemetry.endPing?.id).toBe('p2');
    }
  });
});
