import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  QuerySnapshot,
  DocumentData,
  getDocs,
  getAggregateFromServer,
  sum,
  count,
} from 'firebase/firestore';
import { motion } from 'framer-motion';
import { Download, Smartphone } from 'lucide-react';
import { DashboardCardSkeleton } from '../components/ui/SkeletonLoader';

import StatCard from '../components/owner/StatCard';

import { useHeartbeat } from '../hooks/useHeartbeat';
import { useLiveMetrics } from '../hooks/useLiveMetrics';
import { SystemHealthPanel } from '../components/owner/SystemHealthPanel';
import SystemDiagnostics from '../components/owner/SystemDiagnostics';
import LiveOrdersTable from '../components/owner/LiveOrdersTable';
import ActivityFeed from '../components/owner/ActivityFeed';
import SystemStatusPanel from '../components/owner/SystemStatusPanel';
import ApkBuildStatus from '../components/owner/ApkBuildStatus';
import QuickActions from '../components/owner/QuickActions';
import { GlassCard } from '../components/ui/glass/GlassSystem';
import { lazy, Suspense } from 'react';

const DashboardCharts = lazy(() => import('../components/owner/DashboardCharts'));
const OwnerLiveMap = lazy(() => import('../components/owner/OwnerLiveMap'));
const BusinessIntelligence = lazy(() => import('../components/owner/BusinessIntelligence'));


