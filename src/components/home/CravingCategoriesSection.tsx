import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router';
import { Sparkles, Utensils, Flame } from 'lucide-react';
import { useDataStore } from '../../lib/dataStore';

interface CravingProductItem {
  id: string;
  name: string;
  image: string;
}

interface CravingCategory {
  id: string;
  name: string;
  defaultImage: string;
  products: CravingProductItem[];
  itemCount: number;
  glowColor: string;
  badge?: string;
  targetUrl: string;
}

// ─── Individual Category Card with 4-Second Product Rotation & Floating 3D Visual ───
function CravingCategoryCard({
  category,
  index,
}: {
  category: CravingCategory;
  index: number;
}) {
  const navigate = useNavigate();
  const [currentImgIndex, setCurrentImgIndex] = useState(0);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  // Check prefers-reduced-motion
  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      setPrefersReducedMotion(mediaQuery.matches);
      const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
      mediaQuery.addEventListener('change', handler);
      return () => mediaQuery.removeEventListener('change', handler);
    }
  }, []);

  // Real Available Products list
  const productList = useMemo(() => {
    if (category.products && category.products.length > 0) {
      return category.products;
    }
    return [{ id: category.id, name: category.name, image: category.defaultImage }];
  }, [category.products, category.defaultImage, category.id, category.name]);

  // 4-Second Rotation Timer Strategy
  useEffect(() => {
    if (productList.length <= 1) return;
    const timer = setInterval(() => {
      if (!document.hidden) {
        setCurrentImgIndex((prev) => (prev + 1) % productList.length);
      }
    }, 4000);

    return () => clearInterval(timer);
  }, [productList.length]);

  // Preload next image in memory for flicker-free 60fps rotation
  useEffect(() => {
    if (productList.length <= 1) return;
    const nextIdx = (currentImgIndex + 1) % productList.length;
    if (productList[nextIdx]?.image) {
      const img = new Image();
      img.src = productList[nextIdx].image;
    }
  }, [currentImgIndex, productList]);

  const activeProduct = productList[currentImgIndex % productList.length] || {
    name: category.name,
    image: category.defaultImage,
  };

  const handleClick = useCallback(() => {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try { navigator.vibrate(15); } catch {}
    }
    navigate(category.targetUrl);
  }, [category.targetUrl, navigate]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.92 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, margin: '-30px' }}
      transition={{
        duration: 0.5,
        delay: index * 0.06,
        ease: [0.16, 1, 0.3, 1],
      }}
      onClick={handleClick}
      className="flex flex-col items-center group cursor-pointer select-none text-center shrink-0 w-[115px] sm:w-[135px] md:w-[150px] lg:w-[165px]"
      role="button"
      tabIndex={0}
      aria-label={`Category ${category.name}, ${category.itemCount} items available`}
    >
      {/* ── Floating 3D Container ── */}
      <motion.div
        animate={
          prefersReducedMotion
            ? {}
            : {
                y: [0, -6, 0],
                rotate: index % 2 === 0 ? [-0.8, 0.8, -0.8] : [0.8, -0.8, 0.8],
              }
        }
        transition={{
          duration: 4.2 + (index % 3) * 0.4,
          repeat: Infinity,
          ease: 'easeInOut',
          delay: (index * 0.15) % 2,
        }}
        whileHover={{
          scale: 1.08,
          y: -10,
          transition: { duration: 0.25, ease: 'easeOut' },
        }}
        whileTap={{ scale: 0.94 }}
        className="relative mb-3 flex flex-col items-center"
      >
        {/* Radial Ambient Glow */}
        <div
          className="absolute -inset-4 rounded-full opacity-35 group-hover:opacity-100 transition-opacity duration-500 blur-2xl pointer-events-none transform-gpu"
          style={{
            background: `radial-gradient(circle at center, ${category.glowColor} 0%, transparent 70%)`,
          }}
        />

        {/* ── 3D Circular Glassmorphic Card Frame ── */}
        <div
          className="relative w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 rounded-full p-1.5 border-2 border-white/20 group-hover:border-primary-400 transition-all duration-300 shadow-[0_12px_35px_rgba(0,0,0,0.8)] overflow-hidden flex items-center justify-center bg-dark-900/90 transform-gpu group-hover:shadow-[0_16px_40px_rgba(249,115,22,0.45)]"
          style={{
            backdropFilter: 'blur(16px)',
            boxShadow: 'inset 0 2px 8px rgba(255,255,255,0.2), 0 12px 30px rgba(0,0,0,0.85)',
          }}
        >
          {/* Dynamic 4-Second Morphing Image Transition */}
          <AnimatePresence mode="wait">
            <motion.img
              key={activeProduct.image}
              src={activeProduct.image}
              alt={activeProduct.name}
              initial={{
                opacity: 0,
                scale: 0.88,
                translateY: 8,
                filter: 'blur(4px)',
              }}
              animate={{
                opacity: 1,
                scale: 1,
                translateY: 0,
                filter: 'blur(0px)',
              }}
              exit={{
                opacity: 0,
                scale: 0.88,
                translateY: -8,
                filter: 'blur(4px)',
              }}
              transition={{
                duration: 0.55,
                ease: [0.16, 1, 0.3, 1],
              }}
              loading="lazy"
              className="w-full h-full object-cover rounded-full group-hover:scale-110 transition-transform duration-700 pointer-events-none"
            />
          </AnimatePresence>

          {/* Premium Glass Lens Highlight */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-transparent via-white/5 to-white/30 pointer-events-none z-10" />

          {/* Optional Badge */}
          {category.badge && (
            <div className="absolute bottom-1.5 inset-x-0 z-20 flex justify-center">
              <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider text-white bg-gradient-to-r from-orange-500 to-amber-500 shadow-md backdrop-blur-md border border-white/20">
                {category.badge}
              </span>
            </div>
          )}
        </div>
      </motion.div>

      {/* ── Category Name & Rotating Product Name ── */}
      <div className="flex flex-col items-center w-full px-1">
        <h3 className="text-xs sm:text-sm font-black text-white group-hover:text-primary-400 transition-colors duration-200 tracking-tight line-clamp-1 w-full text-center">
          {category.name}
        </h3>
        <AnimatePresence mode="wait">
          <motion.span
            key={activeProduct.name}
            initial={{ opacity: 0, y: 3 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -3 }}
            transition={{ duration: 0.25 }}
            className="text-[10px] sm:text-[11px] font-semibold text-slate-400 group-hover:text-amber-300 transition-colors duration-200 mt-0.5 line-clamp-1 w-full text-center"
          >
            {activeProduct.name}
          </motion.span>
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ─── Main Craving Categories Section Component ───
export default function CravingCategoriesSection({ config }: { config?: any }) {
  const { specialCategories, products, combos, isInitialized } = useDataStore();

  // Dynamic category compilation from real data
  const cravingCategories = useMemo(() => {
    const validProducts = (products || []).filter((p) => p.isActive !== false);
    const validCombos = (combos || []).filter((c) => c.isActive !== false);

    // 1. Artisan Pizzas
    const pizzaList = validProducts.filter(
      (p) => (!p.category || p.category.toLowerCase().includes('pizza')) && !p.isComboOnly
    );
    const pizzaItems: CravingProductItem[] = pizzaList
      .filter((p) => (p.image || p.imageUrl) && typeof (p.image || p.imageUrl) === 'string')
      .map((p) => ({
        id: p.id,
        name: p.productName || p.name || 'Artisan Pizza',
        image: p.image || p.imageUrl,
      }));

    // 2. Gourmet Burgers
    const burgerList = validProducts.filter(
      (p) => p.category && (p.category.toLowerCase().includes('burger') || p.category.toLowerCase().includes('burgers'))
    );
    const burgerItems: CravingProductItem[] = burgerList
      .filter((p) => (p.image || p.imageUrl))
      .map((p) => ({
        id: p.id,
        name: p.productName || p.name || 'Gourmet Burger',
        image: p.image || p.imageUrl,
      }));

    // 3. Italian Pastas
    const pastaList = validProducts.filter(
      (p) => p.category && p.category.toLowerCase().includes('pasta')
    );
    const pastaItems: CravingProductItem[] = pastaList
      .filter((p) => (p.image || p.imageUrl))
      .map((p) => ({
        id: p.id,
        name: p.productName || p.name || 'Italian Pasta',
        image: p.image || p.imageUrl,
      }));

    // 4. Garlic Breads & Sides
    const sideList = validProducts.filter(
      (p) =>
        p.category &&
        (p.category.toLowerCase().includes('side') ||
          p.category.toLowerCase().includes('garlic') ||
          p.category.toLowerCase().includes('bread') ||
          p.category.toLowerCase().includes('starter') ||
          p.category.toLowerCase().includes('fries'))
    );
    const sideItems: CravingProductItem[] = sideList
      .filter((p) => (p.image || p.imageUrl))
      .map((p) => ({
        id: p.id,
        name: p.productName || p.name || 'Garlic Bread & Side',
        image: p.image || p.imageUrl,
      }));

    // 5. Value Combos
    const comboList = validCombos.length > 0 ? validCombos : validProducts.filter((p) => p.isComboOnly);
    const comboItems: CravingProductItem[] = comboList
      .filter((p) => (p.image || p.imageUrl))
      .map((p) => ({
        id: p.id,
        name: p.name || p.productName || 'Value Combo',
        image: p.image || p.imageUrl,
      }));

    // 6. Beverages & Shakes
    const beverageList = validProducts.filter(
      (p) =>
        p.category &&
        (p.category.toLowerCase().includes('beverage') ||
          p.category.toLowerCase().includes('drink') ||
          p.category.toLowerCase().includes('shake') ||
          p.category.toLowerCase().includes('coffee'))
    );
    const beverageItems: CravingProductItem[] = beverageList
      .filter((p) => (p.image || p.imageUrl))
      .map((p) => ({
        id: p.id,
        name: p.productName || p.name || 'Chilled Beverage',
        image: p.image || p.imageUrl,
      }));

    // 7. Desserts
    const dessertList = validProducts.filter(
      (p) =>
        p.category &&
        (p.category.toLowerCase().includes('dessert') ||
          p.category.toLowerCase().includes('sweet') ||
          p.category.toLowerCase().includes('cake') ||
          p.category.toLowerCase().includes('ice'))
    );
    const dessertItems: CravingProductItem[] = dessertList
      .filter((p) => (p.image || p.imageUrl))
      .map((p) => ({
        id: p.id,
        name: p.productName || p.name || 'Artisan Dessert',
        image: p.image || p.imageUrl,
      }));

    // Core Categories Array
    const coreList: CravingCategory[] = [
      {
        id: 'pizza',
        name: 'Pizzas',
        defaultImage: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400&q=80',
        products: pizzaItems,
        itemCount: pizzaItems.length,
        glowColor: 'rgba(249, 115, 22, 0.6)',
        badge: 'Popular',
        targetUrl: '/menu?category=pizza',
      },
      {
        id: 'burgers',
        name: 'Burgers',
        defaultImage: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&q=80',
        products: burgerItems,
        itemCount: burgerItems.length,
        glowColor: 'rgba(234, 179, 8, 0.6)',
        targetUrl: '/menu?category=burgers',
      },
      {
        id: 'pasta',
        name: 'Pastas',
        defaultImage: 'https://images.unsplash.com/photo-1621996346565-e3d5d6281691?w=400&q=80',
        products: pastaItems,
        itemCount: pastaItems.length,
        glowColor: 'rgba(239, 68, 68, 0.6)',
        targetUrl: '/menu?category=pasta',
      },
      {
        id: 'sides',
        name: 'Sides & Breads',
        defaultImage: 'https://images.unsplash.com/photo-1573140247632-f8fd74997d5c?w=400&q=80',
        products: sideItems,
        itemCount: sideItems.length,
        glowColor: 'rgba(16, 185, 129, 0.6)',
        targetUrl: '/menu?category=sides',
      },
      {
        id: 'combo',
        name: 'Value Combos',
        defaultImage: 'https://images.unsplash.com/photo-1544982503-9f984c14501a?w=400&q=80',
        products: comboItems,
        itemCount: comboItems.length,
        glowColor: 'rgba(168, 85, 247, 0.6)',
        badge: 'Super Value',
        targetUrl: '/menu?category=combo',
      },
      {
        id: 'beverage',
        name: 'Drinks & Shakes',
        defaultImage: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=400&q=80',
        products: beverageItems,
        itemCount: beverageItems.length,
        glowColor: 'rgba(59, 130, 246, 0.6)',
        targetUrl: '/menu?category=beverage',
      },
      {
        id: 'dessert',
        name: 'Desserts',
        defaultImage: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=400&q=80',
        products: dessertItems,
        itemCount: dessertItems.length,
        glowColor: 'rgba(236, 72, 153, 0.6)',
        targetUrl: '/menu?category=dessert',
      },
    ];

    // Dynamic Special Categories created by Owner in Firestore
    const customList: CravingCategory[] = (specialCategories || [])
      .filter((sc) => sc.isActive !== false && sc.status !== 'draft')
      .map((sc) => {
        const scProducts: CravingProductItem[] = (sc.items || [])
          .filter((item: any) => item.image || item.imageUrl)
          .map((item: any) => ({
            id: item.id || sc.id,
            name: item.name || item.productName || sc.name,
            image: item.image || item.imageUrl,
          }));

        return {
          id: sc.id,
          name: sc.name || 'Special Category',
          defaultImage: sc.bannerImage || sc.imageUrl || 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400&q=80',
          products: scProducts,
          itemCount: scProducts.length || (sc.bannerImage ? 1 : 0),
          glowColor: sc.themeColor ? `${sc.themeColor}aa` : 'rgba(249, 115, 22, 0.6)',
          badge: sc.badges?.[0] || 'Special',
          targetUrl: `/menu?category=${encodeURIComponent(sc.id)}`,
        };
      });

    // STRICT MANDATORY RULE: Show category ONLY if itemCount > 0 and has products
    const combined = [...customList, ...coreList];
    return combined.filter((cat) => cat.itemCount > 0 && cat.products.length > 0);
  }, [specialCategories, products, combos]);

  // Loading Skeleton State
  if (!isInitialized && cravingCategories.length === 0) {
    return (
      <section className="py-8 sm:py-12 relative z-10 max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center gap-3 mb-6 animate-pulse">
          <div className="w-32 h-6 bg-white/5 rounded-full" />
        </div>
        <div className="flex gap-4 overflow-hidden animate-pulse">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex flex-col items-center space-y-3 shrink-0 w-28">
              <div className="w-24 h-24 rounded-full bg-white/5 border border-white/10" />
              <div className="w-16 h-3 bg-white/5 rounded-full" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  // Gracefully disappear if no valid categories exist
  if (cravingCategories.length === 0) {
    return null;
  }

  const headline = config?.headline || "WHAT'S YOUR CRAVING FOR?";
  const subtitle = config?.subtitle || 'Explore our freshly handcrafted artisan creations & chef specials.';

  return (
    <section className="relative py-8 sm:py-12 overflow-hidden z-10">
      {/* Ambient background lighting */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-6xl h-48 bg-gradient-to-r from-orange-500/10 via-amber-500/5 to-purple-500/10 blur-3xl pointer-events-none rounded-full" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 sm:mb-10 gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-orange-500/15 via-amber-500/10 to-transparent border border-orange-500/30 backdrop-blur-md mb-2.5 shadow-[0_0_15px_rgba(249,115,22,0.15)]">
              <Flame className="w-3.5 h-3.5 text-orange-400 animate-pulse" />
              <span className="text-[11px] font-black uppercase tracking-wider bg-gradient-to-r from-orange-300 via-amber-200 to-white bg-clip-text text-transparent">
                ARTISAN SELECTIONS
              </span>
            </div>
            <h2 className="text-2xl sm:text-4xl md:text-5xl font-black text-white tracking-tight leading-tight">
              WHAT'S YOUR <span className="bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-300 bg-clip-text text-transparent">CRAVING</span> FOR?
            </h2>
            <p className="text-slate-400 text-xs sm:text-sm font-medium mt-1.5">
              {subtitle}
            </p>
          </div>

          <div className="hidden sm:flex items-center gap-2.5 text-xs font-bold text-slate-300 bg-white/5 px-4 py-2 rounded-full border border-white/10 shrink-0 shadow-lg backdrop-blur-md">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]" />
            <span>Live Chef Rotations</span>
          </div>
        </div>

        {/* Categories Flex Grid Layout (Mobile Horizontal Scroll / Responsive Desktop Grid) */}
        <div className="flex items-center gap-4 sm:gap-6 md:gap-8 overflow-x-auto custom-scrollbar pb-4 pt-2 -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap sm:justify-start">
          {cravingCategories.map((category, idx) => (
            <CravingCategoryCard key={category.id} category={category} index={idx} />
          ))}
        </div>
      </div>
    </section>
  );
}
