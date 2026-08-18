import { Heart } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toggleWishlist } from '../../lib/wishlist';
import { useAuthStore } from '../../lib/store';
import { useNavigate } from 'react-router';
import toast from 'react-hot-toast';

interface WishlistButtonProps {
  productId: string;
  wishlistIds: string[];
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizes = {
  sm: 'w-7 h-7',
  md: 'w-9 h-9',
  lg: 'w-11 h-11',
};
const iconSizes = {
  sm: 'w-3.5 h-3.5',
  md: 'w-4 h-4',
  lg: 'w-5 h-5',
};

export default function WishlistButton({
  productId,
  wishlistIds,
  size = 'md',
  className = '',
}: WishlistButtonProps) {
  const { user, isAuthenticated } = useAuthStore();
  const navigate = useNavigate();
  const isSaved = wishlistIds.includes(productId);

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isAuthenticated || !user) {
      toast.error('Please log in to save items');
      navigate('/login');
      return;
    }
    await toggleWishlist(user.uid, productId, wishlistIds);
    toast.success(isSaved ? 'Removed from saved items' : '❤️ Saved!');
  };

  return (
    <button
      onClick={handleClick}
      aria-label={isSaved ? 'Remove from wishlist' : 'Save to wishlist'}
      className={`flex items-center justify-center rounded-full border transition-all duration-200 ${sizes[size]} ${
        isSaved
          ? 'bg-red-500/20 border-red-500/60 text-red-400 hover:bg-red-500/30'
          : 'bg-dark-900/80 border-white/10 text-slate-400 hover:border-red-500/40 hover:text-red-400'
      } ${className}`}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={isSaved ? 'saved' : 'unsaved'}
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.5, opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <Heart
            className={`${iconSizes[size]} transition-all`}
            fill={isSaved ? 'currentColor' : 'none'}
          />
        </motion.div>
      </AnimatePresence>
    </button>
  );
}
