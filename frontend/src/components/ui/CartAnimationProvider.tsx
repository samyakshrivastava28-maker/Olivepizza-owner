import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';

// ─── Types ──────────────────────────────────────────────────────────────────
interface AnimationData {
  id: number;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  image: string;
  onComplete?: () => void;
}

interface CartAnimationContextType {
  triggerAnimation: (
    e: React.MouseEvent | React.TouchEvent | { clientX: number; clientY: number },
    image: string,
    onComplete?: () => void
  ) => void;
}

const CartAnimationContext = createContext<CartAnimationContextType | undefined>(undefined);

// ─── Zero-Latency Audio Synthesizer ─────────────────────────────────────────
export const playCartDropSound = () => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;

    // 1. Impact Bass Thud (Satisfying physical landing)
    const oscBass = ctx.createOscillator();
    const gainBass = ctx.createGain();
    oscBass.type = 'triangle';
    oscBass.frequency.setValueAtTime(220, now);
    oscBass.frequency.exponentialRampToValueAtTime(45, now + 0.16);
    gainBass.gain.setValueAtTime(0.35, now);
    gainBass.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    oscBass.connect(gainBass);
    gainBass.connect(ctx.destination);
    oscBass.start(now);
    oscBass.stop(now + 0.2);

    // 2. Bright Golden Ding (Sweet chime on drop)
    const oscChime = ctx.createOscillator();
    const gainChime = ctx.createGain();
    oscChime.type = 'sine';
    oscChime.frequency.setValueAtTime(880, now + 0.02); // A5
    oscChime.frequency.exponentialRampToValueAtTime(1320, now + 0.12); // E6
    gainChime.gain.setValueAtTime(0.28, now + 0.02);
    gainChime.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
    oscChime.connect(gainChime);
    gainChime.connect(ctx.destination);
    oscChime.start(now + 0.02);
    oscChime.stop(now + 0.38);

    // 3. Crisp High Sparkle (Celebratory ping)
    const oscSparkle = ctx.createOscillator();
    const gainSparkle = ctx.createGain();
    oscSparkle.type = 'sine';
    oscSparkle.frequency.setValueAtTime(1760, now + 0.06); // A6
    gainSparkle.gain.setValueAtTime(0.18, now + 0.06);
    gainSparkle.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
    oscSparkle.connect(gainSparkle);
    gainSparkle.connect(ctx.destination);
    oscSparkle.start(now + 0.06);
    oscSparkle.stop(now + 0.28);
  } catch (e) {
    // Non-fatal
  }
};

const getCartTarget = (): { x: number; y: number } => {
  if (typeof window === 'undefined') return { x: 200, y: 600 };

  // Prioritize the dedicated shopping bag in the left corner of the floating cart
  const bagTarget = document.getElementById('floating-cart-bag-icon') || 
                    document.getElementById('cart-bag-target') || 
                    document.getElementById('cart-icon-target');

  if (bagTarget) {
    const rect = bagTarget.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0 && rect.top > 0) {
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    }
  }

  // Mobile navigation bottom cart icon / Floating cart fallback
  if (window.innerWidth < 768) {
    const mobileNav = document.getElementById('mobile-cart-nav-target');
    if (mobileNav) {
      const rect = mobileNav.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      }
    }
    // Fallback on mobile: shopping bag location of floating cart
    return { x: 56, y: window.innerHeight - 116 };
  }

  // Fallback on tablet/desktop: centered floating cart's left side bag
  const centerX = window.innerWidth / 2;
  return { x: Math.max(80, centerX - 180), y: window.innerHeight - 116 };
};

