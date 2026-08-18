/**
 * UniversalMap3D — MapLibre GL JS Map Component
 *
 * Modes:
 *  - 'customer'  : Read-only order tracking (rider marker + route polyline)
 *  - 'owner'     : Read-only owner live-tracking panel (rider marker)
 *  - 'delivery'  : Delivery partner navigation (rider + destination + route + turn overlay)
 *
 * Design decisions:
 *  - Direct GeoJSON setData() mutations bypass React reconciler for smooth 60fps marker updates
 *  - requestAnimationFrame lerp for sub-pixel smooth marker movement
 *  - 3D building extrusions via OpenFreeMap vector style (no API key, unlimited usage)
 *  - Camera auto-follow with pitch 50° + manual drag override → floating "Re-center" button
 */

import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef, useCallback } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { motion, AnimatePresence } from 'framer-motion';
import { Navigation2, User, Crosshair, Package, Navigation, MapPin } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LatLng {
  lat: number;
  lng: number;
}

export interface MapMarker {
  id: string;
  position: LatLng;
  type: 'rider' | 'restaurant' | 'customer' | 'owner';
  label?: string;
  heading?: number; // degrees, 0 = north
}

export interface UniversalMap3DProps {
  mode: 'customer' | 'owner' | 'delivery' | 'picker';
  center?: LatLng;
  markers?: MapMarker[];
  routeGeoJSON?: GeoJSON.Feature<GeoJSON.LineString> | null;
  zoom?: number;
  className?: string;
  onMapReady?: (map: maplibregl.Map) => void;
  /** Called when user manually drags the map (disengages auto-follow) */
  onUserDrag?: () => void;
  /** Called when map moves (useful for picker mode) */
  onCenterChange?: (center: LatLng) => void;
}

export interface UniversalMap3DRef {
  flyTo: (center: LatLng, zoom?: number) => void;
  fitRoute: () => void;
  getMap: () => maplibregl.Map | null;
  getCenter: () => LatLng | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

// OpenFreeMap vector tiles with automatic CartoDB raster tile fallback
const TILE_STYLE = 'https://tiles.openfreemap.org/styles/liberty';
const CARTO_RASTER_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    'carto-tiles': {
      type: 'raster',
      tiles: [
        'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
        'https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
        'https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
      ],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors © CARTO',
    },
  },
  layers: [
    {
      id: 'carto-tiles-layer',
      type: 'raster',
      source: 'carto-tiles',
      minzoom: 0,
      maxzoom: 22,
    },
  ],
};

import { RESTAURANT_LOCATION } from '../../lib/config';

const DEFAULT_PITCH = 0;
const LERP_ALPHA = 0.12; // smooth interpolation factor (higher = snappier)
const LERP_HEADING_ALPHA = 0.08;

// ─── Marker HTML Generators ───────────────────────────────────────────────────

function riderMarkerHTML(heading?: number): string {
  const rot = heading != null ? heading : 0;
  return `
    <div style="position:relative;width:52px;height:52px;display:flex;align-items:center;justify-content:center;">
      <div style="
        position:absolute;inset:0;border-radius:50%;
        background:radial-gradient(circle,rgba(249,115,22,0.35) 0%,transparent 70%);
        animation:rider-pulse 2s ease-in-out infinite;
      "></div>
      <div style="
        position:relative;z-index:10;
        width:40px;height:40px;border-radius:50%;
        background:linear-gradient(135deg,#f97316,#ea580c);
        display:flex;align-items:center;justify-content:center;
        box-shadow:0 6px 20px rgba(249,115,22,0.55),inset 0 1px 3px rgba(255,255,255,0.3);
        border:2.5px solid rgba(255,255,255,0.9);
        transform:rotate(${rot}deg);
        transition:transform 0.3s ease;
      ">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
          <path d="M12 2L19 21L12 17L5 21L12 2Z"/>
        </svg>
      </div>
    </div>
  `;
}

function restaurantMarkerHTML(): string {
  return `
    <div style="position:relative;display:flex;flex-direction:column;align-items:center;">
      <div style="
        background:linear-gradient(135deg,#fff7ed,#ffedd5);
        width:46px;height:46px;border-radius:14px;
        display:flex;align-items:center;justify-content:center;
        box-shadow:0 8px 22px rgba(249,115,22,0.3),inset 0 1px 4px rgba(255,255,255,0.9);
        border:2px solid #f97316;
      ">
        <span style="font-size:24px;line-height:1;">🍕</span>
      </div>
      <div style="width:2px;height:8px;background:linear-gradient(to bottom,#f97316,transparent);border-radius:2px;"></div>
    </div>
  `;
}

