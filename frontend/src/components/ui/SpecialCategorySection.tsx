import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import { trackEvent } from '../../lib/analytics';
import CountdownTimer from './CountdownTimer';
import { useCartAnimation } from './CartAnimationProvider';
import ComboCard from './ComboCard';
import WishlistButton from './WishlistButton';
import { useCartStore } from '../../lib/store';
import toast from 'react-hot-toast';

interface SpecialItem {
  type: 'product' | 'combo';
  // product
  productId?: string;
  promoDiscount?: number;
  promoType?: 'percentage' | 'flat' | 'free_item';
  promoText?: string;
  // combo
  id?: string;
  name?: string;
  description?: string;
  image?: string;
  price?: number;
  originalTotal?: number;
  productIds?: string[];
}

interface SpecialCategory {
  id: string;
  name: string;
  description?: string;
  bannerImage?: string;
  themeColor?: string;
  featuredProductId?: string;
  badges?: string[];
  countdown?: { enabled: boolean; targetDate: string };
  items: SpecialItem[];
}

interface Product {
  id: string;
  productName: string;
  imageUrl?: string;
  basePrice: number;
  isActive?: boolean;
  description?: string;
  category?: string;
}

interface SpecialCategorySectionProps {
  category: SpecialCategory;
  allProducts: Product[];
  wishlistIds?: string[];
  index?: number;
}

