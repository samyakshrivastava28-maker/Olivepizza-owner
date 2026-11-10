import React from 'react';
import { motion } from 'framer-motion';

export default function PizzaShowcase3D({ config, viewMode = 'desktop' }: { config: any; viewMode?: string }) {
  const isMobile = viewMode === 'mobile';
  const activeMediaUrl = (isMobile && config.useSeparateMobileMedia && config.mobileMediaUrl) 
    ? config.mobileMediaUrl 
    : (config.mediaUrl || "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=800&q=80");

  const isVideo = activeMediaUrl.match(/\.(mp4|mov|webm)(\?.*)?$/i) || activeMediaUrl.includes('/video/upload/');

  return (
    <div 
      className="relative w-full min-h-[400px] sm:min-h-[500px] flex items-center justify-center overflow-hidden rounded-3xl p-6 shadow-2xl"
      style={{ backgroundColor: config.styleOverrides?.backgroundColor || '#1e293b' }}
    >
      {/* Background ambient light */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-[300px] sm:w-[400px] h-[300px] sm:h-[400px] bg-primary-500/20 rounded-full blur-[100px]" />
      </div>

      <div className="flex flex-col md:flex-row items-center gap-8 md:gap-12 z-10 w-full max-w-5xl">
        <motion.div 
          className="flex-1 text-center md:text-left"
          initial={{ opacity: 0, x: -50 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
        >
          <h2 className="text-3xl sm:text-5xl md:text-6xl font-black text-white mb-3 tracking-tight">
            {config.headline || 'Signature Premium'}
          </h2>
          {config.subtitle && (
            <p className="text-slate-300 text-base sm:text-lg md:text-xl font-medium">
              {config.subtitle}
            </p>
          )}
        </motion.div>

        <motion.div 
          className="flex-1 flex justify-center items-center"
          animate={{ y: [0, -12, 0], rotate: [0, 4, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        >
          {isVideo ? (
            <video 
              src={activeMediaUrl} 
              autoPlay 
              muted 
              loop 
              playsInline 
              className="w-56 h-56 sm:w-72 sm:h-72 md:w-80 md:h-80 object-cover rounded-full shadow-[0_20px_50px_rgba(0,0,0,0.6)] border-4 border-white/10" 
            />
          ) : (
            <img 
              src={activeMediaUrl} 
              alt="Pizza Showcase" 
              className="w-56 h-56 sm:w-72 sm:h-72 md:w-80 md:h-80 object-cover rounded-full shadow-[0_20px_50px_rgba(0,0,0,0.6)] border-4 border-white/10"
            />
          )}
        </motion.div>
      </div>
    </div>
  );
}
