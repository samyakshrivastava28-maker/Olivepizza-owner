import { useEffect, useState } from 'react';
import { OwnerAlarmManager, OwnerAlarmState } from '../../services/OwnerAlarmManager';
import { motion, AnimatePresence } from 'framer-motion';
import { BellRing, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router';

export default function OwnerAlertManager() {
  const navigate = useNavigate();
  const [alarmState, setAlarmState] = useState<OwnerAlarmState>({
    isAlarming: false,
    needsInteraction: false,
    pendingCount: 0
  });

  useEffect(() => {
    OwnerAlarmManager.init();
    const unsubscribe = OwnerAlarmManager.subscribe(setAlarmState);
    return () => {
      unsubscribe();
      // We don't destroy() the manager here because the Manager is meant to live globally
      // across all owner pages. But if they completely log out, we would destroy it elsewhere.
    };
  }, []);

  return (
    <AnimatePresence>
      {/* Fallback Banner if Audio is blocked by Browser Policy */}
      {alarmState.needsInteraction && alarmState.pendingCount > 0 && (
        <motion.div
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          className="fixed top-0 left-0 right-0 z-[9999] bg-red-600/90 backdrop-blur-xl border-b border-red-500 shadow-[0_0_50px_rgba(220,38,38,0.5)]"
        >
          <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4 text-white">
              <div className="p-2 bg-white/20 rounded-full animate-pulse">
                <BellRing size={24} />
              </div>
              <div>
                <h3 className="font-bold text-lg">Click to Enable Alarms</h3>
                <p className="text-red-100 text-sm">
                  You have {alarmState.pendingCount} pending order(s)! Your browser requires a click to play the alarm sound.
                </p>
              </div>
            </div>
            <button
              onClick={() => OwnerAlarmManager.handleUserInteraction()}
              className="bg-white text-red-600 px-6 py-2 rounded-xl font-bold hover:bg-red-50 transition-colors shadow-lg"
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
          className="fixed bottom-6 right-6 z-[9998]"
        >
          <div 
            onClick={() => navigate('/owner/orders')}
            className="cursor-pointer flex items-center gap-4 bg-orange-500/90 backdrop-blur-md border border-orange-400 p-4 rounded-2xl shadow-[0_0_30px_rgba(249,115,22,0.4)] animate-pulse"
          >
            <div className="bg-white text-orange-600 font-black rounded-full h-10 w-10 flex items-center justify-center text-lg">
              {alarmState.pendingCount}
            </div>
            <div className="text-white pr-4">
              <h4 className="font-bold">Pending Orders!</h4>
              <p className="text-orange-100 text-sm">Review immediately</p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
