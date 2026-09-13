import React, { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  ShoppingBag,
  DollarSign,
  Clock,
  CheckCircle2,
  XCircle,
  Bike,
  Store,
  CreditCard,
  Calendar,
  RefreshCw,
  Pizza,
  AlertTriangle,
  Flame,
  Award,
  ShieldAlert,
  ArrowRight,
  Activity,
  Layers
} from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { Order, User } from '../types/models';
import { fetchApi } from '../lib/api';

type TimeRange = 'today' | 'yesterday' | 'week' | 'month';

function parseTimestamp(val: any): Date {
  if (!val) return new Date();
  if (val instanceof Date) return val;
  if (typeof val.toDate === 'function') return val.toDate();
  if (typeof val === 'object' && val._seconds) return new Date(val._seconds * 1000);
  if (typeof val === 'number') return new Date(val);
  const d = new Date(val);
  return isNaN(d.getTime()) ? new Date() : d;
}

function calculateDelta(current: number, previous: number): { pct: number | null; isPositive: boolean } {
  if (previous === 0) {
    if (current === 0) return { pct: 0, isPositive: true };
    return { pct: null, isPositive: true }; // New baseline
  }
  const diff = current - previous;
  const pct = Math.round((diff / previous) * 100);
  return { pct, isPositive: pct >= 0 };
}

