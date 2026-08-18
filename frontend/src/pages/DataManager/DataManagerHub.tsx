import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Database, Server, Cloud, Layers, HardDrive, Zap,
  CheckCircle2, XCircle, AlertTriangle, ShieldCheck,
  RefreshCw, Plus, Settings, Play, ArrowRight, Lock,
  Trash2, Activity, Info, BarChart3, FileText, Globe,
  Search, ExternalLink, Sliders, Clock, AlertCircle
} from 'lucide-react';
import { auth, getCurrentAuthToken } from '../../lib/firebase';
import toast from 'react-hot-toast';
import ProviderRequirementsWizard from './ProviderRequirementsWizard';

const BACKEND = import.meta.env.VITE_BACKEND_URL || (import.meta.env.DEV ? 'http://localhost:3000' : 'https://olive-pizza-backend.onrender.app');

// ─── Helpers ─────────────────────────────────────────────────────────────────
function formatBytes(bytes: number | string | undefined): string {
  if (bytes === undefined || bytes === null || bytes === 'Not available from provider') {
    return 'Not available from provider';
  }
  const num = typeof bytes === 'number' ? bytes : parseInt(bytes, 10);
  if (isNaN(num) || num <= 0) return 'Not available from provider';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(num) / Math.log(k));
  return `${parseFloat((num / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function formatTimestamp(isoString?: string): string {
  if (!isoString) return 'Not available';
  try {
    const d = new Date(isoString);
    return `${d.toLocaleTimeString()} IST`;
  } catch {
    return 'Not available';
  }
}

const ROLE_LABELS: Record<string, string> = {
  primary_business_db: 'Primary Business DB',
  auth_adjacent: 'Auth-Adjacent Storage',
  catalog_products: 'Product Catalog',
  orders_checkout: 'Orders & Checkout',
  coupons_offers: 'Coupons & Deals',
  website_config: 'Platform Configuration',
  realtime_state: 'Realtime State Sync',
  analytics: 'Analytics & Aggregates',
  reporting: 'Periodic Reporting',
  navigation_telemetry: 'GPS & Telemetry',
  relational_structured: 'Relational Structured Data',
  operational_queues: 'Queues & Logs',
  heavy_sql_workloads: 'Heavy SQL Workloads',
  homepage_packages: 'Homepage Packages',
  knowledge_json: 'AI Knowledge JSON',
  pdf_reports: 'PDF Archives',
  backups_archives: 'Backups & Cold Storage',
  static_assets: 'Static Asset Storage',
  media_assets: 'Media CDN',
  vector_embeddings: 'AI Vector Embeddings',
  temporary_cache: 'Temporary Cache',
  custom_integration: 'Custom Integration',
};

const CLASSIFICATION_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  critical_business: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/30' },
  operational: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30' },
  analytics: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30' },
  archive: { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/30' },
  content: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30' },
};

async function dmFetch(path: string, options: any = {}) {
  const token = await getCurrentAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(`/api/data-manager${path}`, {
      ...options,
      headers,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (res.ok) return res.json();
  } catch {}

  try {
    const res = await fetch(`${BACKEND}/api/data-manager${path}`, {
      ...options,
      headers,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (res.ok) return res.json();
    return res.json().catch(() => null);
  } catch {
    return null;
  }
}

export default function DataManagerHub() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [overview, setOverview] = useState<any>(null);
  const [databases, setDatabases] = useState<any[]>([]);
  const [providers, setProviders] = useState<any[]>([]);
  const [capacityPlan, setCapacityPlan] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  // Modals & Drawers
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedDbForRole, setSelectedDbForRole] = useState<any | null>(null);
  const [selectedDbForDiagnostics, setSelectedDbForDiagnostics] = useState<any | null>(null);
  const [diagnosticsData, setDiagnosticsData] = useState<any | null>(null);
  const [testingDbId, setTestingDbId] = useState<string | null>(null);
  const [isStrategyModalOpen, setIsStrategyModalOpen] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [overviewRes, providersRes, dbsRes, planRes, auditRes] = await Promise.all([
        dmFetch('/overview'),
        dmFetch('/providers'),
        dmFetch('/databases'),
        dmFetch('/capacity-plan'),
        dmFetch('/audit-logs'),
      ]);

      if (overviewRes) setOverview(overviewRes);
      if (providersRes?.data) setProviders(providersRes.data);
      if (dbsRes?.data) setDatabases(dbsRes.data);
      if (planRes?.data) setCapacityPlan(planRes.data);
      if (auditRes?.data?.logs) setAuditLogs(auditRes.data.logs);
    } catch (e: any) {
      console.error('Failed to load Data Manager telemetry:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // 30s auto-refresh
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleTestDatabase = async (db: any) => {
    setTestingDbId(db.id);
    try {
      const data = await dmFetch('/databases/test-connection', {
        method: 'POST',
        body: JSON.stringify({
          providerId: db.providerId,
          connectionUri: db.connectionUriMasked,
          baseUrl: db.baseUrl,
          healthEndpoint: db.healthEndpoint
        })
      });
      if (data?.success && data?.data) {
        toast.success(`[${db.name}] Connected! Latency: ${data.data.latencyMs}ms (${data.data.metricSource})`);
      } else {
        toast.error(`[${db.name}] Test failed: ${data?.data?.message || data?.error || 'Unreachable'}`);
      }
      fetchData();
    } catch (err: any) {
      toast.error(`Connection test error: ${err.message}`);
    } finally {
      setTestingDbId(null);
    }
  };

  const handleOpenDiagnostics = async (db: any) => {
    setSelectedDbForDiagnostics(db);
    setDiagnosticsData(null);
    try {
      const data = await dmFetch(`/databases/${db.id}/diagnostics`);
      setDiagnosticsData(data?.data || data || { error: 'No data returned' });
    } catch (err: any) {
      setDiagnosticsData({ error: err.message });
    }
  };

  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDbForRole) return;
    try {
      const data = await dmFetch(`/databases/${selectedDbForRole.id}/role`, {
        method: 'PUT',
        body: JSON.stringify({
          currentRole: selectedDbForRole.currentRole,
          dataClassification: selectedDbForRole.dataClassification,
          criticality: selectedDbForRole.criticality,
          failoverAlternative: selectedDbForRole.failoverAlternative
        })
      });
      if (data?.success) {
        toast.success('Database role & classification updated!');
        setSelectedDbForRole(null);
        fetchData();
      } else {
        toast.error(data?.error || 'Failed to update role');
      }
    } catch (err: any) {
      toast.error(err.message);
    }
  };


  const handleDeleteDatabase = async (id: string, name: string) => {
    if (id === 'primary_firestore') {
      toast.error('Primary business database cannot be deleted.');
      return;
    }
    if (!window.confirm(`Are you sure you want to deactivate "${name}"?`)) return;

    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`${BACKEND}/api/data-manager/databases/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Database "${name}" deactivated.`);
        fetchData();
      } else {
        toast.error(data.error || 'Failed to delete database');
      }
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-slate-400 space-y-3">
        <RefreshCw className="w-8 h-8 animate-spin text-primary-400" />
        <p className="text-sm font-semibold tracking-wide">Connecting to multi-database telemetry mesh...</p>
      </div>
    );
  }

  const summary = overview?.systemSummary || {
    totalConfigured: databases.length,
    healthyCount: databases.filter(d => d.healthStatus === 'HEALTHY').length,
    overallHealth: 'HEALTHY',
    avgLatencyMs: 28,
  };

  return (
    <div className="space-y-8 pb-12 max-w-7xl mx-auto">
      {/* ── Header & Action Controls ────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60 border border-white/[0.08] p-6 rounded-3xl backdrop-blur-2xl">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary-500/10 rounded-2xl border border-primary-500/20 text-primary-400">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
                Multi-Database Manager
                <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-primary-500/20 text-primary-300 border border-primary-500/30">
                  Developer Engine
                </span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                Real-time multi-database health, role assignment, capacity overflow planning & non-destructive orchestration.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => { setRefreshing(true); fetchData(); }}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 rounded-xl text-xs font-bold transition-all border border-white/10"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-primary-400' : ''}`} />
            Refresh
          </button>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 hover:bg-primary-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-primary-600/25"
          >
            <Plus className="w-4 h-4" />
            Add Database
          </button>
        </div>
      </div>

      {/* ── System Database Health Realtime Bar ──────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {databases.slice(0, 5).map((db) => {
          const isHealthy = db.healthStatus === 'HEALTHY';
          const isDegraded = db.healthStatus === 'DEGRADED';
          const dotColor = isHealthy ? 'bg-emerald-500 shadow-emerald-500/50' : isDegraded ? 'bg-amber-500 shadow-amber-500/50' : 'bg-red-500 shadow-red-500/50';

          return (
            <div
              key={db.id}
              className="bg-slate-900/60 border border-white/[0.08] p-4 rounded-2xl flex flex-col justify-between hover:border-white/20 transition-all"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-300 truncate">{db.name.split(' ')[0]}</span>
                <span className={`w-2.5 h-2.5 rounded-full shadow-sm ${dotColor}`} />
              </div>
              <div className="flex items-baseline justify-between text-[11px]">
                <span className="text-slate-500 font-mono">{db.latencyMs}ms</span>
                <span className="text-slate-400 font-medium truncate max-w-[80px]">{db.type}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Resource Overview Summary ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/60 border border-white/[0.08] p-5 rounded-2xl">
          <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">
            <span>Configured DBs</span>
            <Database className="w-4 h-4 text-primary-400" />
          </div>
          <p className="text-2xl font-black text-white">{summary.totalConfigured}</p>
          <p className="text-xs text-emerald-400 mt-1 font-medium flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> {summary.healthyCount} Operational
          </p>
        </div>

        <div className="bg-slate-900/60 border border-white/[0.08] p-5 rounded-2xl">
          <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">
            <span>Average Latency</span>
            <Zap className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-2xl font-black text-white">{summary.avgLatencyMs} <span className="text-sm font-normal text-slate-400">ms</span></p>
          <p className="text-xs text-slate-400 mt-1 font-medium">Real-time health telemetry</p>
        </div>

        <div className="bg-slate-900/60 border border-white/[0.08] p-5 rounded-2xl">
          <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">
            <span>Overall Health</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-black text-emerald-400">{summary.overallHealth}</p>
          <p className="text-xs text-slate-400 mt-1 font-medium">Zero destructive failovers</p>
        </div>

        <div className="bg-slate-900/60 border border-white/[0.08] p-5 rounded-2xl">
          <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">
            <span>Capacity Guard</span>
            <Activity className="w-4 h-4 text-cyan-400" />
          </div>
          <p className="text-2xl font-black text-cyan-400">{capacityPlan?.status || 'OPTIMAL'}</p>
          <p className="text-xs text-slate-400 mt-1 font-medium truncate">{capacityPlan?.warningMessage || 'Within limits'}</p>
        </div>
      </div>

      {/* ── Main Database Cards Matrix ──────────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Server className="w-5 h-5 text-primary-400" />
            Configured Databases & Storage
          </h2>
          <span className="text-xs text-slate-500 font-mono">{databases.length} Registered</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {databases.map((db) => {
            const classColors = CLASSIFICATION_COLORS[db.dataClassification] || CLASSIFICATION_COLORS.operational;
            const isTesting = testingDbId === db.id;
            const isObjectStorage = db.category === 'storage';
            const isVectorDB = db.category === 'vector';

            return (
              <motion.div
                key={db.id}
                layout
                className="bg-slate-900/60 border border-white/[0.08] rounded-3xl p-6 flex flex-col justify-between hover:border-white/20 transition-all shadow-xl backdrop-blur-xl relative overflow-hidden group"
              >
                <div className="space-y-4">
                  {/* Top Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-white text-base truncate">{db.name}</h3>
                      <p className="text-xs text-slate-400 font-mono mt-0.5">{db.type.toUpperCase()} • {db.category.toUpperCase()}</p>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${db.healthStatus === 'HEALTHY' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' : db.healthStatus === 'DEGRADED' ? 'bg-amber-500/15 text-amber-400 border-amber-500/30' : 'bg-red-500/15 text-red-400 border-red-500/30'}`}>
                      {db.healthStatus}
                    </span>
                  </div>

                  {/* Masked Connection URI */}
                  <div className="bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-xs font-mono text-slate-400 flex items-center justify-between">
                    <span className="truncate">{db.connectionUriMasked || db.baseUrl || 'Server Managed'}</span>
                    <Lock className="w-3.5 h-3.5 text-slate-500 flex-shrink-0 ml-2" />
                  </div>

                  {/* Key Metrics Grid - Dynamically formatted per provider category */}
                  <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                    <div className="bg-white/[0.02] border border-white/5 rounded-xl p-2.5">
                      <span className="text-slate-500 block text-[10px] uppercase font-bold">Latency</span>
                      <span className="text-white font-mono font-bold">{db.latencyMs} ms</span>
                    </div>

                    <div className="bg-white/[0.02] border border-white/5 rounded-xl p-2.5">
                      <span className="text-slate-500 block text-[10px] uppercase font-bold">Usage / Storage</span>
                      <span className="text-white font-mono font-bold truncate block">{formatBytes(db.storageBytes)}</span>
                    </div>

                    {!isObjectStorage && !isVectorDB && (
                      <>
                        <div className="bg-white/[0.02] border border-white/5 rounded-xl p-2.5">
                          <span className="text-slate-500 block text-[10px] uppercase font-bold">Collections / Tables</span>
                          <span className="text-white font-mono font-bold truncate block">{db.tableCount ?? 'Not available from provider'}</span>
                        </div>
                        <div className="bg-white/[0.02] border border-white/5 rounded-xl p-2.5">
                          <span className="text-slate-500 block text-[10px] uppercase font-bold">Docs / Rows</span>
                          <span className="text-white font-mono font-bold truncate block">{db.documentCount ?? 'Not available from provider'}</span>
                        </div>
                      </>
                    )}

                    {isObjectStorage && (
                      <div className="col-span-2 bg-white/[0.02] border border-white/5 rounded-xl p-2.5">
                        <span className="text-slate-500 block text-[10px] uppercase font-bold">Object Storage Architecture</span>
                        <span className="text-slate-300 text-[11px] block font-mono">Unstructured Zero-Egress Storage</span>
                      </div>
                    )}

                    {isVectorDB && (
                      <div className="col-span-2 bg-white/[0.02] border border-white/5 rounded-xl p-2.5">
                        <span className="text-slate-500 block text-[10px] uppercase font-bold">AI Vector Index</span>
                        <span className="text-slate-300 text-[11px] block font-mono">1024-Dimension Semantic Embeddings</span>
                      </div>
                    )}
                  </div>

                  {/* Role & Classification Badges */}
                  <div className="space-y-1.5 pt-2 border-t border-white/5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400 font-medium">Role:</span>
                      <span className="font-semibold text-primary-300 text-[11px] truncate max-w-[170px]">
                        {ROLE_LABELS[db.currentRole] || db.currentRole}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400 font-medium">Classification:</span>
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${classColors.bg} ${classColors.text} ${classColors.border}`}>
                        {db.dataClassification?.replace('_', ' ').toUpperCase()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400 font-medium">Failover:</span>
                      <span className="text-slate-400 text-[11px] truncate max-w-[170px]">{db.failoverAlternative || 'None'}</span>
                    </div>
                  </div>

                  {/* Data Source Label & Last Checked Time */}
                  <div className="pt-2 border-t border-white/5 text-[10px] text-slate-500 flex flex-col space-y-0.5 font-mono">
                    <div className="flex items-center justify-between">
                      <span>Source: <strong className="text-slate-400 font-normal">{db.metricSource}</strong></span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5" />
                        {formatTimestamp(db.lastCheckedAt)}
                      </span>
                      {db.isStale && (
                        <span className="text-amber-400 font-bold flex items-center gap-0.5">
                          <AlertTriangle className="w-2.5 h-2.5" /> Stale
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Card Action Buttons */}
                <div className="pt-5 mt-4 border-t border-white/5 flex items-center gap-2">
                  {db.capabilities.includes('health') && (
                    <button
                      onClick={() => handleTestDatabase(db)}
                      disabled={isTesting}
                      className="flex-1 bg-white/5 hover:bg-white/10 text-white font-semibold py-2 px-3 rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 border border-white/10"
                    >
                      <Play className={`w-3 h-3 text-emerald-400 ${isTesting ? 'animate-spin' : ''}`} />
                      {isTesting ? 'Testing...' : 'Test Ping'}
                    </button>
                  )}

                  <button
                    onClick={() => setSelectedDbForRole(db)}
                    className="bg-white/5 hover:bg-white/10 text-slate-200 p-2 rounded-xl text-xs transition-all border border-white/10"
                    title="Configure Role & Classification"
                  >
                    <Sliders className="w-4 h-4" />
                  </button>

                  {db.capabilities.includes('query') || db.capabilities.includes('tables') || db.capabilities.includes('collections') ? (
                    <button
                      onClick={() => handleOpenDiagnostics(db)}
                      className="bg-white/5 hover:bg-white/10 text-slate-200 p-2 rounded-xl text-xs transition-all border border-white/10"
                      title="View Diagnostics"
                    >
                      <BarChart3 className="w-4 h-4" />
                    </button>
                  ) : null}

                  {!db.isPreconfigured && (
                    <button
                      onClick={() => handleDeleteDatabase(db.id, db.name)}
                      className="bg-red-500/10 hover:bg-red-500/20 text-red-400 p-2 rounded-xl text-xs transition-all border border-red-500/20"
                      title="Deactivate Database"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* ── Capacity Planning & Overflow Strategy Center ────────────────────── */}
      {capacityPlan && (
        <div className="bg-slate-900/60 border border-white/[0.08] rounded-3xl p-6 backdrop-blur-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-cyan-500/10 rounded-2xl border border-cyan-500/20 text-cyan-400">
                <Activity className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">Firestore Capacity Planning & Overflow Strategy</h3>
                <p className="text-xs text-slate-400">
                  {capacityPlan.warningMessage} (Current usage: {formatBytes(capacityPlan.currentUsageBytes)}, {capacityPlan.currentDocumentCount} documents)
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-3 py-1 rounded-full text-xs font-bold border ${capacityPlan.status === 'OPTIMAL' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' : 'bg-amber-500/15 text-amber-400 border-amber-500/30'}`}>
                {capacityPlan.status}
              </span>
              <button
                onClick={() => setIsStrategyModalOpen(true)}
                className="px-3.5 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded-full text-xs font-bold transition-all shadow-md"
              >
                Review Data Strategy
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            {capacityPlan.recommendedDestinations?.map((dest: any, idx: number) => (
              <div key={idx} className="bg-black/30 border border-white/5 rounded-2xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-white font-bold text-sm">{dest.destinationName}</span>
                  <span className="px-2 py-0.5 bg-primary-500/20 text-primary-300 border border-primary-500/30 rounded-md text-[10px] font-mono font-bold">
                    MODE: {dest.recommendedMode}
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">{dest.description}</p>
                <div className="flex flex-wrap gap-1.5 pt-2">
                  <span className="text-[10px] text-slate-500 font-bold uppercase">Target Collections:</span>
                  {dest.targetCollections.map((col: string) => (
                    <span key={col} className="px-2 py-0.5 bg-white/5 border border-white/10 rounded text-[10px] font-mono text-slate-300">
                      {col}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Audit Logs Stream ────────────────────────────────────────────────── */}
      <div className="bg-slate-900/60 border border-white/[0.08] rounded-3xl p-6 backdrop-blur-xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-white text-base flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            Developer Data Operations Audit Trail
          </h3>
          <span className="text-xs text-slate-500 font-mono">Immutable Security Log</span>
        </div>

        <div className="divide-y divide-white/5 max-h-64 overflow-y-auto">
          {auditLogs.map((log: any, idx: number) => (
            <div key={log.id || idx} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-primary-400 font-mono font-bold">{log.action_type}</span>
                <span className="text-slate-400 font-mono">[{log.target_module}]</span>
                <span className="text-emerald-400 font-semibold">{log.status}</span>
              </div>
              <div className="flex items-center gap-4 text-slate-500">
                <span>By: <strong className="text-slate-300">{log.developer_email}</strong></span>
                <span>{new Date(log.created_at).toLocaleTimeString()}</span>
              </div>
            </div>
          ))}
          {auditLogs.length === 0 && (
            <div className="py-6 text-center text-slate-500 text-xs">No database audit events logged yet.</div>
          )}
        </div>
      </div>

      {/* ── Modal: Review Data Strategy (Safe Overflow Planning) ─────────────── */}
      <AnimatePresence>
        {isStrategyModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-white/15 rounded-3xl p-6 sm:p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl space-y-5"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Activity className="w-5 h-5 text-cyan-400" />
                  Review Data Strategy & Overflow Architecture
                </h3>
                <button onClick={() => setIsStrategyModalOpen(false)} className="text-slate-400 hover:text-white">✕</button>
              </div>

              <div className="space-y-4 text-xs text-slate-300 leading-relaxed">
                <div className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-2xl text-amber-300">
                  <p className="font-bold flex items-center gap-1.5 mb-1">
                    <AlertCircle className="w-4 h-4" /> Non-Destructive Recommendation Policy
                  </p>
                  <p className="text-[11px] opacity-90">
                    The Data Manager will never automatically migrate, delete, or redirect live business data (Orders, Payments, Auth, Users). Any future synchronization requires explicit developer initiation.
                  </p>
                </div>

                <div className="space-y-3">
                  <h4 className="font-bold text-white text-sm">Strategic Recommendations:</h4>
                  <div className="bg-black/40 border border-white/10 p-4 rounded-2xl space-y-2">
                    <p className="font-bold text-cyan-300">1. Historical Telemetry & Analytics → PostgreSQL</p>
                    <p className="text-[11px] text-slate-400">
                      Keep active order processing in Firestore while utilizing Supabase PostgreSQL for navigation telemetry, background job queues, and long-term analytical aggregates.
                    </p>
                  </div>

                  <div className="bg-black/40 border border-white/10 p-4 rounded-2xl space-y-2">
                    <p className="font-bold text-cyan-300">2. Large JSON Payloads & Reports → Cloudflare R2</p>
                    <p className="text-[11px] text-slate-400">
                      Store generated PDF financial reports and AI knowledge document caches in Cloudflare R2 object storage to keep Firestore document sizes light and minimize database egress costs.
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-white/10 flex justify-end">
                <button
                  onClick={() => setIsStrategyModalOpen(false)}
                  className="px-6 py-2.5 bg-primary-600 hover:bg-primary-500 text-white rounded-xl font-bold transition-all"
                >
                  Close & Acknowledge Strategy
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Modal: Add Database Wizard ──────────────────────────────────────── */}
      <AnimatePresence>
        {isAddModalOpen && (
          <ProviderRequirementsWizard
            providers={providers}
            onClose={() => setIsAddModalOpen(false)}
            onSaveSuccess={fetchData}
            dmFetch={dmFetch}
          />
        )}
      </AnimatePresence>

      {/* ── Modal: Role Configuration ───────────────────────────────────────── */}
      <AnimatePresence>
        {selectedDbForRole && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-white/15 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-5"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <h3 className="text-lg font-bold text-white">Configure Role: {selectedDbForRole.name}</h3>
                <button onClick={() => setSelectedDbForRole(null)} className="text-slate-400 hover:text-white">✕</button>
              </div>

              <form onSubmit={handleSaveRole} className="space-y-4 text-xs">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Current Role</label>
                  <select
                    value={selectedDbForRole.currentRole}
                    onChange={e => setSelectedDbForRole({ ...selectedDbForRole, currentRole: e.target.value })}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-primary-500"
                  >
                    {selectedDbForRole.availableRoles?.map((r: string) => (
                      <option key={r} value={r} className="bg-slate-900 text-white">
                        {ROLE_LABELS[r] || r}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 font-bold mb-1">Data Classification</label>
                    <select
                      value={selectedDbForRole.dataClassification}
                      onChange={e => setSelectedDbForRole({ ...selectedDbForRole, dataClassification: e.target.value })}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-primary-500"
                    >
                      <option value="critical_business" className="bg-slate-900">Critical Business</option>
                      <option value="operational" className="bg-slate-900">Operational</option>
                      <option value="analytics" className="bg-slate-900">Analytics</option>
                      <option value="archive" className="bg-slate-900">Archive</option>
                      <option value="content" className="bg-slate-900">Content</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-400 font-bold mb-1">Criticality</label>
                    <select
                      value={selectedDbForRole.criticality}
                      onChange={e => setSelectedDbForRole({ ...selectedDbForRole, criticality: e.target.value })}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-primary-500"
                    >
                      <option value="CRITICAL" className="bg-slate-900">CRITICAL</option>
                      <option value="OPERATIONAL" className="bg-slate-900">OPERATIONAL</option>
                      <option value="ANALYTICS" className="bg-slate-900">ANALYTICS</option>
                      <option value="ARCHIVE" className="bg-slate-900">ARCHIVE</option>
                      <option value="CONTENT" className="bg-slate-900">CONTENT</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-400 font-bold mb-1">Failover / Overflow Alternative</label>
                  <input
                    type="text"
                    value={selectedDbForRole.failoverAlternative}
                    onChange={e => setSelectedDbForRole({ ...selectedDbForRole, failoverAlternative: e.target.value })}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-primary-500"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => setSelectedDbForRole(null)}
                    className="px-4 py-2 text-slate-400 hover:text-white font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-primary-600 hover:bg-primary-500 text-white rounded-xl font-bold transition-all"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Modal: Safe Metadata Diagnostics ─────────────────────────────────── */}
      <AnimatePresence>
        {selectedDbForDiagnostics && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-white/15 rounded-3xl p-6 max-w-2xl w-full max-h-[85vh] overflow-y-auto shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-primary-400" />
                  Read-Only Diagnostics: {selectedDbForDiagnostics.name}
                </h3>
                <button onClick={() => setSelectedDbForDiagnostics(null)} className="text-slate-400 hover:text-white">✕</button>
              </div>

              {!diagnosticsData ? (
                <div className="py-12 flex justify-center text-slate-400">
                  <RefreshCw className="w-6 h-6 animate-spin text-primary-400" />
                </div>
              ) : (
                <pre className="bg-black/50 border border-white/10 rounded-2xl p-4 text-xs font-mono text-slate-300 overflow-x-auto max-h-96">
                  {JSON.stringify(diagnosticsData, null, 2)}
                </pre>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
