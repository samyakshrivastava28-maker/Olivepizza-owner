import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  BarChart3,
  Settings,
  Sparkles,
  Link as LinkIcon,
  ShieldCheck,
  Building2,
  Eye,
  Filter,
  Clock,
  Printer,
  ChevronDown,
} from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import { Order } from '../types/models';
import { fetchApi } from '../lib/api';
import toast from 'react-hot-toast';
import { PdfViewerModal } from '../components/common/PdfViewerModal';

export type TimeRangeFilter =
  | 'Ongoing Month'
  | 'Previous Month'
  | 'This Week'
  | 'Previous Week'
  | 'Last Day'
  | 'Last 2 Days'
  | 'All Time';

const TIME_RANGES: TimeRangeFilter[] = [
  'Ongoing Month',
  'Previous Month',
  'This Week',
  'Previous Week',
  'Last Day',
  'Last 2 Days',
  'All Time',
];

function parseTimestamp(val: any): Date {
  if (!val) return new Date();
  if (val instanceof Date) return val;
  if (typeof val.toDate === 'function') return val.toDate();
  if (typeof val === 'object' && val._seconds) return new Date(val._seconds * 1000);
  if (typeof val === 'number') return new Date(val);
  const d = new Date(val);
  return isNaN(d.getTime()) ? new Date() : d;
}

