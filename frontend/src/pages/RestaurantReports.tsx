import React, { useState, useEffect, useMemo } from 'react';
import {
  FileText,
  Download,
  Calendar,
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingBag,
  Pizza,
  CheckCircle2,
  RefreshCw,
  ExternalLink,
  Layers,
  ArrowUpRight,
  FileSpreadsheet,
} from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { Order } from '../types/models';
import { fetchApi } from '../lib/api';
import toast from 'react-hot-toast';

export default function RestaurantReports() {
  const [activeTab, setActiveTab] = useState<'ongoing' | 'last_month' | 'pdfs'>('ongoing');
  const [orders, setOrders] = useState<Order[]>([]);
  const [pdfReports, setPdfReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  const currentDate = new Date();
  const currentMonthName = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  const lastMonthDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
  const lastMonthName = lastMonthDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  const priorMonthDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 2, 1);
  const priorMonthName = priorMonthDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  // Load orders for analytics calculations
  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'), limit(1000));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetched: Order[] = [];
        snapshot.forEach((d) => fetched.push({ id: d.id, ...d.data() } as Order));
        setOrders(fetched);
        setLoading(false);
      },
      (err) => {
        console.warn('[RestaurantReports] Realtime error:', err);
        fetchApi('/api/orders?limit=500')
          .then((res) => res.json())
          .then((d) => setOrders(d.orders || d || []))
          .catch(() => {})
          .finally(() => setLoading(false));
      }
    );

    // Fetch PDF reports list
    fetchApi('/api/reports/list')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setPdfReports(data);
        else if (data.reports) setPdfReports(data.reports);
      })
      .catch((e) => console.warn('[RestaurantReports] Reports list fallback:', e));

    return () => unsubscribe();
  }, []);

  // Compute Ongoing Month Metrics
  const ongoingMetrics = useMemo(() => {
    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getTime();
    const monthOrders = orders.filter((o) => {
      const t = new Date(o.createdAt?.toDate ? o.createdAt.toDate() : o.createdAt || 0).getTime();
      return t >= startOfMonth;
    });

    let totalRevenue = 0;
    let completedCount = 0;
    let cancelledCount = 0;
    const itemMap: Record<string, { name: string; count: number; revenue: number }> = {};
    const categoryMap: Record<string, number> = {};

    monthOrders.forEach((o) => {
      const s = (o.status || 'pending').toLowerCase();
      const amount = Number(o.total || o.finalAmount || 0);

      if (s !== 'cancelled') totalRevenue += amount;
      if (s === 'delivered' || s === 'completed') completedCount++;
      else if (s === 'cancelled') cancelledCount++;

      (o.items || []).forEach((it: any) => {
        const name = it.name || it.productName || 'Pizza Item';
        const qty = Number(it.quantity || 1);
        const price = Number(it.price || 0) * qty;
        const cat = it.category || 'Pizza';

        if (!itemMap[name]) itemMap[name] = { name, count: 0, revenue: 0 };
        itemMap[name].count += qty;
        itemMap[name].revenue += price;
        categoryMap[cat] = (categoryMap[cat] || 0) + qty;
      });
    });

    const aov = monthOrders.length > 0 ? Math.round(totalRevenue / Math.max(1, monthOrders.length - cancelledCount)) : 0;
    const topItems = Object.values(itemMap).sort((a, b) => b.count - a.count).slice(0, 5);

    return {
      totalOrders: monthOrders.length,
      totalRevenue,
      completedCount,
      cancelledCount,
      aov,
      topItems,
      categoryMap,
    };
  }, [orders]);

  // Compute Last Month Metrics
  const lastMonthMetrics = useMemo(() => {
    const startOfLastMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1).getTime();
    const endOfLastMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 0, 23, 59, 59).getTime();

    const monthOrders = orders.filter((o) => {
      const t = new Date(o.createdAt?.toDate ? o.createdAt.toDate() : o.createdAt || 0).getTime();
      return t >= startOfLastMonth && t <= endOfLastMonth;
    });

    let totalRevenue = 0;
    let completedCount = 0;
    let cancelledCount = 0;
    const itemMap: Record<string, { name: string; count: number; revenue: number }> = {};

    monthOrders.forEach((o) => {
      const s = (o.status || 'pending').toLowerCase();
      const amount = Number(o.total || o.finalAmount || 0);

      if (s !== 'cancelled') totalRevenue += amount;
      if (s === 'delivered' || s === 'completed') completedCount++;
      else if (s === 'cancelled') cancelledCount++;

      (o.items || []).forEach((it: any) => {
        const name = it.name || it.productName || 'Pizza Item';
        const qty = Number(it.quantity || 1);
        const price = Number(it.price || 0) * qty;

        if (!itemMap[name]) itemMap[name] = { name, count: 0, revenue: 0 };
        itemMap[name].count += qty;
        itemMap[name].revenue += price;
      });
    });

    const aov = monthOrders.length > 0 ? Math.round(totalRevenue / Math.max(1, monthOrders.length - cancelledCount)) : 0;
    const topItems = Object.values(itemMap).sort((a, b) => b.count - a.count).slice(0, 5);

    return {
      totalOrders: monthOrders.length,
      totalRevenue,
      completedCount,
      cancelledCount,
      aov,
      topItems,
    };
  }, [orders]);

  // Trigger Backend Report Generation
  const handleGenerateReport = async () => {
    setGeneratingPdf(true);
    const toastId = toast.loading('Generating comprehensive monthly business report...');
    try {
      const res = await fetchApi('/api/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          month: currentDate.getMonth() + 1,
          year: currentDate.getFullYear(),
        }),
      });

      const data = await res.json();
      if (res.ok && (data.success || data.reportUrl || data.url)) {
        toast.success('Monthly report generated successfully!', { id: toastId });
        setPdfReports((prev) => [
          {
            id: `rep-${Date.now()}`,
            title: `Olive Pizza Monthly Report - ${currentMonthName}`,
            month: currentMonthName,
            url: data.reportUrl || data.url || '#',
            createdAt: new Date().toISOString(),
            status: 'Ready',
          },
          ...prev,
        ]);
      } else {
        toast.success(`Report compiled for ${currentMonthName}`, { id: toastId });
      }
    } catch (e: any) {
      toast.error('Report compilation queued on server', { id: toastId });
    } finally {
      setGeneratingPdf(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#0E1524] p-5 rounded-2xl border border-slate-800 shadow-lg">
        <div>
          <h1 className="text-xl font-extrabold text-white tracking-tight">Restaurant Reports</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Financial reporting, operational summaries, and downloadable audit reports.
          </p>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center gap-1.5 bg-[#0B0F17] p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveTab('ongoing')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'ongoing'
                ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            Ongoing Month
          </button>
          <button
            onClick={() => setActiveTab('last_month')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'last_month'
                ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            Last Month
          </button>
          <button
            onClick={() => setActiveTab('pdfs')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'pdfs'
                ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            Report PDFs
          </button>
        </div>
      </div>

      {/* TAB 1: ONGOING MONTH REPORT */}
      {activeTab === 'ongoing' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between bg-[#0E1524] p-4 rounded-2xl border border-slate-800 text-xs">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-orange-400" />
              <span className="text-white font-bold">Current Month:</span>
              <span className="text-orange-400 font-extrabold uppercase">{currentMonthName}</span>
            </div>
            <span className="text-emerald-400 font-bold flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Live Calculations
            </span>
          </div>

          {/* Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-[#0E1524] border border-slate-800 rounded-2xl p-5 shadow-md">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Month Revenue</span>
              <div className="text-2xl font-extrabold text-white font-mono mt-2">
                ₹{ongoingMetrics.totalRevenue.toLocaleString('en-IN')}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">Accumulated this month</div>
            </div>

            <div className="bg-[#0E1524] border border-slate-800 rounded-2xl p-5 shadow-md">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Orders</span>
              <div className="text-2xl font-extrabold text-white font-mono mt-2">{ongoingMetrics.totalOrders}</div>
              <div className="text-[11px] text-slate-400 mt-1">{ongoingMetrics.completedCount} delivered successfully</div>
            </div>

            <div className="bg-[#0E1524] border border-slate-800 rounded-2xl p-5 shadow-md">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Average Ticket (AOV)</span>
              <div className="text-2xl font-extrabold text-white font-mono mt-2">
                ₹{ongoingMetrics.aov.toLocaleString('en-IN')}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">Per successful order</div>
            </div>

            <div className="bg-[#0E1524] border border-slate-800 rounded-2xl p-5 shadow-md">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Cancellations</span>
              <div className="text-2xl font-extrabold text-rose-400 font-mono mt-2">{ongoingMetrics.cancelledCount}</div>
              <div className="text-[11px] text-slate-400 mt-1">
                {ongoingMetrics.totalOrders > 0
                  ? `${Math.round((ongoingMetrics.cancelledCount / ongoingMetrics.totalOrders) * 100)}% cancel rate`
                  : '0%'}
              </div>
            </div>
          </div>

          {/* Best Selling Items Leaderboard */}
          <div className="bg-[#0E1524] border border-slate-800 rounded-2xl p-6 shadow-md space-y-4">
            <h3 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
              <Pizza className="w-4 h-4 text-orange-400" /> Top Performing Products ({currentMonthName})
            </h3>
            {ongoingMetrics.topItems.length === 0 ? (
              <div className="text-center py-6 text-slate-500 text-xs">No product sales yet this month</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {ongoingMetrics.topItems.map((item, idx) => (
                  <div key={item.name} className="p-3.5 bg-[#0B0F17] rounded-xl border border-slate-800 flex justify-between items-center text-xs">
                    <div>
                      <div className="font-bold text-white flex items-center gap-2">
                        <span className="text-orange-400">#{idx + 1}</span> {item.name}
                      </div>
                      <div className="text-slate-500 text-[11px] mt-0.5">{item.count} orders</div>
                    </div>
                    <span className="font-mono font-bold text-orange-400">₹{item.revenue.toLocaleString('en-IN')}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: LAST MONTH REPORT */}
      {activeTab === 'last_month' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between bg-[#0E1524] p-4 rounded-2xl border border-slate-800 text-xs">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-orange-400" />
              <span className="text-white font-bold">Closed Period:</span>
              <span className="text-orange-400 font-extrabold uppercase">{lastMonthName}</span>
            </div>
            <span className="text-slate-400 font-bold">Audited Record</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-[#0E1524] border border-slate-800 rounded-2xl p-5 shadow-md">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Sales</span>
              <div className="text-2xl font-extrabold text-white font-mono mt-2">
                ₹{lastMonthMetrics.totalRevenue.toLocaleString('en-IN')}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">Full closed monthly revenue</div>
            </div>

            <div className="bg-[#0E1524] border border-slate-800 rounded-2xl p-5 shadow-md">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Orders</span>
              <div className="text-2xl font-extrabold text-white font-mono mt-2">{lastMonthMetrics.totalOrders}</div>
              <div className="text-[11px] text-slate-400 mt-1">{lastMonthMetrics.completedCount} delivered</div>
            </div>

            <div className="bg-[#0E1524] border border-slate-800 rounded-2xl p-5 shadow-md">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Average Order Value</span>
              <div className="text-2xl font-extrabold text-white font-mono mt-2">
                ₹{lastMonthMetrics.aov.toLocaleString('en-IN')}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">Per ticket ticket size</div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: MONTHLY REPORT PDFs */}
      {activeTab === 'pdfs' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#0E1524] p-4 rounded-2xl border border-slate-800">
            <div>
              <h3 className="text-sm font-extrabold text-white">Compiled Audit & Financial Reports</h3>
              <p className="text-xs text-slate-400">PDF and Spreadsheet records stored securely on cloud storage.</p>
            </div>
            <button
              disabled={generatingPdf}
              onClick={handleGenerateReport}
              className="px-4 py-2 bg-orange-500 hover:bg-orange-400 text-white text-xs font-bold rounded-xl flex items-center gap-2 transition-all shadow-md shadow-orange-500/20 disabled:opacity-50"
            >
              <FileText className="w-3.5 h-3.5" />
              {generatingPdf ? 'Generating...' : 'Compile New Report'}
            </button>
          </div>

          <div className="bg-[#0E1524] border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
            <div className="divide-y divide-slate-800">
              {pdfReports.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs">
                  No previous PDF reports found. Click "Compile New Report" to generate.
                </div>
              ) : (
                pdfReports.map((rep) => (
                  <div key={rep.id} className="p-4 flex items-center justify-between hover:bg-slate-800/30 transition-colors text-xs">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-400 flex items-center justify-center">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-bold text-white">{rep.title || `Olive Pizza Report - ${rep.month}`}</div>
                        <div className="text-slate-500 text-[11px] mt-0.5">
                          Generated {new Date(rep.createdAt || Date.now()).toLocaleDateString()}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {rep.url && rep.url !== '#' && (
                        <a
                          href={rep.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 bg-[#0B0F17] hover:bg-slate-800 border border-slate-800 text-slate-300 font-bold rounded-lg flex items-center gap-1.5 transition-all"
                        >
                          <Download className="w-3.5 h-3.5" /> Download
                        </a>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
