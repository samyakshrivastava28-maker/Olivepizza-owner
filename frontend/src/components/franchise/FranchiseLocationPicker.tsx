import React, { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Search, MapPin, Navigation, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

// Fix for default Leaflet icon in React
const customIcon = L.divIcon({
  className: 'custom-leaflet-marker',
  html: '<div style="background: linear-gradient(135deg, #f59e0b, #d97706); width: 32px; height: 32px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(245, 158, 11, 0.4); border: 2px solid white;"><div style="width: 10px; height: 10px; background: white; border-radius: 50%; transform: rotate(45deg);"></div></div>',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32]
});

interface LocationPickerProps {
  lat: number;
  lng: number;
  address: string;
  onChange: (lat: number, lng: number, address?: string) => void;
}

function MapEventsHandler({ onLocationSelect }: { onLocationSelect: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onLocationSelect(e.latlng.lat, e.latlng.lng);
    }
  });
  return null;
}

function MapRecenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMapEvents({});
  useEffect(() => {
    map.flyTo([lat, lng], map.getZoom() < 14 ? 15 : map.getZoom());
  }, [lat, lng, map]);
  return null;
}

export const FranchiseLocationPicker: React.FC<LocationPickerProps> = ({
  lat,
  lng,
  address,
  onChange
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isGeolocating, setIsGeolocating] = useState(false);

  const markerPosition = useMemo<[number, number]>(() => {
    const validLat = typeof lat === 'number' && !isNaN(lat) ? lat : 21.0810244;
    const validLng = typeof lng === 'number' && !isNaN(lng) ? lng : 81.0123793;
    return [validLat, validLng];
  }, [lat, lng]);

  const handleSearchNominatim = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      // Free OpenStreetMap Nominatim Geocoding API (India bounded)
      const url = 'https://nominatim.openstreetmap.org/search?format=json&q=' + encodeURIComponent(searchQuery.trim()) + '&countrycodes=in&limit=1';
      const res = await fetch(url, {
        headers: {
          'Accept-Language': 'en'
        }
      });
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const item = data[0];
        const newLat = parseFloat(item.lat);
        const newLng = parseFloat(item.lon);
        onChange(newLat, newLng, item.display_name);
        toast.success('Found: ' + item.display_name.split(',').slice(0, 2).join(','));
      } else {
        toast.error('Location not found in OpenStreetMap. Try specifying city or landmark.');
      }
    } catch (err: any) {
      toast.error('Failed to search location: ' + err.message);
    } finally {
      setIsSearching(false);
    }
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      return;
    }
    setIsGeolocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const newLat = pos.coords.latitude;
        const newLng = pos.coords.longitude;
        onChange(newLat, newLng);
        toast.success('Position updated from device GPS');
        setIsGeolocating(false);
      },
      (err) => {
        toast.error('GPS error: ' + err.message);
        setIsGeolocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <div className="space-y-3">
      {/* Search Bar on OpenStreetMap */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search address or area via OpenStreetMap (e.g. Rajnandgaon, Dongargaon Rd)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearchNominatim(e)}
            className="w-full pl-9 pr-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
          />
        </div>
        <button
          type="button"
          onClick={() => handleSearchNominatim()}
          disabled={isSearching || !searchQuery.trim()}
          className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
        >
          {isSearching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
          <span>Search</span>
        </button>
        <button
          type="button"
          onClick={handleUseCurrentLocation}
          disabled={isGeolocating}
          className="px-3 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 font-bold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer"
          title="Use Current Device GPS"
        >
          {isGeolocating ? <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" /> : <Navigation className="w-3.5 h-3.5 text-amber-400" />}
          <span className="hidden sm:inline">My GPS</span>
        </button>
      </div>

      {/* Leaflet Map Canvas */}
      <div className="relative w-full h-64 sm:h-72 rounded-2xl overflow-hidden border border-slate-800 shadow-inner z-0">
        <MapContainer
          center={markerPosition}
          zoom={15}
          scrollWheelZoom={true}
          style={{ height: '100%', width: '100%', background: '#090d16' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Marker
            position={markerPosition}
            icon={customIcon}
            draggable={true}
            eventHandlers={{
              dragend(e) {
                const marker = e.target;
                const position = marker.getLatLng();
                onChange(position.lat, position.lng);
              }
            }}
          />
          <MapEventsHandler onLocationSelect={(clickLat, clickLng) => onChange(clickLat, clickLng)} />
          <MapRecenter lat={markerPosition[0]} lng={markerPosition[1]} />
        </MapContainer>

        <div className="absolute bottom-2 left-2 z-[400] bg-slate-950/80 backdrop-blur-sm px-2.5 py-1 rounded-lg border border-slate-800 text-[10px] text-slate-400 flex items-center gap-1">
          <MapPin className="w-3 h-3 text-amber-400" />
          <span>Click map or drag marker to set exact location</span>
        </div>
      </div>

      {/* Coordinates readout */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2">
          <span className="text-[10px] text-slate-500 block uppercase font-mono">Latitude</span>
          <span className="font-mono text-amber-400">{markerPosition[0].toFixed(6)}</span>
        </div>
        <div className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2">
          <span className="text-[10px] text-slate-500 block uppercase font-mono">Longitude</span>
          <span className="font-mono text-amber-400">{markerPosition[1].toFixed(6)}</span>
        </div>
      </div>
    </div>
  );
};
