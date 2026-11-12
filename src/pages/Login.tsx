import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { auth } from '../lib/firebase';
import { signInWithCustomToken } from 'firebase/auth';
import { useAuthStore } from '../lib/store';
import { 
  Mail, 
  Phone, 
  ShieldCheck, 
  ArrowRight, 
  AlertCircle, 
  RotateCcw, 
  ArrowLeft, 
  Lock, 
  Crown
} from 'lucide-react';
import { AppLogo } from '../components/common/AppLogo';
import { getApiUrl } from '../lib/config';
import toast from 'react-hot-toast';

export default function Login() {
  // Step 1: 'check' (Account Eligibility), Step 2: 'verify' (6-Digit Temporary Code)
  const [step, setStep] = useState<'check' | 'verify'>('check');
  const [authMethod, setAuthMethod] = useState<'email' | 'phone'>('email');
  const [identifierInput, setIdentifierInput] = useState('');
  
  // Verification Code State
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [verifiedEmail, setVerifiedEmail] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [resolvedName, setResolvedName] = useState('');
  
  // Timers & Loading
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [isResending, setIsResending] = useState(false);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated, setUser, clearRestricted } = useAuthStore();

  const getCleanRedirectTarget = (): string => {
    const raw = new URLSearchParams(location.search).get('redirect');
    if (!raw || raw === '/login' || raw.startsWith('/login') || raw === '/' || raw === '/dashboard') {
      return '/home';
    }
    return raw;
  };

  // Redirect if already authenticated as owner
  useEffect(() => {
    if (isAuthenticated && user && (user.role === 'owner' || user.role === 'platform_owner')) {
      navigate(getCleanRedirectTarget(), { replace: true });
    }
  }, [isAuthenticated, user, navigate]);

  useEffect(() => {
    clearRestricted();
  }, [clearRestricted]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Handle Step 1: Check Eligibility
  const handleCheckEligibility = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanInput = identifierInput.trim();
    if (!cleanInput) {
      setError(authMethod === 'email' ? 'Please enter your registered owner email address.' : 'Please enter your 10-digit mobile number.');
      return;
    }

    if (authMethod === 'email' && !cleanInput.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }

    if (authMethod === 'phone' && cleanInput.replace(/\D/g, '').length < 10) {
      setError('Please enter a valid 10-digit mobile phone number.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch(getApiUrl('/api/auth/management/check-eligibility'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-App-Target': 'OWNER',
          'X-App-Source': 'OWNER'
        },
        body: JSON.stringify({
          identifier: cleanInput,
          targetApp: 'OWNER'
        })
      });

      const resp = await res.json();

      if (!resp.success || !resp.eligible) {
        setError(resp.message || 'This account is not verified or authorized as an Olive Pizza Owner. Access restricted.');
        setIsLoading(false);
        return;
      }

      setVerifiedEmail(resp.email || cleanInput);
      setMaskedEmail(resp.maskedEmail || resp.email || cleanInput);
      setResolvedName(resp.name || 'Store Owner');
      setResendCooldown(60);
      setCode(['', '', '', '', '', '']);
      setStep('verify');
      toast.success(resp.message || 'Verification code sent to your email!');

      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 100);
    } catch (err: any) {
      setError(err?.message || 'Unable to connect to authorization gateway. Please retry.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Step 2: Code Digit Input
  const handleDigitChange = (index: number, val: string) => {
    const clean = val.replace(/\D/g, '');
    if (!clean && val !== '') return;

    const newCode = [...code];

    if (clean.length > 1) {
      const pastedDigits = clean.slice(0, 6).split('');
      pastedDigits.forEach((d, i) => {
        if (i < 6) newCode[i] = d;
      });
      setCode(newCode);
      const nextFocus = Math.min(pastedDigits.length, 5);
      inputRefs.current[nextFocus]?.focus();
      return;
    }

    newCode[index] = clean;
    setCode(newCode);

    if (clean && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length > 0) {
      const newCode = ['', '', '', '', '', ''];
      pasted.split('').forEach((d, i) => {
        newCode[i] = d;
      });
      setCode(newCode);
      const nextFocus = Math.min(pasted.length, 5);
      inputRefs.current[nextFocus]?.focus();
    }
  };

  // Handle Resend Verification Code
  const handleResendCode = async () => {
    if (resendCooldown > 0 || isResending || !verifiedEmail) return;

    setIsResending(true);
    setError(null);

    try {
      const res = await fetch(getApiUrl('/api/auth/management/resend-code'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: verifiedEmail })
      });

      const resp = await res.json();
      if (!resp.success) {
        setError(resp.message || 'Failed to resend code. Please wait before retrying.');
        return;
      }

      setResendCooldown(60);
      setCode(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
      toast.success('Fresh verification code sent to your email.');
    } catch (err: any) {
      setError(err?.message || 'Network error while requesting new code.');
    } finally {
      setIsResending(false);
    }
  };

  // Handle Step 2: Verify Code and Sign In
  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const fullCode = code.join('').trim();
    if (fullCode.length !== 6) {
      setError('Please enter the complete 6-digit verification code.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch(getApiUrl('/api/auth/management/verify-code-signin'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-App-Target': 'OWNER',
          'X-App-Source': 'OWNER'
        },
        body: JSON.stringify({
          email: verifiedEmail,
          code: fullCode,
          targetApp: 'OWNER'
        })
      });

      const resp = await res.json();
      if (!resp.success || !resp.customToken) {
        setError(resp.message || 'Invalid or expired verification code. Please check your email or request a new code.');
        setIsLoading(false);
        return;
      }

      // Sign in to Firebase Auth using verified Custom Token
      const userCredential = await signInWithCustomToken(auth, resp.customToken);
      const fbUser = userCredential.user;
      const u = resp.user || {};

      setUser({
        uid: fbUser.uid,
        email: fbUser.email || verifiedEmail,
        name: u.name || fbUser.displayName || resolvedName || 'Store Owner',
        role: 'owner',
        allowedApps: ['OWNER', 'RESTAURANT_MANAGER', 'FRANCHISE_MANAGER', 'POS', 'DELIVERY']
      }, 'owner', u);

      toast.success(`Welcome to Owner Console, ${u.name || resolvedName || 'Owner'}!`);
      navigate(getCleanRedirectTarget(), { replace: true });
    } catch (err: any) {
      console.error('[OwnerLogin] Sign in verification error:', err);
      setError(err?.message || 'Verification failed. Please check your code or request a new one.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070A12] text-slate-100 flex items-center justify-center p-4 font-sans relative overflow-hidden">
      {/* Dynamic Background Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] h-[520px] bg-amber-500/10 rounded-full blur-[130px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-emerald-500/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-md bg-[#0D1322]/90 backdrop-blur-2xl border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative z-10 space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <AppLogo size="lg" />
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[11px] font-semibold tracking-wide uppercase mb-2">
              <Crown className="w-3.5 h-3.5" />
              Owner Executive Console
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight">
              {step === 'check' ? 'Owner Authorization' : 'Verify Security Code'}
            </h1>
            <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto leading-relaxed">
              {step === 'check'
                ? 'Verify your registered Olive Pizza Owner credentials to receive an executive access code.'
                : 'Enter the 6-digit one-time code sent to your registered owner email.'}
            </p>
          </div>
        </div>

        {/* Global Error Notice */}
        {error && (
          <div className="p-3.5 rounded-2xl bg-red-950/40 border border-red-500/30 flex items-start gap-3 text-red-200 text-xs animate-in fade-in slide-in-from-top-1 duration-200">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1 leading-relaxed">{error}</div>
          </div>
        )}

        {/* STEP 1: ELIGIBILITY PRE-CHECK */}
        {step === 'check' && (
          <form onSubmit={handleCheckEligibility} className="space-y-5">
            {/* Method Tabs */}
            <div className="grid grid-cols-2 p-1 bg-slate-950/80 border border-slate-800 rounded-2xl">
              <button
                type="button"
                onClick={() => {
                  setAuthMethod('email');
                  setError(null);
                }}
                className={`flex items-center justify-center gap-2 py-2.5 text-xs font-semibold rounded-xl transition-all ${
                  authMethod === 'email'
                    ? 'bg-slate-800 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Mail className="w-3.5 h-3.5" />
                Email Address
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMethod('phone');
                  setError(null);
                }}
                className={`flex items-center justify-center gap-2 py-2.5 text-xs font-semibold rounded-xl transition-all ${
                  authMethod === 'phone'
                    ? 'bg-slate-800 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Phone className="w-3.5 h-3.5" />
                Phone Number
              </button>
            </div>

            {/* Input Field */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider block">
                {authMethod === 'email' ? 'Registered Owner Email' : 'Registered Mobile Number'}
              </label>
              <div className="relative">
                {authMethod === 'email' ? (
                  <>
                    <input
                      type="email"
                      value={identifierInput}
                      onChange={e => setIdentifierInput(e.target.value)}
                      placeholder="e.g. webhub2811@gmail.com or olivepizzarjn@gmail.com"
                      autoFocus
                      required
                      className="w-full pl-10 pr-4 py-3 bg-slate-950/80 border border-slate-800 rounded-2xl text-white text-sm placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all font-mono"
                    />
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  </>
                ) : (
                  <>
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center gap-1 text-xs text-slate-400 font-semibold border-r border-slate-800 pr-2.5">
                      <span>🇮🇳</span>
                      <span>+91</span>
                    </div>
                    <input
                      type="tel"
                      value={identifierInput}
                      onChange={e => setIdentifierInput(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      placeholder="10-digit registered number"
                      autoFocus
                      required
                      className="w-full pl-20 pr-4 py-3 bg-slate-950/80 border border-slate-800 rounded-2xl text-white text-sm placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all font-mono"
                    />
                  </>
                )}
              </div>
            </div>

            {/* Security Notice */}
            <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800 flex items-center gap-2.5 text-[11px] text-slate-400">
              <Lock className="w-4 h-4 text-amber-500 shrink-0" />
              <span>Zero-Trust Verification. A 6-digit executive access code will be sent to your verified email.</span>
            </div>

            {/* Action Submit */}
            <button
              type="submit"
              disabled={isLoading || !identifierInput.trim()}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-bold text-sm rounded-2xl transition-all shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  <span>Verifying Credentials...</span>
                </>
              ) : (
                <>
                  <span>Verify Account & Continue</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}

        {/* STEP 2: TEMPORARY 6-DIGIT CODE VERIFICATION */}
        {step === 'verify' && (
          <form onSubmit={handleVerifyCode} className="space-y-6">
            {/* Masked Email Info Pill */}
            <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                  <Mail className="w-4 h-4" />
                </div>
                <div className="truncate">
                  <p className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">Sent to verified email</p>
                  <p className="text-xs font-mono font-bold text-white truncate">{maskedEmail}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setStep('check');
                  setError(null);
                }}
                className="text-[11px] font-semibold text-amber-400 hover:text-amber-300 hover:underline shrink-0 flex items-center gap-1"
              >
                <ArrowLeft className="w-3 h-3" />
                Change
              </button>
            </div>

            {/* 6-Digit Code Inputs */}
            <div className="space-y-2">
              <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider block text-center">
                Enter 6-Digit Security Code
              </label>
              <div className="flex justify-between gap-2 sm:gap-3" onPaste={handlePaste}>
                {code.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={el => { inputRefs.current[idx] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={e => handleDigitChange(idx, e.target.value)}
                    onKeyDown={e => handleKeyDown(idx, e)}
                    className="w-12 h-14 sm:w-14 sm:h-16 text-center text-xl sm:text-2xl font-black font-mono bg-slate-950 border-2 border-slate-800 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/20 rounded-2xl text-white outline-none transition-all"
                  />
                ))}
              </div>
            </div>

            {/* Resend Code Section */}
            <div className="flex items-center justify-between text-xs text-slate-400 px-1">
              <span>Didn't receive the code?</span>
              {resendCooldown > 0 ? (
                <span className="font-mono text-amber-400 font-semibold">
                  Resend in {resendCooldown}s
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleResendCode}
                  disabled={isResending}
                  className="font-bold text-amber-400 hover:text-amber-300 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className={`w-3.5 h-3.5 ${isResending ? 'animate-spin' : ''}`} />
                  Resend Code
                </button>
              )}
            </div>

            {/* Action Verify Submit */}
            <button
              type="submit"
              disabled={isLoading || code.some(d => !d)}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-bold text-sm rounded-2xl transition-all shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  <span>Verifying Code...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Verify & Enter Owner Console</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* Security Footer Notice */}
        <div className="pt-2 text-center border-t border-slate-800">
          <p className="text-[10px] text-slate-500 flex items-center justify-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-500" />
            Olive Pizza Owner Security Architecture • Hardware Salted Tokens
          </p>
        </div>
      </div>
    </div>
  );
}