function customerMarkerHTML(): string {
  return `
    <div style="position:relative;display:flex;flex-direction:column;align-items:center;">
      <div style="position:absolute;top:2px;width:48px;height:48px;border-radius:50%;border:2px solid #3b82f6;opacity:0.5;animation:radar-pulse 2s infinite;"></div>
      <div style="position:absolute;top:2px;width:48px;height:48px;border-radius:50%;border:2px solid #3b82f6;opacity:0.3;animation:radar-pulse 2s 0.9s infinite;"></div>
      <div style="
        position:relative;z-index:10;margin-top:5px;
        width:38px;height:38px;border-radius:50%;
        background:linear-gradient(135deg,#3b82f6,#1d4ed8);
        display:flex;align-items:center;justify-content:center;
        box-shadow:0 6px 18px rgba(37,99,235,0.45),inset 0 1px 4px rgba(255,255,255,0.35);
        border:2.5px solid rgba(255,255,255,0.95);
      ">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
          <polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
      </div>
      <div style="width:2px;height:8px;background:linear-gradient(to bottom,#3b82f6,transparent);border-radius:2px;"></div>
    </div>
  `;
}

// ─── Global CSS ───────────────────────────────────────────────────────────────

const MAP_CSS = `
  @keyframes rider-pulse {
    0%,100% { transform:scale(1);opacity:0.5; }
    50%      { transform:scale(1.6);opacity:0; }
  }
  @keyframes radar-pulse {
    0%   { transform:scale(0.5);opacity:0.8; }
    100% { transform:scale(2.2);opacity:0; }
  }
  .maplibregl-ctrl-attrib { display:none !important; }
  .maplibregl-ctrl-logo   { display:none !important; }
`;

function injectCSS(id: string, css: string): void {
  if (document.getElementById(id)) return;
  const style = document.createElement('style');
  style.id = id;
  style.textContent = css;
  document.head.appendChild(style);
}

// ─── Component ────────────────────────────────────────────────────────────────

