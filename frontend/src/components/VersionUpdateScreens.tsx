import { useVersionStore, performUpdate, APP_VERSION } from '../lib/versionManager';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, AlertCircle, Pizza } from 'lucide-react';

export function UpdateBanner() {
  const { isUpdateAvailable, updateMode, isUpdating, updateProgress } = useVersionStore();

  if (!isUpdateAvailable || updateMode === 'required') return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -100, opacity: 0 }}
        className="fixed top-0 left-0 right-0 z-[9999] bg-gradient-to-r from-orange-600 to-orange-500 text-white shadow-lg border-b border-orange-400"
      >
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-full">
              <Download className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-bold text-sm sm:text-base">🍕 New Version Available</p>
              <p className="text-xs sm:text-sm text-orange-100">
                We've improved Olive Pizza with new features, bug fixes, and better performance.
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {updateMode === 'optional' && !isUpdating && (
              <button 
                onClick={() => {
                  sessionStorage.setItem('update_later_timestamp', Date.now().toString());
                  useVersionStore.getState().dismissUpdate();
                }}
                className="px-4 py-2 text-sm font-medium text-white hover:bg-white/10 rounded-lg transition-colors flex-1 sm:flex-none"
              >
                Later
              </button>
            )}
            <button
              onClick={performUpdate}
              disabled={isUpdating}
              className="px-6 py-2 bg-white text-orange-600 font-bold text-sm rounded-lg shadow-sm hover:bg-orange-50 transition-colors disabled:opacity-50 flex-1 sm:flex-none whitespace-nowrap"
            >
              {isUpdating ? updateProgress || 'Updating...' : 'Update Now'}
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

export function ForceUpdateScreen() {
  const { isUpdateAvailable, updateMode, isUpdating, updateProgress, latestVersion } = useVersionStore();

  if (!isUpdateAvailable || updateMode !== 'required') return null;

  return (
    <div className="fixed inset-0 z-[10000] bg-slate-900 flex flex-col items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[70%] h-[70%] rounded-full bg-orange-600/20 blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[70%] h-[70%] rounded-full bg-red-600/20 blur-[120px]" />
      </div>

      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="relative max-w-md w-full bg-slate-800/80 backdrop-blur-xl border border-slate-700/50 rounded-3xl p-8 shadow-2xl text-center"
      >
        <div className="w-20 h-20 bg-gradient-to-br from-orange-500 to-red-600 rounded-2xl mx-auto flex items-center justify-center mb-6 shadow-lg shadow-orange-500/30">
          <Pizza className="w-10 h-10 text-white" />
        </div>
        
        <h1 className="text-3xl font-black text-white mb-2 tracking-tight">Update Required</h1>
        <p className="text-slate-400 mb-8 leading-relaxed">
          Your version of Olive Pizza is no longer supported. A newer version is required to continue using the application.
        </p>

        <div className="bg-slate-900/50 rounded-2xl p-5 text-left mb-8 border border-slate-700/50">
          <p className="text-sm font-semibold text-slate-300 mb-3 uppercase tracking-wider">What's New</p>
          <ul className="space-y-2">
            {[
              'Critical Bug Fixes',
              'Security Updates',
              'Performance Improvements',
              'New Features',
              'Better Compatibility'
            ].map((item, i) => (
              <li key={i} className="flex items-center gap-2 text-sm text-slate-400">
                <AlertCircle className="w-4 h-4 text-orange-500 flex-shrink-0" />
                {item}
              </li>
            ))}
          </ul>
          
          <div className="mt-4 pt-4 border-t border-slate-700/50 flex justify-between items-center text-xs text-slate-500 font-mono">
            <span>Current: v{APP_VERSION}</span>
            <span>Latest: v{latestVersion || 'Unknown'}</span>
          </div>
        </div>

        {isUpdating ? (
          <div className="space-y-4">
            <div className="h-2 w-full bg-slate-700 rounded-full overflow-hidden">
              <motion.div 
                className="h-full bg-gradient-to-r from-orange-500 to-red-500"
                initial={{ width: '0%' }}
                animate={{ width: '100%' }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            </div>
            <p className="text-sm font-medium text-orange-400 animate-pulse">{updateProgress}</p>
          </div>
        ) : (
          <button
            onClick={performUpdate}
            className="w-full py-4 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-400 hover:to-red-500 text-white font-bold rounded-xl shadow-lg shadow-orange-500/25 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
          >
            <Download className="w-5 h-5" />
            Update Now
          </button>
        )}
      </motion.div>
    </div>
  );
}
