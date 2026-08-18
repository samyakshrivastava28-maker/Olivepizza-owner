import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import {
  collection,
  query,
  orderBy,
  where,
  limit,
  getDocs,
  startAfter,
  QueryConstraint,
  DocumentData,
  QueryDocumentSnapshot,
  deleteDoc,
  doc,
} from 'firebase/firestore';
import { Order } from '../types/models';
import toast from 'react-hot-toast';

type DateFilter =
  | "today"
  | "yesterday"
  | "last7"
  | "last30"
  | "currentMonth"
  | "prevMonth"
  | "custom";

interface ExtendedOrder extends Order {
  customerName?: string;
  paymentMethod?: string;
  couponCode?: string;
}

export default function OwnerOrderHistory() {
  const [orders, setOrders] = useState<ExtendedOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastDoc, setLastDoc] =
    useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(true);

  // Filters
  const [dateFilter, setDateFilter] = useState<DateFilter>("last30");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  // Modal
  const [selectedOrder, setSelectedOrder] = useState<ExtendedOrder | null>(
    null,
  );

  const fetchOrders = async (isLoadMore = false) => {
    if (isLoadMore) {
      setLoadingMore(true);
    } else {
      setLoading(true);
      setOrders([]);
      setLastDoc(null);
      setHasMore(true);
    }

    try {
      const constraints: QueryConstraint[] = [];

      // Apply Date Filters
      const now = new Date();
      let start: Date | null = null;
      let end: Date | null = null;

      if (dateFilter === "today") {
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        end = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
          23,
          59,
          59,
          999,
        );
      } else if (dateFilter === "yesterday") {
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        end = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate() - 1,
          23,
          59,
          59,
          999,
        );
      } else if (dateFilter === "last7") {
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
        end = now;
      } else if (dateFilter === "last30") {
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
        end = now;
      } else if (dateFilter === "currentMonth") {
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(
          now.getFullYear(),
          now.getMonth() + 1,
          0,
          23,
          59,
          59,
          999,
        );
      } else if (dateFilter === "prevMonth") {
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      } else if (dateFilter === "custom" && customStartDate && customEndDate) {
        start = new Date(customStartDate);
        end = new Date(customEndDate);
        end.setHours(23, 59, 59, 999);
      }

      if (start && end) {
        constraints.push(where("createdAt", ">=", start.toISOString()));
        constraints.push(where("createdAt", "<=", end.toISOString()));
      }

      // We always order by createdAt desc
      constraints.push(orderBy("createdAt", "desc"));

      if (isLoadMore && lastDoc) {
        constraints.push(startAfter(lastDoc));
      }

      constraints.push(limit(25));

      const q = query(collection(db, "orders"), ...constraints);
      const snapshot = await getDocs(q);

      const fetchedOrders = snapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() }) as ExtendedOrder,
      );

      // Client-side search filter (Firestore does not support flexible substring search)
      // Note: Because of this limit(25), if search is applied, we might see fewer than 25 items.
      const filtered = searchTerm
        ? fetchedOrders.filter(
            (o) =>
              o.id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
              o.dailyOrderNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
              o.customerInfo?.name
                ?.toLowerCase()
                .includes(searchTerm.toLowerCase()) ||
              o.contactPhone?.includes(searchTerm) ||
              o.deliveryPartnerId?.includes(searchTerm),
          )
        : fetchedOrders;

      if (isLoadMore) {
        setOrders((prev) => [...prev, ...filtered]);
      } else {
        setOrders(filtered);
      }

      if (snapshot.docs.length < 25) {
        setHasMore(false);
      } else {
        setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
      }
    } catch (error) {
      console.error("Failed to fetch order history:", error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };


  useEffect(() => {
    fetchOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFilter, customStartDate, customEndDate]);

  // Handle Search on Enter or Button Click (to prevent excessive reads while typing)
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchOrders();
  };

  // Analytics Strip Calcs
  const totalOrders = orders.length;
  const totalRevenue = orders.reduce(
    (sum, o) => sum + (o.status !== "cancelled" ? o.totalAmount : 0),
    0,
  );
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
  const deliveredCount = orders.filter((o) => o.status === "delivered").length;
  const cancelledCount = orders.filter((o) => o.status === "cancelled").length;

  // Exports
  const getExportData = () => {
    return orders.map((o) => ({
      OrderID: o.id,
      Date: new Date(o.createdAt).toLocaleString(),
      CustomerName: o.customerName || "Unknown",
      Phone: o.contactPhone,
      Status: o.status,
      TotalAmount: o.totalAmount,
      Items: o.items.map((i) => `${i.quantity}x ${i.name}`).join(", "),
      DeliveryPartner: o.deliveryPartnerId || "None",
      PaymentMethod: o.paymentMethod || "cash_on_delivery",
    }));
  };

  const exportCSV = async () => {
    try {
      const { default: Papa } = await import('papaparse');
      const csv = Papa.unparse(getExportData());
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `orders_export_${new Date().toISOString().split("T")[0]}.csv`;
      link.click();
    } catch (error) {
      toast.error("Failed to generate CSV export");
    }
  };

  const exportExcel = async () => {
    try {
      const XLSX = await import('xlsx');
      const ws = XLSX.utils.json_to_sheet(getExportData());
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Orders");
      XLSX.writeFile(
        wb,
        `orders_export_${new Date().toISOString().split("T")[0]}.xlsx`,
      );
    } catch (error) {
      toast.error("Failed to generate Excel export");
    }
  };

  const exportPDF = async () => {
    try {
      const { default: jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');
      const doc = new jsPDF();
      doc.text("Order History Export", 14, 15);
      const tableData = orders.map((o) => [
        o.id ? o.id.slice(-6).toUpperCase() : "UNKNOWN",
        new Date(o.createdAt).toLocaleDateString(),
        o.customerName || "Unknown",
        o.status,
        `Rs. ${o.totalAmount}`,
      ]);
      autoTable(doc, {
        head: [["ID", "Date", "Customer", "Status", "Amount"]],
        body: tableData,
        startY: 20,
      });
      doc.save(`orders_export_${new Date().toISOString().split("T")[0]}.pdf`);
    } catch (error) {
      toast.error("Failed to generate PDF export");
    }
  };

  const handleDeleteOrder = async (orderId: string | undefined) => {
    if (!orderId) return;
    if (!window.confirm("Are you sure you want to permanently delete this testing order? This action cannot be undone.")) return;
    
    try {
      await deleteDoc(doc(db, "orders", orderId));
      setOrders((prev) => prev.filter((o) => o.id !== orderId));
      setSelectedOrder(null);
      toast.success("Order deleted successfully from Firestore.");
    } catch (error) {
      console.error("Failed to delete order:", error);
      toast.error("Failed to delete order.");
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row justify-between md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Order History</h1>
          <p className="text-slate-400">
            View and export historical order data.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={exportCSV}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg font-bold text-sm transition-colors"
          >
            CSV
          </button>
          <button
            onClick={exportExcel}
            className="bg-green-50 hover:bg-green-100 text-green-700 px-4 py-2 rounded-lg font-bold text-sm transition-colors"
          >
            Excel
          </button>
          <button
            onClick={exportPDF}
            className="bg-red-50 hover:bg-red-100 text-red-700 px-4 py-2 rounded-lg font-bold text-sm transition-colors"
          >
            PDF
          </button>
        </div>
      </div>

      {/* Analytics Strip */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-[#1E293B] dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-white/10">
          <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">
            Total Orders
          </p>
          <p className="text-2xl font-black">{totalOrders}</p>
        </div>
        <div className="bg-[#1E293B] dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-white/10">
          <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">
            Total Revenue
          </p>
          <p className="text-2xl font-black text-green-600">₹{totalRevenue}</p>
        </div>
        <div className="bg-[#1E293B] dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-white/10">
          <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">
            Avg Order Value
          </p>
          <p className="text-2xl font-black">₹{avgOrderValue.toFixed(0)}</p>
        </div>
        <div className="bg-[#1E293B] dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-white/10">
          <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">
            Delivered
          </p>
          <p className="text-2xl font-black text-blue-600">{deliveredCount}</p>
        </div>
        <div className="bg-[#1E293B] dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-white/10">
          <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">
            Cancelled
          </p>
          <p className="text-2xl font-black text-red-500">{cancelledCount}</p>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-[#1E293B] dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-white/10 flex flex-col lg:flex-row gap-4">
        <div className="flex-1">
          <form onSubmit={handleSearch} className="flex gap-2">
            <input
              type="text"
              placeholder="Search ID, Name, Phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 bg-[#0B0F14] border border-white/5 border border-white/10 rounded-lg px-4 py-2 font-medium"
            />
            <button
              type="submit"
              className="bg-primary-500 hover:bg-primary-600 text-white px-6 py-2 rounded-lg font-bold"
            >
              Search
            </button>
          </form>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-2 lg:pb-0">
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value as DateFilter)}
            className="bg-[#0B0F14] border border-white/5 border border-white/10 rounded-lg px-4 py-2 font-medium shrink-0"
          >
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="last7">Last 7 Days</option>
            <option value="last30">Last 30 Days</option>
            <option value="currentMonth">Current Month</option>
            <option value="prevMonth">Previous Month</option>
            <option value="custom">Custom Range</option>
          </select>

          {dateFilter === "custom" && (
            <div className="flex items-center gap-2 shrink-0">
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="bg-[#0B0F14] border border-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm"
              />
              <span>to</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="bg-[#0B0F14] border border-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          )}
        </div>
      </div>

      {/* Orders List */}
      <div className="bg-[#1E293B] dark:bg-slate-800 rounded-xl shadow-sm border border-white/10 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 font-bold animate-pulse">
            Loading orders...
          </div>
        ) : orders.length === 0 ? (
          <div className="p-12 text-center text-slate-400 font-medium">
            No orders found for this criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#0B0F14] border border-white/5/50 border-b border-white/10">
                  <th className="p-4 font-bold text-sm text-slate-400">
                    Order ID
                  </th>
                  <th className="p-4 font-bold text-sm text-slate-400">Date</th>
                  <th className="p-4 font-bold text-sm text-slate-400">
                    Customer
                  </th>
                  <th className="p-4 font-bold text-sm text-slate-400">
                    Status
                  </th>
                  <th className="p-4 font-bold text-sm text-slate-400">
                    Amount
                  </th>
                  <th className="p-4 font-bold text-sm text-slate-400 text-right">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr
                    key={order.id}
                    className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <td className="p-4 font-bold text-sm">
                    <div className="font-bold text-slate-800 dark:text-slate-200">
                      {order.dailyOrderNumber || `#${order.id?.slice(-6).toUpperCase()}`}
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                      {order.id}
                    </div>
                    </td>
                    <td className="p-4 text-sm text-slate-300">
                      {new Date(order.createdAt).toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="p-4 text-sm">
                      <div className="font-bold">
                        {order.customerName || "Unknown"}
                      </div>
                      <div className="text-xs text-slate-400">
                        {order.contactPhone}
                      </div>
                    </td>
                    <td className="p-4">
                      <span
                        className={`px-2 py-1 rounded text-xs font-bold uppercase tracking-wider
                        ${
                          order.status === "delivered"
                            ? "bg-green-100 text-green-700"
                            : order.status === "cancelled"
                              ? "bg-red-100 text-red-700"
                              : "bg-blue-100 text-blue-700"
                        }`}
                      >
                        {order.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="p-4 font-bold text-primary-600">
                      ₹{order.totalAmount}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setSelectedOrder(order)}
                          className="text-primary-600 hover:text-primary-700 font-bold text-sm bg-primary-50 px-3 py-1 rounded"
                        >
                          Details
                        </button>
                        <button
                          onClick={() => handleDeleteOrder(order.id!)}
                          className="text-error hover:text-white font-bold text-sm hover:bg-error bg-error/10 border border-error/20 px-3 py-1 rounded transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {hasMore && orders.length > 0 && !loading && (
          <div className="p-4 text-center border-t border-white/10">
            <button
              onClick={() => fetchOrders(true)}
              disabled={loadingMore}
              className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 px-6 py-2 rounded-lg font-bold transition-colors disabled:opacity-100"
            >
              {loadingMore ? "Loading..." : "Load 25 More"}
            </button>
          </div>
        )}
      </div>

      {/* Order Details Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1E293B] dark:bg-slate-800 rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 md:p-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">
                <div className="flex flex-col">
                  <span className="text-xl">{selectedOrder.dailyOrderNumber || `Order #${selectedOrder.id?.slice(-6).toUpperCase()}`}</span>
                  <span className="text-xs font-mono text-slate-500">ID: {selectedOrder.id}</span>
                </div>
              </h2>
              <button
                onClick={() => setSelectedOrder(null)}
                className="text-slate-400 hover:text-slate-300 bg-slate-100 p-2 rounded-full"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Customer Details
                </h3>
                <p className="font-bold">
                  {selectedOrder.customerName || "Unknown"}
                </p>
                <p className="text-slate-300">{selectedOrder.contactPhone}</p>
                <p className="text-slate-300 mt-2 text-sm">
                  {selectedOrder.deliveryAddress?.addressLine ||
                    (selectedOrder.deliveryAddress as any)?.fullAddress}
                </p>
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Order Info
                </h3>
                <p>
                  <span className="text-slate-400">Date:</span>{" "}
                  {new Date(selectedOrder.createdAt).toLocaleString()}
                </p>
                <p>
                  <span className="text-slate-400">Status:</span>{" "}
                  <span className="font-bold capitalize">
                    {selectedOrder.status.replace("_", " ")}
                  </span>
                </p>
                <p>
                  <span className="text-slate-400">Payment:</span>{" "}
                  {selectedOrder.paymentMethod === "cod"
                    ? "Cash on Delivery"
                    : "Online"}
                </p>
                {selectedOrder.couponCode && (
                  <p>
                    <span className="text-slate-400">Coupon:</span>{" "}
                    <span className="bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded text-xs font-bold">
                      {selectedOrder.couponCode}
                    </span>
                  </p>
                )}
              </div>
            </div>

            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
              Items Ordered
            </h3>
            <div className="bg-[#0B0F14] border border-white/5/50 rounded-xl p-4 mb-6 border border-slate-100 dark:border-slate-700">
              {selectedOrder.items.map((item, idx) => (
                <div
                  key={idx}
                  className="flex justify-between items-center mb-2 last:mb-0"
                >
                  <div className="flex items-center gap-3">
                    {item.image && (
                      <img
                        src={item.image}
                        alt={item.name}
                        className="w-10 h-10 object-cover rounded-md border border-white/10"
                      />
                    )}
                    <span className="bg-slate-200 dark:bg-slate-700 text-xs font-bold px-2 py-1 rounded">
                      {item.quantity}x
                    </span>
                    <span className="font-medium">{item.name}</span>
                  </div>
                  <span className="text-slate-300">
                    ₹{item.price * item.quantity}
                  </span>
                </div>
              ))}
              <div className="border-t border-white/10 mt-4 pt-4 flex justify-between items-center font-black text-lg">
                <span>Total Amount</span>
                <span className="text-primary-600">
                  ₹{selectedOrder.totalAmount}
                </span>
              </div>
            </div>

            {selectedOrder.deliveryPartnerId && (
              <div className="mb-6">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Delivery Partner ID
                </h3>
                <p className="bg-slate-100 dark:bg-slate-700 p-2 rounded text-sm font-mono">
                  {selectedOrder.deliveryPartnerId}
                </p>
              </div>
            )}

            {selectedOrder.deliveryProof && (
              <div>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Delivery Proof
                </h3>
                <div className="bg-[#0B0F14] border border-white/5/50 rounded-xl p-4 border border-slate-100 dark:border-slate-700">
                  {selectedOrder.deliveryProof.note && (
                    <p className="text-slate-300 italic mb-4">
                      "{selectedOrder.deliveryProof.note}"
                    </p>
                  )}
                  {selectedOrder.deliveryProof.photoUrl && (
                    <img
                      src={selectedOrder.deliveryProof.photoUrl}
                      alt="Delivery Proof"
                      className="max-w-full h-48 object-cover rounded-lg border border-white/10"
                    />
                  )}
                </div>
              </div>
            )}

            <div className="mt-8 pt-6 border-t border-slate-200 dark:border-white/10 flex justify-end">
              <button
                onClick={() => handleDeleteOrder(selectedOrder.id)}
                className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg font-bold transition-colors"
              >
                Delete Order
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
