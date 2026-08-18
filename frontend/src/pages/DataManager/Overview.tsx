import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  RefreshCw, Database, Cloud, HardDrive, Layers, Mail, Bell,
  AlertTriangle, CheckCircle, XCircle, Clock, Zap, Server, FileText
} from 'lucide-react';
import { Doughnut } from 'react-chartjs-2';
import 'chart.js/auto';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const formatBytes = (bytes: number, decimals = 2): string => {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
};

// ─── Provider Config ──────────────────────────────────────────────────────────
const PROVIDERS = [
  { id: 'firestore',     label: 'Firestore',        icon: Database,  color: '#FF7A00', endpoint: 'firestore' },
  { id: 'supabase',      label: 'PostgreSQL',        icon: Database,  color: '#6B8E23', endpoint: 'supabase' },
  { id: 'cloudinary',    label: 'Cloudinary',        icon: Cloud,     color: '#FFC107', endpoint: 'cloudinary' },
  { id: 'google-drive',  label: 'Google Drive',      icon: HardDrive, color: '#4285F4', endpoint: 'google-drive' },
  { id: 'qdrant',        label: 'Pinecone (AI)',      icon: Layers,    color: '#E91E63', endpoint: 'qdrant' },
  { id: 'email',         label: 'Email Queue',        icon: Mail,      color: '#9C27B0', endpoint: 'email' },
  { id: 'notifications', label: 'Notifications',     icon: Bell,      color: '#00BCD4', endpoint: 'notifications' },
  { id: 'app-storage',   label: 'App Storage',       icon: Server,    color: '#FF5722', endpoint: 'app-storage' },
  { id: 'logs',          label: 'Logs',              icon: FileText,  color: '#607D8B', endpoint: 'logs' },
] as const;

type ProviderId = typeof PROVIDERS[number]['id'];

interface ProviderState {
  status: 'loading' | 'loaded' | 'error';
  data: any | null;
  error: string | null;
  httpStatus: number | null;
  latencyMs: number | null;
  lastUpdated: string | null;
}

