import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { Order } from '../types/models';
import { StatCard } from '../components/ui/StatCard';
import { TableSkeleton } from '../components/ui/Skeleton';
import { ErrorState } from '../components/ui/ErrorState';
import { fetchApi } from '../lib/api';
import { 
  IndianRupee, 
  ShoppingBag, 
  Download, 
  TrendingUp, 
  Award, 
  FileSpreadsheet, 
  RefreshCw, 
  ExternalLink 
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function Reports() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<'today' | 'week' | 'month' | 'all'>('month');

  // Google Sheets state
  const [sheetSyncing, setSheetSyncing] = useState(false);
  const [liveSheet, setLiveSheet] = useState<{
    spreadsheetId: string | null;
    currentSheetTitle: string | null;
    url: string | null;
  } | null>(null);

  useEffect(() => {
    const fetchOrders = async () => {
      setLoading(true);
      try {
        const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'), limit(500));
        const snap = await getDocs(q);
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Order[];
        setOrders(list);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    const fetchSheetStatus = async () => {
      try {
        const res = await fetchApi('/api/reports/monthly');
        if (res.ok) {
          const data = await res.json();
          if (data.liveSheet) setLiveSheet(data.liveSheet);
        }
      } catch (err) {
        console.warn('[Reports] Could not fetch live sheet status:', err);
      }
    };

    fetchOrders();
    fetchSheetStatus();
  }, []);

  const now = Date.now();
  const startOfToday = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()).getTime();
  const startOfWeek = now - 7 * 24 * 60 * 60 * 1000;
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();

  const parseTime = (o: Order): number => {
    if (!o.createdAt) return 0;
    if (typeof (o.createdAt as any)?.toMillis === 'function') return (o.createdAt as any).toMillis();
    if (typeof (o.createdAt as any)?.toDate === 'function') return (o.createdAt as any).toDate().getTime();
    if (typeof (o.createdAt as any)?.seconds === 'number') return (o.createdAt as any).seconds * 1000;
    const p = new Date(o.createdAt).getTime();
    return isNaN(p) ? 0 : p;
  };

  const filteredOrders = orders.filter((o) => {
    const t = parseTime(o);
    if (period === 'today') return t >= startOfToday;
    if (period === 'week') return t >= startOfWeek;
    if (period === 'month') return t >= startOfMonth;
    return true;
  });

  const validOrders = filteredOrders.filter(
    (o) => (o.status || '').toLowerCase() !== 'cancelled' && (o.status || '').toLowerCase() !== 'rejected'
  );

  const totalRevenue = validOrders.reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);
  const avgOrderValue = validOrders.length > 0 ? Math.round(totalRevenue / validOrders.length) : 0;
  const codCount = validOrders.filter((o) => (o.paymentMethod || '').toLowerCase() === 'cod').length;
  const onlineCount = validOrders.length - codCount;

  // Product popularity calculation
  const itemMap: Record<string, { name: string; quantity: number; revenue: number }> = {};
  validOrders.forEach((o) => {
    o.items?.forEach((it) => {
      if (!itemMap[it.name]) {
        itemMap[it.name] = { name: it.name, quantity: 0, revenue: 0 };
      }
      itemMap[it.name].quantity += it.quantity;
      itemMap[it.name].revenue += it.price * it.quantity;
    });
  });

  const topItems = Object.values(itemMap).sort((a, b) => b.quantity - a.quantity);

  const exportCSV = () => {
    if (validOrders.length === 0) {
      toast.error('No data available to export.');
      return;
    }

    const headers = ['Order ID,Customer Name,Phone,Amount,Status,Payment Method,Date\n'];
    const rows = validOrders.map((o) =>
      `"${o.dailyOrderNumber || o.id}","${o.customerName}","${o.customerPhone}",${o.totalAmount},"${o.status}","${o.paymentMethod}","${o.createdAt ? new Date(parseTime(o)).toISOString() : ''}"\n`
    );

    const blob = new Blob([headers.join('') + rows.join('')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `olive_pizza_report_${period}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('CSV Report downloaded.');
  };

  const handleSyncGoogleSheets = async () => {
    setSheetSyncing(true);
    try {
      const res = await fetchApi('/api/reports/google-sheet/sync', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Google Sheets sync failed');
      }
      toast.success(`Successfully synced ${data.syncedCount || 0} orders to Google Sheets!`);
      if (data.spreadsheetId) {
        setLiveSheet({
          spreadsheetId: data.spreadsheetId,
          currentSheetTitle: 'Live Monthly Sheet',
          url: `https://docs.google.com/spreadsheets/d/${data.spreadsheetId}`
        });
      }
    } catch (err: any) {
      toast.error(err.message || 'Google Sheets sync failed');
    } finally {
      setSheetSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-white">Financial & Sales Reports</h2>
          <p className="text-xs text-slate-400">Revenue breakdowns, average order values, and product performance analytics.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleSyncGoogleSheets}
            disabled={sheetSyncing}
            className="px-4 py-2 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white text-xs font-bold rounded-xl flex items-center gap-2 border border-emerald-600 transition-colors shadow-sm"
          >
            <RefreshCw className={`w-4 h-4 text-emerald-200 ${sheetSyncing ? 'animate-spin' : ''}`} />
            {sheetSyncing ? 'Syncing...' : 'Sync to Google Sheets'}
          </button>
          <button
            onClick={exportCSV}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl flex items-center gap-2 border border-slate-700 transition-colors"
          >
            <Download className="w-4 h-4 text-orange-400" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Google Sheets Live Link Bar */}
      {liveSheet?.url && (
        <div className="p-3.5 bg-emerald-950/30 border border-emerald-500/30 rounded-2xl flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-white flex items-center gap-1.5">
                Google Sheets Live Accounting
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono">
                  Connected
                </span>
              </p>
              <p className="text-[11px] text-emerald-300/80 font-mono truncate max-w-md">
                ID: {liveSheet.spreadsheetId}
              </p>
            </div>
          </div>
          <a
            href={liveSheet.url}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors shrink-0"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Open Google Sheet
          </a>
        </div>
      )}

      {error && <ErrorState message={error} onRetry={() => window.location.reload()} />}

      {/* Period Filter Tabs */}
      <div className="flex items-center gap-1.5 p-1 bg-[#131B2B] border border-slate-800 rounded-2xl w-fit">
        {[
          { id: 'today', label: 'Today' },
          { id: 'week', label: 'Last 7 Days' },
          { id: 'month', label: 'This Month' },
          { id: 'all', label: 'All Time' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setPeriod(tab.id as any)}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-colors ${
              period === tab.id
                ? 'bg-orange-500 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Gross Revenue"
          value={`₹${totalRevenue.toLocaleString('en-IN')}`}
          subtitle={`${validOrders.length} successful orders`}
          icon={IndianRupee}
          color="orange"
        />
        <StatCard
          title="Average Order Value"
          value={`₹${avgOrderValue.toLocaleString('en-IN')}`}
          subtitle="Revenue per customer order"
          icon={TrendingUp}
          color="green"
        />
        <StatCard
          title="Digital / UPI Payments"
          value={onlineCount}
          subtitle={`${((onlineCount / (validOrders.length || 1)) * 100).toFixed(0)}% online payment share`}
          icon={ShoppingBag}
          color="blue"
        />
        <StatCard
          title="Cash on Delivery (COD)"
          value={codCount}
          subtitle={`${((codCount / (validOrders.length || 1)) * 100).toFixed(0)}% COD payment share`}
          icon={Award}
          color="amber"
        />
      </div>

      {/* Product Popularity Breakdown Table */}
      <div className="bg-[#131B2B] border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-800 font-bold text-xs text-white flex items-center justify-between">
          <span>Top Performing Dishes ({period.toUpperCase()})</span>
          <span className="text-slate-400 font-normal">{topItems.length} unique items sold</span>
        </div>

        {loading ? (
          <div className="p-5">
            <TableSkeleton rows={6} cols={4} />
          </div>
        ) : topItems.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">No sales recorded for this period.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#0E1524] text-slate-400 font-bold border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Rank</th>
                  <th className="py-3 px-4">Dish Name</th>
                  <th className="py-3 px-4">Units Sold</th>
                  <th className="py-3 px-4">Total Revenue Generated</th>
                  <th className="py-3 px-4 text-right">Avg Item Price</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {topItems.slice(0, 15).map((item, idx) => (
                  <tr key={item.name} className="hover:bg-slate-800/40">
                    <td className="py-3 px-4 font-mono font-bold text-slate-400">#{idx + 1}</td>
                    <td className="py-3 px-4 font-bold text-white">{item.name}</td>
                    <td className="py-3 px-4 font-mono text-orange-400 font-bold">{item.quantity} units</td>
                    <td className="py-3 px-4 font-mono text-emerald-400 font-bold">
                      ₹{item.revenue.toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-300">
                      ₹{Math.round(item.revenue / item.quantity)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
