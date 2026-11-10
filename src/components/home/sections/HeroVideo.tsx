import React from 'react';
import { motion } from 'framer-motion';

export default function HeroVideo({ config, viewMode = 'desktop' }: { config: any; viewMode?: string }) {
  const isMobile = viewMode === 'mobile';
  const activeMediaUrl = (isMobile && config.useSeparateMobileMedia && config.mobileMediaUrl) 
    ? config.mobileMediaUrl 
    : (config.mediaUrl || '');

  const isVideo = activeMediaUrl.match(/\.(mp4|mov|webm)(\?.*)?$/i) || activeMediaUrl.includes('/video/upload/') || config.mediaType === 'video';

  const getAnimationProps = () => {
    switch(config.animationType) {
      case 'Pop': return { initial: { scale: 0.8, opacity: 0 }, animate: { scale: 1, opacity: 1 } };
      case 'Slide': return { initial: { x: -50, opacity: 0 }, animate: { x: 0, opacity: 1 } };
      case 'Fade Up': return { initial: { y: 20, opacity: 0 }, animate: { y: 0, opacity: 1 } };
      default: return { initial: { opacity: 0 }, animate: { opacity: 1 } };
    }
  };

  return (
    <div 
      className="relative w-full h-[380px] sm:h-[500px] md:h-[600px] flex items-center justify-center overflow-hidden rounded-3xl shadow-2xl"
      style={{
        backgroundColor: config.styleOverrides?.backgroundColor || '#000'
      }}
    >
      {/* Background Media (Video vs Image) */}
      {activeMediaUrl ? (
        isVideo ? (
          <video 
            autoPlay 
            muted 
            loop 
            playsInline
            src={activeMediaUrl} 
            className="absolute inset-0 w-full h-full object-cover opacity-60"
          />
        ) : (
          <img 
            src={activeMediaUrl} 
            alt="Hero Media" 
            className="absolute inset-0 w-full h-full object-cover opacity-60"
          />
        )
      ) : (
        /* Fallback Overlay if no media */
        <div className="absolute inset-0 bg-gradient-to-tr from-primary-900 via-purple-950 to-black opacity-80" />
      )}
      
      <motion.div 
        {...getAnimationProps()}
        transition={{ duration: 0.6, type: 'spring' }}
        className="relative z-10 text-center px-4 max-w-3xl"
      >
        <h2 
          className="text-4xl sm:text-6xl md:text-7xl font-black mb-4 sm:mb-6 tracking-tight drop-shadow-lg"
          style={{ color: config.styleOverrides?.textColor || '#fff' }}
        >
          {config.headline || 'Olive Pizza'}
        </h2>
        {config.subtitle && (
          <p 
            className="text-base sm:text-xl md:text-2xl mb-6 sm:mb-8 font-medium drop-shadow"
            style={{ color: config.styleOverrides?.textColor || '#e2e8f0' }}
          >
            {config.subtitle}
          </p>
        )}
        {config.buttonText && (
          <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="px-8 py-3.5 sm:py-4 bg-primary-500 hover:bg-primary-400 text-white font-bold rounded-full text-base sm:text-lg shadow-[0_0_30px_rgba(249,115,22,0.4)] transition-all"
          >
            {config.buttonText}
          </motion.button>
        )}
      </motion.div>
    </div>
  );
}
