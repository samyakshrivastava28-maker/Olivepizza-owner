import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router';
import { Pizza, UtensilsCrossed, Wine, Flame, Sparkles, Gift, Layers } from 'lucide-react';
import { useDataStore } from '../../lib/dataStore';

interface CategoryDef {
  id: string;
  name: string;
  defaultImages: { image: string; title: string }[];
  icon: React.ComponentType<{ className?: string }>;
  emoji: string;
  color: string;
  glowColor: string;
  tag?: string;
}

const CATEGORY_DEFS: CategoryDef[] = [
  {
    id: "pizza",
    name: "Artisan Pizzas",
    defaultImages: [
      { image: "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400&q=80", title: "Margherita Supreme" },
      { image: "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=400&q=80", title: "Truffle Mushroom" },
      { image: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400&q=80", title: "Paneer Tikka Passion" },
    ],
    icon: Pizza,
    emoji: "🍕",
    color: "from-orange-500/20 to-amber-500/10",
    glowColor: "rgba(249, 115, 22, 0.4)",
    tag: "Bestseller",
  },
  {
    id: "sides",
    name: "Gourmet Sides",
    defaultImages: [
      { image: "https://images.unsplash.com/photo-1573140247632-f8fd74997d5c?w=400&q=80", title: "Garlic Breadsticks" },
      { image: "https://images.unsplash.com/photo-1541592106381-b31e9677c0e5?w=400&q=80", title: "Crispy Cheese Dip" },
      { image: "https://images.unsplash.com/photo-1624353365286-3f8d62daad51?w=400&q=80", title: "Choco Lava Cake" },
    ],
    icon: UtensilsCrossed,
    emoji: "🧄",
    color: "from-emerald-500/20 to-teal-500/10",
    glowColor: "rgba(16, 185, 129, 0.4)",
  },
  {
    id: "combo",
    name: "Special Combos",
    defaultImages: [
      { image: "https://images.unsplash.com/photo-1544982503-9f984c14501a?w=400&q=80", title: "Family Feast Combo" },
      { image: "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400&q=80", title: "Duo Pizza Meal" },
    ],
    icon: Gift,
    emoji: "🎁",
    color: "from-purple-500/20 to-pink-500/10",
    glowColor: "rgba(168, 85, 247, 0.4)",
    tag: "Super Value",
  },
  {
    id: "beverage",
    name: "Beverages & Shakes",
    defaultImages: [
      { image: "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=400&q=80", title: "Chilled Pepsi 500ml" },
      { image: "https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=400&q=80", title: "Belgium Chocolate Shake" },
    ],
    icon: Wine,
    emoji: "🥤",
    color: "from-blue-500/20 to-cyan-500/10",
    glowColor: "rgba(59, 130, 246, 0.4)",
  },
  {
    id: "spicy",
    name: "Spicy Volcano",
    defaultImages: [
      { image: "https://images.unsplash.com/photo-1604382355076-af4b0eb60143?w=400&q=80", title: "Fiery Jalapeno Delight" },
      { image: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400&q=80", title: "Volcano Red Chilli Pizza" },
    ],
    icon: Flame,
    emoji: "🌶️",
    color: "from-red-500/20 to-rose-500/10",
    glowColor: "rgba(239, 68, 68, 0.4)",
    tag: "Chef's Special",
  },
];

export default function CategoryCapsules() {
  const { products, combos } = useDataStore();
  const [activeImageIndexes, setActiveImageIndexes] = useState<Record<string, number>>({});

  // Resolve category items dynamically from store + owner products
  const resolvedCategoryData = useMemo(() => {
    return CATEGORY_DEFS.map((cat) => {
      let matchedItems: any[] = [];

      if (cat.id === "pizza") {
        matchedItems = products.filter(
          (p) => (!p.category || p.category === "pizza" || p.category === "pizzas") && !p.isComboOnly
        );
      } else if (cat.id === "sides") {
        matchedItems = products.filter(
          (p) => p.category === "sides" || p.category === "side" || p.category === "starter" || p.category === "dessert"
        );
      } else if (cat.id === "combo") {
        matchedItems = combos.length > 0 ? combos : products.filter((p) => p.isComboOnly);
      } else if (cat.id === "beverage") {
        matchedItems = products.filter(
          (p) => p.category === "beverage" || p.category === "drink" || p.category === "beverages"
        );
      } else if (cat.id === "spicy") {
        matchedItems = products.filter(
          (p) =>
            p.isSpicy ||
            p.tags?.includes("spicy") ||
            p.name?.toLowerCase().includes("spicy") ||
            p.name?.toLowerCase().includes("jalapeno") ||
            p.name?.toLowerCase().includes("chilli")
        );
      }

      // Build array of product images with titles
      const productImages: { image: string; title: string }[] = matchedItems
        .filter((item) => item.image || item.imageUrl || item.mediaUrl)
        .map((item) => ({
          image: item.image || item.imageUrl || item.mediaUrl,
          title: item.name || item.title || "Menu Product",
        }));

      // Combine with defaults if productImages list is small
      const combined = productImages.length > 0 ? productImages : cat.defaultImages;

      return {
        ...cat,
        itemCount: matchedItems.length > 0 ? matchedItems.length : combined.length,
        images: combined,
      };
    });
  }, [products, combos]);

  // 10-second automatic image rotation interval
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveImageIndexes((prevIndexes) => {
        const updated: Record<string, number> = { ...prevIndexes };
        resolvedCategoryData.forEach((cat) => {
          const current = prevIndexes[cat.id] || 0;
          updated[cat.id] = (current + 1) % cat.images.length;
        });
        return updated;
      });
    }, 10000); // Rotates every 10 seconds

    return () => clearInterval(timer);
  }, [resolvedCategoryData]);

  return (
    <section className="relative py-12 md:py-16 overflow-hidden z-10">
      {/* Background ambient light */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-7xl h-64 bg-gradient-to-r from-orange-500/5 via-emerald-500/5 to-purple-500/5 blur-3xl pointer-events-none rounded-full" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Section Title */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 md:mb-12">
          <div>
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-md mb-3">
              <Sparkles className="w-3.5 h-3.5 text-primary-400 animate-pulse" />
              <span className="text-xs font-bold uppercase tracking-wider text-primary-300">
                Fresh From The Kitchen
              </span>
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-tight">
              Explore <span className="bg-gradient-to-r from-primary-400 via-amber-300 to-orange-500 bg-clip-text text-transparent">Our Menu</span>
            </h2>
          </div>
          <p className="text-slate-400 text-sm md:text-base max-w-md mt-2 md:mt-0 font-medium flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
            Product previews auto-rotate every 10 seconds from our live oven menu.
          </p>
        </div>

        {/* Categories Rail / Grid */}
        <div className="flex overflow-x-auto pb-6 pt-2 snap-x snap-mandatory hide-scrollbar gap-4 md:grid md:grid-cols-3 lg:grid-cols-5 md:overflow-visible">
          {resolvedCategoryData.map((cat, idx) => {
            const currentImgIndex = activeImageIndexes[cat.id] || 0;
            const currentItem = cat.images[currentImgIndex % cat.images.length];

            return (
              <motion.div
                key={cat.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: idx * 0.08 }}
                whileHover={{ y: -8, scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="snap-start shrink-0 min-w-[230px] md:min-w-0 flex-1"
              >
                <Link
                  to={`/menu?category=${cat.id}`}
                  className="group relative block p-6 rounded-3xl backdrop-blur-xl border border-white/10 transition-all duration-300 overflow-hidden"
                  style={{
                    background: "linear-gradient(145deg, rgba(255,255,255,0.04) 0%, rgba(15,23,42,0.7) 100%)",
                  }}
                >
                  {/* Hover Glow Effect */}
                  <div
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-3xl"
                    style={{
                      boxShadow: `inset 0 0 30px ${cat.glowColor}, 0 10px 40px ${cat.glowColor}`,
                    }}
                  />

                  {/* Top Tag */}
                  {cat.tag && (
                    <div className="absolute top-4 right-4 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-white/10 text-amber-300 border border-amber-400/30">
                      {cat.tag}
                    </div>
                  )}

                  {/* Auto-Rotating 3D Product Image Avatar */}
                  <div className="relative w-16 h-16 rounded-2xl bg-black/40 border border-white/15 p-1 mb-5 shadow-xl group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300 flex items-center justify-center overflow-hidden">
                    <AnimatePresence mode="wait">
                      <motion.img
                        key={currentItem.image}
                        src={currentItem.image}
                        alt={currentItem.title}
                        initial={{ opacity: 0, scale: 0.8, rotate: -10 }}
                        animate={{ opacity: 1, scale: 1, rotate: 0 }}
                        exit={{ opacity: 0, scale: 1.1, rotate: 10 }}
                        transition={{ duration: 0.6, ease: "easeInOut" }}
                        className="w-full h-full object-cover rounded-xl"
                      />
                    </AnimatePresence>

                    {/* Emoji Overlay Badge */}
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-dark-900 border border-white/20 flex items-center justify-center text-xs shadow-md">
                      {cat.emoji}
                    </div>
                  </div>

                  {/* Label & Active Product Subtitle */}
                  <div className="relative z-10">
                    <h3 className="text-lg font-bold text-white group-hover:text-primary-300 transition-colors flex items-center gap-1.5">
                      {cat.name}
                    </h3>
                    
                    {/* Live Rotating Product Name Badge */}
                    <div className="h-5 overflow-hidden mt-1">
                      <AnimatePresence mode="wait">
                        <motion.p
                          key={currentItem.title}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -8 }}
                          transition={{ duration: 0.4 }}
                          className="text-xs text-amber-300/90 font-medium truncate"
                        >
                          ✨ {currentItem.title}
                        </motion.p>
                      </AnimatePresence>
                    </div>

                    <p className="text-[11px] text-slate-400 font-medium mt-1">
                      {cat.itemCount} Item{cat.itemCount === 1 ? "" : "s"} Available
                    </p>
                  </div>

                  {/* Bottom Subtle Indicator Arrow */}
                  <div className="mt-4 flex items-center text-xs font-bold text-primary-400 group-hover:translate-x-1.5 transition-transform duration-300">
                    Explore Category &rarr;
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
