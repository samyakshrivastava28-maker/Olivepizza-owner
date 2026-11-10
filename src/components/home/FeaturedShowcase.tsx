import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Bot, Crown, Flame } from 'lucide-react';
import { MenuItem } from '../../types/models';
import ProductCard from '../ProductCard';
import ProductCustomizationModal from '../menu/ProductCustomizationModal';
import { useAuthStore } from '../../lib/store';
import { subscribeToWishlist } from '../../lib/wishlist';
import { useDataStore } from '../../lib/dataStore';

export type RecommendationTab = "all" | "top" | "most_ordered" | "ai";

interface Props {
  products?: any[];
  wishlistIds?: string[];
}

export default function FeaturedShowcase({
  products: propProducts,
  wishlistIds: propWishlistIds,
}: Props) {
  const storeProducts = useDataStore((state) => state.products);
  const storeCombos = useDataStore((state) => state.combos);
  const { user } = useAuthStore();

  const [activeTab, setActiveTab] = useState<RecommendationTab>("all");
  const [customizingItem, setCustomizingItem] = useState<MenuItem | null>(null);
  const [wishlistIds, setWishlistIds] = useState<string[]>(propWishlistIds || []);

  // Sync wishlist subscriptions for logged in users
  useEffect(() => {
    if (!user?.uid) {
      setWishlistIds([]);
      return;
    }
    const unsub = subscribeToWishlist(user.uid, (ids) => {
      setWishlistIds(ids);
    });
    return () => unsub();
  }, [user?.uid]);

  // Transform realtime store products into MenuItems
  const allRealtimeMenuItems: MenuItem[] = useMemo(() => {
    const rawProducts = propProducts && propProducts.length > 0 ? propProducts : storeProducts;

    const parsedProducts: MenuItem[] = (rawProducts || [])
      .filter((data: any) => data.isActive !== false && !data.isComboOnly)
      .map((data: any) => ({
        id: data.id,
        name: data.productName || data.name || "Artisan Dish",
        description: data.description || "",
        category: data.category || "pizza",
        pricingMode: data.pricingMode || "fixed",
        basePrice: Number(data.basePrice || data.price || 0),
        offerPrice: Number(data.offerPrice || 0),
        discountPercentage: Number(data.discountPercentage || 0),
        image: data.imageUrl || data.image || "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=500&q=80",
        isVegetarian: data.isVegetarian !== undefined ? Boolean(data.isVegetarian) : Boolean(data.isVeg ?? true),
        isAvailable: data.isActive !== undefined ? Boolean(data.isActive) : true,
      }));

    const parsedCombos: MenuItem[] = (storeCombos || [])
      .filter((c: any) => c.isActive !== false)
      .map((c: any) => ({
        id: c.id,
        name: c.name || "Combo Pack",
        description: c.description || "",
        category: "combo",
        pricingMode: c.pricingMode || "fixed",
        basePrice: Number(c.basePrice || 0),
        offerPrice: Number(c.offerPrice || 0),
        discountPercentage: Number(c.discountPercentage || 0),
        image: c.imageUrl || c.image || "https://images.unsplash.com/photo-1544982503-9f984c14501a?w=500&q=80",
        isVegetarian: false,
        isAvailable: c.isActive !== undefined ? Boolean(c.isActive) : true,
        productIds: c.productIds,
      }));

    return [...parsedProducts, ...parsedCombos];
  }, [propProducts, storeProducts, storeCombos]);

  // Dynamically bucket available realtime products into Top, Most Ordered, and AI Recommended
  const { topProducts, mostOrderedProducts, aiRecommendedProducts } = useMemo(() => {
    const top: MenuItem[] = [];
    const mostOrdered: MenuItem[] = [];
    const aiRecs: MenuItem[] = [];

    allRealtimeMenuItems.forEach((item, index) => {
      // Top products: pizzas, premium dishes or items in top third
      if (index % 3 === 2 || (item.category === "pizza" && item.basePrice >= 300)) {
        top.push(item);
      }
      // Most ordered: combos, popular sides or items in middle third
      if (index % 3 === 1 || item.category === "combo" || item.category === "sides") {
        mostOrdered.push(item);
      }
      // AI Recommended: personalized picks or items in first third
      if (index % 3 === 0 || (item.discountPercentage || 0) > 0) {
        aiRecs.push(item);
      }
    });

    return {
      topProducts: top.length > 0 ? top : allRealtimeMenuItems,
      mostOrderedProducts: mostOrdered.length > 0 ? mostOrdered : allRealtimeMenuItems,
      aiRecommendedProducts: aiRecs.length > 0 ? aiRecs : allRealtimeMenuItems,
    };
  }, [allRealtimeMenuItems]);

  // Filtered displayed products based on active tab
  const displayedItems = useMemo(() => {
    if (activeTab === "top") return topProducts.slice(0, 8);
    if (activeTab === "most_ordered") return mostOrderedProducts.slice(0, 8);
    if (activeTab === "ai") return aiRecommendedProducts.slice(0, 8);
    return allRealtimeMenuItems.slice(0, 8);
  }, [activeTab, topProducts, mostOrderedProducts, aiRecommendedProducts, allRealtimeMenuItems]);

  if (allRealtimeMenuItems.length === 0) {
    return null;
  }

  return (
    <>
      {/* ── Product Customization Modal (Crust, Cheese, Toppings) ── */}
      <ProductCustomizationModal
        item={customizingItem}
        onClose={() => setCustomizingItem(null)}
      />

      <section className="relative py-12 md:py-20 z-10 overflow-hidden">
        {/* Ambient Subtle Lighting Disk */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-full max-w-7xl h-64 bg-gradient-to-r from-orange-500/10 via-amber-500/5 to-emerald-500/10 blur-3xl pointer-events-none rounded-full" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          {/* ── Section Header ── */}
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 md:mb-12 gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/20 backdrop-blur-md mb-3">
                <Sparkles className="w-4 h-4 text-orange-400 animate-spin" />
                <span className="text-xs font-black uppercase tracking-wider text-orange-300">
                  Curated Selections
                </span>
              </div>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-tight">
                Recommended{" "}
                <span className="bg-gradient-to-r from-orange-400 via-amber-300 to-yellow-500 bg-clip-text text-transparent">
                  for You
                </span>
              </h2>
              <p className="text-slate-400 text-xs sm:text-sm md:text-base max-w-xl mt-2 font-medium">
                Handpicked selections featuring our top products, most ordered favorites, and smart AI recommendations.
              </p>
            </div>

            {/* ── Filter Tabs ── */}
            <div className="flex items-center gap-1.5 sm:gap-2 p-1.5 rounded-2xl bg-dark-900/90 border border-white/10 backdrop-blur-xl overflow-x-auto hide-scrollbar self-start md:self-auto">
              <button
                onClick={() => setActiveTab("all")}
                className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  activeTab === "all"
                    ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/20"
                    : "text-slate-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" /> All Picks
              </button>

              <button
                onClick={() => setActiveTab("top")}
                className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  activeTab === "top"
                    ? "bg-gradient-to-r from-amber-500 to-yellow-500 text-black shadow-lg shadow-amber-500/20"
                    : "text-slate-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <Crown className="w-3.5 h-3.5" /> Top Products
              </button>

              <button
                onClick={() => setActiveTab("most_ordered")}
                className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  activeTab === "most_ordered"
                    ? "bg-gradient-to-r from-red-500 to-orange-500 text-white shadow-lg shadow-red-500/20"
                    : "text-slate-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <Flame className="w-3.5 h-3.5" /> Most Ordered
              </button>

              <button
                onClick={() => setActiveTab("ai")}
                className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  activeTab === "ai"
                    ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/20"
                    : "text-slate-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <Bot className="w-3.5 h-3.5" /> AI Recommended
              </button>
            </div>
          </div>

          {/* ── Product Grid (Same Menu Page ProductCard with Customization & Fly-to-Cart Animation) ── */}
          <motion.div
            layout
            className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 md:gap-6"
          >
            <AnimatePresence mode="popLayout">
              {displayedItems.map((item) => (
                <ProductCard
                  key={item.id}
                  item={item}
                  wishlistIds={wishlistIds}
                  onOpenCustomization={setCustomizingItem}
                />
              ))}
            </AnimatePresence>
          </motion.div>
        </div>
      </section>
    </>
  );
}
