import { useState, memo } from 'react';
import { motion } from 'framer-motion';
import { Copy, Check, Tag, Clock, ShoppingBag } from 'lucide-react';
import { trackEvent } from '../../lib/analytics';
import toast from 'react-hot-toast';

interface CouponCardProps {
  coupon: {
    id: string;
    code: string;
    type: string;
    discountValue?: number;
    maxDiscount?: number;
    minOrderValue?: number;
    endDate?: string;
    description?: string;
    isFirstOrderOnly?: boolean;
    tiers?: { minAmount: number; discount: number }[];
  };
  index?: number;
}

export default memo(function CouponCard({ coupon, index = 0 }: CouponCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(coupon.code).then(() => {
      setCopied(true);
      trackEvent({ type: 'coupon_copy', couponId: coupon.id });
      toast.success(`Code "${coupon.code}" copied!`);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const getDiscountLabel = () => {
    if (coupon.type === 'percentage') return `${coupon.discountValue}% OFF`;
    if (coupon.type === 'fixed') return `₹${coupon.discountValue} OFF`;
    if (coupon.type === 'free_delivery') return 'Free Delivery';
    if (coupon.type === 'bogo') return 'Buy 1 Get 1';
    if (coupon.type === 'first_order') return 'First Order Deal';
    if (coupon.type === 'tier') return 'Tiered Discount';
    return '';
  };

  const daysLeft = () => {
    if (!coupon.endDate) return null;
    const diff = new Date(coupon.endDate).getTime() - Date.now();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days;
  };

  const days = daysLeft();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.4 }}
      style={{ willChange: 'transform, opacity' }}
      className="relative flex overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-[#1a2744] via-[#1E293B] to-[#0d1b35] shadow-xl group hover:border-primary-500/40 transition-all duration-300"
    >
      {/* Left color strip */}
      <div className="w-2 bg-gradient-to-b from-primary-500 to-primary-700 flex-shrink-0" />

      {/* Perforated edge */}
      <div className="flex flex-col justify-between py-3 px-1">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="w-3 h-3 rounded-full bg-dark-950 border border-white/5" />
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 p-4 md:p-5">
        <div className="flex justify-between items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <Tag className="w-3.5 h-3.5 text-primary-400 flex-shrink-0" />
              {coupon.isFirstOrderOnly && (
                <span className="text-[10px] bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                  First Order
                </span>
              )}
              {days !== null && days <= 3 && days > 0 && (
                <span className="text-[10px] bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider animate-pulse">
                  Ending Soon
                </span>
              )}
            </div>

            <h3 className="text-2xl md:text-3xl font-black text-white tracking-wider font-mono">
              {coupon.code}
            </h3>

            <p className="text-primary-400 font-bold text-sm mt-1">{getDiscountLabel()}</p>

            {coupon.description && (
              <p className="text-slate-400 text-xs mt-1 line-clamp-2">{coupon.description}</p>
            )}

            {/* Tier display */}
            {coupon.type === 'tier' && coupon.tiers && coupon.tiers.length > 0 && (
              <div className="mt-2 space-y-1">
                {coupon.tiers.slice(0, 2).map((t, i) => (
                  <div key={i} className="flex justify-between text-xs text-slate-400">
                    <span className="flex items-center gap-1"><ShoppingBag className="w-3 h-3" /> ≥ ₹{t.minAmount}</span>
                    <span className="text-green-400 font-bold">₹{t.discount} OFF</span>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
              {coupon.minOrderValue && coupon.minOrderValue > 0 && (
                <span>Min ₹{coupon.minOrderValue}</span>
              )}
              {coupon.maxDiscount && coupon.maxDiscount > 0 && coupon.type === 'percentage' && (
                <span>Max ₹{coupon.maxDiscount}</span>
              )}
              {coupon.endDate && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {days !== null && days > 0 ? `${days}d left` : 'Expires ' + new Date(coupon.endDate).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>

          {/* Copy button */}
          <button
            onClick={handleCopy}
            className={`flex-shrink-0 flex flex-col items-center gap-1 px-3 py-3 rounded-xl font-bold text-xs transition-all duration-300 ${
              copied
                ? 'bg-green-500/20 text-green-400 border border-green-500/40'
                : 'bg-primary-600/20 text-primary-400 border border-primary-500/40 hover:bg-primary-600/40 hover:text-white'
            }`}
          >
            {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>
    </motion.div>
  );
});
