import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, ChefHat } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useAuthStore } from '../../lib/store';
import { db } from '../../lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

export default function FloatingWaitingCard() {
  const { user, isAuthenticated } = useAuthStore();
  const navigate = useNavigate();
  const [pendingOrder, setPendingOrder] = useState<any>(null);

  useEffect(() => {
    if (!isAuthenticated || !user?.uid) return;
    const q = query(
      collection(db, 'orders'),
      where('userId', '==', user.uid),
      where('status', '==', 'pending')
    );
    const unsub = onSnapshot(q, (snap) => {
      if (!snap.empty) {
        setPendingOrder({ id: snap.docs[0].id, ...snap.docs[0].data() });
      } else {
        setPendingOrder(null);
      }
    });
    return () => unsub();
  }, [user, isAuthenticated]);

  return (
    <AnimatePresence>
      {pendingOrder && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="fixed bottom-20 md:bottom-6 left-4 right-4 md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-md z-40 pointer-events-none"
        >
          <div
            onClick={() => navigate(`/order-tracking/${pendingOrder.id}`)}
            className="w-full bg-dark-900 rounded-3xl p-4 shadow-2xl border border-white/10 flex items-center justify-between text-white pointer-events-auto cursor-pointer active:scale-95 transition-transform overflow-hidden relative"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-orange-500/10 to-transparent pointer-events-none" />
            
            <div className="flex items-center gap-4 relative z-10">
              <div className="bg-orange-500/20 p-3 rounded-2xl relative overflow-hidden">
                <motion.div 
                   animate={{ rotate: 360 }} transition={{ repeat: Infinity, ease: 'linear', duration: 4 }}
                   className="absolute inset-0 border-2 border-orange-500/30 border-t-orange-500 rounded-2xl"
                />
                <Clock className="w-6 h-6 text-orange-400" />
              </div>
              <div className="text-left">
                <p className="text-sm font-bold text-white">Order Placed!</p>
                <p className="text-xs text-white/60 mt-0.5 flex items-center gap-1">
                   <ChefHat className="w-3 h-3" /> Waiting for restaurant
                </p>
              </div>
            </div>
            
            <div className="relative z-10">
               <div className="text-[10px] uppercase font-bold tracking-wider text-orange-400 bg-orange-500/10 px-3 py-1.5 rounded-full border border-orange-500/20 animate-pulse">
                  Pending
               </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
