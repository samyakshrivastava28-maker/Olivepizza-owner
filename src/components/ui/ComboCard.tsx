import { memo } from 'react';
import { motion } from 'framer-motion';
import { ShoppingBag, Star, Zap } from 'lucide-react';
import { useCartStore } from '../../lib/store';
import { trackEvent } from '../../lib/analytics';
import WishlistButton from './WishlistButton';
import toast from 'react-hot-toast';
import { useCartAnimation } from './CartAnimationProvider';

interface ComboCardProps {
  combo: {
    id: string;
    name: string;
    description?: string;
    image?: string;
    price: number;
    originalTotal: number;
    productIds?: string[];
    isAvailable?: boolean;
    categoryId?: string;
  };
  wishlistIds?: string[];
  index?: number;
}

export default memo(function ComboCard({ combo, wishlistIds = [], index = 0 }: ComboCardProps) {
  const addItem = useCartStore((s) => s.addItem);
  const { triggerAnimation } = useCartAnimation();
  const savings = combo.originalTotal - combo.price;
  const savingsPct = Math.round((savings / combo.originalTotal) * 100);

  const handleAddToCart = (e: React.MouseEvent) => {
    if (!combo.isAvailable) return;
    triggerAnimation(e, combo.image || '', () => {
      addItem({
        id: `combo_${combo.id}`,
        productId: combo.id,
        productName: combo.name,
        price: combo.price,
        quantity: 1,
        imageUrl: combo.image || '',
        isCombo: true,
      } as any);
      trackEvent({ type: 'combo_purchase', comboId: combo.id });
      toast.success(`${combo.name} added to cart!`);
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.07, duration: 0.5 }}
      style={{ willChange: 'transform, opacity' }}
      className="relative bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460] border border-white/10 rounded-2xl overflow-hidden group hover:border-primary-500/40 hover:shadow-[0_0_30px_rgba(249,115,22,0.12)] transition-all duration-300"
    >
      {/* Savings badge */}
      <div className="absolute top-3 left-3 z-10 flex flex-col gap-1.5">
        {savingsPct > 0 && (
          <span className="bg-gradient-to-r from-red-500 to-orange-500 text-white text-xs font-black px-2.5 py-1 rounded-full shadow-lg">
            SAVE {savingsPct}%
          </span>
        )}
        <span className="bg-primary-600/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
          <Zap className="w-3 h-3" /> COMBO
        </span>
      </div>

      {/* Wishlist */}
      <div className="absolute top-3 right-3 z-10">
        <WishlistButton productId={combo.id} wishlistIds={wishlistIds} size="sm" />
      </div>

      {/* Image */}
      <div className="aspect-[16/9] relative overflow-hidden bg-dark-900">
        {combo.image ? (
          <img
            src={combo.image.replace('/upload/', '/upload/f_auto,q_auto,w_600/')}
            alt={combo.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-5xl">🍕🥤</div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-dark-950/80 to-transparent" />
      </div>

      {/* Content */}
      <div className="p-4">
        <h4 className="font-black text-white text-base md:text-lg mb-1 line-clamp-1">{combo.name}</h4>
        {combo.description && (
          <p className="text-slate-400 text-xs mb-3 line-clamp-2">{combo.description}</p>
        )}

        {/* Frequently Bought Together tag */}
        <div className="flex items-center gap-1 text-xs text-amber-400 font-bold mb-3">
          <Star className="w-3 h-3 fill-current" />
          <span>Popular Choice</span>
        </div>

        {/* Pricing */}
        <div className="flex items-end gap-2 mb-4">
          <span className="text-2xl font-black text-white">₹{combo.price}</span>
          {savings > 0 && (
            <>
              <span className="text-sm text-slate-500 line-through mb-0.5">₹{combo.originalTotal}</span>
              <span className="text-xs text-green-400 font-bold mb-0.5">You save ₹{savings}</span>
            </>
          )}
        </div>

        <button
          onClick={handleAddToCart}
          disabled={!combo.isAvailable}
          className={`w-full py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all duration-200 ${
            combo.isAvailable
              ? 'bg-primary-600 hover:bg-primary-500 text-white active:scale-95 shadow-lg shadow-primary-600/25'
              : 'bg-slate-700 text-slate-500 cursor-not-allowed'
          }`}
        >
          <ShoppingBag className="w-4 h-4" />
          {combo.isAvailable ? 'Add Combo to Cart' : 'Unavailable'}
        </button>
      </div>
    </motion.div>
  );
});
