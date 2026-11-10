import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { PartyPopper, RotateCcw, Star, Receipt } from 'lucide-react';
import { useNavigate } from 'react-router';
import confetti from 'canvas-confetti';

interface DeliveredOverlayProps {
  orderId: string;
  onClose: () => void;
}

export default function DeliveredOverlay({ orderId, onClose }: DeliveredOverlayProps) {
  const navigate = useNavigate();

  useEffect(() => {
    // Fire confetti celebration
    const end = Date.now() + 3 * 1000;
    const colors = ['#f97316', '#22c55e', '#ffffff'];

    (function frame() {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: colors
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: colors
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    }());
  }, []);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.3 } }}
      className="fixed inset-0 z-[1000] flex flex-col items-center justify-center bg-dark-950/90 backdrop-blur-3xl p-4"
    >
      <motion.div 
        initial={{ scale: 0.8, y: 50 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', damping: 20, stiffness: 200 }}
        className="bg-gradient-to-b from-dark-800 to-dark-900 border border-white/10 rounded-[3rem] p-8 text-center max-w-sm w-full shadow-[0_0_80px_rgba(249,115,22,0.15)] relative overflow-hidden"
      >
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-overlay" />
        
        <div className="relative z-10 flex flex-col items-center">
          <motion.div 
             initial={{ scale: 0, rotate: -180 }} 
             animate={{ scale: 1, rotate: 0 }} 
             transition={{ type: 'spring', damping: 15 }}
             className="w-24 h-24 bg-gradient-to-br from-primary-500 to-orange-500 rounded-full flex items-center justify-center mb-6 shadow-2xl shadow-primary-500/50"
          >
            <PartyPopper className="w-12 h-12 text-white" />
          </motion.div>

          <h2 className="text-3xl font-black text-white mb-2 leading-tight">Order<br/>Delivered!</h2>
          <p className="text-white/60 mb-8 text-sm">Enjoy your freshly baked premium pizza.</p>

          <div className="w-full space-y-3">
            <button 
              onClick={() => { onClose(); navigate('/menu'); }}
              className="w-full py-4 bg-white text-dark-950 font-black rounded-2xl flex items-center justify-center gap-2 hover:bg-gray-100 transition-colors shadow-lg"
            >
              <RotateCcw className="w-5 h-5" />
              Order Again
            </button>
            <div className="flex gap-3">
              <button className="flex-1 py-3 bg-white/5 border border-white/10 text-white font-semibold rounded-2xl hover:bg-white/10 transition-colors flex flex-col items-center justify-center gap-1">
                <Star className="w-5 h-5 text-yellow-400" />
                <span className="text-[10px] uppercase tracking-wider">Rate Food</span>
              </button>
              <button className="flex-1 py-3 bg-white/5 border border-white/10 text-white font-semibold rounded-2xl hover:bg-white/10 transition-colors flex flex-col items-center justify-center gap-1">
                <Receipt className="w-5 h-5 text-blue-400" />
                <span className="text-[10px] uppercase tracking-wider">Receipt</span>
              </button>
            </div>
            <button onClick={onClose} className="w-full py-3 mt-2 text-white/40 hover:text-white/80 font-medium text-sm transition-colors">
               Dismiss
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
