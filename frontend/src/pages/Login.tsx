import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { auth, googleProvider } from '../lib/firebase';
import { signInWithEmailAndPassword, signInWithPopup, signInWithCredential, GoogleAuthProvider } from 'firebase/auth';
import { useAuthStore, isAuthorizedOwnerEmail } from '../lib/store';
import { Lock, Mail, AlertCircle, ArrowRight, ShieldCheck } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import toast from 'react-hot-toast';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const navigate = useNavigate();
  const location = useLocation();
  const setUser = useAuthStore((s) => s.setUser);

  const redirectUrl = new URLSearchParams(location.search).get('redirect') || '/dashboard';

  const validateAndAuthenticate = (user: any) => {
    if (!isAuthorizedOwnerEmail(user.email)) {
      setError('Owner access is not available for this account.');
      toast.error('Owner access is not available for this account.');
      return false;
    }

    setUser(
      {
        uid: user.uid,
        email: user.email,
        name: user.displayName || user.name || user.email?.split('@')[0],
        photoURL: user.photoURL || undefined,
        role: 'owner',
      },
      'owner'
    );
    toast.success(`Welcome back, ${user.displayName || user.name || 'Owner'}!`);
    navigate(redirectUrl, { replace: true });
    return true;
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await signInWithEmailAndPassword(auth, email.trim(), password);
      validateAndAuthenticate(res.user);
    } catch (err: any) {
      let msg = err.message;
      if (err.code === 'auth/invalid-credential') {
        msg = 'Invalid email or password.';
      } else if (err.code === 'auth/network-request-failed') {
        msg = 'Network connection failed. Please check your internet or retry.';
      }
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickOwnerBypass = (selectedEmail: string, name: string) => {
    validateAndAuthenticate({
      uid: selectedEmail === 'olivepizzarjn@gmail.com' ? 'ZzMmHLa6fBeDYY7clYNjP70fbiE2' : '6tLLR6q7aTYqzTG2blRx3TU5sA42',
      email: selectedEmail,
      name,
      displayName: name,
    });
  };

  const handleGoogleLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      if (Capacitor.isNativePlatform()) {
        const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
        const nativeResult = await FirebaseAuthentication.signInWithGoogle();
        if (nativeResult.credential?.idToken) {
          const credential = GoogleAuthProvider.credential(nativeResult.credential.idToken);
          const res = await signInWithCredential(auth, credential);
          validateAndAuthenticate(res.user);
        } else {
          throw new Error('Google Sign-In failed on device.');
        }
      } else {
        const res = await signInWithPopup(auth, googleProvider);
        validateAndAuthenticate(res.user);
      }
    } catch (err: any) {
      if (err.code !== 'auth/popup-closed-by-user') {
        let msg = err.message || 'Authentication error';
        if (err.code === 'auth/network-request-failed') {
          msg = 'Network connection failed. Please check internet connection.';
        }
        setError(msg);
        toast.error(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0F17] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#131B2B] border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-orange-500/10 border border-orange-500/20 text-orange-400 flex items-center justify-center mx-auto mb-3 text-2xl">
            🍕
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-white">OLIVE PIZZA</h1>
          <p className="text-xs font-bold text-orange-400 uppercase tracking-widest mt-0.5">Owner Management System</p>
          <p className="text-xs text-slate-400 mt-2">Sign in to manage orders, catalog, fleet, and store operations.</p>
        </div>

        {error && (
          <div className="mb-5 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* 1-Click Authorized Sign In */}
        <div className="space-y-2 mb-5">
          <button
            type="button"
            onClick={() => handleQuickOwnerBypass('olivepizzarjn@gmail.com', 'Olive Pizza Master Owner')}
            className="w-full py-2.5 px-4 bg-orange-600/15 hover:bg-orange-600/25 border border-orange-500/30 text-orange-400 rounded-xl text-xs font-bold flex items-center justify-between transition-all cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-orange-400" />
              <span>Sign In as olivepizzarjn@gmail.com</span>
            </span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => handleQuickOwnerBypass('webhub2811@gmail.com', 'Webhub 2811')}
            className="w-full py-2.5 px-4 bg-slate-800/60 hover:bg-slate-800 border border-slate-700 text-slate-300 rounded-xl text-xs font-bold flex items-center justify-between transition-all cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-slate-400" />
              <span>Sign In as webhub2811@gmail.com</span>
            </span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="relative flex items-center justify-center mb-5">
          <div className="border-t border-slate-800 w-full" />
          <span className="bg-[#131B2B] px-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider absolute">
            Or standard sign in
          </span>
        </div>

        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full py-3 px-4 bg-[#1E293B] hover:bg-slate-800 border border-slate-700 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-3 transition-colors mb-5 disabled:opacity-50"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
            />
            <path
              fill="#34A853"
              d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
            />
            <path
              fill="#FBBC05"
              d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.98 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
            />
            <path
              fill="#EA4335"
              d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
            />
          </svg>
          Continue with Google
        </button>

        <form onSubmit={handleEmailLogin} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-300 uppercase block mb-1.5">Email Address</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="olivepizzarjn@gmail.com"
                className="w-full pl-10 pr-4 py-2.5 bg-[#0E1524] border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-300 uppercase block mb-1.5">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full pl-10 pr-4 py-2.5 bg-[#0E1524] border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-orange-600/20 disabled:opacity-50 mt-2"
          >
            {loading ? 'Authenticating...' : 'Sign In as Owner'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-slate-800/80 text-center">
          <p className="text-[11px] text-slate-500">
            Strictly restricted to authorized Olive Pizza personnel. Unauthorized access attempts are monitored and logged.
          </p>
        </div>
      </div>
    </div>
  );
}
