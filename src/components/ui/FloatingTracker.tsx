/**
 * FloatingTracker — Live Order Tracker (Website)
 *
 * Shows a persistent, floating pill at the bottom of every customer page
 * (except order tracking, checkout, and order success) whenever there is an
 * active order. Stays synchronized with the actual Firestore order state.
 *
 * Features:
 * - Real-time Firestore listener
 * - Offline recovery (listens for olive:network:restored event)
 * - Auto-dismiss on Delivered / Cancelled (with sound)
 * - Full 7-step progress bar
 * - Supports multiple active orders (shows most recent, with count badge)
 * - Never re-creates itself — updates in place
 */

import { useEffect, useState, useCallback } from 'react';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db, auth } from '../../lib/firebase';
import { useNavigate, useLocation } from 'react-router';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, ChefHat, Package, Truck, Clock, CheckCircle2, X, ChevronLeft, ChevronRight } from 'lucide-react';
import OwnerAcceptedOverlay from './OwnerAcceptedOverlay';
import DeliveredOverlay from './DeliveredOverlay';

interface ActiveOrder {
  id: string;
  status: string;
  createdAt: any;
  totalAmount: number;
  items: any[];
  dailyOrderNumber?: string;
  daily_order_number?: string;
  contactPhone?: string;
}

// ─── Status Configuration ────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, {
  icon: React.ReactNode;
  label: string;
  emoji: string;
  color: string;
  bgColor: string;
  progress: number; // 0–100%
  isTerminal?: boolean;
}> = {
  pending: {
    icon: <Clock className="w-4 h-4" />, label: 'Waiting for restaurant...',
    emoji: '⏳', color: 'text-amber-400', bgColor: 'from-amber-900/40 to-amber-900/20', progress: 5,
  },
  accepted: {
    icon: <ChefHat className="w-4 h-4" />, label: 'Order confirmed!',
    emoji: '✅', color: 'text-emerald-400', bgColor: 'from-emerald-900/30 to-emerald-900/10', progress: 20,
  },
  preparing: {
    icon: <ChefHat className="w-4 h-4" />, label: 'Baking your pizza...',
    emoji: '🔥', color: 'text-orange-400', bgColor: 'from-orange-900/30 to-orange-900/10', progress: 38,
  },
  ready: {
    icon: <Package className="w-4 h-4" />, label: 'Packed & ready!',
    emoji: '📦', color: 'text-sky-400', bgColor: 'from-sky-900/30 to-sky-900/10', progress: 55,
  },
  partner_assigned: {
    icon: <Package className="w-4 h-4" />, label: 'Delivery partner assigned',
    emoji: '🚴', color: 'text-blue-400', bgColor: 'from-blue-900/30 to-blue-900/10', progress: 65,
  },
  picked_up: {
    icon: <Truck className="w-4 h-4" />, label: 'Order picked up',
    emoji: '🛵', color: 'text-violet-400', bgColor: 'from-violet-900/30 to-violet-900/10', progress: 75,
  },
  out_for_delivery: {
    icon: <Truck className="w-4 h-4" />, label: 'Out for delivery!',
    emoji: '🛵', color: 'text-primary-400', bgColor: 'from-primary-900/30 to-primary-900/10', progress: 88,
  },
  delivered: {
    icon: <CheckCircle2 className="w-4 h-4" />, label: 'Delivered! Enjoy 🍕',
    emoji: '🎉', color: 'text-green-400', bgColor: 'from-green-900/30 to-green-900/10', progress: 100, isTerminal: true,
  },
};

const ACTIVE_STATUSES = ['pending', 'accepted', 'preparing', 'ready', 'partner_assigned', 'picked_up', 'out_for_delivery'];
const HIDE_PATHS = ['/order-tracking', '/order-success', '/checkout', '/owner', '/delivery'];