// ─── Provider Card ────────────────────────────────────────────────────────────
const ProviderCard = React.memo(({ 
  provider, 
  state, 
  onRetry 
}: { 
  provider: typeof PROVIDERS[number], 
  state: ProviderState, 
  onRetry: () => void 
}) => {
  const Icon = provider.icon;
  const usedBytes = state.data?.totalUsedBytes || 0;
  const capacity = state.data?.capacityBytes || null;
  const pct = capacity && capacity > 0 ? Math.round((usedBytes / capacity) * 100) : null;
  const healthStatus = state.data?.status || 'Unknown';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
      className="relative overflow-hidden rounded-2xl border transition-all duration-300 group"
      style={{
        background: 'rgba(22,22,22,0.75)',
        backdropFilter: 'blur(20px)',
        borderColor: state.status === 'error' ? 'rgba(239,68,68,0.3)' : `${provider.color}30`,
        boxShadow: state.status === 'loaded' ? `0 0 0 0 ${provider.color}00` : undefined,
      }}
      whileHover={{ 
        y: -4, 
        boxShadow: `0 12px 40px ${provider.color}25, 0 0 0 1px ${provider.color}40`,
        borderColor: `${provider.color}60`
      }}
    >
      {/* Top color accent */}
      <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, ${provider.color}, transparent)` }} />

      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl" style={{ background: `${provider.color}20` }}>
              <Icon className="w-5 h-5" style={{ color: provider.color }} />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm">{provider.label}</h3>
              {state.latencyMs !== null && (
                <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                  <Zap className="w-3 h-3" /> {state.latencyMs}ms
                </p>
              )}
            </div>
          </div>
          {state.status === 'loading' && (
            <div className="w-5 h-5 border-2 rounded-full animate-spin border-t-transparent" style={{ borderColor: `${provider.color}60`, borderTopColor: 'transparent' }} />
          )}
          {state.status === 'loaded' && (
            <CheckCircle className="w-5 h-5" style={{ color: provider.color }} />
          )}
          {state.status === 'error' && (
            <XCircle className="w-5 h-5 text-red-400" />
          )}
        </div>

        {/* Content */}
        {state.status === 'loading' && (
          <div className="space-y-2 animate-pulse">
            <div className="h-8 bg-white/5 rounded-lg w-3/4" />
            <div className="h-3 bg-white/5 rounded w-1/2" />
          </div>
        )}

        {state.status === 'loaded' && (
          <div>
            <div className="text-3xl font-black mb-1" style={{ color: provider.color }}>
              {formatBytes(usedBytes)}
            </div>
            {capacity && (
              <p className="text-xs text-gray-400 mb-3">of {formatBytes(capacity)} capacity</p>
            )}
            {!capacity && (
              <p className="text-xs text-gray-500 mb-3">calculated from real data</p>
            )}

            {/* Progress Bar */}
            {pct !== null && (
              <div>
                <div className="flex justify-between text-xs text-gray-400 mb-1.5">
                  <span>Used</span>
                  <span style={{ color: pct > 80 ? '#ef4444' : provider.color }}>{pct}%</span>
                </div>
                <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: `linear-gradient(90deg, ${provider.color}, ${provider.color}aa)` }}
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(pct, 100)}%` }}
                    transition={{ duration: 0.8, delay: 0.2, ease: 'easeOut' }}
                  />
                </div>
              </div>
            )}

            {/* Status badge */}
            <div className="mt-3 flex items-center gap-1.5">
              <div
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: healthStatus === 'Healthy' ? '#22c55e' : '#f59e0b' }}
              />
              <span className="text-xs font-medium text-gray-400">{healthStatus}</span>
            </div>
          </div>
        )}

        {state.status === 'error' && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <p className="text-xs text-red-400 font-medium">Provider unavailable</p>
            </div>
            <p className="text-xs text-gray-500 mb-1 font-mono break-all line-clamp-2">{state.error}</p>
            {state.httpStatus && (
              <p className="text-xs text-gray-600 mb-3">HTTP {state.httpStatus}</p>
            )}
            <button
              onClick={onRetry}
              className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg transition-all"
              style={{ background: `${provider.color}20`, color: provider.color }}
            >
              <RefreshCw className="w-3 h-3" /> Retry
            </button>
          </div>
        )}

        {/* Last updated */}
        {state.lastUpdated && (
          <p className="text-xs text-gray-600 mt-3 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {new Date(state.lastUpdated).toLocaleTimeString()}
          </p>
        )}
      </div>
    </motion.div>
  );
});

