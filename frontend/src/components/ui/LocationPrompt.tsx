import { useState, useEffect } from 'react';
import { useAuthStore } from '../../lib/store';
import { LocationManager } from '../../lib/permissions';
import { db } from '../../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Loader2, X } from 'lucide-react';
import toast from 'react-hot-toast';

export default function LocationPrompt() {
  const { user, role, isAuthenticated, setUser } = useAuthStore();
  const [showPrompt, setShowPrompt] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Only prompt customer users who haven't saved an address yet
    if (isAuthenticated && user && (role === 'customer' || !role) && !(user as any).lat && !(user as any).fullAddress && !dismissed) {
      let timer: any;
      LocationManager.shouldPrompt().then(should => {
        if (should && !dismissed) {
          timer = setTimeout(() => setShowPrompt(true), 2500);
        }
      });
      return () => { if (timer) clearTimeout(timer); };
    }
  }, [isAuthenticated, user, role, dismissed]);

  const requestLocation = async () => {
    setLoading(true);
    try {
      const location = await LocationManager.getCurrentLocation({ forcePrompt: true });
      
      // Update Firestore
      if (user?.uid) {
        await updateDoc(doc(db, 'users', user.uid), {
          lat: location.lat,
          lng: location.lng,
          fullAddress: location.fullAddress,
          locationSetupCompleted: true
        });

        // Update Zustand Store
        setUser({
          ...user,
          lat: location.lat,
          lng: location.lng,
          fullAddress: location.fullAddress,
          locationSetupCompleted: true
        }, role || 'customer');

        toast.success('Location updated successfully!');
        setShowPrompt(false);
      }
    } catch (error: any) {
      console.error('Location error:', error);
      if (error.message?.includes('denied')) {
        toast.error('Location permission denied. You can set it manually later.');
        setShowPrompt(false);
        setDismissed(true);
      } else {
        toast.error('Failed to get address. Please set manually.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {showPrompt && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          className="fixed bottom-20 left-4 right-4 md:left-auto md:right-8 md:bottom-8 z-50 max-w-sm bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl shadow-primary-500/10"
        >
          <button 
            onClick={() => { setShowPrompt(false); setDismissed(true); }}
            className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="w-12 h-12 bg-primary-500/20 rounded-full flex items-center justify-center mb-4">
            <MapPin className="w-6 h-6 text-primary-500" />
          </div>
          
          <h3 className="text-xl font-bold text-white mb-2">Set Delivery Location</h3>
          <p className="text-sm text-slate-300 mb-6 leading-relaxed">
            Allow location access to see accurate delivery fees, nearest outlets, and live tracking.
          </p>
          
          <div className="flex flex-col gap-3">
            <button
              onClick={requestLocation}
              disabled={loading}
              className="w-full bg-primary-600 hover:bg-primary-500 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> Detecting...</>
              ) : (
                'Allow Location Access'
              )}
            </button>
            <button
              onClick={() => { setShowPrompt(false); setDismissed(true); }}
              className="w-full bg-transparent hover:bg-white/5 text-slate-300 font-medium py-3 rounded-xl transition-colors"
            >
              Enter Manually Later
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
