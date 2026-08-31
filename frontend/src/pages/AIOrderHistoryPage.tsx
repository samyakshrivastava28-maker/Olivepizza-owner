import React, { useState, useEffect } from 'react';
import {
  Search,
  Sparkles,
  Filter,
  Calendar,
  CreditCard,
  Store,
  CheckCircle2,
  Clock,
  XCircle,
  RefreshCw,
  ShoppingBag,
  Database,
  X
} from 'lucide-react';
import toast from 'react-hot-toast';

interface VerifiedOrder {
  orderId: string;
  customerName: string;
  customerPhone?: string;
  branchName: string;
  branchId: string;
  franchiseName: string;
  franchiseId: string;
  orderDate: string;
  orderTimestamp?: number;
  status: string;
  paymentMethod: string;
  totalAmount: number;
  subtotal?: number;
  discount?: number;
  gst?: number;
  items: Array<{
    name: string;
    quantity: number;
    size?: string;
    crust?: string;
    customizations?: string[];
    price?: number;
  }>;
  orderNotes?: string;
  source: 'verified_archive' | 'zilliz_index';
}

interface SearchResponseData {
  query: string;
  parsedFilters: Record<string, any>;
  aiSummary: string;
  totalMatches: number;
  results: VerifiedOrder[];
  searchMode: string;
  latencyMs: number;
}