// ─── Main Overview Component ──────────────────────────────────────────────────
export default function Overview() {
  const [providerStates, setProviderStates] = useState<Record<ProviderId, ProviderState>>(() => {
    const initial: any = {};
    for (const p of PROVIDERS) {
      initial[p.id] = { status: 'loading', data: null, error: null, httpStatus: null, latencyMs: null, lastUpdated: null };
    }
    return initial;
  });

  const fetchProvider = useCallback(async (provider: typeof PROVIDERS[number], force = false) => {
    setProviderStates(prev => ({
      ...prev,
      [provider.id]: { ...prev[provider.id as ProviderId], status: 'loading', error: null }
    }));

    const t0 = performance.now();
    try {
      const res = await fetch(`/api/data-manager/${provider.endpoint}${force ? '?force=true' : ''}`);
      const latencyMs = Math.round(performance.now() - t0);
      
      if (!res.ok) {
        const errText = await res.text().catch(() => 'Unknown error');
        setProviderStates(prev => ({
          ...prev,
          [provider.id]: {
            status: 'error',
            data: null,
            error: errText.slice(0, 200),
            httpStatus: res.status,
            latencyMs,
            lastUpdated: new Date().toISOString(),
          }
        }));
        return;
      }

      const json = await res.json();

      // Treat error status from backend gracefully  
      if (json.status === 'Error' || json.status === 'Offline') {
        setProviderStates(prev => ({
          ...prev,
          [provider.id]: {
            status: 'error',
            data: json,
            error: json.error || `${provider.label} is ${json.status}`,
            httpStatus: res.status,
            latencyMs,
            lastUpdated: new Date().toISOString(),
          }
        }));
        return;
      }

      setProviderStates(prev => ({
        ...prev,
        [provider.id]: {
          status: 'loaded',
          data: json,
          error: null,
          httpStatus: res.status,
          latencyMs,
          lastUpdated: new Date().toISOString(),
        }
      }));
    } catch (err: any) {
      const latencyMs = Math.round(performance.now() - t0);
      setProviderStates(prev => ({
        ...prev,
        [provider.id]: {
          status: 'error',
          data: null,
          error: err.message,
          httpStatus: null,
          latencyMs,
          lastUpdated: new Date().toISOString(),
        }
      }));
    }
  }, []);

  // Load all providers in parallel on mount — each resolves independently
  useEffect(() => {
    PROVIDERS.forEach(p => fetchProvider(p));
  }, [fetchProvider]);

  const refreshAll = useCallback(() => {
    PROVIDERS.forEach(p => fetchProvider(p, true));
  }, [fetchProvider]);

  // Chart data — only include loaded providers
  const loadedProviders = PROVIDERS.filter(p => providerStates[p.id].status === 'loaded');
  const totalBytes = loadedProviders.reduce((sum, p) => sum + (providerStates[p.id].data?.totalUsedBytes || 0), 0);

  const chartData = {
    labels: loadedProviders.map(p => p.label),
    datasets: [{
      data: loadedProviders.map(p => providerStates[p.id].data?.totalUsedBytes || 0),
      backgroundColor: loadedProviders.map(p => p.color),
      borderWidth: 0,
      hoverOffset: 12,
    }],
  };

  const chartOptions = {
    cutout: '78%',
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: any) => ` ${ctx.label}: ${formatBytes(ctx.raw)}`
        }
      }
    },
    animation: { animateRotate: true, duration: 800 }
  };

  const loadedCount = PROVIDERS.filter(p => providerStates[p.id].status === 'loaded').length;
  const errorCount = PROVIDERS.filter(p => providerStates[p.id].status === 'error').length;
  const loadingCount = PROVIDERS.filter(p => providerStates[p.id].status === 'loading').length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.3 }}
    >
      {/* ─── Summary Header ─────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-black text-white tracking-tight">Storage Overview</h2>
          <p className="text-gray-400 mt-1 text-sm">
            {loadingCount > 0 && <span className="text-yellow-400">Loading {loadingCount} provider{loadingCount > 1 ? 's' : ''}… </span>}
            {loadedCount > 0 && <span className="text-green-400">{loadedCount} online. </span>}
            {errorCount > 0 && <span className="text-red-400">{errorCount} failed. </span>}
            {totalBytes > 0 && <span className="text-white font-medium">{formatBytes(totalBytes)} total used.</span>}
          </p>
        </div>
        <button
          onClick={refreshAll}
          className="flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all hover:scale-105 active:scale-95"
          style={{ background: 'rgba(107,142,35,0.15)', border: '1px solid rgba(107,142,35,0.4)', color: '#6B8E23' }}
        >
          <RefreshCw className={`w-4 h-4 ${loadingCount > 0 ? 'animate-spin' : ''}`} />
          Refresh All
        </button>
      </div>

      {/* ─── Doughnut Chart + Legend ─────────────────────────────────────────── */}
      {loadedCount > 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="mb-10 p-6 rounded-2xl border"
          style={{ background: 'rgba(22,22,22,0.6)', backdropFilter: 'blur(20px)', borderColor: 'rgba(255,255,255,0.08)' }}
        >
          <div className="flex flex-col lg:flex-row items-center gap-8">
            <div className="relative w-52 h-52 flex-shrink-0">
              <Doughnut data={chartData} options={chartOptions} />
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <p className="text-2xl font-black text-white">{formatBytes(totalBytes)}</p>
                <p className="text-xs text-gray-500 mt-0.5">total used</p>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 flex-1 w-full">
              {loadedProviders.map(p => {
                const bytes = providerStates[p.id].data?.totalUsedBytes || 0;
                const pct = totalBytes > 0 ? ((bytes / totalBytes) * 100).toFixed(1) : '0.0';
                return (
                  <div key={p.id} className="flex items-center gap-2.5">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: p.color }} />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-gray-300 truncate">{p.label}</p>
                      <p className="text-xs text-gray-500">{formatBytes(bytes)} · {pct}%</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </motion.div>
      )}

      {/* ─── Provider Cards Grid ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <AnimatePresence>
          {PROVIDERS.map(provider => (
            <ProviderCard
              key={provider.id}
              provider={provider}
              state={providerStates[provider.id]}
              onRetry={() => fetchProvider(provider, true)}
            />
          ))}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
