import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles } from 'lucide-react';

export interface AddToCartAnimPayload {
  id: string;
  itemImage?: string;
  itemName: string;
  startPos?: { x: number; y: number };
  targetPos?: { x: number; y: number };
}

interface AddToCartAnimationProps {
  activeAnimation: AddToCartAnimPayload | null;
  onComplete: () => void;
}

export const AddToCartAnimation: React.FC<AddToCartAnimationProps> = ({
  activeAnimation,
  onComplete,
}) => {
  const [step, setStep] = useState<number>(0);

  useEffect(() => {
    if (!activeAnimation) {
      setStep(0);
      return;
    }

    // Step 1: 3D Box Drops
    setStep(1);

    // Step 2: Item Image Flies Into Box (250ms)
    const t1 = setTimeout(() => setStep(2), 250);

    // Step 3: Box Lid Closes (550ms)
    const t2 = setTimeout(() => setStep(3), 550);

    // Step 4: Box Flies To Cart (850ms)
    const t3 = setTimeout(() => setStep(4), 850);

    // Step 5: Particle Burst & Cart Bounce Complete (1250ms)
    const t4 = setTimeout(() => {
      setStep(5);
      onComplete();
    }, 1250);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, [activeAnimation]);

  if (!activeAnimation || step === 0) return null;

  const startX = activeAnimation.startPos?.x ?? window.innerWidth / 2 - 40;
  const startY = activeAnimation.startPos?.y ?? window.innerHeight / 2 - 40;
  const targetX = activeAnimation.targetPos?.x ?? window.innerWidth - 80;
  const targetY = activeAnimation.targetPos?.y ?? window.innerHeight - 80;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
        {/* Step 1 & 2 & 3: 3D Pizza Box Drop & Item Flying */}
        {step >= 1 && step <= 3 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.2, y: startY - 60, x: startX }}
            animate={{
              opacity: 1,
              scale: step === 3 ? 0.9 : 1,
              y: startY,
              x: startX,
            }}
            exit={{ opacity: 0 }}
            transition={{ type: 'spring', stiffness: 350, damping: 22 }}
            className="absolute w-24 h-24 flex items-center justify-center -translate-x-1/2 -translate-y-1/2"
          >
            {/* 3D Pizza Box Visual */}
            <div 
              style={{
                perspective: 800,
                WebkitPerspective: 800,
                transformStyle: 'preserve-3d',
                WebkitTransformStyle: 'preserve-3d',
              }}
              className="relative w-20 h-20 bg-amber-700/90 border-2 border-amber-400 rounded-2xl shadow-[0_15px_30px_rgba(0,0,0,0.6)] flex items-center justify-center"
            >
              {/* Flying Item Image (Step 2 Arc Entry) */}
              <motion.img
                src={
                  activeAnimation.itemImage ||
                  'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=400'
                }
                alt={activeAnimation.itemName}
                initial={{ opacity: 0, scale: 1.5, y: -40, rotate: -30 }}
                animate={{
                  opacity: step >= 2 ? 1 : 0,
                  scale: step === 3 ? 0.7 : 1,
                  y: step >= 2 ? 0 : -40,
                  rotate: step >= 2 ? 0 : -30,
                }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                className="w-14 h-14 rounded-full object-cover border border-amber-300 shadow-md z-10"
              />

              {/* 3D Box Lid (Closes at Step 3) */}
              <motion.div
                initial={{ rotateX: -110 }}
                animate={{ rotateX: step >= 3 ? 0 : -110 }}
                transition={{ type: 'spring', stiffness: 450, damping: 20 }}
                style={{ 
                  transformOrigin: 'top center',
                  transformStyle: 'preserve-3d',
                  WebkitTransformStyle: 'preserve-3d',
                }}
                className="absolute inset-0 bg-amber-600 border-2 border-amber-300 rounded-2xl flex items-center justify-center shadow-lg z-20"
              >
                <div className="text-[10px] font-black text-amber-100 flex items-center gap-1">
                  <span>🍕 OLIVE</span>
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}

        {/* Step 4: Closed Box Flies to Floating Cart */}
        {step === 4 && (
          <motion.div
            initial={{ x: startX, y: startY, scale: 0.9, opacity: 1 }}
            animate={{
              x: targetX,
              y: targetY,
              scale: 0.25,
              opacity: [1, 1, 0.8, 0.2],
            }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="absolute w-20 h-20 bg-amber-500 border border-amber-200 rounded-2xl shadow-2xl flex items-center justify-center -translate-x-1/2 -translate-y-1/2"
          >
            <span className="text-xs font-black text-dark-950">🍕</span>
          </motion.div>
        )}

        {/* Step 5: Particle Burst around Cart Target (Cheese, Basil, Golden Sparkles) */}
        {step >= 4 && (
          <div
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: targetX, top: targetY }}
          >
            {[...Array(8)].map((_, i) => {
              const angle = (i / 8) * Math.PI * 2;
              const distance = 35 + (i % 3) * 12;
              const px = Math.cos(angle) * distance;
              const py = Math.sin(angle) * distance;

              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 1, scale: 1, x: 0, y: 0 }}
                  animate={{ opacity: 0, scale: 0, x: px, y: py }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                  className="absolute"
                >
                  {i % 3 === 0 ? (
                    <span className="text-xs">🧀</span>
                  ) : i % 3 === 1 ? (
                    <span className="text-xs">🌿</span>
                  ) : (
                    <Sparkles size={12} className="text-amber-400 fill-amber-400" />
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </AnimatePresence>
  );
};
