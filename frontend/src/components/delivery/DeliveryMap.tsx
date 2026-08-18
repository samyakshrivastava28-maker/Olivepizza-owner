import React from 'react';
import { MapContainer, TileLayer, Marker, Polyline } from 'react-leaflet';
import L from 'leaflet';
import "leaflet/dist/leaflet.css";
import { restaurantIcon } from '../../lib/mapIcons';
import { useTrackingStore } from '../../lib/trackingStore';

const pulsingIcon = new L.DivIcon({
  className: "custom-div-icon",
  html: `<div class="relative flex h-6 w-6"><span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span><span class="relative inline-flex rounded-full h-6 w-6 bg-blue-600 border-2 border-white shadow-lg flex items-center justify-center"><div class="w-2 h-2 bg-white rounded-full"></div></span></div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

interface DeliveryMapProps {
  destinationLat?: number;
  destinationLng?: number;
}

import { RESTAURANT_LOCATION } from '../../lib/config';

const DeliveryMap = React.memo(({ destinationLat, destinationLng }: DeliveryMapProps) => {
  const location = useTrackingStore((state) => state.location);
  const targetLat = destinationLat || RESTAURANT_LOCATION.lat;
  const targetLng = destinationLng || RESTAURANT_LOCATION.lng;

  return (
    <MapContainer 
      center={[targetLat, targetLng]} 
      zoom={15} 
      style={{ height: "100%", width: "100%" }} 
      zoomControl={false} 
      dragging={false}
    >
      <TileLayer 
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" 
        attribution="&copy; CARTO" 
      />
      <Marker position={[targetLat, targetLng]} icon={restaurantIcon} />
      
      {location && (
        <>
          <Marker position={[location.lat, location.lng]} icon={pulsingIcon} />
          <Polyline 
            positions={[[location.lat, location.lng], [targetLat, targetLng]]} 
            color="#3b82f6" 
            weight={4} 
            dashArray="5, 10" 
            className="animate-pulse" 
          />
        </>
      )}
    </MapContainer>
  );
});

export default DeliveryMap;
