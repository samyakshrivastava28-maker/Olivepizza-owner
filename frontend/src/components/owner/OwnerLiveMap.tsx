import { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { db } from '../../lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { User } from '../../types/models';
import { RESTAURANT_LOCATION } from '../../lib/config';
import { restaurantIcon } from '../../lib/mapIcons';
import { useStoreStatus } from '../../lib/useStoreStatus';

// Fix leaflet icon issue in React
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom icons
const onlineIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/2972/2972185.png',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32],
});

const offlineIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/2972/2972185.png',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32],
  className: 'grayscale opacity-50'
});

interface DeliveryPoint {
  lat: number;
  lng: number;
  orderId: string;
}

function getFreshnessBadge(isoDate?: string | null): { label: string; colorClass: string } {
  if (!isoDate) return { label: 'OFFLINE', colorClass: 'bg-slate-700 text-slate-300' };
  const ageMs = Date.now() - new Date(isoDate).getTime();
  if (isNaN(ageMs) || ageMs < 0) return { label: 'OFFLINE', colorClass: 'bg-slate-700 text-slate-300' };
  if (ageMs <= 30 * 1000) return { label: 'LIVE (<30s)', colorClass: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' };
  if (ageMs <= 2 * 60 * 1000) return { label: 'RECENT (<2m)', colorClass: 'bg-amber-500/20 text-amber-400 border-amber-500/40' };
  if (ageMs <= 10 * 60 * 1000) return { label: 'STALE (<10m)', colorClass: 'bg-orange-500/20 text-orange-400 border-orange-500/40' };
  return { label: 'OFFLINE', colorClass: 'bg-slate-800 text-slate-400 border-slate-700' };
}

export default function OwnerLiveMap() {
  const [partners, setPartners] = useState<User[]>([]);
  const [telemetryMap, setTelemetryMap] = useState<Record<string, any>>({});
  const [deliveryPoints, setDeliveryPoints] = useState<DeliveryPoint[]>([]);
  const [viewMode, setViewMode] = useState<'live' | 'heatmap'>('live');
  const storeStatus = useStoreStatus();

  // 1. Subscribe to delivery partner profiles
  useEffect(() => {
    const q = query(collection(db, 'users'), where('role', 'in', ['delivery_partner', 'delivery']));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const livePartners = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
      setPartners(livePartners);
    });

    return () => unsubscribe();
  }, []);

  // 2. Subscribe to real-time delivery telemetry
  useEffect(() => {
    const unsubLoc = onSnapshot(collection(db, 'delivery_locations'), (snapshot) => {
      const map: Record<string, any> = {};
      snapshot.forEach((d) => {
        map[d.id] = d.data();
      });
      setTelemetryMap(map);
    });

    return () => unsubLoc();
  }, []);

  // 3. Load REAL completed delivery locations for genuine customer density heatmap
  useEffect(() => {
    const qOrders = query(collection(db, 'orders'));
    const unsubOrders = onSnapshot(qOrders, (snapshot) => {
      const pts: DeliveryPoint[] = [];
      snapshot.forEach((d) => {
        const order = d.data();
        const lat = order.deliveryAddressCoordinates?.lat ?? 
                    order.deliveryAddress?.lat ?? 
                    order.deliveryLocation?.lat ?? 
                    order.lat;
        const lng = order.deliveryAddressCoordinates?.lng ?? 
                    order.deliveryAddress?.lng ?? 
                    order.deliveryLocation?.lng ?? 
                    order.lng;
        if (lat !== undefined && lng !== undefined && !isNaN(Number(lat)) && !isNaN(Number(lng))) {
          pts.push({ lat: Number(lat), lng: Number(lng), orderId: d.id });
        }
      });
      setDeliveryPoints(pts);
    });

    return () => unsubOrders();
  }, []);

  const activePartners = partners.filter(p => p.status === 'online' || p.isOnline);
  const totalOnline = activePartners.length;

  return (
    <div className="bg-[#1E293B] rounded-3xl shadow-sm border border-white/10 overflow-hidden col-span-full h-full flex flex-col">
      <div className="p-5 border-b border-white/10 flex flex-wrap justify-between items-center gap-3 bg-[#0B0F14]/50">
        <div>
          <h3 className="font-bold text-lg text-white">Live Store Fleet & Radar Map</h3>
          <p className="text-xs text-slate-400">OpenStreetMap GPS telemetry and delivery density</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex bg-dark-900 rounded-lg p-1 border border-white/10">
            <button 
              onClick={() => setViewMode('live')}
              className={`px-3 py-1 text-xs font-bold rounded-md ${viewMode === 'live' ? 'bg-primary-500 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
            >
              Live Fleet GPS
            </button>
            <button 
              onClick={() => setViewMode('heatmap')}
              className={`px-3 py-1 text-xs font-bold rounded-md ${viewMode === 'heatmap' ? 'bg-amber-500 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
            >
              Order Density ({deliveryPoints.length})
            </button>
          </div>
          {viewMode === 'live' && (
            <span className="bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-xs font-bold ring-1 ring-green-500/50 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              {totalOnline} Online
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 w-full z-0 relative min-h-[420px]">
        {viewMode === 'heatmap' && deliveryPoints.length === 0 && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 bg-slate-900/90 border border-slate-700 text-slate-300 text-xs px-4 py-2 rounded-xl backdrop-blur-md shadow-xl">
            No historical delivery locations recorded yet. Complete customer deliveries to populate density map.
          </div>
        )}

        <MapContainer 
          center={[RESTAURANT_LOCATION.lat, RESTAURANT_LOCATION.lng]} 
          zoom={13} 
          style={{ height: '100%', width: '100%' }}
        >
          {/* Standard OpenStreetMap Tiles */}
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors'
            maxZoom={19}
          />

          {/* Restaurant HQ Marker */}
          <Marker position={[RESTAURANT_LOCATION.lat, RESTAURANT_LOCATION.lng]} icon={restaurantIcon}>
            <Popup>
              <div className="font-bold text-center text-xs">
                Olive Pizza (Rajnandgaon HQ)<br />
                <span className="text-slate-500 font-normal">Dedicated Delivery Base</span>
              </div>
            </Popup>
          </Marker>

          {/* Delivery Radius Circle */}
          <Circle 
            center={[RESTAURANT_LOCATION.lat, RESTAURANT_LOCATION.lng]}
            radius={(storeStatus.deliveryRadiusKm || 5) * 1000}
            pathOptions={{ color: '#55775a', fillColor: '#55775a', fillOpacity: 0.08, weight: 1.5, dashArray: '6, 6' }}
          />

          {viewMode === 'live' ? (
            partners.map(partner => {
              const telemetry = telemetryMap[partner.id] || {};
              const lat = telemetry.latitude ?? partner.liveLocation?.lat;
              const lng = telemetry.longitude ?? partner.liveLocation?.lng;

              if (lat === undefined || lng === undefined || isNaN(Number(lat)) || isNaN(Number(lng))) {
                return null;
              }

              const isOnline = partner.status === 'online' || partner.isOnline;
              const lastUpdated = telemetry.updated_at || telemetry.last_updated || partner.liveLocation?.updatedAt;
              const freshness = getFreshnessBadge(lastUpdated);

              return (
                <Marker 
                  key={partner.id} 
                  position={[Number(lat), Number(lng)]}
                  icon={isOnline ? onlineIcon : offlineIcon}
                >
                  <Popup>
                    <div className="text-center font-bold p-2 min-w-[170px]">
                      <div className="flex items-center gap-2 justify-center mb-1">
                        <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500 animate-pulse' : 'bg-slate-500'}`} />
                        <span className="text-sm">{partner.name || 'Partner'}</span>
                      </div>
                      <div className="text-xs text-slate-500 capitalize">{isOnline ? (partner.status || 'online') : 'offline'}</div>
                      <div className="text-[11px] text-slate-400 mt-1">{partner.phone || 'No phone'}</div>
                      <div className="mt-2">
                        <span className={`text-[10px] px-2 py-0.5 rounded-md font-mono border ${freshness.colorClass}`}>
                          GPS: {freshness.label}
                        </span>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              );
            })
          ) : (
            deliveryPoints.map((point) => (
              <Circle
                key={point.orderId}
                center={[point.lat, point.lng]}
                radius={250}
                pathOptions={{ 
                  color: 'transparent', 
                  fillColor: '#f97316', 
                  fillOpacity: 0.35 
                }}
              />
            ))
          )}
        </MapContainer>
      </div>
    </div>
  );
}
