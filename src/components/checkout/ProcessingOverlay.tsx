import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import PizzaLoader from '../ui/PizzaLoader';

export type CheckoutStep = 'preparing' | 'validating' | 'applying_discount' | 'submitting' | 'confirmed' | 'failed';

interface ProcessingOverlayProps {
  status: CheckoutStep;
  errorMessage?: string;
  onRetry?: () => void;
  onClose?: () => void;
}

const STEPS: { key: CheckoutStep; label: string }[] = [
  { key: 'preparing', label: 'Preparing Order' },
  { key: 'validating', label: 'Validating Cart & Address' },
  { key: 'applying_discount', label: 'Applying Live Discounts' },
  { key: 'submitting', label: 'Securing Order with Kitchen' },
  { key: 'confirmed', label: 'Order Confirmed!' },
];

export default function ProcessingOverlay({
  status,
  errorMessage,
  onRetry,
  onClose,
}: ProcessingOverlayProps) {
  const isFailed = status === 'failed';
  const isConfirmed = status === 'confirmed';
  const activeIndex = STEPS.findIndex((s) => s.key === status);

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/90 backdrop-blur-xl p-4"
      >
        <motion.div 
          initial={{ scale: 0.92, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="relative max-w-md w-full bg-slate-900/95 border border-white/10 rounded-3xl p-8 shadow-2xl flex flex-col items-center text-center"
        >
          {/* Header Icon State */}
          <div className="mb-6">
            {isConfirmed ? (
              <motion.div 
                initial={{ scale: 0 }} 
                animate={{ scale: 1 }} 
                transition={{ type: 'spring', bounce: 0.5 }}
                className="w-20 h-20 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shadow-lg shadow-emerald-500/20"
              >
                <CheckCircle2 className="w-10 h-10 text-emerald-400" />
              </motion.div>
            ) : isFailed ? (
              <motion.div 
                initial={{ scale: 0 }} 
                animate={{ scale: 1 }} 
                className="w-20 h-20 rounded-2xl bg-red-500/20 border border-red-500/40 flex items-center justify-center shadow-lg shadow-red-500/20"
              >
                <AlertCircle className="w-10 h-10 text-red-400" />
              </motion.div>
            ) : (
              <div className="flex flex-col items-center">
                <PizzaLoader size="small" text="" />
              </div>
            )}
          </div>

          {/* Title */}
          <h2 className="text-xl sm:text-2xl font-black text-white mb-2 tracking-tight">
            {isConfirmed ? 'Order Confirmed! 🍕' : isFailed ? 'Order Submission Failed' : 'Securing Your Order...'}
          </h2>

          <p className="text-slate-400 text-xs sm:text-sm mb-6">
            {isConfirmed
              ? 'Your handcrafted artisan pizza is now sent directly to our kitchen.'
              : isFailed
              ? (errorMessage || 'We could not complete your order. Your card was not charged.')
              : 'Please do not refresh or navigate away while we secure your order.'}
          </p>

          {/* Step-by-Step Progress Pipeline */}
          {!isFailed && (
            <div className="w-full bg-black/40 border border-white/5 rounded-2xl p-4 mb-6 flex flex-col gap-2.5 text-left">
              {STEPS.map((step, idx) => {
                const isPassed = activeIndex > idx || isConfirmed;
                const isCurrent = activeIndex === idx && !isConfirmed;

                return (
                  <div key={step.key} className="flex items-center gap-3">
                    <div
                      className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                        isPassed
                          ? 'bg-emerald-500 text-white'
                          : isCurrent
                          ? 'bg-primary-500 text-white animate-pulse'
                          : 'bg-white/10 text-slate-500'
                      }`}
                    >
                      {isPassed ? '✓' : idx + 1}
                    </div>
                    <span
                      className={`text-xs font-medium transition-colors ${
                        isPassed
                          ? 'text-emerald-300 font-bold'
                          : isCurrent
                          ? 'text-primary-400 font-bold'
                          : 'text-slate-500'
                      }`}
                    >
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Actions on Error */}
          {isFailed && (
            <div className="flex flex-col w-full gap-2">
              {onRetry && (
                <button
                  onClick={onRetry}
                  className="w-full py-3.5 bg-primary-500 hover:bg-primary-600 text-white font-bold rounded-xl shadow-lg shadow-primary-500/25 transition-all flex items-center justify-center gap-2 text-sm"
                >
                  <RefreshCw className="w-4 h-4" /> Try Again
                </button>
              )}
              {onClose && (
                <button
                  onClick={onClose}
                  className="w-full py-3 bg-white/5 hover:bg-white/10 text-slate-300 font-bold rounded-xl transition-all text-xs"
                >
                  Return to Checkout
                </button>
              )}
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
