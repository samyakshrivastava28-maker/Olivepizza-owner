import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WifiOff, Wifi, RefreshCcw } from 'lucide-react';

export default function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showRestored, setShowRestored] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowRestored(true);
      setTimeout(() => setShowRestored(false), 3000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowRestored(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <AnimatePresence>
      {!isOnline && (
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 20, stiffness: 100 }}
          className="fixed bottom-0 left-0 right-0 z-[100] p-4 pointer-events-none flex justify-center"
        >
          <div className="bg-dark-900 border border-red-500/30 shadow-2xl shadow-red-500/10 rounded-2xl p-4 flex items-center gap-4 max-w-md w-full pointer-events-auto">
            <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center flex-shrink-0">
              <WifiOff className="w-6 h-6 text-red-500" />
            </div>
            <div className="flex-1">
              <h3 className="text-white font-bold text-sm">You are offline</h3>
              <p className="text-slate-400 text-xs mt-0.5">App will automatically reconnect when network is restored.</p>
            </div>
            <div className="flex-shrink-0">
              <RefreshCcw className="w-4 h-4 text-slate-500 animate-spin" />
            </div>
          </div>
        </motion.div>
      )}

      {isOnline && showRestored && (
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 20, stiffness: 100 }}
          className="fixed bottom-0 left-0 right-0 z-[100] p-4 pointer-events-none flex justify-center"
        >
          <div className="bg-green-600 border border-green-500/30 shadow-2xl shadow-green-500/20 rounded-2xl p-4 flex items-center gap-4 max-w-md w-full pointer-events-auto">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
              <Wifi className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-white font-bold text-sm">Connection Restored</h3>
              <p className="text-green-100 text-xs mt-0.5">You're back online.</p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
