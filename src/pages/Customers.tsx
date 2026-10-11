import React, { useState, useEffect, useCallback } from 'react';
import { fetchApi } from '../lib/api';
import { TableSkeleton } from '../components/ui/Skeleton';
import { ErrorState } from '../components/ui/ErrorState';
import { EmptyState } from '../components/ui/EmptyState';
import { Users, Search, Phone, Mail, MapPin, IndianRupee, Database, RefreshCw } from 'lucide-react';

interface CustomerRecord {
  id: string;
  name?: string;
  email?: string;
  phone?: string;
  totalOrders?: number;
  totalSpent?: number;
  defaultAddress?: any;
  createdAt?: any;
  updatedAt?: any;
}

export default function Customers() {
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchCustomers = useCallback(async (queryParam = '', isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);

    try {
      const endpoint = queryParam 
        ? `/api/dashboard/customers?q=${encodeURIComponent(queryParam)}` 
        : '/api/dashboard/customers';
      const res = await fetchApi(endpoint);
      if (!res.ok) {
        throw new Error(`Failed to load customers from PostgreSQL: HTTP ${res.status}`);
      }
      const data = await res.json();
      if (Array.isArray(data.customers)) {
        setCustomers(data.customers);
      }
      setError(null);
    } catch (err: any) {
      console.error('[Customers] PostgreSQL fetch failed:', err);
      setError(err.message || 'Failed to load customers');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  // Debounced search
  useEffect(() => {
    const handler = setTimeout(() => {
      fetchCustomers(searchQuery);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery, fetchCustomers]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-black text-white">Customer CRM Directory</h2>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Database className="w-2.5 h-2.5" />
              Render PostgreSQL
            </span>
          </div>
          <p className="text-xs text-slate-400">View customer profiles, lifetime order spend, and verified contact records from PostgreSQL.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, phone, email..."
              className="w-full pl-10 pr-3 py-1.5 bg-[#131B2B] border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none"
            />
          </div>
          <button
            onClick={() => fetchCustomers(searchQuery, true)}
            disabled={refreshing}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors disabled:opacity-50"
            title="Refresh customers"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-orange-400' : ''}`} />
          </button>
        </div>
      </div>

      {error && <ErrorState message={error} onRetry={() => fetchCustomers(searchQuery, true)} />}

      {/* Table */}
      <div className="bg-[#131B2B] border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-5">
            <TableSkeleton rows={8} cols={5} />
          </div>
        ) : customers.length === 0 ? (
          <EmptyState title="No customer profiles found" message="Registered customers and order history will appear in this directory." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#0E1524] text-slate-400 font-bold border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Customer Name</th>
                  <th className="py-3 px-4">Phone Number</th>
                  <th className="py-3 px-4">Email Address</th>
                  <th className="py-3 px-4 text-center">Orders</th>
                  <th className="py-3 px-4 text-right">Lifetime Spend</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {customers.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-800/40">
                    <td className="py-3 px-4 font-bold text-white flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-slate-800 text-orange-400 flex items-center justify-center font-bold text-[10px]">
                        {c.name ? c.name[0].toUpperCase() : 'U'}
                      </div>
                      <span>{c.name || 'Olive Customer'}</span>
                    </td>
                    <td className="py-3 px-4 text-slate-300">
                      <div className="flex items-center gap-1.5">
                        <Phone className="w-3 h-3 text-slate-500" />
                        <span>{c.phone || 'N/A'}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-400">
                      <div className="flex items-center gap-1.5">
                        <Mail className="w-3 h-3 text-slate-500" />
                        <span>{c.email || 'N/A'}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center font-mono text-slate-200">
                      {c.totalOrders || 0}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400">
                      ₹{Number(c.totalSpent || 0).toLocaleString('en-IN')}
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
