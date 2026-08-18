import { useRef, useCallback } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { Link } from 'react-router';
import { ShoppingBag, Heart } from 'lucide-react';
import { useCartStore } from '../../lib/store';
import { trackEvent } from '../../lib/analytics';
import WishlistButton from './WishlistButton';
import toast from 'react-hot-toast';
import { useCartAnimation } from './CartAnimationProvider';
import { getOptimizedImageUrl } from '../../lib/imageOptimizer';

interface LuxuryProductCardProps {
  product: any;
  wishlistIds: string[];
  index: number;
}

export default function LuxuryProductCard({ product, wishlistIds, index }: LuxuryProductCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const addItem = useCartStore((s) => s.addItem);
  const { triggerAnimation } = useCartAnimation();

  // 3D tilt motion values
  const rotateX = useMotionValue(0);
  const rotateY = useMotionValue(0);
  const scale = useMotionValue(1);

  const springRotateX = useSpring(rotateX, { stiffness: 200, damping: 25 });
  const springRotateY = useSpring(rotateY, { stiffness: 200, damping: 25 });
  const springScale = useSpring(scale, { stiffness: 300, damping: 25 });

  // Derive glow position from tilt
  const glowX = useTransform(springRotateY, [-15, 15], ["0%", "100%"]);
  const glowY = useTransform(springRotateX, [15, -15], ["0%", "100%"]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // Only apply 3D tilt on devices with hover/pointer capability
    if (window.matchMedia && !window.matchMedia('(hover: hover)').matches) return;
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const rx = ((e.clientY - centerY) / (rect.height / 2)) * -10;
    const ry = ((e.clientX - centerX) / (rect.width / 2)) * 10;
    rotateX.set(rx);
    rotateY.set(ry);
    scale.set(1.02);
  }, [rotateX, rotateY, scale]);

  const handleMouseLeave = useCallback(() => {
    rotateX.set(0);
    rotateY.set(0);
    scale.set(1);
  }, [rotateX, rotateY, scale]);

  const handleAddToCart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      triggerAnimation(e, product.imageUrl || "", () => {
        addItem({
          id: product.id,
          productId: product.id,
          productName: product.productName,
          price: product.basePrice,
          quantity: 1,
          imageUrl: product.imageUrl || "",
        } as any);
        trackEvent({ type: "product_view", productId: product.id });
        toast.success(`${product.productName} added!`, {
          style: {
            background: "#1e1e1e",
            color: "#fff",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "16px",
          },
        });
      });
    },
    [addItem, product, triggerAnimation]
  );

  const imageUrl = product.imageUrl
    ? product.imageUrl.replace("/upload/", "/upload/f_auto,q_auto,w_400/")
    : null;

  const isCombo = product.items?.length > 0;

  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      style={{
        rotateX: springRotateX,
        rotateY: springRotateY,
        scale: springScale,
        transformStyle: "preserve-3d",
        perspective: 800,
        willChange: "transform",
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="relative group cursor-pointer"
    >
      <Link to={`/product/${product.id}`} className="block">
        {/* Card body */}
        <div
          className="relative overflow-hidden rounded-2xl md:rounded-3xl"
          style={{
            background: "linear-gradient(145deg, rgba(30,30,30,0.95) 0%, rgba(18,18,18,0.98) 100%)",
            border: "1px solid rgba(255,255,255,0.07)",
            boxShadow: "0 20px 60px rgba(0,0,0,0.6), 0 4px 16px rgba(0,0,0,0.4)",
          }}
        >
          {/* Dynamic glow layer */}
          <motion.div
            className="absolute inset-0 z-0 rounded-2xl md:rounded-3xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500"
            style={{
              background: `radial-gradient(circle at ${glowX} ${glowY}, rgba(249,115,22,0.12) 0%, transparent 60%)`,
            }}
          />

          {/* Image */}
          <div className="relative aspect-square overflow-hidden">
            {imageUrl ? (
              <img
                src={getOptimizedImageUrl(imageUrl, { width: 500 })}
                alt={product.productName}
                loading="lazy"
                decoding="async"
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-5xl"
                style={{ background: "rgba(255,255,255,0.03)" }}>
                🍕
              </div>
            )}

            {/* Top overlay row */}
            <div className="absolute top-0 left-0 right-0 p-2.5 flex items-center justify-between z-10">
              {/* Veg/non-veg dot */}
              {product.isVegetarian !== undefined && (
                <div
                  className="w-5 h-5 rounded border-2 flex items-center justify-center shadow-md"
                  style={{
                    borderColor: product.isVegetarian ? "#22c55e" : "#ef4444",
                    background: product.isVegetarian
                      ? "rgba(34,197,94,0.15)"
                      : "rgba(239,68,68,0.15)",
                  }}
                >
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{
                      background: product.isVegetarian ? "#22c55e" : "#ef4444",
                    }}
                  />
                </div>
              )}

              <WishlistButton productId={product.id} wishlistIds={wishlistIds} size="sm" />
            </div>

            {/* Badges */}
            <div className="absolute bottom-2 left-2 flex gap-1.5 z-10">
              {isCombo && (
                <span
                  className="px-2 py-0.5 rounded-full text-[10px] font-black tracking-wide"
                  style={{
                    background: "linear-gradient(135deg, #7c3aed, #a855f7)",
                    color: "white",
                    boxShadow: "0 4px 12px rgba(139,92,246,0.4)",
                  }}
                >
                  COMBO
                </span>
              )}
              {product.discountPercentage > 0 && (
                <span
                  className="px-2 py-0.5 rounded-full text-[10px] font-black tracking-wide"
                  style={{
                    background: "linear-gradient(135deg, #f59e0b, #fbbf24)",
                    color: "#1a1a1a",
                    boxShadow: "0 4px 12px rgba(245,158,11,0.4)",
                  }}
                >
                  {product.discountPercentage}% OFF
                </span>
              )}
            </div>

            {/* Soft gradient over image */}
            <div
              className="absolute bottom-0 left-0 right-0 h-16 z-[5] pointer-events-none"
              style={{
                background: "linear-gradient(to top, rgba(18,18,18,1) 0%, transparent 100%)",
              }}
            />
          </div>

          {/* Card info */}
          <div className="p-3 md:p-4 relative z-10">
            <h3
              className="font-bold text-white text-xs sm:text-sm md:text-base line-clamp-2 min-h-[2rem] sm:min-h-[2.5rem] mb-1"
              style={{ letterSpacing: "-0.01em" }}
            >
              {product.productName}
            </h3>

            <div className="flex items-center justify-between mt-2">
              {/* Pricing */}
              <div className="flex flex-col leading-none">
                {product.discountPercentage > 0 && (
                  <span className="text-[10px] sm:text-[11px] text-slate-500 line-through">
                    ₹{product.basePrice}
                  </span>
                )}
                <span
                  className="text-sm sm:text-base md:text-lg font-black"
                  style={{ color: "#fb923c" }}
                >
                  ₹{product.discountPercentage > 0
                    ? Math.round(product.basePrice * (1 - product.discountPercentage / 100))
                    : product.basePrice}
                </span>
              </div>

              {/* Add button */}
              <motion.button
                onClick={handleAddToCart}
                whileTap={{ scale: 0.88 }}
                className="relative overflow-hidden flex items-center justify-center min-w-[38px] min-h-[38px] sm:w-10 sm:h-10 rounded-xl transition-all duration-200"
                style={{
                  background: "linear-gradient(135deg, #ea580c 0%, #f97316 100%)",
                  boxShadow: "0 4px 16px rgba(249,115,22,0.4)",
                }}
                aria-label={`Add ${product.productName} to cart`}
              >
                <ShoppingBag className="w-4 h-4 text-white" />
              </motion.button>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
