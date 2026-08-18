import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, limit, getDocs } from 'firebase/firestore';
import { TableSkeleton } from '../components/ui/Skeleton';
import { ErrorState } from '../components/ui/ErrorState';
import { EmptyState } from '../components/ui/EmptyState';
import { Users, Search, Phone, Mail, MapPin, IndianRupee } from 'lucide-react';

interface CustomerRecord {
  id: string;
  name?: string;
  email?: string;
  phone?: string;
  totalOrders?: number;
  totalSpent?: number;
  address?: string;
  createdAt?: any;
}

export default function Customers() {
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchCustomers = async () => {
      setLoading(true);
      try {
        const snap = await getDocs(query(collection(db, 'users'), limit(300)));
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as CustomerRecord[];
        setCustomers(list);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchCustomers();
  }, []);

  const filtered = customers.filter((c) => {
    const q = searchQuery.toLowerCase();
    return (
      c.name?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q) ||
      c.phone?.includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-white">Customer CRM Directory</h2>
          <p className="text-xs text-slate-400">View customer profiles, verified contact details, and lifetime order frequency.</p>
        </div>
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
      </div>

      {error && <ErrorState message={error} onRetry={() => window.location.reload()} />}

      {/* Table */}
      <div className="bg-[#131B2B] border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-5">
            <TableSkeleton rows={8} cols={4} />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState title="No customer profiles found" message="Registered customers will appear in this directory." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#0E1524] text-slate-400 font-bold border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Customer Name</th>
                  <th className="py-3 px-4">Phone Number</th>
                  <th className="py-3 px-4">Email Address</th>
                  <th className="py-3 px-4 text-right">User ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-800/40">
                    <td className="py-3 px-4 font-bold text-white flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-slate-800 text-orange-400 flex items-center justify-center font-bold text-[10px]">
                        {c.name ? c.name[0].toUpperCase() : 'U'}
                      </div>
                      {c.name || 'Olive Customer'}
                    </td>
                    <td className="py-3 px-4 text-slate-300 font-mono">
                      {c.phone || 'Not verified'}
                    </td>
                    <td className="py-3 px-4 text-slate-400">
                      {c.email || 'No email attached'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-500 text-[10px]">
                      {c.id.slice(0, 10)}...
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
