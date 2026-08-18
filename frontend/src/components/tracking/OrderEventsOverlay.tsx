import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChefHat, CheckCircle2, Star, Download, RotateCcw, Share2, PartyPopper, MessageSquare, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router';
import { GlassCard, GlassButton } from '../ui/glass/GlassSystem';

export function OwnerAcceptedOverlay({ show, onClose }: { show: boolean; onClose: () => void }) {
  useEffect(() => {
    if (show) {
      const timer = setTimeout(onClose, 5000);
      return () => clearTimeout(timer);
    }
  }, [show, onClose]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[110] flex items-center justify-center bg-dark-950/90 backdrop-blur-md p-4"
        >
          <motion.div
            initial={{ scale: 0.8, y: 50, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.8, y: 50, opacity: 0 }}
            transition={{ type: 'spring', damping: 20, stiffness: 200 }}
            className="w-full max-w-sm bg-dark-900 border border-white/10 rounded-3xl p-8 flex flex-col items-center text-center shadow-[0_0_50px_rgba(249,115,22,0.2)]"
          >
            <div className="w-24 h-24 bg-orange-500/10 rounded-full flex items-center justify-center mb-6 relative">
               <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 8, ease: "linear" }} className="absolute inset-0 border-2 border-orange-500/30 rounded-full border-t-orange-500" />
               <ChefHat className="w-12 h-12 text-orange-400" />
            </div>
            <h2 className="text-2xl font-black text-white mb-2">Order Accepted!</h2>
            <p className="text-slate-400 text-sm mb-8">The restaurant has started preparing your food. It will be ready soon.</p>
            <GlassButton onClick={onClose} className="w-full py-3.5 !bg-primary-500 !text-white !border-primary-400 shadow-[0_0_20px_rgba(85,119,90,0.4)]">
              Track Order
            </GlassButton>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function DeliveredOverlay({ show, order }: { show: boolean; order: any }) {
  const navigate = useNavigate();
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[110] bg-dark-950/95 backdrop-blur-xl flex flex-col overflow-y-auto"
        >
           <div className="min-h-screen p-6 py-12 flex flex-col items-center max-w-md mx-auto w-full relative">
              <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full pointer-events-none">
                 <PartyPopper className="w-full h-full text-white/5 opacity-50" />
              </div>
              
              <motion.div 
                 initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', bounce: 0.6 }}
                 className="w-32 h-32 bg-gradient-to-tr from-green-500 to-emerald-400 rounded-full flex items-center justify-center mb-6 shadow-[0_0_50px_rgba(16,185,129,0.4)] z-10"
              >
                 <CheckCircle2 className="w-16 h-16 text-white" />
              </motion.div>
              
              <motion.h1 initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }} className="text-3xl font-black text-white text-center mb-2 z-10">
                 Order Delivered!
              </motion.h1>
              <motion.p initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }} className="text-slate-400 text-center mb-8 z-10">
                 Hope you enjoy your meal from Olive Pizza.
              </motion.p>
              
              <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.4 }} className="w-full space-y-4 z-10 mb-8">
                 <GlassCard className="p-4 flex justify-center gap-6">
                    <button className="flex flex-col items-center gap-2 group">
                       <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-primary-500/20 group-hover:text-primary-400 transition-colors">
                          <Star className="w-5 h-5" />
                       </div>
                       <span className="text-xs font-bold text-slate-300">Rate Food</span>
                    </button>
                    <button className="flex flex-col items-center gap-2 group">
                       <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-primary-500/20 group-hover:text-primary-400 transition-colors">
                          <Star className="w-5 h-5" />
                       </div>
                       <span className="text-xs font-bold text-slate-300">Rate Delivery</span>
                    </button>
                    <button className="flex flex-col items-center gap-2 group">
                       <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-white/10 transition-colors">
                          <Share2 className="w-5 h-5" />
                       </div>
                       <span className="text-xs font-bold text-slate-300">Share</span>
                    </button>
                 </GlassCard>
              </motion.div>

              <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.5 }} className="w-full space-y-3 z-10 mt-auto">
                 <GlassButton onClick={() => navigate('/menu')} className="w-full py-4 !bg-primary-500 !text-white !border-primary-400 shadow-[0_0_20px_rgba(85,119,90,0.3)] flex items-center justify-center gap-2">
                    <RotateCcw className="w-5 h-5" /> Order Again
                 </GlassButton>
                 <GlassButton onClick={() => navigate('/')} className="w-full py-4 flex items-center justify-center gap-2">
                    Return to Home
                 </GlassButton>
                 <div className="flex gap-3 mt-4">
                    <button className="flex-1 py-3 text-xs font-bold text-slate-400 hover:text-white flex items-center justify-center gap-2 bg-white/5 rounded-xl">
                       <Download className="w-4 h-4" /> Invoice
                    </button>
                    <button className="flex-1 py-3 text-xs font-bold text-red-400 hover:text-red-300 flex items-center justify-center gap-2 bg-red-500/10 rounded-xl">
                       <AlertCircle className="w-4 h-4" /> Report Issue
                    </button>
                 </div>
              </motion.div>
           </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
