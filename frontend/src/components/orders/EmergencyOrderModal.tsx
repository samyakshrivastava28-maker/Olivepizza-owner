import React, { useEffect } from 'react';
import { Order } from '../../types/models';
import { AlertCircle, CheckCircle2, Volume2, ArrowRight } from 'lucide-react';
import { soundPlayer } from '../../lib/audio';
import { useOwnerSettingsStore } from '../../lib/store';
import { Link } from 'react-router';

interface EmergencyOrderModalProps {
  order: Order | null;
  onAccept: (orderId: string) => void;
  onDismiss: () => void;
}

export const EmergencyOrderModal: React.FC<EmergencyOrderModalProps> = ({
  order,
  onAccept,
  onDismiss,
}) => {
  const repeatInterval = useOwnerSettingsStore((s) => s.repeatAlarmIntervalSeconds);

  useEffect(() => {
    if (!order) return;

    soundPlayer.playNewOrderAlarm();
    const interval = setInterval(() => {
      soundPlayer.playNewOrderAlarm();
    }, (repeatInterval || 30) * 1000);

    return () => clearInterval(interval);
  }, [order, repeatInterval]);

  if (!order) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
      <div className="w-full max-w-lg bg-[#131B2B] border-2 border-orange-500/80 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-orange-500/20 text-center relative overflow-hidden">
        <div className="w-16 h-16 rounded-full bg-orange-500/20 text-orange-400 flex items-center justify-center mx-auto mb-4 animate-bounce">
          <AlertCircle className="w-9 h-9" />
        </div>

        <span className="text-xs font-black px-3 py-1 bg-orange-500 text-white rounded-full uppercase tracking-wider">
          New Customer Order
        </span>

        <h2 className="text-2xl font-extrabold text-white mt-3 mb-1">
          {order.dailyOrderNumber ? `Order #${order.dailyOrderNumber}` : 'Incoming Order'}
        </h2>
        <p className="text-slate-400 text-sm">
          {order.customerName} • {order.customerPhone}
        </p>

        <div className="my-5 p-4 rounded-2xl bg-[#0E1524] border border-slate-800 text-left space-y-2 max-h-44 overflow-y-auto">
          {order.items.map((it, idx) => (
            <div key={idx} className="flex justify-between items-center text-sm">
              <span className="text-slate-200 font-medium">
                {it.quantity}x {it.name}
              </span>
              <span className="text-orange-400 font-mono font-bold">₹{it.price * it.quantity}</span>
            </div>
          ))}
          <div className="pt-2 border-t border-slate-800 flex justify-between items-center text-sm font-bold text-white">
            <span>Total Payable</span>
            <span className="text-emerald-400 font-mono text-base">₹{order.totalAmount}</span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => onAccept(order.id)}
            className="flex-1 py-3 px-5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-600/30"
          >
            <CheckCircle2 className="w-5 h-5" />
            Accept & Prepare
          </button>
          <button
            onClick={onDismiss}
            className="py-3 px-5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-2xl transition-colors"
          >
            Dismiss Sound
          </button>
        </div>
      </div>
    </div>
  );
};
