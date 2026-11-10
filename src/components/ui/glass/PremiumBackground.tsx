import React, { useMemo } from 'react';
import { motion } from 'framer-motion';

export function PremiumBackground() {
  const particles = useMemo(() => 
    Array.from({ length: 10 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 3 + 2,
      duration: Math.random() * 15 + 15,
      delay: Math.random() * 8,
    })), []);

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden bg-slate-900 dark:bg-dark-950">
      {/* Static GPU-friendly Ambient Mesh Gradients */}
      <div 
        className="absolute top-0 left-0 w-[450px] md:w-[600px] h-[450px] md:h-[600px] bg-primary-500/10 rounded-full blur-[80px] md:blur-[120px] will-change-transform"
        style={{ transform: 'translateZ(0)' }}
      />
      
      <div 
        className="absolute bottom-0 right-0 w-[400px] md:w-[500px] h-[400px] md:h-[500px] bg-indigo-500/10 rounded-full blur-[80px] md:blur-[100px] will-change-transform"
        style={{ transform: 'translateZ(0)' }}
      />

      {/* Floating Light Particles (Rendered on Desktop Only for Extreme Mobile Performance) */}
      <div className="hidden md:block">
        {particles.map(p => (
          <motion.div
            key={p.id}
            className="absolute rounded-full bg-white/20 will-change-transform"
            style={{ 
              width: p.size, 
              height: p.size, 
              left: `${p.x}%`, 
              top: `${p.y}%`,
              boxShadow: '0 0 8px rgba(255,255,255,0.2)',
              transform: 'translateZ(0)'
            }}
            animate={{
              y: [0, -80],
              opacity: [0, 0.7, 0],
            }}
            transition={{
              duration: p.duration,
              delay: p.delay,
              repeat: Infinity,
              ease: "linear"
            }}
          />
        ))}
      </div>
    </div>
  );
}
