import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';
import { ShoppingBag, ChevronRight, Sparkles } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router';
import { useCartStore } from '../../lib/store';

export default function FloatingCart() {
  const location = useLocation();
  
  // Hide on tracking, checkout, cart, or order detail pages
  const p = location.pathname;
  const isHiddenPage = [
    '/cart',
    '/checkout',
    '/order-tracking',
    '/tracking',
    '/track',
    '/order-success',
    '/recheck-order',
    '/processing-order',
    '/order/',
    '/orders/',
    '/order-details',
    '/owner',
    '/delivery'
  ].some(prefix => p === prefix || p.startsWith(prefix));

  if (isHiddenPage) return null;

  const { items, total } = useCartStore();
  const navigate = useNavigate();
  const count = items.reduce((acc, item) => acc + item.quantity, 0);
  const cartControls = useAnimation();
  const bagControls = useAnimation();
  const shockwaveControls = useAnimation();
  const [particles, setParticles] = useState<{ id: number; x: number; y: number }[]>([]);

  useEffect(() => {
    const handleImpact = () => {
      // 1. Bag elastic squeeze & bounce
      bagControls.start({
        scale: [1, 1.42, 0.85, 1.15, 1],
        rotate: [-6, 10, -5, 2, 0],
        transition: { duration: 0.5, ease: 'easeOut' }
      });

      // 2. Shockwave halo expansion from the bag
      shockwaveControls.start({
        scale: [0.8, 2.2],
        opacity: [0.9, 0],
        transition: { duration: 0.55, ease: 'easeOut' }
      });

      // 3. Floating cart bar bounce and glow
      cartControls.start({
        scale: [1, 1.05, 0.97, 1.02, 1],
        boxShadow: [
          '0 10px 40px rgba(85,119,90,0.4)',
          '0 20px 60px rgba(249,115,22,0.85)',
          '0 10px 40px rgba(85,119,90,0.4)'
        ],
        transition: { duration: 0.5, ease: 'easeInOut' }
      });

      // 4. Golden spark particles explosion from the shopping bag
      const newParticles = Array.from({ length: 8 }).map((_, i) => ({
        id: Date.now() + i,
        x: (Math.random() - 0.5) * 110,
        y: -15 - Math.random() * 70
      }));
      setParticles(prev => [...prev, ...newParticles]);
      
      setTimeout(() => {
        setParticles(prev => prev.filter(p => !newParticles.find(n => n.id === p.id)));
      }, 900);
    };

    window.addEventListener('cart-item-added', handleImpact);
    window.addEventListener('cart-bag-impact', handleImpact);
    return () => {
      window.removeEventListener('cart-item-added', handleImpact);
      window.removeEventListener('cart-bag-impact', handleImpact);
    };
  }, [cartControls, bagControls, shockwaveControls]);

  return (
    <AnimatePresence>
      {count > 0 && (
        <motion.div
          initial={{ y: 150, opacity: 0, scale: 0.8 }}
          animate={{ y: [-3, 3, -3], opacity: 1, scale: 1 }}
          exit={{ y: 150, opacity: 0, scale: 0.8 }}
          transition={{ 
            y: { duration: 4, repeat: Infinity, ease: 'easeInOut' },
            opacity: { duration: 0.3 },
            scale: { type: 'spring', damping: 20, stiffness: 200 }
          }}
          className="fixed left-4 right-4 md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-md z-[70] pointer-events-none"
          style={{ bottom: 'var(--app-floating-bottom-offset, calc(72px + env(safe-area-inset-bottom, 0px) + 12px))' }}
        >
          {/* Continuous Idle Animation Wrapper */}
          <motion.div
             animate={{ y: [0, -5, 0] }}
             transition={{ repeat: Infinity, duration: 3.2, ease: 'easeInOut' }}
             className="w-full relative"
          >
            <motion.button
              animate={cartControls}
              onClick={() => navigate('/cart')}
              id="cart-icon-target"
              className="w-full bg-gradient-to-r from-primary-600 via-primary-500 to-amber-600 rounded-3xl p-3.5 sm:p-4 shadow-[0_12px_45px_rgba(249,115,22,0.45)] border border-primary-400/30 flex items-center justify-between text-white pointer-events-auto active:scale-95 transition-transform group relative overflow-hidden"
            >
              {/* Soft breathing background glow */}
              <motion.div 
                 className="absolute inset-0 bg-gradient-to-r from-orange-400/20 via-amber-400/20 to-primary-400/20 mix-blend-overlay"
                 animate={{ opacity: [0, 0.6, 0] }}
                 transition={{ repeat: Infinity, duration: 2.2, ease: 'easeInOut' }}
              />

              {/* ── Left Corner: 3D Shopping Bag Container & Impact Target ── */}
              <div className="flex items-center gap-3.5 sm:gap-4 relative z-10">
                <div className="relative">
                  {/* Shockwave Halo ring on drop */}
                  <motion.div
                    animate={shockwaveControls}
                    initial={{ scale: 0.8, opacity: 0 }}
                    className="absolute -inset-2.5 rounded-2xl bg-gradient-to-r from-orange-400 to-amber-300 blur-sm pointer-events-none z-0"
                  />

                  {/* 3D Shopping Bag element */}
                  <motion.div
                    animate={bagControls}
                    id="floating-cart-bag-icon"
                    className="relative z-10 bg-dark-900/90 border-2 border-amber-400/80 p-2.5 sm:p-3 rounded-2xl shadow-[0_4px_16px_rgba(0,0,0,0.5),inset_0_2px_4px_rgba(255,255,255,0.2)] flex items-center justify-center group-hover:scale-105 transition-transform"
                    style={{
                      background: 'linear-gradient(135deg, rgba(30,30,30,0.95) 0%, rgba(15,15,15,0.98) 100%)',
                      boxShadow: 'inset 0 1px 3px rgba(255,255,255,0.3), 0 8px 24px rgba(249,115,22,0.35)'
                    }}
                  >
                    <ShoppingBag className="w-6 h-6 text-amber-400 drop-shadow-[0_2px_8px_rgba(251,191,36,0.6)]" />

                    {/* Live Bouncing Badge on Corner */}
                    <motion.div
                      key={count}
                      initial={{ scale: 0, rotate: -45 }}
                      animate={{ scale: [0.6, 1.3, 1], rotate: [0, 15, 0] }}
                      transition={{ type: 'spring', damping: 10, stiffness: 300 }}
                      className="absolute -top-2 -right-2 bg-gradient-to-br from-amber-400 via-orange-500 to-red-500 text-white text-[11px] font-black min-w-[22px] h-[22px] px-1 flex items-center justify-center rounded-full border-2 border-dark-900 shadow-lg"
                    >
                      {count}
                    </motion.div>
                  </motion.div>
                </div>
                
                <div className="text-left flex-1 min-w-0">
                  <p className="text-xs sm:text-sm font-bold text-white/90 truncate">
                    {count} {count === 1 ? 'Handcrafted Item' : 'Items in Cart'}
                  </p>
                  <motion.p 
                     key={total}
                     initial={{ y: 8, opacity: 0 }}
                     animate={{ y: 0, opacity: 1 }}
                     transition={{ duration: 0.2 }}
                     className="text-lg sm:text-xl font-black text-white tracking-tight leading-none drop-shadow-md"
                  >
                     ₹{total}
                  </motion.p>
                </div>
              </div>
              
              <div className="flex items-center gap-1 font-black text-xs sm:text-sm bg-white/20 hover:bg-white/30 text-white px-3.5 sm:px-4 py-2 rounded-xl group-hover:bg-white/25 transition-colors relative z-10 shadow-inner backdrop-blur-sm">
                View Cart <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </motion.button>

            {/* Sparkle Particles from Shopping Bag Mouth */}
            <AnimatePresence>
               {particles.map(p => (
                 <motion.div
                   key={p.id}
                   initial={{ opacity: 1, x: 20, y: 15, scale: 0 }}
                   animate={{ opacity: 0, x: 20 + p.x, y: 15 + p.y, scale: 1.6, rotate: p.x * 3 }}
                   exit={{ opacity: 0 }}
                   transition={{ duration: 0.85, ease: "easeOut" }}
                   className="absolute left-4 top-1/2 pointer-events-none text-amber-300 drop-shadow-[0_0_8px_rgba(251,191,36,0.8)] z-30"
                 >
                   <Sparkles className="w-5 h-5" />
                 </motion.div>
               ))}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