export default function Analytics() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [riders, setRiders] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLive, setIsLive] = useState(false);
  const [timeRange, setTimeRange] = useState<TimeRange>('today');
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  // 1. Subscribe to real-time orders from Firestore
  useEffect(() => {
    setLoading(true);
    const unsubscribe = onSnapshot(
      collection(db, 'orders'),
      (snapshot) => {
        const fetchedOrders: Order[] = [];
        snapshot.forEach((docSnap) => {
          fetchedOrders.push({ id: docSnap.id, ...docSnap.data() } as Order);
        });

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
        console.warn('[Analytics] Firestore stream error, falling back to API:', error);
        setIsLive(false);
        fetchApi('/api/orders?limit=500')
          .then(async (res) => { if (!res.ok) return {}; return res.json().catch(() => ({})); })
          .then((data) => {
            const list = Array.isArray(data) ? data : data.orders || [];
            setOrders(list);
          })
          .catch((err) => console.error('[Analytics] API fallback error:', err))
          .finally(() => setLoading(false));
      }
    );

    return () => unsubscribe();
  }, []);

  // 2. Subscribe to delivery partner users for fleet analysis
  useEffect(() => {
    const qRiders = query(collection(db, 'users'), where('role', 'in', ['delivery', 'delivery_partner']));
    const unsubRiders = onSnapshot(qRiders, (snap) => {
      const list: User[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() } as User));
      setRiders(list);
    });
    return () => unsubRiders();
  }, []);

  // 3. Partition Orders into Current & Previous Comparison Period
  const { currentOrders, previousOrders, periodLabel, prevPeriodLabel } = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const oneDayMs = 24 * 60 * 60 * 1000;
    const oneWeekMs = 7 * oneDayMs;

    let currentStart = 0;
    let currentEnd = now.getTime();
    let prevStart = 0;
    let prevEnd = 0;
    let periodLabel = 'Today';
    let prevPeriodLabel = 'Yesterday';

    switch (timeRange) {
      case 'today':
        currentStart = startOfToday;
        currentEnd = now.getTime();
        prevStart = startOfToday - oneDayMs;
        prevEnd = startOfToday;
        periodLabel = 'Today';
        prevPeriodLabel = 'Yesterday';
        break;

      case 'yesterday':
        currentStart = startOfToday - oneDayMs;
        currentEnd = startOfToday;
        prevStart = startOfToday - 2 * oneDayMs;
        prevEnd = startOfToday - oneDayMs;
        periodLabel = 'Yesterday';
        prevPeriodLabel = 'Day Before Yesterday';
        break;

      case 'week':
        currentStart = now.getTime() - oneWeekMs;
        currentEnd = now.getTime();
        prevStart = now.getTime() - 2 * oneWeekMs;
        prevEnd = now.getTime() - oneWeekMs;
        periodLabel = 'Last 7 Days';
        prevPeriodLabel = 'Prior 7 Days';
        break;

      case 'month':
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
        const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
        currentStart = startOfMonth;
        currentEnd = now.getTime();
        prevStart = startOfPrevMonth;
        prevEnd = startOfMonth;
        periodLabel = 'This Month';
        prevPeriodLabel = 'Last Month';
        break;
    }

    const currentOrders = orders.filter((o) => {
      const t = parseTimestamp(o.createdAt).getTime();
      return t >= currentStart && t < currentEnd;
    });

    const previousOrders = orders.filter((o) => {
      const t = parseTimestamp(o.createdAt).getTime();
      return t >= prevStart && t < prevEnd;
    });

    return { currentOrders, previousOrders, periodLabel, prevPeriodLabel };
  }, [orders, timeRange]);

  // 4. Compute Deep Data-Science Metrics
  const metrics = useMemo(() => {
    const processSet = (orderList: Order[]) => {
      let grossRevenue = 0;
      let netRevenue = 0;
      let completedCount = 0;
      let cancelledCount = 0;
      let activeCount = 0;
      let deliveryCount = 0;
      let takeawayCount = 0;
      let dineInCount = 0;
      let onlineCount = 0;
      let posCount = 0;

      let totalPrepDurationMin = 0;
      let prepCount = 0;
      let totalDeliveryDurationMin = 0;
      let deliveryDurationCount = 0;
      let onTimeDeliveryCount = 0;

      const cancellationReasons: Record<string, number> = {};
      const productSales: Record<string, { name: string; category: string; units: number; revenue: number }> = {};
      const riderTrips: Record<string, { name: string; completed: number; totalMinutes: number; onTime: number }> = {};
      const paymentBreakdown: Record<string, number> = {};

      orderList.forEach((o: any) => {
        const status = (o.status || 'pending').toLowerCase();
        const totalAmount = Number(o.totalAmount ?? o.total ?? o.finalAmount ?? 0);
        const discount = Number(o.discountAmount ?? o.discount ?? 0);

        const isCancelled = status === 'cancelled' || status === 'rejected';

        if (!isCancelled) {
          grossRevenue += totalAmount;
          netRevenue += Math.max(0, totalAmount - discount);
        }

        if (status === 'delivered' || status === 'completed') {
          completedCount++;
        } else if (isCancelled) {
          cancelledCount++;
          const reason = o.cancellationReason || o.rejectionReason || 'Other / Customer Request';
          cancellationReasons[reason] = (cancellationReasons[reason] || 0) + 1;
        } else {
          activeCount++;
        }

        // Fulfillment Type
        const fulfillment = (o.fulfillmentType || o.deliveryType || 'delivery').toLowerCase();
        if (fulfillment.includes('takeaway') || fulfillment.includes('pickup')) takeawayCount++;
        else if (fulfillment.includes('dine')) dineInCount++;
        else deliveryCount++;

        // Channel Source
        const source = (o.orderSource || o.source || 'online').toLowerCase();
        if (source.includes('pos') || source.includes('restaurant') || source.includes('offline')) posCount++;
        else onlineCount++;

        // Payment Method
        const pay = (o.paymentMethod || o.payment?.method || 'UPI').toUpperCase();
        paymentBreakdown[pay] = (paymentBreakdown[pay] || 0) + 1;

        // Kitchen Prep Duration: readyAt - (acceptedAt || preparingAt)
        if (o.readyAt && (o.acceptedAt || o.preparingAt)) {
          const start = new Date(o.acceptedAt || o.preparingAt).getTime();
          const end = new Date(o.readyAt).getTime();
          if (end > start) {
            totalPrepDurationMin += (end - start) / (60 * 1000);
            prepCount++;
          }
        }

        // Delivery Trip Duration: deliveredAt - (pickedUpAt || partnerAssignedAt)
        if (o.deliveredAt && (o.pickedUpAt || o.partnerAssignedAt)) {
          const start = new Date(o.pickedUpAt || o.partnerAssignedAt).getTime();
          const end = new Date(o.deliveredAt).getTime();
          if (end > start) {
            const tripMin = (end - start) / (60 * 1000);
            totalDeliveryDurationMin += tripMin;
            deliveryDurationCount++;
            if (tripMin <= 30) {
              onTimeDeliveryCount++;
            }

            const riderId = o.deliveryPartnerId || 'unassigned';
            const riderName = o.deliveryPartnerName || 'Assigned Partner';
            if (!riderTrips[riderId]) {
              riderTrips[riderId] = { name: riderName, completed: 0, totalMinutes: 0, onTime: 0 };
            }
            riderTrips[riderId].completed++;
            riderTrips[riderId].totalMinutes += tripMin;
            if (tripMin <= 30) riderTrips[riderId].onTime++;
          }
        }

        // Product level aggregation
        const items = o.items || [];
        items.forEach((it: any) => {
          const name = it.name || it.productName || 'Menu Item';
          const cat = it.category || 'Pizzas';
          const qty = Number(it.quantity || it.qty || 1);
          const price = Number(it.price || 0) * qty;

          if (!productSales[name]) {
            productSales[name] = { name, category: cat, units: 0, revenue: 0 };
          }
          productSales[name].units += qty;
          productSales[name].revenue += price;
        });
      });

      const totalOrders = orderList.length;
      const validOrders = Math.max(1, totalOrders - cancelledCount);
      const aov = totalOrders > 0 ? Math.round(grossRevenue / validOrders) : 0;
      const cancellationRate = totalOrders > 0 ? Number(((cancelledCount / totalOrders) * 100).toFixed(1)) : 0;
      const avgPrepTimeMin = prepCount > 0 ? Math.round(totalPrepDurationMin / prepCount) : 0;
      const avgDeliveryTimeMin = deliveryDurationCount > 0 ? Math.round(totalDeliveryDurationMin / deliveryDurationCount) : 0;
      const onTimeRate = deliveryDurationCount > 0 ? Math.round((onTimeDeliveryCount / deliveryDurationCount) * 100) : 0;

      return {
        totalOrders,
        grossRevenue,
        netRevenue,
        aov,
        completedCount,
        cancelledCount,
        activeCount,
        deliveryCount,
        takeawayCount,
        dineInCount,
        onlineCount,
        posCount,
        cancellationRate,
        avgPrepTimeMin,
        avgDeliveryTimeMin,
        onTimeRate,
        cancellationReasons,
        productSales: Object.values(productSales).sort((a, b) => b.revenue - a.revenue),
        riderLeaderboard: Object.values(riderTrips).sort((a, b) => b.completed - a.completed),
        paymentBreakdown,
      };
    };

    const current = processSet(currentOrders);
    const previous = processSet(previousOrders);

    const revenueDelta = calculateDelta(current.grossRevenue, previous.grossRevenue);
    const ordersDelta = calculateDelta(current.totalOrders, previous.totalOrders);
    const aovDelta = calculateDelta(current.aov, previous.aov);

    return { current, previous, revenueDelta, ordersDelta, aovDelta };
  }, [currentOrders, previousOrders]);

  // 5. Automated Operational Anomaly Detection
  const anomalies = useMemo(() => {
    const alerts: { id: string; type: 'warning' | 'critical' | 'info'; title: string; message: string }[] = [];

    // Cancellation spike
    if (metrics.current.totalOrders >= 5 && metrics.current.cancellationRate > 15) {
      alerts.push({
        id: 'cancellation_spike',
        type: 'critical',
        title: 'High Cancellation Rate Detected',
        message: `${metrics.current.cancellationRate}% of orders cancelled during ${periodLabel}. Investigate store kitchen or address feasibility.`
      });
    }

    // Delivery delay bottleneck
    if (metrics.current.avgDeliveryTimeMin > 45) {
      alerts.push({
        id: 'delivery_bottleneck',
        type: 'warning',
        title: 'Elevated Delivery Trip Durations',
        message: `Average delivery time is ${metrics.current.avgDeliveryTimeMin} minutes (Target: <30m). Rider queue or dispatch bottleneck detected.`
      });
    }

    // Kitchen preparation delay
    if (metrics.current.avgPrepTimeMin > 30) {
      alerts.push({
        id: 'kitchen_delay',
        type: 'warning',
        title: 'Kitchen Preparation Congestion',
        message: `Average kitchen prep time is ${metrics.current.avgPrepTimeMin} minutes (Target: <20m). Consider pacing order acceptance.`
      });
    }

    // Fleet online check
    const onlineRiders = riders.filter((r) => r.status === 'online' || r.isOnline);
    if (onlineRiders.length === 0 && metrics.current.activeCount > 0) {
      alerts.push({
        id: 'zero_riders',
        type: 'critical',
        title: 'Zero Delivery Riders Online',
        message: 'Active delivery orders exist but no delivery partners are currently online in the store fleet.'
      });
    }

    return alerts;
  }, [metrics, riders, periodLabel]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* ── Header & Timeframe Bar ────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#0E1524] p-5 rounded-2xl border border-slate-800 shadow-xl">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
              <Activity className="w-5 h-5 text-orange-500" />
              Executive Business Analytics
            </h1>
            <span
              className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                isLive ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400' : 'bg-slate-700 text-slate-300'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${isLive ? 'bg-emerald-400 animate-pulse' : 'bg-slate-400'}`} />
              {isLive ? 'Live DB Stream' : 'Cached Sync'}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Real data-science KPIs, period comparisons, fleet cycle times, and operational anomaly detection.
          </p>
        </div>

        {/* Timeframe Selector */}
        <div className="flex flex-wrap items-center gap-1.5 bg-[#080D17] p-1.5 rounded-xl border border-slate-800">
          {(['today', 'yesterday', 'week', 'month'] as TimeRange[]).map((tr) => (
            <button
              key={tr}
              onClick={() => setTimeRange(tr)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold capitalize transition-all ${
                timeRange === tr
                  ? 'bg-orange-500 text-white shadow-md shadow-orange-500/25'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              {tr === 'week' ? 'Last 7 Days' : tr === 'month' ? 'This Month' : tr}
            </button>
          ))}
        </div>
      </div>

      {/* ── Operational Anomaly Detection Banners ─────────────────────────── */}
      {anomalies.length > 0 && (
        <div className="space-y-2">
          {anomalies.map((alert) => (
            <div
              key={alert.id}
              className={`p-4 rounded-xl border flex items-start gap-3 text-xs ${
                alert.type === 'critical'
                  ? 'bg-red-500/10 border-red-500/30 text-red-300'
                  : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
              }`}
            >
              <AlertTriangle className={`w-4 h-4 shrink-0 mt-0.5 ${alert.type === 'critical' ? 'text-red-400' : 'text-amber-400'}`} />
              <div>
                <strong className="block font-bold text-white mb-0.5">{alert.title}</strong>
                <span>{alert.message}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── 4 Executive Financial & Volume KPI Cards ──────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Gross Revenue */}
        <div className="bg-[#0E1524] border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider">
            <span>Gross Revenue</span>
            <DollarSign className="w-4 h-4 text-orange-400" />
          </div>
          <div className="my-3">
            <div className="text-2xl sm:text-3xl font-black text-white font-mono">
              ₹{metrics.current.grossRevenue.toLocaleString('en-IN')}
            </div>
            <div className="flex items-center gap-1.5 mt-1.5 text-xs font-bold">
              {metrics.revenueDelta.pct !== null ? (
                <>
                  {metrics.revenueDelta.isPositive ? (
                    <span className="text-emerald-400 flex items-center gap-0.5">
                      <TrendingUp className="w-3.5 h-3.5" /> +{metrics.revenueDelta.pct}%
                    </span>
                  ) : (
                    <span className="text-red-400 flex items-center gap-0.5">
                      <TrendingDown className="w-3.5 h-3.5" /> {metrics.revenueDelta.pct}%
                    </span>
                  )}
                  <span className="text-slate-500 font-normal">vs {prevPeriodLabel}</span>
                </>
              ) : (
                <span className="text-slate-400 font-normal">Baseline period</span>
              )}
            </div>
          </div>
          <div className="text-[11px] text-slate-500 border-t border-slate-800/80 pt-2 flex justify-between">
            <span>Net: ₹{metrics.current.netRevenue.toLocaleString('en-IN')}</span>
            <span>Excl. cancelled</span>
          </div>
        </div>

        {/* Total Orders */}
        <div className="bg-[#0E1524] border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider">
            <span>Total Orders</span>
            <ShoppingBag className="w-4 h-4 text-blue-400" />
          </div>
          <div className="my-3">
            <div className="text-2xl sm:text-3xl font-black text-white font-mono">
              {metrics.current.totalOrders}
            </div>
            <div className="flex items-center gap-1.5 mt-1.5 text-xs font-bold">
              {metrics.ordersDelta.pct !== null ? (
                <>
                  {metrics.ordersDelta.isPositive ? (
                    <span className="text-emerald-400 flex items-center gap-0.5">
                      <TrendingUp className="w-3.5 h-3.5" /> +{metrics.ordersDelta.pct}%
                    </span>
                  ) : (
                    <span className="text-red-400 flex items-center gap-0.5">
                      <TrendingDown className="w-3.5 h-3.5" /> {metrics.ordersDelta.pct}%
                    </span>
                  )}
                  <span className="text-slate-500 font-normal">vs {prevPeriodLabel}</span>
                </>
              ) : (
                <span className="text-slate-400 font-normal">Baseline period</span>
              )}
            </div>
          </div>
          <div className="text-[11px] text-slate-500 border-t border-slate-800/80 pt-2 flex justify-between">
            <span className="text-emerald-400 font-bold">{metrics.current.completedCount} completed</span>
            <span className="text-amber-400 font-bold">{metrics.current.activeCount} active</span>
          </div>
        </div>

        {/* Average Order Value (AOV) */}
        <div className="bg-[#0E1524] border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider">
            <span>Average Order Value</span>
            <CreditCard className="w-4 h-4 text-purple-400" />
          </div>
          <div className="my-3">
            <div className="text-2xl sm:text-3xl font-black text-white font-mono">
              ₹{metrics.current.aov}
            </div>
            <div className="flex items-center gap-1.5 mt-1.5 text-xs font-bold">
              {metrics.aovDelta.pct !== null ? (
                <>
                  {metrics.aovDelta.isPositive ? (
                    <span className="text-emerald-400 flex items-center gap-0.5">
                      <TrendingUp className="w-3.5 h-3.5" /> +{metrics.aovDelta.pct}%
                    </span>
                  ) : (
                    <span className="text-red-400 flex items-center gap-0.5">
                      <TrendingDown className="w-3.5 h-3.5" /> {metrics.aovDelta.pct}%
                    </span>
                  )}
                  <span className="text-slate-500 font-normal">vs {prevPeriodLabel}</span>
                </>
              ) : (
                <span className="text-slate-400 font-normal">Baseline period</span>
              )}
            </div>
          </div>
          <div className="text-[11px] text-slate-500 border-t border-slate-800/80 pt-2">
            Per fulfilled basket average
          </div>
        </div>

        {/* Cancellation Rate */}
        <div className="bg-[#0E1524] border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider">
            <span>Cancellation Rate</span>
            <XCircle className="w-4 h-4 text-rose-400" />
          </div>
          <div className="my-3">
            <div className="text-2xl sm:text-3xl font-black text-white font-mono">
              {metrics.current.cancellationRate}%
            </div>
            <div className="text-[11px] text-slate-400 mt-1.5">
              {metrics.current.cancelledCount} of {metrics.current.totalOrders} total orders
            </div>
          </div>
          <div className="text-[11px] text-slate-500 border-t border-slate-800/80 pt-2 flex justify-between">
            <span>Target: &lt; 5.0%</span>
            <span className={metrics.current.cancellationRate <= 5 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
              {metrics.current.cancellationRate <= 5 ? 'Healthy' : 'Investigate'}
            </span>
          </div>
        </div>
      </div>

      {/* ── Operational Cycle Times (Kitchen & Delivery Fleet) ───────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Kitchen Prep Cycle */}
        <div className="bg-[#0E1524] border border-slate-800 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400" /> Kitchen Preparation Cycle
            </h3>
            <span className="text-[11px] text-slate-400 font-mono">Accepted → Ready</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[#080D17] p-3.5 rounded-xl border border-slate-800/80">
              <span className="text-[11px] text-slate-400 block mb-1">Average Prep Time</span>
              <strong className="text-xl font-mono text-white">
                {metrics.current.avgPrepTimeMin > 0 ? `${metrics.current.avgPrepTimeMin} mins` : 'No Data'}
              </strong>
            </div>
            <div className="bg-[#080D17] p-3.5 rounded-xl border border-slate-800/80">
              <span className="text-[11px] text-slate-400 block mb-1">Target Speed (&lt;20m)</span>
              <strong className={`text-xl font-mono ${metrics.current.avgPrepTimeMin <= 20 ? 'text-emerald-400' : 'text-amber-400'}`}>
                {metrics.current.avgPrepTimeMin > 0 ? (metrics.current.avgPrepTimeMin <= 20 ? 'Optimal' : 'Delayed') : 'N/A'}
              </strong>
            </div>
          </div>
        </div>

        {/* Fleet Delivery Cycle */}
        <div className="bg-[#0E1524] border border-slate-800 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Bike className="w-4 h-4 text-emerald-400" /> Rider Delivery Trip Cycle
            </h3>
            <span className="text-[11px] text-slate-400 font-mono">Dispatched → Delivered</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[#080D17] p-3.5 rounded-xl border border-slate-800/80">
              <span className="text-[11px] text-slate-400 block mb-1">Avg Delivery Trip</span>
              <strong className="text-xl font-mono text-white">
                {metrics.current.avgDeliveryTimeMin > 0 ? `${metrics.current.avgDeliveryTimeMin} mins` : 'No Data'}
              </strong>
            </div>
            <div className="bg-[#080D17] p-3.5 rounded-xl border border-slate-800/80">
              <span className="text-[11px] text-slate-400 block mb-1">On-Time Rate (&lt;30m)</span>
              <strong className={`text-xl font-mono ${metrics.current.onTimeRate >= 85 ? 'text-emerald-400' : 'text-amber-400'}`}>
                {metrics.current.onTimeRate > 0 ? `${metrics.current.onTimeRate}%` : 'No Data'}
              </strong>
            </div>
          </div>
        </div>
      </div>

      {/* ── Rankings & Breakdowns Grid ────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left (7 cols): Top Selling Products */}
        <div className="lg:col-span-7 bg-[#0E1524] border border-slate-800 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Flame className="w-4 h-4 text-orange-400" /> Top Selling Menu Items & Combos
            </h3>
            <span className="text-xs text-slate-400">{periodLabel}</span>
          </div>

          {metrics.current.productSales.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs">
              <Pizza className="w-8 h-8 mx-auto mb-2 opacity-30" />
              No item sales recorded for {periodLabel}.
            </div>
          ) : (
            <div className="space-y-2.5">
              {metrics.current.productSales.slice(0, 6).map((item, idx) => {
                const maxRev = metrics.current.productSales[0]?.revenue || 1;
                const pct = Math.round((item.revenue / maxRev) * 100);

                return (
                  <div key={item.name} className="p-3 rounded-xl bg-[#080D17] border border-slate-800/80 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-orange-500/10 text-orange-400 font-mono font-black flex items-center justify-center text-[10px]">
                          #{idx + 1}
                        </span>
                        <strong className="text-white">{item.name}</strong>
                        <span className="text-[10px] text-slate-400 px-2 py-0.5 rounded-md bg-slate-800/60">
                          {item.category}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="font-mono text-white font-bold">₹{item.revenue.toLocaleString('en-IN')}</span>
                        <span className="text-[10px] text-slate-400 block">{item.units} sold</span>
                      </div>
                    </div>
                    {/* Relative Bar */}
                    <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-orange-500 h-full rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right (5 cols): Fulfillment & Channel Distribution */}
        <div className="lg:col-span-5 bg-[#0E1524] border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-400" /> Channel & Fulfillment Mix
              </h3>
              <span className="text-xs text-slate-400">{periodLabel}</span>
            </div>

            <div className="space-y-4">
              {/* Delivery vs Takeaway vs Dine-in */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-400 block uppercase tracking-wider">Fulfillment Method</span>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="bg-[#080D17] p-2.5 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Delivery</span>
                    <strong className="text-white font-mono">{metrics.current.deliveryCount}</strong>
                  </div>
                  <div className="bg-[#080D17] p-2.5 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Takeaway</span>
                    <strong className="text-white font-mono">{metrics.current.takeawayCount}</strong>
                  </div>
                  <div className="bg-[#080D17] p-2.5 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Dine-in</span>
                    <strong className="text-white font-mono">{metrics.current.dineInCount}</strong>
                  </div>
                </div>
              </div>

              {/* Online Web/App vs POS In-Store */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-400 block uppercase tracking-wider">Sales Channel</span>
                <div className="grid grid-cols-2 gap-2 text-center text-xs">
                  <div className="bg-[#080D17] p-2.5 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Online App/Web</span>
                    <strong className="text-white font-mono">{metrics.current.onlineCount}</strong>
                  </div>
                  <div className="bg-[#080D17] p-2.5 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">In-Store POS</span>
                    <strong className="text-white font-mono">{metrics.current.posCount}</strong>
                  </div>
                </div>
              </div>

              {/* Payment Method Distribution */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-400 block uppercase tracking-wider">Payment Breakdown</span>
                <div className="flex flex-wrap gap-2 text-xs">
                  {Object.entries(metrics.current.paymentBreakdown).map(([payMethod, count]) => (
                    <div key={payMethod} className="px-2.5 py-1.5 rounded-lg bg-[#080D17] border border-slate-800 flex items-center gap-2">
                      <span className="text-slate-400 font-bold">{payMethod}:</span>
                      <strong className="text-white font-mono">{count}</strong>
                    </div>
                  ))}
                  {Object.keys(metrics.current.paymentBreakdown).length === 0 && (
                    <span className="text-slate-500 text-xs">No transactions recorded</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="text-[11px] text-slate-500 pt-4 border-t border-slate-800/80 mt-4 flex items-center justify-between">
            <span>Branch: Rajnandgaon (HQ)</span>
            <span>Refreshed: {lastRefreshed.toLocaleTimeString()}</span>
          </div>
        </div>
      </div>

      {/* ── Fleet Performance Leaderboard ─────────────────────────────────── */}
      <div className="bg-[#0E1524] border border-slate-800 rounded-2xl p-5 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Award className="w-4 h-4 text-emerald-400" /> Store Fleet Delivery Performance Leaderboard
          </h3>
          <span className="text-xs text-slate-400">{periodLabel}</span>
        </div>

        {metrics.current.riderLeaderboard.length === 0 ? (
          <div className="py-8 text-center text-slate-500 text-xs">
            <Bike className="w-8 h-8 mx-auto mb-2 opacity-30" />
            No rider trips completed during {periodLabel}. Completed deliveries will generate performance rankings here.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-2.5 px-3">Rider Name</th>
                  <th className="py-2.5 px-3">Deliveries Completed</th>
                  <th className="py-2.5 px-3">Avg Trip Duration</th>
                  <th className="py-2.5 px-3">On-Time Rate (&lt;30m)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {metrics.current.riderLeaderboard.map((r, idx) => {
                  const avgTime = r.completed > 0 ? Math.round(r.totalMinutes / r.completed) : 0;
                  const onTimePct = r.completed > 0 ? Math.round((r.onTime / r.completed) * 100) : 0;

                  return (
                    <tr key={r.name + idx} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-3 font-bold text-white flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-400 font-mono text-[10px] flex items-center justify-center font-black">
                          #{idx + 1}
                        </span>
                        {r.name}
                      </td>
                      <td className="py-3 px-3 font-mono text-white font-bold">{r.completed}</td>
                      <td className="py-3 px-3 font-mono text-slate-300">{avgTime} mins</td>
                      <td className="py-3 px-3">
                        <span className={`font-mono font-bold ${onTimePct >= 90 ? 'text-emerald-400' : 'text-amber-400'}`}>
                          {onTimePct}%
                        </span>
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
