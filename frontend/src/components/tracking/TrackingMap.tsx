import { useEffect, useRef, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import React from 'react';

// ─── Global CSS injected into the page ──────────────────────────────────
const GLOBAL_CSS = `
  @keyframes radar-pulse {
    0%   { transform: scale(0.5); opacity: 0.9; }
    100% { transform: scale(2.2); opacity: 0; }
  }
  @keyframes float-label {
    0%,100% { transform: translateX(-50%) translateY(0px); }
    50%     { transform: translateX(-50%) translateY(-3px); }
  }
  @keyframes rider-glow {
    0%,100% { box-shadow: 0 0 0 0 rgba(249,115,22,0.45); }
    50%     { box-shadow: 0 0 0 14px rgba(249,115,22,0); }
  }
  @keyframes route-dash {
    to { stroke-dashoffset: -30; }
  }
  .route-path-animated {
    animation: route-dash 1.5s linear infinite;
  }
  .premium-popup .leaflet-popup-content-wrapper {
    background: rgba(255,255,255,0.97);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(0,0,0,0.08);
    color: #1e293b;
    border-radius: 14px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.15);
    font-family: 'Inter', sans-serif;
    font-size: 13px;
    font-weight: 600;
  }
  .premium-popup .leaflet-popup-tip-container { display: none; }
  .leaflet-attribution-flag { display: none !important; }
  .leaflet-control-attribution {
    background: rgba(255,255,255,0.7) !important;
    backdrop-filter: blur(4px);
    border-radius: 8px 0 0 0 !important;
    font-size: 10px !important;
  }
`;

// ─── Destination / Customer Icon ─────────────────────────────────────────
const customerIcon = new L.DivIcon({
  html: `
  <div style="position:relative;width:56px;height:68px;display:flex;flex-direction:column;align-items:center;">
    <div style="position:absolute;top:4px;width:50px;height:50px;border-radius:50%;border:2px solid #3b82f6;opacity:0.55;animation:radar-pulse 2s infinite cubic-bezier(0.1,0.8,0.3,1);"></div>
    <div style="position:absolute;top:4px;width:50px;height:50px;border-radius:50%;border:2px solid #3b82f6;opacity:0.35;animation:radar-pulse 2s 0.9s infinite cubic-bezier(0.1,0.8,0.3,1);"></div>
    <div style="position:relative;z-index:10;width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,#3b82f6,#1d4ed8);display:flex;align-items:center;justify-content:center;box-shadow:0 6px 18px rgba(37,99,235,0.45),inset 0 1px 4px rgba(255,255,255,0.35);border:2.5px solid rgba(255,255,255,0.95);margin-top:9px;">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
        <polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    </div>
    <div style="width:2.5px;height:10px;background:linear-gradient(to bottom,#3b82f6,transparent);margin-top:-1px;z-index:9;border-radius:2px;"></div>
  </div>`,
  className: '',
  iconSize: [56, 68],
  iconAnchor: [28, 68],
});

// ─── Restaurant Icon ─────────────────────────────────────────────────────
const restaurantMapIcon = new L.DivIcon({
  html: `
  <div style="position:relative;width:60px;height:74px;display:flex;flex-direction:column;align-items:center;">
    <div style="position:absolute;top:-24px;left:50%;transform:translateX(-50%);background:white;color:#ea580c;font-size:10px;font-weight:800;padding:2px 9px;border-radius:10px;white-space:nowrap;box-shadow:0 3px 10px rgba(249,115,22,0.22);animation:float-label 2.5s ease-in-out infinite;border:1.5px solid #fed7aa;letter-spacing:0.2px;">🍕 Olive Pizza</div>
    <div style="position:relative;z-index:10;width:44px;height:44px;border-radius:14px;background:linear-gradient(135deg,#fff7ed,#ffedd5);display:flex;align-items:center;justify-content:center;box-shadow:0 8px 22px rgba(249,115,22,0.28),inset 0 1px 4px rgba(255,255,255,0.9);border:2px solid #f97316;margin-top:25px;">
      <span style="font-size:24px;line-height:1;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.15));">🍕</span>
    </div>
    <div style="width:2.5px;height:9px;background:linear-gradient(to bottom,#f97316,transparent);margin-top:-1px;z-index:9;border-radius:2px;"></div>
  </div>`,
  className: '',
  iconSize: [60, 74],
  iconAnchor: [30, 74],
});

// ─── Rider / Delivery Partner Icon ──────────────────────────────────────
const riderIcon = new L.DivIcon({
  html: `
  <div style="position:relative;width:64px;height:64px;display:flex;align-items:center;justify-content:center;transform-origin:center;">
    <div style="position:absolute;inset:0;border-radius:50%;background:rgba(255,247,237,0.92);border:2px solid rgba(249,115,22,0.4);animation:rider-glow 2s infinite;"></div>
    <div style="position:relative;z-index:10;font-size:28px;line-height:1;filter:drop-shadow(0 3px 8px rgba(0,0,0,0.22));">🛵</div>
  </div>`,
  className: '',
  iconSize: [64, 64],
  iconAnchor: [32, 32],
});

// ─── Auto-Fit Bounds ──────────────────────────────────────────────────────
function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  const fitted = useRef(false);

  useEffect(() => {
    if (points.length === 0) return;
    // Only auto-fit once we have multiple points (restaurant + customer or partner)
    if (fitted.current && points.length === 1) return;
    const bounds = L.latLngBounds(points.map(p => L.latLng(p[0], p[1])));
    map.fitBounds(bounds, { padding: [75, 75], maxZoom: 16, animate: true });
    if (points.length > 1) fitted.current = true;
  }, [points.length, points[0]?.[0], points[0]?.[1]]);

  return null;
}

