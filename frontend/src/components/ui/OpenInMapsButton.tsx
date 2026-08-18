import { MapPin } from 'lucide-react';
import { RESTAURANT_LOCATION } from '../../lib/config';

export function OpenInMapsButton({ className = "" }: { className?: string }) {
  return (
    <a 
      href={`https://www.google.com/maps/dir/?api=1&destination=${RESTAURANT_LOCATION.lat},${RESTAURANT_LOCATION.lng}`}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-2 bg-primary-600 hover:bg-primary-500 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-lg active:scale-95 ${className}`}
    >
      <MapPin className="w-5 h-5" />
      Get Directions
    </a>
  );
}
