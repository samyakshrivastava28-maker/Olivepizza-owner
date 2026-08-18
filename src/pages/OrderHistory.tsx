import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { Order } from '../types/models';
import { TableSkeleton } from '../components/ui/Skeleton';
import { ErrorState } from '../components/ui/ErrorState';
import { EmptyState } from '../components/ui/EmptyState';
import { Modal } from '../components/ui/Modal';
import {
  Search,
  Calendar,
  Download,
  Printer,
  FileText,
  IndianRupee,
  Filter,
} from 'lucide-react';

export default function OrderHistory() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [selectedInvoice, setSelectedInvoice] = useState<Order | null>(null);

  useEffect(() => {
    const fetchHistory = async () => {
      setLoading(true);
      try {
        const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'), limit(300));
        const snapshot = await getDocs(q);
        const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as Order[];
        setOrders(list);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, []);

  const filteredOrders = orders.filter((o) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      o.customerName?.toLowerCase().includes(q) ||
      o.customerPhone?.includes(q) ||
      (o.dailyOrderNumber && String(o.dailyOrderNumber).includes(q)) ||
      o.id.toLowerCase().includes(q);

    const s = (o.status || '').toLowerCase();
    const p = (o.paymentMethod || '').toLowerCase();

    const matchesStatus = statusFilter === 'all' || s === statusFilter;
    const matchesPayment = paymentFilter === 'all' || p === paymentFilter;

    return matchesSearch && matchesStatus && matchesPayment;
  });

  const totalFilteredAmount = filteredOrders.reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);

  return (
    <div className="space-y-6">
      {/* Invoice Modal */}
      {selectedInvoice && (
        <Modal
          isOpen={!!selectedInvoice}
          onClose={() => setSelectedInvoice(null)}
          title={`Tax Invoice — Order #${selectedInvoice.dailyOrderNumber || selectedInvoice.id.slice(0, 6)}`}
          maxWidth="max-w-lg"
        >
          <div className="space-y-4 text-xs font-sans p-2 bg-white text-slate-900 rounded-xl">
            <div className="text-center border-b border-slate-200 pb-3">
              <h2 className="text-base font-black uppercase tracking-wider">OLIVE PIZZA</h2>
              <p className="text-[11px] text-slate-500">Dongargaon Rd, Rajnandgaon, CG 491441</p>
              <p className="text-[11px] text-slate-500">GSTIN: 22AAAAA0000A1Z5 • FSSAI: 10019000000000</p>
            </div>

            <div className="flex justify-between text-[11px] text-slate-600">
              <div>
                <p><strong>Customer:</strong> {selectedInvoice.customerName}</p>
                <p><strong>Phone:</strong> {selectedInvoice.customerPhone}</p>
              </div>
              <div className="text-right">
                <p><strong>Invoice #:</strong> {selectedInvoice.dailyOrderNumber || selectedInvoice.id.slice(0, 6)}</p>
                <p><strong>Date:</strong> {new Date().toLocaleDateString()}</p>
              </div>
            </div>

            <table className="w-full text-left border-t border-b border-slate-200 py-2">
              <thead>
                <tr className="border-b border-slate-200 text-slate-700">
                  <th className="py-1">Item</th>
                  <th className="py-1 text-center">Qty</th>
                  <th className="py-1 text-right">Price</th>
                  <th className="py-1 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {selectedInvoice.items?.map((it, idx) => (
                  <tr key={idx}>
                    <td className="py-1 font-medium">{it.name}</td>
                    <td className="py-1 text-center">{it.quantity}</td>
                    <td className="py-1 text-right font-mono">₹{it.price}</td>
                    <td className="py-1 text-right font-mono font-bold">₹{it.price * it.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="space-y-1 text-right text-xs pt-1">
              <div className="flex justify-between">
                <span className="text-slate-600">Subtotal:</span>
                <span className="font-mono">₹{selectedInvoice.totalAmount}</span>
              </div>
              <div className="flex justify-between text-sm font-black border-t border-slate-300 pt-1 text-slate-900">
                <span>Grand Total:</span>
                <span className="font-mono">₹{selectedInvoice.totalAmount}</span>
              </div>
              <p className="text-[10px] text-slate-500 text-left pt-2 italic">
                Thank you for choosing Olive Pizza! Enjoy your hot meal.
              </p>
            </div>

            <div className="pt-3 flex gap-2">
              <button
                onClick={() => window.print()}
                className="flex-1 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg flex items-center justify-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                Print Receipt
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-white">Order History</h2>
          <p className="text-xs text-slate-400">Searchable repository of past orders and customer invoices.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="px-4 py-2 bg-[#131B2B] border border-slate-800 rounded-xl text-xs font-bold text-white flex items-center gap-2">
            <span className="text-slate-400">Filtered Total:</span>
            <span className="text-emerald-400 font-mono">₹{totalFilteredAmount.toLocaleString('en-IN')}</span>
          </div>
        </div>
      </div>

      {error && <ErrorState message={error} onRetry={() => window.location.reload()} />}

      {/* Filters Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-4 gap-3 bg-[#131B2B] border border-slate-800 p-3.5 rounded-2xl">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search orders..."
            className="w-full pl-9 pr-3 py-1.5 bg-[#0E1524] border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
          />
        </div>

        <div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-3 py-1.5 bg-[#0E1524] border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-orange-500"
          >
            <option value="all">All Statuses</option>
            <option value="delivered">Delivered</option>
            <option value="cancelled">Cancelled</option>
            <option value="preparing">Preparing</option>
            <option value="pending">Pending</option>
          </select>
        </div>

        <div>
          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
            className="w-full px-3 py-1.5 bg-[#0E1524] border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-orange-500"
          >
            <option value="all">All Payments</option>
            <option value="cod">Cash on Delivery (COD)</option>
            <option value="online">Online / UPI</option>
          </select>
        </div>

        <div className="text-right flex items-center justify-end sm:col-span-3 md:col-span-1">
          <span className="text-xs font-bold text-slate-400">{filteredOrders.length} Orders Found</span>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-[#131B2B] border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-5">
            <TableSkeleton rows={8} cols={6} />
          </div>
        ) : filteredOrders.length === 0 ? (
          <EmptyState title="No historical orders found" message="Try modifying your search query or filter criteria." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#0E1524] text-slate-400 font-bold border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Order #</th>
                  <th className="py-3 px-4">Date & Time</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Items</th>
                  <th className="py-3 px-4">Payment</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Invoice</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {filteredOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-white">
                      #{order.dailyOrderNumber || order.id.slice(0, 6)}
                    </td>
                    <td className="py-3 px-4 text-slate-400">
                      {order.createdAt ? new Date(parseOrderTime(order)).toLocaleString() : 'N/A'}
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-bold text-slate-200">{order.customerName}</p>
                      <p className="text-[10px] text-slate-400">{order.customerPhone}</p>
                    </td>
                    <td className="py-3 px-4 text-slate-300 max-w-xs truncate">
                      {order.items?.map((it) => `${it.quantity}x ${it.name}`).join(', ') || 'No items'}
                    </td>
                    <td className="py-3 px-4 uppercase text-[10px] font-bold text-slate-300">
                      {order.paymentMethod}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-emerald-400">
                      ₹{order.totalAmount}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          (order.status || '').toLowerCase() === 'delivered'
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : (order.status || '').toLowerCase() === 'cancelled'
                            ? 'bg-red-500/10 text-red-400'
                            : 'bg-orange-500/10 text-orange-400'
                        }`}
                      >
                        {order.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => setSelectedInvoice(order)}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-lg text-[11px] inline-flex items-center gap-1.5 transition-colors"
                      >
                        <FileText className="w-3.5 h-3.5 text-orange-400" />
                        Receipt
                      </button>
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

function parseOrderTime(o: Order): number {
  if (!o.createdAt) return 0;
  if (typeof (o.createdAt as any)?.toMillis === 'function') return (o.createdAt as any).toMillis();
  if (typeof (o.createdAt as any)?.toDate === 'function') return (o.createdAt as any).toDate().getTime();
  if (typeof (o.createdAt as any)?.seconds === 'number') return (o.createdAt as any).seconds * 1000;
  const p = new Date(o.createdAt).getTime();
  return isNaN(p) ? 0 : p;
}
