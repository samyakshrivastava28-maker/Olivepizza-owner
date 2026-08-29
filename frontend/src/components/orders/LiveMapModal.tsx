import React from 'react';
import { Modal } from '../ui/Modal';
import { Order, DeliveryPartner } from '../../types/models';
import { MapPin, Navigation, Phone } from 'lucide-react';

interface LiveMapModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
  partner?: DeliveryPartner | null;
}

export const LiveMapModal: React.FC<LiveMapModalProps> = ({
  isOpen,
  onClose,
  order,
  partner,
}) => {
  if (!order) return null;

  const restLat = 21.0810244;
  const restLng = 81.0123793;
  const custLat = order.deliveryAddress?.lat || 21.096;
  const custLng = order.deliveryAddress?.lng || 81.025;
  const riderLat = partner?.currentLat || (restLat + custLat) / 2;
  const riderLng = partner?.currentLng || (restLng + custLng) / 2;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Live Tracking — Order #${order.dailyOrderNumber || order.id.slice(0, 6)}`}
      maxWidth="max-w-4xl"
    >
      <div className="space-y-4">
        {/* Map placeholder / OpenStreetMap iframe */}
        <div className="relative w-full h-80 rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden">
          <iframe
            title="Delivery Map"
            width="100%"
            height="100%"
            frameBorder="0"
            scrolling="no"
            src={`https://www.openstreetmap.org/export/embed.html?bbox=${Math.min(restLng, custLng, riderLng) - 0.02}%2C${Math.min(restLat, custLat, riderLat) - 0.02}%2C${Math.max(restLng, custLng, riderLng) + 0.02}%2C${Math.max(restLat, custLat, riderLat) + 0.02}&layer=mapnik&marker=${riderLat}%2C${riderLng}`}
            className="w-full h-full filter invert-[0.9] hue-rotate-180 contrast-125"
          />
          <div className="absolute top-3 left-3 bg-[#0B0F17]/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-800 text-xs font-bold text-emerald-400 flex items-center gap-1.5 shadow-lg">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Live Rider GPS: {riderLat.toFixed(4)}, {riderLng.toFixed(4)}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 rounded-2xl bg-[#0E1524] border border-slate-800">
            <h4 className="text-xs font-bold text-slate-400 uppercase mb-2 flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-orange-400" />
              Customer Destination
            </h4>
            <p className="text-sm font-bold text-white">{order.customerName}</p>
            <p className="text-xs text-slate-300 mt-1">{order.deliveryAddress?.address}</p>
            <p className="text-xs text-orange-400 font-mono mt-1">📞 {order.customerPhone}</p>
          </div>

          <div className="p-4 rounded-2xl bg-[#0E1524] border border-slate-800">
            <h4 className="text-xs font-bold text-slate-400 uppercase mb-2 flex items-center gap-1.5">
              <Navigation className="w-4 h-4 text-blue-400" />
              Assigned Delivery Partner
            </h4>
            {partner || (order as any).deliveryPartnerName ? (
              <div>
                <p className="text-sm font-bold text-white">{partner?.name || (order as any).deliveryPartnerName}</p>
                <p className="text-xs text-slate-400">
                  {partner?.vehicleType || 'Motorcycle'} • {partner?.vehicleNumber || 'Registered'}
                </p>
                <p className="text-xs text-blue-400 font-mono mt-1">
                  📞 {partner?.phone || (order as any).deliveryPartnerPhone || 'Available'}
                </p>
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic">No delivery partner assigned yet.</p>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};
