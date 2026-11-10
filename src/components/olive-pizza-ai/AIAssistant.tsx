import React from 'react';
import { motion } from 'framer-motion';
import { Bot } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router';

export default function AIAssistant() {
  const navigate = useNavigate();
  const location = useLocation();

  // Hide the floating assistant button when already on the assistant page, owner/delivery views, or onboarding
  if (
    location.pathname === '/assistant' ||
    location.pathname.startsWith('/owner') ||
    location.pathname.startsWith('/delivery') ||
    location.pathname.startsWith('/developer') ||
    location.pathname.startsWith('/onboarding')
  ) {
    return null;
  }

  return (
    <motion.button
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0, opacity: 0 }}
      whileHover={{ scale: 1.1, y: -2 }}
      whileTap={{ scale: 0.92 }}
      onClick={() => navigate('/assistant')}
      title="Olive Pizza AI Assistant"
      aria-label="Open Olive Pizza AI Assistant"
      className="fixed bottom-20 right-4 sm:bottom-6 sm:right-6 z-40 flex items-center justify-center w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-gradient-to-tr from-emerald-600 via-teal-600 to-amber-500 hover:from-emerald-500 hover:to-amber-400 text-white shadow-[0_8px_25px_rgba(16,185,129,0.4)] border border-white/30 cursor-pointer backdrop-blur-md group transition-all"
    >
      <div className="relative flex items-center justify-center">
        <Bot size={20} className="text-yellow-200 group-hover:rotate-12 transition-transform duration-300" />
        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-400 rounded-full animate-ping opacity-75" />
        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-400 rounded-full border border-black/40" />
      </div>
    </motion.button>
  );
}
