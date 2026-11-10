import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

export default function CountdownBanner({ config }: { config: any }) {
  const [timeLeft, setTimeLeft] = useState(3600); // Default 1 hour

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (time: number) => {
    const h = Math.floor(time / 3600);
    const m = Math.floor((time % 3600) / 60);
    const s = time % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: -20 }}
      whileInView={{ opacity: 1, y: 0 }}
      className="w-full py-4 px-6 rounded-xl flex flex-col md:flex-row items-center justify-between shadow-lg"
      style={{
        backgroundColor: config.styleOverrides?.backgroundColor || '#1e3a8a',
        color: config.styleOverrides?.textColor || '#ffffff'
      }}
    >
      <div className="flex items-center gap-4">
        <span className="text-2xl animate-pulse">⏰</span>
        <h3 className="text-xl md:text-2xl font-bold">{config.headline || 'Special Offer Ends In'}</h3>
      </div>
      <div className="text-3xl md:text-4xl font-black font-mono tracking-widest mt-2 md:mt-0">
        {formatTime(timeLeft)}
      </div>
    </motion.div>
  );
}
