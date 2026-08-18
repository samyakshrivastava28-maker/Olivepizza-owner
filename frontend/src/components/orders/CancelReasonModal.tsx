import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { AlertTriangle } from 'lucide-react';

interface CancelReasonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  orderNumber?: string | number;
}

const CANNED_REASONS = [
  'Store kitchen closing for the day',
  'Item out of stock / ingredients unavailable',
  'Delivery address outside serviceable radius',
  'Customer requested cancellation',
  'Delivery partner unavailable',
  'Suspected spam / fraudulent order',
];

export const CancelReasonModal: React.FC<CancelReasonModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  orderNumber,
}) => {
  const [selectedReason, setSelectedReason] = useState(CANNED_REASONS[0]);
  const [customReason, setCustomReason] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalReason = selectedReason === 'Other' ? customReason.trim() : selectedReason;
    if (!finalReason) return;
    onConfirm(finalReason);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Cancel Order #${orderNumber || ''}`}
      maxWidth="max-w-md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-center gap-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span>Cancelling an order is irreversible and will notify the customer.</span>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-300 uppercase">Select Reason</label>
          {CANNED_REASONS.map((r) => (
            <label
              key={r}
              className="flex items-center gap-3 p-3 rounded-xl border border-slate-800 bg-[#0E1524] hover:border-slate-700 cursor-pointer transition-colors text-xs text-slate-200"
            >
              <input
                type="radio"
                name="cancelReason"
                checked={selectedReason === r}
                onChange={() => setSelectedReason(r)}
                className="text-orange-500 focus:ring-0 focus:outline-none"
              />
              <span>{r}</span>
            </label>
          ))}
          <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-800 bg-[#0E1524] hover:border-slate-700 cursor-pointer transition-colors text-xs text-slate-200">
            <input
              type="radio"
              name="cancelReason"
              checked={selectedReason === 'Other'}
              onChange={() => setSelectedReason('Other')}
              className="text-orange-500 focus:ring-0 focus:outline-none"
            />
            <span>Other (specify below)</span>
          </label>
        </div>

        {selectedReason === 'Other' && (
          <div>
            <textarea
              required
              rows={3}
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
              placeholder="Enter cancellation reason..."
              className="w-full p-3 rounded-xl bg-[#0E1524] border border-slate-800 text-slate-200 text-xs focus:border-orange-500 focus:outline-none"
            />
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl text-xs transition-colors shadow-lg shadow-red-600/20"
          >
            Confirm Cancellation
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs transition-colors"
          >
            Keep Order
          </button>
        </div>
      </form>
    </Modal>
  );
};
