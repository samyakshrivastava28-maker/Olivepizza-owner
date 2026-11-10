import React from 'react';
import { ShieldAlert, LogOut, RefreshCw, HelpCircle } from 'lucide-react';
import { AppLogo } from './AppLogo';

interface AppRestrictedScreenProps {
  appName?: string;
  userEmail?: string;
  reason?: string;
  onRetry?: () => void;
  onSignOut: () => void;
}

export const AppRestrictedScreen: React.FC<AppRestrictedScreenProps> = ({
  appName = 'Olive Pizza Owner & Executive Console',
  userEmail,
  reason = 'This Google account is not authorized to access the Olive Pizza Owner & Executive Console.',
  onRetry,
  onSignOut,
}) => {
  return (
    <div className="min-h-screen bg-[#070A10] text-slate-100 flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden font-sans">
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-rose-950/20 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-[#0C1220] border border-rose-900/40 rounded-3xl p-6 sm:p-8 shadow-2xl relative z-10 text-center space-y-6">
        <div className="flex justify-center">
          <AppLogo variant="full" size="md" subtitle="Owner & Executive Console" />
        </div>

        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 mx-auto flex items-center justify-center shadow-lg shadow-rose-950/30">
          <ShieldAlert className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <span className="inline-block px-3 py-1 rounded-full text-[11px] font-bold tracking-wider uppercase bg-rose-500/10 text-rose-400 border border-rose-500/20">
            Access Restricted
          </span>
          <h1 className="text-lg sm:text-xl font-black text-white">
            {appName}
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 font-medium">
            {reason}
          </p>
        </div>

        {userEmail && (
          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-xs text-slate-400 font-mono break-all">
            Attempted Account: <strong className="text-white">{userEmail}</strong>
          </div>
        )}

        <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 text-left text-xs text-slate-400 space-y-2">
          <div className="flex items-center gap-1.5 text-slate-200 font-semibold text-xs">
            <HelpCircle className="w-4 h-4 text-amber-400" />
            <span>Why was access restricted?</span>
          </div>
          <ul className="space-y-1.5 text-[11px] text-slate-400 list-disc list-inside">
            <li>The Owner & Executive Console is strictly restricted to verified platform owners.</li>
            <li>Customer and unauthorized Google accounts cannot access administrative telemetry or store controls.</li>
            <li>If you are a store owner, ensure you are signing in with your designated master account.</li>
          </ul>
        </div>

        <div className="space-y-2 pt-2">
          {onRetry && (
            <button
              onClick={onRetry}
              className="w-full py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-amber-500/20 active:scale-[0.99]"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Retry Authorization Check</span>
            </button>
          )}

          <button
            onClick={onSignOut}
            className="w-full py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 font-semibold text-xs flex items-center justify-center gap-2 transition-all active:scale-[0.99]"
          >
            <LogOut className="w-4 h-4 text-rose-400" />
            <span>Sign In with Different Account</span>
          </button>
        </div>
      </div>
    </div>
  );
};
export default AppRestrictedScreen;
