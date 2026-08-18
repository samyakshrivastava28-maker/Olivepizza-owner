import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Bot, Database, RefreshCw, CheckCircle, AlertTriangle, WifiOff, Loader2, Clock, Package, Tag, HelpCircle, FileText, Zap, Activity } from 'lucide-react';
import { auth } from '../lib/firebase';
import toast from 'react-hot-toast';

interface KBStats {
  version: number;
  lastSyncTime: number;
  lastProductUpdate: number;
  lastSettingsUpdate: number;
  lastPolicyUpdate: number;
  productCount: number;
  categoryCount: number;
  couponCount: number;
  faqCount: number;
  indexSizeBytes: number;
  totalQueries: number;
  localHits: number;
  failedQueries: number;
  recoveryCount: number;
}

interface KBStatus {
  isReady: boolean;
  stats: KBStats;
  categories: string[];
  activeCoupons: number;
  providers?: {
    nvidia: { ok: boolean; attempts: number; successes: number; lastError?: string };
    openrouter: { ok: boolean; attempts: number; successes: number; lastError?: string };
    gemini: { ok: boolean; attempts: number; successes: number; lastError?: string };
    activeProvider?: string;
    totalRequests: number;
    totalFailovers: number;
    avgResponseMs: number;
  };
}

function MetricCard({ icon: Icon, label, value, sub, color = 'text-primary-400' }: {
  icon: any; label: string; value: string | number; sub?: string; color?: string;
}) {
  return (
    <div className="bg-dark-800/50 border border-white/5 rounded-2xl p-4">
      <div className="flex items-center gap-2 text-slate-400 text-xs mb-2">
        <Icon className={`w-4 h-4 ${color}`} />
        <span>{label}</span>
      </div>
      <p className={`text-2xl font-black ${color}`}>{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
    </div>
  );
}

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold ${ok ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
      {ok ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
      {label}
    </div>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function formatRelativeTime(timestamp: number) {
  if (!timestamp) return 'Never';
  const diff = Date.now() - timestamp;
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return new Date(timestamp).toLocaleDateString();
}

export default function AIHealthMonitor() {
  const [status, setStatus] = useState<KBStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [rebuilding, setRebuilding] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/ai/kb-status');
      const data = await res.json();
      if (data.success) {
        setStatus(data);
        setLastChecked(new Date());
      }
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const handleRebuild = async () => {
    setRebuilding(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/ai/kb-rebuild', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Knowledge Base rebuilt successfully! ✅');
        await fetchStatus();
      } else {
        toast.error('Rebuild failed: ' + data.error);
      }
    } catch {
      toast.error('Failed to trigger rebuild. Check backend connection.');
    } finally {
      setRebuilding(false);
    }
  };

  const hitRate = status?.stats ? Math.round((status.stats.localHits / Math.max(status.stats.totalQueries, 1)) * 100) : 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary-500/20 rounded-xl flex items-center justify-center">
            <Bot className="w-5 h-5 text-primary-400" />
          </div>
          <div>
            <h2 className="text-xl font-black text-white">AI Knowledge Monitor</h2>
            <p className="text-xs text-slate-400">
              {lastChecked ? `Last checked: ${lastChecked.toLocaleTimeString()}` : 'Loading...'}
            </p>
          </div>
        </div>
        <div className="flex gap-3 items-center">
          <button
            onClick={fetchStatus}
            className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 px-3 py-2 rounded-xl text-sm font-bold transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button
            onClick={handleRebuild}
            disabled={rebuilding}
            className="flex items-center gap-2 bg-primary-500 hover:bg-primary-600 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-sm font-bold transition-colors shadow-lg shadow-primary-500/20"
          >
            {rebuilding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            {rebuilding ? 'Rebuilding...' : 'Rebuild Index'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48 text-primary-400">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      ) : !status ? (
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-8 text-center">
          <WifiOff className="w-12 h-12 text-red-400 mx-auto mb-3" />
          <p className="text-red-300 font-bold">Knowledge Base Unavailable</p>
          <p className="text-slate-400 text-sm mt-1">Backend may be offline or KB failed to initialize.</p>
          <button onClick={handleRebuild} disabled={rebuilding} className="mt-4 bg-red-500 text-white px-4 py-2 rounded-xl font-bold text-sm hover:bg-red-600 transition-colors">
            Force Restart
          </button>
        </div>
      ) : (
        <>
          {/* Status Pills */}
          <div className="flex flex-wrap gap-3">
            <StatusPill ok={status.isReady} label={status.isReady ? 'KB Initialized' : 'KB Not Ready'} />
            <StatusPill ok={status.stats.productCount > 0} label={`${status.stats.productCount} Products`} />
            <StatusPill ok={hitRate > 50} label={`${hitRate}% Local Hit Rate`} />
            <StatusPill ok={status.stats.recoveryCount === 0} label={status.stats.recoveryCount === 0 ? 'No Crashes' : `${status.stats.recoveryCount} Recoveries`} />
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            <MetricCard icon={Package} label="Products Indexed" value={status.stats.productCount} color="text-primary-400" />
            <MetricCard icon={Database} label="Categories" value={status.stats.categoryCount} color="text-blue-400" />
            <MetricCard icon={Tag} label="Active Coupons" value={status.activeCoupons} color="text-green-400" />
            <MetricCard icon={HelpCircle} label="FAQs Indexed" value={status.stats.faqCount} color="text-purple-400" />
            <MetricCard icon={Activity} label="Total Queries" value={status.stats.totalQueries} color="text-amber-400" />
            <MetricCard icon={Zap} label="Local Responses" value={status.stats.localHits} sub="No AI call needed" color="text-emerald-400" />
            <MetricCard icon={AlertTriangle} label="Failed Queries" value={status.stats.failedQueries} color={status.stats.failedQueries > 0 ? 'text-red-400' : 'text-slate-400'} />
            <MetricCard icon={Database} label="Index Size" value={formatBytes(status.stats.indexSizeBytes)} color="text-slate-300" />
          </div>

          {/* AI Provider Status */}
          {status.providers && (() => {
            const providers = status.providers;
            return (
            <div className="bg-dark-800/30 border border-white/5 rounded-2xl p-5">
              <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                <Bot className="w-4 h-4 text-primary-400" /> AI Provider Status
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                {[
                  { name: 'NVIDIA', key: 'nvidia' as const, color: 'text-green-400', bg: 'bg-green-400/10', border: 'border-green-400/20' },
                  { name: 'OpenRouter', key: 'openrouter' as const, color: 'text-blue-400', bg: 'bg-blue-400/10', border: 'border-blue-400/20' },
                  { name: 'Gemini 2.5 Flash', key: 'gemini' as const, color: 'text-amber-400', bg: 'bg-amber-400/10', border: 'border-amber-400/20' },
                ].map(p => {
                  const data = providers[p.key] || { ok: false, attempts: 0, successes: 0, lastError: undefined };
                  const isActive = providers.activeProvider?.includes(p.name) || providers.activeProvider?.includes(p.key);
                  const successRate = data.attempts > 0 ? Math.round((data.successes / data.attempts) * 100) : null;
                  return (
                    <div key={p.key} className={`p-4 rounded-xl border ${isActive ? `${p.bg} ${p.border}` : 'bg-dark-900/50 border-white/5'}`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className={`font-bold text-sm ${isActive ? p.color : 'text-slate-400'}`}>{p.name}</span>
                        <div className={`flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${data.ok ? 'bg-green-500/15 text-green-400' : data.attempts > 0 ? 'bg-red-500/15 text-red-400' : 'bg-slate-500/15 text-slate-500'}`}>
                          {data.ok ? <CheckCircle className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                          {data.ok ? 'OK' : data.attempts > 0 ? 'Failing' : 'Idle'}
                        </div>
                      </div>
                      <div className="text-xs text-slate-500 space-y-0.5">
                        <div>Attempts: <span className="text-slate-300">{data.attempts || 0}</span></div>
                        {successRate !== null && <div>Success: <span className={`font-bold ${successRate > 70 ? 'text-green-400' : 'text-amber-400'}`}>{successRate}%</span></div>}
                        {data.lastError && <div className="text-red-400 text-[10px] truncate" title={data.lastError}>↳ {data.lastError.slice(0, 40)}</div>}
                        {isActive && <div className={`font-bold ${p.color}`}>← Active</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-dark-900/50 p-3 rounded-xl text-center">
                  <p className="text-lg font-black text-white">{providers.totalRequests || 0}</p>
                  <p className="text-[11px] text-slate-400">Total Requests</p>
                </div>
                <div className="bg-dark-900/50 p-3 rounded-xl text-center">
                  <p className="text-lg font-black text-amber-400">{providers.totalFailovers || 0}</p>
                  <p className="text-[11px] text-slate-400">Auto Failovers</p>
                </div>
                <div className="bg-dark-900/50 p-3 rounded-xl text-center">
                  <p className="text-lg font-black text-blue-400">{providers.avgResponseMs || 0}ms</p>
                  <p className="text-[11px] text-slate-400">Avg Response</p>
                </div>
              </div>
            </div>
            );
          })()}

          {/* Sync Times */}
          <div className="bg-dark-800/30 border border-white/5 rounded-2xl p-5">
            <h3 className="font-bold text-white mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary-400" /> Synchronization Status
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { label: 'Last Full Sync', time: status.stats.lastSyncTime, ok: Date.now() - status.stats.lastSyncTime < 300000 },
                { label: 'Last Product Update', time: status.stats.lastProductUpdate, ok: true },
                { label: 'Last Settings Update', time: status.stats.lastSettingsUpdate, ok: true },
                { label: 'KB Version', time: 0, ok: true, display: `v${status.stats.version}` },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between bg-dark-900/50 p-3 rounded-xl">
                  <span className="text-sm text-slate-400">{item.label}</span>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-bold ${item.ok ? 'text-green-400' : 'text-amber-400'}`}>
                      {item.display || formatRelativeTime(item.time)}
                    </span>
                    {item.ok ? <CheckCircle className="w-3.5 h-3.5 text-green-400" /> : <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Categories */}
          {status.categories.length > 0 && (
            <div className="bg-dark-800/30 border border-white/5 rounded-2xl p-5">
              <h3 className="font-bold text-white mb-3 flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary-400" /> Indexed Categories
              </h3>
              <div className="flex flex-wrap gap-2">
                {status.categories.map(cat => (
                  <span key={cat} className="bg-primary-500/10 text-primary-300 border border-primary-500/20 px-3 py-1 rounded-full text-xs font-bold capitalize">
                    {cat}
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
