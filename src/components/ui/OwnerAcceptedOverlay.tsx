import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { ChefHat, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router';

interface OwnerAcceptedOverlayProps {
  orderId: string;
  onClose: () => void;
}

export default function OwnerAcceptedOverlay({ orderId, onClose }: OwnerAcceptedOverlayProps) {
  const navigate = useNavigate();

  useEffect(() => {
    // Automatically minimize into floating tracker after 5 seconds
    const t = setTimeout(() => {
      onClose();
    }, 5000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.5 } }}
      className="fixed inset-0 z-[999] flex flex-col items-center justify-center bg-dark-950/90 backdrop-blur-2xl p-6"
    >
      <motion.div 
        initial={{ scale: 0.5, y: 50 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', damping: 15, stiffness: 200 }}
        className="bg-dark-900 border border-emerald-500/30 rounded-[3rem] p-8 text-center max-w-sm w-full relative overflow-hidden shadow-[0_0_80px_rgba(16,185,129,0.2)]"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/20 to-transparent opacity-50" />
        
        <motion.div 
           initial={{ scale: 0 }} 
           animate={{ scale: 1 }} 
           transition={{ delay: 0.2, type: 'spring' }}
           className="w-24 h-24 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_0_40px_rgba(16,185,129,0.6)] relative z-10"
        >
          <CheckCircle2 className="w-12 h-12 text-white" />
        </motion.div>

        <motion.h2 
           initial={{ opacity: 0, y: 10 }}
           animate={{ opacity: 1, y: 0 }}
           transition={{ delay: 0.3 }}
           className="text-3xl font-black text-white mb-3 relative z-10"
        >
          Order Confirmed!
        </motion.h2>

        <motion.p 
           initial={{ opacity: 0, y: 10 }}
           animate={{ opacity: 1, y: 0 }}
           transition={{ delay: 0.4 }}
           className="text-white/70 mb-8 relative z-10"
        >
          The restaurant has started preparing your food.
        </motion.p>

        <motion.div 
           initial={{ opacity: 0, y: 20 }}
           animate={{ opacity: 1, y: 0 }}
           transition={{ delay: 0.5 }}
           className="relative z-10"
        >
          <button 
            onClick={() => {
              onClose();
              navigate(`/tracking/${orderId}`);
            }}
            className="w-full py-4 bg-white text-emerald-950 font-black rounded-2xl flex items-center justify-center gap-2 hover:bg-emerald-50 transition-colors shadow-xl"
          >
            <ChefHat className="w-5 h-5" />
            Track Order
          </button>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