// ─── Provider ─────────────────────────────────────────────────────────────────
export function CartAnimationProvider({ children }: { children: React.ReactNode }) {
  const [queue, setQueue] = useState<AnimationData[]>([]);
  const [activeAnim, setActiveAnim] = useState<AnimationData | null>(null);
  const idCounter = useRef(0);

  const triggerAnimation = useCallback(
    (
      e: React.MouseEvent | React.TouchEvent | { clientX: number; clientY: number },
      image: string,
      onCompleteCallback?: () => void
    ) => {
      const newId = idCounter.current++;
      const target = getCartTarget();
      let clientX = window.innerWidth / 2;
      let clientY = window.innerHeight / 2;

      if (e && 'touches' in e && (e as React.TouchEvent).touches && (e as React.TouchEvent).touches.length > 0) {
        clientX = (e as React.TouchEvent).touches[0].clientX;
        clientY = (e as React.TouchEvent).touches[0].clientY;
      } else if (e && 'clientX' in e && typeof (e as any).clientX === 'number' && (e as any).clientX > 0) {
        clientX = (e as any).clientX;
        clientY = (e as any).clientY;
      }

      // Safe bounds validation
      if (!clientX || clientX <= 0 || clientX > window.innerWidth) clientX = window.innerWidth / 2;
      if (!clientY || clientY <= 0 || clientY > window.innerHeight) clientY = window.innerHeight / 2;

      setQueue((prev) => [
        ...prev,
        { id: newId, startX: clientX, startY: clientY, endX: target.x, endY: target.y, image, onComplete: onCompleteCallback },
      ]);
    },
    []
  );

  useEffect(() => {
    if (!activeAnim && queue.length > 0) {
      setActiveAnim(queue[0]);
      setQueue((prev) => prev.slice(1));
    }
  }, [activeAnim, queue]);

  useEffect(() => {
    const handleGlobalTrigger = (e: CustomEvent) => {
      const { clientX, clientY, image, onComplete: cb } = e.detail || {};
      const startX = typeof clientX === 'number' ? clientX : window.innerWidth / 2;
      const startY = typeof clientY === 'number' ? clientY : Math.max(160, window.innerHeight / 3);
      triggerAnimation({ clientX: startX, clientY: startY }, image || '/logo-transparent.png', cb);
    };

    window.addEventListener('trigger-cart-animation', handleGlobalTrigger as EventListener);
    return () => {
      window.removeEventListener('trigger-cart-animation', handleGlobalTrigger as EventListener);
    };
  }, [triggerAnimation]);

  const onComplete = useCallback(() => {
    setActiveAnim(null);
  }, []);

  return (
    <CartAnimationContext.Provider value={{ triggerAnimation }}>
      {children}
      <div className="fixed inset-0 pointer-events-none z-[10000] overflow-hidden">
        <AnimatePresence>
          {activeAnim && (
            <PremiumFlyingBox key={activeAnim.id} anim={activeAnim} onComplete={onComplete} />
          )}
        </AnimatePresence>
      </div>
    </CartAnimationContext.Provider>
  );
}

