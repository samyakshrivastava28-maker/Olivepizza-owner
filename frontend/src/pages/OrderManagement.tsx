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
  Calendar,
  Layers,
  ChefHat,
  PackageCheck,
  Truck,
  ShieldAlert,
  Info,
} from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import { Order, OrderStatus } from '../types/models';
import { fetchApi } from '../lib/api';
import toast from 'react-hot-toast';

function parseOrderTime(val: any): Date {
  if (!val) return new Date();
  if (val instanceof Date) return val;
  if (typeof val.toDate === 'function') return val.toDate();
  if (typeof val === 'object' && val._seconds) return new Date(val._seconds * 1000);
  if (typeof val === 'number') return new Date(val);
  const d = new Date(val);
  return isNaN(d.getTime()) ? new Date() : d;
}

function formatOrderTime(val: any): string {
  try {
    const d = parseOrderTime(val);
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' });
  } catch {
    return 'Recently';
  }
}

export default function OrderManagement() {
  const [activeTab, setActiveTab] = useState<'live' | 'history'>('live');
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [fulfillmentFilter, setFulfillmentFilter] = useState<string>('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // Firestore real-time listener for orders
  useEffect(() => {
    setLoading(true);
    const unsubscribe = onSnapshot(
      collection(db, 'orders'),
      (snapshot) => {
        const fetched: Order[] = [];
        snapshot.forEach((d) => {
          const data = d.data();
          fetched.push({ id: d.id, ...data } as Order);
        });

        // Safe client-side descending chronological sort
        fetched.sort((a, b) => {
          const timeA = parseOrderTime(a.createdAt).getTime();
          const timeB = parseOrderTime(b.createdAt).getTime();
          return timeB - timeA;
        });

        setOrders(fetched);
        setLoading(false);
      },
      (err) => {
        console.warn('[OrderManagement] Realtime stream error, trying fallback API:', err);
        fetchApi('/api/orders?limit=300')
          .then(async (res) => { if (!res.ok) return {}; return res.json().catch(() => ({})); })
          .then((data) => setOrders(Array.isArray(data) ? data : data.orders || []))
          .catch((e) => console.error('[OrderManagement] Fetch failed:', e))
          .finally(() => setLoading(false));
      }
    );

    return () => unsubscribe();
  }, []);

  // Live Orders: Active in-progress orders
  const liveOrders = useMemo(() => {
    return orders.filter((o) => {
      const s = (o.status || 'pending').toLowerCase();
      return s !== 'delivered' && s !== 'cancelled' && s !== 'completed' && s !== 'rejected';
    });
  }, [orders]);

  // History Orders: Completed/Delivered/Cancelled
  const historyOrders = useMemo(() => {
    return orders.filter((o) => {
      const s = (o.status || 'pending').toLowerCase();
      const matchHistory = s === 'delivered' || s === 'cancelled' || s === 'completed' || s === 'rejected';

      const matchStatus =
        statusFilter === 'all' || s === statusFilter.toLowerCase();

      const fType = ((o as any).deliveryType || (o as any).fulfillmentType || (o as any).fulfillment || 'delivery').toLowerCase();
      const matchFulfillment =
        fulfillmentFilter === 'all' || fType.includes(fulfillmentFilter.toLowerCase());

      const custName = o.customerName || (o as any).userName || '';
      const custPhone = o.contactPhone || (o as any).customerPhone || (o as any).phone || '';
      const matchSearch =
        searchQuery.trim() === '' ||
        o.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        custName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        custPhone.includes(searchQuery);

      return matchHistory && matchStatus && matchFulfillment && matchSearch;
    });
  }, [orders, statusFilter, fulfillmentFilter, searchQuery]);

  // Status Badge Helper
  const getStatusBadge = (status?: string) => {
    const s = (status || 'pending').toLowerCase();
    switch (s) {
      case 'pending_acceptance':
      case 'pending':
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center gap-1 animate-pulse">
            <Clock className="w-3 h-3" /> New Order
          </span>
        );
      case 'preparing':
      case 'accepted':
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-500/10 border border-blue-500/30 text-blue-400 flex items-center gap-1">
            <ChefHat className="w-3 h-3" /> Kitchen Preparing
          </span>
        );
      case 'ready':
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center gap-1">
            <PackageCheck className="w-3 h-3" /> Ready For Pickup
          </span>
        );
      case 'out_for_delivery':
      case 'picked_up':
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-500/10 border border-purple-500/30 text-purple-400 flex items-center gap-1">
            <Truck className="w-3 h-3" /> Out For Delivery
          </span>
        );
      case 'delivered':
      case 'completed':
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-600/10 border border-emerald-600/30 text-emerald-400 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Delivered
          </span>
        );
      case 'cancelled':
      case 'rejected':
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center gap-1">
            <XCircle className="w-3 h-3" /> Cancelled
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-500/10 text-slate-400">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#0E1524] p-5 rounded-2xl border border-slate-800 shadow-lg">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-extrabold text-white tracking-tight">Order Management Hub</h1>
            {liveOrders.length > 0 && (
              <span className="px-2.5 py-0.5 rounded-full bg-orange-500/20 border border-orange-500/30 text-orange-400 text-xs font-black animate-pulse">
                {liveOrders.length} LIVE
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time kitchen order queue, stage transitions, and comprehensive historical archives.
          </p>
        </div>

        {/* View Switcher */}
        <div className="flex items-center gap-1.5 bg-[#0B0F17] p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveTab('live')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'live'
                ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            Live Kitchen Queue ({liveOrders.length})
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'history'
                ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Order History ({orders.length - liveOrders.length})
          </button>
        </div>
      </div>

      {/* TAB 1: LIVE KITCHEN QUEUE */}
      {activeTab === 'live' && (
        <div className="space-y-4">
          {/* Read-Only Surveillance Notice */}
          <div className="flex items-center gap-3 p-3.5 bg-amber-500/10 border border-amber-500/25 rounded-2xl text-amber-300 text-xs font-medium">
            <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              <strong>Owner Read-Only Monitoring:</strong> Kitchen stage transitions (Accept, Prepare, Mark Ready) and Rider Deliveries are executed on Restaurant Manager and Delivery terminals to ensure operational integrity.
            </span>
          </div>

          {loading ? (
            <div className="text-center py-16 text-slate-500 text-xs">Streaming live orders from database...</div>
          ) : liveOrders.length === 0 ? (
            <div className="bg-[#0E1524] border border-slate-800 rounded-3xl p-12 text-center space-y-3">
              <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto opacity-70" />
              <h3 className="text-base font-extrabold text-white">Kitchen Queue is Clear</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                No active orders currently waiting for preparation or dispatch. Incoming customer orders will appear here instantly.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {liveOrders.map((order) => {
                const s = (order.status || 'pending').toLowerCase();
                const totalAmt = Number(order.totalAmount ?? (order as any).total ?? (order as any).finalAmount ?? 0);
                const orderNum = order.dailyOrderNumber ? `#${order.dailyOrderNumber}` : `#${order.id.slice(-6).toUpperCase()}`;
                const custName = order.customerName || (order as any).userName || 'Customer';
                const custPhone = order.contactPhone || (order as any).customerPhone || (order as any).phone || 'N/A';
                const addressStr = order.deliveryAddress?.addressLine || order.deliveryAddress?.address || (typeof order.deliveryAddress === 'string' ? order.deliveryAddress : 'Pickup at Store');

                return (
                  <div
                    key={order.id}
                    className="bg-[#0E1524] border border-slate-800 hover:border-slate-700 rounded-2xl p-5 shadow-lg flex flex-col justify-between space-y-4 transition-all"
                  >
                    {/* Card Header */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-black text-white">{orderNum}</span>
                          <span className="text-[11px] text-slate-400">{formatOrderTime(order.createdAt)}</span>
                        </div>
                        {getStatusBadge(order.status)}
                      </div>

                      {/* Customer Info */}
                      <div className="p-3 bg-[#0B0F17] rounded-xl border border-slate-800/80 space-y-1">
                        <div className="font-bold text-white text-xs">{custName}</div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                          <Phone className="w-3 h-3 text-slate-500" />
                          <a href={`tel:${custPhone}`} className="hover:text-orange-400">
                            {custPhone}
                          </a>
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-start gap-1.5 pt-0.5">
                          <MapPin className="w-3 h-3 text-slate-500 shrink-0 mt-0.5" />
                          <span className="line-clamp-1">{addressStr}</span>
                        </div>
                      </div>

                      {/* Items Preview */}
                      <div className="space-y-1.5 pt-1 text-xs">
                        <div className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Ordered Items</div>
                        <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                          {order.items?.map((it: any, idx: number) => (
                            <div key={idx} className="flex justify-between items-center text-slate-300 text-[11px]">
                              <span>
                                <strong className="text-white">{it.quantity || 1}x</strong> {it.name || it.productName}
                              </span>
                              <span className="font-mono text-slate-400">₹{(it.price || 0) * (it.quantity || 1)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Total & Quick Actions */}
                    <div className="space-y-3 pt-3 border-t border-slate-800">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-400">Total:</span>
                        <span className="font-mono text-base font-black text-orange-400">₹{totalAmt}</span>
                      </div>

                      {/* Read-Only Inspect Button */}
                      <div>
                        <button
                          onClick={() => setSelectedOrder(order)}
                          className="w-full py-2.5 bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/30 text-orange-400 hover:text-orange-300 font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-sm"
                        >
                          <Eye className="w-4 h-4" /> Inspect Full Order & Invoice
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

      {/* TAB 2: ORDER HISTORY ARCHIVE */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          {/* Search & Filters */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#0E1524] p-4 rounded-2xl border border-slate-800">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by order ID, customer name, or phone..."
                className="w-full pl-10 pr-4 py-2 bg-[#0B0F17] border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-[#0B0F17] border border-slate-800 text-slate-300 text-xs rounded-xl px-3 py-2 focus:border-orange-500 focus:outline-none"
              >
                <option value="all">All Statuses</option>
                <option value="delivered">Delivered</option>
                <option value="cancelled">Cancelled</option>
              </select>

              <select
                value={fulfillmentFilter}
                onChange={(e) => setFulfillmentFilter(e.target.value)}
                className="bg-[#0B0F17] border border-slate-800 text-slate-300 text-xs rounded-xl px-3 py-2 focus:border-orange-500 focus:outline-none"
              >
                <option value="all">All Channels</option>
                <option value="delivery">Delivery</option>
                <option value="pickup">Pickup / Takeaway</option>
              </select>
            </div>
          </div>

          {/* Table View */}
          <div className="bg-[#0E1524] border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-[#0B0F17]/60 text-slate-400 uppercase text-[10px] font-extrabold tracking-wider">
                    <th className="p-4">Order ID</th>
                    <th className="p-4">Date & Time</th>
                    <th className="p-4">Customer</th>
                    <th className="p-4">Items</th>
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
                    historyOrders.map((order) => {
                      const totalAmt = Number(order.totalAmount ?? (order as any).total ?? (order as any).finalAmount ?? 0);
                      const orderNum = order.dailyOrderNumber ? `#${order.dailyOrderNumber}` : `#${order.id.slice(-6).toUpperCase()}`;
                      const custName = order.customerName || (order as any).userName || 'Customer';
                      const custPhone = order.contactPhone || (order as any).customerPhone || (order as any).phone || '—';

                      return (
                        <tr key={order.id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="p-4 font-mono font-bold text-white">{orderNum}</td>
                          <td className="p-4 text-slate-400 text-[11px]">{formatOrderTime(order.createdAt)}</td>
                          <td className="p-4">
                            <div className="font-bold text-white">{custName}</div>
                            <div className="text-slate-500 text-[11px]">{custPhone}</div>
                          </td>
                          <td className="p-4 text-slate-300">{order.items?.length || 0} items</td>
                          <td className="p-4 font-mono font-extrabold text-orange-400">₹{totalAmt}</td>
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
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Order Detail Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#0E1524] border border-slate-800 w-full max-w-lg rounded-3xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-white">Order Details</h3>
                <span className="text-xs font-mono text-orange-400">
                  {selectedOrder.dailyOrderNumber ? `#${selectedOrder.dailyOrderNumber} (${selectedOrder.id})` : `#${selectedOrder.id}`}
                </span>
              </div>
              <button onClick={() => setSelectedOrder(null)} className="p-1.5 text-slate-400 hover:text-white rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Status Inspection & Read-Only Badge */}
            <div className="p-3.5 bg-[#0B0F17] rounded-xl border border-slate-800 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400 font-bold">Lifecycle Status:</span>
                {getStatusBadge(selectedOrder.status)}
              </div>
              <div className="flex items-center gap-2 pt-2 border-t border-slate-800/80 text-[11px] text-amber-400/90 font-medium">
                <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                <span>Read-Only Surveillance: State transitions managed on Restaurant & Rider terminals.</span>
              </div>
            </div>

            {/* Customer & Delivery Details */}
            <div className="space-y-2 text-xs">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Customer & Delivery</div>
              <div className="p-3 bg-[#0B0F17] rounded-xl border border-slate-800 space-y-1.5 text-slate-300">
                <div className="font-bold text-white text-sm">{selectedOrder.customerName || (selectedOrder as any).userName || 'Customer'}</div>
                <div className="flex items-center gap-2 text-slate-400">
                  <Phone className="w-3.5 h-3.5 text-slate-500" />
                  <a href={`tel:${selectedOrder.contactPhone || (selectedOrder as any).customerPhone || (selectedOrder as any).phone || ''}`} className="hover:text-orange-400">
                    {selectedOrder.contactPhone || (selectedOrder as any).customerPhone || (selectedOrder as any).phone || 'N/A'}
                  </a>
                </div>
                <div className="flex items-start gap-2 text-slate-400 pt-0.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                  <span>{selectedOrder.deliveryAddress?.addressLine || selectedOrder.deliveryAddress?.address || (typeof selectedOrder.deliveryAddress === 'string' ? selectedOrder.deliveryAddress : 'Pickup at Store')}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-500 text-[11px] pt-1 border-t border-slate-800/60">
                  <Clock className="w-3 h-3" /> Placed at: {formatOrderTime(selectedOrder.createdAt)}
                </div>
              </div>
            </div>

            {/* Fulfillment & Rider Details */}
            <div className="space-y-2 text-xs">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Fulfillment & Rider</div>
              <div className="p-3 bg-[#0B0F17] rounded-xl border border-slate-800 space-y-1 text-slate-300">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Fulfillment Type:</span>
                  <span className="font-bold uppercase text-white bg-slate-800 px-2 py-0.5 rounded text-[10px]">
                    {(selectedOrder as any).fulfillmentType || (selectedOrder as any).orderType || 'delivery'}
                  </span>
                </div>
                {(selectedOrder as any).deliveryPartnerName ? (
                  <div className="flex justify-between items-center pt-1 border-t border-slate-800/50">
                    <span className="text-slate-400">Assigned Rider:</span>
                    <span className="font-bold text-emerald-400">{(selectedOrder as any).deliveryPartnerName}</span>
                  </div>
                ) : (selectedOrder as any).deliveryPartnerId ? (
                  <div className="flex justify-between items-center pt-1 border-t border-slate-800/50">
                    <span className="text-slate-400">Assigned Rider ID:</span>
                    <span className="font-mono text-emerald-400">{(selectedOrder as any).deliveryPartnerId.slice(0, 10)}...</span>
                  </div>
                ) : (
                  <div className="text-slate-500 text-[11px] pt-1 border-t border-slate-800/50 italic">
                    {(selectedOrder as any).fulfillmentType === 'pickup' || (selectedOrder as any).orderType === 'pickup' ? 'Store Pickup Order (No Rider)' : 'Pending Dispatch / Rider Assignment'}
                  </div>
                )}
                {(selectedOrder as any).paymentMethod && (
                  <div className="flex justify-between items-center pt-1 border-t border-slate-800/50">
                    <span className="text-slate-400">Payment Method:</span>
                    <span className="font-mono font-bold text-white uppercase text-[11px]">
                      {(selectedOrder as any).paymentMethod} ({(selectedOrder as any).paymentStatus || 'confirmed'})
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Items Breakdown */}
            <div className="space-y-2 text-xs">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Ordered Items</div>
              <div className="p-3 bg-[#0B0F17] rounded-xl border border-slate-800 space-y-2">
                {selectedOrder.items?.map((it: any, idx: number) => (
                  <div key={idx} className="flex justify-between items-start text-slate-300 border-b border-slate-800/40 pb-2 last:border-0 last:pb-0">
                    <div>
                      <span className="font-bold text-white">{it.quantity || 1}x</span> {it.name || it.productName}
                      {it.size && <span className="text-[10px] text-orange-400/90 block">Size: {it.size}</span>}
                      {it.crust && <span className="text-[10px] text-slate-500 block">Crust: {it.crust}</span>}
                      {Array.isArray(it.selectedAddons) && it.selectedAddons.length > 0 && (
                        <span className="text-[10px] text-slate-400 block">
                          Add-ons: {it.selectedAddons.map((a: any) => (typeof a === 'string' ? a : a.name)).join(', ')}
                        </span>
                      )}
                    </div>
                    <span className="font-mono text-orange-400 font-bold">₹{(it.price || 0) * (it.quantity || 1)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Total Summary */}
            <div className="p-3 bg-[#0B0F17] rounded-xl border border-slate-800 space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Subtotal:</span>
                <span className="font-mono">₹{Number(selectedOrder.subtotal || 0)}</span>
              </div>
              {(selectedOrder as any).discountAmount ? (
                <div className="flex justify-between text-emerald-400">
                  <span>Discount {((selectedOrder as any).appliedCouponCode ? `(${((selectedOrder as any).appliedCouponCode)})` : '')}:</span>
                  <span className="font-mono">-₹{Number((selectedOrder as any).discountAmount)}</span>
                </div>
              ) : null}
              {selectedOrder.deliveryFee ? (
                <div className="flex justify-between text-slate-400">
                  <span>Delivery Fee:</span>
                  <span className="font-mono">₹{Number(selectedOrder.deliveryFee)}</span>
                </div>
              ) : null}
              {(selectedOrder as any).packagingCharge ? (
                <div className="flex justify-between text-slate-400">
                  <span>Packaging Charge:</span>
                  <span className="font-mono">₹{Number((selectedOrder as any).packagingCharge)}</span>
                </div>
              ) : null}
              {(selectedOrder as any).taxes ? (
                <div className="flex justify-between text-slate-400">
                  <span>Taxes (GST):</span>
                  <span className="font-mono">₹{Number((selectedOrder as any).taxes)}</span>
                </div>
              ) : null}
              <div className="flex justify-between text-sm font-extrabold text-white pt-2 border-t border-slate-800">
                <span>Total Amount:</span>
                <span className="font-mono text-orange-400">
                  ₹{Number(selectedOrder.totalAmount ?? (selectedOrder as any).total ?? (selectedOrder as any).finalAmount ?? 0)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

