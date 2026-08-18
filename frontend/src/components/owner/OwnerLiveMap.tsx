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

export default function OwnerLiveMap() {
  const [partners, setPartners] = useState<User[]>([]);
  const [viewMode, setViewMode] = useState<'live' | 'heatmap'>('live');
  const storeStatus = useStoreStatus();

  // Generate some simulated heatmap points around the restaurant
  const heatmapData = useMemo(() => {
    const points = [];
    const maxRadius = storeStatus.deliveryRadiusKm || 5;
    for (let i = 0; i < 40; i++) {
      const radius = Math.random() * maxRadius * 0.8;
      const angle = Math.random() * Math.PI * 2;
      const lat = RESTAURANT_LOCATION.lat + (radius / 111) * Math.cos(angle);
      const lng = RESTAURANT_LOCATION.lng + (radius / (111 * Math.cos(RESTAURANT_LOCATION.lat * Math.PI / 180))) * Math.sin(angle);
      const intensity = Math.random();
      points.push({ lat, lng, intensity });
    }
    return points;
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'users'), where('role', '==', 'delivery_partner'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const livePartners = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
      setPartners(livePartners);
    });

    return () => unsubscribe();
  }, []);

  const activePartners = partners.filter(p => p.status === 'online');
  const totalOnline = activePartners.length;

  return (
    <div className="bg-[#1E293B] rounded-3xl shadow-sm border border-white/10 overflow-hidden col-span-full h-full flex flex-col">
      <div className="p-5 border-b border-white/10 flex justify-between items-center bg-[#0B0F14]/50">
        <h3 className="font-bold text-lg text-white">Live Delivery Map</h3>
        <div className="flex items-center gap-4">
          <div className="flex bg-dark-900 rounded-lg p-1 border border-white/10">
            <button 
              onClick={() => setViewMode('live')}
              className={`px-3 py-1 text-xs font-bold rounded-md ${viewMode === 'live' ? 'bg-primary-500 text-white' : 'text-slate-400'}`}
            >
              Live GPS
            </button>
            <button 
              onClick={() => setViewMode('heatmap')}
              className={`px-3 py-1 text-xs font-bold rounded-md ${viewMode === 'heatmap' ? 'bg-red-500 text-white' : 'text-slate-400'}`}
            >
              Heatmap
            </button>
          </div>
          {viewMode === 'live' && (
            <span className="bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-xs font-bold ring-1 ring-green-500/50">
              {totalOnline} Online
            </span>
          )}
        </div>
      </div>
      <div className="flex-1 w-full z-0 relative">
        <MapContainer 
          center={[RESTAURANT_LOCATION.lat, RESTAURANT_LOCATION.lng]} 
          zoom={13} 
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            attribution='&copy; CARTO &copy; OpenStreetMap'
            maxZoom={19}
          />
          <Marker position={[RESTAURANT_LOCATION.lat, RESTAURANT_LOCATION.lng]} icon={restaurantIcon}>
            <Popup>
              <div className="font-bold text-center">Olive Pizza (HQ)</div>
            </Popup>
          </Marker>
          {/* Delivery Radius */}
          <Circle 
            center={[RESTAURANT_LOCATION.lat, RESTAURANT_LOCATION.lng]}
            radius={(storeStatus.deliveryRadiusKm || 5) * 1000}
            pathOptions={{ color: '#55775a', fillColor: '#55775a', fillOpacity: 0.1, weight: 2 }}
          />
          {viewMode === 'live' ? (
            partners.map(partner => {
              if (!partner.liveLocation?.lat || !partner.liveLocation?.lng) return null;
              return (
                <Marker 
                  key={partner.id} 
                  position={[partner.liveLocation.lat, partner.liveLocation.lng]}
                  icon={partner.status === 'online' ? onlineIcon : offlineIcon}
                >
                  <Popup>
                    <div className="text-center font-bold p-2 min-w-[150px]">
                      <div className="flex items-center gap-2 justify-center mb-1">
                        <div className={`w-2 h-2 rounded-full ${partner.status === 'online' ? 'bg-green-500 animate-pulse' : 'bg-slate-500'}`} />
                        <span className="text-sm">{partner.name || 'Partner'}</span>
                      </div>
                      <div className="text-xs text-slate-500 capitalize">{partner.status}</div>
                      {partner.status === 'online' && (
                        <div className="text-[10px] text-slate-400 mt-2">
                          Updated: {new Date(partner.liveLocation.updatedAt).toLocaleTimeString()}
                        </div>
                      )}
                    </div>
                  </Popup>
                </Marker>
              );
            })
          ) : (
            heatmapData.map((point, idx) => (
              <Circle
                key={idx}
                center={[point.lat, point.lng]}
                radius={300 + (point.intensity * 500)}
                pathOptions={{ 
                  color: 'transparent', 
                  fillColor: point.intensity > 0.7 ? '#ef4444' : point.intensity > 0.4 ? '#f97316' : '#eab308', 
                  fillOpacity: 0.4 
                }}
              />
            ))
          )}
        </MapContainer>
      </div>
    </div>
  );
}