export default function OwnerDashboard() {
  useHeartbeat();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<any>({
    todayRevenue: 0,
    todayOrders: 0,
    monthRevenue: 0,
    monthOrders: 0,
    prevMonthRevenue: 0,
    prevMonthOrders: 0,
    revDiff: 0,
    ordDiff: 0,
    pending: 0,
    preparing: 0,
    outForDelivery: 0,
    completed: 0,
    cancelled: 0,
    activeCustomers: 0,
    totalProducts: 0,
    activeCoupons: 0,
    activeAds: 0,
    customerGrowth: 0,
  });

  const liveMetrics = useLiveMetrics();

  const [chartOrders, setChartOrders] = useState<any[]>([]);
  const [deliveryPartners, setDeliveryPartners] = useState<any[]>([]);
  const [isNative, setIsNative] = useState(false);

  useEffect(() => {
    import('@capacitor/core').then(({ Capacitor }) => {
      setIsNative(Capacitor.isNativePlatform());
    }).catch(() => {});
    
    // 1. Real-time Orders Listener (Charts & Month Aggregates)
    const ordersRef = collection(db, "orders");
    const qOrders = query(ordersRef, orderBy("createdAt", "desc"), limit(300));
    
    const unsubOrders = onSnapshot(qOrders, (snapshot: QuerySnapshot<DocumentData>) => {
      const docs = snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() }));
      setChartOrders(docs);

      const now = new Date();
      const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0).getTime();
      const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0).getTime();
      const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999).getTime();

      const parseTime = (val: any) => {
        if (!val) return 0;
        if (typeof val?.toMillis === 'function') return val.toMillis();
        if (typeof val?.toDate === 'function') return val.toDate().getTime();
        if (typeof val?.seconds === 'number') return val.seconds * 1000;
        const p = new Date(val).getTime();
        return isNaN(p) ? 0 : p;
      };

      let cRev = 0, cOrd = 0;
      let pRev = 0, pOrd = 0;

      docs.forEach((data: any) => {
        const t = parseTime(data.createdAt);
        const amt = Number(data.totalAmount || data.total_amount || 0);
        const status = (data.status || '').toLowerCase();
        const isFailed = ['cancelled', 'payment_failed', 'failed', 'rejected'].includes(status);

        if (!isFailed) {
          if (t >= firstOfMonth) {
            cRev += amt;
            cOrd++;
          } else if (t >= prevMonthStart && t <= prevMonthEnd) {
            pRev += amt;
            pOrd++;
          }
        }
      });

      const revDiff = pRev > 0 ? ((cRev - pRev) / pRev) * 100 : cRev > 0 ? 100 : 0;
      const ordDiff = pOrd > 0 ? ((cOrd - pOrd) / pOrd) * 100 : cOrd > 0 ? 100 : 0;

      setMetrics((prev: any) => ({
        ...prev,
        monthRevenue: cRev,
        monthOrders: cOrd,
        prevMonthRevenue: pRev,
        revDiff,
        ordDiff,
      }));
      setLoading(false);
    }, (err: any) => {
      console.warn('[OwnerDashboard] Realtime orders sync notice:', err.message);
      setLoading(false);
    });

    // 2. Real-time Delivery Partners Listener
    const qPartners = query(
      collection(db, "users"),
      where("role", "in", ["delivery_partner", "delivery"])
    );
    const unsubPartners = onSnapshot(qPartners, (snap: QuerySnapshot<DocumentData>) => {
      setDeliveryPartners(snap.docs.map((d: any) => ({ id: d.id, ...d.data() })));
    }, (err: any) => console.warn('[OwnerDashboard] Partners sync notice:', err.message));

    // 3. Real-time Products, Coupons, and Ads counts
    const unsubProducts = onSnapshot(collection(db, "products"), (snap: QuerySnapshot<DocumentData>) => {
      setMetrics((prev: any) => ({ ...prev, totalProducts: snap.size }));
    }, () => {});

    const unsubCoupons = onSnapshot(query(collection(db, "coupons"), where("isActive", "==", true)), (snap: QuerySnapshot<DocumentData>) => {
      setMetrics((prev: any) => ({ ...prev, activeCoupons: snap.size }));
    }, () => {});

    const unsubAds = onSnapshot(query(collection(db, "ads"), where("isActive", "==", true)), (snap: QuerySnapshot<DocumentData>) => {
      setMetrics((prev: any) => ({ ...prev, activeAds: snap.size }));
    }, () => {});

    const unsubCustomers = onSnapshot(query(collection(db, "users"), where("role", "==", "customer")), (snap: QuerySnapshot<DocumentData>) => {
      setMetrics((prev: any) => ({ ...prev, activeCustomers: snap.size }));
    }, () => {});

    return () => {
      unsubOrders();
      unsubPartners();
      unsubProducts();
      unsubCoupons();
      unsubAds();
      unsubCustomers();
    };
  }, []);

  if (loading) {
    return (
      <div className="space-y-6 md:space-y-8 pb-12 w-full overflow-hidden px-4 md:px-0">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          {[1, 2, 3, 4].map((i) => (
            <DashboardCardSkeleton key={i} />
          ))}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4 mt-8">
          {[1, 2, 3, 4, 5].map((i) => (
            <DashboardCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="relative z-10 space-y-6 md:space-y-8 pb-12 pt-4 w-full px-2 sm:px-4 md:px-0">
        
        {/* Stitch Obsidian Crust Flagship Header HUD */}
        <div className="bg-dark-900/90 border border-white/12 rounded-3xl p-5 md:p-6 shadow-2xl backdrop-blur-2xl relative overflow-hidden">
          {/* Top subtle ambient glow */}
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-primary-500/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 relative z-10">
            <div>
              <div className="flex items-center gap-3 mb-2 flex-wrap">
                <h1 className="text-2xl md:text-4xl font-black text-white tracking-tight flex items-center gap-2">
                  <span>Kitchen Command</span>
                  <span className="text-primary-500 font-mono text-lg font-bold">HUD</span>
                </h1>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  REALTIME FIRESTORE SYNC ACTIVE
                </span>
              </div>
              <p className="text-xs md:text-sm text-slate-400 font-medium">
                Live store metrics, realtime dispatch telemetry & revenue performance
              </p>
            </div>

            {/* Quick Action Launchpad */}
            <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto">
              {isNative && (
                <>
                  <button
                    onClick={async () => {
                      const { Capacitor } = await import('@capacitor/core');
                      if (!Capacitor.isNativePlatform()) {
                        alert('Alarm permissions are native Android 14+ only.');
                        return;
                      }
                      const { AlarmPermission } = await import('../plugins/AlarmPermission');
                      await AlarmPermission.setupPermissions({ role: 'owner', force: true }).catch(err => alert(`Error: ${err.message}`));
                      alert('Permission prompt triggered natively');
                    }}
                    className="bg-primary-500/20 text-primary-300 border border-primary-500/40 hover:bg-primary-500/30 px-3.5 py-2 rounded-2xl font-bold text-xs transition-all backdrop-blur-md flex items-center gap-1.5 min-touch-target"
                  >
                    🔔 Alarm System
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        const tokenModule = await import('../lib/firebase');
                        const token = await tokenModule.getCurrentAuthToken();
                        const res = await fetch('/api/notifications/send-custom', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                          body: JSON.stringify({
                            title: '🔔 Alarm Test',
                            body: 'Testing continuous alarm. Tap Stop Alert to dismiss.',
                            audience: 'owner',
                            category: 'alarm_actionable',
                            priority: 'critical'
                          }),
                        });
                        if (!res.ok) throw new Error(`HTTP ${res.status}`);
                        alert('Alarm test sent!');
                      } catch (err: any) {
                        alert(`Alarm test failed: ${err.message}`);
                      }
                    }}
                    className="bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30 px-3.5 py-2 rounded-2xl font-bold text-xs transition-all backdrop-blur-md flex items-center gap-1.5 min-touch-target"
                  >
                    🚨 Test Alarm
                  </button>
                </>
              )}
              <a
                href="/owner/products"
                className="bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25 px-3.5 py-2 rounded-2xl font-bold text-xs transition-all backdrop-blur-md flex items-center gap-1.5 min-touch-target"
              >
                🍕 Add Product
              </a>
              <a
                href="/owner/ads"
                className="bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-500/25 px-3.5 py-2 rounded-2xl font-bold text-xs transition-all backdrop-blur-md flex items-center gap-1.5 min-touch-target"
              >
                ✨ Marketing
              </a>
              <a
                href="/owner/reports"
                className="bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25 px-3.5 py-2 rounded-2xl font-bold text-xs transition-all backdrop-blur-md flex items-center gap-1.5 min-touch-target"
              >
                📑 View Reports
              </a>
              <a
                href="/owner/data-manager"
                className="bg-purple-500/15 text-purple-300 border border-purple-500/30 hover:bg-purple-500/25 px-3.5 py-2 rounded-2xl font-bold text-xs transition-all backdrop-blur-md flex items-center gap-1.5 min-touch-target"
              >
                💽 Data Manager
              </a>
            </div>
          </div>

          {/* Live Order Status Telemetry Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-white/10">
            <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-2xl flex items-center justify-between">
              <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">Pending Orders</span>
              <span className="font-mono text-lg font-black text-white">{liveMetrics.pending}</span>
            </div>
            <div className="bg-blue-500/10 border border-blue-500/20 p-3 rounded-2xl flex items-center justify-between">
              <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">Preparing</span>
              <span className="font-mono text-lg font-black text-white">{liveMetrics.preparing}</span>
            </div>
            <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-2xl flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Out for Delivery</span>
              <span className="font-mono text-lg font-black text-white">{liveMetrics.outForDelivery}</span>
            </div>
            <div className="bg-purple-500/10 border border-purple-500/20 p-3 rounded-2xl flex items-center justify-between">
              <span className="text-xs font-bold text-purple-400 uppercase tracking-wider">Completed Today</span>
              <span className="font-mono text-lg font-black text-white">{liveMetrics.completed}</span>
            </div>
          </div>
        </div>

        <ApkBuildStatus />

        {/* 1. Top Section - 6 KPI Telemetry Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 md:gap-5">
          <StatCard
            title="Live Revenue (Today)"
            value={`₹${liveMetrics.todayRevenue.toFixed(2)}`}
            icon="💰"
            isPositive={metrics.revDiff >= 0}
            trend={`${metrics.revDiff > 0 ? "+" : ""}${metrics.revDiff.toFixed(1)}% vs month`}
            delay={0.1}
            colorTheme="orange"
          />
          <StatCard
            title="Live Orders (Today)"
            value={liveMetrics.todayOrders}
            icon="🛍️"
            isPositive={metrics.ordDiff >= 0}
            trend={`${metrics.ordDiff > 0 ? "+" : ""}${metrics.ordDiff.toFixed(1)}% vs month`}
            delay={0.15}
            colorTheme="blue"
          />
          <StatCard
            title="Online Partners"
            value={liveMetrics.partnersOnline + liveMetrics.ownersOnline}
            icon="👥"
            isPositive={true}
            trend="Live Now"
            delay={0.2}
            colorTheme="purple"
          />
          <StatCard
            title="Active Deliveries"
            value={liveMetrics.outForDelivery}
            icon="🛵"
            delay={0.25}
            colorTheme="green"
          />
          <StatCard
            title="Total Products"
            value={metrics.totalProducts}
            icon="🍕"
            delay={0.3}
            colorTheme="gold"
          />
          <StatCard
            title="Growth Rate"
            value={`${metrics.revDiff > 0 ? "+" : ""}${metrics.revDiff.toFixed(1)}%`}
            icon="📈"
            isPositive={metrics.revDiff >= 0}
            delay={0.35}
            colorTheme="red"
          />
        </div>

        {/* System Health & Status Panels */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 w-full">
          <div className="xl:col-span-2">
            <SystemHealthPanel />
          </div>
          <div className="xl:col-span-1">
            <SystemStatusPanel />
          </div>
        </div>
        
        <div className="mt-6">
          <SystemDiagnostics />
        </div>

        {/* 5. Realtime Charts */}
        <div className="w-full overflow-hidden">
          <Suspense fallback={<DashboardCardSkeleton />}>
            <DashboardCharts ordersData={chartOrders} productsData={[]} />
          </Suspense>
        </div>

        {/* Business Intelligence & Delivery Performance */}
        <Suspense fallback={<DashboardCardSkeleton />}>
          <BusinessIntelligence ordersData={chartOrders} deliveryPartners={deliveryPartners} />
        </Suspense>

        {/* Live Map Header & Container */}
        <div className="bg-dark-900/90 border border-white/12 rounded-3xl p-4 md:p-6 shadow-2xl backdrop-blur-xl">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-emerald-400 animate-ping" />
              <h2 className="text-lg md:text-xl font-black text-white tracking-tight">Live Delivery Partner Fleet Map</h2>
            </div>
            <span className="text-xs font-mono text-slate-400 bg-dark-950 px-3 py-1 rounded-full border border-white/10">Realtime GPS</span>
          </div>
          <div className="w-full h-[350px] md:h-[480px] rounded-2xl overflow-hidden border border-white/10">
            <Suspense fallback={<div className="w-full h-full bg-dark-800 animate-pulse" />}>
              <OwnerLiveMap />
            </Suspense>
          </div>
        </div>

        {/* 6. Live Orders Stream & Activity Feed */}
        <div className="flex flex-col xl:flex-row gap-6">
          <div className="w-full xl:w-2/3 bg-dark-900/90 border border-white/12 rounded-3xl p-5 md:p-6 shadow-2xl backdrop-blur-xl overflow-x-auto">
            <div className="min-w-[600px]">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-black text-white">Live Orders Feed</h2>
                <span className="text-xs font-mono font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-full">Realtime Stream</span>
              </div>
              <LiveOrdersTable />
            </div>
          </div>
          <div className="w-full xl:w-1/3 bg-dark-900/90 border border-white/12 rounded-3xl p-5 md:p-6 shadow-2xl backdrop-blur-xl">
            <h2 className="text-xl font-black text-white mb-4">
              Activity & Notifications
            </h2>
            <ActivityFeed />
          </div>
        </div>
      </div>
    </>
  );
}
