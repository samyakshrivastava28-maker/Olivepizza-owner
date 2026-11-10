import React from 'react';
import { motion } from 'framer-motion';
import { X, CreditCard, Banknote, Wallet, Smartphone, ShieldCheck } from 'lucide-react';

export default function PaymentMethodOverlay({ onClose, onSelect, total }: any) {
  const methods = [
    { id: 'upi', name: 'UPI', desc: 'Google Pay, PhonePe, Paytm', icon: Smartphone, color: 'text-purple-400', bg: 'bg-purple-500/10' },
    { id: 'card', name: 'Credit / Debit Card', desc: 'Visa, Mastercard, RuPay', icon: CreditCard, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { id: 'wallet', name: 'Wallets', desc: 'Amazon Pay, Paytm', icon: Wallet, color: 'text-orange-400', bg: 'bg-orange-500/10' },
    { id: 'cash', name: 'Cash on Delivery', desc: 'Pay at your doorstep', icon: Banknote, color: 'text-green-400', bg: 'bg-green-500/10' },
  ];

  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4 sm:p-0"
    >
      <motion.div 
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="w-full max-w-md bg-dark-900 border border-white/10 rounded-t-3xl sm:rounded-3xl px-6 pt-6 pb-safe sm:pb-6 shadow-2xl"
      >
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-xl font-bold text-white">Payment Method</h2>
            <p className="text-sm text-white/50 mt-1">Select how you want to pay ₹{total}</p>
          </div>
          <button onClick={onClose} className="p-2 bg-white/5 rounded-full hover:bg-white/10 text-white/70 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3">
          {methods.map((m) => {
            const Icon = m.icon;
            return (
              <button
                key={m.id}
                onClick={() => onSelect(m.id)}
                className="w-full flex items-center gap-4 p-4 rounded-2xl bg-white/[0.03] border border-white/5 hover:border-white/20 hover:bg-white/[0.05] transition-all active:scale-[0.98] group"
              >
                <div className={`p-3 rounded-xl ${m.bg} ${m.color}`}>
                  <Icon className="w-6 h-6" />
                </div>
                <div className="text-left flex-1">
                  <p className="font-bold text-white group-hover:text-primary-300 transition-colors">{m.name}</p>
                  <p className="text-xs text-white/50">{m.desc}</p>
                </div>
              </button>
            )
          })}
        </div>
        
        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-white/40">
           <ShieldCheck className="w-4 h-4" /> 100% Secure & Encrypted Payments
        </div>
      </motion.div>
    </motion.div>
  );
}