// ─── Smooth Animated Rider Marker ─────────────────────────────────────────
function SmoothMarker({
  position,
  heading,
  icon,
  popupText,
}: {
  position: [number, number];
  heading?: number;
  icon: L.DivIcon;
  popupText: string;
}) {
  const markerRef = useRef<L.Marker>(null);
  const prevPos = useRef<[number, number]>(position);
  const prevHeading = useRef(heading || 0);

  useEffect(() => {
    const marker = markerRef.current;
    if (!marker) return;

    const [startLat, startLng] = prevPos.current;
    const [endLat, endLng] = position;
    let startH = prevHeading.current;
    let endH = heading || 0;

    // Shortest-path rotation
    let diff = endH - startH;
    while (diff < -180) diff += 360;
    while (diff > 180) diff -= 360;
    endH = startH + diff;

    const duration = 2000;
    const startTime = Date.now();
    let rafId: number;

    const tick = () => {
      const t = Math.min((Date.now() - startTime) / duration, 1);
      const ease = 1 - Math.pow(1 - t, 3); // cubic ease-out

      marker.setLatLng([
        startLat + (endLat - startLat) * ease,
        startLng + (endLng - startLng) * ease,
      ]);

      const el = marker.getElement();
      if (el) {
        const inner = el.firstElementChild as HTMLElement | null;
        if (inner) inner.style.transform = `rotate(${startH + (endH - startH) * ease}deg)`;
      }

      if (t < 1) {
        rafId = requestAnimationFrame(tick);
      } else {
        prevPos.current = position;
        prevHeading.current = endH;
      }
    };

    tick();
    return () => { if (rafId) cancelAnimationFrame(rafId); };
  }, [position[0], position[1], heading]);

  return (
    <Marker ref={markerRef} position={prevPos.current} icon={icon}>
      <Popup className="premium-popup">{popupText}</Popup>
    </Marker>
  );
}

// ─── Main TrackingMap Component ───────────────────────────────────────────
interface TrackingMapProps {
  restaurantLat: number;
  restaurantLng: number;
  customerLat?: number;
  customerLng?: number;
  partnerLat?: number;
  partnerLng?: number;
  partnerHeading?: number;
  status: string;
}

