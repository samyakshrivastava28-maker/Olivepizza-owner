import { useEffect, useState } from 'react';
import { DeliveryAlarmManager, DeliveryAlarmState } from '../../services/DeliveryAlarmManager';
import { motion, AnimatePresence } from 'framer-motion';
import { Bike, Navigation } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useAuthStore } from '../../lib/store';

export default function DeliveryAlertManager() {
  const navigate = useNavigate();
  const { user, role } = useAuthStore();
  const [alarmState, setAlarmState] = useState<DeliveryAlarmState>({
    isAlarming: false,
    needsInteraction: false,
    pendingCount: 0
  });

  useEffect(() => {
    if (!user?.uid || role !== 'delivery_partner') return;
    DeliveryAlarmManager.init(user.uid);
    const unsubscribe = DeliveryAlarmManager.subscribe(setAlarmState);
    return () => {
      unsubscribe();
    };
  }, [user?.uid, role]);

  if (!user || role !== 'delivery_partner') return null;

  return (
    <AnimatePresence>
      {/* Fallback Banner if Audio is blocked by Browser Policy */}
      {alarmState.needsInteraction && alarmState.pendingCount > 0 && (
        <motion.div
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          className="fixed top-0 left-0 right-0 z-[9999] bg-orange-600/90 backdrop-blur-xl border-b border-orange-500 shadow-[0_0_50px_rgba(234,88,12,0.5)]"
        >
          <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4 text-white">
              <div className="p-2 bg-white/20 rounded-full animate-pulse">
                <Bike size={24} />
              </div>
              <div>
                <h3 className="font-bold text-lg">Click to Enable Ringtone</h3>
                <p className="text-orange-100 text-sm">
                  You have a new delivery assignment! Your browser requires a click to play the ringtone.
                </p>
              </div>
            </div>
            <button
              onClick={() => DeliveryAlarmManager.handleUserInteraction()}
              className="bg-white text-orange-600 px-6 py-2 rounded-xl font-bold hover:bg-orange-50 transition-colors shadow-lg"
            >
              Enable Audio
            </button>
          </div>
        </motion.div>
      )}

      {/* Global Visual Indicator (Active when Alarming, regardless of audio lock) */}
      {alarmState.isAlarming && !alarmState.needsInteraction && alarmState.pendingCount > 0 && (
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="fixed bottom-24 right-6 z-[9998]"
        >
          <div 
            onClick={() => navigate('/delivery/dashboard')}
            className="cursor-pointer flex items-center gap-4 bg-primary-500/90 backdrop-blur-md border border-primary-400 p-4 rounded-2xl shadow-[0_0_30px_rgba(249,115,22,0.6)] animate-bounce"
          >
            <div className="bg-white text-primary-600 font-black rounded-full h-10 w-10 flex items-center justify-center text-lg">
              <Navigation size={20} />
            </div>
            <div className="text-white pr-4">
              <h4 className="font-bold">New Assignment!</h4>
              <p className="text-primary-100 text-sm">Tap to review</p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
