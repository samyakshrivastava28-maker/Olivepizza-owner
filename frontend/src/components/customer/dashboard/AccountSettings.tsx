import { motion } from 'framer-motion';
import CustomerProfile from '../CustomerProfile';

import { useVersionStore, checkVersion, APP_VERSION } from '../../../lib/versionManager';
import { DownloadCloud, RefreshCw } from 'lucide-react';

export default function AccountSettings() {
  const { latestVersion, isUpdateAvailable } = useVersionStore();

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-2xl text-white font-bold mb-4">Account Settings</h2>
      <CustomerProfile />

      <div className="bg-[#1E293B] border border-white/5 rounded-2xl p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
          <DownloadCloud className="w-32 h-32 text-orange-500" />
        </div>
        <h3 className="text-lg font-bold text-white mb-4 relative z-10">App Version</h3>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 relative z-10">
          <div>
            <p className="text-slate-400 text-sm mb-1">Current Version</p>
            <p className="text-white font-mono font-bold">v{APP_VERSION}</p>
            {isUpdateAvailable && latestVersion && (
               <p className="text-orange-400 text-sm mt-1 flex items-center gap-1">
                 Update v{latestVersion} available!
               </p>
            )}
          </div>
          <button 
             onClick={() => {
               checkVersion();
             }}
             className="px-5 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl text-sm font-bold flex items-center gap-2 transition-colors border border-white/10"
          >
             <RefreshCw className="w-4 h-4" /> Check For Updates
          </button>
        </div>
      </div>
    </div>
  );
}