// ─── Realistic 3D Pizza Box Component ─────────────────────────────────────────
function PremiumFlyingBox({ anim, onComplete }: { anim: AnimationData; onComplete: () => void }) {
  const boxControls = useAnimation();
  const lidControls = useAnimation();
  const flyingPizzaControls = useAnimation();
  const glowControls = useAnimation();

  const centerX = typeof window !== 'undefined' ? window.innerWidth / 2 : 200;
  const centerY = typeof window !== 'undefined' ? Math.max(160, window.innerHeight / 3) : 200;

  const BOX_SIZE = 150;
  const HALF = 75;
  const PIZZA_SIZE = 95;

  useEffect(() => {
    let isMounted = true;

    const sequence = async () => {
      // 1. Initial State: Box drops from top with lid wide open
      boxControls.set({ x: centerX - HALF, y: -400, scale: 0.5, opacity: 0, rotateZ: 0 });
      lidControls.set({ rotateY: -120 });
      
      flyingPizzaControls.set({ 
        x: anim.startX - PIZZA_SIZE / 2, 
        y: anim.startY - PIZZA_SIZE / 2,
        scale: 1, opacity: 1, rotateZ: 0, rotateX: 0,
        boxShadow: '0 0 0px rgba(0,0,0,0)'
      });

      if (!isMounted) return;

      // 2. Pizza lifts slightly & 3D Box drops down with elastic bounce
      await Promise.all([
        flyingPizzaControls.start({
          scale: 1.2,
          y: anim.startY - PIZZA_SIZE / 2 - 35,
          rotateZ: 12,
          boxShadow: '0 25px 50px rgba(0, 0, 0, 0.4)',
          transition: { type: 'spring', stiffness: 280, damping: 14 }
        }),
        boxControls.start({
          y: centerY - HALF,
          scale: 1,
          opacity: 1,
          transition: { type: 'spring', stiffness: 220, damping: 18 }
        })
      ]);
      if (!isMounted) return;

      // 3. Item image flies inside the box
      await flyingPizzaControls.start({
        x: centerX - PIZZA_SIZE / 2,
        y: centerY - PIZZA_SIZE / 2,
        scale: 0.9,
        rotateZ: 360,
        rotateX: 45,
        transition: { duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }
      });
      if (!isMounted) return;

      // 4. Lid closes tightly & Product image hides inside the box
      await Promise.all([
        flyingPizzaControls.start({
          opacity: 0,
          scale: 0.7,
          transition: { duration: 0.15 }
        }),
        lidControls.start({
          rotateY: 0,
          transition: { type: 'spring', stiffness: 350, damping: 22 }
        })
      ]);
      
      if (!isMounted) return;
      
      glowControls.start({
        opacity: [0, 1, 0],
        scale: [1, 1.25, 1],
        transition: { duration: 0.35 }
      });

      // 5. Box flies smoothly in a curved ballistic arc into the Shopping Bag at the left of the floating cart
      const cartTarget = getCartTarget();
      const cartX = cartTarget.x - HALF;
      const cartY = cartTarget.y - HALF;

      await boxControls.start({
        x: cartX, 
        y: cartY, 
        scale: 0.1, 
        opacity: 0, 
        rotateZ: 75,
        transition: { duration: 0.52, ease: [0.25, 0.1, 0.25, 1] }
      });
      
      if (!isMounted) return;

      // 6. EXACT MOMENT OF IMPACT: Sound + Cart Store Update + Shopping Bag Animation
      playCartDropSound();

      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        try { navigator.vibrate([20, 25, 30]); } catch (e) {}
      }

      // Execute zustand addItem so cart item count and price update precisely now
      if (anim.onComplete) {
        try { anim.onComplete(); } catch (e) {}
      }

      // Dispatch global events for FloatingCart and bag reaction
      window.dispatchEvent(new CustomEvent('cart-item-added'));
      window.dispatchEvent(new CustomEvent('cart-bag-impact', { detail: { x: cartTarget.x, y: cartTarget.y } }));
      
      onComplete();
    };

    sequence();
    return () => { isMounted = false; };
  }, [anim, centerX, centerY, boxControls, lidControls, flyingPizzaControls, glowControls, onComplete, HALF, PIZZA_SIZE]);

  const isoStyle: React.CSSProperties = {
    position: 'absolute' as const,
    inset: 0,
    transform: 'rotate(45deg) scaleY(0.577) translateZ(0)',
    WebkitTransform: 'rotate(45deg) scaleY(0.577) translateZ(0)',
    borderRadius: 10,
    willChange: 'transform',
  };

  return (
    <>
      {/* ── 3D Realistic Pizza Box Assembly ── */}
      <motion.div
        className="absolute z-[10000] pointer-events-none will-change-transform"
        style={{ 
          width: BOX_SIZE, 
          height: BOX_SIZE,
          transform: 'translateZ(0)',
          WebkitTransform: 'translateZ(0)'
        }}
        animate={boxControls}
      >
        {/* Ambient Warm Glow */}
        <motion.div 
          animate={glowControls}
          initial={{ opacity: 0 }}
          className="absolute inset-[-50px] bg-gradient-to-r from-orange-500 to-red-600 rounded-full blur-2xl z-0"
        />

        {/* Box Base (Red Cardboard Outer + Corrugated White Liner Inside) */}
        <div style={{
          ...isoStyle,
          backgroundColor: '#ea580c', // Bright Red-Orange Cardboard Outer
          border: '3px solid #c2410c',
          boxShadow: `
            -1px 1px 0 #9a3412, -2px 2px 0 #9a3412, -3px 3px 0 #9a3412,
            -4px 4px 0 #9a3412, -5px 5px 0 #9a3412, -15px 15px 35px rgba(0,0,0,0.7)
          `,
          zIndex: 1
        }}>
          {/* Internal Kraft Cardboard Base & White Corrugated Sheet */}
          <div style={{
            position: 'absolute',
            inset: 8,
            backgroundColor: '#d97706', // Kraft interior
            borderRadius: 6,
            border: '2px solid #b45309',
            boxShadow: 'inset 0 0 20px rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden'
          }}>
            {/* White Corrugated Pizza Pad */}
            <div style={{
              width: '85%',
              height: '85%',
              backgroundColor: '#f8fafc',
              borderRadius: 4,
              backgroundImage: 'repeating-linear-gradient(90deg, #e2e8f0, #e2e8f0 3px, #f8fafc 3px, #f8fafc 8px)',
              boxShadow: 'inset 0 0 10px rgba(0,0,0,0.2)'
            }} />
          </div>
        </div>

        {/* Box Lid (Hinged Top) */}
        <div style={{ ...isoStyle, zIndex: 3, perspective: 1200 }}>
          <motion.div
            animate={lidControls}
            style={{
              position: 'absolute', inset: 0,
              transformOrigin: 'left',
              transformStyle: 'preserve-3d',
            }}
          >
            {/* Inside Kraft Face of Lid */}
            <div style={{
              position: 'absolute', inset: 0,
              backgroundColor: '#d97706', border: '3px solid #c2410c', borderRadius: 10,
              boxShadow: 'inset 0 0 20px rgba(0,0,0,0.4)'
            }} />

            {/* Outside Branded Red Cover (With Olive Pizza Logo) */}
            <div style={{
              position: 'absolute', inset: 0,
              backgroundColor: '#ea580c', border: '3px solid #c2410c', borderRadius: 10,
              backfaceVisibility: 'hidden',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              boxShadow: 'inset 0 0 25px rgba(254,215,170,0.25)',
              padding: 12
            }}>
              <img 
                src="/logo-transparent.png" 
                alt="Olive Pizza Logo"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = "/logo-transparent.png";
                }}
                style={{ width: 75, height: 75, objectFit: 'contain', zIndex: 2, filter: 'drop-shadow(0 6px 12px rgba(0,0,0,0.5))' }}
              />
              <span style={{ fontSize: 10, fontWeight: 900, color: '#ffffff', letterSpacing: '0.15em', marginTop: 4, textTransform: 'uppercase', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>
                Olive Pizza
              </span>
            </div>
          </motion.div>
        </div>
      </motion.div>

      {/* â”€â”€ Flying Item Image (Flies into box) â”€â”€ */}
      <motion.img
        src={anim.image}
        alt="Item"
        className="absolute object-cover rounded-full pointer-events-none z-[10001] shadow-2xl border-2 border-amber-400"
        style={{ width: PIZZA_SIZE, height: PIZZA_SIZE }}
        animate={flyingPizzaControls}
      />
    </>
  );
}

// â”€â”€â”€ Hook â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const useCartAnimation = () => {
  const context = useContext(CartAnimationContext);
  if (!context) throw new Error('useCartAnimation must be used within CartAnimationProvider');
  return context;
};

