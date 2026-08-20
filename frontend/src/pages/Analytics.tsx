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
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { Order } from '../types/models';
import { fetchApi } from '../lib/api';

type TimeRange = 'today' | 'yesterday' | 'week' | 'month' | 'custom';

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
    const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'), limit(500));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetchedOrders: Order[] = [];
        snapshot.forEach((doc) => {
          fetchedOrders.push({ id: doc.id, ...doc.data() } as Order);
        });
        setOrders(fetchedOrders);
        setIsLive(true);
        setLoading(false);
        setLastRefreshed(new Date());
      },
      (error) => {
        console.warn('[Analytics] Firestore real-time listener failed, falling back to API:', error);
        setIsLive(false);
        fetchApi('/api/orders?limit=300')
          .then((res) => res.json())
          .then((data) => {
            if (data.orders || Array.isArray(data)) {
              setOrders(data.orders || data);
            }
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
      const orderTime = new Date(order.createdAt?.toDate ? order.createdAt.toDate() : order.createdAt || 0).getTime();

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
      const amount = Number(o.total || o.finalAmount || o.totalAmount || 0);

      if (status !== 'cancelled') {
        totalRevenue += amount;
      }

      if (status === 'delivered' || status === 'completed') completedCount++;
      else if (status === 'cancelled') cancelledCount++;
      else activeCount++;

      // Fulfillment
      const fulfillment = (o.fulfillmentType || o.fulfillment || 'delivery').toLowerCase();
      if (fulfillment.includes('takeaway') || fulfillment.includes('pickup')) takeawayCount++;
      else if (fulfillment.includes('dine')) dineInCount++;
      else deliveryCount++;

      // Source
      const source = (o.orderSource || o.source || 'online').toLowerCase();
      if (source.includes('offline') || source.includes('pos') || source.includes('restaurant')) restaurantCount++;
      else onlineCount++;

      // Payment
      const pay = (o.paymentMethod || o.payment?.method || 'UPI').toUpperCase();
      paymentMethods[pay] = (paymentMethods[pay] || 0) + 1;

      // Products breakdown
      const items = o.items || [];
      items.forEach((it: any) => {
        const name = it.name || it.productName || 'Pizza Item';
        const qty = Number(it.quantity || it.qty || 1);
        const price = Number(it.price || 0) * qty;
        const cat = it.category || 'Pizza';

        if (!itemMap[name]) itemMap[name] = { name, count: 0, revenue: 0 };
        itemMap[name].count += qty;
        itemMap[name].revenue += price;

        categoryMap[cat] = (categoryMap[cat] || 0) + qty;
      });
    });

    const aov = totalOrders > 0 ? Math.round(totalRevenue / Math.max(1, totalOrders - cancelledCount)) : 0;
    const popularItems = Object.values(itemMap).sort((a, b) => b.count - a.count).slice(0, 5);

    return {
      totalOrders,
      totalRevenue,
      completedCount,
      cancelledCount,
      activeCount,
      deliveryCount,
      takeawayCount,
      dineInCount,
      onlineCount,
      restaurantCount,
      aov,
      popularItems,
      categoryMap,
      paymentMethods,
    };
  }, [filteredOrders]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#0E1524] p-5 rounded-2xl border border-slate-800 shadow-lg">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-extrabold text-white tracking-tight">Live Restaurant Analytics</h1>
            {isLive && (
              <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-black uppercase tracking-wider animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> LIVE
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time business performance, order velocity, and sales intelligence. Last refreshed at{' '}
            {lastRefreshed.toLocaleTimeString()}.
          </p>
        </div>

        {/* Timeframe Selector */}
        <div className="flex items-center gap-1.5 bg-[#0B0F17] p-1 rounded-xl border border-slate-800">
          {(['today', 'yesterday', 'week', 'month', 'custom'] as TimeRange[]).map((t) => (
            <button
              key={t}
              onClick={() => setTimeRange(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all ${
                timeRange === t
                  ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Custom Date Range Row */}
      {timeRange === 'custom' && (
        <div className="flex flex-wrap items-center gap-3 p-4 bg-[#0E1524] rounded-2xl border border-slate-800 text-xs">
          <Calendar className="w-4 h-4 text-orange-400" />
          <span className="text-slate-300 font-bold">Custom Range:</span>
          <input
            type="date"
            value={customStart}
            onChange={(e) => setCustomStart(e.target.value)}
            className="bg-[#0B0F17] border border-slate-800 text-white rounded-lg px-2.5 py-1 focus:border-orange-500 focus:outline-none"
          />
          <span className="text-slate-500">to</span>
          <input
            type="date"
            value={customEnd}
            onChange={(e) => setCustomEnd(e.target.value)}
            className="bg-[#0B0F17] border border-slate-800 text-white rounded-lg px-2.5 py-1 focus:border-orange-500 focus:outline-none"
          />
        </div>
      )}

      {/* Top 4 KPI Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#0E1524] border border-slate-800 rounded-2xl p-5 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Sales</span>
            <div className="w-8 h-8 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-400 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-white mt-2 font-mono">
            ₹{metrics.totalRevenue.toLocaleString('en-IN')}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
            <span className="text-emerald-400 font-bold flex items-center gap-0.5">
              <TrendingUp className="w-3 h-3" /> Realtime
            </span>
            <span>across {metrics.totalOrders} total orders</span>
          </div>
        </div>

        <div className="bg-[#0E1524] border border-slate-800 rounded-2xl p-5 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Orders</span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-white mt-2 font-mono">{metrics.activeCount}</div>
          <div className="text-[11px] text-slate-400 mt-1">Kitchen & in-transit orders</div>
        </div>

        <div className="bg-[#0E1524] border border-slate-800 rounded-2xl p-5 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Avg Order Value (AOV)</span>
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-white mt-2 font-mono">
            ₹{metrics.aov.toLocaleString('en-IN')}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Per completed ticket</div>
        </div>

        <div className="bg-[#0E1524] border border-slate-800 rounded-2xl p-5 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Delivered vs Cancelled</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-white mt-2 font-mono">
            <span className="text-emerald-400">{metrics.completedCount}</span>
            <span className="text-slate-500 text-sm mx-1.5">/</span>
            <span className="text-rose-400 text-lg">{metrics.cancelledCount}</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {metrics.totalOrders > 0
              ? `${Math.round((metrics.completedCount / metrics.totalOrders) * 100)}% fulfillment rate`
              : 'No orders yet'}
          </div>
        </div>
      </div>

      {/* 2-Column Operational Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Fulfillment & Channel Breakdown */}
        <div className="bg-[#0E1524] border border-slate-800 rounded-2xl p-6 shadow-md space-y-4">
          <h2 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
            <Bike className="w-4 h-4 text-orange-400" /> Channel & Fulfillment Breakdown
          </h2>

          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="p-3 bg-[#0B0F17] rounded-xl border border-slate-800">
              <div className="text-xs text-slate-400 font-medium">Delivery</div>
              <div className="text-lg font-bold text-white font-mono mt-1">{metrics.deliveryCount}</div>
            </div>
            <div className="p-3 bg-[#0B0F17] rounded-xl border border-slate-800">
              <div className="text-xs text-slate-400 font-medium">Takeaway</div>
              <div className="text-lg font-bold text-white font-mono mt-1">{metrics.takeawayCount}</div>
            </div>
            <div className="p-3 bg-[#0B0F17] rounded-xl border border-slate-800">
              <div className="text-xs text-slate-400 font-medium">Dine-In</div>
              <div className="text-lg font-bold text-white font-mono mt-1">{metrics.dineInCount}</div>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800 flex justify-between items-center text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span className="text-slate-300">Online Orders (App/Web):</span>
            </div>
            <span className="font-bold text-white font-mono">{metrics.onlineCount}</span>
          </div>
          <div className="flex justify-between items-center text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-400"></span>
              <span className="text-slate-300">Restaurant / POS Walk-in:</span>
            </div>
            <span className="font-bold text-white font-mono">{metrics.restaurantCount}</span>
          </div>
        </div>

        {/* Popular Items Leaderboard */}
        <div className="bg-[#0E1524] border border-slate-800 rounded-2xl p-6 shadow-md space-y-4">
          <h2 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
            <Pizza className="w-4 h-4 text-orange-400" /> Best Selling Menu Items
          </h2>

          {metrics.popularItems.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-xs">No product sales in selected timeframe</div>
          ) : (
            <div className="space-y-3">
              {metrics.popularItems.map((item, idx) => (
                <div key={item.name} className="flex items-center justify-between p-2.5 bg-[#0B0F17] rounded-xl border border-slate-800 text-xs">
                  <div className="flex items-center gap-2.5">
                    <span className="w-5 h-5 rounded-lg bg-orange-500/10 text-orange-400 font-bold flex items-center justify-center text-[10px]">
                      #{idx + 1}
                    </span>
                    <span className="font-bold text-white">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-slate-400">{item.count} sold</span>
                    <span className="font-mono font-bold text-orange-400">₹{item.revenue.toLocaleString('en-IN')}</span>
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
