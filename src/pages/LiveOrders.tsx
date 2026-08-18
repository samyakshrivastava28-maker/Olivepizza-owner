import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  getDocs,
} from 'firebase/firestore';
import { Order, DeliveryPartner, OrderStatus } from '../types/models';
import { TableSkeleton } from '../components/ui/Skeleton';
import { ErrorState } from '../components/ui/ErrorState';
import { EmptyState } from '../components/ui/EmptyState';
import { LiveMapModal } from '../components/orders/LiveMapModal';
import { CancelReasonModal } from '../components/orders/CancelReasonModal';
import { soundPlayer } from '../lib/audio';
import {
  Search,
  CheckCircle2,
  Clock,
  Bike,
  XCircle,
  MapPin,
  Phone,
  RefreshCw,
  SlidersHorizontal,
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function LiveOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [partners, setPartners] = useState<DeliveryPartner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'preparing' | 'out_for_delivery' | 'delivered'>('all');

  const [mapOrder, setMapOrder] = useState<Order | null>(null);
  const [cancelOrderTarget, setCancelOrderTarget] = useState<Order | null>(null);

  // 1. Fetch Delivery Partners
  useEffect(() => {
    const fetchPartners = async () => {
      try {
        const snap = await getDocs(collection(db, 'delivery_partners'));
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as DeliveryPartner[];
        setPartners(list);
      } catch (err) {
        console.warn('Could not fetch delivery partners:', err);
      }
    };
    fetchPartners();
  }, []);

  // 2. Realtime Orders Stream
  useEffect(() => {
    let isInitial = true;
    const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as Order[];
        if (!isInitial) {
          snapshot.docChanges().forEach((ch) => {
            if (ch.type === 'modified') {
              soundPlayer.playStatusUpdate();
            }
          });
        }
        isInitial = false;
        setOrders(list);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  const handleUpdateStatus = async (orderId: string, newStatus: OrderStatus) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), {
        status: newStatus,
        updatedAt: new Date(),
      });
      soundPlayer.playStatusUpdate();
      toast.success(`Order status updated to "${newStatus.replace('_', ' ')}"`);
    } catch (e: any) {
      toast.error('Status update failed: ' + e.message);
    }
  };

  const handleAssignPartner = async (orderId: string, partnerId: string) => {
    const selected = partners.find((p) => p.id === partnerId);
    try {
      await updateDoc(doc(db, 'orders', orderId), {
        deliveryPartnerId: partnerId || null,
        deliveryPartnerName: selected?.name || null,
        deliveryPartnerPhone: selected?.phone || null,
        status: 'out_for_delivery',
        updatedAt: new Date(),
      });
      toast.success(`Assigned to ${selected?.name || 'partner'} & moved to Out for Delivery.`);
    } catch (e: any) {
      toast.error('Partner assignment failed: ' + e.message);
    }
  };

  const handleConfirmCancel = async (reason: string) => {
    if (!cancelOrderTarget) return;
    try {
      await updateDoc(doc(db, 'orders', cancelOrderTarget.id), {
        status: 'cancelled',
        cancelReason: reason,
        updatedAt: new Date(),
      });
      setCancelOrderTarget(null);
      toast.success('Order cancelled successfully.');
    } catch (e: any) {
      toast.error('Failed to cancel order: ' + e.message);
    }
  };

  // Filter orders
  const filteredOrders = orders.filter((o) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      o.customerName?.toLowerCase().includes(q) ||
      o.customerPhone?.includes(q) ||
      (o.dailyOrderNumber && String(o.dailyOrderNumber).includes(q)) ||
      o.id.toLowerCase().includes(q);

    const s = (o.status || '').toLowerCase();
    if (statusFilter === 'all') return matchesSearch && s !== 'delivered' && s !== 'cancelled';
    if (statusFilter === 'pending') return matchesSearch && ['pending', 'placed', 'created', 'new_order'].includes(s);
    if (statusFilter === 'preparing') return matchesSearch && ['preparing', 'confirmed'].includes(s);
    if (statusFilter === 'out_for_delivery') return matchesSearch && ['out_for_delivery', 'picked_up'].includes(s);
    if (statusFilter === 'delivered') return matchesSearch && ['delivered', 'completed'].includes(s);

    return matchesSearch;
  });

  return (
    <div className="space-y-6">
      <LiveMapModal
        isOpen={!!mapOrder}
        onClose={() => setMapOrder(null)}
        order={mapOrder}
        partner={partners.find((p) => p.id === mapOrder?.deliveryPartnerId)}
      />

      <CancelReasonModal
        isOpen={!!cancelOrderTarget}
        onClose={() => setCancelOrderTarget(null)}
        onConfirm={handleConfirmCancel}
        orderNumber={cancelOrderTarget?.dailyOrderNumber || cancelOrderTarget?.id.slice(0, 6)}
      />

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-white">Live Orders Board</h2>
          <p className="text-xs text-slate-400">Accept, prepare, assign fleet, and dispatch incoming customer orders.</p>
        </div>
      </div>

      {error && <ErrorState message={error} onRetry={() => window.location.reload()} />}

      {/* Filters & Search Bar */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-[#131B2B] border border-slate-800 rounded-2xl overflow-x-auto">
          {[
            { id: 'all', label: 'Active Pipeline' },
            { id: 'pending', label: 'New / Pending' },
            { id: 'preparing', label: 'In Kitchen' },
            { id: 'out_for_delivery', label: 'Out for Delivery' },
            { id: 'delivered', label: 'Delivered' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id as any)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors whitespace-nowrap ${
                statusFilter === tab.id
                  ? 'bg-orange-500 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by customer, phone, #..."
            className="w-full pl-10 pr-4 py-2 bg-[#131B2B] border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Orders Grid / Cards */}
      {loading ? (
        <TableSkeleton rows={6} cols={5} />
      ) : filteredOrders.length === 0 ? (
        <EmptyState
          title="No live orders in this view"
          message="Orders will appear here as soon as customers place them or update statuses."
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredOrders.map((order) => {
            const status = (order.status || 'pending').toLowerCase();
            const isPending = ['pending', 'placed', 'created', 'new_order'].includes(status);
            const isPreparing = ['preparing', 'confirmed'].includes(status);
            const isOutForDelivery = ['out_for_delivery', 'picked_up'].includes(status);

            return (
              <div
                key={order.id}
                className="bg-[#131B2B] border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4 hover:border-slate-700 transition-colors"
              >
                {/* Header info */}
                <div className="flex items-start justify-between gap-2 border-b border-slate-800/80 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-extrabold text-white font-mono">
                        #{order.dailyOrderNumber || order.id.slice(0, 6)}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300 uppercase">
                        {order.paymentMethod}
                      </span>
                    </div>
                    <p className="text-xs font-bold text-slate-200 mt-0.5">{order.customerName}</p>
                    <p className="text-[11px] text-orange-400 font-mono flex items-center gap-1">
                      <Phone className="w-3 h-3" />
                      {order.customerPhone}
                    </p>
                  </div>

                  <div className="text-right">
                    <span className="text-base font-extrabold text-emerald-400 font-mono">
                      ₹{order.totalAmount}
                    </span>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {order.createdAt ? new Date(parseOrderTime(order)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                    </p>
                  </div>
                </div>

                {/* Items List */}
                <div className="space-y-1.5 text-xs bg-[#0E1524] p-3 rounded-xl border border-slate-800/60 max-h-36 overflow-y-auto">
                  {order.items?.map((it, idx) => (
                    <div key={idx} className="flex justify-between items-center text-slate-300">
                      <span>
                        <strong className="text-white">{it.quantity}x</strong> {it.name}
                        {it.size ? ` (${it.size})` : ''}
                      </span>
                      <span className="font-mono text-slate-400">₹{it.price * it.quantity}</span>
                    </div>
                  ))}
                  {order.deliveryAddress?.address && (
                    <p className="text-[11px] text-slate-400 pt-2 border-t border-slate-800 flex items-start gap-1">
                      <MapPin className="w-3.5 h-3.5 text-orange-400 flex-shrink-0 mt-0.5" />
                      <span className="truncate">{order.deliveryAddress.address}</span>
                    </p>
                  )}
                </div>

                {/* Status Advancement & Actions */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <div className="flex items-center gap-2">
                    {/* Live Map button */}
                    <button
                      onClick={() => setMapOrder(order)}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors"
                    >
                      <MapPin className="w-3.5 h-3.5 text-blue-400" />
                      Track GPS
                    </button>

                    {/* Cancel button */}
                    <button
                      onClick={() => setCancelOrderTarget(order)}
                      className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold rounded-xl text-xs transition-colors"
                    >
                      Cancel
                    </button>
                  </div>

                  {/* Stage Advancement Button */}
                  <div className="flex items-center gap-2">
                    {isPending && (
                      <button
                        onClick={() => handleUpdateStatus(order.id, 'preparing')}
                        className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-md shadow-orange-600/20"
                      >
                        <Clock className="w-3.5 h-3.5" />
                        Accept Order
                      </button>
                    )}

                    {isPreparing && (
                      <div className="flex items-center gap-2">
                        {/* Assign Fleet Partner */}
                        <select
                          value={order.deliveryPartnerId || ''}
                          onChange={(e) => handleAssignPartner(order.id, e.target.value)}
                          className="px-2.5 py-1.5 bg-[#0E1524] border border-slate-800 rounded-xl text-xs text-slate-200 focus:border-orange-500 focus:outline-none"
                        >
                          <option value="">Assign Rider...</option>
                          {partners.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} {p.isOnline ? '🟢' : '⚪'}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => handleUpdateStatus(order.id, 'out_for_delivery')}
                          className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors"
                        >
                          <Bike className="w-3.5 h-3.5" />
                          Out for Delivery
                        </button>
                      </div>
                    )}

                    {isOutForDelivery && (
                      <button
                        onClick={() => handleUpdateStatus(order.id, 'delivered')}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-md shadow-emerald-600/20"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Mark Delivered
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function parseOrderTime(o: Order): number {
  if (!o.createdAt) return 0;
  if (typeof (o.createdAt as any)?.toMillis === 'function') return (o.createdAt as any).toMillis();
  if (typeof (o.createdAt as any)?.toDate === 'function') return (o.createdAt as any).toDate().getTime();
  if (typeof (o.createdAt as any)?.seconds === 'number') return (o.createdAt as any).seconds * 1000;
  const p = new Date(o.createdAt).getTime();
  return isNaN(p) ? 0 : p;
}
