import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X, Check, Phone } from 'lucide-react';
import toast from 'react-hot-toast';

interface CancelDeliveryModalProps {
  isOpen: boolean;
  orderId: string;
  orderNumber: string;
  onClose: () => void;
  onSubmit: (reason: string) => Promise<void>;
}

const PRESET_REASONS = [
  'Vehicle problem / breakdown',
  'Distance too far from current location',
  'Heavy traffic / road block',
  'Personal emergency',
  'Already carrying another delivery'
];

export const CancelDeliveryModal: React.FC<CancelDeliveryModalProps> = ({
  isOpen,
  orderId,
  orderNumber,
  onClose,
  onSubmit
}) => {
  const [selectedPreset, setSelectedPreset] = useState<string>('');
  const [customReason, setCustomReason] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    const finalReason = customReason.trim() || selectedPreset;
    if (!finalReason) {
      toast.error('Please select or enter a rejection reason');
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit(finalReason);
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to decline delivery');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-slate-900 border border-white/10 rounded-2xl max-w-md w-full p-6 text-white shadow-2xl space-y-5"
        >
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-400">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-lg">Decline Delivery #{orderNumber}</h3>
                <p className="text-xs text-slate-400">Reason required for owner notification</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-3">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Select Preset Reason</label>
            <div className="grid grid-cols-1 gap-2">
              {PRESET_REASONS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    setSelectedPreset(preset);
                    setCustomReason('');
                  }}
                  className={`flex items-center justify-between p-3 rounded-xl text-xs font-semibold text-left transition-all border ${
                    selectedPreset === preset
                      ? 'bg-orange-500/15 border-orange-500/50 text-orange-300'
                      : 'bg-slate-800/60 border-white/5 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <span>{preset}</span>
                  {selectedPreset === preset && <Check className="w-4 h-4 text-orange-400" />}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Custom Reason</label>
            <textarea
              rows={2}
              value={customReason}
              onChange={(e) => {
                setCustomReason(e.target.value);
                if (e.target.value) setSelectedPreset('');
              }}
              placeholder="Type specific reason..."
              className="w-full bg-slate-800 border border-white/10 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-orange-500/50"
            />
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-white/10">
            <a
              href="tel:919876543210"
              className="flex items-center gap-1.5 text-xs text-orange-400 font-semibold hover:underline"
            >
              <Phone className="w-3.5 h-3.5" /> Call Restaurant
            </a>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
              >
                Back
              </button>
              <button
                type="button"
                disabled={submitting || (!selectedPreset && !customReason.trim())}
                onClick={handleSubmit}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-orange-600 hover:bg-orange-500 disabled:opacity-50 transition-all shadow-lg shadow-orange-600/20"
              >
                {submitting ? 'Declining...' : 'Decline Delivery'}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default CancelDeliveryModal;