const UniversalMap3D = forwardRef<UniversalMap3DRef, UniversalMap3DProps>(
  function UniversalMap3D(
    { mode, center, markers = [], routeGeoJSON, zoom = 15, className = '', onMapReady, onUserDrag, onCenterChange },
    ref
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<maplibregl.Map | null>(null);
    const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
    const lerpRef = useRef<{
      current: LatLng;
      target: LatLng;
      heading: number;
      rafId: number | null;
    } | null>(null);
    const autoFollowRef = useRef(true);
    const [autoFollow, setAutoFollow] = useState(true);
    const [mapLoaded, setMapLoaded] = useState(false);

    // ── Expose imperative API ─────────────────────────────────────────────────
    useImperativeHandle(ref, () => ({
      flyTo(pos, z) {
        mapRef.current?.flyTo({ center: [pos.lng, pos.lat], zoom: z || zoom, pitch: DEFAULT_PITCH, duration: 800 });
      },
      fitRoute() {
        const route = routeGeoJSON?.geometry?.coordinates;
        if (!route || !mapRef.current) return;
        const bounds = new maplibregl.LngLatBounds();
        for (const [lng, lat] of route) bounds.extend([lng, lat]);
        mapRef.current.fitBounds(bounds, { padding: 60, duration: 1000 });
      },
      getMap() { return mapRef.current; },
      getCenter() {
        const c = mapRef.current?.getCenter();
        return c ? { lat: c.lat, lng: c.lng } : null;
      }
    }));

    // ── Init Map ──────────────────────────────────────────────────────────────
    useEffect(() => {
      if (!containerRef.current || mapRef.current) return;
      injectCSS('universal-map-3d-css', MAP_CSS);

      const initialCenter = center || { lat: RESTAURANT_LOCATION.lat, lng: RESTAURANT_LOCATION.lng }; // Rajnandgaon, Chhattisgarh default
      const initialPitch = mode === 'delivery' ? 45 : 0;
      const map = new maplibregl.Map({
        container: containerRef.current,
        style: TILE_STYLE,
        center: [initialCenter.lng, initialCenter.lat],
        zoom,
        pitch: initialPitch,
        bearing: 0,
        // antialias enables WebGL MSAA for smoother 3D building edges
        // Cast needed as some maplibre-gl type versions omit this valid option
        ...({ antialias: true } as any),
      } as maplibregl.MapOptions);

      map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-right');

      let fallbackTriggered = false;
      const triggerFallbackStyle = () => {
        if (fallbackTriggered) return;
        fallbackTriggered = true;
        console.warn('[UniversalMap3D] Primary tile server failed or timed out. Switching to CartoDB Voyager raster tiles.');
        try {
          map.setStyle(CARTO_RASTER_STYLE);
        } catch (err) {
          console.error('[UniversalMap3D] Fallback style error:', err);
        }
      };

      map.on('error', (e: any) => {
        if (!mapLoaded && (!map.isStyleLoaded() || String(e?.error?.message || '').includes('tiles.openfreemap'))) {
          triggerFallbackStyle();
        }
      });

      const fallbackTimer = setTimeout(() => {
        if (!map.isStyleLoaded()) {
          triggerFallbackStyle();
        }
      }, 3500);

      map.on('load', () => {
        clearTimeout(fallbackTimer);
        // Add route source + layer
        map.addSource('route-source', {
          type: 'geojson',
          data: routeGeoJSON || { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [] } },
        });
        map.addLayer({
          id: 'route-layer',
          type: 'line',
          source: 'route-source',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': '#f97316',
            'line-width': 5,
            'line-opacity': 0.85,
            'line-dasharray': [2, 1],
          },
        });

        // 3D buildings if style supports it
        const layers = map.getStyle().layers || [];
        const labelLayer = (layers as maplibregl.LayerSpecification[]).find(
          (l): l is maplibregl.SymbolLayerSpecification =>
            l.type === 'symbol' && !!(l.layout as any)?.['text-field']
        );
        if (map.getSource('openmaptiles') || map.getLayer('building-3d')) {
          // OpenFreeMap already has 3D buildings
        } else {
          // Try to add 3D extrusion if composite source available
          try {
            map.addLayer(
              {
                id: 'building-3d',
                type: 'fill-extrusion',
                source: 'openmaptiles',
                'source-layer': 'building',
                filter: ['!=', ['get', 'hide_3d'], true],
                paint: {
                  'fill-extrusion-color': ['interpolate', ['linear'], ['get', 'render_height'], 0, '#1e293b', 100, '#334155'],
                  'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 14, 0, 16, ['get', 'render_height']],
                  'fill-extrusion-base': ['interpolate', ['linear'], ['zoom'], 14, 0, 16, ['get', 'render_min_height']],
                  'fill-extrusion-opacity': 0.7,
                },
              },
              labelLayer?.id
            );
          } catch { /* vector tiles may not have building layer */ }
        }

        setMapLoaded(true);
        onMapReady?.(map);
      });

      // Detect manual drag — disengage auto-follow and switch rider map to top view
      map.on('dragstart', () => {
        autoFollowRef.current = false;
        setAutoFollow(false);
        if (mode === 'delivery') {
          map.easeTo({ pitch: 0, duration: 400 });
        }
        onUserDrag?.();
      });
      
      map.on('moveend', () => {
        const c = map.getCenter();
        if (c) onCenterChange?.({ lat: c.lat, lng: c.lng });
      });

      mapRef.current = map;
      return () => {
        if (lerpRef.current?.rafId) cancelAnimationFrame(lerpRef.current.rafId);
        map.remove();
        mapRef.current = null;
        markersRef.current.clear();
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── Update Route ──────────────────────────────────────────────────────────
    useEffect(() => {
      if (!mapLoaded || !mapRef.current) return;
      const source = mapRef.current.getSource('route-source') as maplibregl.GeoJSONSource | undefined;
      if (!source) return;
      source.setData(
        routeGeoJSON || { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [] } }
      );
    }, [routeGeoJSON, mapLoaded]);

    // ── Update Markers ────────────────────────────────────────────────────────
    useEffect(() => {
      if (!mapLoaded || !mapRef.current) return;
      const map = mapRef.current;

      for (const marker of markers) {
        const existing = markersRef.current.get(marker.id);

        if (existing) {
          // Smooth lerp to new position
          const currentLL = existing.getLngLat();
          const startPos: LatLng = { lat: currentLL.lat, lng: currentLL.lng };
          const targetPos: LatLng = marker.position;

          if (lerpRef.current?.rafId) cancelAnimationFrame(lerpRef.current.rafId);

          let current = { ...startPos };
          let currentHeading = marker.heading || 0;

          const animate = () => {
            current.lat += (targetPos.lat - current.lat) * LERP_ALPHA;
            current.lng += (targetPos.lng - current.lng) * LERP_ALPHA;
            currentHeading += ((marker.heading || 0) - currentHeading) * LERP_HEADING_ALPHA;

            existing.setLngLat([current.lng, current.lat]);

            // Update heading on rider marker DOM
            if (marker.type === 'rider') {
              const el = existing.getElement();
              const inner = el.querySelector('[style*="rotate"]') as HTMLElement | null;
              if (inner) inner.style.transform = `rotate(${Math.round(currentHeading)}deg)`;
            }

            const distLat = Math.abs(targetPos.lat - current.lat);
            const distLng = Math.abs(targetPos.lng - current.lng);
            if (distLat > 0.000001 || distLng > 0.000001) {
              lerpRef.current = { ...lerpRef.current!, rafId: requestAnimationFrame(animate) };
            } else {
              if (lerpRef.current) lerpRef.current.rafId = null;
            }
          };

          lerpRef.current = { current, target: targetPos, heading: currentHeading, rafId: requestAnimationFrame(animate) };

          // Auto-follow rider
          if (marker.type === 'rider' && autoFollowRef.current) {
            const targetPitch = mode === 'delivery' ? 45 : 0;
            const targetBearing = mode === 'delivery' ? (marker.heading || 0) : 0;
            map.easeTo({ center: [targetPos.lng, targetPos.lat], pitch: targetPitch, bearing: targetBearing, duration: 800 });
          }
        } else {
          // Create new marker
          let html = '';
          if (marker.type === 'rider') html = riderMarkerHTML(marker.heading);
          else if (marker.type === 'restaurant') html = restaurantMarkerHTML();
          else html = customerMarkerHTML();

          const el = document.createElement('div');
          el.innerHTML = html;

          const mgl = new maplibregl.Marker({ element: el, anchor: 'center' })
            .setLngLat([marker.position.lng, marker.position.lat])
            .addTo(map);

          markersRef.current.set(marker.id, mgl);
        }
      }

      // Remove stale markers
      const currentIds = new Set(markers.map((m) => m.id));
      for (const [id, mgl] of markersRef.current) {
        if (!currentIds.has(id)) {
          mgl.remove();
          markersRef.current.delete(id);
        }
      }
    }, [markers, mapLoaded]);

    // ── Re-center ─────────────────────────────────────────────────────────────
    const recenter = useCallback(() => {
      autoFollowRef.current = true;
      setAutoFollow(true);
      const riderMarker = markers.find((m) => m.type === 'rider');
      const target = riderMarker?.position || center;
      if (target && mapRef.current) {
        const targetPitch = mode === 'delivery' ? 45 : 0;
        const targetBearing = mode === 'delivery' ? (riderMarker?.heading || 0) : 0;
        mapRef.current.flyTo({ center: [target.lng, target.lat], zoom, pitch: targetPitch, bearing: targetBearing, duration: 800 });
      }
    }, [markers, center, zoom, mode]);

    return (
      <div className={`relative overflow-hidden rounded-2xl ${className}`} style={{ minHeight: 320 }}>
        {/* Map container */}
        <div ref={containerRef} style={{ width: '100%', height: '100%', minHeight: 320 }} />

        {/* Loading overlay */}
        <AnimatePresence>
          {!mapLoaded && (
            <motion.div
              className="absolute inset-0 flex flex-col items-center justify-center bg-[#0f172a] z-20 gap-3"
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
            >
              <div className="w-10 h-10 rounded-full border-2 border-primary-500 border-t-transparent animate-spin" />
              <span className="text-slate-400 text-sm font-medium">Loading 3D map…</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Re-center button */}
        <AnimatePresence>
          {!autoFollow && mapLoaded && mode !== 'picker' && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 8 }}
              onClick={recenter}
              className="absolute bottom-4 right-4 z-10 flex items-center gap-2 px-3 py-2 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl text-white text-xs font-semibold hover:bg-white/20 transition-colors shadow-lg"
            >
              <Crosshair size={14} />
              Re-center
            </motion.button>
          )}
        </AnimatePresence>

        {/* Picker Mode Fixed Center Pin */}
        {mode === 'picker' && (
          <div className="absolute inset-0 z-10 pointer-events-none flex flex-col items-center justify-center">
            <div className="relative">
              {/* Radar pulse animation beneath the pin */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-12 border-2 border-primary-500 rounded-full opacity-50 animate-ping" />
              {/* Actual Pin */}
              <div className="relative -mt-6">
                <div className="w-10 h-10 bg-primary-600 rounded-full flex items-center justify-center shadow-xl border-4 border-white shadow-primary-500/50">
                  <MapPin className="w-5 h-5 text-white" />
                </div>
                {/* Pin Point */}
                <div className="w-1 h-3 bg-primary-600 mx-auto -mt-1 shadow-sm" />
                <div className="w-2 h-1 bg-black/30 rounded-full blur-[1px] mx-auto mt-1" />
              </div>
            </div>
          </div>
        )}

        {/* Mode badge */}
        {mapLoaded && mode !== 'picker' && (
          <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 px-2.5 py-1 bg-black/50 backdrop-blur-md rounded-full text-white text-xs font-medium border border-white/10">
            <Navigation2 size={11} className="text-primary-400" />
            {mode === 'customer' && 'Live Tracking'}
            {mode === 'owner' && 'Fleet View'}
            {mode === 'delivery' && 'Navigation'}
          </div>
        )}
      </div>
    );
  }
);

const MemoizedUniversalMap3D = React.memo(UniversalMap3D);
export default MemoizedUniversalMap3D;
