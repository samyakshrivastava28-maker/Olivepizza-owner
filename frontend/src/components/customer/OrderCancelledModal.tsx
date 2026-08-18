import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { XCircle, ShoppingBag, ArrowRight, AlertTriangle, X } from 'lucide-react';
import { useNavigate } from 'react-router';
import { auth, db } from '../../lib/firebase';
import { collection, query, where, onSnapshot, limit } from 'firebase/firestore';
import { GlassButton } from '../ui/glass/GlassSystem';
import { Order } from '../../types/models';

export default function OrderCancelledModal() {
  const [cancelledOrder, setCancelledOrder] = useState<Order | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    // Listen to user's recent orders to detect cancellations
    const q = query(
      collection(db, "orders"),
      where("userId", "==", user.uid),
      limit(5)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Order));
      // Sort newest first
      docs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      // Find the most recent cancelled order that hasn't been dismissed by customer
      const recentCancelled = docs.find((o) => {
        if (o.status !== "cancelled") return false;
        const isDismissed = localStorage.getItem(`dismissed_cancel_${o.id}`) === "true";
        return !isDismissed;
      });

      if (recentCancelled) {
        setCancelledOrder(recentCancelled);
      } else {
        setCancelledOrder(null);
      }
    });

    return () => unsubscribe();
  }, []);

  if (!cancelledOrder) return null;

  const reasonText =
    cancelledOrder.cancellationReason ||
    (cancelledOrder as any).cancellation_reason ||
    (cancelledOrder as any).lastRejectionReason ||
    (cancelledOrder as any).reason;

  const orderNum = cancelledOrder.dailyOrderNumber || `#${cancelledOrder.id?.slice(-6).toUpperCase()}`;

  const handleDismiss = () => {
    if (cancelledOrder?.id) {
      localStorage.setItem(`dismissed_cancel_${cancelledOrder.id}`, "true");
    }
    setCancelledOrder(null);
  };

  const handleOrderAgain = () => {
    handleDismiss();
    navigate("/menu");
  };

  const handleViewDetails = () => {
    handleDismiss();
    navigate(`/order-tracking/${cancelledOrder.id}`);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          className="relative w-full max-w-md bg-dark-900 border border-red-500/40 rounded-3xl p-6 shadow-[0_0_50px_rgba(239,68,68,0.3)] overflow-hidden"
        >
          {/* Background Glow */}
          <div className="absolute -top-24 -left-24 w-48 h-48 bg-red-500/20 blur-3xl rounded-full pointer-events-none" />

          {/* Close button */}
          <button
            onClick={handleDismiss}
            className="absolute top-4 right-4 text-slate-400 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors"
          >
            <X size={20} />
          </button>

          {/* Content Header */}
          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center flex-shrink-0 text-red-500 shadow-inner">
              <XCircle size={32} />
            </div>
            <div>
              <span className="text-[10px] font-black tracking-widest text-red-400 uppercase bg-red-500/10 px-2.5 py-1 rounded-full border border-red-500/20 inline-block mb-1">
                Order Cancelled by Owner
              </span>
              <h2 className="text-xl font-black text-white">
                Order {orderNum}
              </h2>
            </div>
          </div>

          <p className="text-slate-300 text-sm mb-4">
            Your order was cancelled by the restaurant owner with the following reason:
          </p>

          {/* Exact Reason Box */}
          <div className="bg-red-950/40 border border-red-500/40 rounded-2xl p-4 mb-6 relative overflow-hidden">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-red-400 uppercase tracking-wider mb-1">
                  Cancellation Reason
                </p>
                <p className="text-white font-bold text-base leading-snug">
                  {reasonText ? `"${reasonText}"` : "No reason provided."}
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-2.5">
            <GlassButton
              variant="primary"
              onClick={handleOrderAgain}
              className="w-full justify-center py-3.5 text-sm font-bold flex items-center gap-2"
            >
              <ShoppingBag size={18} /> Order Again
            </GlassButton>
            <div className="flex gap-2">
              <GlassButton
                variant="secondary"
                onClick={handleViewDetails}
                className="w-1/2 justify-center py-3 text-xs font-bold flex items-center gap-1.5"
              >
                View Details <ArrowRight size={14} />
              </GlassButton>
              <button
                onClick={handleDismiss}
                className="w-1/2 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold border border-white/10 transition-colors"
              >
                Dismiss
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
