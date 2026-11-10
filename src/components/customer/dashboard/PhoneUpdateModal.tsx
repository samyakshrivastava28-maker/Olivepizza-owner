import { useState, useEffect } from 'react';
import { auth, db } from '../../../lib/firebase';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ShieldCheck, MessageSquare } from 'lucide-react';
import toast from 'react-hot-toast';
import { parsePhoneNumber } from 'libphonenumber-js';
import { Truecaller } from '../../../plugins/Truecaller';
import PizzaLoader from '../../../components/ui/PizzaLoader';

interface PhoneUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPhone: string;
  onSuccess: (newPhone: string) => void;
}

export default function PhoneUpdateModal({ isOpen, onClose, currentPhone, onSuccess }: PhoneUpdateModalProps) {
  const [step, setStep] = useState<'detect' | 'truecaller' | 'phone_input' | 'otp_input'>('detect');
  const [newPhone, setNewPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const isDevMode = import.meta.env.VITE_PHONE_AUTH_MODE === 'development';

  useEffect(() => {
    if (isOpen) {
      setStep('detect');
      checkTruecaller();
    } else {
      setStep('detect');
      setNewPhone('');
      setOtp('');
      setLoading(false);
    }
  }, [isOpen]);

  const checkTruecaller = async () => {
    try {
      const result = await Truecaller.isSupported();
      if (result && result.isSupported) {
        setStep('truecaller');
      } else {
        setStep('phone_input');
      }
    } catch (err) {
      setStep('phone_input');
    }
  };

  const handleTruecallerVerify = async () => {
    setLoading(true);
    try {
      let isNativeSupported = false;
      try {
        const check = await Truecaller.isSupported();
        isNativeSupported = check.isSupported;
      } catch(e) {}

      if (!isNativeSupported) {
        toast('Truecaller 1-Tap verification is active on Android APK. Switching to fast SMS OTP verification.', { icon: '⚡' });
        setStep('phone_input');
        return;
      }

      const response = await Truecaller.verify();
      
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/phone/truecaller', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(response)
      });
      const data = await res.json();

      if (data.success) {
        toast.success("Phone verified securely via Truecaller!");
        onSuccess(data.phone);
        onClose();
      } else {
        throw new Error(data.error || 'Verification failed');
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Truecaller verification failed. Falling back to OTP.");
      setStep('phone_input');
    } finally {
      setLoading(false);
    }
  };

  const handleInstantBypass = async () => {
    if (!isDevMode) return;
    setLoading(true);
    try {
      let phoneNumber = newPhone.trim() ? newPhone.trim() : '9999999999';
      if (!phoneNumber.startsWith('+')) {
        phoneNumber = `+91${phoneNumber}`;
      }
      if (auth.currentUser?.uid) {
        await setDoc(doc(db, 'users', auth.currentUser.uid), {
          phone: phoneNumber,
          phoneVerified: true,
          verificationMethod: 'demo_bypass',
          verifiedAt: Date.now(),
          phoneSetupCompleted: true
        }, { merge: true });
      }
      toast.success("Phone verified (Testing Bypass)!");
      onSuccess(phoneNumber);
      onClose();
    } catch (err) {
      toast.error("Bypass failed");
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      let formattedPhone = newPhone;
      if (!newPhone.startsWith('+')) {
        formattedPhone = `+91${newPhone}`;
      }

      if (formattedPhone === currentPhone) {
        toast.error('You are already using this phone number.');
        setLoading(false);
        return;
      }

      const token = auth.currentUser ? await auth.currentUser.getIdToken() : '';
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/phone/send-otp', {
        method: 'POST',
        headers,
        body: JSON.stringify({ phoneNumber: formattedPhone })
      });
      const data = await res.json();

      if (data.success) {
        toast.success("OTP Sent!");
        setStep('otp_input');
      } else {
        toast.error(data.error || "Failed to send OTP.");
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      let phoneNumber = newPhone.trim() ? newPhone.trim() : '9999999999';
      if (!phoneNumber.startsWith('+')) {
        phoneNumber = `+91${phoneNumber}`;
      }
      const token = auth.currentUser ? await auth.currentUser.getIdToken() : '';
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      
      const res = await fetch('/api/phone/verify-otp', {
        method: 'POST',
        headers,
        body: JSON.stringify({ 
          phoneNumber: phoneNumber, 
          otp: otp || '123456',
          userId: auth.currentUser?.uid
        })
      });
      const data = await res.json();
      
      if (data.success) {
        toast.success("Phone verified successfully!");
        onSuccess(phoneNumber);
        onClose();
      } else {
        toast.error(data.error || "Invalid OTP");
      }
    } catch (err: any) {
      if (isDevMode) {
        let phoneNumber = newPhone.trim() ? newPhone.trim() : '9999999999';
        if (!phoneNumber.startsWith('+')) {
          phoneNumber = `+91${phoneNumber}`;
        }
        toast.success("Phone verified (Testing Bypass)!");
        onSuccess(phoneNumber);
        onClose();
      } else {
        toast.error(err.response?.data?.error || err.message || "An error occurred");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50"
            onClick={onClose}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden pointer-events-auto"
            >
              <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-700">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/20 flex items-center justify-center text-orange-600 dark:text-orange-500">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">Update Phone</h2>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 text-slate-400 hover:text-slate-500 dark:hover:text-slate-300 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6">
                
                {step === 'detect' && (
                  <div className="flex flex-col items-center justify-center py-8">
                    <PizzaLoader size="small" />
                    <p className="text-slate-500 dark:text-slate-400 animate-pulse">Detecting secure verification methods...</p>
                  </div>
                )}

                {step === 'truecaller' && (
                  <div className="space-y-6 flex flex-col items-center">
                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl w-full text-center border border-blue-100 dark:border-blue-800">
                        <p className="text-blue-700 dark:text-blue-300 font-medium">Truecaller Detected ✓</p>
                        <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">Verify instantly with one tap.</p>
                    </div>
                    
                    <button
                        onClick={handleTruecallerVerify}
                        disabled={loading}
                        className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-[#0052CC] hover:bg-[#0040A8] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
                    >
                        {loading ? <PizzaLoader size="inline" /> : "Verify with Truecaller"}
                    </button>
                    
                    {isDevMode && (
                      <button
                        onClick={handleInstantBypass}
                        disabled={loading}
                        className="w-full flex justify-center py-2.5 px-4 border border-purple-500/30 rounded-xl text-xs font-bold text-purple-300 bg-purple-900/30 hover:bg-purple-900/50 transition-colors"
                      >
                        ⚡ Instant Demo Bypass (Testing Mode)
                      </button>
                    )}
                    
                    <button onClick={() => setStep('phone_input')} className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
                        Use SMS OTP instead
                    </button>
                  </div>
                )}

                {step === 'phone_input' && (
                  <form onSubmit={handleSendOtp} className="space-y-6">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">New Mobile Number</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                          <span className="text-slate-500 font-medium">+91</span>
                        </div>
                        <input
                          type="tel"
                          required
                          maxLength={10}
                          className="block w-full pl-14 pr-4 py-3 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900/50 text-slate-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
                          placeholder="9999999999"
                          value={newPhone}
                          onChange={(e) => setNewPhone(e.target.value.replace(/\D/g, ''))}
                        />
                      </div>
                    </div>
                    <button
                      type="submit"
                      disabled={loading || newPhone.length < 10}
                      className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50 transition-colors"
                    >
                      {loading ? <PizzaLoader size="inline" /> : "Send OTP"}
                    </button>

                    {isDevMode && (
                      <button
                        type="button"
                        onClick={handleInstantBypass}
                        disabled={loading}
                        className="w-full flex justify-center py-2.5 px-4 border border-purple-500/30 rounded-xl text-xs font-bold text-purple-300 bg-purple-900/30 hover:bg-purple-900/50 transition-colors"
                      >
                        ⚡ Instant Demo Bypass (Testing Mode)
                      </button>
                    )}
                  </form>
                )}

                {step === 'otp_input' && (
                  <form onSubmit={handleVerifyOtp} className="space-y-6">
                    <div className="text-center mb-6">
                        <MessageSquare className="w-12 h-12 text-orange-500 mx-auto mb-2 opacity-80" />
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          Enter the 6-digit code sent to <br/><span className="font-bold text-slate-900 dark:text-white">{newPhone || '9999999999'}</span>
                        </p>
                        {isDevMode && (
                          <p className="text-xs text-purple-400 font-bold mt-1">
                             (Testing Mode Active: Use 123456)
                          </p>
                        )}
                    </div>

                    <div>
                      <input
                        type="text"
                        required
                        maxLength={6}
                        className="block w-full text-center tracking-widest text-2xl py-3 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
                        placeholder="------"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={loading || otp.length < 6}
                      className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50 transition-colors"
                    >
                      {loading ? <PizzaLoader size="inline" /> : "Verify OTP"}
                    </button>

                    {isDevMode && (
                      <button
                        type="button"
                        onClick={handleInstantBypass}
                        disabled={loading}
                        className="w-full flex justify-center py-2.5 px-4 border border-purple-500/30 rounded-xl text-xs font-bold text-purple-300 bg-purple-900/30 hover:bg-purple-900/50 transition-colors"
                      >
                        ⚡ Instant Demo Bypass (Testing Mode)
                      </button>
                    )}
                  </form>
                )}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
