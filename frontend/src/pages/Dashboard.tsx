import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { Order } from '../types/models';
import { StatCard } from '../components/ui/StatCard';
import { TableSkeleton } from '../components/ui/Skeleton';
import { ErrorState } from '../components/ui/ErrorState';
import { EmptyState } from '../components/ui/EmptyState';
import { Link } from 'react-router';
import {
  IndianRupee,
  ShoppingBag,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  Activity,
  PlusCircle,
  FolderOpen,
  Tag,
} from 'lucide-react';

export default function Dashboard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'), limit(150));
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const liveOrders = snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as Order[];
          setOrders(liveOrders);
          setLoading(false);
        },
        (err) => {
          setError(err.message);
          setLoading(false);
        }
      );
      return () => unsubscribe();
    } catch (e: any) {
      setError(e.message);
      setLoading(false);
    }
  }, []);

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

  const parseOrderTime = (o: Order): number => {
    if (!o.createdAt) return 0;
    if (typeof (o.createdAt as any)?.toMillis === 'function') return (o.createdAt as any).toMillis();
    if (typeof (o.createdAt as any)?.toDate === 'function') return (o.createdAt as any).toDate().getTime();
    if (typeof (o.createdAt as any)?.seconds === 'number') return (o.createdAt as any).seconds * 1000;
    const p = new Date(o.createdAt).getTime();
    return isNaN(p) ? 0 : p;
  };

  let todayRevenue = 0;
  let todayOrdersCount = 0;
  let monthRevenue = 0;
  let monthOrdersCount = 0;

  const activePipeline = {
    pending: 0,
    preparing: 0,
    outForDelivery: 0,
    delivered: 0,
    cancelled: 0,
  };

  orders.forEach((o) => {
    const t = parseOrderTime(o);
    const amount = Number(o.totalAmount) || 0;
    const status = (o.status || '').toLowerCase();

    if (t >= startOfToday) {
      todayOrdersCount++;
      if (status !== 'cancelled' && status !== 'rejected') {
        todayRevenue += amount;
      }
    }

    if (t >= startOfMonth) {
      monthOrdersCount++;
      if (status !== 'cancelled' && status !== 'rejected') {
        monthRevenue += amount;
      }
    }

    if (['pending', 'placed', 'created', 'new_order'].includes(status)) activePipeline.pending++;
    else if (['preparing', 'confirmed', 'kitchen'].includes(status)) activePipeline.preparing++;
    else if (['out_for_delivery', 'outfordelivery', 'picked_up'].includes(status)) activePipeline.outForDelivery++;
    else if (['delivered', 'completed'].includes(status)) activePipeline.delivered++;
    else if (['cancelled', 'rejected'].includes(status)) activePipeline.cancelled++;
  });

  const activeOrdersCount = activePipeline.pending + activePipeline.preparing + activePipeline.outForDelivery;

  return (
    <div className="space-y-6">
      {/* Page Title & Status Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-white">Operations Dashboard</h2>
          <p className="text-xs text-slate-400">Real-time revenue, order pipeline, and restaurant metrics.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/orders"
            className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold rounded-xl flex items-center gap-2 transition-colors shadow-lg shadow-orange-600/20"
          >
            <Clock className="w-4 h-4" />
            Live Orders Board ({activeOrdersCount})
          </Link>
        </div>
      </div>

      {error && <ErrorState message={error} onRetry={() => window.location.reload()} />}

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Today's Revenue"
          value={`₹${todayRevenue.toLocaleString('en-IN')}`}
          subtitle={`${todayOrdersCount} orders placed today`}
          icon={IndianRupee}
          color="orange"
        />
        <StatCard
          title="Active in Kitchen / Fleet"
          value={activeOrdersCount}
          subtitle={`${activePipeline.pending} new, ${activePipeline.preparing} prep, ${activePipeline.outForDelivery} transit`}
          icon={Activity}
          color={activeOrdersCount > 0 ? 'green' : 'blue'}
        />
        <StatCard
          title="Month's Revenue"
          value={`₹${monthRevenue.toLocaleString('en-IN')}`}
          subtitle={`${monthOrdersCount} total orders this month`}
          icon={TrendingUp}
          color="purple"
        />
        <StatCard
          title="Completed Deliveries"
          value={activePipeline.delivered}
          subtitle={`${activePipeline.cancelled} cancelled in recent log`}
          icon={CheckCircle2}
          color="amber"
        />
      </div>

      {/* Quick Action Shortcuts */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Link
          to="/products"
          className="p-3.5 rounded-2xl bg-[#131B2B] border border-slate-800 hover:border-slate-700 flex items-center gap-3 transition-colors"
        >
          <div className="p-2 rounded-xl bg-orange-500/10 text-orange-400">
            <PlusCircle className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xs font-bold text-white">Add Product</p>
            <p className="text-[10px] text-slate-400">Update catalog</p>
          </div>
        </Link>
        <Link
          to="/coupons"
          className="p-3.5 rounded-2xl bg-[#131B2B] border border-slate-800 hover:border-slate-700 flex items-center gap-3 transition-colors"
        >
          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
            <Tag className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xs font-bold text-white">Create Coupon</p>
            <p className="text-[10px] text-slate-400">Manage discounts</p>
          </div>
        </Link>
        <Link
          to="/media"
          className="p-3.5 rounded-2xl bg-[#131B2B] border border-slate-800 hover:border-slate-700 flex items-center gap-3 transition-colors"
        >
          <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
            <FolderOpen className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xs font-bold text-white">Media Library</p>
            <p className="text-[10px] text-slate-400">Cloudinary assets</p>
          </div>
        </Link>
        <Link
          to="/reports"
          className="p-3.5 rounded-2xl bg-[#131B2B] border border-slate-800 hover:border-slate-700 flex items-center gap-3 transition-colors"
        >
          <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400">
            <ShoppingBag className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xs font-bold text-white">Sales Reports</p>
            <p className="text-[10px] text-slate-400">Download CSV</p>
          </div>
        </Link>
      </div>

      {/* Recent Live Orders Table */}
      <div className="bg-[#131B2B] border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-extrabold text-white">Recent Orders Stream</h3>
            <p className="text-xs text-slate-400">Live feed updated in real-time from Firestore</p>
          </div>
          <Link
            to="/orders"
            className="text-xs font-bold text-orange-400 hover:text-orange-300 flex items-center gap-1"
          >
            View All Orders
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {loading ? (
          <div className="p-5">
            <TableSkeleton rows={5} cols={5} />
          </div>
        ) : orders.length === 0 ? (
          <EmptyState title="No orders yet" message="When customers place orders, they will appear here in real-time." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#0E1524] text-slate-400 font-bold border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Order ID</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Items</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {orders.slice(0, 8).map((order) => {
                  const status = (order.status || 'pending').toLowerCase();
                  const statusColors: Record<string, string> = {
                    pending: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
                    placed: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
                    preparing: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
                    out_for_delivery: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
                    delivered: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
                    cancelled: 'bg-red-500/10 text-red-400 border-red-500/20',
                  };

                  return (
                    <tr key={order.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-white">
                        #{order.dailyOrderNumber || order.id.slice(0, 6)}
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-bold text-slate-200">{order.customerName}</p>
                        <p className="text-[10px] text-slate-400">{order.customerPhone}</p>
                      </td>
                      <td className="py-3 px-4 text-slate-300">
                        {order.items?.map((it) => `${it.quantity}x ${it.name}`).join(', ') || 'No items'}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-emerald-400">
                        ₹{order.totalAmount}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${
                            statusColors[status] || 'bg-slate-800 text-slate-300'
                          }`}
                        >
                          {order.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Link
                          to="/orders"
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-lg text-[11px] inline-block transition-colors"
                        >
                          Manage
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