export default function FloatingTracker() {
  const [orders, setOrders] = useState<ActiveOrder[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [eta, setEta] = useState<number | null>(null);
  const [showAcceptedOverlay, setShowAcceptedOverlay] = useState(false);
  const [showDeliveredOverlay, setShowDeliveredOverlay] = useState(false);
  const [completedOrderId, setCompletedOrderId] = useState<string | null>(null);
  const [lastKnownStatus, setLastKnownStatus] = useState<Record<string, string>>({});
  const navigate = useNavigate();
  const location = useLocation();

  // ─── Firestore Listener ────────────────────────────────────────────────────
  const subscribeToOrders = useCallback(() => {
    if (!auth.currentUser) return () => {};
    const q = query(
      collection(db, 'orders'),
      where('userId', '==', auth.currentUser!.uid),
      where('status', 'in', ACTIVE_STATUSES),
      orderBy('createdAt', 'desc')
    );
    return onSnapshot(q, snap => {
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() } as ActiveOrder));
      
      // Detect transitions for overlays
      setLastKnownStatus(prev => {
        const next = { ...prev };
        items.forEach(order => {
          if (prev[order.id] === 'pending' && order.status === 'accepted') {
            setShowAcceptedOverlay(true);
          }
          if (prev[order.id] && prev[order.id] !== 'delivered' && order.status === 'delivered') {
            setCompletedOrderId(order.id);
            setShowDeliveredOverlay(true);
          }
          next[order.id] = order.status;
        });
        return next;
      });

      setOrders(items);
      setCurrentIdx(idx => Math.min(idx, Math.max(0, items.length - 1)));
    }, () => setOrders([]));
  }, []);

  useEffect(() => {
    const unsub = subscribeToOrders();
    return unsub;
  }, [subscribeToOrders]);

  // ─── Offline Recovery ─────────────────────────────────────────────────────
  // When network is restored, re-subscribe to get the latest state
  useEffect(() => {
    const handler = () => {
      console.log('[FloatingTracker] Network restored — refreshing order state');
      subscribeToOrders();
    };
    window.addEventListener('olive:network:restored', handler);
    return () => window.removeEventListener('olive:network:restored', handler);
  }, [subscribeToOrders]);

  // ─── Also listen for order updates from SW/push actions ───────────────────
  useEffect(() => {
    const handler = () => subscribeToOrders();
    window.addEventListener('olive:order:updated', handler);
    return () => window.removeEventListener('olive:order:updated', handler);
  }, [subscribeToOrders]);

  // ─── ETA Fetching ─────────────────────────────────────────────────────────
  const activeOrder = orders[currentIdx] || null;

  useEffect(() => {
    if (!activeOrder) { setEta(null); return; }
    const status = activeOrder.status;
    if (status === 'pending')   { setEta(40); return; }
    if (status === 'accepted')  { setEta(30); return; }
    if (status === 'preparing') { setEta(20); return; }
    if (status === 'ready' || status === 'partner_assigned') { setEta(15); return; }
    if (status !== 'out_for_delivery' && status !== 'picked_up') { setEta(null); return; }

    const fetch_ = async () => {
      try {
        const r = await fetch(`/api/tracking/order/${activeOrder.id}`);
        if (r.ok) { const d = await r.json(); if (d.estimated_minutes) setEta(d.estimated_minutes); }
      } catch {}
    };
    fetch_();
    const iv = setInterval(fetch_, 8000);
    return () => clearInterval(iv);
  }, [activeOrder?.id, activeOrder?.status]);

  // ─── Visibility Guards ────────────────────────────────────────────────────
  const shouldHide = HIDE_PATHS.some(p => location.pathname.startsWith(p));
  if (!activeOrder || shouldHide) return null;
  if (dismissed.has(activeOrder.id)) return null;

  const config = STATUS_CONFIG[activeOrder.status];
  if (!config) return null;

  const orderNumber = activeOrder.dailyOrderNumber || activeOrder.daily_order_number || activeOrder.id.slice(-6).toUpperCase();
  const isPending = activeOrder.status === 'pending';

  return (
    <>
      <AnimatePresence>
        {showAcceptedOverlay && (
          <OwnerAcceptedOverlay 
            orderId={activeOrder.id} 
            onClose={() => setShowAcceptedOverlay(false)} 
          />
        )}
        {showDeliveredOverlay && completedOrderId && (
          <DeliveredOverlay 
            orderId={completedOrderId} 
            onClose={() => setShowDeliveredOverlay(false)} 
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
      <motion.div
        key={activeOrder.id + activeOrder.status}
        initial={{ y: 100, opacity: 0, scale: 0.9 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 100, opacity: 0, scale: 0.9 }}
        transition={{ type: 'spring', damping: 22, stiffness: 220 }}
        className="fixed left-4 right-4 md:left-auto md:right-6 md:w-[420px] z-[65] cursor-pointer"
        style={{ bottom: 'var(--app-floating-bottom-offset, calc(72px + env(safe-area-inset-bottom, 0px) + 12px))' }}
        onClick={() => navigate(`/order-tracking/${activeOrder.id}`)}
      >
        <div className={`relative overflow-hidden rounded-3xl border border-white/15 bg-gradient-to-r ${config.bgColor} backdrop-blur-2xl shadow-[0_30px_60px_rgba(0,0,0,0.6)]`}>
          {/* Shimmer */}
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/8 to-transparent skew-x-12 pointer-events-none"
            animate={{ x: ['-200%', '200%'] }}
            transition={{ duration: 3.5, repeat: Infinity, ease: 'linear' }}
          />

          <div className="relative p-4 flex items-center gap-3">
            {/* Emoji / Status Icon */}
            <div className="relative shrink-0">
              <motion.div
                animate={isPending
                  ? { scale: [1, 1.06, 1], rotate: [0, -4, 4, 0] }
                  : { scale: [1, 1.12, 1] }
                }
                transition={{ duration: isPending ? 1.5 : 2, repeat: Infinity, ease: 'easeInOut' }}
                className={`w-13 h-13 rounded-2xl backdrop-blur-xl border border-white/15 flex items-center justify-center text-2xl shadow-inner ${isPending ? 'bg-amber-500/20' : 'bg-dark-900/60'}`}
                style={{ width: 52, height: 52 }}
              >
                {config.emoji}
              </motion.div>
              {/* Pulse ring */}
              <motion.div
                className={`absolute -inset-1.5 rounded-2xl border-2 ${isPending ? 'border-amber-400/40' : 'border-white/15'}`}
                animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <p className={`text-[13px] font-black tracking-wide ${config.color} truncate`}>
                  {config.label}
                </p>
                {orders.length > 1 && (
                  <span className="text-[10px] font-bold bg-white/10 px-1.5 py-0.5 rounded-full text-slate-300 shrink-0">
                    {orders.length} orders
                  </span>
                )}
              </div>
              <p className="text-[12px] text-slate-400 font-medium truncate">
                #{orderNumber} · ₹{activeOrder.totalAmount}
                {eta && !isPending ? ` · ~${eta} min` : ''}
              </p>
            </div>

            {/* Right: Multi-order nav + Track CTA */}
            <div className="flex flex-col items-end gap-1.5 shrink-0">
              {orders.length > 1 && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={e => { e.stopPropagation(); setCurrentIdx(i => Math.max(0, i - 1)); }}
                    className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center"
                    disabled={currentIdx === 0}
                  >
                    <ChevronLeft className="w-3 h-3" />
                  </button>
                  <span className="text-[10px] text-slate-400">{currentIdx + 1}/{orders.length}</span>
                  <button
                    onClick={e => { e.stopPropagation(); setCurrentIdx(i => Math.min(orders.length - 1, i + 1)); }}
                    className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center"
                    disabled={currentIdx === orders.length - 1}
                  >
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              )}
              <div className="flex items-center gap-1 text-white bg-white/10 hover:bg-white/20 px-2.5 py-1.5 rounded-full text-[11px] font-bold transition-colors">
                <MapPin className="w-3 h-3" />
                Track
              </div>
            </div>

            {/* Dismiss on pending only */}
            {isPending && (
              <button
                onClick={e => { e.stopPropagation(); setDismissed(s => new Set(s).add(activeOrder.id)); }}
                className="absolute top-3 right-3 text-slate-600 hover:text-slate-400 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Progress bar */}
          <div className="h-1.5 bg-dark-900/60 overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-primary-700 via-primary-400 to-primary-500 relative shadow-[0_0_8px_rgba(34,197,94,0.5)]"
              initial={{ width: '0%' }}
              animate={{ width: `${config.progress}%` }}
              transition={{ duration: 1.2, ease: 'easeOut' }}
            >
              <motion.div
                className="absolute top-0 bottom-0 left-0 w-16 bg-gradient-to-r from-transparent via-white/40 to-transparent"
                animate={{ x: ['-100%', '500%'] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
              />
            </motion.div>
          </div>

          {/* Steps legend (compact) */}
          <div className="px-4 pb-3 pt-1.5 flex items-center justify-between gap-1.5">
            {['⏳', '✅', '🔥', '📦', '🚴', '🛵', '🎉'].map((step, i) => {
              const stepProgress = [5, 20, 38, 55, 65, 88, 100][i];
              const isActive = config.progress >= stepProgress && config.progress < ([20, 38, 55, 65, 88, 100, 101][i] || 101);
              const isDone = config.progress > stepProgress && !isActive;
              return (
                <div
                  key={i}
                  className={`text-[10px] transition-all duration-300 ${isActive ? 'scale-125 opacity-100' : isDone ? 'opacity-60' : 'opacity-25'}`}
                >
                  {step}
                </div>
              );
            })}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
    </>
  );
}