const TrackingMap = React.memo(function TrackingMap({
  restaurantLat,
  restaurantLng,
  customerLat,
  customerLng,
  partnerLat,
  partnerLng,
  partnerHeading,
  status,
}: TrackingMapProps) {
  // Initial map center: partner position if available, else restaurant
  const center = useMemo<[number, number]>(() => {
    if (partnerLat && partnerLng) return [partnerLat, partnerLng];
    return [restaurantLat, restaurantLng];
  }, [restaurantLat, restaurantLng, partnerLat, partnerLng]);

  // Points to fit in view
  const fitPoints = useMemo<[number, number][]>(() => {
    const pts: [number, number][] = [[restaurantLat, restaurantLng]];
    if (customerLat && customerLng) pts.push([customerLat, customerLng]);
    if (partnerLat && partnerLng) pts.push([partnerLat, partnerLng]);
    return pts;
  }, [restaurantLat, restaurantLng, customerLat, customerLng, partnerLat, partnerLng]);

  // Real-road route via OSRM
  const [routeCoords, setRouteCoords] = useState<[number, number][]>([]);

  useEffect(() => {
    const fetchRoute = async () => {
      const waypoints: string[] = [];

      if (status === 'out_for_delivery') {
        waypoints.push(
          partnerLat && partnerLng
            ? `${partnerLng},${partnerLat}`
            : `${restaurantLng},${restaurantLat}`
        );
        if (customerLat && customerLng) waypoints.push(`${customerLng},${customerLat}`);
        else return; // can't draw route without destination
      } else {
        waypoints.push(`${restaurantLng},${restaurantLat}`);
        if (partnerLat && partnerLng) waypoints.push(`${partnerLng},${partnerLat}`);
        if (customerLat && customerLng) waypoints.push(`${customerLng},${customerLat}`);
      }

      if (waypoints.length < 2) return;

      try {
        const res = await fetch(
          `https://router.project-osrm.org/route/v1/driving/${waypoints.join(';')}?overview=full&geometries=geojson`
        );
        const data = await res.json();
        if (data.routes?.[0]) {
          setRouteCoords(
            data.routes[0].geometry.coordinates.map((c: number[]) => [c[1], c[0]] as [number, number])
          );
        }
      } catch {
        // Straight-line fallback
        const fb: [number, number][] = [];
        if (status === 'out_for_delivery') {
          fb.push(partnerLat && partnerLng ? [partnerLat, partnerLng] : [restaurantLat, restaurantLng]);
          if (customerLat && customerLng) fb.push([customerLat, customerLng]);
        } else {
          fb.push([restaurantLat, restaurantLng]);
          if (customerLat && customerLng) fb.push([customerLat, customerLng]);
        }
        setRouteCoords(fb);
      }
    };

    fetchRoute();
    const id = setInterval(fetchRoute, 30_000);
    return () => clearInterval(id);
  }, [restaurantLat, restaurantLng, partnerLat, partnerLng, customerLat, customerLng, status]);

  return (
    <div className="w-full h-full relative">
      <style>{GLOBAL_CSS}</style>

      <MapContainer
        center={center}
        zoom={14}
        className="w-full h-full z-0"
        zoomControl={false}
        attributionControl={true}
      >
        {/* ── Natural Light Tile Layer (CartoDB Voyager) ── */}
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com">CARTO</a>'
          maxZoom={19}
        />

        <FitBounds points={fitPoints} />

        {/* ── Route Lines ── */}
        {routeCoords.length >= 2 && (
          <>
            {/* Wide soft glow */}
            <Polyline
              positions={routeCoords}
              pathOptions={{ color: '#3b82f6', weight: 16, opacity: 0.10, lineCap: 'round', lineJoin: 'round' }}
            />
            {/* Core road line */}
            <Polyline
              positions={routeCoords}
              pathOptions={{ color: '#2563eb', weight: 5, opacity: 0.85, lineCap: 'round', lineJoin: 'round' }}
            />
            {/* Animated white dashes on top when en-route */}
            <Polyline
              positions={routeCoords}
              pathOptions={{
                color: '#ffffff',
                weight: 2.5,
                opacity: 0.9,
                dashArray: status === 'out_for_delivery' ? '12, 14' : '0',
                className: status === 'out_for_delivery' ? 'route-path-animated' : '',
              }}
            />
          </>
        )}

        {/* Restaurant pin */}
        <Marker position={[restaurantLat, restaurantLng]} icon={restaurantMapIcon} zIndexOffset={100} />

        {/* Customer / destination pin */}
        {customerLat && customerLng && (
          <Marker position={[customerLat, customerLng]} icon={customerIcon} zIndexOffset={150} />
        )}

        {/* Rider — smooth animated, only visible when out for delivery */}
        {partnerLat && partnerLng && status === 'out_for_delivery' && (
          <SmoothMarker
            position={[partnerLat, partnerLng]}
            heading={partnerHeading}
            icon={riderIcon}
            popupText="🛵 Your delivery partner is on the way!"
          />
        )}
      </MapContainer>
    </div>
  );
});

export default TrackingMap;
