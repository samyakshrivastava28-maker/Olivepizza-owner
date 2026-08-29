import React, { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  ShoppingBag,
  DollarSign,
  Clock,
  CheckCircle2,
  XCircle,
  Users,
  Bike,
  Store,
  CreditCard,
  Calendar,
  RefreshCw,
  ArrowUpRight,
  Pizza,
  Zap,
} from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import { Order } from '../types/models';
import { fetchApi } from '../lib/api';

type TimeRange = 'today' | 'yesterday' | 'week' | 'month' | 'custom';

function parseTimestamp(val: any): Date {
  if (!val) return new Date();
  if (val instanceof Date) return val;
  if (typeof val.toDate === 'function') return val.toDate();
  if (typeof val === 'object' && val._seconds) return new Date(val._seconds * 1000);
  if (typeof val === 'number') return new Date(val);
  const d = new Date(val);
  return isNaN(d.getTime()) ? new Date() : d;
}

export default function Analytics() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLive, setIsLive] = useState(false);
  const [timeRange, setTimeRange] = useState<TimeRange>('today');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  // Subscribe to real-time orders from Firestore
  useEffect(() => {
    setLoading(true);
    const unsubscribe = onSnapshot(
      collection(db, 'orders'),
      (snapshot) => {
        const fetchedOrders: Order[] = [];
        snapshot.forEach((docSnap) => {
          fetchedOrders.push({ id: docSnap.id, ...docSnap.data() } as Order);
        });

        // Client-side sort by parsed timestamp
        fetchedOrders.sort((a, b) => {
          const timeA = parseTimestamp(a.createdAt).getTime();
          const timeB = parseTimestamp(b.createdAt).getTime();
          return timeB - timeA;
        });

        setOrders(fetchedOrders);
        setIsLive(true);
        setLoading(false);
        setLastRefreshed(new Date());
      },
      (error) => {
        console.warn('[Analytics] Firestore stream notice, trying API fallback:', error);
        setIsLive(false);
        fetchApi('/api/orders?limit=300')
          .then(async (res) => { if (!res.ok) return {}; return res.json().catch(() => ({})); })
          .then((data) => {
            const list = Array.isArray(data) ? data : data.orders || [];
            setOrders(list);
          })
          .catch((err) => console.error('[Analytics] API fallback failed:', err))
          .finally(() => setLoading(false));
      }
    );

    return () => unsubscribe();
  }, []);

  // Filter orders by timeframe
  const filteredOrders = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;
    const startOfWeek = now.getTime() - 7 * 24 * 60 * 60 * 1000;
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    return orders.filter((order) => {
      const orderTime = parseTimestamp(order.createdAt).getTime();

      switch (timeRange) {
        case 'today':
          return orderTime >= startOfToday;
        case 'yesterday':
          return orderTime >= startOfYesterday && orderTime < startOfToday;
        case 'week':
          return orderTime >= startOfWeek;
        case 'month':
          return orderTime >= startOfMonth;
        case 'custom':
          if (!customStart || !customEnd) return true;
          const cStart = new Date(customStart).getTime();
          const cEnd = new Date(customEnd).getTime() + 24 * 60 * 60 * 1000;
          return orderTime >= cStart && orderTime <= cEnd;
        default:
          return true;
      }
    });
  }, [orders, timeRange, customStart, customEnd]);

  // Aggregate Metrics
  const metrics = useMemo(() => {
    const totalOrders = filteredOrders.length;
    let totalRevenue = 0;
    let completedCount = 0;
    let cancelledCount = 0;
    let activeCount = 0;
    let deliveryCount = 0;
    let takeawayCount = 0;
    let dineInCount = 0;
    let onlineCount = 0;
    let restaurantCount = 0;
    const paymentMethods: Record<string, number> = {};
    const itemMap: Record<string, { name: string; count: number; revenue: number }> = {};
    const categoryMap: Record<string, number> = {};

    filteredOrders.forEach((o) => {
      const status = (o.status || 'pending').toLowerCase();
      const amount = Number(o.totalAmount ?? (o as any).total ?? (o as any).finalAmount ?? 0);

      if (status !== 'cancelled' && status !== 'rejected') {
        totalRevenue += amount;
      }

      if (status === 'delivered' || status === 'completed') completedCount++;
      else if (status === 'cancelled' || status === 'rejected') cancelledCount++;
      else activeCount++;

      // Fulfillment
      const fulfillment = ((o as any).deliveryType || (o as any).fulfillmentType || (o as any).fulfillment || 'delivery').toLowerCase();
      if (fulfillment.includes('takeaway') || fulfillment.includes('pickup')) takeawayCount++;
      else if (fulfillment.includes('dine')) dineInCount++;
      else deliveryCount++;

      // Source
      const source = ((o as any).orderSource || (o as any).source || 'online').toLowerCase();
      if (source.includes('offline') || source.includes('pos') || source.includes('restaurant')) restaurantCount++;
      else onlineCount++;

      // Payment
      const pay = (o.paymentMethod || (o as any).payment?.method || 'UPI').toUpperCase();
      paymentMethods[pay] = (paymentMethods[pay] || 0) + 1;

      // Products breakdown
      const items = o.items || [];
      items.forEach((it: any) => {
        const name = it.name || it.productName || 'Pizza Item';
        const qty = Number(it.quantity || it.qty || 1);
        const price = Number(it.price || 0) * qty;
        const cat = it.category || 'Pizza';

        if (!itemMap[name]) {
          itemMap[name] = { name, count: 0, revenue: 0 };
        }
        itemMap[name].count += qty;
        itemMap[name].revenue += price;

        categoryMap[cat] = (categoryMap[cat] || 0) + qty;
      });
    });

    const averageOrderValue = totalOrders > 0 ? Math.round(totalRevenue / Math.max(1, totalOrders - cancelledCount)) : 0;
    const topItems = Object.values(itemMap)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    return {
      totalOrders,
      totalRevenue,
      averageOrderValue,
      completedCount,
      cancelledCount,
      activeCount,
      deliveryCount,
      takeawayCount,
      dineInCount,
      onlineCount,
      restaurantCount,
      paymentMethods,
      topItems,
      categoryMap,
    };
  }, [filteredOrders]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#0E1524] p-5 rounded-2xl border border-slate-800 shadow-lg">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-extrabold text-white tracking-tight">Business Analytics & Metrics</h1>
            <span
              className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                isLive ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400' : 'bg-slate-700 text-slate-300'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${isLive ? 'bg-emerald-400 animate-pulse' : 'bg-slate-400'}`} />
              {isLive ? 'Live Sync' : 'Polled'}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time financial performance, volume, channel distribution, and product metrics.
          </p>
        </div>

        {/* Timeframe Filter Buttons */}
        <div className="flex flex-wrap items-center gap-1.5 bg-[#0B0F17] p-1 rounded-xl border border-slate-800">
          {(['today', 'yesterday', 'week', 'month'] as TimeRange[]).map((tr) => (
            <button
              key={tr}
              onClick={() => setTimeRange(tr)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all ${
                timeRange === tr
                  ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              {tr}
            </button>
          ))}
        </div>
      </div>

      {/* 4 Core Financial KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Gross Revenue */}
        <div className="bg-[#0E1524] border border-slate-800 rounded-2xl p-5 shadow-md flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider">
            <span>Gross Revenue</span>
            <DollarSign className="w-4 h-4 text-orange-400" />
          </div>
          <div className="my-3">
            <div className="text-2xl sm:text-3xl font-extrabold text-white font-mono">
              ₹{metrics.totalRevenue.toLocaleString('en-IN')}
            </div>
            <div className="text-[11px] text-emerald-400 font-bold flex items-center gap-1 mt-1">
              <TrendingUp className="w-3.5 h-3.5" /> Direct gross sales
            </div>
          </div>
          <div className="text-[10px] text-slate-500 border-t border-slate-800/80 pt-2">
            Excludes cancelled/failed orders
          </div>
        </div>

        {/* Total Orders */}
        <div className="bg-[#0E1524] border border-slate-800 rounded-2xl p-5 shadow-md flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider">
            <span>Total Orders</span>
            <ShoppingBag className="w-4 h-4 text-orange-400" />
          </div>
          <div className="my-3">
            <div className="text-2xl sm:text-3xl font-extrabold text-white font-mono">{metrics.totalOrders}</div>
            <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-1">
              <span className="text-emerald-400 font-bold">{metrics.completedCount} Done</span>
              <span className="text-slate-600">•</span>
              <span className="text-amber-400 font-bold">{metrics.activeCount} Active</span>
            </div>
          </div>
          <div className="text-[10px] text-slate-500 border-t border-slate-800/80 pt-2">
            {metrics.cancelledCount} cancelled orders
          </div>
        </div>

        {/* Average Order Value */}
        <div className="bg-[#0E1524] border border-slate-800 rounded-2xl p-5 shadow-md flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider">
            <span>Average Order Value</span>
            <TrendingUp className="w-4 h-4 text-orange-400" />
          </div>
          <div className="my-3">
            <div className="text-2xl sm:text-3xl font-extrabold text-white font-mono">
              ₹{metrics.averageOrderValue.toLocaleString('en-IN')}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">Per completed transaction</div>
          </div>
          <div className="text-[10px] text-slate-500 border-t border-slate-800/80 pt-2">Basket size indicator</div>
        </div>

        {/* Kitchen Velocity */}
        <div className="bg-[#0E1524] border border-slate-800 rounded-2xl p-5 shadow-md flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider">
            <span>Active Kitchen Load</span>
            <Zap className="w-4 h-4 text-orange-400" />
          </div>
          <div className="my-3">
            <div className="text-2xl sm:text-3xl font-extrabold text-white font-mono">{metrics.activeCount}</div>
            <div className="text-[11px] text-orange-400 font-bold mt-1">In Preparation / In Transit</div>
          </div>
          <div className="text-[10px] text-slate-500 border-t border-slate-800/80 pt-2">Current kitchen queue</div>
        </div>
      </div>

      {/* Grid: Channel Breakdown & Top Products Leaderboard */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Channel Distribution */}
        <div className="bg-[#0E1524] border border-slate-800 rounded-2xl p-6 shadow-md space-y-4">
          <h3 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
            <Bike className="w-4 h-4 text-orange-400" /> Channel Distribution
          </h3>

          <div className="space-y-3">
            {/* Delivery */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-bold">
                <span className="text-slate-300">Home Delivery</span>
                <span className="text-white font-mono">{metrics.deliveryCount} orders</span>
              </div>
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-orange-500 rounded-full"
                  style={{
                    width: `${metrics.totalOrders > 0 ? (metrics.deliveryCount / metrics.totalOrders) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>

            {/* Takeaway */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-bold">
                <span className="text-slate-300">Takeaway / Pickup</span>
                <span className="text-white font-mono">{metrics.takeawayCount} orders</span>
              </div>
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full"
                  style={{
                    width: `${metrics.totalOrders > 0 ? (metrics.takeawayCount / metrics.totalOrders) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>

            {/* Dine-in */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-bold">
                <span className="text-slate-300">Dine-In Table</span>
                <span className="text-white font-mono">{metrics.dineInCount} orders</span>
              </div>
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full"
                  style={{
                    width: `${metrics.totalOrders > 0 ? (metrics.dineInCount / metrics.totalOrders) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800 text-[11px] text-slate-400 flex justify-between">
            <span>Online Web & App: <strong>{metrics.onlineCount}</strong></span>
            <span>In-Store / Direct: <strong>{metrics.restaurantCount}</strong></span>
          </div>
        </div>

        {/* Top-Selling Menu Items */}
        <div className="lg:col-span-2 bg-[#0E1524] border border-slate-800 rounded-2xl p-6 shadow-md space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
              <Pizza className="w-4 h-4 text-orange-400" /> Best-Selling Items Leaderboard
            </h3>
            <span className="text-[11px] text-slate-400">By Gross Volume</span>
          </div>

          {metrics.topItems.length === 0 ? (
            <div className="text-center py-10 text-slate-500 text-xs">No product sales recorded in this timeframe.</div>
          ) : (
            <div className="space-y-2.5">
              {metrics.topItems.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 bg-[#0B0F17] rounded-xl border border-slate-800/80 hover:border-slate-700 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-lg bg-orange-500/10 text-orange-400 font-extrabold text-xs flex items-center justify-center font-mono">
                      #{idx + 1}
                    </span>
                    <div>
                      <div className="font-bold text-white text-xs">{item.name}</div>
                      <div className="text-[11px] text-slate-400">{item.count} units sold</div>
                    </div>
                  </div>
                  <div className="text-right font-mono">
                    <div className="text-xs font-extrabold text-orange-400">₹{item.revenue.toLocaleString('en-IN')}</div>
                    <div className="text-[10px] text-slate-500">Revenue</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