export default function RestaurantReports() {
  const [activeTab, setActiveTab] = useState<'analytics_hub' | 'custom_reports' | 'ongoing' | 'last_month' | 'pdfs'>('analytics_hub');
  const [orders, setOrders] = useState<Order[]>([]);
  const [pdfReports, setPdfReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [generatingCustomPdf, setGeneratingCustomPdf] = useState(false);
  const [syncingSheet, setSyncingSheet] = useState(false);

  // Franchise & Branch Selection State
  const [branches, setBranches] = useState<any[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>('all');

  // Custom Report Time Filter State (7 options)
  const [customTimeRange, setCustomTimeRange] = useState<TimeRangeFilter>('Ongoing Month');

  // In-App PDF Preview Modal State
  const [pdfModal, setPdfModal] = useState<{
    isOpen: boolean;
    title: string;
    pdfUrl: string;
    downloadUrl?: string;
    subtitle?: string;
  }>({
    isOpen: false,
    title: '',
    pdfUrl: '',
  });

  const openPdfViewer = (title: string, pdfUrl: string, downloadUrl?: string, subtitle?: string) => {
    setPdfModal({
      isOpen: true,
      title,
      pdfUrl,
      downloadUrl: downloadUrl || `${pdfUrl}?download=true`,
      subtitle,
    });
  };

  // Looker Studio & Google Sheets Configuration
  const [lookerConfig, setLookerConfig] = useState<{
    embedUrl: string;
    spreadsheetId: string | null;
    currentSheetTitle: string;
    liveSheetUrl: string | null;
    lastSyncedAt: string;
  }>({
    embedUrl: '',
    spreadsheetId: null,
    currentSheetTitle: '',
    liveSheetUrl: null,
    lastSyncedAt: '',
  });

  const [showConfigModal, setShowConfigModal] = useState(false);
  const [inputEmbedUrl, setInputEmbedUrl] = useState('');
  const [savingConfig, setSavingConfig] = useState(false);

  const currentDate = new Date();
  const currentMonthName = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  const lastMonthDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
  const lastMonthName = lastMonthDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  // 1. Fetch Branches for Selection
  useEffect(() => {
    fetchApi('/api/franchises/list')
      .then(async (res) => (res.ok ? res.json() : {}))
      .then((data) => {
        if (data.franchises && Array.isArray(data.franchises)) {
          const allB: any[] = [];
          data.franchises.forEach((f: any) => {
            if (Array.isArray(f.branches)) {
              allB.push(...f.branches.map((b: any) => ({ ...b, franchiseName: f.name })));
            }
          });
          if (allB.length > 0) setBranches(allB);
        }
      })
      .catch(() => {});

    fetchApi('/api/franchises/fra_rajnandgaon/branches')
      .then(async (res) => (res.ok ? res.json() : {}))
      .then((data) => {
        if (data.branches && Array.isArray(data.branches)) {
          setBranches((prev) => {
            const map = new Map(prev.map((b) => [b.id, b]));
            data.branches.forEach((b: any) => map.set(b.id, b));
            return Array.from(map.values());
          });
        }
      })
      .catch(() => {});
  }, []);

  // 2. Fetch PDF reports list (scoped to selectedBranch)
  const loadPdfReports = useCallback((branchId: string = selectedBranch) => {
    const query = branchId !== 'all' ? `?branchId=${encodeURIComponent(branchId)}` : '';
    fetchApi(`/api/reports/monthly${query}`)
      .then(async (res) => { if (!res.ok) return {}; return res.json().catch(() => ({})); })
      .then((data) => {
        if (Array.isArray(data)) setPdfReports(data);
        else if (data.reports) setPdfReports(data.reports);
      })
      .catch((e) => console.warn('[RestaurantReports] Reports list fallback:', e));
  }, [selectedBranch]);

  useEffect(() => {
    loadPdfReports(selectedBranch);
  }, [selectedBranch, loadPdfReports]);

  // 3. Load orders for analytics calculations & Looker Config
  useEffect(() => {
    setLoading(true);
    const unsubscribe = onSnapshot(
      collection(db, 'orders'),
      (snapshot) => {
        const fetched: Order[] = [];
        snapshot.forEach((d) => fetched.push({ id: d.id, ...d.data() } as Order));
        setOrders(fetched);
        setLoading(false);
      },
      (err) => {
        console.warn('[RestaurantReports] Realtime error:', err);
        fetchApi('/api/orders?limit=500')
          .then(async (res) => { if (!res.ok) return {}; return res.json().catch(() => ({})); })
          .then((d) => setOrders(Array.isArray(d) ? d : d.orders || []))
          .catch(() => {})
          .finally(() => setLoading(false));
      }
    );

    // Fetch Looker Studio & Google Sheets Config
    fetchApi('/api/reports/looker-studio/config')
      .then(async (res) => { if (!res.ok) return {}; return res.json().catch(() => ({})); })
      .then((data) => {
        if (data.success) {
          setLookerConfig(data);
          setInputEmbedUrl(data.embedUrl || '');
        }
      })
      .catch((e) => console.warn('[RestaurantReports] Looker Studio config fallback:', e));

    return () => unsubscribe();
  }, []);

  // Filter orders by Branch Selection
  const branchFilteredOrders = useMemo(() => {
    if (selectedBranch === 'all') return orders;
    return orders.filter(
      (o: any) =>
        o.branchId === selectedBranch ||
        (selectedBranch === 'main_branch' && (!o.branchId || o.branchId === 'main_branch'))
    );
  }, [orders, selectedBranch]);

  // Ongoing Month Orders (Current Month)
  const currentMonthOrders = useMemo(() => {
    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getTime();
    return branchFilteredOrders.filter((o) => {
      const t = parseTimestamp(o.createdAt).getTime();
      return t >= startOfMonth;
    });
  }, [branchFilteredOrders]);

  // Last Month Orders
  const lastMonthOrders = useMemo(() => {
    const startOfLast = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1).getTime();
    const endOfLast = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getTime();
    return branchFilteredOrders.filter((o) => {
      const t = parseTimestamp(o.createdAt).getTime();
      return t >= startOfLast && t < endOfLast;
    });
  }, [branchFilteredOrders]);

  // Custom Time Filter Orders
  const customRangeOrders = useMemo(() => {
    const now = new Date();
    const nowMs = now.getTime();

    return branchFilteredOrders.filter((o) => {
      const t = parseTimestamp(o.createdAt).getTime();

      switch (customTimeRange) {
        case 'Ongoing Month': {
          const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
          return t >= startOfMonth;
        }
        case 'Previous Month': {
          const startOfLast = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
          const endOfLast = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
          return t >= startOfLast && t < endOfLast;
        }
        case 'This Week': {
          const day = now.getDay();
          const diff = now.getDate() - day + (day === 0 ? -6 : 1);
          const startOfWeek = new Date(now.getFullYear(), now.getMonth(), diff).setHours(0, 0, 0, 0);
          return t >= startOfWeek;
        }
        case 'Previous Week': {
          const day = now.getDay();
          const diff = now.getDate() - day + (day === 0 ? -6 : 1) - 7;
          const startOfPrevWeek = new Date(now.getFullYear(), now.getMonth(), diff).setHours(0, 0, 0, 0);
          const endOfPrevWeek = startOfPrevWeek + 7 * 24 * 60 * 60 * 1000;
          return t >= startOfPrevWeek && t < endOfPrevWeek;
        }
        case 'Last Day': {
          const oneDayAgo = nowMs - 24 * 60 * 60 * 1000;
          return t >= oneDayAgo;
        }
        case 'Last 2 Days': {
          const twoDaysAgo = nowMs - 48 * 60 * 60 * 1000;
          return t >= twoDaysAgo;
        }
        case 'All Time':
        default:
          return true;
      }
    });
  }, [branchFilteredOrders, customTimeRange]);

  // Aggregation function helper
  const aggregateOrders = (orderList: Order[]) => {
    let revenue = 0;
    let completed = 0;
    let cancelled = 0;
    let cashTotal = 0;
    let upiTotal = 0;
    let cardTotal = 0;
    let onlineTotal = 0;
    const itemSales: Record<string, { name: string; qty: number; revenue: number }> = {};

    orderList.forEach((o) => {
      const s = (o.status || 'pending').toLowerCase();
      const amt = Number(o.totalAmount ?? (o as any).total ?? (o as any).finalAmount ?? 0);

      if (s !== 'cancelled' && s !== 'rejected') {
        revenue += amt;
        const pm = (o.paymentMethod || (o as any).payment?.method || 'CASH').toUpperCase();
        if (pm.includes('CASH') || pm.includes('COD')) cashTotal += amt;
        else if (pm.includes('UPI') || pm.includes('GPAY') || pm.includes('PHONEPE')) upiTotal += amt;
        else if (pm.includes('CARD')) cardTotal += amt;
        else onlineTotal += amt;
      }
      if (s === 'delivered' || s === 'completed') completed++;
      else if (s === 'cancelled' || s === 'rejected') cancelled++;

      (o.items || []).forEach((it: any) => {
        const name = it.name || it.productName || 'Pizza Item';
        const qty = Number(it.quantity || 1);
        const price = Number(it.price || 0) * qty;

        if (!itemSales[name]) itemSales[name] = { name, qty: 0, revenue: 0 };
        itemSales[name].qty += qty;
        itemSales[name].revenue += price;
      });
    });

    const topProducts = Object.values(itemSales)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    const aov = orderList.length > 0 ? Math.round(revenue / Math.max(1, orderList.length - cancelled)) : 0;

    return {
      totalOrders: orderList.length,
      revenue,
      completed,
      cancelled,
      cashTotal,
      upiTotal,
      cardTotal,
      onlineTotal,
      topProducts,
      aov,
    };
  };

  const currentStats = useMemo(() => aggregateOrders(currentMonthOrders), [currentMonthOrders]);
  const lastMonthStats = useMemo(() => aggregateOrders(lastMonthOrders), [lastMonthOrders]);
  const customStats = useMemo(() => aggregateOrders(customRangeOrders), [customRangeOrders]);

  // Selected branch label
  const selectedBranchLabel = useMemo(() => {
    if (selectedBranch === 'all') return 'All Franchise Branches (Consolidated)';
    const found = branches.find((b) => b.id === selectedBranch);
    return found ? found.name || found.id : selectedBranch;
  }, [selectedBranch, branches]);

  // Sync Live Google Sheets On-Demand
  const handleSyncGoogleSheets = async () => {
    setSyncingSheet(true);
    const toastId = toast.loading('Syncing latest POS bills to Google Sheets monthly workbook...');
    try {
      const res = await fetchApi('/api/reports/google-sheet/sync', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        toast.success(`Synced ${data.syncedCount} orders to "${data.spreadsheetId}"!`, { id: toastId });
      } else {
        toast.error('Sync failed: ' + (data.error || 'Unknown error'), { id: toastId });
      }
    } catch (err: any) {
      toast.error('Sync failed: ' + err.message, { id: toastId });
    } finally {
      setSyncingSheet(false);
    }
  };

  // Save Looker Studio Embed URL
  const handleSaveEmbedUrl = async () => {
    if (!inputEmbedUrl.trim()) {
      toast.error('Please enter a valid Looker Studio embed URL');
      return;
    }
    setSavingConfig(true);
    const toastId = toast.loading('Saving Looker Studio configuration...');
    try {
      const res = await fetchApi('/api/reports/looker-studio/set-embed-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ embedUrl: inputEmbedUrl.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Looker Studio embed URL updated!', { id: toastId });
        setLookerConfig((prev) => ({ ...prev, embedUrl: inputEmbedUrl.trim() }));
        setShowConfigModal(false);
      } else {
        toast.error('Failed: ' + (data.error || 'Server error'), { id: toastId });
      }
    } catch (err: any) {
      toast.error('Failed to save: ' + err.message, { id: toastId });
    } finally {
      setSavingConfig(false);
    }
  };

  // Generate On-Demand Report PDF (Opens in In-App PdfViewerModal)
  const handleGeneratePdf = async (type: 'monthly' | 'financial') => {
    setGeneratingPdf(true);
    const toastId = toast.loading(`Generating official ${type} audit PDF report...`);
    try {
      const res = await fetchApi('/api/reports/generate-monthly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          month: lastMonthName,
          branchId: selectedBranch !== 'all' ? selectedBranch : undefined,
        }),
      });
      const data = await res.json();
      if (data.success && data.report) {
        toast.success('Report PDF generated and archived in Cloudflare R2!', { id: toastId });
        loadPdfReports(selectedBranch);
        const urlToOpen = data.report.viewUrl || data.report.downloadUrl || data.report.pdfUrl;
        if (urlToOpen) {
          openPdfViewer(
            `Olive Pizza — ${lastMonthName} Official Statement`,
            urlToOpen,
            data.report.downloadUrl,
            `Branch: ${selectedBranchLabel} • Cloudflare R2 Archival`
          );
        }
      } else {
        toast.error(data.error || 'Failed to generate report', { id: toastId });
      }
    } catch (e: any) {
      toast.error('Failed to generate report PDF: ' + e.message, { id: toastId });
    } finally {
      setGeneratingPdf(false);
    }
  };

  // Generate Custom PDF Report (Unlimited for Owner)
  const handleGenerateCustomPdf = async (timeRange: TimeRangeFilter, action: 'preview' | 'download' = 'preview') => {
    setGeneratingCustomPdf(true);
    const toastId = toast.loading(`Generating custom audit PDF (${timeRange})...`);
    try {
      const res = await fetchApi('/api/reports/generate-custom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          timeRange,
          branchId: selectedBranch !== 'all' ? selectedBranch : 'main_branch',
          branchName: selectedBranchLabel,
        }),
      });
      const data = await res.json();
      if (data.success && data.report) {
        toast.success(`Custom ${timeRange} PDF ready!`, { id: toastId });
        const viewUrl = data.report.viewUrl || data.report.pdfUrl;
        const downloadUrl = data.report.downloadUrl || `${viewUrl}?download=true`;

        if (action === 'download') {
          const a = document.createElement('a');
          a.href = downloadUrl;
          a.download = `OlivePizza_${timeRange.replace(/\s+/g, '_')}_Report.pdf`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        } else {
          openPdfViewer(
            `Custom Statement — ${timeRange}`,
            viewUrl,
            downloadUrl,
            `Branch: ${selectedBranchLabel} • Owner Unlimited Access`
          );
        }
        loadPdfReports(selectedBranch);
      } else {
        toast.error(data.error || 'Failed to generate custom report', { id: toastId });
      }
    } catch (err: any) {
      toast.error('Failed to generate custom PDF: ' + err.message, { id: toastId });
    } finally {
      setGeneratingCustomPdf(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header & Navigation Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-[#0E1524] p-5 rounded-2xl border border-slate-800 shadow-lg">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-extrabold text-white tracking-tight">Financial & Business Analytics</h1>
            <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-orange-500/10 border border-orange-500/30 text-orange-400">
              <Sparkles className="w-3 h-3" /> Live Analytics
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Cloudflare R2 Encrypted PDF Archive, Live Google Sheets Billing, and Looker Studio Executive BI.
          </p>
        </div>

        {/* Branch Selector Dropdown (Allows Owner to Select Any Restaurant) */}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-[#0B0F17] rounded-xl border border-orange-500/30 text-xs text-slate-300">
          <Building2 className="w-4 h-4 text-orange-400 shrink-0" />
          <span className="font-bold text-slate-400">Scope:</span>
          <select
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
            className="bg-transparent text-white font-bold focus:outline-none cursor-pointer text-xs pr-1"
          >
            <option value="all" className="bg-[#0B0F17] text-white">
              All Branches (Consolidated)
            </option>
            {branches.map((b) => (
              <option key={b.id} value={b.id} className="bg-[#0B0F17] text-white">
                {b.name || b.id} {b.city ? `(${b.city})` : ''}
              </option>
            ))}
            {branches.length === 0 && (
              <option value="main_branch" className="bg-[#0B0F17] text-white">
                Olive Pizza — Rajnandgaon HQ
              </option>
            )}
          </select>
          <ChevronDown className="w-3.5 h-3.5 text-slate-500 pointer-events-none" />
        </div>

        {/* Tab Switcher */}
        <div className="flex flex-wrap items-center gap-1.5 bg-[#0B0F17] p-1.5 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveTab('analytics_hub')}
            className={`px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'analytics_hub'
                ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" /> Looker Hub
          </button>
          <button
            onClick={() => setActiveTab('custom_reports')}
            className={`px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'custom_reports'
                ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Filter className="w-3.5 h-3.5" /> Custom Reports
          </button>
          <button
            onClick={() => setActiveTab('ongoing')}
            className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'ongoing'
                ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            Ongoing ({currentMonthName})
          </button>
          <button
            onClick={() => setActiveTab('last_month')}
            className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'last_month'
                ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            Last Month ({lastMonthName})
          </button>
          <button
            onClick={() => setActiveTab('pdfs')}
            className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'pdfs'
                ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            PDF Archive ({pdfReports.length})
          </button>
        </div>
      </div>

      {/* TAB 1: LOOKER STUDIO & LIVE SHEETS ANALYTICS HUB */}
      {activeTab === 'analytics_hub' && (
        <div className="space-y-6">
          {/* Quick Action & Controls Toolbar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#0E1524] p-4 rounded-2xl border border-slate-800">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-[#0B0F17] rounded-xl border border-slate-800 text-xs text-slate-300">
                <Building2 className="w-3.5 h-3.5 text-orange-400" />
                <span className="font-bold text-white">{selectedBranchLabel}</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-[#0B0F17] rounded-xl border border-slate-800 text-xs text-slate-300">
                <Calendar className="w-3.5 h-3.5 text-orange-400" />
                <span>
                  Month: <strong className="text-white font-mono">{lookerConfig.currentSheetTitle || currentMonthName}</strong>
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleSyncGoogleSheets}
                disabled={syncingSheet}
                className="px-3 py-1.5 bg-[#0B0F17] hover:bg-slate-800 border border-slate-700/70 text-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-orange-400 ${syncingSheet ? 'animate-spin' : ''}`} />
                Sync Live Sheet
              </button>

              {lookerConfig.liveSheetUrl && (
                <a
                  href={lookerConfig.liveSheetUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shadow-emerald-600/20"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  Open Google Sheet
                  <ArrowUpRight className="w-3 h-3 opacity-70" />
                </a>
              )}

              <button
                onClick={() => setShowConfigModal(true)}
                className="p-2 bg-[#0B0F17] hover:bg-slate-800 border border-slate-700/70 text-slate-300 rounded-xl text-xs transition-all"
                title="Configure Looker Studio Embed URL"
              >
                <Settings className="w-4 h-4 text-slate-400" />
              </button>
            </div>
          </div>

          {/* Real-time Financial KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-[#0E1524] border border-slate-800 rounded-2xl p-4 shadow-md">
              <div className="text-[11px] font-bold text-slate-400 uppercase">Month Billed Gross</div>
              <div className="text-xl sm:text-2xl font-extrabold text-white font-mono mt-2">
                ₹{currentStats.revenue.toLocaleString('en-IN')}
              </div>
              <div className="text-[10px] text-emerald-400 mt-1">Live Firestore + Sheets</div>
            </div>

            <div className="bg-[#0E1524] border border-slate-800 rounded-2xl p-4 shadow-md">
              <div className="text-[11px] font-bold text-slate-400 uppercase">Total Orders</div>
              <div className="text-xl sm:text-2xl font-extrabold text-white font-mono mt-2">
                {currentStats.totalOrders}
              </div>
              <div className="text-[10px] text-slate-400 mt-1">{currentStats.completed} completed</div>
            </div>

            <div className="bg-[#0E1524] border border-slate-800 rounded-2xl p-4 shadow-md">
              <div className="text-[11px] font-bold text-slate-400 uppercase">UPI / QR Collection</div>
              <div className="text-xl sm:text-2xl font-extrabold text-orange-400 font-mono mt-2">
                ₹{currentStats.upiTotal.toLocaleString('en-IN')}
              </div>
              <div className="text-[10px] text-slate-400 mt-1">GPay, PhonePe, Paytm</div>
            </div>

            <div className="bg-[#0E1524] border border-slate-800 rounded-2xl p-4 shadow-md">
              <div className="text-[11px] font-bold text-slate-400 uppercase">Cash at Counter</div>
              <div className="text-xl sm:text-2xl font-extrabold text-emerald-400 font-mono mt-2">
                ₹{currentStats.cashTotal.toLocaleString('en-IN')}
              </div>
              <div className="text-[10px] text-slate-400 mt-1">Direct register drawer</div>
            </div>
          </div>

          {/* Embedded Looker Studio Interactive Dashboard Frame */}
          <div className="bg-[#0E1524] border border-slate-800 rounded-2xl p-4 shadow-xl">
            {lookerConfig.embedUrl ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-orange-400" />
                    <span className="text-xs font-extrabold text-white uppercase tracking-wider">
                      Google Looker Studio — Live Executive View
                    </span>
                  </div>
                  <a
                    href={lookerConfig.embedUrl.replace('/embed', '')}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-orange-400 hover:text-orange-300 font-bold flex items-center gap-1"
                  >
                    Open in Looker Studio <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <div className="w-full rounded-xl overflow-hidden border border-slate-800/80 bg-[#06070a] relative min-h-[600px] sm:min-h-[750px]">
                  <iframe
                    src={lookerConfig.embedUrl}
                    title="Olive Pizza Google Looker Studio Dashboard"
                    className="w-full h-[600px] sm:h-[750px] border-0"
                    allowFullScreen
                    sandbox="allow-storage-access-by-user-activation allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
                  />
                </div>
              </div>
            ) : (
              <div className="text-center py-16 px-4 space-y-4 max-w-lg mx-auto">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400">
                  <BarChart3 className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-white">Connect Google Looker Studio Dashboard</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Connect your Looker Studio reporting dashboard to view live visual charts, revenue trends, and franchise comparisons right inside the Owner App.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                  <button
                    onClick={() => setShowConfigModal(true)}
                    className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shadow-orange-600/20"
                  >
                    <LinkIcon className="w-3.5 h-3.5" /> Enter Looker Studio Embed URL
                  </button>

                  {lookerConfig.liveSheetUrl && (
                    <a
                      href={lookerConfig.liveSheetUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-4 py-2 bg-[#0B0F17] hover:bg-slate-800 border border-slate-700 text-slate-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" /> View Current Google Sheet
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: CUSTOM REPORTS (WITH 7 TIME FILTERS & UNLIMITED OWNER DOWNLOADS) */}
      {activeTab === 'custom_reports' && (
        <div className="space-y-6">
          <div className="bg-[#0E1524] border border-slate-800 rounded-2xl p-6 shadow-md space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
                  <Filter className="w-4 h-4 text-orange-400" /> Custom Filtered Reports & On-Demand PDF Export
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Filter historical orders across 7 predefined windows. Owner has unlimited custom PDF downloads.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full text-xs font-bold flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5" /> Owner Unlimited Custom Downloads
                </span>
              </div>
            </div>

            {/* 7 Time Filters Selection Bar */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                Select Reporting Time Window:
              </label>
              <div className="flex flex-wrap gap-2">
                {TIME_RANGES.map((range) => {
                  const isSelected = customTimeRange === range;
                  return (
                    <button
                      key={range}
                      onClick={() => setCustomTimeRange(range)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                        isSelected
                          ? 'bg-orange-500 text-white shadow-md shadow-orange-500/25 ring-2 ring-orange-500/30'
                          : 'bg-[#0B0F17] hover:bg-slate-800 text-slate-300 border border-slate-800 hover:text-white'
                      }`}
                    >
                      <Clock className="w-3 h-3 text-orange-400" />
                      {range}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Metrics Snapshot for the Selected Time Range */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
              <div className="bg-[#0B0F17] border border-slate-800 rounded-xl p-4">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Selected Window Gross</span>
                <span className="text-xl font-black text-white font-mono mt-1 block">
                  ₹{customStats.revenue.toLocaleString('en-IN')}
                </span>
                <span className="text-[10px] text-orange-400 mt-0.5 block">{customTimeRange}</span>
              </div>

              <div className="bg-[#0B0F17] border border-slate-800 rounded-xl p-4">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Total Orders</span>
                <span className="text-xl font-black text-white font-mono mt-1 block">
                  {customStats.totalOrders}
                </span>
                <span className="text-[10px] text-slate-400 mt-0.5 block">{customStats.completed} delivered</span>
              </div>

              <div className="bg-[#0B0F17] border border-slate-800 rounded-xl p-4">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">UPI / Online Paid</span>
                <span className="text-xl font-black text-emerald-400 font-mono mt-1 block">
                  ₹{customStats.upiTotal.toLocaleString('en-IN')}
                </span>
                <span className="text-[10px] text-slate-400 mt-0.5 block">Digital settlement</span>
              </div>

              <div className="bg-[#0B0F17] border border-slate-800 rounded-xl p-4">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Average Ticket Size</span>
                <span className="text-xl font-black text-orange-400 font-mono mt-1 block">
                  ₹{customStats.aov}
                </span>
                <span className="text-[10px] text-slate-400 mt-0.5 block">Per completed bill</span>
              </div>
            </div>

            {/* Action Bar: In-App Preview & Direct Download */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-[#0B0F17] rounded-xl border border-slate-800">
              <div className="text-xs text-slate-400">
                Scope: <strong className="text-white">{selectedBranchLabel}</strong> • Filter:{' '}
                <strong className="text-orange-400">{customTimeRange}</strong>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  onClick={() => handleGenerateCustomPdf(customTimeRange, 'preview')}
                  disabled={generatingCustomPdf}
                  className="flex-1 sm:flex-none px-4 py-2.5 bg-[#161f30] hover:bg-[#1e2a42] border border-slate-700/60 text-slate-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
                >
                  <Eye className="w-3.5 h-3.5 text-blue-400" />
                  <span>Preview PDF in App</span>
                </button>

                <button
                  onClick={() => handleGenerateCustomPdf(customTimeRange, 'download')}
                  disabled={generatingCustomPdf}
                  className="flex-1 sm:flex-none px-4 py-2.5 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-md shadow-orange-600/20 disabled:opacity-50"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Custom PDF</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: ONGOING MONTH */}
      {activeTab === 'ongoing' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-[#0E1524] border border-slate-800 rounded-2xl p-5 shadow-md">
              <div className="flex justify-between items-center text-xs font-bold text-slate-400 uppercase">
                <span>Month-to-Date Revenue</span>
                <DollarSign className="w-4 h-4 text-orange-400" />
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold text-white font-mono mt-3">
                ₹{currentStats.revenue.toLocaleString('en-IN')}
              </div>
              <div className="text-[11px] text-emerald-400 mt-1">Live accumulating gross total</div>
            </div>

            <div className="bg-[#0E1524] border border-slate-800 rounded-2xl p-5 shadow-md">
              <div className="flex justify-between items-center text-xs font-bold text-slate-400 uppercase">
                <span>Orders Processed</span>
                <ShoppingBag className="w-4 h-4 text-orange-400" />
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold text-white font-mono mt-3">
                {currentStats.totalOrders}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">{currentStats.completed} completed</div>
            </div>

            <div className="bg-[#0E1524] border border-slate-800 rounded-2xl p-5 shadow-md">
              <div className="flex justify-between items-center text-xs font-bold text-slate-400 uppercase">
                <span>Average Order Value</span>
                <TrendingUp className="w-4 h-4 text-orange-400" />
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold text-white font-mono mt-3">
                ₹{currentStats.aov.toLocaleString('en-IN')}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">Ongoing monthly average</div>
            </div>

            <div className="bg-[#0E1524] border border-slate-800 rounded-2xl p-5 shadow-md">
              <div className="flex justify-between items-center text-xs font-bold text-slate-400 uppercase">
                <span>Cancellation Rate</span>
                <TrendingDown className="w-4 h-4 text-rose-400" />
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold text-rose-400 font-mono mt-3">
                {currentStats.totalOrders > 0
                  ? `${Math.round((currentStats.cancelled / currentStats.totalOrders) * 100)}%`
                  : '0%'}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">{currentStats.cancelled} cancelled orders</div>
            </div>
          </div>

          {/* Leaderboard */}
          <div className="bg-[#0E1524] border border-slate-800 rounded-2xl p-6 shadow-md space-y-4">
            <h3 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
              <Pizza className="w-4 h-4 text-orange-400" /> Top Menu Revenue Contributors ({currentMonthName})
            </h3>

            {currentStats.topProducts.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-xs">No orders recorded yet this month.</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {currentStats.topProducts.map((p, idx) => (
                  <div key={idx} className="p-3.5 bg-[#0B0F17] rounded-xl border border-slate-800 flex justify-between items-center">
                    <div>
                      <span className="text-xs font-bold text-white block">{p.name}</span>
                      <span className="text-[11px] text-slate-400">{p.qty} sold</span>
                    </div>
                    <span className="font-mono font-extrabold text-orange-400 text-xs">
                      ₹{p.revenue.toLocaleString('en-IN')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: LAST MONTH AUDITED */}
      {activeTab === 'last_month' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-[#0E1524] border border-slate-800 rounded-2xl p-5 shadow-md">
              <div className="text-xs font-bold text-slate-400 uppercase">Closed Gross Revenue</div>
              <div className="text-2xl sm:text-3xl font-extrabold text-white font-mono mt-3">
                ₹{lastMonthStats.revenue.toLocaleString('en-IN')}
              </div>
              <div className="text-[11px] text-emerald-400 mt-1">Final audited total</div>
            </div>

            <div className="bg-[#0E1524] border border-slate-800 rounded-2xl p-5 shadow-md">
              <div className="text-xs font-bold text-slate-400 uppercase">Completed Volume</div>
              <div className="text-2xl sm:text-3xl font-extrabold text-white font-mono mt-3">
                {lastMonthStats.completed}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">Out of {lastMonthStats.totalOrders} total</div>
            </div>

            <div className="bg-[#0E1524] border border-slate-800 rounded-2xl p-5 shadow-md">
              <div className="text-xs font-bold text-slate-400 uppercase">Final Average Ticket</div>
              <div className="text-2xl sm:text-3xl font-extrabold text-white font-mono mt-3">
                ₹{lastMonthStats.aov.toLocaleString('en-IN')}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">Closed AOV metric</div>
            </div>

            <div className="bg-[#0E1524] border border-slate-800 rounded-2xl p-5 shadow-md">
              <div className="text-xs font-bold text-slate-400 uppercase">Audit PDF Status</div>
              <div className="text-base font-extrabold text-emerald-400 mt-3 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" /> Ready & Archived
              </div>
              <div className="text-[11px] text-slate-400 mt-1">Cloudflare R2 Object Storage</div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: REPORT PDFS ARCHIVE */}
      {activeTab === 'pdfs' && (
        <div className="bg-[#0E1524] border border-slate-800 rounded-2xl p-6 shadow-md space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
                <FileText className="w-4 h-4 text-orange-400" /> Official Monthly PDF Statements
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Authoritative executive balance sheets, tax breakdown, and sales ledger archived in Cloudflare R2.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => loadPdfReports(selectedBranch)}
                className="p-2 bg-[#0B0F17] hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
                title="Refresh Reports"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Refresh
              </button>
              <button
                onClick={() => handleGeneratePdf('monthly')}
                disabled={generatingPdf}
                className="px-3.5 py-2 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-md shadow-orange-600/20 disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5" /> Generate Monthly PDF
              </button>
            </div>
          </div>

          {pdfReports.length === 0 ? (
            <div className="text-center py-14 text-slate-500 text-xs space-y-3">
              <FileText className="w-10 h-10 mx-auto text-slate-600 opacity-40" />
              <p className="font-semibold text-slate-400">No monthly PDF statements found for this branch.</p>
              <p className="text-slate-500 max-w-sm mx-auto">
                Monthly reports are automatically finalized on the 1st of every month at 00:05 AM IST, or you can generate on-demand.
              </p>
              <button
                onClick={() => handleGeneratePdf('monthly')}
                disabled={generatingPdf}
                className="mt-2 px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-xl text-xs inline-flex items-center gap-1.5 shadow-md shadow-orange-600/20"
              >
                <Download className="w-3.5 h-3.5" /> Generate {lastMonthName} PDF
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pdfReports.map((r: any, idx: number) => {
                const viewLink = r.viewUrl || r.reportUrl || `/api/reports/monthly/${r.id}/view`;
                const downloadLink = r.downloadUrl || `${viewLink}?download=true`;
                const revenue = Number(r.revenue || 0);
                const ordersCount = Number(r.orders || 0);
                const aov = r.averageOrderValue
                  ? Math.round(r.averageOrderValue)
                  : ordersCount > 0
                  ? Math.round(revenue / ordersCount)
                  : 0;

                return (
                  <div
                    key={r.id || idx}
                    className="p-5 bg-[#0B0F17] hover:bg-[#0c121e] rounded-2xl border border-slate-800 transition-all flex flex-col justify-between space-y-4 shadow-sm"
                  >
                    <div>
                      {/* Top Row: Period & Status */}
                      <div className="flex items-center justify-between gap-2">
                        <span className="px-3 py-1 bg-orange-500/10 border border-orange-500/20 text-orange-400 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
                          <Calendar className="w-3 h-3" /> {r.period || `${r.month || ''} ${r.year || ''}`}
                        </span>
                        <span className="px-2.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full text-[11px] font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Audited & Ready
                        </span>
                      </div>

                      {/* Branch Info */}
                      <div className="mt-3">
                        <h4 className="text-sm font-extrabold text-white flex items-center gap-1.5">
                          <Building2 className="w-4 h-4 text-orange-400 shrink-0" />
                          <span>{r.branchName || r.title || `Olive Pizza — ${r.branchId || 'HQ Branch'}`}</span>
                        </h4>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {r.franchiseName || 'Olive Pizza Franchise'} • {r.pdfSize || 'Cloudflare R2 Encrypted'}
                        </div>
                      </div>

                      {/* Financial Metrics */}
                      <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-slate-800/80">
                        <div className="bg-[#121927] p-2.5 rounded-xl border border-slate-800">
                          <div className="text-[10px] font-bold text-slate-400 uppercase">Gross Sales</div>
                          <div className="text-sm font-black text-emerald-400 font-mono mt-0.5">
                            ₹{revenue.toLocaleString('en-IN')}
                          </div>
                        </div>
                        <div className="bg-[#121927] p-2.5 rounded-xl border border-slate-800">
                          <div className="text-[10px] font-bold text-slate-400 uppercase">Total Orders</div>
                          <div className="text-sm font-black text-white font-mono mt-0.5">
                            {ordersCount}
                          </div>
                        </div>
                        <div className="bg-[#121927] p-2.5 rounded-xl border border-slate-800">
                          <div className="text-[10px] font-bold text-slate-400 uppercase">Avg Ticket</div>
                          <div className="text-sm font-black text-orange-400 font-mono mt-0.5">
                            ₹{aov}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons: View in In-App Modal & Direct Download */}
                    <div className="flex items-center gap-2 pt-2 border-t border-slate-800/60">
                      <button
                        onClick={() =>
                          openPdfViewer(
                            r.title || `${r.month || ''} ${r.year || ''} Monthly Statement`,
                            viewLink,
                            downloadLink,
                            `Branch: ${r.branchName || r.branchId || selectedBranchLabel}`
                          )
                        }
                        className="flex-1 py-2 px-3 bg-[#161f30] hover:bg-[#1e2a42] border border-slate-700/60 text-slate-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5 text-blue-400" /> View PDF
                      </button>
                      <a
                        href={downloadLink}
                        download
                        className="flex-1 py-2 px-3 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-md shadow-orange-600/20"
                      >
                        <Download className="w-3.5 h-3.5" /> Download PDF
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Looker Studio Embed Configuration Modal */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0E1524] border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-orange-400" />
                <h3 className="text-sm font-extrabold text-white">Google Looker Studio Settings</h3>
              </div>
              <button
                onClick={() => setShowConfigModal(false)}
                className="text-slate-400 hover:text-white text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-300">
                Looker Studio Embed URL
              </label>
              <input
                type="url"
                value={inputEmbedUrl}
                onChange={(e) => setInputEmbedUrl(e.target.value)}
                placeholder="https://lookerstudio.google.com/embed/reporting/..."
                className="w-full bg-[#0B0F17] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 font-mono"
              />
              <p className="text-[11px] text-slate-400">
                In Looker Studio: Click <strong>File → Embed report → Enable embedding → Embed URL</strong> and paste the link here.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setShowConfigModal(false)}
                className="px-4 py-2 bg-[#0B0F17] hover:bg-slate-800 text-slate-300 rounded-xl text-xs font-bold"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEmbedUrl}
                disabled={savingConfig}
                className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"
              >
                {savingConfig ? 'Saving...' : 'Save Configuration'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* In-App PDF Viewer Modal */}
      <PdfViewerModal
        isOpen={pdfModal.isOpen}
        onClose={() => setPdfModal((prev) => ({ ...prev, isOpen: false }))}
        title={pdfModal.title}
        pdfUrl={pdfModal.pdfUrl}
        downloadUrl={pdfModal.downloadUrl}
        subtitle={pdfModal.subtitle}
      />
    </div>
  );
}
