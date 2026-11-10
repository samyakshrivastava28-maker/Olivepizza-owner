import { useState, useEffect } from 'react';
import { db, auth } from '../../lib/firebase';
import { collection, query, orderBy, limit, onSnapshot, doc } from 'firebase/firestore';
import { logActivity } from '../../lib/logger';
import { useAuthStore } from '../../lib/store';
import { useNotificationDebugger } from '../../hooks/useNotificationDebugger';
import { useNavigate } from 'react-router';
import { fetchApi } from '../../lib/config';

export default function LiveOrdersTable() {
  const [orders, setOrders] = useState<any[]>([]);
  const { user } = useAuthStore();
  const [processingId, setProcessingId] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'), limit(15));
    const unsubscribe = onSnapshot(q, (snap) => {
      setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsubscribe();
  }, []);

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    if (processingId === orderId) return;
    setProcessingId(orderId);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) return;

      const isDebug = useNotificationDebugger.getState().isDebugMode;
      if (isDebug) useNotificationDebugger.getState().startTrace('POST /api/notifications/action', newStatus, orderId);

      const res = await fetchApi('/api/notifications/action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          ...(isDebug ? { 'X-Debug-Mode': 'true' } : {})
        },
        body: JSON.stringify({ orderId, action: newStatus })
      });
      const data = await res.json();
      if (isDebug && data.trace) useNotificationDebugger.getState().updateTrace(data.trace);
      
      if (!res.ok) throw new Error(data.error);

      await logActivity('Order Status Changed', `Order #${orderId.slice(-6).toUpperCase()} changed to ${newStatus}`, user?.email || undefined);
    } catch (e: any) {
      console.error(e);
      alert('Failed to update status: ' + e.message);
    } finally {
      setProcessingId(null);
    }
  };

  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    accepted: 'bg-blue-100 text-blue-800 border-blue-200',
    preparing: 'bg-purple-100 text-purple-800 border-purple-200',
    ready: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    partner_assigned: 'bg-cyan-100 text-cyan-800 border-cyan-200',
    picked_up: 'bg-teal-100 text-teal-800 border-teal-200',
    out_for_delivery: 'bg-orange-100 text-orange-800 border-orange-200',
    delivered: 'bg-green-100 text-green-800 border-green-200',
    cancelled: 'bg-red-100 text-red-800 border-red-200',
  };

  return (
    <div className="glass-card p-6 overflow-hidden flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-black text-slate-800 dark:text-slate-100">Live Orders Control Center</h3>
      </div>
      
      <div className="overflow-x-auto flex-1">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-900 border-y border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 text-sm font-bold uppercase tracking-wider">
              <th className="p-4">Order ID</th>
              <th className="p-4">Customer</th>
              <th className="p-4">Amount</th>
              <th className="p-4">Time</th>
              <th className="p-4">Status</th>
              <th className="p-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-slate-500 font-medium">No live orders.</td>
              </tr>
            ) : (
              orders.map(order => (
                <tr key={order.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="p-4 whitespace-nowrap">
                    <div className="font-bold text-slate-800 dark:text-slate-200">
                      {order.dailyOrderNumber || `#${order.id.slice(-6).toUpperCase()}`}
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                      {order.id}
                    </div>
                  </td>
                  <td className="p-4 text-slate-800 dark:text-slate-200 font-medium">
                    {order.customerInfo?.name || 'Guest'}
                  </td>
                  <td className="p-4 font-bold text-primary-600">
                    ₹{order.totalAmount?.toFixed(2)}
                  </td>
                  <td className="p-4 text-sm text-slate-500">
                    {order.createdAt ? (order.createdAt.toDate ? order.createdAt.toDate() : new Date(order.createdAt)).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}) : 'Just now'}
                  </td>
                  <td className="p-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold border ${statusColors[order.status] || 'bg-slate-100 text-slate-800'}`}>
                      {order.status.replace(/_/g, ' ').toUpperCase()}
                    </span>
                  </td>
                  <td className="p-4 text-right flex gap-2 justify-end">
                    <select 
                      value={order.status}
                      disabled={processingId === order.id}
                      onChange={(e) => handleStatusChange(order.id, e.target.value)}
                      className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block w-full p-2 disabled:opacity-50"
                    >
                      <option value="pending">Pending</option>
                      <option value="accepted">Accepted</option>
                      <option value="preparing">Preparing (Cooking)</option>
                      <option value="ready">Ready (Wait for Assign)</option>
                      <option value="partner_assigned">Partner Assigned</option>
                      <option value="picked_up">Picked Up (Navigating)</option>
                      <option value="out_for_delivery">Out for Delivery (On the way)</option>
                      <option value="delivered">Delivered</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                    <button
                      onClick={() => navigate(`/order-tracking/${order.id}`)}
                      className="bg-primary-500 hover:bg-primary-600 text-white font-bold py-2 px-4 rounded-lg text-sm whitespace-nowrap shadow-sm transition-colors"
                    >
                      Track Live
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
