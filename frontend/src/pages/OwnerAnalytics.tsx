import { useState, useEffect, useMemo } from 'react';
import { db } from '../lib/firebase';
import {
  collection,
  onSnapshot,
  query,
  updateDoc,
  doc,
  orderBy,
} from 'firebase/firestore';
import { Order } from '../types/models';

export default function OwnerAnalytics() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  // Firestore Real-time Listener for ALL orders
  useEffect(() => {
    const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const liveOrders = snapshot.docs.map(
          (doc) => ({ id: doc.id, ...doc.data() }) as Order,
        );
        setOrders(liveOrders);
        setLoading(false);
      },
      (error) => {
        console.error("Failed to listen to live orders", error);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, []);

  const updateStatus = async (orderId: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, "orders", orderId), { status: newStatus });
    } catch (error) {
      console.error("Failed to update status", error);
    }
  };

  // ------------------------------------------------------------------
  // REAL-TIME ANALYTICS CALCULATIONS
  // ------------------------------------------------------------------
  const analytics = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    let monthlyEarnings = 0;
    let monthlySales = 0;
    const productCounts: Record<string, number> = {};
    const customerCounts: Record<
      string,
      { phone: string; orders: number; spent: number }
    > = {};
    const hourCounts: Record<number, number> = {};

    orders.forEach((order) => {
      const orderDate = new Date(order.createdAt);
      // We only care about delivered orders for earning stats, but maybe 'accepted' and above for active volume.
      // We'll count all non-cancelled orders for overall volume, but only delivered/out_for_delivery for earnings.
      if (
        order.status !== "cancelled" &&
        orderDate.getMonth() === currentMonth &&
        orderDate.getFullYear() === currentYear
      ) {
        monthlySales++;
        monthlyEarnings += order.totalAmount;

        // Tally Products
        order.items?.forEach((item) => {
          if (!productCounts[item.name]) productCounts[item.name] = 0;
          productCounts[item.name] += item.quantity;
        });

        // Tally Customers
        const phone = order.contactPhone || "Unknown Customer";
        if (!customerCounts[phone]) {
          customerCounts[phone] = { phone, orders: 0, spent: 0 };
        }
        customerCounts[phone].orders++;
        customerCounts[phone].spent += order.totalAmount;

        // Tally Hours
        const hour = orderDate.getHours();
        hourCounts[hour] = (hourCounts[hour] || 0) + 1;
      }
    });

    // Sort Top Products
    const topProducts = Object.entries(productCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5); // top 5

    // Sort Top Customers
    const topCustomers = Object.values(customerCounts)
      .sort((a, b) => b.spent - a.spent)
      .slice(0, 5); // top 5

    // Find Peak Hour
    let peakHour = "N/A";
    let maxOrdersInHour = 0;
    Object.entries(hourCounts).forEach(([hourStr, count]) => {
      if (count > maxOrdersInHour) {
        maxOrdersInHour = count;
        const h = parseInt(hourStr);
        const ampm = h >= 12 ? "PM" : "AM";
        const displayH = h % 12 || 12;
        peakHour = `${displayH}:00 ${ampm} - ${displayH}:59 ${ampm}`;
      }
    });

    const averageOrderValue =
      monthlySales > 0 ? Math.round(monthlyEarnings / monthlySales) : 0;

    return {
      monthlyEarnings,
      monthlySales,
      topProducts,
      topCustomers,
      peakHour,
      averageOrderValue,
    };
  }, [orders]);

  // Only keep what's needed for Analytics

  if (loading)
    return (
      <div className="text-xl font-bold p-8 flex justify-center items-center h-64">
        <div className="animate-pulse text-primary-500">
          Loading Live Data...
        </div>
      </div>
    );

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-white">Live Analytics</h1>
          <p className="text-slate-400">
            Real-time statistics for{" "}
            {new Date().toLocaleString("default", {
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm font-bold text-green-500 bg-green-50 dark:bg-green-900/20 px-3 py-1 rounded-full animate-pulse">
          <div className="w-2 h-2 rounded-full bg-green-500"></div>
          LIVE
        </div>
      </div>

      {/* STATS ROW */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-[#1E293B] border border-white/10 shadow-xl rounded-2xl p-6 flex flex-col justify-center border-l-4 border-green-500">
          <span className="text-slate-400 text-sm font-bold uppercase tracking-wider mb-1">
            Monthly Earnings
          </span>
          <span className="text-3xl font-black text-white">
            ₹{analytics.monthlyEarnings.toLocaleString()}
          </span>
        </div>
        <div className="bg-[#1E293B] border border-white/10 shadow-xl rounded-2xl p-6 flex flex-col justify-center border-l-4 border-blue-500">
          <span className="text-slate-400 text-sm font-bold uppercase tracking-wider mb-1">
            Total Sales
          </span>
          <span className="text-3xl font-black text-white">
            {analytics.monthlySales}{" "}
            <span className="text-lg font-bold text-slate-400">orders</span>
          </span>
        </div>
        <div className="bg-[#1E293B] border border-white/10 shadow-xl rounded-2xl p-6 flex flex-col justify-center border-l-4 border-yellow-500">
          <span className="text-slate-400 text-sm font-bold uppercase tracking-wider mb-1">
            Total Orders
          </span>
          <span className="text-3xl font-black text-white">
            {orders.length}{" "}
            <span className="text-lg font-bold text-slate-400">all-time</span>
          </span>
        </div>
        <div className="bg-[#1E293B] border border-white/10 shadow-xl rounded-2xl p-6 flex flex-col justify-center border-l-4 border-purple-500">
          <span className="text-slate-400 text-sm font-bold uppercase tracking-wider mb-1">
            Top Item
          </span>
          <span
            className="text-2xl font-black text-white truncate"
            title={analytics.topProducts[0]?.name || "N/A"}
          >
            {analytics.topProducts[0]?.name || "N/A"}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
        <div className="bg-[#1E293B] border border-white/10 shadow-xl rounded-2xl p-6 flex items-center justify-between border-l-4 border-pink-500">
          <div>
            <span className="text-slate-400 text-sm font-bold uppercase tracking-wider block mb-1">
              Average Order Value
            </span>
            <span className="text-2xl font-black text-white">
              ₹{analytics.averageOrderValue}{" "}
              <span className="text-sm text-slate-400 font-bold">/ order</span>
            </span>
          </div>
          <div className="text-4xl">📈</div>
        </div>
        <div className="bg-[#1E293B] border border-white/10 shadow-xl rounded-2xl p-6 flex items-center justify-between border-l-4 border-teal-500">
          <div>
            <span className="text-slate-400 text-sm font-bold uppercase tracking-wider block mb-1">
              Peak Order Time
            </span>
            <span className="text-2xl font-black text-white">
              {analytics.peakHour}
            </span>
          </div>
          <div className="text-4xl">🕒</div>
        </div>
      </div>

      {/* CHARTS / LEADERBOARDS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* TOP PRODUCTS */}
        <div className="bg-[#1E293B] border border-white/10 shadow-xl rounded-2xl p-6">
          <h2 className="text-xl font-bold mb-6 text-white border-b border-white/10 pb-2">
            🔥 Most Ordered Products
          </h2>
          <div className="space-y-4">
            {analytics.topProducts.length === 0 && (
              <div className="text-slate-400">No data for this month yet.</div>
            )}
            {analytics.topProducts.map((product, idx) => (
              <div
                key={idx}
                className="flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <span className="text-primary-500 font-black w-4">
                    {idx + 1}.
                  </span>
                  <span className="font-bold text-slate-700 dark:text-slate-200">
                    {product.name}
                  </span>
                </div>
                <span className="font-bold text-slate-400 bg-[#1E293B] dark:bg-slate-700 px-3 py-1 rounded-full shadow-sm">
                  {product.count} sold
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* TOP CUSTOMERS */}
        <div className="bg-[#1E293B] border border-white/10 shadow-xl rounded-2xl p-6">
          <h2 className="text-xl font-bold mb-6 text-white border-b border-white/10 pb-2">
            👑 Top Customers
          </h2>
          <div className="space-y-4">
            {analytics.topCustomers.length === 0 && (
              <div className="text-slate-400">No data for this month yet.</div>
            )}
            {analytics.topCustomers.map((customer, idx) => (
              <div
                key={idx}
                className="flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <span className="text-primary-500 font-black w-4">
                    {idx + 1}.
                  </span>
                  <div className="flex flex-col">
                    <span className="font-bold text-slate-700 dark:text-slate-200">
                      {customer.phone}
                    </span>
                    <span className="text-xs text-slate-400">
                      {customer.orders} orders
                    </span>
                  </div>
                </div>
                <span className="font-bold text-green-600 dark:text-green-400">
                  ₹{customer.spent.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* FINANCIAL SETTLEMENTS & CSV EXPORT */}
      <div className="mt-8 bg-[#1E293B] border border-white/10 shadow-xl rounded-2xl p-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 border-b border-white/10 pb-4">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              💳 Payment Settlements & Tax Breakdown
            </h2>
            <p className="text-xs text-slate-400">Net earnings, 5% GST tax calculation, and gateway settlement breakdown</p>
          </div>
          <div className="flex gap-2">
            <a
              href="/api/payment/reports?period=daily&format=csv"
              target="_blank"
              download
              className="px-4 py-2 bg-primary-600/20 text-primary-400 border border-primary-500/30 rounded-xl font-bold text-xs hover:bg-primary-600/30 transition-all flex items-center gap-1.5"
            >
              📥 Export Daily CSV
            </a>
            <a
              href="/api/payment/reports?period=monthly&format=csv"
              target="_blank"
              download
              className="px-4 py-2 bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 rounded-xl font-bold text-xs hover:bg-emerald-600/30 transition-all flex items-center gap-1.5"
            >
              📊 Export Monthly CSV
            </a>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-900/60 p-4 rounded-xl border border-white/5">
            <div className="text-xs text-slate-400 font-semibold uppercase">Net Sales</div>
            <div className="text-xl font-black text-white mt-1">₹{analytics.monthlyEarnings.toLocaleString()}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">This Month</div>
          </div>
          <div className="bg-slate-900/60 p-4 rounded-xl border border-white/5">
            <div className="text-xs text-slate-400 font-semibold uppercase">Estimated 5% GST</div>
            <div className="text-xl font-black text-orange-400 mt-1">₹{(analytics.monthlyEarnings * 0.05).toFixed(0)}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">Tax liability</div>
          </div>
          <div className="bg-slate-900/60 p-4 rounded-xl border border-white/5">
            <div className="text-xs text-slate-400 font-semibold uppercase">Est. Gateway Charges (2%)</div>
            <div className="text-xl font-black text-red-400 mt-1">₹{(analytics.monthlyEarnings * 0.02).toFixed(0)}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">Payment gateway fees</div>
          </div>
          <div className="bg-slate-900/60 p-4 rounded-xl border border-white/5">
            <div className="text-xs text-slate-400 font-semibold uppercase">Expected Settlement</div>
            <div className="text-xl font-black text-green-400 mt-1">₹{(analytics.monthlyEarnings * 0.98).toFixed(0)}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">Net bank deposit</div>
          </div>
        </div>
      </div>
    </div>
  );
}
