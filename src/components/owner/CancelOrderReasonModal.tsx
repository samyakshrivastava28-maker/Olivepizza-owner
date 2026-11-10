import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X, Check, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import { z } from 'zod';

interface CancelOrderReasonModalProps {
  isOpen: boolean;
  orderId?: string;
  orderNumber: string;
  onClose: () => void;
  onSubmit?: (reason: string) => Promise<void>;
  onConfirm?: (reason: string) => Promise<void>;
  isSubmitting?: boolean;
}

const PRESET_REASONS = [
  'Item out of stock',
  'Kitchen too busy / overload',
  'Outside delivery coverage area',
  'Restaurant closing soon',
  'Customer requested cancellation',
  'Invalid contact details / address'
];

export const CancelOrderReasonModal: React.FC<CancelOrderReasonModalProps> = ({
  isOpen,
  orderId,
  orderNumber,
  onClose,
  onSubmit,
  onConfirm,
  isSubmitting: externalSubmitting
}) => {
  const [selectedPreset, setSelectedPreset] = useState<string>('');
  const [customReason, setCustomReason] = useState<string>('');
  const [internalSubmitting, setInternalSubmitting] = useState(false);
  const submitting = externalSubmitting ?? internalSubmitting;

  if (!isOpen) return null;

  const handleSubmit = async () => {
    const finalReason = customReason.trim() || selectedPreset;
    const validation = z.string().min(5, 'Reason must be at least 5 characters long').safeParse(finalReason);
    if (!validation.success) {
      toast.error(validation.error.issues[0].message);
      return;
    }

    setInternalSubmitting(true);
    try {
      const handler = onConfirm || onSubmit;
      if (handler) {
        await handler(finalReason);
      }
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to cancel order');
    } finally {
      setInternalSubmitting(false);
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
              <div className="p-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-lg">Cancel Order #{orderNumber}</h3>
                <p className="text-xs text-slate-400">Reason is mandatory for customer notification</p>
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
                      ? 'bg-red-500/15 border-red-500/50 text-red-300'
                      : 'bg-slate-800/60 border-white/5 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <span>{preset}</span>
                  {selectedPreset === preset && <Check className="w-4 h-4 text-red-400" />}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              Custom Reason (Optional if preset selected)
            </label>
            <textarea
              rows={2}
              value={customReason}
              onChange={(e) => {
                setCustomReason(e.target.value);
                if (e.target.value) setSelectedPreset('');
              }}
              placeholder="Type specific reason for customer..."
              className="w-full bg-slate-800 border border-white/10 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-red-500/50"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-white/5 transition-all"
            >
              Back
            </button>
            <button
              type="button"
              disabled={submitting || (!selectedPreset && !customReason.trim())}
              onClick={handleSubmit}
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-500 disabled:opacity-50 transition-all shadow-lg shadow-red-600/20"
            >
              {submitting ? 'Cancelling...' : 'Confirm Cancellation'}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default CancelOrderReasonModal;
