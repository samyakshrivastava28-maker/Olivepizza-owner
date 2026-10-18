import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router';
import {
  TrendingUp,
  Award,
  AlertTriangle,
  Store,
  ChevronRight,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  ShieldAlert,
  Flame,
  Bike,
  Activity,
  Layers,
  Calendar,
  ExternalLink,
  DollarSign,
  ShoppingBag,
  Bell,
  ArrowRight,
  Info
} from 'lucide-react';
import { fetchApi } from '../lib/api';
import toast from 'react-hot-toast';

interface CommandCenterSummary {
  totalFranchises: number;
  activeFranchises: number;
  totalOrdersToday: number;
  totalRevenueTodayInr: number;
  topEarningFranchise: any;
  highestVolumeFranchise: any;
  bestCompletionFranchise: any;
  criticalIncidentsCount: number;
  unreadAlertsTotal: number;
}

interface IncidentReport {
  id: string;
  title: string;
  description: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'INFORMATIONAL';
  status: 'OPEN' | 'ACKNOWLEDGED' | 'IN_PROGRESS' | 'RESOLVED';
  entityType: 'FRANCHISE' | 'BRANCH' | 'SYSTEM';
  entityId: string;
  detectedAt: string;
  durationMinutes?: number;
  affectedCount?: number;
  actionUrl?: string;
}

interface FranchisePerformance {
  franchiseId: string;
  name: string;
  city: string;
  state: string;
  status: string;
  branchesCount: number;
  totalOrders: number;
  grossSalesPaise: number;
  netSalesPaise: number;
  totalSalesInr: number;
  averageOrderValueInr: number;
  cancellationRatePercent: number;
  activeRidersCount: number;
  activeOrdersCount: number;
  unreadAlertsCount: number;
  lastOrderAt?: string;
}

