import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Server, Database, Cloud, Mail, Bell, Cpu, HardDrive, Wifi, 
  WifiOff, AlertTriangle, CheckCircle, XCircle, RefreshCw, 
  Activity, Shield, Zap, Monitor, Clock, Settings
} from 'lucide-react';

type ServiceStatus = 'operational' | 'degraded' | 'down' | 'checking' | 'unknown';

interface ServiceRow {
  name: string;
  icon: any;
  status: ServiceStatus;
  detail: string;
  latency?: number;
}

const StatusDot = ({ status }: { status: ServiceStatus }) => {
  const colors: Record<ServiceStatus, string> = {
    operational: 'bg-emerald-400',
    degraded: 'bg-amber-400',
    down: 'bg-red-500',
    checking: 'bg-blue-400',
    unknown: 'bg-slate-500',
  };
  const pulse = status === 'operational' ? 'animate-pulse' : status === 'checking' ? 'animate-spin' : '';
  return (
    <span className={`inline-block w-2.5 h-2.5 rounded-full ${colors[status]} ${status === 'operational' ? 'shadow-[0_0_6px_rgba(52,211,153,0.8)]' : ''}`} />
  );
};

const StatusBadge = ({ status }: { status: ServiceStatus }) => {
  const config: Record<ServiceStatus, { label: string; cls: string }> = {
    operational: { label: 'Healthy', cls: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' },
    degraded: { label: 'Degraded', cls: 'text-amber-400 bg-amber-400/10 border-amber-400/20' },
    down: { label: 'Down', cls: 'text-red-400 bg-red-500/10 border-red-500/20' },
    checking: { label: 'Checking...', cls: 'text-blue-400 bg-blue-400/10 border-blue-400/20' },
    unknown: { label: 'Unknown', cls: 'text-slate-400 bg-slate-800 border-slate-700' },
  };
  const { label, cls } = config[status] || config.unknown;
  return <span className={`text-[11px] font-bold uppercase tracking-wide px-2.5 py-0.5 rounded-full border ${cls}`}>{label}</span>;
};

import { fetchApi } from '../../lib/config';

const DIAGNOSTICS_URL = '/api/health/diagnostics';
const STATUS_URL = '/api/health/status';

export default function SystemDiagnostics() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const pollerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMounted = useRef(true);

  const fetchDiagnostics = async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true);
    try {
      // First check backend is up (with cold-start tolerance and direct Render fallback)
      const ping = await fetchApi(STATUS_URL, { signal: AbortSignal.timeout(20000) });
      if (!ping.ok) { if (isMounted.current) { setBackendOnline(false); setLoading(false); setRefreshing(false); } return; }
      setBackendOnline(true);

      const res = await fetchApi(DIAGNOSTICS_URL, { signal: AbortSignal.timeout(15000) });
      if (res.ok) {
        const json = await res.json();
        if (json.success && isMounted.current) {
          setData(json);
          setLastFetch(new Date());
          setLoading(false);
        }
      }
    } catch (e) {
      if (isMounted.current) { setBackendOnline(false); setLoading(false); }
    } finally {
      if (isMounted.current) setRefreshing(false);
    }
  };

  useEffect(() => {
    isMounted.current = true;
    fetchDiagnostics();
    pollerRef.current = setInterval(() => fetchDiagnostics(), 10000);
    return () => {
      isMounted.current = false;
      if (pollerRef.current) clearInterval(pollerRef.current);
    };
  }, []);

  const formatUptime = (s: number) => {
    if (!s) return 'N/A';
    const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
    return `${d}d ${h}h ${m}m`;
  };

  const formatMB = (bytes: number) => `${Math.round(bytes / 1024 / 1024)} MB`;

  const getServiceRows = (): ServiceRow[] => {
    if (!data) return [];
    const { services, aiProviders, environment } = data;
    const rows: ServiceRow[] = [];

    rows.push({ name: 'Backend API', icon: Server, status: services.backend?.status || 'operational', detail: `v${services.backend?.version || '1.0.0'}` });
    rows.push({ name: 'Database (Postgres)', icon: Database, status: services.database?.status || 'unknown', detail: `${services.database?.activeConnections || 0} connections`, latency: services.database?.latency });
    rows.push({ name: 'Firebase Admin', icon: Shield, status: services.firebase?.status || 'unknown', detail: services.firebase?.projectId || 'olive-pizza-08', latency: services.firebase?.latency });
    rows.push({ name: 'Cloudinary CDN', icon: Cloud, status: services.cloudinary?.status || 'unknown', detail: services.cloudinary?.cloudName || 'Not configured', latency: services.cloudinary?.latency });
    rows.push({ name: 'Email (SMTP)', icon: Mail, status: services.email?.status || 'unknown', detail: `Queue: ${services.email?.queueSize || 0} pending` });
    rows.push({ name: 'Notifications (FCM)', icon: Bell, status: services.notifications?.status || 'unknown', detail: `${services.notifications?.activeTokens || 0} tokens, ${services.notifications?.queued || 0} queued` });
    
    if (aiProviders?.length) {
      aiProviders.forEach((ai: any) => {
        rows.push({ name: `AI: ${ai.name}`, icon: Zap, status: ai.status as ServiceStatus, detail: '', latency: ai.latency });
      });
    }

    return rows;
  };

  const getOverallStatus = () => {
    if (!data) return 'checking';
    const rows = getServiceRows();
    if (rows.some(r => r.status === 'down')) return 'critical';
    if (rows.some(r => r.status === 'degraded' || r.status === 'checking')) return 'warning';
    return 'healthy';
  };

  const overallStatus = getOverallStatus();

  if (!backendOnline && !loading) {
    return (
      <div className="bg-red-950/30 border border-red-500/30 rounded-2xl p-6 flex flex-col items-center gap-4 text-center">
        <WifiOff className="w-10 h-10 text-red-400" />
        <div>
          <h3 className="text-lg font-bold text-red-300 mb-1">Backend Unreachable</h3>
          <p className="text-sm text-red-400/70">The backend server is not responding at {STATUS_URL}.<br/>Make sure <code className="bg-red-900/50 px-1 rounded">npm run dev</code> is running.</p>
        </div>
        <button onClick={() => { setLoading(true); setBackendOnline(null); fetchDiagnostics(); }} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-300 text-sm font-medium transition-colors">
          <RefreshCw className="w-4 h-4" /> Retry
        </button>
      </div>
    );
  }

  return (
    <div className="bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-800/80 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-800/60 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${overallStatus === 'healthy' ? 'bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]' : overallStatus === 'warning' ? 'bg-amber-400 animate-pulse' : overallStatus === 'critical' ? 'bg-red-500 animate-pulse' : 'bg-slate-500'}`} />
          <h2 className="text-base font-bold text-white">System Diagnostics</h2>
          <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${overallStatus === 'healthy' ? 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' : overallStatus === 'warning' ? 'text-amber-400 bg-amber-400/10 border-amber-400/20' : overallStatus === 'critical' ? 'text-red-400 bg-red-500/10 border-red-500/20' : 'text-slate-400 bg-slate-800 border-slate-700'}`}>
            {overallStatus === 'healthy' ? 'All Systems Operational' : overallStatus === 'warning' ? 'Partial Degradation' : overallStatus === 'critical' ? 'Critical Issues' : 'Initializing...'}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {lastFetch && <span className="text-xs text-slate-500">Updated {lastFetch.toLocaleTimeString()}</span>}
          <button onClick={() => fetchDiagnostics(true)} disabled={refreshing} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="p-6 space-y-3">
          {[...Array(6)].map((_, i) => <div key={i} className="h-12 bg-slate-800/50 rounded-xl animate-pulse" />)}
        </div>
      ) : (
        <div className="divide-y divide-slate-800/40">
          {/* Services */}
          <div className="p-6">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Activity className="w-3.5 h-3.5" /> Services
            </h3>
            <div className="space-y-2">
              {getServiceRows().map((row, i) => (
                <motion.div
                  key={row.name}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className={`flex items-center justify-between p-3 rounded-xl border transition-all ${row.status === 'operational' ? 'bg-emerald-950/20 border-emerald-900/30' : row.status === 'down' ? 'bg-red-950/20 border-red-900/30' : row.status === 'degraded' ? 'bg-amber-950/20 border-amber-900/30' : 'bg-slate-800/30 border-slate-700/30'}`}
                >
                  <div className="flex items-center gap-3">
                    <StatusDot status={row.status} />
                    <row.icon className={`w-4 h-4 ${row.status === 'operational' ? 'text-emerald-400' : row.status === 'down' ? 'text-red-400' : row.status === 'degraded' ? 'text-amber-400' : 'text-slate-400'}`} />
                    <div>
                      <p className="text-sm font-medium text-white">{row.name}</p>
                      {row.detail && <p className="text-xs text-slate-500">{row.detail}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {row.latency !== undefined && <span className="text-xs text-slate-500 font-mono">{row.latency}ms</span>}
                    <StatusBadge status={row.status} />
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* System Resources */}
          {data?.system && (
            <div className="p-6">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Monitor className="w-3.5 h-3.5" /> System Resources
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-slate-800/40 rounded-xl p-3 border border-slate-700/30">
                  <div className="flex items-center gap-1.5 text-slate-400 text-xs mb-1.5"><Clock className="w-3.5 h-3.5" />Uptime</div>
                  <div className="text-white font-bold text-lg">{formatUptime(data.system.uptime)}</div>
                </div>
                <div className="bg-slate-800/40 rounded-xl p-3 border border-slate-700/30">
                  <div className="flex items-center gap-1.5 text-slate-400 text-xs mb-1.5"><HardDrive className="w-3.5 h-3.5" />Heap Used</div>
                  <div className="text-white font-bold text-lg">{formatMB(data.system.memory.heapUsed)}</div>
                </div>
                <div className="bg-slate-800/40 rounded-xl p-3 border border-slate-700/30">
                  <div className="flex items-center gap-1.5 text-slate-400 text-xs mb-1.5"><Cpu className="w-3.5 h-3.5" />CPU Load</div>
                  <div className="text-white font-bold text-lg">{data.system.cpuLoad?.[0]?.toFixed(2) ?? 'N/A'}</div>
                </div>
                <div className="bg-slate-800/40 rounded-xl p-3 border border-slate-700/30">
                  <div className="flex items-center gap-1.5 text-slate-400 text-xs mb-1.5"><Server className="w-3.5 h-3.5" />Node</div>
                  <div className="text-white font-bold text-sm pt-0.5">{data.system.nodeVersion || 'N/A'}</div>
                </div>
              </div>
            </div>
          )}

          {/* Environment Variables */}
          {data?.environment && (
            <div className="p-6">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Settings className="w-3.5 h-3.5" /> Environment Variables
                {data.environment.allConfigured ? (
                  <span className="text-emerald-400 text-xs font-bold flex items-center gap-1"><CheckCircle className="w-3 h-3" /> All Configured</span>
                ) : (
                  <span className="text-amber-400 text-xs font-bold flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> {data.environment.missing?.length} Missing</span>
                )}
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {Object.entries(data.environment.vars || {}).map(([key, val]) => (
                  <div key={key} className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs font-medium ${val === 'configured' ? 'bg-emerald-950/20 border-emerald-900/30 text-emerald-400' : 'bg-red-950/20 border-red-900/30 text-red-400'}`}>
                    {val === 'configured' ? <CheckCircle className="w-3 h-3 shrink-0" /> : <XCircle className="w-3 h-3 shrink-0" />}
                    <span className="truncate">{key}</span>
                  </div>
                ))}
              </div>
              {data.environment.missing?.length > 0 && (
                <div className="mt-3 p-3 rounded-xl bg-amber-950/20 border border-amber-900/30">
                  <p className="text-amber-400 text-xs font-medium">
                    ⚠️ Missing: <code className="font-mono">{data.environment.missing.join(', ')}</code>
                  </p>
                  <p className="text-amber-500/60 text-xs mt-1">Add these to <code className="font-mono">backend/.env</code> or your deployment environment.</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
