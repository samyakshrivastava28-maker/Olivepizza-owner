import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, Sparkles, Clock, Plus, Sliders, Check, Bot } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { db } from '../../lib/firebase';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { useAuthStore, useCartStore } from '../../lib/store';
import { useDataStore } from '../../lib/dataStore';
import toast from 'react-hot-toast';

interface RecentProductItem {
  id: string;
  productId: string;
  name: string;
  price: number;
  image: string;
  lastOrderedDate: string;
  quantityOrdered: number;
}

export default function PreviouslyOrdered() {
  const { user, isAuthenticated } = useAuthStore();
  const { products, combos } = useDataStore();
  const addItem = useCartStore((s) => s.addItem);
  const navigate = useNavigate();

  const [recentItems, setRecentItems] = useState<RecentProductItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated || !user) {
      setRecentItems([]);
      setLoading(false);
      return;
    }

    const fetchRecentOrders = async () => {
      try {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const q = query(
          collection(db, "orders"),
          where("userId", "==", user.uid),
          orderBy("createdAt", "desc"),
          limit(10)
        );

        const snap = await getDocs(q);
        const orderDocs: any[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));

        const itemsMap: Record<string, RecentProductItem> = {};

        for (const order of orderDocs) {
          const orderDate = order.createdAt ? new Date(order.createdAt) : new Date();

          // Skip if order is older than 30 days
          if (orderDate.getTime() < thirtyDaysAgo.getTime()) continue;

          if (Array.isArray(order.items)) {
            for (const item of order.items) {
              const pId = item.productId || item.id;
              if (!pId) continue;

              // Keep the most recent order date for each unique product
              if (!itemsMap[pId]) {
                // Match with store products to get full image and current details
                const storeProduct =
                  products.find((p) => p.id === pId) ||
                  combos.find((c) => c.id === pId);

                itemsMap[pId] = {
                  id: pId,
                  productId: pId,
                  name: item.productName || item.name || storeProduct?.name || "Delicious Pizza",
                  price: item.price || storeProduct?.price || 299,
                  image:
                    storeProduct?.image ||
                    storeProduct?.imageUrl ||
                    item.imageUrl ||
                    "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400&q=80",
                  lastOrderedDate: orderDate.toISOString(),
                  quantityOrdered: item.quantity || 1,
                };
              }
            }
          }

          if (Object.keys(itemsMap).length >= 3) break;
        }

        setRecentItems(Object.values(itemsMap).slice(0, 3));
      } catch (err) {
        console.warn("Failed to fetch customer previous orders:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchRecentOrders();
  }, [isAuthenticated, user, products, combos]);

  if (!isAuthenticated || loading || recentItems.length === 0) {
    return null; // Hide completely if not logged in or no recent orders
  }

  const handleAddAgain = (item: RecentProductItem) => {
    addItem({
      id: item.productId,
      productId: item.productId,
      productName: item.name,
      price: item.price,
      quantity: 1,
      imageUrl: item.image,
    } as any);

    toast.success(`Added ${item.name} back to your cart!`, {
      icon: "🍕",
      style: {
        background: "#18181b",
        color: "#fff",
        border: "1px solid rgba(249, 115, 22, 0.4)",
      },
    });
  };

  const formatDaysAgo = (dateStr: string) => {
    const days = Math.max(
      0,
      Math.floor((new Date().getTime() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24))
    );
    if (days === 0) return "Ordered Today";
    if (days === 1) return "Ordered Yesterday";
    return `Ordered ${days} days ago`;
  };

  return (
    <section className="relative py-12 sm:py-16 overflow-hidden z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8">
          <div>
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 backdrop-blur-md mb-2">
              <Bot className="w-4 h-4 text-emerald-400 animate-pulse" />
              <span className="text-xs font-black uppercase tracking-wider text-emerald-300">
                Personalized Favorites
              </span>
            </div>
            <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
              Order <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">It Again</span>
            </h2>
          </div>
          <p className="text-slate-400 text-xs sm:text-sm max-w-md mt-2 md:mt-0 font-medium">
            Items you enjoyed over the last 30 days. One click to re-order instantly!
          </p>
        </div>

        {/* 3 Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {recentItems.map((item, idx) => (
            <motion.div
              key={item.productId}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: idx * 0.1 }}
              whileHover={{ y: -6 }}
              className="group relative rounded-3xl p-5 overflow-hidden border border-white/10 transition-all duration-300 flex flex-col justify-between"
              style={{
                background: "linear-gradient(145deg, rgba(24, 24, 27, 0.95) 0%, rgba(9, 9, 11, 0.98) 100%)",
                boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
              }}
            >
              {/* AI Recommendation Badge Header */}
              <div className="flex items-center justify-between mb-3 z-10">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  <Sparkles className="w-3 h-3 animate-spin" />
                  You ordered this before
                </span>
                <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-slate-500" />
                  {formatDaysAgo(item.lastOrderedDate)}
                </span>
              </div>

              {/* Product Thumbnail & Details */}
              <div className="flex items-center gap-4 my-2 z-10">
                <div className="w-20 h-20 rounded-2xl overflow-hidden bg-black/40 border border-white/10 shrink-0">
                  <img
                    src={item.image}
                    alt={item.name}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-base sm:text-lg font-bold text-white truncate group-hover:text-emerald-300 transition-colors">
                    {item.name}
                  </h4>
                  <p className="text-xs text-slate-400 font-medium mt-0.5">
                    Qty previously ordered: <span className="text-white font-bold">{item.quantityOrdered}</span>
                  </p>
                  <span className="text-lg font-black text-amber-400 mt-1 block">
                    ₹{item.price}
                  </span>
                </div>
              </div>

              {/* Actions: Add Again & Customize */}
              <div className="mt-4 pt-3 border-t border-white/10 flex items-center gap-3 z-10">
                <motion.button
                  onClick={() => handleAddAgain(item)}
                  whileTap={{ scale: 0.94 }}
                  className="flex-1 py-2.5 px-4 rounded-xl font-bold text-xs sm:text-sm bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Add Again
                </motion.button>

                <Link
                  to={`/product/${item.productId}`}
                  className="py-2.5 px-3 rounded-xl font-bold text-xs bg-white/5 hover:bg-white/15 border border-white/10 text-slate-300 flex items-center gap-1.5 transition-colors"
                >
                  <Sliders className="w-3.5 h-3.5" /> Customize
                </Link>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
