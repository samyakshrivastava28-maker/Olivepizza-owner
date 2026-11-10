import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router';
import { Sparkles, ChefHat, Flame, Zap, Award } from 'lucide-react';
import { useDataStore } from '../../lib/dataStore';
import { trackEvent } from '../../lib/analytics';

interface CategoryProductImage {
  image: string;
  name: string;
}

interface CategoryItem {
  id: string;
  name: string;
  defaultImage: string;
  productImages: CategoryProductImage[];
  itemCount: number;
  glowColor: string;
  badge?: "NEW" | "Bestseller" | "Super Value" | "Chef Pick" | "Hot" | string;
  isRecommended?: boolean;
  targetUrl: string;
}

// ─── Single Domino's-Style Circular Category Avatar Item ─────────────────────
function CategoryCircleItem({
  category,
  index,
}: {
  category: CategoryItem;
  index: number;
}) {
  const [currentImgIndex, setCurrentImgIndex] = useState(0);
  const navigate = useNavigate();

  // Images for 5-second dynamic rotation
  const imagesList = useMemo(() => {
    if (category.productImages && category.productImages.length > 0) {
      return category.productImages;
    }
    return [{ image: category.defaultImage, name: category.name }];
  }, [category.productImages, category.defaultImage, category.name]);

  // 5-Second Automatic Image Rotation Loop
  useEffect(() => {
    if (imagesList.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentImgIndex((prev) => (prev + 1) % imagesList.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [imagesList.length]);

  // Preload next rotating image in memory (no flicker / instantaneous 60fps swap)
  useEffect(() => {
    if (imagesList.length <= 1) return;
    const nextIdx = (currentImgIndex + 1) % imagesList.length;
    if (imagesList[nextIdx]?.image) {
      const img = new Image();
      img.src = imagesList[nextIdx].image;
    }
  }, [currentImgIndex, imagesList]);

  const activeImage = imagesList[currentImgIndex % imagesList.length] || {
    image: category.defaultImage,
    name: category.name,
  };

  const handleClick = useCallback(() => {
    // Haptic feedback for mobile app feel
    if (typeof window !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate(15);
      } catch {
        // Ignore vibration failure
      }
    }

    // Track analytics event
    trackEvent({
      type: "category_click",
      categoryId: category.id,
      categoryName: category.name,
      itemCount: category.itemCount,
    } as any);

    navigate(category.targetUrl);
  }, [category, navigate]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleClick();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.9 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{
        duration: 0.45,
        delay: index * 0.06,
        ease: [0.16, 1, 0.3, 1],
      }}
      className="flex flex-col items-center group cursor-pointer select-none text-center w-full max-w-[110px] sm:max-w-[125px]"
      role="button"
      tabIndex={0}
      aria-label={`Category ${category.name}, ${category.itemCount} items available`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      {/* ── Continuous Subtle Floating Container ── */}
      <motion.div
        animate={{ y: [0, -6, 0] }}
        transition={{
          duration: 5 + (index % 4),
          repeat: Infinity,
          ease: "easeInOut",
          delay: (index * 0.3) % 2,
        }}
        whileHover={{
          scale: 1.08,
          rotate: index % 2 === 0 ? 1.5 : -1.5,
          transition: { duration: 0.25, ease: "easeOut" },
        }}
        whileTap={{
          scale: 0.94,
          transition: { duration: 0.15 },
        }}
        className="relative mb-2 sm:mb-2.5"
      >
        {/* Ambient Radial Colored Glow */}
        <div
          className="absolute -inset-2.5 rounded-full opacity-40 group-hover:opacity-100 transition-opacity duration-500 blur-lg pointer-events-none transform-gpu"
          style={{
            background: `radial-gradient(circle at center, ${category.glowColor} 0%, transparent 75%)`,
          }}
        />

        {/* AI Recommended Pulsing Outer Ring */}
        {category.isRecommended && (
          <div className="absolute -inset-1.5 rounded-full border-2 border-amber-400/80 animate-ping opacity-30 pointer-events-none" />
        )}

        {/* ── 3D Circular Glassmorphic Avatar Frame ── */}
        <div
          className={`relative w-20 h-20 sm:w-22 sm:h-22 md:w-24 md:h-24 lg:w-26 lg:h-26 rounded-full p-1 border-2 transition-all duration-300 shadow-2xl overflow-hidden flex items-center justify-center bg-dark-900/90 transform-gpu ${
            category.isRecommended
              ? "border-amber-400 shadow-[0_0_25px_rgba(251,191,36,0.5)]"
              : "border-white/15 group-hover:border-primary-400/90 group-hover:shadow-[0_12px_32px_rgba(249,115,22,0.4)]"
          }`}
          style={{
            backdropFilter: "blur(14px)",
            boxShadow:
              "inset 0 2px 4px rgba(255,255,255,0.15), 0 10px 25px rgba(0, 0, 0, 0.7)",
          }}
        >
          {/* ── Dynamic 5-Second Image Morphing / Crossfade ── */}
          <AnimatePresence mode="wait">
            <motion.img
              key={activeImage.image}
              src={activeImage.image}
              alt={activeImage.name}
              initial={{
                opacity: 0,
                scale: 1.12,
                filter: "blur(4px)",
                rotate: -1.5,
              }}
              animate={{
                opacity: 1,
                scale: 1,
                filter: "blur(0px)",
                rotate: 0,
              }}
              exit={{
                opacity: 0,
                scale: 0.92,
                filter: "blur(4px)",
                rotate: 1.5,
              }}
              transition={{
                duration: 0.75,
                ease: [0.16, 1, 0.3, 1],
              }}
              loading="lazy"
              className="w-full h-full object-cover rounded-full group-hover:scale-110 transition-transform duration-700 pointer-events-none"
            />
          </AnimatePresence>

          {/* Premium Glass Lens Reflection Highlight */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-transparent via-white/5 to-white/25 pointer-events-none z-10" />

          {/* Optional Badge Overlay (NEW, Bestseller, etc.) */}
          {category.badge && (
            <div className="absolute bottom-0 inset-x-0 z-20 flex justify-center pb-0.5">
              <span
                className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider text-white shadow-md backdrop-blur-md ${
                  category.badge === "NEW"
                    ? "bg-emerald-500/95 shadow-emerald-500/40"
                    : category.badge === "Bestseller"
                    ? "bg-gradient-to-r from-orange-500 to-amber-500 shadow-orange-500/40"
                    : category.badge === "Super Value"
                    ? "bg-purple-600/95 shadow-purple-600/40"
                    : "bg-primary-500/95 shadow-primary-500/40"
                }`}
              >
                {category.badge}
              </span>
            </div>
          )}

          {/* AI Recommended Sparkling Mini-Badge */}
          {category.isRecommended && !category.badge && (
            <div className="absolute top-1 right-1 z-20 w-5 h-5 rounded-full bg-amber-400 text-black flex items-center justify-center shadow-lg animate-pulse">
              <Sparkles className="w-3 h-3" />
            </div>
          )}
        </div>
      </motion.div>

      {/* ── Category Name & Dynamic Count ── */}
      <div className="flex flex-col items-center w-full px-1">
        <h3 className="text-xs sm:text-sm font-extrabold text-white group-hover:text-primary-400 transition-colors duration-200 tracking-tight line-clamp-1 w-full text-center">
          {category.name}
        </h3>
        <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 group-hover:text-emerald-400 transition-colors duration-200 mt-0.5 flex items-center justify-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
          {category.itemCount} Item{category.itemCount === 1 ? "" : "s"}
        </span>
      </div>
    </motion.div>
  );
}

// ─── Main Live Menu Categories Component ─────────────────────────────────────
export default function LiveMenuCategories() {
  const { specialCategories, products, combos, isInitialized } = useDataStore();

  // Dynamic grouping & category synthesis from real-time store
  const categoryList = useMemo(() => {
    // 1. Pizzas
    const pizzaProducts = products.filter(
      (p) =>
        (!p.category ||
          p.category.toLowerCase().includes("pizza")) &&
        !p.isComboOnly
    );
    const pizzaImages: CategoryProductImage[] = pizzaProducts
      .filter((p) => p.image || p.imageUrl)
      .map((p) => ({
        image: p.image || p.imageUrl,
        name: p.productName || p.name || "Artisan Pizza",
      }));

    // 2. Burgers
    const burgerProducts = products.filter(
      (p) =>
        p.category &&
        (p.category.toLowerCase().includes("burger") ||
          p.category.toLowerCase().includes("burgers"))
    );
    const burgerImages: CategoryProductImage[] = burgerProducts
      .filter((p) => p.image || p.imageUrl)
      .map((p) => ({
        image: p.image || p.imageUrl,
        name: p.productName || p.name || "Gourmet Burger",
      }));

    // 3. Pasta
    const pastaProducts = products.filter(
      (p) =>
        p.category &&
        p.category.toLowerCase().includes("pasta")
    );
    const pastaImages: CategoryProductImage[] = pastaProducts
      .filter((p) => p.image || p.imageUrl)
      .map((p) => ({
        image: p.image || p.imageUrl,
        name: p.productName || p.name || "Italian Pasta",
      }));

    // 4. Garlic Bread & Sides
    const sideProducts = products.filter(
      (p) =>
        p.category &&
        (p.category.toLowerCase().includes("side") ||
          p.category.toLowerCase().includes("garlic") ||
          p.category.toLowerCase().includes("bread") ||
          p.category.toLowerCase().includes("starter") ||
          p.category.toLowerCase().includes("fries") ||
          p.category.toLowerCase().includes("dip"))
    );
    const sideImages: CategoryProductImage[] = sideProducts
      .filter((p) => p.image || p.imageUrl)
      .map((p) => ({
        image: p.image || p.imageUrl,
        name: p.productName || p.name || "Gourmet Sides",
      }));

    // 5. Value Combos
    const comboList =
      combos.length > 0 ? combos : products.filter((p) => p.isComboOnly);
    const comboImages: CategoryProductImage[] = comboList
      .filter((p) => p.image || p.imageUrl)
      .map((p) => ({
        image: p.image || p.imageUrl,
        name: p.name || p.productName || "Value Combo",
      }));

    // 6. Beverages & Shakes
    const beverageProducts = products.filter(
      (p) =>
        p.category &&
        (p.category.toLowerCase().includes("beverage") ||
          p.category.toLowerCase().includes("drink") ||
          p.category.toLowerCase().includes("shake") ||
          p.category.toLowerCase().includes("coffee"))
    );
    const beverageImages: CategoryProductImage[] = beverageProducts
      .filter((p) => p.image || p.imageUrl)
      .map((p) => ({
        image: p.image || p.imageUrl,
        name: p.productName || p.name || "Chilled Beverage",
      }));

    // 7. Desserts
    const dessertProducts = products.filter(
      (p) =>
        p.category &&
        (p.category.toLowerCase().includes("dessert") ||
          p.category.toLowerCase().includes("sweet") ||
          p.category.toLowerCase().includes("cake") ||
          p.category.toLowerCase().includes("brownie") ||
          p.category.toLowerCase().includes("ice"))
    );
    const dessertImages: CategoryProductImage[] = dessertProducts
      .filter((p) => p.image || p.imageUrl)
      .map((p) => ({
        image: p.image || p.imageUrl,
        name: p.productName || p.name || "Artisan Dessert",
      }));

    // Standard Core Categories
    const coreCategories: CategoryItem[] = [
      {
        id: "pizza",
        name: "Artisan Pizza",
        defaultImage:
          "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400&q=80",
        productImages: pizzaImages,
        itemCount: pizzaProducts.length,
        glowColor: "rgba(249, 115, 22, 0.6)",
        badge: "Bestseller",
        isRecommended: true,
        targetUrl: "/menu?category=pizza",
      },
      {
        id: "burgers",
        name: "Burgers",
        defaultImage:
          "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&q=80",
        productImages: burgerImages,
        itemCount: burgerProducts.length,
        glowColor: "rgba(234, 179, 8, 0.6)",
        targetUrl: "/menu?category=burgers",
      },
      {
        id: "pasta",
        name: "Pastas",
        defaultImage:
          "https://images.unsplash.com/photo-1621996346565-e3d5d6281691?w=400&q=80",
        productImages: pastaImages,
        itemCount: pastaProducts.length,
        glowColor: "rgba(239, 68, 68, 0.6)",
        badge: "NEW",
        targetUrl: "/menu?category=pasta",
      },
      {
        id: "sides",
        name: "Garlic Bread & Sides",
        defaultImage:
          "https://images.unsplash.com/photo-1573140247632-f8fd74997d5c?w=400&q=80",
        productImages: sideImages,
        itemCount: sideProducts.length,
        glowColor: "rgba(16, 185, 129, 0.6)",
        targetUrl: "/menu?category=sides",
      },
      {
        id: "combo",
        name: "Value Combos",
        defaultImage:
          "https://images.unsplash.com/photo-1544982503-9f984c14501a?w=400&q=80",
        productImages: comboImages,
        itemCount: comboList.length,
        glowColor: "rgba(168, 85, 247, 0.6)",
        badge: "Super Value",
        targetUrl: "/menu?category=combo",
      },
      {
        id: "beverage",
        name: "Beverages",
        defaultImage:
          "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=400&q=80",
        productImages: beverageImages,
        itemCount: beverageProducts.length,
        glowColor: "rgba(59, 130, 246, 0.6)",
        targetUrl: "/menu?category=beverage",
      },
      {
        id: "dessert",
        name: "Desserts",
        defaultImage:
          "https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=400&q=80",
        productImages: dessertImages,
        itemCount: dessertProducts.length,
        glowColor: "rgba(236, 72, 153, 0.6)",
        targetUrl: "/menu?category=dessert",
      },
    ];

    // Dynamic categories created by the Owner in Firestore
    const customOwnerCategories: CategoryItem[] = (specialCategories || [])
      .filter((sc) => sc.isActive !== false && sc.status !== "draft")
      .map((sc) => {
        const scImages: CategoryProductImage[] = (sc.items || [])
          .filter((item: any) => item.image || item.imageUrl)
          .map((item: any) => ({
            image: item.image || item.imageUrl,
            name: item.name || item.productName || sc.name,
          }));

        return {
          id: sc.id,
          name: sc.name || "Special Category",
          defaultImage:
            sc.bannerImage ||
            sc.imageUrl ||
            "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400&q=80",
          productImages: scImages,
          glowColor: sc.themeColor ? `${sc.themeColor}aa` : "rgba(249, 115, 22, 0.6)",
          badge: sc.badges?.[0] || sc.templateType || "Chef Pick",
          itemCount: sc.items?.length || (sc.bannerImage ? 1 : 0),
          isRecommended: sc.isRecommended || false,
          targetUrl: `/menu?category=${encodeURIComponent(sc.id)}`,
        };
      });

    // RULE: Show category ONLY if itemCount > 0
    const combined = [...customOwnerCategories, ...coreCategories];
    return combined.filter((cat) => cat.itemCount > 0);
  }, [specialCategories, products, combos]);

  // Track section view
  useEffect(() => {
    trackEvent({ type: "section_view", sectionId: "menu_categories" } as any);
  }, []);

  // Empty State if no products loaded yet
  if (!isInitialized && categoryList.length === 0) {
    return (
      <section className="py-8 sm:py-12 relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4 justify-items-center animate-pulse">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex flex-col items-center space-y-2">
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-white/5 border border-white/10" />
                <div className="w-16 h-3.5 bg-white/5 rounded-full" />
                <div className="w-10 h-2.5 bg-white/5 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (categoryList.length === 0) {
    return (
      <section className="py-10 relative z-10 text-center">
        <div className="max-w-md mx-auto p-6 sm:p-8 rounded-3xl bg-dark-900/80 border border-white/10 backdrop-blur-xl">
          <ChefHat className="w-12 h-12 text-primary-400 mx-auto mb-3 animate-pulse" />
          <h3 className="text-xl font-black text-white mb-2">Menu is being prepared</h3>
          <p className="text-slate-400 text-xs font-medium leading-relaxed">
            Our chefs are firing up the wood-fired ovens. Check back in a moment!
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="relative py-8 sm:py-12 overflow-hidden z-10">
      {/* Background ambient lighting */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-6xl h-40 bg-gradient-to-r from-orange-500/10 via-amber-500/5 to-emerald-500/10 blur-3xl pointer-events-none rounded-full" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* ── Section Header ── */}
        <div className="flex items-end justify-between mb-6 sm:mb-8">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 backdrop-blur-md mb-2">
              <Sparkles className="w-3.5 h-3.5 text-primary-400 animate-spin" />
              <span className="text-[11px] font-black uppercase tracking-wider text-primary-300">
                Explore Categories
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-white tracking-tight">
              What are you{" "}
              <span className="bg-gradient-to-r from-primary-400 via-amber-300 to-orange-500 bg-clip-text text-transparent">
                craving today?
              </span>
            </h2>
          </div>

          <span className="hidden sm:inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 bg-white/5 px-3 py-1 rounded-full border border-white/5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            Auto-rotates every 5s
          </span>
        </div>

        {/* ── Domino's-Style Responsive Grid Layout ── */}
        {/* Mobile: 3 columns | Tablet: 4 columns | Desktop: 6-8 columns */}
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 gap-y-6 gap-x-2 sm:gap-x-4 md:gap-x-6 justify-items-center">
          {categoryList.map((cat, idx) => (
            <CategoryCircleItem key={cat.id} category={cat} index={idx} />
          ))}
        </div>
      </div>
    </section>
  );
}
