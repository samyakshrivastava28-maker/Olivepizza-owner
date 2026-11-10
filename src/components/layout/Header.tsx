import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../lib/store';
import { LogOut, Bell, ShieldCheck, Activity } from 'lucide-react';
import { Link } from 'react-router';
import { fetchApi } from '../../lib/api';

interface HeaderProps { onToggleSidebar?: () => void; }
export const Header: React.FC<HeaderProps> = ({ onToggleSidebar }) => {
  const { user, logout } = useAuthStore();
  const [serverOnline, setServerOnline] = useState<boolean | null>(null);

  useEffect(() => {
    const checkServer = async () => {
      try {
        const res = await fetchApi('/api/heartbeat');
        setServerOnline(res.ok);
      } catch {
        setServerOnline(false);
      }
    };
    checkServer();
    const interval = setInterval(checkServer, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="h-16 border-b border-slate-800 bg-[#0E1524]/90 backdrop-blur-md px-4 sm:px-8 flex items-center justify-between sticky top-0 z-30 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700/60">
          <span
            className={`w-2 h-2 rounded-full ${
              serverOnline === true ? 'bg-emerald-400 animate-pulse' : serverOnline === false ? 'bg-red-500' : 'bg-amber-400'
            }`}
          />
          <span className="text-xs font-semibold text-slate-300 hidden sm:inline">
            {serverOnline === true ? 'Backend Connected' : serverOnline === false ? 'Backend Offline' : 'Connecting...'}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3 sm:gap-4">
        <Link
          to="/notifications"
          className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors relative"
          title="Notification Center"
        >
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-orange-500 rounded-full" />
        </Link>

        <div className="h-6 w-px bg-slate-800" />

        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-bold text-white leading-tight">{user?.name || user?.email?.split('@')[0] || 'Store Owner'}</p>
            <p className="text-[10px] font-semibold text-emerald-400">Authorized Owner</p>
          </div>
          <img
            src={user?.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.email || 'Owner')}&background=F97316&color=fff`}
            alt="Owner"
            className="w-8 h-8 rounded-full border border-orange-500/40 object-cover"
          />
          <button
            onClick={logout}
            className="p-2 text-slate-400 hover:text-red-400 rounded-xl hover:bg-slate-800 transition-colors"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};