export default function SpecialCategorySection({
  category,
  allProducts,
  wishlistIds = [],
  index = 0,
}: SpecialCategorySectionProps) {
  const addItem = useCartStore((s) => s.addItem);
  const { triggerAnimation } = useCartAnimation();
  const sectionRef = useRef<HTMLDivElement>(null);
  const [expired, setExpired] = useState(false);

  // Analytics: track view on enter viewport
  useEffect(() => {
    if (!sectionRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          trackEvent({ type: 'category_view', categoryId: category.id });
          observer.disconnect();
        }
      },
      { threshold: 0.2 }
    );
    observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, [category.id]);

  const productItems = category.items.filter((i) => i.type === 'product');
  const comboItems = category.items.filter((i) => i.type === 'combo');

  const resolveProduct = (productId?: string): (Product & { promoPrice?: number; promoText?: string }) | null => {
    if (!productId) return null;
    const base = allProducts.find((p) => p.id === productId);
    if (!base) return null;
    const item = category.items.find((i) => i.type === 'product' && i.productId === productId);
    if (!item) return base;
    let promoPrice = base.basePrice;
    if (item.promoType === 'percentage' && item.promoDiscount) {
      promoPrice = base.basePrice * (1 - item.promoDiscount / 100);
    } else if (item.promoType === 'flat' && item.promoDiscount) {
      promoPrice = Math.max(0, base.basePrice - item.promoDiscount);
    }
    return { ...base, promoPrice: Math.round(promoPrice), promoText: item.promoText };
  };

  const themeColor = category.themeColor || '#f97316';

  if (expired) return null;

  return (
    <motion.section
      ref={sectionRef}
      initial={{ opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.1, duration: 0.6 }}
      className="relative overflow-hidden rounded-2xl md:rounded-3xl border border-white/10"
      style={{ background: `linear-gradient(135deg, ${themeColor}18 0%, #0f172a 60%)` }}
    >
      {/* Banner image */}
      {category.bannerImage && (
        <div className="absolute inset-0 opacity-20 pointer-events-none">
          <img
            src={category.bannerImage.replace('/upload/', '/upload/f_auto,q_auto,w_1400/')}
            alt=""
            className="w-full h-full object-cover"
          />
        </div>
      )}

      <div className="relative z-10 p-5 md:p-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex flex-wrap gap-2 mb-2">
              {category.badges?.map((badge) => (
                <span
                  key={badge}
                  className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border"
                  style={{
                    backgroundColor: `${themeColor}25`,
                    borderColor: `${themeColor}60`,
                    color: themeColor,
                  }}
                >
                  {badge}
                </span>
              ))}
            </div>
            <h2 className="text-2xl md:text-4xl font-black text-white" style={{ textShadow: `0 0 30px ${themeColor}50` }}>
              {category.name}
            </h2>
            {category.description && (
              <p className="text-slate-400 mt-1 text-sm md:text-base">{category.description}</p>
            )}
          </div>

          {/* Countdown */}
          {category.countdown?.enabled && category.countdown.targetDate && !expired && (
            <div className="flex flex-col items-start md:items-end gap-1">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Ends in</span>
              <CountdownTimer
                targetDate={category.countdown.targetDate}
                onExpired={() => setExpired(true)}
              />
            </div>
          )}
        </div>

        {/* Featured Product (hero display) */}
        {category.featuredProductId && (() => {
          const fp = resolveProduct(category.featuredProductId);
          if (!fp) return null;
          return (
            <div
              className="mb-6 p-4 md:p-6 rounded-2xl border flex flex-col md:flex-row gap-5 items-center"
              style={{ borderColor: `${themeColor}40`, backgroundColor: `${themeColor}10` }}
            >
              {fp.imageUrl && (
                <img
                  src={fp.imageUrl.replace('/upload/', '/upload/f_auto,q_auto,w_400/')}
                  alt={fp.productName}
                  className="w-full md:w-48 h-36 md:h-40 object-cover rounded-xl shadow-xl"
                  loading="lazy"
                />
              )}
              <div className="flex-1">
                <span
                  className="text-xs font-black uppercase tracking-widest px-2 py-1 rounded-full mb-2 inline-block"
                  style={{ backgroundColor: `${themeColor}25`, color: themeColor }}
                >
                  ⭐ Featured Item
                </span>
                <h3 className="text-xl md:text-2xl font-black text-white">{fp.productName}</h3>
                {fp.description && <p className="text-slate-400 text-sm mt-1 line-clamp-2">{fp.description}</p>}
                {fp.promoText && (
                  <p className="font-bold text-sm mt-1" style={{ color: themeColor }}>{fp.promoText}</p>
                )}
                <div className="flex items-center gap-3 mt-3">
                  <span className="text-2xl font-black text-white">₹{fp.promoPrice ?? fp.basePrice}</span>
                  {fp.promoPrice && fp.promoPrice < fp.basePrice && (
                    <span className="text-slate-500 line-through text-sm">₹{fp.basePrice}</span>
                  )}
                  <WishlistButton productId={fp.id} wishlistIds={wishlistIds} size="sm" />
                </div>
                <button
                  onClick={(e) => {
                    triggerAnimation(e, fp.imageUrl || '', () => {
                      addItem({ id: fp.id, productId: fp.id, productName: fp.productName, price: fp.promoPrice ?? fp.basePrice, quantity: 1, imageUrl: fp.imageUrl || '' } as any);
                      trackEvent({ type: 'category_product_click', categoryId: category.id, productId: fp.id });
                      toast.success(`${fp.productName} added!`);
                    });
                  }}
                  className="mt-3 px-6 py-2.5 rounded-xl font-bold text-sm text-white transition-all active:scale-95"
                  style={{ backgroundColor: themeColor }}
                >
                  Add to Cart
                </button>
              </div>
            </div>
          );
        })()}

        {/* Product grid */}
        {productItems.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4 mb-6">
            {productItems.map((item) => {
              const p = resolveProduct(item.productId);
              if (!p || !p.isActive) return null;
              if (p.id === category.featuredProductId) return null; // skip featured
              return (
                <motion.div
                  key={p.id}
                  whileHover={{ y: -4 }}
                  className="bg-dark-900/60 border border-white/5 rounded-xl overflow-hidden group hover:border-white/20 transition-all"
                >
                  <div className="relative aspect-square">
                    {p.imageUrl ? (
                      <img
                        src={p.imageUrl.replace('/upload/', '/upload/f_auto,q_auto,w_300/')}
                        alt={p.productName}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-400"
                        loading="lazy"
                        onClick={() => trackEvent({ type: 'category_product_click', categoryId: category.id, productId: p.id })}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-3xl bg-dark-800">🍕</div>
                    )}
                    <div className="absolute top-2 right-2">
                      <WishlistButton productId={p.id} wishlistIds={wishlistIds} size="sm" />
                    </div>
                    {item.promoText && (
                      <div
                        className="absolute bottom-0 left-0 right-0 text-center text-[10px] font-bold py-1 text-white"
                        style={{ backgroundColor: `${themeColor}cc` }}
                      >
                        {item.promoText}
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="font-bold text-white text-sm line-clamp-1">{p.productName}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="font-black text-white">₹{p.promoPrice ?? p.basePrice}</span>
                      {p.promoPrice && p.promoPrice < p.basePrice && (
                        <span className="text-xs text-slate-500 line-through">₹{p.basePrice}</span>
                      )}
                    </div>
                    <button
                      onClick={(e) => {
                        triggerAnimation(e, p.imageUrl || '', () => {
                          addItem({ id: p.id, productId: p.id, productName: p.productName, price: p.promoPrice ?? p.basePrice, quantity: 1, imageUrl: p.imageUrl || '' } as any);
                          trackEvent({ type: 'category_product_click', categoryId: category.id, productId: p.id });
                          toast.success(`${p.productName} added!`);
                        });
                      }}
                      className="mt-2 w-full py-1.5 rounded-lg text-white text-xs font-bold transition-all active:scale-95"
                      style={{ backgroundColor: themeColor }}
                    >
                      Add to Cart
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Combo grid */}
        {comboItems.length > 0 && (
          <div>
            <h3 className="text-lg font-black text-white mb-4 flex items-center gap-2">
              <span>🎁</span> Combo Deals
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {comboItems.map((combo, ci) => (
                <ComboCard
                  key={combo.id}
                  combo={{
                    id: combo.id!,
                    name: combo.name!,
                    description: combo.description,
                    image: combo.image,
                    price: combo.price!,
                    originalTotal: combo.originalTotal!,
                    isAvailable: true,
                    categoryId: category.id,
                  }}
                  wishlistIds={wishlistIds}
                  index={ci}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.section>
  );
}
