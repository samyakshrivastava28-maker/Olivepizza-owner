import React from 'react';
import { Download, Pizza, Sparkles, X, ArrowRight, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useVersionStore, performUpdate, APP_VERSION } from '../lib/versionManager';
import { useAuthStore } from '../lib/store';

export default function NativeAppUpdater() {
  const { 
    isUpdateAvailable, 
    updateMode, 
    latestVersion, 
    releaseNotes, 
    isUpdating, 
    updateProgress,
    dismissUpdate, 
    postponeUpdate 
  } = useVersionStore();

  if (!isUpdateAvailable) return null;

  const isMandatory = updateMode === 'required';

  const handleUpdate = () => {
    performUpdate();
  };

  const handleLogout = () => {
    useAuthStore.getState().logout();
    window.location.reload();
  };

  // ── 1. MANDATORY BLOCKING UPDATE MODAL ─────────────────────────────────────
  if (isMandatory) {
    return (
      <AnimatePresence>
        <div className="fixed inset-0 z-[10000] bg-[#020617] flex flex-col items-center justify-center p-4">
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-[-20%] left-[-10%] w-[70%] h-[70%] rounded-full bg-orange-600/20 blur-[120px]" />
            <div className="absolute bottom-[-20%] right-[-10%] w-[70%] h-[70%] rounded-full bg-red-600/20 blur-[120px]" />
          </div>

          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="relative max-w-md w-full bg-slate-900/90 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 shadow-2xl text-center"
          >
            <div className="w-20 h-20 bg-gradient-to-br from-orange-500 to-amber-600 rounded-2xl mx-auto flex items-center justify-center mb-6 shadow-lg shadow-orange-500/30">
              <Pizza className="w-10 h-10 text-white animate-bounce" />
            </div>
            
            <h1 className="text-2xl sm:text-3xl font-black text-white mb-2 tracking-tight">
              Essential Update Required
            </h1>
            <p className="text-slate-400 text-sm mb-6 leading-relaxed">
              {releaseNotes || "A major Olive Pizza update is required to continue enjoying lightning-fast ordering and live tracking."}
            </p>

            <div className="bg-black/50 rounded-2xl p-4 text-left mb-6 border border-white/10">
              <div className="flex justify-between items-center text-xs font-mono text-slate-300">
                <span className="text-slate-500">Current App:</span>
                <span className="text-red-400 font-bold">v{APP_VERSION}</span>
              </div>
              <div className="flex justify-between items-center text-xs font-mono text-slate-300 mt-2">
                <span className="text-slate-500">Latest Available:</span>
                <span className="text-emerald-400 font-bold">v{latestVersion || 'Latest'}</span>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={handleUpdate}
                disabled={isUpdating}
                className="w-full py-4 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold rounded-2xl shadow-lg shadow-orange-500/25 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
              >
                <Download className="w-5 h-5" />
                {isUpdating ? (updateProgress || 'Updating...') : 'Update Now'}
              </button>
              <button
                onClick={handleLogout}
                className="w-full py-3 bg-transparent border border-white/10 hover:bg-white/5 text-slate-400 font-bold text-xs rounded-2xl transition-all"
              >
                Logout & Exit
              </button>
            </div>
          </motion.div>
        </div>
      </AnimatePresence>
    );
  }

  // ── 2. NON-BLOCKING FLOATING UPDATE BANNER (OPTIONAL / RECOMMENDED) ────────
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 50, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 50, scale: 0.95 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="fixed bottom-6 right-4 left-4 sm:left-auto sm:right-6 sm:max-w-md z-[9999] bg-gradient-to-r from-slate-900/95 via-slate-900/98 to-black/95 backdrop-blur-xl border border-amber-500/30 rounded-2xl p-4 shadow-2xl text-white flex flex-col gap-3"
        style={{
          boxShadow: '0 20px 40px rgba(0,0,0,0.6), 0 0 30px rgba(249,115,22,0.2)',
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shrink-0 shadow-md">
              <Pizza className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-black uppercase tracking-wider text-amber-400">
                  New Update Available
                </span>
                {latestVersion && (
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-white/10 text-slate-300">
                    v{latestVersion}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300 font-medium line-clamp-2 mt-0.5">
                {releaseNotes || "Enjoy a faster experience, improved ordering, and new features."}
              </p>
            </div>
          </div>

          <button
            onClick={dismissUpdate}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
            title="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
          <button
            onClick={postponeUpdate}
            className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-white/5 transition-colors flex items-center gap-1"
          >
            <Clock className="w-3.5 h-3.5" /> Later
          </button>

          <button
            onClick={handleUpdate}
            disabled={isUpdating}
            className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white text-xs font-bold shadow-md shadow-orange-500/20 transition-all flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {isUpdating ? 'Updating...' : 'Update Now'}
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
