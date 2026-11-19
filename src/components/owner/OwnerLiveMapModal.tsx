/**
 * OwnerLiveMapModal — Real-time 3D rider tracking for the Owner panel
 *
 * Opens as a full-screen modal when the "Track Live" button is clicked
 * on an active order in OwnerOrders. Subscribes to the backend WebSocket
 * and Redis live telemetry stream and renders the rider + restaurant + customer on
 * a MapLibre 3D map in real-time.
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MapPin, Navigation, Clock, Zap, RefreshCw } from 'lucide-react';
import { auth } from '../../lib/firebase';
import { RESTAURANT_LOCATION, fetchApi, getWebSocketUrl } from '../../lib/config';
import UniversalMap3D from '../map/UniversalMap3D';
import type { MapMarker } from '../map/UniversalMap3D';

// ─── Types ────────────────────────────────────────────────────────────────────

interface OwnerLiveMapModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: {
    id: string;
    dailyOrderNumber?: string;
    deliveryPartnerId?: string;
    deliveryAddress?: {
      addressLine?: string;
      lat?: number;
      lng?: number;
    };
    status: string;
  };
}

interface RiderLocation {
  latitude: number;
  longitude: number;
  heading: number | null;
  speed: number | null;
  last_updated: string;
  online_status: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function OwnerLiveMapModal({ isOpen, onClose, order }: OwnerLiveMapModalProps) {
  const [riderLocation, setRiderLocation] = useState<RiderLocation | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [isStale, setIsStale] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const staleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Build markers ──────────────────────────────────────────────────────────
  const markers: MapMarker[] = [];

  // Restaurant
  markers.push({
    id: 'restaurant',
    position: { lat: RESTAURANT_LOCATION.lat, lng: RESTAURANT_LOCATION.lng },
    type: 'restaurant',
    label: 'Olive Pizza',
  });

  // Customer destination (if we have coords)
  const destLat = order.deliveryAddress?.lat;
  const destLng = order.deliveryAddress?.lng;
  if (destLat && destLng) {
    markers.push({
      id: 'customer',
      position: { lat: destLat, lng: destLng },
      type: 'customer',
      label: order.deliveryAddress?.addressLine || 'Delivery Address',
    });
  }

  // Rider
  if (riderLocation) {
    markers.push({
      id: 'rider',
      position: { lat: riderLocation.latitude, lng: riderLocation.longitude },
      type: 'rider',
      heading: riderLocation.heading || 0,
    });
  }

  // ── Subscribe to Backend WebSocket & Redis Telemetry ─────────────────────────
  const markStale = useCallback(() => {
    setIsStale(true);
  }, []);

  useEffect(() => {
    if (!isOpen || !order.deliveryPartnerId) return;

    let isUnmounted = false;
    let ws: WebSocket | null = null;
    let reconnectTimer: any = null;
    let pollingInterval: any = null;

    // A. Initial fetch via backend REST API (Redis / Tracking service)
    const fetchInitial = async () => {
      try {
        // 1. Try order tracking endpoint
        const orderRes = await fetchApi(`/api/tracking/order/${order.id}`);
        if (orderRes.ok) {
          const data = await orderRes.json();
          if (data && data.partner_lat != null && data.partner_lng != null) {
            if (!isUnmounted) {
              setRiderLocation({
                latitude: Number(data.partner_lat),
                longitude: Number(data.partner_lng),
                heading: data.heading != null ? Number(data.heading) : 0,
                speed: data.speed != null ? Number(data.speed) : 0,
                last_updated: data.last_updated || new Date().toISOString(),
                online_status: true,
              });
              setLastUpdate(new Date());
              setIsStale(false);
            }
            return;
          }
        }

        // 2. Fallback to direct rider location endpoint
        if (order.deliveryPartnerId) {
          const partnerRes = await fetchApi(`/api/tracking/location/${order.deliveryPartnerId}`);
          if (partnerRes.ok) {
            const pData = await partnerRes.json();
            const lat = pData.latitude ?? pData.lat;
            const lng = pData.longitude ?? pData.lng;
            if (lat != null && lng != null && !isUnmounted) {
              setRiderLocation({
                latitude: Number(lat),
                longitude: Number(lng),
                heading: pData.heading ?? pData.bearing ?? 0,
                speed: pData.speed || 0,
                last_updated: pData.updated_at || pData.last_updated || new Date().toISOString(),
                online_status: pData.online_status !== false,
              });
              setLastUpdate(new Date());
              setIsStale(false);
            }
          }
        }
      } catch (err) {
        console.warn('[OwnerLiveMapModal] Initial telemetry fetch notice:', err);
      }
    };

    fetchInitial();
    // 10s resilient polling backup while modal is open
    pollingInterval = setInterval(fetchInitial, 10000);

    // B. Realtime WebSocket subscription to backend live tracking stream (<5ms latency)
    const connectWs = () => {
      try {
        const wsUrl = getWebSocketUrl();
        ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = async () => {
          try {
            const token = await auth.currentUser?.getIdToken();
            if (token && ws?.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'auth', token }));
            }
            if (ws?.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'subscribe_order', orderId: order.id }));
            }
          } catch (authErr) {
            console.warn('[OwnerLiveMapModal] WS auth notice:', authErr);
          }
        };

        ws.onmessage = (event) => {
          try {
            const payload = JSON.parse(event.data);
            if (
              (payload.type === 'driver.location_update' ||
               payload.type === 'fleet_location_update' ||
               payload.type === 'driver_location') &&
              payload.data
            ) {
              const row = payload.data;
              const partnerId = row.deliveryPartnerId || row.delivery_partner_id;
              const matchesOrder = row.orderId === order.id;
              const matchesPartner = order.deliveryPartnerId && partnerId === order.deliveryPartnerId;

              if (matchesOrder || matchesPartner) {
                const lat = row.lat ?? row.latitude;
                const lng = row.lng ?? row.longitude;
                if (lat != null && lng != null && !isUnmounted) {
                  setRiderLocation({
                    latitude: Number(lat),
                    longitude: Number(lng),
                    heading: row.heading !== undefined ? Number(row.heading) : null,
                    speed: row.speed !== undefined ? Number(row.speed) : null,
                    last_updated: row.timestamp ? String(row.timestamp) : new Date().toISOString(),
                    online_status: row.status !== 'OFFLINE' && row.online_status !== false,
                  });
                  setLastUpdate(new Date());
                  setIsStale(false);

                  // Reset stale timer — if no update in 30s, show stale indicator
                  if (staleTimerRef.current) clearTimeout(staleTimerRef.current);
                  staleTimerRef.current = setTimeout(markStale, 30_000);
                }
              }
            }
          } catch (err) {
            // Ignore non-JSON frames
          }
        };

        ws.onclose = () => {
          if (!isUnmounted && isOpen) {
            reconnectTimer = setTimeout(connectWs, 5000);
          }
        };
      } catch (wsErr) {
        console.warn('[OwnerLiveMapModal] WS connection notice:', wsErr);
      }
    };

    connectWs();
    staleTimerRef.current = setTimeout(markStale, 30_000);

    return () => {
      isUnmounted = true;
      if (staleTimerRef.current) clearTimeout(staleTimerRef.current);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (pollingInterval) clearInterval(pollingInterval);
      if (ws) {
        try {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'unsubscribe_order', orderId: order.id }));
          }
          ws.close();
        } catch {}
        wsRef.current = null;
      }
    };
  }, [isOpen, order.deliveryPartnerId, order.id, markStale]);

  // ── ETA & Distance display ─────────────────────────────────────────────────
  const speedKmh = riderLocation?.speed ? Math.round(riderLocation.speed * 3.6) : null;

  const formatUpdateTime = (date: Date) => {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 10) return 'Just now';
    if (seconds < 60) return `${seconds}s ago`;
    return `${Math.floor(seconds / 60)}m ago`;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* Modal */}
          <motion.div
            className="relative w-full max-w-2xl mx-4 mb-0 sm:mb-0 bg-[#0f172a] border border-white/10 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col"
            style={{ maxHeight: '92vh' }}
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 flex-shrink-0">
              <div>
                <h2 className="font-bold text-white text-lg">
                  🗺️ Live Tracking
                </h2>
                <p className="text-slate-400 text-sm mt-0.5">
                  {order.dailyOrderNumber || `Order #${order.id?.slice(-6)?.toUpperCase()}`}
                  {order.deliveryPartnerId ? ` • Partner Assigned` : ''}
                </p>
              </div>
              <button
                onClick={onClose}
                className="w-9 h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Map */}
            <div className="flex-1 relative" style={{ minHeight: 360 }}>
              {!order.deliveryPartnerId ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#0f172a] text-center px-8">
                  <MapPin size={32} className="text-slate-600" />
                  <p className="text-slate-400 text-sm">No delivery partner assigned yet.</p>
                  <p className="text-slate-500 text-xs">Live tracking will appear once a partner is assigned.</p>
                </div>
              ) : (
                <UniversalMap3D
                  mode="owner"
                  center={riderLocation ? { lat: riderLocation.latitude, lng: riderLocation.longitude } : { lat: RESTAURANT_LOCATION.lat, lng: RESTAURANT_LOCATION.lng }}
                  markers={markers}
                  zoom={14}
                  className="w-full h-full"
                />
              )}
            </div>

            {/* Status bar */}
            <div className="flex items-center justify-between px-5 py-3 bg-[#1e293b] border-t border-white/10 flex-shrink-0 flex-wrap gap-2">
              {/* Rider speed */}
              <div className="flex items-center gap-2 text-sm">
                <Zap size={14} className="text-primary-400" />
                <span className="text-white font-semibold">
                  {speedKmh != null ? `${speedKmh} km/h` : '—'}
                </span>
                <span className="text-slate-500 text-xs">speed</span>
              </div>

              {/* Last update */}
              <div className="flex items-center gap-1.5 text-xs">
                {isStale ? (
                  <span className="flex items-center gap-1 text-amber-400">
                    <RefreshCw size={11} />
                    Signal lost
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-emerald-400">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    {lastUpdate ? formatUpdateTime(lastUpdate) : 'Connecting…'}
                  </span>
                )}
              </div>

              {/* Status */}
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <Navigation size={11} className="text-primary-400" />
                {order.status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
