import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, ShoppingBag, ArrowRight, CheckCircle2, Volume2, VolumeX, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router';
import { playNotificationSound } from '../../hooks/useNotificationSound';
import toast from 'react-hot-toast';

interface NewOrderAlertProps {
  order: any | null;
  onClose: () => void;
  onAccept?: (order: any) => void;
}

export default function NewOrderEmergencyOverlay({ order, onClose, onAccept }: NewOrderAlertProps) {
  const navigate = useNavigate();
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    if (!order) return;
    
    // Play loud new order notification sound
    if (!isMuted) {
      playNotificationSound('new_order');
    }

    // Repeat alarm every 4 seconds until owner interacts
    const interval = setInterval(() => {
      if (!isMuted) {
        playNotificationSound('new_order');
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [order, isMuted]);

  if (!order || (order.status && !['pending', 'placed', 'created', 'new_order'].includes(order.status))) return null;

  const orderNumber = order.dailyOrderNumber 
    ? `#${order.dailyOrderNumber}` 
    : order.id ? `#${order.id.slice(-6).toUpperCase()}` : '#NEW';

  const handleGoToLiveOrders = () => {
    onClose();
    navigate('/owner/live-orders');
  };

  const handleAcceptNow = () => {
    if (onAccept) {
      onAccept(order);
    }
    onClose();
    navigate('/owner/live-orders');
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] bg-slate-950/90 backdrop-blur-2xl flex items-center justify-center p-4 md:p-6"
      >
        {/* Pulsing Red/Gold Emergency Ring */}
        <div className="absolute inset-0 bg-gradient-to-tr from-red-500/20 via-primary-500/15 to-orange-500/20 animate-pulse pointer-events-none" />

        <motion.div
          initial={{ scale: 0.85, y: 30 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.85, y: 30 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative max-w-lg w-full bg-slate-900 border-2 border-primary-500/50 rounded-3xl p-6 md:p-8 shadow-[0_0_80px_rgba(234,88,12,0.3)] overflow-hidden text-white z-10"
        >
          {/* Header Badge */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-primary-500/20 border border-primary-500/40 text-primary-400 animate-bounce">
                <Bell className="w-7 h-7" />
              </div>
              <div>
                <span className="text-xs font-black uppercase tracking-widest text-primary-400">Emergency Alert</span>
                <h2 className="text-2xl font-black text-white">NEW ORDER RECEIVED!</h2>
              </div>
            </div>
            <button
              onClick={() => setIsMuted(!isMuted)}
              className="p-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 transition-colors"
              title={isMuted ? "Unmute Alarm" : "Mute Alarm"}
            >
              {isMuted ? <VolumeX className="w-5 h-5 text-red-400" /> : <Volume2 className="w-5 h-5 text-green-400 animate-pulse" />}
            </button>
          </div>

          {/* Order Details Card */}
          <div className="bg-slate-950/70 border border-white/10 rounded-2xl p-5 mb-6 space-y-3">
            <div className="flex justify-between items-baseline border-b border-white/10 pb-3">
              <span className="text-2xl font-black text-primary-400">{orderNumber}</span>
              <span className="text-xl font-bold text-white">₹{order.totalAmount || order.total || 0}</span>
            </div>

            <div className="text-sm space-y-1 text-slate-300">
              <p><strong className="text-white">Customer:</strong> {order.customerName || order.contactName || 'Gourmet Customer'}</p>
              <p><strong className="text-white">Phone:</strong> {order.contactPhone || 'N/A'}</p>
              <p className="line-clamp-2"><strong className="text-white">Address:</strong> {order.deliveryAddress?.addressLine || order.address || 'Store Pickup'}</p>
            </div>

            {/* Items Summary */}
            {order.items && order.items.length > 0 && (
              <div className="pt-2 border-t border-white/10 flex flex-wrap gap-1.5">
                {order.items.slice(0, 4).map((item: any, idx: number) => (
                  <span key={idx} className="text-xs bg-white/5 border border-white/10 px-2.5 py-1 rounded-lg text-slate-300">
                    {item.quantity}x {item.name}
                  </span>
                ))}
                {order.items.length > 4 && (
                  <span className="text-xs bg-primary-500/20 text-primary-400 font-bold px-2 py-1 rounded-lg">
                    +{order.items.length - 4} more
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleAcceptNow}
              className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-black py-4 px-6 rounded-2xl shadow-lg transition-transform hover:-translate-y-0.5 active:scale-95 flex items-center justify-center gap-2 text-base cursor-pointer"
            >
              <CheckCircle2 className="w-5 h-5" /> Accept Order Now
            </button>
            <button
              onClick={handleGoToLiveOrders}
              className="flex-1 bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-500 hover:to-primary-400 text-white font-black py-4 px-6 rounded-2xl shadow-lg transition-transform hover:-translate-y-0.5 active:scale-95 flex items-center justify-center gap-2 text-base cursor-pointer"
            >
              <ArrowRight className="w-5 h-5" /> Go to Live Orders
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