export default function CommandCenter() {
  const navigate = useNavigate();

  // Selected Time Period Filter
  const [period, setPeriod] = useState<'today' | 'yesterday' | '7d' | '30d' | 'all'>('today');
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // GraphQL Data states
  const [summary, setSummary] = useState<CommandCenterSummary | null>(null);
  const [topFranchises, setTopFranchises] = useState<FranchisePerformance[]>([]);
  const [incidents, setIncidents] = useState<IncidentReport[]>([]);
  const [franchises, setFranchises] = useState<FranchisePerformance[]>([]);

  // GraphQL Fetcher
  const loadCommandCenterData = async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);

    const query = `
      query GetCommandCenterData($period: String) {
        commandCenterSummary(period: $period) {
          totalFranchises
          activeFranchises
          totalOrdersToday
          totalRevenueTodayInr
          criticalIncidentsCount
          unreadAlertsTotal
          topEarningFranchise {
            franchiseId
            name
            city
            totalSalesInr
            totalOrders
            averageOrderValueInr
          }
          highestVolumeFranchise {
            franchiseId
            name
            city
            totalSalesInr
            totalOrders
          }
          bestCompletionFranchise {
            franchiseId
            name
            city
            cancellationRatePercent
            totalOrders
          }
        }
        topFranchises(period: $period, limit: 3) {
          franchiseId
          name
          city
          totalOrders
          totalSalesInr
          averageOrderValueInr
          activeOrdersCount
          activeRidersCount
        }
        criticalIncidents {
          id
          title
          description
          severity
          status
          entityType
          entityId
          detectedAt
          durationMinutes
          affectedCount
          actionUrl
        }
        franchisesList {
          franchiseId
          name
          city
          state
          status
          branchesCount
          totalOrders
          totalSalesInr
          averageOrderValueInr
          cancellationRatePercent
          activeRidersCount
          activeOrdersCount
          unreadAlertsCount
          lastOrderAt
        }
      }
    `;

    try {
      const res = await fetchApi('/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          variables: { period }
        })
      });

      if (!res.ok) {
        // Fallback to /api/graphql if root /graphql proxy is handled differently
        const retryRes = await fetchApi('/api/graphql', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query, variables: { period } })
        });
        if (!retryRes.ok) throw new Error(`GraphQL request failed (HTTP ${res.status})`);
        const json = await retryRes.json();
        if (json.errors && json.errors.length > 0) throw new Error(json.errors[0].message);
        setSummary(json.data.commandCenterSummary);
        setTopFranchises(json.data.topFranchises || []);
        setIncidents(json.data.criticalIncidents || []);
        setFranchises(json.data.franchisesList || []);
        return;
      }

      const json = await res.json();
      if (json.errors && json.errors.length > 0) {
        throw new Error(json.errors[0].message);
      }

      setSummary(json.data.commandCenterSummary);
      setTopFranchises(json.data.topFranchises || []);
      setIncidents(json.data.criticalIncidents || []);
      setFranchises(json.data.franchisesList || []);
    } catch (err: any) {
      console.error('[CommandCenter] GraphQL load error:', err);
      toast.error(err.message || 'Failed to load Command Center telemetry');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadCommandCenterData();
  }, [period]);

  // Handle Incident Acknowledgment
  const handleAcknowledgeIncident = async (id: string) => {
    const mutation = `
      mutation AcknowledgeIncident($id: ID!) {
        acknowledgeIncident(id: $id) {
          id
          status
        }
      }
    `;
    try {
      const res = await fetchApi('/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: mutation, variables: { id } })
      });
      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status}`);
      }
      const json = await res.json();
      if (json.errors && json.errors.length > 0) throw new Error(json.errors[0].message);
      if (json.data?.acknowledgeIncident?.status !== 'ACKNOWLEDGED') {
        throw new Error('Incident status update could not be verified');
      }
      toast.success('Incident acknowledged');
      loadCommandCenterData(true);
    } catch (err: any) {
      toast.error(err.message || 'Failed to acknowledge incident');
    }
  };

  // Handle Incident Resolution
  const handleResolveIncident = async (id: string, note?: string) => {
    const mutation = `
      mutation ResolveIncident($id: ID!, $resolutionNote: String) {
        resolveIncident(id: $id, resolutionNote: $resolutionNote) {
          id
          status
        }
      }
    `;
    try {
      const res = await fetchApi('/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: mutation, variables: { id, resolutionNote: note || 'Resolved via Command Center' } })
      });
      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status}`);
      }
      const json = await res.json();
      if (json.errors && json.errors.length > 0) throw new Error(json.errors[0].message);
      if (json.data?.resolveIncident?.status !== 'RESOLVED') {
        throw new Error('Incident resolution could not be verified');
      }
      toast.success('Incident resolved successfully');
      loadCommandCenterData(true);
    } catch (err: any) {
      toast.error(err.message || 'Failed to resolve incident');
    }
  };

  // Filtered Franchises
  const filteredFranchises = useMemo(() => {
    return franchises.filter((f) => {
      const matchesSearch =
        f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.franchiseId.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' || f.status.toLowerCase() === statusFilter.toLowerCase();
      return matchesSearch && matchesStatus;
    });
  }, [franchises, searchQuery, statusFilter]);

  const slugify = (id: string, name: string) => {
    const cleanId = id.replace(/^fra_/, '');
    if (cleanId) return cleanId;
    return name.toLowerCase().replace(/[^a-z0-9]/g, '-');
  };

  return (
    <div className="space-y-8 pb-16">
      {/* ─── Top Master Bar ───────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-orange-500/10 text-orange-500 border border-orange-500/20">
                <ShieldAlert className="w-5 h-5" />
              </span>
              Platform Command Center
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-orange-500/20 text-orange-400 border border-orange-500/30">
              Master Control
            </span>
          </div>
          <p className="text-slate-400 text-xs mt-1">
            Executive oversight, multi-franchise telemetry, critical operational incidents & quick workspace access.
          </p>
        </div>

        {/* Filters & Actions */}
        <div className="flex items-center gap-3">
          {/* Time Filter Pills */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-1 flex items-center gap-1 text-xs font-semibold">
            {[
              { id: 'today', label: 'Today' },
              { id: 'yesterday', label: 'Yesterday' },
              { id: '7d', label: 'Last 7D' },
              { id: '30d', label: 'Last 30D' },
              { id: 'all', label: 'All Time' },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id as any)}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  period === p.id
                    ? 'bg-orange-500 text-slate-950 font-bold shadow-md shadow-orange-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Refresh Button */}
          <button
            onClick={() => loadCommandCenterData(true)}
            disabled={refreshing || loading}
            className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 transition"
            title="Refresh Realtime Data"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-orange-500' : ''}`} />
          </button>
        </div>
      </div>

      {/* ─── SECTION 1: Top Performing Franchises (Ranked Cards) ────────── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-400" />
            <h2 className="text-base font-bold text-white tracking-wide uppercase text-xs">
              Top Performing Franchises ({period.toUpperCase()})
            </h2>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            Ranked by gross sales volume, orders & fulfillment rate
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* 1. Top Gross Revenue */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-950/20 via-slate-900 to-slate-900 border border-amber-500/30 p-5 shadow-xl hover:border-amber-500/60 transition group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-bl-full pointer-events-none" />
            <div className="flex items-start justify-between">
              <div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1 w-fit mb-2">
                  <Award className="w-3 h-3" /> #1 Top Sales
                </span>
                <h3 className="text-lg font-black text-white group-hover:text-amber-400 transition">
                  {summary?.topEarningFranchise?.name || 'Olive Pizza Rajnandgaon'}
                </h3>
                <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                  <Store className="w-3 h-3" /> {summary?.topEarningFranchise?.city || 'Rajnandgaon, CG'}
                </p>
              </div>
              <div className="text-right">
                <div className="text-xl font-black text-amber-400 font-mono">
                  ₹{Number(summary?.topEarningFranchise?.totalSalesInr || 0).toLocaleString('en-IN')}
                </div>
                <div className="text-[11px] text-slate-400 font-mono">
                  {summary?.topEarningFranchise?.totalOrders || 0} orders
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
              <span className="text-slate-400 font-mono">
                Avg Order Value: <strong className="text-slate-200">₹{summary?.topEarningFranchise?.averageOrderValueInr || 0}</strong>
              </span>
              <button
                onClick={() =>
                  navigate(
                    `/franchise-management/${slugify(
                      summary?.topEarningFranchise?.franchiseId || 'fra_rajnandgaon',
                      summary?.topEarningFranchise?.name || 'Rajnandgaon'
                    )}`
                  )
                }
                className="text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1 hover:underline cursor-pointer"
              >
                Workspace <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* 2. Highest Order Volume */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-950/20 via-slate-900 to-slate-900 border border-emerald-500/30 p-5 shadow-xl hover:border-emerald-500/60 transition group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-bl-full pointer-events-none" />
            <div className="flex items-start justify-between">
              <div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1 w-fit mb-2">
                  <Flame className="w-3 h-3" /> Highest Volume
                </span>
                <h3 className="text-lg font-black text-white group-hover:text-emerald-400 transition">
                  {summary?.highestVolumeFranchise?.name || 'Olive Pizza Durg'}
                </h3>
                <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                  <Store className="w-3 h-3" /> {summary?.highestVolumeFranchise?.city || 'Durg, CG'}
                </p>
              </div>
              <div className="text-right">
                <div className="text-xl font-black text-emerald-400 font-mono">
                  {summary?.highestVolumeFranchise?.totalOrders || 0}
                </div>
                <div className="text-[11px] text-slate-400 font-mono">
                  Orders Fulfilled
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
              <span className="text-slate-400 font-mono">
                Gross: <strong className="text-slate-200">₹{Number(summary?.highestVolumeFranchise?.totalSalesInr || 0).toLocaleString('en-IN')}</strong>
              </span>
              <button
                onClick={() =>
                  navigate(
                    `/franchise-management/${slugify(
                      summary?.highestVolumeFranchise?.franchiseId || 'fra_durg',
                      summary?.highestVolumeFranchise?.name || 'Durg'
                    )}`
                  )
                }
                className="text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1 hover:underline cursor-pointer"
              >
                Workspace <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* 3. Best Completion / Operational Quality */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-950/20 via-slate-900 to-slate-900 border border-blue-500/30 p-5 shadow-xl hover:border-blue-500/60 transition group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-bl-full pointer-events-none" />
            <div className="flex items-start justify-between">
              <div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-500/20 text-blue-300 border border-blue-500/30 flex items-center gap-1 w-fit mb-2">
                  <CheckCircle2 className="w-3 h-3" /> Best Completion
                </span>
                <h3 className="text-lg font-black text-white group-hover:text-blue-400 transition">
                  {summary?.bestCompletionFranchise?.name || 'Olive Pizza Bhilai'}
                </h3>
                <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                  <Store className="w-3 h-3" /> {summary?.bestCompletionFranchise?.city || 'Bhilai, CG'}
                </p>
              </div>
              <div className="text-right">
                <div className="text-xl font-black text-blue-400 font-mono">
                  {100 - Number(summary?.bestCompletionFranchise?.cancellationRatePercent || 0)}%
                </div>
                <div className="text-[11px] text-slate-400 font-mono">
                  Success Rate
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
              <span className="text-slate-400 font-mono">
                Cancellations: <strong className="text-slate-200">{summary?.bestCompletionFranchise?.cancellationRatePercent || 0}%</strong>
              </span>
              <button
                onClick={() =>
                  navigate(
                    `/franchise-management/${slugify(
                      summary?.bestCompletionFranchise?.franchiseId || 'fra_bhilai',
                      summary?.bestCompletionFranchise?.name || 'Bhilai'
                    )}`
                  )
                }
                className="text-blue-400 hover:text-blue-300 font-bold flex items-center gap-1 hover:underline cursor-pointer"
              >
                Workspace <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ─── SECTION 2: Important Things / Incident Alerts ─────────────── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-rose-500 animate-pulse" />
            <h2 className="text-base font-bold text-white tracking-wide uppercase text-xs flex items-center gap-2">
              Important Things & Critical Incidents
              {incidents.length > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[10px] font-mono">
                  {incidents.length} ACTIONABLE
                </span>
              )}
            </h2>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            System anomalies, disabled stores, high cancellations & offline riders
          </span>
        </div>

        {incidents.length === 0 ? (
          <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800 text-center">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2 opacity-80" />
            <h3 className="text-sm font-bold text-slate-200">No Critical System Incidents</h3>
            <p className="text-xs text-slate-500 mt-1">
              All franchises, branches, and rider fleets are operating within normal SLA thresholds.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {incidents.map((incident) => {
              const isCrit = incident.severity === 'CRITICAL';
              const isHigh = incident.severity === 'HIGH';
              const borderColor = isCrit
                ? 'border-rose-500/50 bg-rose-950/20'
                : isHigh
                ? 'border-amber-500/40 bg-amber-950/20'
                : 'border-slate-800 bg-slate-900/60';
              const badgeColor = isCrit
                ? 'bg-rose-500 text-white'
                : isHigh
                ? 'bg-amber-500 text-slate-950'
                : 'bg-slate-700 text-slate-200';

              return (
                <div
                  key={incident.id}
                  className={`rounded-2xl border ${borderColor} p-4 flex flex-col justify-between shadow-lg relative group transition hover:border-slate-600`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider ${badgeColor}`}>
                        {incident.severity}
                      </span>
                      <span className="text-[11px] font-mono text-slate-400">
                        {incident.durationMinutes ? `${incident.durationMinutes}m ago` : 'Active'}
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-white group-hover:text-orange-400 transition">
                      {incident.title}
                    </h4>
                    <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                      {incident.description}
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                    <span className="text-[11px] font-mono text-slate-400">
                      Scope: <strong className="text-slate-200">{incident.entityType} ({incident.entityId})</strong>
                    </span>
                    <div className="flex items-center gap-2">
                      {incident.status === 'OPEN' && (
                        <button
                          onClick={() => handleAcknowledgeIncident(incident.id)}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold transition cursor-pointer"
                        >
                          Ack
                        </button>
                      )}
                      {(incident.status === 'OPEN' || incident.status === 'ACKNOWLEDGED') && (
                        <button
                          onClick={() => handleResolveIncident(incident.id)}
                          className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 text-[11px] font-semibold transition cursor-pointer"
                        >
                          Resolve
                        </button>
                      )}
                      {incident.actionUrl && (
                        <button
                          onClick={() => navigate(incident.actionUrl!)}
                          className="px-2.5 py-1 rounded-lg bg-orange-500 hover:bg-orange-600 text-slate-950 text-[11px] font-bold transition flex items-center gap-1 cursor-pointer"
                        >
                          Fix <ArrowRight className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── SECTION 3: All Franchises List with Messaging Alert Badges ─── */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Store className="w-5 h-5 text-orange-500" />
            <h2 className="text-base font-bold text-white tracking-wide uppercase text-xs">
              All Franchises & Workspaces ({filteredFranchises.length})
            </h2>
          </div>

          {/* Search & Filter */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search franchise or city..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 w-52"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="py-1.5 px-3 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-orange-500"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive / Suspended</option>
            </select>
          </div>
        </div>

        {/* Franchises Grid / Table */}
        <div className="rounded-2xl border border-slate-800 bg-[#0E1524] overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/80 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3.5 px-4">Franchise & City</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4 text-center">Alerts & Badges</th>
                  <th className="py-3.5 px-4 text-right">Orders ({period})</th>
                  <th className="py-3.5 px-4 text-right">Gross Sales (₹)</th>
                  <th className="py-3.5 px-4 text-center">Active Fleet</th>
                  <th className="py-3.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredFranchises.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500">
                      No franchises found matching your search criteria.
                    </td>
                  </tr>
                ) : (
                  filteredFranchises.map((f) => {
                    const slug = slugify(f.franchiseId, f.name);
                    const isActive = f.status === 'ACTIVE' || f.status === 'active';
                    const hasUnread = f.unreadAlertsCount > 0;

                    return (
                      <tr
                        key={f.franchiseId}
                        onClick={() => navigate(`/franchise-management/${slug}`)}
                        className="hover:bg-slate-800/40 transition cursor-pointer group"
                      >
                        {/* 1. Franchise Name & City */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400 font-bold text-sm">
                              {f.name.charAt(0)}
                            </div>
                            <div>
                              <div className="font-bold text-white group-hover:text-orange-400 transition flex items-center gap-2">
                                {f.name}
                                {hasUnread && (
                                  <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                                <span>{f.city}, {f.state}</span>
                                <span>•</span>
                                <span className="font-mono text-slate-500">{f.branchesCount} branches</span>
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* 2. Status */}
                        <td className="py-3.5 px-4 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                              isActive
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            }`}
                          >
                            {f.status}
                          </span>
                        </td>

                        {/* 3. Messaging-style Unread Alert Badges */}
                        <td className="py-3.5 px-4 text-center">
                          {hasUnread ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-600 text-white font-mono text-[11px] font-black shadow-md shadow-rose-600/30 animate-bounce">
                              <Bell className="w-3 h-3 fill-current" />
                              {f.unreadAlertsCount}
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-500 font-mono">0 alerts</span>
                          )}
                        </td>

                        {/* 4. Orders */}
                        <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-200">
                          {f.totalOrders.toLocaleString('en-IN')}
                        </td>

                        {/* 5. Gross Sales */}
                        <td className="py-3.5 px-4 text-right font-mono font-black text-amber-400">
                          ₹{Number(f.totalSalesInr || 0).toLocaleString('en-IN')}
                        </td>

                        {/* 6. Active Fleet */}
                        <td className="py-3.5 px-4 text-center">
                          <span className="inline-flex items-center gap-1 text-[11px] font-mono text-slate-300 bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-lg">
                            <Bike className="w-3.5 h-3.5 text-blue-400" />
                            {f.activeRidersCount} riders ({f.activeOrdersCount} active)
                          </span>
                        </td>

                        {/* 7. Action Button */}
                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/franchise-management/${slug}`);
                            }}
                            className="px-3 py-1.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-slate-950 font-black text-xs transition flex items-center gap-1 ml-auto shadow-md shadow-orange-500/20 cursor-pointer"
                          >
                            Enter Workspace
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