export default function AIOrderHistoryPage() {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [resultsData, setResultsData] = useState<SearchResponseData | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<VerifiedOrder | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [dbStatus, setDbStatus] = useState<{ connected: boolean; dimension: number; mode: string; indexedCount: number } | null>(null);

  const [statusFilter, setStatusFilter] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');

  const quickChips = [
    'Find order OP-10482',
    'Show Civil Lines Farmhouse orders with extra cheese',
    'Delivered UPI orders around ₹850',
    'Cancelled orders last month',
    'Station Road Durg Cash orders'
  ];

  useEffect(() => {
    fetchStatus();
    executeSearch('Show recent orders');
  }, []);

  const fetchStatus = async () => {
    try {
      const token = localStorage.getItem('token') || '';
      const res = await fetch('/api/owner/order-history/status', {
        headers: { Authorization: 'Bearer ' + token }
      });
      const data = await res.json();
      if (data.success) {
        setDbStatus(data.data);
      }
    } catch (e) {
      console.warn('Status fetch error:', e);
    }
  };

  const executeSearch = async (searchQuery?: string) => {
    const q = searchQuery !== undefined ? searchQuery : query;
    setIsLoading(true);

    try {
      const token = localStorage.getItem('token') || '';
      const filtersPayload: Record<string, any> = {};
      if (statusFilter) filtersPayload.status = statusFilter;
      if (paymentFilter) filtersPayload.paymentMethod = paymentFilter;
      if (branchFilter) filtersPayload.branchId = branchFilter;
      if (minAmount) filtersPayload.minAmount = Number(minAmount);
      if (maxAmount) filtersPayload.maxAmount = Number(maxAmount);

      const res = await fetch('/api/owner/order-history/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token
        },
        body: JSON.stringify({
          query: q,
          filters: Object.keys(filtersPayload).length > 0 ? filtersPayload : undefined
        })
      });

      const json = await res.json();
      if (json.success && json.data) {
        setResultsData(json.data);
      } else {
        toast.error(json.error || 'Failed to search order history');
      }
    } catch (err: any) {
      toast.error('Search request failed: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChipClick = (chipText: string) => {
    setQuery(chipText);
    executeSearch(chipText);
  };

  const clearFilters = () => {
    setStatusFilter('');
    setPaymentFilter('');
    setBranchFilter('');
    setMinAmount('');
    setMaxAmount('');
    executeSearch(query);
  };

  const getStatusBadge = (status: string) => {
    const s = status.toLowerCase();
    if (s === 'delivered') {
      return (
        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <CheckCircle2 className="w-3.5 h-3.5" /> Delivered
        </span>
      );
    }
    if (s === 'cancelled' || s === 'canceled') {
      return (
        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20">
          <XCircle className="w-3.5 h-3.5" /> Cancelled
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
        <Clock className="w-3.5 h-3.5" /> {status.toUpperCase()}
      </span>
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-6 bg-gradient-to-r from-[#0E1524] via-[#141E33] to-[#0E1524] rounded-2xl border border-slate-800 shadow-xl">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-orange-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <h1 className="text-xl md:text-2xl font-black text-white tracking-tight">AI Order History Search</h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-orange-500/20 text-orange-400 border border-orange-500/30 uppercase tracking-wider">
              Zilliz + NVIDIA
            </span>
          </div>
          <p className="text-xs md:text-sm text-slate-400">
            Semantic vector retrieval across all-time archived orders with verified record hydration.
          </p>
        </div>

        {/* Vector DB Health Pill */}
        <div className="flex items-center gap-3 bg-[#0B0F17]/80 px-4 py-2 rounded-xl border border-slate-800 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-slate-300 font-medium">Vector Index</span>
          </div>
          <span className="text-slate-600">|</span>
          <span className="text-orange-400 font-bold">2048-dim</span>
          <span className="text-slate-600">|</span>
          <span className="text-slate-400">
            {dbStatus ? dbStatus.indexedCount + ' Orders' : 'Online'}
          </span>
        </div>
      </div>

      {/* Search Bar & Quick Chips */}
      <div className="bg-[#0E1524] p-5 rounded-2xl border border-slate-800 shadow-xl space-y-4">
        <div className="relative flex items-center">
          <div className="absolute left-4 text-slate-400">
            <Search className="w-5 h-5 text-orange-400" />
          </div>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && executeSearch()}
            placeholder="Search all-time orders (e.g. 'Show July orders from Civil Lines with Farmhouse and UPI')..."
            className="w-full pl-12 pr-32 py-3.5 bg-[#0B0F17] border border-slate-700/80 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all font-medium"
          />
          <div className="absolute right-2 flex items-center gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={'px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ' +
                (showFilters || statusFilter || paymentFilter || branchFilter
                  ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200')}
            >
              <Filter className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Filters</span>
            </button>
            <button
              onClick={() => executeSearch()}
              disabled={isLoading}
              className="px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-lg text-xs font-bold transition-all shadow-md shadow-orange-500/20 flex items-center gap-1.5 disabled:opacity-50"
            >
              {isLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              <span>Search</span>
            </button>
          </div>
        </div>

        {/* Quick Suggestion Chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none text-xs">
          <span className="text-slate-500 font-semibold text-[11px] shrink-0">Try:</span>
          {quickChips.map((chip, idx) => (
            <button
              key={idx}
              onClick={() => handleChipClick(chip)}
              className="shrink-0 px-3 py-1.5 rounded-lg bg-[#0B0F17] border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white transition-all text-xs font-medium"
            >
              {chip}
            </button>
          ))}
        </div>

        {/* Structured Filters Drawer */}
        {showFilters && (
          <div className="pt-4 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 bg-[#0B0F17] border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-orange-500"
              >
                <option value="">All Statuses</option>
                <option value="delivered">Delivered</option>
                <option value="preparing">Preparing</option>
                <option value="ready">Ready</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Payment Method</label>
              <select
                value={paymentFilter}
                onChange={(e) => setPaymentFilter(e.target.value)}
                className="w-full px-3 py-2 bg-[#0B0F17] border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-orange-500"
              >
                <option value="">All Methods</option>
                <option value="UPI">UPI</option>
                <option value="Cash">Cash / COD</option>
                <option value="Card">Card</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Min Amount (₹)</label>
              <input
                type="number"
                value={minAmount}
                onChange={(e) => setMinAmount(e.target.value)}
                placeholder="e.g. 500"
                className="w-full px-3 py-2 bg-[#0B0F17] border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-orange-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Max Amount (₹)</label>
              <input
                type="number"
                value={maxAmount}
                onChange={(e) => setMaxAmount(e.target.value)}
                placeholder="e.g. 1500"
                className="w-full px-3 py-2 bg-[#0B0F17] border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-orange-500"
              />
            </div>

            <div className="flex items-end">
              <button
                onClick={clearFilters}
                className="w-full px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5"
              >
                <X className="w-3.5 h-3.5" /> Clear Filters
              </button>
            </div>
          </div>
        )}
      </div>

      {/* AI Conversational Summary Card */}
      {resultsData && (
        <div className="bg-[#0E1524] p-5 rounded-2xl border border-orange-500/20 bg-gradient-to-r from-orange-500/5 via-[#0E1524] to-[#0E1524] shadow-xl space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-extrabold text-orange-400 uppercase tracking-wider">
              <Sparkles className="w-4 h-4 text-orange-400" />
              <span>AI Intelligence Summary</span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-slate-400">
              <span className="px-2 py-0.5 rounded bg-slate-800/80 font-mono text-slate-300">
                Mode: {resultsData.searchMode}
              </span>
              <span className="px-2 py-0.5 rounded bg-slate-800/80 font-mono text-slate-300">
                ⚡ {resultsData.latencyMs}ms
              </span>
            </div>
          </div>
          <p className="text-sm font-medium text-slate-200 leading-relaxed">
            {resultsData.aiSummary}
          </p>
        </div>
      )}

      {/* Results Header & Counter */}
      <div className="flex items-center justify-between px-1">
        <h2 className="text-sm font-bold text-slate-300 flex items-center gap-2">
          <Database className="w-4 h-4 text-orange-400" />
          <span>Matching Verified Orders</span>
          <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 text-xs font-extrabold">
            {resultsData ? resultsData.totalMatches : 0}
          </span>
        </h2>
      </div>

      {/* Results Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {resultsData && resultsData.results.map((order) => (
          <div
            key={order.orderId}
            onClick={() => setSelectedOrder(order)}
            className="group cursor-pointer bg-[#0E1524] hover:bg-[#131C30] p-5 rounded-2xl border border-slate-800 hover:border-orange-500/40 transition-all duration-200 shadow-lg hover:shadow-orange-500/5 flex flex-col justify-between space-y-4"
          >
            <div>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-black text-white group-hover:text-orange-400 transition-colors">
                      #{order.orderId}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                      {order.source === 'verified_archive' ? 'Verified Archive' : 'Vector Index'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-1.5">
                    <Store className="w-3.5 h-3.5 text-slate-500" />
                    <span>{order.branchName}</span>
                    <span className="text-slate-600">•</span>
                    <span>{order.franchiseName}</span>
                  </div>
                </div>
                {getStatusBadge(order.status)}
              </div>

              <div className="bg-[#0B0F17]/70 p-3 rounded-xl border border-slate-800/80 my-3 space-y-1.5">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 mb-1">
                  <ShoppingBag className="w-3 h-3 text-orange-400" /> Order Items
                </div>
                {order.items && order.items.length > 0 ? (
                  order.items.map((item, i) => (
                    <div key={i} className="text-xs text-slate-200 flex items-center justify-between">
                      <span className="font-medium truncate max-w-[80%]">
                        <span className="text-orange-400 font-bold">{item.quantity}x </span>
                        {item.name} {item.size && '[' + item.size + ']'} {item.crust && '(' + item.crust + ')'}
                      </span>
                      {typeof item.price === 'number' && (
                        <span className="text-slate-400 text-[11px] font-mono">₹{item.price}</span>
                      )}
                    </div>
                  ))
                ) : (
                  <span className="text-xs text-slate-400">Standard Pizza Selection</span>
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
              <div className="space-y-0.5">
                <div className="text-slate-400">
                  Customer: <span className="text-slate-200 font-semibold">{order.customerName}</span>
                </div>
                <div className="text-slate-500 text-[11px] flex items-center gap-2">
                  <Calendar className="w-3 h-3" /> {order.orderDate}
                  <span>•</span>
                  <CreditCard className="w-3 h-3" /> {order.paymentMethod}
                </div>
              </div>

              <div className="text-right">
                <div className="text-xs text-slate-400 font-medium">Total Amount</div>
                <div className="text-base font-black text-white flex items-center justify-end text-orange-400">
                  ₹{order.totalAmount}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {resultsData && resultsData.results.length === 0 && (
        <div className="bg-[#0E1524] p-12 rounded-2xl border border-slate-800 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 mx-auto">
            <Search className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-white">No Matching Orders Found</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Try adjusting your query, relaxing filters, or searching by exact Order ID (e.g. #OP-10482).
          </p>
        </div>
      )}

      {/* Detailed Order Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="relative w-full max-w-lg bg-[#0E1524] border border-slate-700 rounded-2xl shadow-2xl p-6 space-y-5 overflow-y-auto max-h-[90vh]">
            <div className="flex items-start justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                  Order Details #{selectedOrder.orderId}
                </h3>
                <p className="text-xs text-slate-400">
                  {selectedOrder.branchName} • {selectedOrder.franchiseName}
                </p>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 bg-[#0B0F17] rounded-xl border border-slate-800">
                <div>
                  <span className="text-slate-500 font-bold uppercase text-[10px]">Customer</span>
                  <p className="text-slate-200 font-semibold">{selectedOrder.customerName}</p>
                  {selectedOrder.customerPhone && <p className="text-slate-400">{selectedOrder.customerPhone}</p>}
                </div>
                <div>
                  <span className="text-slate-500 font-bold uppercase text-[10px]">Status</span>
                  <div className="mt-1">{getStatusBadge(selectedOrder.status)}</div>
                </div>
                <div>
                  <span className="text-slate-500 font-bold uppercase text-[10px]">Date</span>
                  <p className="text-slate-200 font-semibold">{selectedOrder.orderDate}</p>
                </div>
                <div>
                  <span className="text-slate-500 font-bold uppercase text-[10px]">Payment Method</span>
                  <p className="text-slate-200 font-semibold">{selectedOrder.paymentMethod}</p>
                </div>
              </div>

              <div>
                <span className="text-slate-400 font-bold uppercase text-[10px] block mb-2">Itemized Breakdown</span>
                <div className="space-y-2 p-3 bg-[#0B0F17] rounded-xl border border-slate-800">
                  {selectedOrder.items.map((item, i) => (
                    <div key={i} className="flex justify-between items-start text-slate-200">
                      <div>
                        <span className="font-bold text-orange-400">{item.quantity}x </span>
                        <span>{item.name}</span>
                        {item.customizations && item.customizations.length > 0 && (
                          <p className="text-[11px] text-slate-400 pl-4">+ {item.customizations.join(', ')}</p>
                        )}
                      </div>
                      {typeof item.price === 'number' && (
                        <span className="font-mono text-slate-300">₹{item.price}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {selectedOrder.orderNotes && (
                <div className="p-3 bg-[#0B0F17] rounded-xl border border-slate-800">
                  <span className="text-slate-500 font-bold uppercase text-[10px] block mb-1">Customer Instructions</span>
                  <p className="text-slate-300 italic">{selectedOrder.orderNotes}</p>
                </div>
              )}

              <div className="p-3 bg-gradient-to-r from-orange-500/10 to-amber-500/10 rounded-xl border border-orange-500/30 flex justify-between items-center text-sm font-bold">
                <span className="text-slate-200">Total Charged</span>
                <span className="text-orange-400 text-lg font-black font-mono">₹{selectedOrder.totalAmount}</span>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={() => setSelectedOrder(null)}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all"
              >
                Close Order View
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
