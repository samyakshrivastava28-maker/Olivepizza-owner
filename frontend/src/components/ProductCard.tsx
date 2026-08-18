import { memo, useState } from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'framer-motion';
import { MenuItem } from '../types/models';
import { Plus, Star, Clock, Flame, Sparkles, SlidersHorizontal } from 'lucide-react';
import WishlistButton from './ui/WishlistButton';
import { useCartStore } from '../lib/store';
import { useCartAnimation } from './ui/CartAnimationProvider';
import toast from 'react-hot-toast';

interface ProductCardProps {
  item: MenuItem;
  discount?: number;
  wishlistIds?: string[];
  onOpenCustomization?: (item: MenuItem) => void;
}

export default memo(function ProductCard({ item, discount = 0, wishlistIds = [], onOpenCustomization }: ProductCardProps) {
  const navigate = useNavigate();
  const addItem = useCartStore((state) => state.addItem);
  const { triggerAnimation } = useCartAnimation();

  const appliedDiscount = item.discountPercentage || discount;
  const finalPrice = item.pricingMode === 'offer' && item.offerPrice ? item.offerPrice : 
                     appliedDiscount > 0 ? Math.round(item.basePrice * (1 - appliedDiscount / 100)) : item.basePrice;

  const handleCardClick = () => {
    if (item.isAvailable) {
      if (onOpenCustomization) {
        onOpenCustomization(item);
      } else {
        navigate(`/product/${item.id}`);
      }
    }
  };

  const handleQuickAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!item.isAvailable) return;

    triggerAnimation(e, item.image, () => {
      addItem({
        id: item.id || '',
        menuItemId: item.id || '',
        name: item.name,
        price: finalPrice,
        quantity: 1,
        image: item.image,
        isVegetarian: item.isVegetarian,
        crust: 'Classic Crust',
        size: 'Medium'
      });

      toast.success(`Added ${item.name} to cart! 🍕`, {
        style: { background: '#1e1e1e', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }
      });
    });
  };

  const isPizza = item.category === 'pizza' || item.name.toLowerCase().includes('pizza');
  const rating = (4.2 + (Math.abs((item.name || '').length % 7) * 0.1)).toFixed(1);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ 
        y: -8, 
        scale: 1.02,
        boxShadow: "0 20px 40px rgba(0,0,0,0.6), 0 0 25px rgba(85,119,90,0.25)" 
      }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 350, damping: 24 }}
      onClick={handleCardClick}
      className={`bg-dark-900/90 border border-white/12 rounded-2xl md:rounded-3xl overflow-hidden flex flex-col relative transition-all duration-300 shadow-xl group ${
        item.isAvailable ? 'cursor-pointer hover:border-primary-500/50' : 'opacity-60 grayscale cursor-not-allowed'
      }`}
    >
      {/* Glow highlight effect on card hover */}
      <motion.div 
        className="absolute inset-0 bg-gradient-to-tr from-primary-500/10 via-transparent to-amber-500/10 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-500 z-0"
      />

      {/* Top Left: Star Rating Badge (Animated Pulsing Glow) */}
      <motion.div 
        animate={{ scale: [1, 1.05, 1] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute top-3 left-3 bg-dark-950/85 backdrop-blur-md border border-amber-400/40 text-amber-400 text-xs font-black px-2.5 py-1 rounded-full flex items-center gap-1 z-10 shadow-lg"
      >
        <Star className="w-3.5 h-3.5 fill-amber-400 animate-pulse" />
        <span>{rating}</span>
      </motion.div>

      {/* Top Right: Wishlist Heart Button */}
      <div className="absolute top-3 right-3 z-10" onClick={(e) => e.stopPropagation()}>
        <WishlistButton productId={item.id || ''} wishlistIds={wishlistIds} size="sm" />
      </div>

      {/* Discount Badge */}
      {appliedDiscount > 0 && item.isAvailable && (
        <motion.div 
          animate={{ x: [0, 2, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="absolute top-11 left-3 bg-gradient-to-r from-accent-500 to-amber-400 text-dark-950 text-[10px] font-black px-2.5 py-0.5 rounded-full shadow-lg z-10 border border-white/20"
        >
          {appliedDiscount}% OFF
        </motion.div>
      )}

      {/* Large Steaming Food Image Container */}
      <div className="w-full aspect-[4/3] relative overflow-hidden bg-dark-950/60 border-b border-white/5">
        <motion.img 
          src={item.image.includes('cloudinary') ? item.image.replace("/upload/", "/upload/f_auto,q_auto,w_400/") : item.image} 
          alt={item.name} 
          loading="lazy"
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
          animate={{ y: [0, -3, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        />
        
        {/* Steam overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-dark-900 via-dark-900/20 to-transparent opacity-90" />

        {!item.isAvailable && (
          <div className="absolute inset-0 bg-dark-950/80 backdrop-blur-sm flex items-center justify-center z-10">
            <span className="bg-dark-900 border border-white/10 text-slate-300 text-xs font-bold px-3.5 py-1.5 rounded-full uppercase tracking-wider shadow-lg">
              Sold Out
            </span>
          </div>
        )}
      </div>

      {/* Product Body Information */}
      <div className="p-3.5 sm:p-4 md:p-5 flex flex-col flex-1 relative z-10">
        
        {/* Title */}
        <h3 className="text-sm sm:text-base md:text-lg font-bold text-white leading-tight mb-1 truncate group-hover:text-amber-200 transition-colors">
          {item.name}
        </h3>

        {/* Prep Time & Subtext */}
        <div className="flex items-center gap-2 text-[11px] text-slate-400 mb-2">
          <span className="flex items-center gap-1"><Clock size={12} className="text-accent-400" /> 15-20 min</span>
          <span>•</span>
          <span className={`font-bold ${item.isVegetarian ? 'text-emerald-400' : 'text-rose-400'}`}>
            {item.isVegetarian ? 'Veg 🌿' : 'Non-veg 🍖'}
          </span>
          <span>•</span>
          <span className="text-amber-400 font-bold flex items-center gap-0.5"><Flame size={10} /> Popular</span>
        </div>

        <p className="text-xs text-slate-400 line-clamp-2 mb-4 font-normal leading-relaxed">
          {item.description}
        </p>

        {/* Footer: Price & Add Button */}
        <div className="mt-auto flex items-center justify-between gap-2 pt-2 border-t border-white/8">
          <div className="flex flex-col">
            {appliedDiscount > 0 ? (
              <>
                <span className="text-[10px] text-slate-500 line-through font-medium">₹{item.basePrice}</span>
                <span className="text-base sm:text-lg font-black text-amber-400 drop-shadow-[0_2px_10px_rgba(245,158,11,0.3)]">
                  ₹{finalPrice}
                </span>
              </>
            ) : (
              <span className="text-base sm:text-lg font-black text-white">₹{finalPrice}</span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {isPizza && onOpenCustomization && (
              <motion.button
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.9 }}
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenCustomization(item);
                }}
                className="p-2.5 rounded-xl bg-dark-800 hover:bg-dark-700 text-slate-300 transition-colors border border-white/10 min-touch-target shadow-md"
                title="Customize Crust & Cheese"
              >
                <SlidersHorizontal size={14} />
              </motion.button>
            )}

            <motion.button 
              whileHover={{ scale: 1.06, boxShadow: "0 0 15px rgba(85,119,90,0.5)" }}
              whileTap={{ scale: 0.92 }}
              disabled={!item.isAvailable}
              onClick={handleQuickAdd}
              className={`min-touch-target px-4 py-2.5 rounded-full font-bold text-xs sm:text-sm flex items-center gap-1.5 transition-all shadow-lg ${
                item.isAvailable 
                  ? 'bg-gradient-to-r from-[#354a3a] to-[#425e47] hover:from-[#425e47] hover:to-[#55775a] text-white border border-emerald-400/40' 
                  : 'bg-dark-800 border border-dark-700 text-slate-500'
              }`}
            >
              <Plus className="w-4 h-4" />
              Add
            </motion.button>
          </div>
        </div>
      </div>
    </motion.div>
  );
});
