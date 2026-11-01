import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import type { DeviceLocationPing } from '../types';
import {
  computeJourneyTelemetry,
  calculateDistanceKm,
  type JourneyTelemetryMetrics,
} from '../services/locationMobilityService';
import {
  Play,
  Pause,
  RotateCcw,
  Compass,
  Battery,
  BatteryCharging,
  Gauge,
  Clock,
  MapPin,
  Car,
  Footprints,
  Maximize2,
  Layers,
  Zap,
  CheckCircle2,
  ArrowRight,
  Edit,
  Eye,
  X,
} from 'lucide-react';

export type BasemapTheme = 'dark' | 'esri' | 'osm' | 'vector';

export interface SriLankaMobilityMapProps {
  pings: DeviceLocationPing[];
  selectedDate: string; // YYYY-MM-DD
  isLoading?: boolean;
  currencySymbol?: string;
  onStraightAwaySubmit?: (metrics: JourneyTelemetryMetrics) => void;
  onEditAndSubmit?: (metrics: JourneyTelemetryMetrics) => void;
  isCostLogged?: boolean;
  selectedJourneyId?: string | null;
  onSelectJourney?: (journeyId: string | null) => void;
}

// Sri Lanka Geography Constants
const SRI_LANKA_CENTER = { lat: 7.8731, lng: 80.7718 };
const SRI_LANKA_BOUNDS = {
  minLat: 5.85,
  maxLat: 9.95,
  minLng: 79.5,
  maxLng: 81.95,
};

// Key Sri Lankan urban anchors for landmark guidance
const SRI_LANKA_LANDMARKS = [
  { name: 'Colombo', lat: 6.9271, lng: 79.8612, isMajor: true },
  { name: 'Kandy', lat: 7.2906, lng: 80.6337, isMajor: true },
  { name: 'Galle', lat: 6.0535, lng: 80.2210, isMajor: true },
  { name: 'Jaffna', lat: 9.6615, lng: 80.0255, isMajor: true },
  { name: 'Negombo', lat: 7.2008, lng: 79.8736, isMajor: false },
  { name: 'Kalutara', lat: 6.5854, lng: 79.9607, isMajor: false },
  { name: 'Matara', lat: 5.9549, lng: 80.5550, isMajor: false },
  { name: 'Anuradhapura', lat: 8.3114, lng: 80.4037, isMajor: true },
  { name: 'Trincomalee', lat: 8.5874, lng: 81.2152, isMajor: true },
  { name: 'Batticaloa', lat: 7.7170, lng: 81.7000, isMajor: false },
  { name: 'Badulla', lat: 6.9934, lng: 81.0550, isMajor: false },
];

