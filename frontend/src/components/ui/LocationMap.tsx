import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { RESTAURANT_LOCATION, MAX_DELIVERY_RADIUS_KM } from '../../lib/config';
import { MapPin } from 'lucide-react';
import { restaurantIcon } from '../../lib/mapIcons';

// Fix Leaflet icons globally
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface LocationMapProps {
  className?: string;
  showRadius?: boolean;
}

export default function LocationMap({ className = "w-full h-64 md:h-96 rounded-2xl z-0", showRadius = false }: LocationMapProps) {
  const position: [number, number] = [RESTAURANT_LOCATION.lat, RESTAURANT_LOCATION.lng];

  return (
    <div className={`relative overflow-hidden border border-white/10 ${className}`}>
      <MapContainer 
        center={position} 
        zoom={13} 
        scrollWheelZoom={false}
        className="w-full h-full z-0"
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          attribution='&copy; CARTO &copy; OpenStreetMap'
          maxZoom={19}
        />
        <Marker position={position} icon={restaurantIcon}>
          <Popup>
            <div className="font-bold text-slate-800">Olive Pizza</div>
            <div className="text-xs text-slate-600">Gokul Nagar, Rajnandgaon</div>
          </Popup>
        </Marker>
        {showRadius && (
          <Circle 
            center={position}
            radius={MAX_DELIVERY_RADIUS_KM * 1000}
            pathOptions={{ color: '#55775a', fillColor: '#55775a', fillOpacity: 0.1, weight: 2 }}
          />
        )}
      </MapContainer>
    </div>
  );
}


