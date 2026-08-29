import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, X, RefreshCw, Smartphone, ExternalLink, CheckCircle2 } from 'lucide-react';
import { TruecallerService, TruecallerSessionStatusResponse } from '../../plugins/Truecaller';

interface TruecallerQRModalProps {
  isOpen: boolean;
  onClose: () => void;
  deepLink: string;
  requestId: string;
  onSuccess: (status: TruecallerSessionStatusResponse) => void;
  onError: (errorMsg: string) => void;
}

export default function TruecallerQRModal({
  isOpen,
  onClose,
  deepLink,
  requestId,
  onSuccess,
  onError
}: TruecallerQRModalProps) {
  const [polling, setPolling] = useState(true);
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    if (!isOpen || !requestId) return;

    let pollInterval: ReturnType<typeof setTimeout>;
    let isMounted = true;

    const startPolling = () => {
      pollInterval = setInterval(async () => {
        try {
          const res = await TruecallerService.pollWebSession(requestId);
          if (!isMounted) return;

          if (res.status === 'VERIFIED') {
            clearInterval(pollInterval);
            setVerified(true);
            setTimeout(() => {
              onSuccess(res);
            }, 800);
          } else if (res.status === 'FAILED') {
            clearInterval(pollInterval);
            onError(res.error || 'Truecaller verification failed.');
          }
        } catch {
          // Keep polling until expiry
        }
      }, 2500);
    };

    startPolling();

    return () => {
      isMounted = false;
      clearInterval(pollInterval);
    };
  }, [isOpen, requestId, onSuccess, onError]);

  if (!isOpen) return null;

  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(
    deepLink
  )}&format=svg`;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 overflow-hidden"
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Header with Truecaller Branding */}
          <div className="text-center space-y-2 mb-6">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-[#0052CC]/10 text-[#0052CC] mb-1">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">
              Verify with Truecaller
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Scan this QR code using the <strong>Truecaller App</strong> or camera on your phone to verify instantly.
            </p>
          </div>

          {/* QR Container */}
          <div className="flex flex-col items-center justify-center p-4 bg-slate-50 dark:bg-slate-950/50 rounded-2xl border border-slate-100 dark:border-slate-800">
            {verified ? (
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="py-12 flex flex-col items-center text-center space-y-3"
              >
                <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/50 text-emerald-500 flex items-center justify-center">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <h4 className="font-bold text-lg text-slate-900 dark:text-white">
                  Verification Successful!
                </h4>
                <p className="text-xs text-emerald-600 dark:text-emerald-400">
                  Linking phone identity to your account...
                </p>
              </motion.div>
            ) : (
              <>
                <div className="p-3 bg-white rounded-xl shadow-inner border border-slate-200">
                  <img
                    src={qrImageUrl}
                    alt="Truecaller QR Code"
                    className="w-48 h-48 rounded-lg object-contain"
                  />
                </div>

                <div className="mt-4 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#0052CC]" />
                  <span>Waiting for scan & consent...</span>
                </div>
              </>
            )}
          </div>

          {/* Mobile Direct Action (if user is on mobile browser) */}
          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-2">
            <a
              href={deepLink}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-semibold text-[#0052CC] bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
            >
              <Smartphone className="w-4 h-4" />
              <span>Tap to Open in Truecaller App</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>

            <button
              type="button"
              onClick={onClose}
              className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 py-1"
            >
              Switch to SMS OTP Verification
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