export const SriLankaMobilityMap: React.FC<SriLankaMobilityMapProps> = ({
  pings,
  selectedDate,
  isLoading = false,
  currencySymbol = '$',
  onStraightAwaySubmit,
  onEditAndSubmit,
  isCostLogged = false,
  selectedJourneyId,
  onSelectJourney,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const activeTileLayersRef = useRef<any[]>([]);
  const routeLayerGroupRef = useRef<any>(null);
  const scrubberMarkerRef = useRef<any>(null);

  // Basemap & view modes
  const [leafletLoaded, setLeafletLoaded] = useState<boolean>(() => typeof (window as any).L !== 'undefined');
  const [basemapTheme, setBasemapTheme] = useState<BasemapTheme>('dark');

  // Scrubber & playback states
  const [scrubIndex, setScrubIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1); // 1x, 2x, 5x, 10x

  // Sort pings chronologically
  const sortedPings = useMemo(() => {
    return [...pings].sort(
      (a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()
    );
  }, [pings]);

  // If a specific journey is focused, filter pings to that journey
  const displayedPings = useMemo(() => {
    if (!selectedJourneyId) return sortedPings;
    const filtered = sortedPings.filter((p) => p.journey_id === selectedJourneyId);
    return filtered.length > 0 ? filtered : sortedPings;
  }, [sortedPings, selectedJourneyId]);

  // Derive Journey Telemetry Metrics (Start Pin, In-Travel Pins, End Pin, Time, Avg Speed, Cost)
  const journeyMetrics = useMemo(() => {
    return computeJourneyTelemetry(displayedPings);
  }, [displayedPings]);

  // Reset scrubber when date changes or pings change
  useEffect(() => {
    setIsPlaying(false);
    setScrubIndex(displayedPings.length > 0 ? displayedPings.length - 1 : 0);
  }, [selectedDate, displayedPings.length, selectedJourneyId]);

  // Current active scrubbed ping
  const activePing = displayedPings[scrubIndex] || displayedPings[displayedPings.length - 1] || null;

  // 1. Dynamic Leaflet script & css loader
  useEffect(() => {
    if (typeof (window as any).L !== 'undefined') {
      setLeafletLoaded(true);
      return;
    }

    let isMounted = true;

    // Load Leaflet CSS
    const existingCss = document.getElementById('leaflet-css');
    if (!existingCss) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      link.crossOrigin = '';
      document.head.appendChild(link);
    }

    // Load Leaflet JS
    const existingScript = document.getElementById('leaflet-js');
    if (!existingScript) {
      const script = document.createElement('script');
      script.id = 'leaflet-js';
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.crossOrigin = '';
      script.async = true;

      script.onload = () => {
        if (isMounted) setLeafletLoaded(true);
      };
      script.onerror = () => {
        if (isMounted) {
          console.warn('Leaflet CDN load failed; switching to SVG Vector fallback mode.');
          setBasemapTheme('vector');
        }
      };
      document.body.appendChild(script);
    } else {
      const checkInterval = setInterval(() => {
        if (typeof (window as any).L !== 'undefined') {
          if (isMounted) setLeafletLoaded(true);
          clearInterval(checkInterval);
        }
      }, 100);
      return () => clearInterval(checkInterval);
    }

    return () => {
      isMounted = false;
    };
  }, []);

  // Update Tile Layers without destroying map
  const updateTileLayers = useCallback((map: any, theme: BasemapTheme) => {
    const L = (window as any).L;
    if (!L || !map || theme === 'vector') return;

    // Remove previous tile layers
    activeTileLayersRef.current.forEach((layer) => {
      try {
        map.removeLayer(layer);
      } catch {
        // ignore
      }
    });
    activeTileLayersRef.current = [];

    const layersToAdd: any[] = [];

    if (theme === 'dark') {
      // Zero-key OpenStreetMap with targeted dark-mode CSS filter (permanent, free, street-level detail up to zoom 19)
      const osmDark = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
        className: 'dark-map-tiles',
      });
      layersToAdd.push(osmDark);
    } else if (theme === 'esri') {
      // Esri World Dark Gray Canvas (Base + Labels overlay) - Free public endpoint
      const esriBase = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
        {
          attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ',
          maxZoom: 16,
        }
      );
      const esriLabels = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
        {
          maxZoom: 16,
        }
      );
      layersToAdd.push(esriBase, esriLabels);
    } else if (theme === 'osm') {
      // Standard daylight OpenStreetMap
      const osmStandard = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      });
      layersToAdd.push(osmStandard);
    }

    layersToAdd.forEach((layer) => {
      layer.addTo(map);
      if (layer.bringToBack) {
        layer.bringToBack();
      }
    });

    activeTileLayersRef.current = layersToAdd;
  }, []);

  // 2. Initialize Leaflet Map Instance
  useEffect(() => {
    if (!leafletLoaded || basemapTheme === 'vector' || !mapContainerRef.current) return;

    const L = (window as any).L;
    if (!L) return;

    if (!mapInstanceRef.current) {
      try {
        const map = L.map(mapContainerRef.current, {
          center: [SRI_LANKA_CENTER.lat, SRI_LANKA_CENTER.lng],
          zoom: 8,
          minZoom: 6,
          maxZoom: 19,
          zoomControl: false,
        });

        updateTileLayers(map, basemapTheme);

        L.control.zoom({ position: 'bottomright' }).addTo(map);

        const routeGroup = L.layerGroup().addTo(map);
        routeLayerGroupRef.current = routeGroup;
        mapInstanceRef.current = map;
      } catch (err) {
        console.warn('Leaflet init error:', err);
        setBasemapTheme('vector');
      }
    }
  }, [leafletLoaded, basemapTheme, updateTileLayers]);

  // Handle Basemap Theme Swapping on existing map
  useEffect(() => {
    if (mapInstanceRef.current && basemapTheme !== 'vector') {
      updateTileLayers(mapInstanceRef.current, basemapTheme);
    }
  }, [basemapTheme, updateTileLayers]);

  // 3. Update Polylines, Markers, and Bounds on Map
  useEffect(() => {
    if (basemapTheme === 'vector' || !mapInstanceRef.current || !routeLayerGroupRef.current) return;
    const L = (window as any).L;
    if (!L) return;

    const routeGroup = routeLayerGroupRef.current;
    routeGroup.clearLayers();
    scrubberMarkerRef.current = null;

    if (displayedPings.length === 0) {
      mapInstanceRef.current.setView([SRI_LANKA_CENTER.lat, SRI_LANKA_CENTER.lng], 8);
      return;
    }

    const latLngs = displayedPings.map((p) => [p.latitude, p.longitude] as [number, number]);

    // Draw route segments color-coded by transport mode
    for (let i = 0; i < displayedPings.length - 1; i++) {
      const p1 = displayedPings[i];
      const p2 = displayedPings[i + 1];

      let color = '#3b82f6'; // vehicle default
      const mode = p2.transport_mode || 'vehicle';
      if (mode === 'walking') {
        color = '#10b981'; // emerald
      } else if (mode === 'high_speed_transit') {
        color = '#a855f7'; // purple
      }

      L.polyline([[p1.latitude, p1.longitude], [p2.latitude, p2.longitude]], {
        color,
        weight: 4,
        opacity: 0.85,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(routeGroup);
    }

    // 1. Identify Start, In-Travel (10s Waypoints), and End Pins
    const startPing = displayedPings.find((p) => p.pin_type === 'start') || displayedPings[0];
    const endPing =
      [...displayedPings].reverse().find((p) => p.pin_type === 'end') ||
      displayedPings[displayedPings.length - 1];
    const inTravelPings = displayedPings.filter((p) => p !== startPing && p !== endPing);

    // 2. Add Start Point Marker (Emerald Pulsing Beacon)
    const startIcon = L.divIcon({
      className: 'start-marker-icon',
      html: `
        <div class="relative flex items-center justify-center cursor-pointer group">
          <span class="absolute inline-flex h-7 w-7 animate-ping rounded-full bg-emerald-400 opacity-60"></span>
          <span class="relative inline-flex h-6 w-6 rounded-full bg-emerald-500 border-2 border-white shadow-xl items-center justify-center text-[10px] font-black text-white">S</span>
        </div>
      `,
      iconSize: [26, 26],
      iconAnchor: [13, 13],
    });

    L.marker([startPing.latitude, startPing.longitude], { icon: startIcon })
      .addTo(routeGroup)
      .bindPopup(
        `<div class="p-1.5 text-slate-900 font-sans text-xs">
          <b class="text-emerald-700 text-sm">🟢 Departure Point (Start Pin)</b><br/>
          Time: <b>${new Date(startPing.recorded_at).toLocaleTimeString()}</b><br/>
          Lat: ${startPing.latitude.toFixed(4)}, Lng: ${startPing.longitude.toFixed(4)}<br/>
          ${startPing.battery_level ? `Battery: ${Math.round(startPing.battery_level)}%` : ''}
        </div>`
      );

    // 3. Add 10s Intermediate Route Waypoint Markers
    inTravelPings.forEach((p, idx) => {
      const waypointIcon = L.divIcon({
        className: 'intermediate-waypoint-icon',
        html: `
          <div class="relative flex items-center justify-center cursor-pointer group">
            <span class="inline-flex h-3.5 w-3.5 rounded-full bg-sky-400 border-2 border-slate-900 shadow-md ring-2 ring-sky-500/50"></span>
          </div>
        `,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });

      L.marker([p.latitude, p.longitude], { icon: waypointIcon })
        .addTo(routeGroup)
        .bindPopup(
          `<div class="p-1.5 text-slate-900 font-sans text-xs">
            <b class="text-sky-700 font-bold">⏱️ 10s Route Waypoint #${idx + 1}</b><br/>
            Time: <b>${new Date(p.recorded_at).toLocaleTimeString()}</b><br/>
            ${p.speed_kmh ? `Calculated Speed: <b>${p.speed_kmh.toFixed(1)} km/h</b><br/>` : ''}
            Coords: ${p.latitude.toFixed(4)}, ${p.longitude.toFixed(4)}<br/>
            ${p.battery_level ? `Battery: ${Math.round(p.battery_level)}%` : ''}
          </div>`
        );
    });

    // 4. Add End Point Marker (Crimson / Checkered Flag)
    const endIcon = L.divIcon({
      className: 'end-marker-icon',
      html: `
        <div class="relative flex items-center justify-center cursor-pointer">
          <span class="relative inline-flex h-6 w-6 rounded-full bg-rose-600 border-2 border-white shadow-xl items-center justify-center text-[11px] font-black text-white">🏁</span>
        </div>
      `,
      iconSize: [26, 26],
      iconAnchor: [13, 13],
    });

    const startMs = new Date(startPing.recorded_at).getTime();
    const endMs = new Date(endPing.recorded_at).getTime();
    const travelDurationSec = Math.max(1, Math.round((endMs - startMs) / 1000));
    const travelDurationMins = Math.max(1, Math.round(travelDurationSec / 60));

    let tripDistKm = 0;
    if (displayedPings.length > 2) {
      for (let i = 0; i < displayedPings.length - 1; i++) {
        tripDistKm += calculateDistanceKm(
          displayedPings[i].latitude,
          displayedPings[i].longitude,
          displayedPings[i + 1].latitude,
          displayedPings[i + 1].longitude
        );
      }
    } else {
      tripDistKm = calculateDistanceKm(
        startPing.latitude,
        startPing.longitude,
        endPing.latitude,
        endPing.longitude
      );
    }
    const calculatedSpeed = travelDurationSec > 0 ? (tripDistKm / (travelDurationSec / 3600)).toFixed(1) : '0.0';

    L.marker([endPing.latitude, endPing.longitude], { icon: endIcon })
      .addTo(routeGroup)
      .bindPopup(
        `<div class="p-1.5 text-slate-900 font-sans text-xs">
          <b class="text-rose-700 text-sm">🏁 Arrival Point (End Pin)</b><br/>
          Time: <b>${new Date(endPing.recorded_at).toLocaleTimeString()}</b><br/>
          Trip Duration: <b>~${travelDurationMins} mins (${travelDurationSec}s)</b><br/>
          Calculated Speed: <b>${calculatedSpeed} km/h</b><br/>
          Total Distance: <b>${tripDistKm.toFixed(2)} km</b><br/>
          Lat: ${endPing.latitude.toFixed(4)}, Lng: ${endPing.longitude.toFixed(4)}
        </div>`
      );

    // Dynamic Live Scrubber Radar Marker
    const radarIcon = L.divIcon({
      className: 'radar-scrub-icon',
      html: `
        <div class="relative flex items-center justify-center pointer-events-none">
          <span class="absolute inline-flex h-10 w-10 animate-ping rounded-full bg-amber-400 opacity-60"></span>
          <span class="relative inline-flex h-6 w-6 rounded-full bg-gradient-to-r from-amber-400 to-yellow-500 border-2 border-white shadow-xl items-center justify-center">
            <span class="h-2 w-2 rounded-full bg-slate-950"></span>
          </span>
        </div>
      `,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });

    const initialScrubPing = displayedPings[scrubIndex] || endPing;
    const scrubberMarker = L.marker([initialScrubPing.latitude, initialScrubPing.longitude], {
      icon: radarIcon,
      zIndexOffset: 1000,
    }).addTo(routeGroup);
    scrubberMarkerRef.current = scrubberMarker;

    // Fit map bounds to encompass the route
    try {
      const bounds = L.latLngBounds(latLngs);
      mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
    } catch (e) {
      console.warn('Error fitting bounds:', e);
    }
  }, [displayedPings, leafletLoaded, basemapTheme]);

  // 4. Update Scrubber Marker position when scrubIndex changes
  useEffect(() => {
    if (basemapTheme === 'vector' || !scrubberMarkerRef.current || !activePing) return;
    scrubberMarkerRef.current.setLatLng([activePing.latitude, activePing.longitude]);
  }, [scrubIndex, activePing, basemapTheme]);

  // 5. Playback Animation Timer
  useEffect(() => {
    if (!isPlaying || displayedPings.length === 0) return;

    const intervalMs = Math.max(80, 1000 / (playbackSpeed * 3));
    const timer = setInterval(() => {
      setScrubIndex((prev) => {
        if (prev >= displayedPings.length - 1) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, intervalMs);

    return () => clearInterval(timer);
  }, [isPlaying, playbackSpeed, displayedPings.length]);

  // Helper action: Fit route bounds
  const handleFitRoute = () => {
    if (basemapTheme !== 'vector' && mapInstanceRef.current && displayedPings.length > 0) {
      const L = (window as any).L;
      if (!L) return;
      const latLngs = displayedPings.map((p) => [p.latitude, p.longitude] as [number, number]);
      mapInstanceRef.current.fitBounds(L.latLngBounds(latLngs), { padding: [50, 50], maxZoom: 16 });
    }
  };

  // Helper action: View whole Sri Lanka island
  const handleWholeIslandView = () => {
    if (basemapTheme !== 'vector' && mapInstanceRef.current) {
      mapInstanceRef.current.setView([SRI_LANKA_CENTER.lat, SRI_LANKA_CENTER.lng], 8);
    }
  };

  // Map coordinates projection for Standalone SVG Vector Mode
  const projectToSvg = (lat: number, lng: number) => {
    const svgWidth = 420;
    const svgHeight = 650;
    const minLat = SRI_LANKA_BOUNDS.minLat;
    const maxLat = SRI_LANKA_BOUNDS.maxLat;
    const minLng = SRI_LANKA_BOUNDS.minLng;
    const maxLng = SRI_LANKA_BOUNDS.maxLng;

    const x = ((lng - minLng) / (maxLng - minLng)) * svgWidth;
    const y = ((maxLat - lat) / (maxLat - minLat)) * svgHeight;
    return { x: Math.max(10, Math.min(svgWidth - 10, x)), y: Math.max(10, Math.min(svgHeight - 10, y)) };
  };

  // SVG points path string
  const svgPathD = useMemo(() => {
    if (displayedPings.length < 2) return '';
    return displayedPings.reduce((acc, p, idx) => {
      const { x, y } = projectToSvg(p.latitude, p.longitude);
      return idx === 0 ? `M ${x.toFixed(1)} ${y.toFixed(1)}` : `${acc} L ${x.toFixed(1)} ${y.toFixed(1)}`;
    }, '');
  }, [displayedPings]);

  // Mode badge helper
  const getModeBadge = (mode?: string) => {
    if (mode === 'walking') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
          <Footprints className="w-3 h-3" /> Walking
        </span>
      );
    }
    if (mode === 'high_speed_transit') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-500/20 text-purple-400 border border-purple-500/30">
          <Car className="w-3 h-3" /> Express Rail
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
        <Car className="w-3 h-3" /> In Vehicle
      </span>
    );
  };

  return (
    <div id="sri-lanka-mobility-map" className="relative flex flex-col rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 bg-slate-950/80 border-b border-slate-800/80 backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
            <Compass className="w-4 h-4 animate-spin-slow" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold tracking-wide text-white">
                Sri Lanka Mobility &amp; Route Explorer
              </h3>
              <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                🇱🇰 Island Track
              </span>
              {selectedJourneyId && onSelectJourney && (
                <button
                  onClick={() => onSelectJourney(null)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[11px] font-semibold rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30 transition cursor-pointer"
                  title="Clear journey focus and show all recorded pings"
                >
                  <Eye className="w-3 h-3 text-emerald-400" />
                  <span>Viewing Journey ({displayedPings.length} pings)</span>
                  <X className="w-3 h-3 text-emerald-400" />
                </button>
              )}
            </div>
            <p className="text-xs text-slate-400">
              {displayedPings.length > 0 ? (
                <>
                  <span className="text-indigo-300 font-semibold">{displayedPings.length}</span> coordinate pings recorded on{' '}
                  <span className="text-slate-200 font-medium">{selectedDate}</span>
                </>
              ) : (
                <>No tracking pings found for {selectedDate}</>
              )}
            </p>
          </div>
        </div>

        {/* Action Controls & Basemap Switcher */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Quick Fit & Island Zoom Buttons */}
          <button
            onClick={handleFitRoute}
            disabled={displayedPings.length === 0}
            title="Fit zoom to recorded journey"
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 disabled:opacity-40 transition-colors cursor-pointer"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span>Fit Route</span>
          </button>

          <button
            onClick={handleWholeIslandView}
            title="Reset map view to whole Sri Lanka"
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors cursor-pointer"
          >
            <span>🇱🇰 Sri Lanka</span>
          </button>

          {/* Zero-Key Basemap Selector */}
          <div className="flex items-center rounded-lg bg-slate-950 p-0.5 border border-slate-800 text-xs">
            <button
              onClick={() => setBasemapTheme('dark')}
              className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                basemapTheme === 'dark'
                  ? 'bg-indigo-600 text-white shadow-sm font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Dark Mode OpenStreetMap (Zero API Key)"
            >
              🌙 Dark
            </button>

            <button
              onClick={() => setBasemapTheme('esri')}
              className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                basemapTheme === 'esri'
                  ? 'bg-indigo-600 text-white shadow-sm font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Esri World Dark Gray Canvas (Zero API Key)"
            >
              🗺️ Esri
            </button>

            <button
              onClick={() => setBasemapTheme('osm')}
              className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                basemapTheme === 'osm'
                  ? 'bg-indigo-600 text-white shadow-sm font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Standard Full-Color OpenStreetMap"
            >
              ☀️ Street
            </button>

            <button
              onClick={() => setBasemapTheme('vector')}
              className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                basemapTheme === 'vector'
                  ? 'bg-indigo-600 text-white shadow-sm font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Standalone SVG Vector Fallback Map"
            >
              <Layers className="w-3 h-3" />
              <span>Vector</span>
            </button>
          </div>
        </div>
      </div>

      {/* Journey Telemetry Summary HUD & Dual Submission Controls */}
      {journeyMetrics && (
        <div className="bg-slate-900/95 backdrop-blur-md border-b border-slate-800 px-4 py-3 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-inner">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
            {/* Origin & Destination with Coordinates */}
            <div className="flex items-center gap-1.5">
              <span className="flex items-center gap-1 text-emerald-400 font-bold">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                Start:
              </span>
              <span className="text-slate-100 font-mono font-medium">
                {journeyMetrics.startPing
                  ? new Date(journeyMetrics.startPing.recorded_at).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : '--:--'}
              </span>
              <span className="text-slate-500 font-mono text-[11px]">
                ({journeyMetrics.startPing?.latitude.toFixed(3)}°, {journeyMetrics.startPing?.longitude.toFixed(3)}°)
              </span>
            </div>

            <ArrowRight className="w-3.5 h-3.5 text-slate-600 hidden sm:inline" />

            <div className="flex items-center gap-1.5">
              <span className="flex items-center gap-1 text-rose-400 font-bold">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-500"></span>
                End:
              </span>
              <span className="text-slate-100 font-mono font-medium">
                {journeyMetrics.endPing
                  ? new Date(journeyMetrics.endPing.recorded_at).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : '--:--'}
              </span>
              <span className="text-slate-500 font-mono text-[11px]">
                ({journeyMetrics.endPing?.latitude.toFixed(3)}°, {journeyMetrics.endPing?.longitude.toFixed(3)}°)
              </span>
            </div>

            {/* Travel Time */}
            <div className="flex items-center gap-1 pl-2 border-l border-slate-800 text-slate-300">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-slate-400">Travel Time:</span>
              <span className="font-bold text-white font-mono">
                {Math.floor(journeyMetrics.travelTimeSeconds / 60)}m {journeyMetrics.travelTimeSeconds % 60}s
              </span>
            </div>

            {/* Average Speed */}
            <div className="flex items-center gap-1 pl-2 border-l border-slate-800 text-slate-300">
              <Gauge className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-slate-400">Avg Speed:</span>
              <span className="font-bold text-cyan-300 font-mono">
                {journeyMetrics.avgSpeedKmh} km/h
              </span>
            </div>

            {/* Total Distance */}
            <div className="flex items-center gap-1 pl-2 border-l border-slate-800 text-slate-300">
              <span className="text-slate-400">Distance:</span>
              <span className="font-bold text-white font-mono">
                {journeyMetrics.totalDistanceKm} km
              </span>
            </div>

            {/* Calculated Cost */}
            <div className="flex items-center gap-1 pl-2 border-l border-slate-800">
              <span className="text-slate-400">Calculated Cost:</span>
              <span className="font-black text-emerald-400 font-mono text-sm">
                {currencySymbol}{journeyMetrics.estimatedCost.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Dual Submission Controls */}
          <div className="flex items-center gap-2 w-full md:w-auto justify-end">
            {isCostLogged ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-950/80 border border-emerald-800/80 text-emerald-300 text-xs font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                Expense Recorded
              </span>
            ) : (
              <>
                {onStraightAwaySubmit && (
                  <button
                    onClick={() => onStraightAwaySubmit(journeyMetrics)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-md transition-all cursor-pointer"
                    title="Instantly submit calculated cost to ledger"
                  >
                    <Zap className="w-3.5 h-3.5 text-slate-950 fill-slate-950" />
                    <span>Straight-Away Submit</span>
                  </button>
                )}
                {onEditAndSubmit && (
                  <button
                    onClick={() => onEditAndSubmit(journeyMetrics)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition-colors cursor-pointer"
                    title="Review amount, select account/category, and submit"
                  >
                    <Edit className="w-3.5 h-3.5 text-slate-400" />
                    <span>Edit &amp; Submit</span>
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Main Map Canvas Area */}
      <div className="relative w-full h-[420px] sm:h-[480px] bg-slate-950 overflow-hidden">
        {/* Mode A: Leaflet Tile Map */}
        <div
          ref={mapContainerRef}
          className={`w-full h-full z-0 transition-opacity duration-300 ${
            basemapTheme !== 'vector' ? 'opacity-100' : 'opacity-0 pointer-events-none absolute inset-0'
          }`}
        />

        {/* Mode B: High-Precision Standalone SVG Vector Map of Sri Lanka */}
        {basemapTheme === 'vector' && (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 p-4">
            <svg
              viewBox="0 0 420 650"
              className="w-full h-full max-h-[460px] drop-shadow-2xl select-none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <linearGradient id="islandGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#1e293b" />
                  <stop offset="50%" stopColor="#0f172a" />
                  <stop offset="100%" stopColor="#1e293b" />
                </linearGradient>
                <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>

              {/* Sri Lanka Coastline Stylized Polyline Path */}
              <path
                d="M 120 40 
                   Q 150 30 180 50 
                   Q 220 70 250 110 
                   Q 270 140 290 190 
                   Q 310 240 315 310 
                   Q 315 380 295 440 
                   Q 270 510 230 570 
                   Q 190 610 160 610 
                   Q 130 600 110 570 
                   Q 90 530 85 460 
                   Q 80 400 90 350 
                   Q 95 300 90 240 
                   Q 80 180 85 130 
                   Q 95 80 120 40 Z"
                fill="url(#islandGrad)"
                stroke="#334155"
                strokeWidth="2.5"
                strokeDasharray="4 2"
              />

              {/* Major Cities / Anchor Nodes */}
              {SRI_LANKA_LANDMARKS.map((city) => {
                const { x, y } = projectToSvg(city.lat, city.lng);
                return (
                  <g key={city.name} className="opacity-70 hover:opacity-100 transition-opacity">
                    <circle
                      cx={x}
                      cy={y}
                      r={city.isMajor ? 4 : 2.5}
                      fill={city.isMajor ? '#60a5fa' : '#94a3b8'}
                      stroke="#0f172a"
                      strokeWidth="1.5"
                    />
                    <text
                      x={x + 7}
                      y={y + 3}
                      fill="#cbd5e1"
                      fontSize="9"
                      fontWeight={city.isMajor ? '600' : 'normal'}
                      fontFamily="system-ui, sans-serif"
                    >
                      {city.name}
                    </text>
                  </g>
                );
              })}

              {/* Travelled Route Polyline */}
              {svgPathD && (
                <path
                  d={svgPathD}
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  filter="url(#glow)"
                />
              )}

              {/* Start & End Marker in Vector */}
              {displayedPings.length > 0 && (() => {
                const startPos = projectToSvg(displayedPings[0].latitude, displayedPings[0].longitude);
                const endPos = projectToSvg(
                  displayedPings[displayedPings.length - 1].latitude,
                  displayedPings[displayedPings.length - 1].longitude
                );
                return (
                  <>
                    <circle cx={startPos.x} cy={startPos.y} r="5" fill="#10b981" stroke="#ffffff" strokeWidth="1.5" />
                    <circle cx={endPos.x} cy={endPos.y} r="5" fill="#f43f5e" stroke="#ffffff" strokeWidth="1.5" />
                  </>
                );
              })()}

              {/* Active Scrubber Radar Marker */}
              {activePing && (() => {
                const { x, y } = projectToSvg(activePing.latitude, activePing.longitude);
                return (
                  <g>
                    <circle cx={x} cy={y} r="10" fill="#f59e0b" opacity="0.4" className="animate-ping" />
                    <circle cx={x} cy={y} r="6" fill="#f59e0b" stroke="#ffffff" strokeWidth="2" />
                  </g>
                );
              })()}
            </svg>
          </div>
        )}

        {/* Live HUD Floating Overlay (Bottom Left) */}
        {activePing && (
          <div className="absolute top-4 left-4 z-10 max-w-xs sm:max-w-sm rounded-xl bg-slate-900/90 border border-slate-700/80 shadow-2xl backdrop-blur-md p-3.5 text-xs text-slate-200">
            <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-slate-800">
              <div className="flex items-center gap-1.5 font-bold text-white">
                <Clock className="w-3.5 h-3.5 text-indigo-400" />
                <span>{new Date(activePing.recorded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
              </div>
              {getModeBadge(activePing.transport_mode)}
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="flex items-center gap-1.5 text-slate-300">
                <Gauge className="w-3.5 h-3.5 text-cyan-400" />
                <span>Speed: <strong className="text-white">{(activePing.speed_kmh || 0).toFixed(1)} km/h</strong></span>
              </div>

              <div className="flex items-center gap-1.5 text-slate-300">
                {activePing.is_charging ? (
                  <BatteryCharging className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Battery className="w-3.5 h-3.5 text-amber-400" />
                )}
                <span>
                  Battery: <strong className="text-white">{activePing.battery_level != null ? `${Math.round(activePing.battery_level)}%` : 'N/A'}</strong>
                </span>
              </div>

              <div className="col-span-2 flex items-center gap-1 text-[10px] text-slate-400 pt-1 font-mono">
                <MapPin className="w-3 h-3 text-rose-400 shrink-0" />
                <span>
                  {activePing.latitude.toFixed(5)}, {activePing.longitude.toFixed(5)}
                </span>
                <span className="ml-auto text-slate-500">
                  #{scrubIndex + 1}/{displayedPings.length}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Empty State Overlay */}
        {!isLoading && displayedPings.length === 0 && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-950/75 backdrop-blur-xs p-6 text-center">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-3">
              <MapPin className="w-6 h-6 animate-bounce" />
            </div>
            <h4 className="text-sm font-bold text-white mb-1">
              No Travelled Pings for {selectedDate}
            </h4>
            <p className="text-xs text-slate-400 max-w-sm mb-3">
              Pings transmitted from your companion device on this date will be tracked and rendered across Sri Lanka in real-time.
            </p>
            <span className="text-[11px] text-slate-500">
              Select another date using the navigator above or ensure companion tracking is active.
            </span>
          </div>
        )}

        {/* Loading Indicator Overlay */}
        {isLoading && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs">
            <div className="flex items-center gap-2.5 px-4 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-indigo-300 shadow-xl">
              <Compass className="w-4 h-4 animate-spin" />
              <span>Loading Sri Lanka route coordinates...</span>
            </div>
          </div>
        )}
      </div>

      {/* Scrubber & Playback Controls Bar */}
      {displayedPings.length > 0 && (
        <div className="flex flex-col gap-2.5 px-5 py-3.5 bg-slate-950/90 border-t border-slate-800">
          <div className="flex items-center gap-3">
            {/* Play/Pause Button */}
            <button
              onClick={() => {
                if (scrubIndex >= displayedPings.length - 1) {
                  setScrubIndex(0);
                }
                setIsPlaying(!isPlaying);
              }}
              className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow-md transition-colors cursor-pointer"
              title={isPlaying ? 'Pause Playback' : 'Play Journey'}
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
            </button>

            {/* Reset Button */}
            <button
              onClick={() => {
                setIsPlaying(false);
                setScrubIndex(0);
              }}
              className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors cursor-pointer"
              title="Rewind to start"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>

            {/* Interactive Timeline Range Scrubber */}
            <div className="flex-1 flex items-center gap-2">
              <span className="text-[10px] font-mono text-slate-400">
                {new Date(displayedPings[0].recorded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
              <input
                type="range"
                min="0"
                max={Math.max(0, displayedPings.length - 1)}
                value={scrubIndex}
                onChange={(e) => {
                  setIsPlaying(false);
                  setScrubIndex(Number(e.target.value));
                }}
                className="flex-1 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500 focus:outline-none"
              />
              <span className="text-[10px] font-mono text-slate-400">
                {new Date(displayedPings[displayedPings.length - 1].recorded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>

            {/* Playback Speed Multiplier */}
            <div className="flex items-center rounded-lg bg-slate-800 p-0.5 border border-slate-700 text-xs">
              {[1, 2, 5].map((speed) => (
                <button
                  key={speed}
                  onClick={() => setPlaybackSpeed(speed)}
                  className={`px-2 py-0.5 rounded-md font-semibold text-[10px] transition-colors cursor-pointer ${
                    playbackSpeed === speed
                      ? 'bg-indigo-600 text-white shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {speed}x
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
