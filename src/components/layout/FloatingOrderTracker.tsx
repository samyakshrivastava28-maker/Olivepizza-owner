import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bike, ChefHat, Navigation, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useAuthStore } from '../../lib/store';
import { db } from '../../lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

export default function FloatingOrderTracker() {
  const { user, isAuthenticated } = useAuthStore();
  const navigate = useNavigate();
  const [activeOrder, setActiveOrder] = useState<any>(null);

  useEffect(() => {
    if (!isAuthenticated || !user?.uid) return;
    const q = query(
      collection(db, 'orders'),
      where('userId', '==', user.uid),
      where('status', 'in', ['accepted', 'preparing', 'out_for_delivery'])
    );
    const unsub = onSnapshot(q, (snap) => {
      if (!snap.empty) {
        setActiveOrder({ id: snap.docs[0].id, ...snap.docs[0].data() });
      } else {
        setActiveOrder(null);
      }
    });
    return () => unsub();
  }, [user, isAuthenticated]);

  const getStatusInfo = (status: string) => {
     switch (status) {
        case 'accepted':
           return { title: 'Order Accepted', icon: CheckCircle, color: 'text-blue-400', bg: 'bg-blue-500/20' };
        case 'preparing':
           return { title: 'Preparing Food', icon: ChefHat, color: 'text-orange-400', bg: 'bg-orange-500/20' };
        case 'out_for_delivery':
           return { title: 'On The Way', icon: Bike, color: 'text-primary-400', bg: 'bg-primary-500/20' };
        default:
           return { title: 'Track Order', icon: Navigation, color: 'text-white', bg: 'bg-white/10' };
     }
  };

  return (
    <AnimatePresence>
      {activeOrder && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="fixed bottom-20 md:bottom-6 left-4 right-4 md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-md z-40 pointer-events-none"
        >
          <div
            onClick={() => navigate(`/order-tracking/${activeOrder.id}`)}
            className="w-full bg-dark-950/90 backdrop-blur-xl rounded-3xl p-4 shadow-2xl border border-white/10 flex flex-col pointer-events-auto cursor-pointer active:scale-[0.98] transition-transform overflow-hidden relative"
          >
            <div className="flex items-center justify-between mb-3">
               <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl ${getStatusInfo(activeOrder.status).bg}`}>
                     {React.createElement(getStatusInfo(activeOrder.status).icon, { className: `w-5 h-5 ${getStatusInfo(activeOrder.status).color}` })}
                  </div>
                  <div>
                     <p className="font-bold text-white">{getStatusInfo(activeOrder.status).title}</p>
                     <p className="text-xs text-white/50">ETA: {activeOrder.eta || 'Calculating...'}</p>
                  </div>
               </div>
               <div className="bg-white/10 text-white text-[10px] font-bold px-3 py-1.5 rounded-full uppercase tracking-wider">
                  Live
               </div>
            </div>
            
            {/* Minimal Progress Bar */}
            <div className="w-full h-1.5 bg-dark-800 rounded-full overflow-hidden">
               <motion.div 
                 initial={{ width: 0 }} 
                 animate={{ width: activeOrder.status === 'accepted' ? '33%' : activeOrder.status === 'preparing' ? '66%' : '100%' }}
                 transition={{ duration: 0.5 }}
                 className={`h-full ${activeOrder.status === 'out_for_delivery' ? 'bg-primary-500' : 'bg-blue-500'}`}
               />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
