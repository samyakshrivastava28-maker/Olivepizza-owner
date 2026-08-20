import React, { useState, useEffect, useMemo } from 'react';
import {
  Clock,
  CheckCircle2,
  XCircle,
  Search,
  Filter,
  Eye,
  Phone,
  MapPin,
  Bike,
  CreditCard,
  ShoppingBag,
  ArrowRight,
  AlertTriangle,
  RefreshCw,
  SlidersHorizontal,
  ChevronRight,
  X,
  Volume2,
} from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, onSnapshot, query, orderBy, limit, doc, updateDoc } from 'firebase/firestore';
import { Order, OrderStatus } from '../types/models';
import { fetchApi } from '../lib/api';
import toast from 'react-hot-toast';

export default function OrderManagement() {
  const [activeTab, setActiveTab] = useState<'live' | 'history'>('live');
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [fulfillmentFilter, setFulfillmentFilter] = useState<string>('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Firestore real-time listener for orders
  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'), limit(500));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetched: Order[] = [];
        snapshot.forEach((d) => {
          fetched.push({ id: d.id, ...d.data() } as Order);
        });
        setOrders(fetched);
        setLoading(false);
      },
      (err) => {
        console.warn('[OrderManagement] Realtime listener error, falling back to API:', err);
        fetchApi('/api/orders?limit=300')
          .then((res) => res.json())
          .then((data) => setOrders(data.orders || data || []))
          .catch((e) => console.error('[OrderManagement] Fetch failed:', e))
          .finally(() => setLoading(false));
      }
    );

    return () => unsubscribe();
  }, []);

  // Update order status in Firestore / Backend
  const handleUpdateStatus = async (orderId: string, nextStatus: OrderStatus) => {
    setActionLoadingId(orderId);
    try {
      // 1. Direct Firestore update
      await updateDoc(doc(db, 'orders', orderId), {
        status: nextStatus,
        updatedAt: new Date().toISOString(),
      });

      // 2. Notify backend endpoint
      fetchApi(`/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      }).catch((e) => console.warn('[OrderManagement] Backend status sync warning:', e));

      toast.success(`Order status updated to ${nextStatus.toUpperCase()}`);
      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder((prev) => (prev ? { ...prev, status: nextStatus } : null));
      }
    } catch (err: any) {
      console.error('[OrderManagement] Status update failed:', err);
      toast.error(`Failed to update order: ${err.message}`);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Live Orders: Active/In-progress orders
  const liveOrders = useMemo(() => {
    return orders.filter((o) => {
      const s = (o.status || 'pending').toLowerCase();
      return s !== 'delivered' && s !== 'cancelled' && s !== 'completed';
    });
  }, [orders]);

  // Historical Orders: Filtered list
  const historyOrders = useMemo(() => {
    return orders.filter((o) => {
      const s = (o.status || 'pending').toLowerCase();
      const matchSearch =
        searchQuery.trim() === '' ||
        (o.id && o.id.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (o.customerName && o.customerName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (o.customerPhone && o.customerPhone.includes(searchQuery));

      const matchStatus = statusFilter === 'all' || s === statusFilter.toLowerCase();
      const fulfillment = (o.fulfillmentType || o.fulfillment || 'delivery').toLowerCase();
      const matchFulfillment = fulfillmentFilter === 'all' || fulfillment.includes(fulfillmentFilter.toLowerCase());

      return matchSearch && matchStatus && matchFulfillment;
    });
  }, [orders, searchQuery, statusFilter, fulfillmentFilter]);

  const getStatusBadge = (status: string = 'pending') => {
    const s = status.toLowerCase();
    switch (s) {
      case 'pending':
        return <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] font-black uppercase tracking-wider animate-pulse">PENDING</span>;
      case 'accepted':
        return <span className="px-2.5 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-[10px] font-black uppercase tracking-wider">ACCEPTED</span>;
      case 'preparing':
        return <span className="px-2.5 py-0.5 rounded-full bg-orange-500/10 border border-orange-500/30 text-orange-400 text-[10px] font-black uppercase tracking-wider">PREPARING</span>;
      case 'ready':
        return <span className="px-2.5 py-0.5 rounded-full bg-teal-500/10 border border-teal-500/30 text-teal-400 text-[10px] font-black uppercase tracking-wider">READY</span>;
      case 'out_for_delivery':
      case 'picked_up':
        return <span className="px-2.5 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-400 text-[10px] font-black uppercase tracking-wider">OUT FOR DELIVERY</span>;
      case 'delivered':
      case 'completed':
        return <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-black uppercase tracking-wider">DELIVERED</span>;
      case 'cancelled':
        return <span className="px-2.5 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 text-[10px] font-black uppercase tracking-wider">CANCELLED</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full bg-slate-500/10 border border-slate-500/30 text-slate-400 text-[10px] font-black uppercase tracking-wider">{s.toUpperCase()}</span>;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#0E1524] p-5 rounded-2xl border border-slate-800 shadow-lg">
        <div>
          <h1 className="text-xl font-extrabold text-white tracking-tight">Order Management</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Manage live kitchen dispatch queue and complete historical store records.
          </p>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center gap-1.5 bg-[#0B0F17] p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveTab('live')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-extrabold transition-all ${
              activeTab === 'live'
                ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            Live Orders
            {liveOrders.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-white text-orange-600 text-[10px] font-black">
                {liveOrders.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-extrabold transition-all ${
              activeTab === 'history'
                ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            Order History
          </button>
        </div>
      </div>

      {/* TAB 1: LIVE ORDERS */}
      {activeTab === 'live' && (
        <div className="space-y-4">
          {liveOrders.length === 0 ? (
            <div className="bg-[#0E1524] border border-slate-800 rounded-2xl p-12 text-center space-y-3">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto opacity-70" />
              <h3 className="text-white font-bold text-base">All Caught Up!</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                No active pending or preparing orders in the live queue. Incoming orders will alert automatically.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {liveOrders.map((order) => {
                const s = (order.status || 'pending').toLowerCase();
                const isActionBusy = actionLoadingId === order.id;

                return (
                  <div
                    key={order.id}
                    className="bg-[#0E1524] border border-slate-800 hover:border-slate-700/80 rounded-2xl p-5 shadow-lg space-y-4 transition-all flex flex-col justify-between"
                  >
                    <div>
                      {/* Top Row: Order ID & Status */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="font-mono text-xs font-extrabold text-white">
                            #{order.id.slice(-6).toUpperCase()}
                          </span>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            {new Date(order.createdAt?.toDate ? order.createdAt.toDate() : order.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                        {getStatusBadge(order.status)}
                      </div>

                      {/* Customer Info */}
                      <div className="pt-3 border-t border-slate-800 space-y-1.5 text-xs">
                        <div className="text-white font-bold">{order.customerName || order.userName || 'Guest Customer'}</div>
                        {order.customerPhone && (
                          <div className="flex items-center gap-1.5 text-slate-400">
                            <Phone className="w-3.5 h-3.5 text-slate-500" />
                            <a href={`tel:${order.customerPhone}`} className="hover:text-orange-400">
                              {order.customerPhone}
                            </a>
                          </div>
                        )}
                        {order.deliveryAddress && (
                          <div className="flex items-start gap-1.5 text-slate-400">
                            <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                            <span className="line-clamp-1">{order.deliveryAddress.address || order.deliveryAddress}</span>
                          </div>
                        )}
                      </div>

                      {/* Items Preview */}
                      <div className="pt-3 border-t border-slate-800 space-y-1">
                        <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Items ({order.items?.length || 0})</div>
                        <div className="space-y-1 max-h-24 overflow-y-auto pr-1">
                          {order.items?.map((it: any, i: number) => (
                            <div key={i} className="flex justify-between text-xs text-slate-300">
                              <span>
                                {it.quantity || 1}x {it.name || it.productName}
                              </span>
                              <span className="font-mono text-slate-400">₹{it.price * (it.quantity || 1)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Footer: Price & Actions */}
                    <div className="pt-3 border-t border-slate-800 space-y-3">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-400">Total Bill:</span>
                        <span className="text-base font-extrabold font-mono text-orange-400">
                          ₹{(order.total || order.finalAmount || 0).toLocaleString('en-IN')}
                        </span>
                      </div>

                      {/* Transition Action Buttons */}
                      <div className="flex items-center gap-2">
                        {s === 'pending' && (
                          <>
                            <button
                              disabled={isActionBusy}
                              onClick={() => handleUpdateStatus(order.id, 'accepted')}
                              className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-emerald-600/20 disabled:opacity-50"
                            >
                              Accept Order
                            </button>
                            <button
                              disabled={isActionBusy}
                              onClick={() => handleUpdateStatus(order.id, 'cancelled')}
                              className="px-3 py-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 text-xs font-bold rounded-xl transition-all disabled:opacity-50"
                            >
                              Reject
                            </button>
                          </>
                        )}

                        {s === 'accepted' && (
                          <button
                            disabled={isActionBusy}
                            onClick={() => handleUpdateStatus(order.id, 'preparing')}
                            className="w-full py-2 bg-orange-500 hover:bg-orange-400 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-orange-500/20 disabled:opacity-50"
                          >
                            Mark Preparing
                          </button>
                        )}

                        {s === 'preparing' && (
                          <button
                            disabled={isActionBusy}
                            onClick={() => handleUpdateStatus(order.id, 'ready')}
                            className="w-full py-2 bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-teal-600/20 disabled:opacity-50"
                          >
                            Mark Ready For Delivery
                          </button>
                        )}

                        {s === 'ready' && (
                          <button
                            disabled={isActionBusy}
                            onClick={() => handleUpdateStatus(order.id, 'out_for_delivery')}
                            className="w-full py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-purple-600/20 disabled:opacity-50"
                          >
                            Out For Delivery
                          </button>
                        )}

                        {s === 'out_for_delivery' && (
                          <button
                            disabled={isActionBusy}
                            onClick={() => handleUpdateStatus(order.id, 'delivered')}
                            className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-emerald-600/20 disabled:opacity-50"
                          >
                            Complete & Delivered
                          </button>
                        )}

                        <button
                          onClick={() => setSelectedOrder(order)}
                          className="p-2 bg-[#0B0F17] hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-xl"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: ORDER HISTORY */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-[#0E1524] rounded-2xl border border-slate-800">
            {/* Search */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by ID or customer..."
                className="w-full pl-9 pr-4 py-2 bg-[#0B0F17] border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none"
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-[#0B0F17] border border-slate-800 text-slate-300 text-xs rounded-xl px-3 py-2 focus:border-orange-500 focus:outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="delivered">Delivered</option>
              <option value="cancelled">Cancelled</option>
              <option value="out_for_delivery">Out For Delivery</option>
              <option value="preparing">Preparing</option>
              <option value="pending">Pending</option>
            </select>

            {/* Fulfillment Filter */}
            <select
              value={fulfillmentFilter}
              onChange={(e) => setFulfillmentFilter(e.target.value)}
              className="bg-[#0B0F17] border border-slate-800 text-slate-300 text-xs rounded-xl px-3 py-2 focus:border-orange-500 focus:outline-none"
            >
              <option value="all">All Channels</option>
              <option value="delivery">Delivery</option>
              <option value="takeaway">Takeaway</option>
              <option value="dine">Dine-in</option>
            </select>
          </div>

          {/* Table */}
          <div className="bg-[#0E1524] border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-[#0B0F17]/60 text-slate-400 uppercase text-[10px] font-extrabold tracking-wider">
                    <th className="p-4">Order ID</th>
                    <th className="p-4">Customer</th>
                    <th className="p-4">Items</th>
                    <th className="p-4">Channel</th>
                    <th className="p-4">Total</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {historyOrders.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-500">
                        No orders matching the selected filters.
                      </td>
                    </tr>
                  ) : (
                    historyOrders.map((order) => (
                      <tr key={order.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="p-4 font-mono font-bold text-white">#{order.id.slice(-6).toUpperCase()}</td>
                        <td className="p-4">
                          <div className="font-bold text-white">{order.customerName || order.userName || 'Guest'}</div>
                          <div className="text-slate-500 text-[11px]">{order.customerPhone || '—'}</div>
                        </td>
                        <td className="p-4 text-slate-300">{order.items?.length || 0} items</td>
                        <td className="p-4 capitalize text-slate-400">
                          {order.fulfillmentType || order.fulfillment || 'Delivery'}
                        </td>
                        <td className="p-4 font-mono font-extrabold text-orange-400">
                          ₹{(order.total || order.finalAmount || 0).toLocaleString('en-IN')}
                        </td>
                        <td className="p-4">{getStatusBadge(order.status)}</td>
                        <td className="p-4 text-right">
                          <button
                            onClick={() => setSelectedOrder(order)}
                            className="px-3 py-1.5 bg-[#0B0F17] hover:bg-slate-800 border border-slate-800 text-slate-300 font-bold rounded-lg transition-all"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Order Detail Modal / Drawer */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-[#0E1524] border border-slate-800 w-full max-w-lg rounded-3xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-white">Order Details</h3>
                <span className="text-xs font-mono text-orange-400">#{selectedOrder.id}</span>
              </div>
              <button onClick={() => setSelectedOrder(null)} className="p-1.5 text-slate-400 hover:text-white rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Status & Timestamp */}
            <div className="flex justify-between items-center bg-[#0B0F17] p-3 rounded-xl border border-slate-800 text-xs">
              <span className="text-slate-400">Current Status:</span>
              {getStatusBadge(selectedOrder.status)}
            </div>

            {/* Customer Details */}
            <div className="space-y-2 text-xs">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Customer & Delivery</div>
              <div className="p-3 bg-[#0B0F17] rounded-xl border border-slate-800 space-y-1 text-slate-300">
                <div className="font-bold text-white">{selectedOrder.customerName || selectedOrder.userName || 'Guest'}</div>
                <div>Phone: {selectedOrder.customerPhone || 'N/A'}</div>
                <div>Address: {selectedOrder.deliveryAddress?.address || selectedOrder.deliveryAddress || 'Dine-in / Pickup'}</div>
              </div>
            </div>

            {/* Items Breakdown */}
            <div className="space-y-2 text-xs">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Ordered Items</div>
              <div className="p-3 bg-[#0B0F17] rounded-xl border border-slate-800 space-y-2">
                {selectedOrder.items?.map((it: any, idx: number) => (
                  <div key={idx} className="flex justify-between items-center text-slate-300 border-b border-slate-800/40 pb-1.5 last:border-0 last:pb-0">
                    <div>
                      <span className="font-bold text-white">{it.quantity || 1}x</span> {it.name || it.productName}
                      {it.selectedVariant && <span className="text-[10px] text-slate-500 block">Variant: {it.selectedVariant}</span>}
                    </div>
                    <span className="font-mono text-orange-400">₹{(it.price || 0) * (it.quantity || 1)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Total Summary */}
            <div className="p-3 bg-[#0B0F17] rounded-xl border border-slate-800 space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Subtotal:</span>
                <span className="font-mono">₹{(selectedOrder.subtotal || selectedOrder.total || 0).toLocaleString('en-IN')}</span>
              </div>
              {selectedOrder.discount && (
                <div className="flex justify-between text-emerald-400">
                  <span>Discount:</span>
                  <span className="font-mono">-₹{selectedOrder.discount}</span>
                </div>
              )}
              {selectedOrder.deliveryFee && (
                <div className="flex justify-between text-slate-400">
                  <span>Delivery Fee:</span>
                  <span className="font-mono">₹{selectedOrder.deliveryFee}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-extrabold text-white pt-2 border-t border-slate-800">
                <span>Total Paid / Due:</span>
                <span className="font-mono text-orange-400">₹{(selectedOrder.total || selectedOrder.finalAmount || 0).toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
