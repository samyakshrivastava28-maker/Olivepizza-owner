import React, { useState } from 'react';
import { Outlet, NavLink, Link, useLocation } from 'react-router';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity, Database, Cpu, Clock, AlertTriangle,
  HardDrive, ShieldCheck, Bell, Layout, Zap,
  Mail, Terminal, Menu, X, ArrowLeft, ExternalLink,
  Lock, RefreshCw
} from 'lucide-react';
import { useAuthStore } from '../../lib/store';
import { DevErrorBoundary } from './DevUI';

const NAV_ITEMS = [
  { path: '/developer/health', label: 'System Health', icon: Activity },
  { path: '/developer/data-manager', label: 'Data Manager', icon: Database },
  { path: '/developer/ai', label: 'AI Operations', icon: Cpu },
  { path: '/developer/scheduler', label: 'Crons & Scheduler', icon: Clock },
  { path: '/developer/errors', label: 'Error Center', icon: AlertTriangle },
  { path: '/developer/configs', label: 'Platform Configs', icon: HardDrive },
  { path: '/developer/audit', label: 'Audit Trail', icon: ShieldCheck },
  { path: '/developer/templates', label: 'Templates', icon: Bell },
  { path: '/developer/payment', label: 'Payment Telemetry', icon: ShieldCheck },
  { path: '/developer/email', label: 'Email Controls', icon: Mail },
  { path: '/developer/monitor', label: 'Pipeline Monitor', icon: Zap },
  { path: '/developer/diagnostics', label: 'Notification Trace', icon: Bell },
  { path: '/developer/logs', label: 'FCM Logs', icon: Terminal },
  { path: '/developer/setup', label: 'Setup & Claims', icon: Lock },
];

export default function DeveloperLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const user = useAuthStore(state => state.user);
  const location = useLocation();

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col md:flex-row">
      {/* ── Mobile Header ── */}
      <header className="md:hidden flex items-center justify-between px-4 py-3 bg-slate-900/90 backdrop-blur-md border-b border-white/10 sticky top-0 z-40">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-primary-500/10 border border-primary-500/20 text-primary-400">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-black text-white leading-none">Olive DevOps</h1>
            <p className="text-[10px] text-slate-400 font-mono">Developer Control Center</p>
          </div>
        </div>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="p-2 text-slate-300 hover:text-white rounded-xl bg-white/5 border border-white/10"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </header>

      {/* ── Sidebar (Desktop & Mobile Drawer) ── */}
      <aside className={`
        fixed md:sticky top-0 left-0 h-screen w-64 bg-slate-900/95 md:bg-slate-900/60 backdrop-blur-xl border-r border-white/10 flex flex-col z-50 transition-transform duration-200
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        {/* Brand Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary-500/10 border border-primary-500/20 text-primary-400">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-black text-white">Developer Center</h2>
              <p className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live Node v20
              </p>
            </div>
          </div>
          <button onClick={() => setMobileOpen(false)} className="md:hidden text-slate-400 p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Quick Links */}
        <div className="px-3 py-2 border-b border-white/5 flex gap-1">
          <Link
            to="/owner/dashboard"
            className="flex-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-slate-400 hover:text-white hover:bg-white/5 flex items-center justify-center gap-1 border border-white/5"
            title="Switch to Owner Dashboard"
          >
            <ArrowLeft className="w-3 h-3" /> Owner View
          </Link>
          <Link
            to="/owner/website-manager"
            className="flex-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-primary-300 hover:text-primary-200 bg-primary-500/10 hover:bg-primary-500/20 flex items-center justify-center gap-1 border border-primary-500/20"
            title="Open SDUI Website Manager"
          >
            <Layout className="w-3 h-3" /> SDUI
          </Link>
        </div>

        {/* Navigation List */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1 scrollbar-thin scrollbar-thumb-white/10">
          {NAV_ITEMS.map(({ path, label, icon: Icon }) => {
            const isActive = location.pathname === path || (path === '/developer/health' && location.pathname === '/developer');
            return (
              <NavLink
                key={path}
                to={path}
                onClick={() => setMobileOpen(false)}
                className={`
                  flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all
                  ${isActive
                    ? 'bg-primary-600 text-white shadow-lg shadow-primary-600/30 border border-primary-500/50'
                    : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'}
                `}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span className="truncate">{label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* User / Session Footer */}
        <div className="p-3 border-t border-white/10 bg-black/20">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400" />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-white font-medium truncate">{user?.email || 'webhub2811@gmail.com'}</p>
              <p className="text-[9px] text-slate-500 uppercase tracking-wider font-mono">Lead Developer RBAC</p>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Main Workspace ── */}
      <main className="flex-1 min-w-0 p-4 md:p-6 lg:p-8 max-w-7xl w-full mx-auto">
        <DevErrorBoundary>
          <Outlet />
        </DevErrorBoundary>
      </main>
    </div>
  );
}
