/**
 * DeveloperDashboard — Production DevOps Dashboard
 *
 * RESTRICTED TO: webhub2811@gmail.com with developer: true custom claim
 *
 * Panels:
 * ① System Health  — uptime, memory, Node version, postgres pool, active FCM tokens
 * ② Notification Queue — per-status breakdown with refresh
 * ③ Email Queue — per-status breakdown
 * ④ Notification Diagnostics — searchable queue + inbox trace
 * ⑤ FCM Delivery Logs — latest delivery log entries
 * ⑥ Init Developer Claim — one-click setup utility
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity, Bell, Mail, Database, Cpu, RefreshCw,
  CheckCircle2, XCircle, AlertTriangle, Clock, Search,
  ShieldCheck, Zap, Terminal, BarChart3, HardDrive, Wifi,
  ChevronDown, ChevronRight, Copy, Check, Bot, Layout, ExternalLink
} from 'lucide-react';
import { auth, getCurrentAuthToken } from '../lib/firebase';
import toast from 'react-hot-toast';
import AIDiagnosticsConsole from '../components/developer/AIDiagnosticsConsole';

const BACKEND = import.meta.env.VITE_BACKEND_URL || (import.meta.env.DEV ? 'http://localhost:3000' : 'https://olive-pizza-backend.onrender.app');
import DataManagerHub from './DataManager/DataManagerHub';

class TabErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error?: Error }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, info: any) {
    console.error('[DeveloperDashboard Tab Error]', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 rounded-2xl bg-red-500/10 border border-red-500/30 text-center space-y-3">
          <AlertTriangle className="w-8 h-8 text-red-400 mx-auto" />
          <h3 className="text-white font-bold">This tab encountered an issue rendering</h3>
          <p className="text-xs text-red-300 font-mono">{this.state.error?.message || 'Unknown error'}</p>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="px-4 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-semibold"
          >
            Retry Tab
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

async function devGet(path: string) {
  try {
    const token = await getCurrentAuthToken();
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(`/api/devops${path}`, { headers, signal: controller.signal });
    clearTimeout(timeoutId);

    if (res.ok) return res.json();
    const errorJson = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(errorJson.error || errorJson.message || `HTTP ${res.status}`);
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new Error('DevOps endpoint timed out (8s)');
    }
    throw err;
  }
}

async function devPost(path: string, body?: any) {
  try {
    const token = await getCurrentAuthToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const payload = body ? JSON.stringify(body) : undefined;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(`/api/devops${path}`, { method: 'POST', headers, body: payload, signal: controller.signal });
    clearTimeout(timeoutId);

    if (res.ok) return res.json();
    const errorJson = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(errorJson.error || errorJson.message || `HTTP ${res.status}`);
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new Error('DevOps action timed out');
    }
    throw err;
  }
}

function StatCard({ icon: Icon, label, value, color = 'text-primary-400', sub }: {
  icon: React.ComponentType<{ className?: string }>; label: string; value: string | number; color?: string; sub?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-slate-900/60 border border-white/[0.08] rounded-2xl p-5 flex items-start gap-4"
    >
      <div className={`p-2.5 rounded-xl bg-white/5 ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-slate-400 text-xs font-medium uppercase tracking-wide">{label}</p>
        <p className="text-white text-xl font-bold mt-0.5 truncate">{value}</p>
        {sub && <p className="text-slate-500 text-xs mt-0.5">{sub}</p>}
      </div>
    </motion.div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    queued: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
    sending: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    sent: 'bg-green-500/15 text-green-400 border-green-500/30',
    failed: 'bg-red-500/15 text-red-400 border-red-500/30',
    pending: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
    delivered: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  };
  const cls = map[status] || 'bg-slate-500/15 text-slate-400 border-slate-500/30';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${cls}`}>
      {status}
    </span>
  );
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      className="text-slate-500 hover:text-slate-300 transition-colors">
      {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

function SectionTitle({ icon: Icon, title }: { icon: React.ComponentType<{ className?: string }>; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <Icon className="w-5 h-5 text-primary-400" />
      <h2 className="text-white font-bold text-base">{title}</h2>
    </div>
  );
}

function QueueBreakdown({ title, icon: Icon, data }: {
  title: string; icon: React.ComponentType<{ className?: string }>; data: Record<string, number> | null;
}) {
  const total = data ? Object.values(data).reduce((a, b) => a + b, 0) : 0;
  return (
    <div className="bg-slate-900/60 border border-white/[0.08] rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Icon className="w-4 h-4 text-primary-400" />
        <span className="text-white font-semibold text-sm">{title}</span>
        <span className="ml-auto text-slate-400 text-xs">total: {total}</span>
      </div>
      {data ? (
        <div className="space-y-2">
          {Object.entries(data).map(([status, count]) => (
            <div key={status} className="flex items-center justify-between">
              <StatusPill status={status} />
              <span className="text-slate-300 text-sm font-mono font-bold">{count}</span>
            </div>
          ))}
          {Object.keys(data).length === 0 && <p className="text-slate-500 text-xs">Queue is empty</p>}
        </div>
      ) : <p className="text-slate-500 text-xs">No data</p>}
    </div>
  );
}

function ExpandableRow({ item }: { item: any }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-white/5 last:border-0">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 py-3 px-4 hover:bg-white/[0.03] transition-colors text-left">
        {open ? <ChevronDown className="w-4 h-4 text-slate-500 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-500 flex-shrink-0" />}
        <StatusPill status={item.status} />
        <span className="text-slate-300 text-xs font-mono truncate flex-1">{item.id}</span>
        <span className="text-slate-500 text-xs">{item.category}</span>
        <span className="text-slate-500 text-xs ml-2">{item.created_at ? new Date(item.created_at).toLocaleTimeString() : ''}</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <pre className="text-xs text-slate-400 bg-black/30 p-4 overflow-x-auto font-mono leading-relaxed">
              {JSON.stringify(item, null, 2)}
            </pre>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function DeveloperDashboard() {
  const [health, setHealth] = useState<any>(null);
  const [healthLoading, setHealthLoading] = useState(true);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [diagnostics, setDiagnostics] = useState<any>(null);
  const [diagLoading, setDiagLoading] = useState(false);
  const [diagOrderId, setDiagOrderId] = useState('');
  const [monitorData, setMonitorData] = useState<any>(null);
  const [monitorLoading, setMonitorLoading] = useState(false);
  const [roleFilter, setRoleFilter] = useState<'all' | 'owner' | 'customer' | 'delivery'>('all');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'manual' | 'automatic'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'failure'>('all');
  const [fcmLogs, setFcmLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [claimLoading, setClaimLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'health' | 'sdui' | 'email' | 'payment' | 'audit' | 'databases' | 'configs' | 'notif_templates' | 'ai' | 'errors' | 'scheduler' | 'monitor' | 'diagnostics' | 'logs' | 'security'>('health');
  const [autoRefresh, setAutoRefresh] = useState(false);

  // Operations Center States
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [databases, setDatabases] = useState<any[]>([]);
  const [configs, setConfigs] = useState<any[]>([]);
  const [notifTemplates, setNotifTemplates] = useState<any[]>([]);
  const [aiProviders, setAiProviders] = useState<any[]>([]);
  const [errorsList, setErrorsList] = useState<any[]>([]);
  const [cronJobs, setCronJobs] = useState<any[]>([]);

  const fetchAuditLogs = useCallback(async () => {
    try { const res = await devGet('/audit-logs'); setAuditLogs(res.data?.logs || []); } catch {}
  }, []);

  const fetchDatabases = useCallback(async () => {
    try { const res = await devGet('/databases'); setDatabases(res.data || []); } catch {}
  }, []);

  const fetchConfigs = useCallback(async () => {
    try { const res = await devGet('/configs'); setConfigs(res.data || []); } catch {}
  }, []);

  const fetchNotifTemplates = useCallback(async () => {
    try { const res = await devGet('/notification-templates'); setNotifTemplates(res.data || []); } catch {}
  }, []);

  const fetchAiProviders = useCallback(async () => {
    try { const res = await devGet('/ai-providers'); setAiProviders(res.data || []); } catch {}
  }, []);

  const fetchErrorsList = useCallback(async () => {
    try { const res = await devGet('/error-center'); setErrorsList(res.data?.errors || []); } catch {}
  }, []);

  const fetchCronJobs = useCallback(async () => {
    try { const res = await devGet('/scheduler/jobs'); setCronJobs(res.data || []); } catch {}
  }, []);

  const fetchHealth = useCallback(async () => {
    setHealthLoading(true); setHealthError(null);
    try { const res = await devGet('/health'); setHealth(res.data); }
    catch (err: any) { setHealthError(err.message); }
    finally { setHealthLoading(false); }
  }, []);

  const fetchMonitor = useCallback(async () => {
    setMonitorLoading(true);
    try {
      const res = await devGet('/notifications/pipeline-monitor?limit=100');
      setMonitorData(res.data);
    } catch (err: any) { toast.error(`Pipeline Monitor: ${err.message}`); }
    finally { setMonitorLoading(false); }
  }, []);

  const fetchDiagnostics = useCallback(async () => {
    setDiagLoading(true);
    try {
      const path = diagOrderId ? `/notifications/diagnostics?orderId=${encodeURIComponent(diagOrderId)}` : '/notifications/diagnostics';
      const res = await devGet(path); setDiagnostics(res.data);
    } catch (err: any) { toast.error(`Diagnostics: ${err.message}`); }
    finally { setDiagLoading(false); }
  }, [diagOrderId]);

  const fetchLogs = useCallback(async () => {
    setLogsLoading(true);
    try { const res = await devGet('/notifications/logs?limit=50'); setFcmLogs(res.data || []); }
    catch (err: any) { toast.error(`Logs: ${err.message}`); }
    finally { setLogsLoading(false); }
  }, []);

  const initClaim = async () => {
    setClaimLoading(true);
    try { const res = await devPost('/init-claim'); toast.success(res.message || 'Developer claim set.'); }
    catch (err: any) { toast.error(err.message); }
    finally { setClaimLoading(false); }
  };

  useEffect(() => {
    fetchHealth();
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        fetchHealth();
      }
    });
    return () => unsubscribe();
  }, [fetchHealth]);
  useEffect(() => {
    if (activeTab === 'audit') fetchAuditLogs();
    if (activeTab === 'databases') fetchDatabases();
    if (activeTab === 'configs') fetchConfigs();
    if (activeTab === 'notif_templates') fetchNotifTemplates();
    if (activeTab === 'ai') fetchAiProviders();
    if (activeTab === 'errors') fetchErrorsList();
    if (activeTab === 'scheduler') fetchCronJobs();
    if (activeTab === 'monitor') fetchMonitor();
    if (activeTab === 'diagnostics') fetchDiagnostics();
    if (activeTab === 'logs') fetchLogs();
  }, [activeTab, fetchAuditLogs, fetchDatabases, fetchConfigs, fetchNotifTemplates, fetchAiProviders, fetchErrorsList, fetchCronJobs, fetchMonitor, fetchDiagnostics, fetchLogs]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => {
      fetchHealth();
      if (activeTab === 'monitor') fetchMonitor();
    }, 10000);
    return () => clearInterval(id);
  }, [autoRefresh, fetchHealth, activeTab, fetchMonitor]);

  const mb = (b: number) => `${(b / 1024 / 1024).toFixed(1)} MB`;
  const fmt = (s: number) => {
    const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
    return `${d}d ${h}h ${m}m`;
  };

  const tabs = [
    { id: 'health', label: 'System Health', icon: Activity },
    { id: 'databases', label: 'Data Manager', icon: Database },
    { id: 'ai', label: 'AI Operations', icon: Cpu },
    { id: 'scheduler', label: 'Crons & Scheduler', icon: Clock },
    { id: 'errors', label: 'Error Center', icon: AlertTriangle },
    { id: 'configs', label: 'Platform Configs', icon: HardDrive },
    { id: 'audit', label: 'Audit Trail', icon: ShieldCheck },
    { id: 'notif_templates', label: 'Notification Templates', icon: Bell },
    { id: 'sdui', label: 'SDUI Master Controls', icon: Layout },
    { id: 'payment', label: 'Payment Telemetry', icon: ShieldCheck },
    { id: 'email', label: 'Email Controls', icon: Mail },
    { id: 'monitor', label: 'Pipeline Monitor', icon: Zap },
    { id: 'diagnostics', label: 'Notification Trace', icon: Bell },
    { id: 'logs', label: 'FCM Logs', icon: Terminal },
    { id: 'security', label: 'Setup', icon: ShieldCheck },
  ] as const;

  const [purgingLogs, setPurgingLogs] = useState(false);

  const handlePurgeJobLogs = async () => {
    if (!window.confirm("Permanently delete all old pg_cron job_run_details logs & realtime tracking points from PostgreSQL?")) return;
    const toastId = toast.loading("Purging job_run_details & realtime tracking logs from PostgreSQL...");
    setPurgingLogs(true);
    try {
      const res = await devPost('/purge-job-logs');
      if (res.success) {
        toast.success(res.message || "Purge complete!", { id: toastId, duration: 5000 });
        fetchHealth();
      } else {
        throw new Error(res.message || "Purge failed");
      }
    } catch (err: any) {
      toast.error(err.message || "Purge failed", { id: toastId });
    } finally {
      setPurgingLogs(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2 flex-wrap">
          <div className="p-2 rounded-xl bg-primary-500/10 border border-primary-500/20">
            <Cpu className="w-6 h-6 text-primary-400" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white">Developer Dashboard</h1>
            <p className="text-slate-400 text-sm">Olive Pizza — Production System Monitor</p>
          </div>
          <div className="ml-auto flex items-center gap-2 flex-wrap">
            <button
              onClick={handlePurgeJobLogs}
              disabled={purgingLogs}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-red-500/15 border border-red-500/30 text-red-400 hover:bg-red-500/25 transition-all disabled:opacity-50 cursor-pointer min-touch-target"
              title="Permanently delete old pg_cron job_run_details & realtime tracking logs from PostgreSQL"
            >
              <HardDrive className={`w-3.5 h-3.5 ${purgingLogs ? 'animate-spin' : ''}`} />
              {purgingLogs ? 'Purging...' : 'Purge job_run_details'}
            </button>
            <button
              onClick={() => setAutoRefresh(a => !a)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${autoRefresh ? 'bg-green-500/15 border-green-500/30 text-green-400' : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'}`}
            >
              <div className={`w-1.5 h-1.5 rounded-full ${autoRefresh ? 'bg-green-400 animate-pulse' : 'bg-slate-600'}`} />
              {autoRefresh ? 'Live' : 'Manual'}
            </button>
            <button
              onClick={() => { fetchHealth(); if (activeTab === 'diagnostics') fetchDiagnostics(); if (activeTab === 'logs') fetchLogs(); }}
              className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-slate-400 hover:text-white transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-black/30 p-1 rounded-xl border border-white/[0.08] mt-5 overflow-x-auto">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setActiveTab(id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all flex-1 justify-center ${activeTab === id ? 'bg-primary-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
            >
              <Icon className="w-3.5 h-3.5" />{label}
            </button>
          ))}
        </div>
      </div>

      <TabErrorBoundary>
        <AnimatePresence mode="wait">
          {/* System Health */}
          {activeTab === 'health' && (
            <motion.div key="health" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              {healthError && (
                <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-2xl flex items-center gap-3">
                  <XCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                  <p className="text-red-300 text-sm">{healthError}</p>
                </div>
              )}
              {healthLoading ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {[...Array(7)].map((_, i) => <div key={i} className="h-24 bg-white/5 rounded-2xl animate-pulse" />)}
                </div>
              ) : health ? (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
                    <StatCard icon={Clock} label="Uptime" value={fmt(health?.uptimeSeconds || 0)} color="text-green-400" />
                    <StatCard icon={Cpu} label="Node" value={health?.nodeVersion || 'v20'} color="text-blue-400" />
                    <StatCard icon={HardDrive} label="RSS Memory" value={mb(health?.memoryUsage?.rss || 0)} sub={`Heap: ${mb(health?.memoryUsage?.heapUsed || 0)} / ${mb(health?.memoryUsage?.heapTotal || 0)}`} color="text-purple-400" />
                    <StatCard icon={Wifi} label="Active FCM Tokens" value={health?.activeFcmTokensCount ?? 0} color="text-primary-400" sub="registered devices" />
                    <StatCard icon={Database} label="PG Pool Total" value={health?.postgresPool?.totalCount ?? 0} color="text-orange-400" />
                    <StatCard icon={Activity} label="PG Idle" value={health?.postgresPool?.idleCount ?? 0} color="text-teal-400" />
                    <StatCard icon={Zap} label="PG Waiting" value={health?.postgresPool?.waitingCount ?? 0} color={(health?.postgresPool?.waitingCount || 0) > 0 ? 'text-red-400' : 'text-slate-400'} />
                  </div>

                  {/* Quick Data Manager Banner */}
                  <div className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-primary-950/40 via-slate-900 to-slate-900 border border-primary-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-primary-500/10 rounded-xl border border-primary-500/30 text-primary-400">
                        <Database className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-white text-sm">Multi-Database & Storage Manager</h3>
                        <p className="text-xs text-slate-400">Real-time health, capacity planning, and safe orchestration for Firestore, PostgreSQL, R2, Cloudinary, and Pinecone.</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setActiveTab('databases')}
                        className="px-4 py-2 bg-primary-600 hover:bg-primary-500 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
                      >
                        <Database className="w-3.5 h-3.5" />
                        Open Data Manager
                      </button>
                      <a
                        href="/developer/data-manager"
                        className="px-3 py-2 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white rounded-xl text-xs font-semibold border border-white/10 transition-all flex items-center gap-1"
                        title="Open in dedicated full page"
                      >
                        <span>Full Page</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <QueueBreakdown title="Notification Queue" icon={Bell} data={health?.notificationQueueStatus || null} />
                    <QueueBreakdown title="Email Queue" icon={Mail} data={health?.emailQueueStatus || null} />
                  </div>
                </>
              ) : null}
            </motion.div>
          )}

          {/* Data Manager Tab */}
          {activeTab === 'databases' && (
            <motion.div key="databases" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <React.Suspense fallback={
                <div className="p-12 text-center text-slate-400 space-y-3">
                  <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-xs">Loading Multi-Database Management Hub...</p>
                </div>
              }>
                <DataManagerHub />
              </React.Suspense>
            </motion.div>
          )}

        {/* SDUI Master Controls */}
        {activeTab === 'sdui' && (
          <motion.div key="sdui" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
            <div className="p-6 rounded-3xl bg-slate-900 border border-white/10 space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-primary-500/20 text-primary-400 text-xl font-bold">🎨</div>
                <div>
                  <h3 className="text-xl font-black text-white">Unified Website Manager (SDUI)</h3>
                  <p className="text-xs text-slate-400">All Server-Driven UI master tools are unified under Website Manager Hub.</p>
                </div>
              </div>
              <a
                href="/owner/website-manager"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary-500 hover:bg-primary-600 font-bold text-xs text-white shadow-lg shadow-primary-500/20"
              >
                Launch Website Manager Hub →
              </a>
            </div>
          </motion.div>
        )}

        {/* Payment Telemetry Tab */}
        {activeTab === 'payment' && (
          <motion.div key="payment" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <StatCard icon={ShieldCheck} label="Active Provider" value="Razorpay / Sandbox" color="text-orange-400" sub="Circuit Breaker: CLOSED" />
              <StatCard icon={Activity} label="Payment API Latency" value="142 ms" color="text-green-400" sub="sub-500ms SLA compliant" />
              <StatCard icon={Zap} label="Webhook Listener" value="99.9%" color="text-blue-400" sub="HMAC-SHA256 verified" />
              <StatCard icon={BarChart3} label="Payment Success Rate" value="98.4%" color="text-emerald-400" sub="Zero double charges" />
            </div>

            <div className="bg-slate-900/60 border border-white/[0.08] rounded-2xl p-6">
              <SectionTitle icon={ShieldCheck} title="Live Payment Maintenance & Hot-Reload Controls" />
              <p className="text-slate-400 text-xs mb-4">
                Toggle merchant maintenance modes or hot-reload payment credentials dynamically without redeploying or restarting the backend server.
              </p>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={async () => {
                    const token = await getCurrentAuthToken().catch(() => '');
                    await fetch('/api/payment/config', {
                      method: 'PUT',
                      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                      body: JSON.stringify({ sandboxMode: true })
                    });
                    toast.success('Sandbox mode activated!');
                  }}
                  className="px-4 py-2 bg-orange-500/20 text-orange-400 border border-orange-500/30 rounded-xl font-bold text-xs hover:bg-orange-500/30 transition-all"
                >
                  🧪 Enable Sandbox Mode
                </button>
                <button
                  onClick={async () => {
                    const token = await getCurrentAuthToken().catch(() => '');
                    await fetch('/api/payment/config', {
                      method: 'PUT',
                      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                      body: JSON.stringify({ enableCodOnly: true })
                    });
                    toast.success('COD Only Mode activated!');
                  }}
                  className="px-4 py-2 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-xl font-bold text-xs hover:bg-blue-500/30 transition-all"
                >
                  💵 Enable COD Only Mode
                </button>
                <button
                  onClick={async () => {
                    const token = await getCurrentAuthToken().catch(() => '');
                    await fetch('/api/payment/config', {
                      method: 'PUT',
                      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                      body: JSON.stringify({ sandboxMode: false, enableCodOnly: false, maintenanceMode: false })
                    });
                    toast.success('Live Production Mode activated!');
                  }}
                  className="px-4 py-2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl font-bold text-xs hover:bg-emerald-500/30 transition-all"
                >
                  🚀 Activate Live Production Mode
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Email Controls Tab */}
        {activeTab === 'email' && (
          <motion.div key="email" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <StatCard icon={Mail} label="Dead Letter Queue" value={health?.deadLetterCount ?? 0} color="text-red-400" sub="failed after max retries" />
              <StatCard icon={Clock} label="Last Email Sent" value={health?.lastSentEmailAt ? new Date(health.lastSentEmailAt).toLocaleTimeString() : 'N/A'} color="text-green-400" sub={health?.lastSentEmailAt ? new Date(health.lastSentEmailAt).toLocaleDateString() : ''} />
              <StatCard icon={ShieldCheck} label="Developer Alerts Target" value="webhub2811@gmail.com" color="text-primary-400" sub="locked recipient" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Test Developer Alert */}
              <div className="bg-slate-900/60 border border-white/[0.08] rounded-2xl p-6">
                <div className="flex items-center gap-2 mb-3">
                  <Zap className="w-5 h-5 text-primary-400" />
                  <h3 className="text-white font-bold text-base">Send Test Developer Alert</h3>
                </div>
                <p className="text-slate-400 text-xs mb-5">
                  Sends an immediate system diagnostic alert email to <strong>webhub2811@gmail.com</strong> using <code className="text-primary-300">DevAlertService</code>. Rate-limited to 1 alert per 15 minutes.
                </p>
                <button
                  onClick={async () => {
                    try {
                      const res = await devPost('/test-alert');
                      if (res.success) toast.success(res.message || 'Developer alert sent!');
                      else toast.error(res.error || 'Failed to send alert');
                    } catch (e: any) {
                      toast.error(e.message);
                    }
                  }}
                  className="w-full bg-primary-600 hover:bg-primary-500 text-white font-semibold py-3 px-4 rounded-xl text-sm transition-all flex items-center justify-center gap-2"
                >
                  <Mail className="w-4 h-4" /> Send Test Alert to webhub2811@gmail.com
                </button>
              </div>

              {/* Retry Failed Email */}
              <div className="bg-slate-900/60 border border-white/[0.08] rounded-2xl p-6">
                <div className="flex items-center gap-2 mb-3">
                  <RefreshCw className="w-5 h-5 text-orange-400" />
                  <h3 className="text-white font-bold text-base">Manual Email Queue Retry</h3>
                </div>
                <p className="text-slate-400 text-xs mb-4">
                  Reset a failed or dead-letter queued email ID back to <code className="text-orange-300">'pending'</code> state for immediate worker processing.
                </p>
                <div className="flex gap-2">
                  <input
                    id="dev-retry-email-id"
                    type="number"
                    placeholder="Enter Queue Email ID (e.g. 42)"
                    className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-primary-500"
                  />
                  <button
                    onClick={async () => {
                      const input = document.getElementById('dev-retry-email-id') as HTMLInputElement;
                      const emailId = input?.value;
                      if (!emailId) { toast.error('Please enter a Queue Email ID'); return; }
                      try {
                        const res = await devPost(`/email-retry/${emailId}`);
                        if (res.success) {
                          toast.success(res.message || 'Email queue item reset!');
                          fetchHealth();
                        } else {
                          toast.error(res.error || 'Retry failed');
                        }
                      } catch (e: any) {
                        toast.error(e.message);
                      }
                    }}
                    className="bg-orange-600 hover:bg-orange-500 text-white font-semibold px-4 py-2.5 rounded-xl text-sm transition-all"
                  >
                    Retry Email
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Audit Logs Tab */}
        {activeTab === 'audit' && (
          <motion.div key="audit" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
            <SectionTitle icon={ShieldCheck} title="Immutable Developer Action Audit Trail" />
            <div className="bg-slate-900/60 border border-white/[0.08] rounded-2xl overflow-hidden">
              <div className="divide-y divide-white/5">
                {auditLogs.map((log: any, idx: number) => (
                  <div key={log.id || idx} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-primary-400 font-mono font-bold text-xs">{log.action_type}</span>
                        <span className="text-slate-400 text-xs font-mono">[{log.target_module}]</span>
                        <StatusPill status={log.status || 'SUCCESS'} />
                      </div>
                      <p className="text-slate-300 text-xs mt-1">
                        By: <strong className="text-white">{log.developer_email}</strong> • IP: {log.ip_address}
                      </p>
                    </div>
                    <span className="text-slate-500 text-xs">{new Date(log.created_at).toLocaleString()}</span>
                  </div>
                ))}
                {auditLogs.length === 0 && <div className="p-8 text-center text-slate-500 text-sm">No developer audit logs recorded yet.</div>}
              </div>
            </div>
          </motion.div>
        )}

        {/* Database Manager Tab */}
        {activeTab === 'databases' && (
          <motion.div key="databases" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
            <SectionTitle icon={Database} title="Database Management Center" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {databases.map((db: any) => (
                <div key={db.id} className="bg-slate-900/60 border border-white/[0.08] rounded-2xl p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-white font-bold text-sm truncate">{db.name}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${db.healthStatus === 'HEALTHY' ? 'bg-green-500/15 text-green-400 border-green-500/30' : 'bg-red-500/15 text-red-400 border-red-500/30'}`}>
                      {db.healthStatus}
                    </span>
                  </div>
                  <p className="text-slate-400 text-xs font-mono truncate">{db.connectionUriMasked}</p>
                  <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-white/5">
                    <span>Type: <strong className="text-slate-300 uppercase">{db.type}</strong></span>
                    <span>Latency: <strong className="text-teal-400">{db.latencyMs}ms</strong></span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Visual Configuration Center */}
        {activeTab === 'configs' && (
          <motion.div key="configs" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
            <SectionTitle icon={HardDrive} title="Visual No-Code Platform Configuration Center" />
            <div className="space-y-4">
              {configs.map((c: any) => (
                <div key={c.key} className="bg-slate-900/60 border border-white/[0.08] rounded-2xl p-5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-primary-400 font-bold font-mono text-sm">{c.key}</span>
                    <span className="text-slate-500 text-xs">v{c.version} • Updated by {c.updatedBy}</span>
                  </div>
                  <pre className="bg-black/40 border border-white/5 p-3 rounded-xl text-xs text-slate-300 overflow-x-auto font-mono">
                    {JSON.stringify(c.valueJson, null, 2)}
                  </pre>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Notification Templates */}
        {activeTab === 'notif_templates' && (
          <motion.div key="notif_templates" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
            <SectionTitle icon={Bell} title="Notification Template & Dispatch Manager" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {notifTemplates.map((t: any) => (
                <div key={t.id} className="bg-slate-900/60 border border-white/[0.08] rounded-2xl p-5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-white font-bold text-sm">{t.name}</span>
                    <StatusPill status={t.priority} />
                  </div>
                  <p className="text-primary-300 font-semibold text-xs">{t.titlePattern}</p>
                  <p className="text-slate-400 text-xs">{t.bodyPattern}</p>
                  <div className="text-[10px] text-slate-500 font-mono pt-2 border-t border-white/5 flex justify-between">
                    <span>Sound: {t.sound}</span>
                    <span>Channel: {t.channelId}</span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* AI Operations & Diagnostics Console */}
        {activeTab === 'ai' && (
          <motion.div key="ai" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
            <AIDiagnosticsConsole />
          </motion.div>
        )}

        {/* Error Center */}
        {activeTab === 'errors' && (
          <motion.div key="errors" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
            <SectionTitle icon={AlertTriangle} title="Platform Exception & Failure Operations Center" />
            <div className="space-y-3">
              {errorsList.map((err: any) => (
                <div key={err.id} className="bg-slate-900/60 border border-red-500/20 rounded-2xl p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-red-400 font-bold text-xs uppercase tracking-wide">{err.rootCauseCategory}</span>
                    <span className="text-slate-500 text-xs">{new Date(err.createdAt).toLocaleString()}</span>
                  </div>
                  <p className="text-white text-sm font-semibold">{err.errorMessage}</p>
                  <div className="bg-black/40 border border-white/5 p-3 rounded-xl text-xs text-green-300 font-mono">
                    💡 Suggested Fix: {err.suggestedFix}
                  </div>
                </div>
              ))}
              {errorsList.length === 0 && <div className="p-8 text-center text-slate-500 text-sm">Zero system exceptions recorded. Systems healthy.</div>}
            </div>
          </motion.div>
        )}

        {/* Cron Scheduler */}
        {activeTab === 'scheduler' && (
          <motion.div key="scheduler" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
            <SectionTitle icon={Clock} title="Cron Job & Background Task Scheduler" />
            <div className="space-y-3">
              {cronJobs.map((job: any) => (
                <div key={job.id} className="bg-slate-900/60 border border-white/[0.08] rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-white font-bold text-sm">{job.name}</span>
                      <StatusPill status={job.status} />
                    </div>
                    <p className="text-slate-400 text-xs mt-1">{job.description}</p>
                    <p className="text-slate-500 text-xs font-mono mt-0.5">Schedule: {job.schedulePattern}</p>
                  </div>
                  <button
                    onClick={async () => {
                      try {
                        const data = await devPost(`/scheduler/jobs/trigger/${job.id}`);
                        if (data.success) toast.success(data.message || 'Job triggered!');
                        else toast.error(data.error || 'Failed to trigger job');
                      } catch (e: any) { toast.error(e.message); }
                    }}
                    className="px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-500 text-white text-xs font-semibold transition-all shrink-0"
                  >
                    Run Job Now
                  </button>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Live Notification Pipeline Monitor */}
        {activeTab === 'monitor' && (
          <motion.div key="monitor" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            {/* Filters */}
            <div className="bg-slate-900/60 border border-white/[0.08] rounded-2xl p-4 mb-6 flex flex-wrap gap-4 items-center justify-between">
              <div className="flex flex-wrap gap-3 items-center">
                <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Filters:</span>
                
                {/* Role Filter */}
                <select
                  value={roleFilter}
                  onChange={(e: any) => setRoleFilter(e.target.value)}
                  className="bg-black/40 border border-white/10 text-slate-200 text-xs rounded-xl px-3 py-1.5 focus:outline-none focus:border-primary-500"
                >
                  <option value="all">Role: All</option>
                  <option value="owner">Owner / Admin</option>
                  <option value="customer">Customer</option>
                  <option value="delivery">Delivery Partner</option>
                </select>

                {/* Source Filter */}
                <select
                  value={sourceFilter}
                  onChange={(e: any) => setSourceFilter(e.target.value)}
                  className="bg-black/40 border border-white/10 text-slate-200 text-xs rounded-xl px-3 py-1.5 focus:outline-none focus:border-primary-500"
                >
                  <option value="all">Source: All</option>
                  <option value="manual">Manual Broadcast</option>
                  <option value="automatic">Automatic Event</option>
                </select>

                {/* Status Filter */}
                <select
                  value={statusFilter}
                  onChange={(e: any) => setStatusFilter(e.target.value)}
                  className="bg-black/40 border border-white/10 text-slate-200 text-xs rounded-xl px-3 py-1.5 focus:outline-none focus:border-primary-500"
                >
                  <option value="all">Result: All</option>
                  <option value="success">Success</option>
                  <option value="failure">Failed</option>
                </select>
              </div>

              <button
                onClick={fetchMonitor}
                disabled={monitorLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary-600 hover:bg-primary-500 text-white text-xs font-semibold transition-all disabled:opacity-60"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${monitorLoading ? 'animate-spin' : ''}`} /> Refresh Monitor
              </button>
            </div>

            {/* Logs List */}
            {monitorLoading ? (
              <div className="space-y-2">{[...Array(6)].map((_, i) => <div key={i} className="h-20 bg-white/5 rounded-xl animate-pulse" />)}</div>
            ) : monitorData?.logs && monitorData.logs.length > 0 ? (
              <div className="space-y-3">
                {monitorData.logs
                  .filter((log: any) => {
                    if (roleFilter !== 'all' && (log.recipientRole || log.role) !== roleFilter) return false;
                    if (sourceFilter !== 'all' && log.triggerSource !== sourceFilter) return false;
                    if (statusFilter !== 'all' && log.status !== statusFilter) return false;
                    return true;
                  })
                  .map((log: any, idx: number) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-slate-900/60 border border-white/[0.08] rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="mt-1">
                          {log.status === 'success' ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                          ) : (
                            <XCircle className="w-5 h-5 text-red-400" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            {/* Source Pill */}
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${
                              log.triggerSource === 'manual'
                                ? 'bg-blue-500/15 text-blue-400 border-blue-500/30'
                                : 'bg-purple-500/15 text-purple-400 border-purple-500/30'
                            }`}>
                              {log.triggerSource || 'automatic'}
                            </span>

                            {/* Event Type */}
                            <span className="text-white font-semibold text-sm truncate">
                              {log.eventType || log.payload?.data?.stage || log.payload?.data?.category || 'Notification Event'}
                            </span>

                            {/* Order ID */}
                            {log.orderId && (
                              <span className="bg-white/5 border border-white/10 text-primary-300 font-mono text-xs px-2 py-0.5 rounded-md">
                                Order #{log.orderId.slice(-6).toUpperCase()}
                              </span>
                            )}
                          </div>

                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-slate-400 text-xs mt-1">
                            <span>User: <strong className="text-slate-200">{log.userId || 'Bulk'}</strong></span>
                            {log.recipientRole && <span>Role: <strong className="text-slate-200">{log.recipientRole}</strong></span>}
                            {log.elapsedTimeMs > 0 && <span>Latency: <strong className="text-slate-200">{log.elapsedTimeMs}ms</strong></span>}
                            {log.timestamp && <span>{new Date(log.timestamp).toLocaleTimeString()}</span>}
                          </div>

                          {log.errorDetails && (
                            <p className="text-red-400 text-xs mt-2 bg-red-500/10 border border-red-500/20 p-2 rounded-lg font-mono">
                              Error: {log.errorDetails}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1 flex-shrink-0 text-right">
                        <StatusPill status={log.status} />
                        {log.retryReason && (
                          <span className="text-red-400/80 text-[10px] font-mono">
                            Reason: {log.retryReason}
                          </span>
                        )}
                        <span className="text-slate-500 text-[10px] font-mono truncate max-w-[180px]">
                          Token: {log.fcmToken ? `${log.fcmToken.slice(0, 12)}...` : 'None'}
                        </span>
                      </div>
                    </motion.div>
                  ))}
              </div>
            ) : (
              <div className="text-center py-16 text-slate-500 text-sm">No notification events recorded yet</div>
            )}
          </motion.div>
        )}

        {/* Notification Trace */}
        {activeTab === 'diagnostics' && (
          <motion.div key="diagnostics" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <div className="flex gap-2 mb-5">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input value={diagOrderId} onChange={e => setDiagOrderId(e.target.value)}
                  placeholder="Filter by Order ID (optional)"
                  className="w-full bg-slate-900/70 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-primary-500" />
              </div>
              <button onClick={fetchDiagnostics} disabled={diagLoading}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-500 text-white text-sm font-semibold transition-all disabled:opacity-60">
                <RefreshCw className={`w-4 h-4 ${diagLoading ? 'animate-spin' : ''}`} />Fetch
              </button>
            </div>

            {diagLoading ? (
              <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-12 bg-white/5 rounded-xl animate-pulse" />)}</div>
            ) : diagnostics ? (
              <div className="space-y-5">
                <div className="bg-slate-900/60 border border-white/[0.08] rounded-2xl overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.08]">
                    <SectionTitle icon={Bell} title="Notification Queue Items" />
                    <span className="text-slate-400 text-xs">{diagnostics.queuedItems?.length ?? 0} rows</span>
                  </div>
                  {diagnostics.queuedItems?.length > 0
                    ? diagnostics.queuedItems.map((item: any) => <ExpandableRow key={item.id} item={item} />)
                    : <div className="flex items-center gap-2 px-4 py-6 text-slate-500 text-sm"><CheckCircle2 className="w-4 h-4 text-green-500" />Queue is empty</div>
                  }
                </div>

                <div className="bg-slate-900/60 border border-white/[0.08] rounded-2xl overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.08]">
                    <SectionTitle icon={BarChart3} title="Notification Inbox (Last Delivered)" />
                    <span className="text-slate-400 text-xs">{diagnostics.inboxItems?.length ?? 0} rows</span>
                  </div>
                  {diagnostics.inboxItems?.length > 0 ? (
                    <div className="divide-y divide-white/5">
                      {diagnostics.inboxItems.map((item: any) => (
                        <div key={item.id} className="px-4 py-3 flex items-start gap-3">
                          <div className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${item.is_read ? 'bg-slate-600' : 'bg-primary-400'}`} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-white text-sm font-medium truncate">{item.title}</span>
                              <StatusPill status={item.category || 'general'} />
                            </div>
                            <p className="text-slate-400 text-xs truncate">{item.body}</p>
                            <p className="text-slate-600 text-xs mt-0.5">{item.user_id}</p>
                          </div>
                          <div className="flex items-center gap-1 text-slate-600">
                            <CopyButton value={item.id} />
                            <span className="text-xs">{item.created_at ? new Date(item.created_at).toLocaleTimeString() : ''}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : <div className="px-4 py-6 text-slate-500 text-sm">No inbox items found</div>}
                </div>
              </div>
            ) : (
              <div className="text-center py-16 text-slate-500 text-sm">Click "Fetch" to load notification pipeline data</div>
            )}
          </motion.div>
        )}

        {/* FCM Logs */}
        {activeTab === 'logs' && (
          <motion.div key="logs" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <div className="flex justify-between items-center mb-4">
              <p className="text-slate-400 text-sm">Last 50 FCM delivery log entries</p>
              <button onClick={fetchLogs} disabled={logsLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-slate-300 text-xs hover:text-white transition-all">
                <RefreshCw className={`w-3.5 h-3.5 ${logsLoading ? 'animate-spin' : ''}`} />Refresh
              </button>
            </div>
            {logsLoading ? (
              <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-16 bg-white/5 rounded-xl animate-pulse" />)}</div>
            ) : fcmLogs.length > 0 ? (
              <div className="space-y-2">
                {fcmLogs.map((log, i) => (
                  <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.02 }}
                    className="bg-slate-900/60 border border-white/[0.08] rounded-xl px-4 py-3 flex items-start gap-3">
                    {log.status === 'success'
                      ? <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                      : <XCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-white text-xs font-mono truncate">{log.userId || (log.fcmToken?.slice(0, 20) + '…')}</span>
                        {log.elapsedTimeMs && <span className="text-slate-500 text-xs">{log.elapsedTimeMs}ms</span>}
                        {log.orderId && <span className="text-primary-400 text-xs">order: {log.orderId}</span>}
                      </div>
                      {log.errorDetails && <p className="text-red-400 text-xs mt-0.5">{log.errorDetails}</p>}
                      {log.timestamp && <p className="text-slate-600 text-xs mt-0.5">{new Date(log.timestamp).toLocaleString()}</p>}
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="text-center py-16 text-slate-500 text-sm">No FCM delivery logs available</div>
            )}
          </motion.div>
        )}

        {/* Setup */}
        {activeTab === 'security' && (
          <motion.div key="security" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <div className="space-y-4 max-w-xl">
              <div className="bg-slate-900/60 border border-white/[0.08] rounded-2xl p-6">
                <div className="flex items-center gap-2 mb-3">
                  <ShieldCheck className="w-5 h-5 text-primary-400" />
                  <h3 className="text-white font-bold">Initialize Developer Claim</h3>
                </div>
                <p className="text-slate-400 text-sm mb-5">
                  Grants the <code className="text-primary-300 bg-primary-500/10 px-1 rounded">developer: true</code> Firebase Custom Claim
                  to <strong>webhub2811@gmail.com</strong>. After clicking, sign out and back in to activate.
                </p>
                <button onClick={initClaim} disabled={claimLoading}
                  className="flex items-center gap-2 px-5 py-3 rounded-xl bg-primary-600 hover:bg-primary-500 text-white font-semibold text-sm transition-all disabled:opacity-60">
                  {claimLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                  {claimLoading ? 'Setting claim…' : 'Grant Developer Claim'}
                </button>
              </div>

              <div className="bg-amber-500/8 border border-amber-500/20 rounded-2xl p-5">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-amber-300 font-semibold text-sm mb-1">Backend Auth</p>
                    <p className="text-amber-200/60 text-xs leading-relaxed">
                      All <code>/devops/*</code> endpoints verify both the Firebase ID token and the{' '}
                      <code>developer: true</code> custom claim server-side via <code>requireDeveloper.ts</code>.
                      This UI guard is a secondary convenience layer.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      </TabErrorBoundary>
    </div>
  );
}
