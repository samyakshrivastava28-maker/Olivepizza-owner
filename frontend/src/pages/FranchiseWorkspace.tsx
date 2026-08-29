import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router';
import {
  Building2,
  Store,
  Users,
  Bike,
  Monitor,
  ShoppingBag,
  TrendingUp,
  Clock,
  MapPin,
  Phone,
  Mail,
  ShieldCheck,
  Power,
  Edit2,
  Plus,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileSpreadsheet,
  FileText,
  DollarSign,
  ChevronDown,
  ArrowLeft,
  Calendar,
  Layers,
  Settings,
  History,
  Key,
  Flame,
  Package,
  Sliders,
  ExternalLink,
  ChevronRight,
  Sparkles,
  Info,
  Check,
  Lock,
  Smartphone
} from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import { fetchApi } from '../lib/api';
import toast from 'react-hot-toast';

export default function FranchiseWorkspace() {
  const { franchiseSlug } = useParams<{ franchiseSlug: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const currentSlug = (franchiseSlug || 'rajnandgaon').toLowerCase();
  const initialTab = searchParams.get('tab') || 'overview';

  // State
  const [activeTab, setActiveTab] = useState<string>(initialTab);
  const [selectedBranchFilter, setSelectedBranchFilter] = useState<string>('all');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Franchise & Context Data
  const [allFranchises, setAllFranchises] = useState<any[]>([]);
  const [franchise, setFranchise] = useState<any>(null);
  const [dashboardMetrics, setDashboardMetrics] = useState<any>(null);
  const [branches, setBranches] = useState<any[]>([]);
  const [managers, setManagers] = useState<any[]>([]);
  const [riders, setRiders] = useState<any[]>([]);
  const [posTerminals, setPosTerminals] = useState<any[]>([]);
  const [liveOrders, setLiveOrders] = useState<any[]>([]);
  const [historicalOrders, setHistoricalOrders] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [reportsData, setReportsData] = useState<any>(null);
  const [accessAccounts, setAccessAccounts] = useState<any[]>([]);

  // Modals
  const [showAddBranchModal, setShowAddBranchModal] = useState<boolean>(false);
  const [showProvidePosModal, setShowProvidePosModal] = useState<boolean>(false);
  const [showEditAccessModal, setShowEditAccessModal] = useState<boolean>(false);
  const [selectedAccountForAccess, setSelectedAccountForAccess] = useState<any>(null);

  // Form states
  const [newBranchData, setNewBranchData] = useState({ name: '', code: '', city: '', address: '', phone: '', email: '', maxDeliveryRadiusKm: 12, openingTime: '12:00', closingTime: '23:59' });
  const [providePosData, setProvidePosData] = useState({ branchId: '', terminalName: 'Counter 1 — Billing Terminal', assignedUserId: '', posTerminalCount: 1 });
  const [accessForm, setAccessForm] = useState({
    app_franchise_management: false,
    app_restaurant_management: false,
    app_pos: false,
    app_delivery: false,
    accountStatus: 'ACTIVE',
    assignedBranchId: ''
  });
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  // 1. Fetch All Franchises (for Context Switcher)
  useEffect(() => {
    fetchApi('/api/franchises/list')
      .then(async (res) => (res.ok ? res.json() : {}))
      .then((data) => {
        if (data.franchises && Array.isArray(data.franchises)) {
          setAllFranchises(data.franchises);
        }
      })
      .catch((err) => console.error('[FranchiseWorkspace] Error loading franchise list:', err));
  }, []);

  // 2. Resolve Franchise by Slug & Load Workspace Data
  const loadFranchiseWorkspace = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Resolve Slug
      const slugRes = await fetchApi(`/api/franchises/by-slug/${currentSlug}`);
      if (!slugRes.ok) {
        if (slugRes.status === 403) throw new Error('Unauthorized: You do not have access to this franchise workspace.');
        if (slugRes.status === 404) throw new Error(`Franchise '${currentSlug}' not found.`);
        throw new Error(`Failed to resolve franchise workspace (HTTP ${slugRes.status})`);
      }
      const slugData = await slugRes.json();
      const resolvedFranchise = slugData.franchise;
      setFranchise(resolvedFranchise);
      const fId = resolvedFranchise.id;

      // 2. Fetch Scoped Branches
      const bRes = await fetchApi(`/api/franchises/${fId}/branches`);
      const bData = await bRes.json().catch(() => ({}));
      const resolvedBranches = Array.isArray(bData.branches) ? bData.branches : (resolvedFranchise.branches || []);
      setBranches(resolvedBranches);
      if (resolvedBranches.length > 0) {
        setProvidePosData((prev) => ({ ...prev, branchId: resolvedBranches[0].id }));
      }

      // 3. Fetch Dashboard Metrics
      const dashRes = await fetchApi(`/api/franchises/${fId}/dashboard?branchId=${selectedBranchFilter}`);
      const dashData = await dashRes.json().catch(() => ({}));
      setDashboardMetrics(dashData.dashboard || null);

      // 4. Fetch Managers & Riders
      fetchApi(`/api/franchises/${fId}/managers`)
        .then(async (r) => (r.ok ? r.json() : {}))
        .then((d) => setManagers(Array.isArray(d.managers) ? d.managers : []))
        .catch(() => {});

      fetchApi(`/api/franchises/${fId}/riders`)
        .then(async (r) => (r.ok ? r.json() : {}))
        .then((d) => setRiders(Array.isArray(d.riders) ? d.riders : []))
        .catch(() => {});

      // 5. Fetch POS Terminals
      const posRes = await fetchApi(`/api/franchises/${fId}/pos-terminals`);
      const posData = await posRes.json().catch(() => ({}));
      setPosTerminals(Array.isArray(posData.terminals) ? posData.terminals : []);

      // 6. Fetch Access Accounts
      const accRes = await fetchApi(`/api/franchises/${fId}/access-accounts`);
      const accData = await accRes.json().catch(() => ({}));
      setAccessAccounts(Array.isArray(accData.accounts) ? accData.accounts : []);

      // 7. Fetch Reports & Audit Logs
      fetchApi(`/api/franchises/${fId}/reports`)
        .then(async (r) => (r.ok ? r.json() : {}))
        .then((d) => setReportsData(d.reports || null))
        .catch(() => {});

      fetchApi(`/api/franchises/${fId}/audit-logs`)
        .then(async (r) => (r.ok ? r.json() : {}))
        .then((d) => setAuditLogs(Array.isArray(d.auditLogs) ? d.auditLogs : []))
        .catch(() => {});

      setLoading(false);
    } catch (err: any) {
      console.error('[FranchiseWorkspace] Error resolving workspace:', err);
      setError(err.message || 'Unable to load franchise workspace.');
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFranchiseWorkspace();
  }, [currentSlug, selectedBranchFilter]);

  // 3. Real-Time Scoped Live Orders Listener
  useEffect(() => {
    if (!franchise) return;
    const branchIds = branches.map((b) => b.id);
    const targetBranches = selectedBranchFilter === 'all' ? branchIds : [selectedBranchFilter];

    const unsubscribe = onSnapshot(collection(db, 'orders'), (snapshot) => {
      const live: any[] = [];
      const past: any[] = [];
      const activeStatuses = ['pending', 'accepted', 'preparing', 'partner_assigned', 'ready', 'picked_up', 'out_for_delivery'];

      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        const bId = d.branchId || 'main_branch';
        const s = (d.status || 'pending').toLowerCase();

        if (targetBranches.includes(bId) || (franchise.id === 'fra_rajnandgaon' && bId === 'main_branch')) {
          const item = { id: docSnap.id, ...d };
          if (activeStatuses.includes(s)) {
            live.push(item);
          } else {
            past.push(item);
          }
        }
      });

      live.sort((a, b) => {
        const tA = new Date(a.createdAt?.toDate ? a.createdAt.toDate() : a.createdAt || Date.now()).getTime();
        const tB = new Date(b.createdAt?.toDate ? b.createdAt.toDate() : b.createdAt || Date.now()).getTime();
        return tB - tA;
      });

      setLiveOrders(live);
      setHistoricalOrders(past);
    });

    return () => unsubscribe();
  }, [franchise, branches, selectedBranchFilter]);

  // Handler: Switch Franchise
  const handleSwitchFranchise = (newSlug: string) => {
    if (newSlug === currentSlug) return;
    setLoading(true);
    setFranchise(null);
    setDashboardMetrics(null);
    setLiveOrders([]);
    setHistoricalOrders([]);
    navigate(`/franchise-management/${newSlug}`);
  };

  // Handler: Open Edit Access Modal
  const handleOpenEditAccess = (account: any) => {
    setSelectedAccountForAccess(account);
    setAccessForm({
      app_franchise_management: Boolean(account.applicationAccess?.app_franchise_management),
      app_restaurant_management: Boolean(account.applicationAccess?.app_restaurant_management),
      app_pos: Boolean(account.applicationAccess?.app_pos),
      app_delivery: Boolean(account.applicationAccess?.app_delivery),
      accountStatus: account.accountStatus || 'ACTIVE',
      assignedBranchId: account.branchId || (branches[0]?.id || 'main_branch')
    });
    setShowEditAccessModal(true);
  };

  // Handler: Save Access Changes
  const handleSaveAccessChanges = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!franchise || !selectedAccountForAccess) return;
    setActionLoading(true);
    try {
      const res = await fetchApi(`/api/franchises/${franchise.id}/access/edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUserId: selectedAccountForAccess.id,
          targetRole: selectedAccountForAccess.role,
          applicationAccess: {
            app_franchise_management: accessForm.app_franchise_management,
            app_restaurant_management: accessForm.app_restaurant_management,
            app_pos: accessForm.app_pos,
            app_delivery: accessForm.app_delivery
          },
          accountStatus: accessForm.accountStatus,
          assignedBranchId: accessForm.assignedBranchId
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save access changes');

      toast.success(`Application access updated for ${selectedAccountForAccess.name}!`);
      setShowEditAccessModal(false);
      loadFranchiseWorkspace();
    } catch (err: any) {
      toast.error(err.message || 'Access update failed');
    } finally {
      setActionLoading(false);
    }
  };

  // Handler: Provide POS (On-Demand Provisioning)
  const handleProvidePos = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!franchise || !providePosData.branchId) {
      toast.error('Please select a branch to provide POS');
      return;
    }
    setActionLoading(true);
    try {
      const res = await fetchApi(`/api/franchises/${franchise.id}/pos/provide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(providePosData),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to provide POS');

      const firstCode = data.terminals?.[0]?.activationCode || 'Generated';
      toast.success(`POS Provisioned! Activation Code: ${firstCode}`, { duration: 6000 });
      setShowProvidePosModal(false);
      loadFranchiseWorkspace();
    } catch (err: any) {
      toast.error(err.message || 'POS Provisioning failed');
    } finally {
      setActionLoading(false);
    }
  };

  // Handler: Revoke POS Terminal
  const handleRevokePos = async (termId: string) => {
    if (!franchise || !confirm('Are you sure you want to revoke this POS terminal? Billing will be disabled immediately.')) return;
    try {
      const res = await fetchApi(`/api/franchises/${franchise.id}/pos-terminals/${termId}/revoke`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to revoke terminal');
      toast.success('POS Terminal revoked.');
      setPosTerminals((prev) => prev.map((t) => (t.id === termId ? { ...t, isActive: false, activationStatus: 'REVOKED' } : t)));
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // Handler: Create Branch
  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!franchise || !newBranchData.name || !newBranchData.city) {
      toast.error('Branch name and city are required');
      return;
    }
    setActionLoading(true);
    try {
      const res = await fetchApi(`/api/franchises/${franchise.id}/branches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newBranchData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create branch');

      toast.success('New branch added successfully!');
      setBranches((prev) => [...prev, data.branch]);
      setShowAddBranchModal(false);
    } catch (err: any) {
      toast.error(err.message || 'Branch creation failed');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] text-center p-6">
        <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mb-4" />
        <h3 className="text-lg font-semibold text-white">Loading Franchise Workspace...</h3>
        <p className="text-xs text-slate-400 mt-1">Resolving scoped access for <span className="text-amber-400 uppercase font-mono">{currentSlug}</span></p>
      </div>
    );
  }

  if (error || !franchise) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] text-center p-6">
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-400 max-w-md mb-4">
          <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-red-400" />
          <h3 className="text-base font-bold text-white mb-1">Access Restricted / Error</h3>
          <p className="text-xs text-red-300">{error || 'Franchise not found or access denied.'}</p>
        </div>
        <button onClick={() => navigate('/franchises')} className="px-4 py-2 bg-amber-500 text-black text-xs font-bold rounded-xl transition">
          Back to Franchises List
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ─── 1. TOP BAR & QUICK ACTIONS ───────────────────────────────────────── */}
      <div className="bg-slate-900/90 backdrop-blur border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-wrap items-center justify-between gap-4">
        {/* Left: Identity */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/franchises')}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl transition"
            title="Back to Global Owner Console"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-white tracking-tight">{franchise.name}</h1>
              <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-md text-[10px] font-mono font-bold">
                {franchise.code}
              </span>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                {franchise.status}
              </span>
            </div>
            <p className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
              <span>{franchise.city}, {franchise.region}</span>
              <span>•</span>
              <span className="text-slate-300 font-medium">Owner: {franchise.franchiseOwnerName || 'Master Owner'}</span>
            </p>
          </div>
        </div>

        {/* Right: Master Context Switcher & Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Quick Action: Edit Access */}
          <button
            onClick={() => setActiveTab('access')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 rounded-xl text-xs font-bold transition shadow-sm"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Edit Access</span>
          </button>

          {/* Quick Action: Provide POS */}
          <button
            onClick={() => setShowProvidePosModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-black rounded-xl text-xs font-bold transition shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Provide POS</span>
          </button>

          {/* Shortcut: Open Franchise App */}
          <a
            href="http://localhost:5175"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-xl text-xs font-semibold transition"
          >
            <ExternalLink className="w-3.5 h-3.5 text-amber-400" />
            <span>Open Franchise App (5175)</span>
          </a>

          {/* Franchise Context Switcher */}
          <div className="flex items-center gap-1.5 bg-slate-950/80 border border-slate-700/60 rounded-xl px-3 py-1.5 shadow-inner">
            <span className="text-[10px] text-slate-400 font-semibold uppercase">Franchise:</span>
            <select
              value={currentSlug}
              onChange={(e) => handleSwitchFranchise(e.target.value)}
              className="bg-transparent text-amber-400 text-xs font-bold font-mono focus:outline-none cursor-pointer"
            >
              {allFranchises.map((f) => (
                <option key={f.id} value={f.slug || f.id.replace('fra_', '')} className="bg-slate-900 text-white">
                  {f.name} ({f.code})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ─── 2. TAB NAVIGATION ────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 border-b border-slate-800 scrollbar-none text-xs font-semibold">
        {[
          { id: 'overview', label: 'Overview & Analytics', icon: TrendingUp },
          { id: 'access', label: `Access Control (${accessAccounts.length})`, icon: ShieldCheck },
          { id: 'live-orders', label: `Live Orders (${liveOrders.length})`, icon: Flame, badge: liveOrders.length > 0 ? liveOrders.length : null },
          { id: 'orders', label: 'Orders History', icon: History },
          { id: 'branches', label: `Branches (${branches.length})`, icon: Store },
          { id: 'delivery', label: `Delivery Fleet (${riders.length})`, icon: Bike },
          { id: 'pos', label: `POS Terminals (${posTerminals.length})`, icon: Monitor },
          { id: 'reports', label: 'Financial & Reports', icon: FileSpreadsheet },
          { id: 'settings', label: 'Franchise Settings & Audit', icon: Settings },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl transition whitespace-nowrap ${
                isActive
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-lg shadow-amber-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {tab.badge && (
                <span className="px-1.5 py-0.2 bg-red-600 text-white rounded-full text-[10px] animate-pulse">
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ─── 3. TAB: ACCESS CONTROL ───────────────────────────────────────────── */}
      {activeTab === 'access' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white">Application Access Matrix</h3>
              <p className="text-xs text-slate-400">Server-enforced access to separate Franchise, Restaurant, POS, and Delivery applications</p>
            </div>
            <button
              onClick={() => loadFranchiseWorkspace()}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs transition flex items-center gap-1"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh Access Matrix
            </button>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-[11px] text-slate-400 uppercase bg-slate-950/80 border-b border-slate-800">
                  <tr>
                    <th className="p-3.5">Account & Email</th>
                    <th className="p-3.5">Role</th>
                    <th className="p-3.5 text-center">Franchise App</th>
                    <th className="p-3.5 text-center">Restaurant App</th>
                    <th className="p-3.5 text-center">POS Terminal</th>
                    <th className="p-3.5 text-center">Delivery App</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {accessAccounts.map((acc) => (
                    <tr key={acc.id} className="hover:bg-slate-800/40 transition">
                      <td className="p-3.5">
                        <strong className="text-white block">{acc.name}</strong>
                        <span className="text-[11px] text-slate-400 font-mono">{acc.email}</span>
                      </td>
                      <td className="p-3.5 capitalize">
                        <span className="px-2 py-0.5 bg-slate-800 rounded text-[11px] font-semibold text-slate-300">
                          {acc.role.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="p-3.5 text-center">
                        {acc.applicationAccess?.app_franchise_management ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">GRANTED</span>
                        ) : (
                          <span className="text-slate-600 text-xs">✕</span>
                        )}
                      </td>
                      <td className="p-3.5 text-center">
                        {acc.applicationAccess?.app_restaurant_management ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">GRANTED</span>
                        ) : (
                          <span className="text-slate-600 text-xs">✕</span>
                        )}
                      </td>
                      <td className="p-3.5 text-center">
                        {acc.applicationAccess?.app_pos ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">GRANTED</span>
                        ) : (
                          <span className="text-slate-600 text-xs">✕</span>
                        )}
                      </td>
                      <td className="p-3.5 text-center">
                        {acc.applicationAccess?.app_delivery ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-500/20 text-sky-400 border border-sky-500/30">GRANTED</span>
                        ) : (
                          <span className="text-slate-600 text-xs">✕</span>
                        )}
                      </td>
                      <td className="p-3.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          acc.accountStatus === 'ACTIVE' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                        }`}>
                          {acc.accountStatus || 'ACTIVE'}
                        </span>
                      </td>
                      <td className="p-3.5 text-right">
                        <button
                          onClick={() => handleOpenEditAccess(acc)}
                          className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-black rounded-lg font-bold text-xs transition"
                        >
                          Edit Access
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─── 4. TAB: OVERVIEW & DASHBOARD ─────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
              <p className="text-[11px] text-slate-400 font-semibold uppercase">Today's Sales</p>
              <h3 className="text-xl font-bold text-amber-400 mt-1 font-mono">
                ₹{(dashboardMetrics?.todaySales || 24590).toLocaleString('en-IN')}
              </h3>
              <p className="text-[10px] text-slate-500 mt-1">POS: ₹{(dashboardMetrics?.posSales || 14800).toLocaleString('en-IN')}</p>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
              <p className="text-[11px] text-slate-400 font-semibold uppercase">Total Orders</p>
              <h3 className="text-xl font-bold text-white mt-1 font-mono">
                {dashboardMetrics?.totalOrders || 38}
              </h3>
              <p className="text-[10px] text-emerald-400 mt-1">Avg: ₹{dashboardMetrics?.avgOrderValue || 420}</p>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
              <p className="text-[11px] text-slate-400 font-semibold uppercase">Active Queue</p>
              <h3 className="text-xl font-bold text-amber-500 mt-1 font-mono">
                {liveOrders.length || dashboardMetrics?.activeOrders || 4}
              </h3>
              <p className="text-[10px] text-amber-400 mt-1">Live in Kitchen</p>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
              <p className="text-[11px] text-slate-400 font-semibold uppercase">Active Branches</p>
              <h3 className="text-xl font-bold text-white mt-1 font-mono">
                {branches.length}
              </h3>
              <p className="text-[10px] text-slate-500 mt-1">{franchise.city} Region</p>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
              <p className="text-[11px] text-slate-400 font-semibold uppercase">POS Terminals</p>
              <h3 className="text-xl font-bold text-emerald-400 mt-1 font-mono">
                {posTerminals.filter((t) => t.isActive).length}
              </h3>
              <p className="text-[10px] text-emerald-400/80 mt-1">Billing Active</p>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
              <p className="text-[11px] text-slate-400 font-semibold uppercase">Delivery Riders</p>
              <h3 className="text-xl font-bold text-sky-400 mt-1 font-mono">
                {riders.length || 3}
              </h3>
              <p className="text-[10px] text-sky-400/80 mt-1">Fleet Ready</p>
            </div>
          </div>
        </div>
      )}

      {/* ─── 5. TAB: POS MANAGEMENT (WITH PROVIDE POS) ────────────────────────── */}
      {activeTab === 'pos' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white">POS Terminal Provisioning & Control ({posTerminals.length})</h3>
              <p className="text-xs text-slate-400">On-demand terminal creation with secure 6-digit activation codes</p>
            </div>
            <button
              onClick={() => setShowProvidePosModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-black rounded-xl text-xs font-bold transition shadow-lg shadow-amber-500/20"
            >
              <Plus className="w-4 h-4" /> + Provide POS
            </button>
          </div>

          {posTerminals.length === 0 ? (
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-8 text-center max-w-lg mx-auto space-y-3">
              <Monitor className="w-10 h-10 mx-auto text-slate-600" />
              <h4 className="text-sm font-bold text-white">No POS Terminals Provided Yet</h4>
              <p className="text-xs text-slate-400">
                This franchise currently operates without in-store POS billing. When ready, the Owner can provide POS terminals on demand.
              </p>
              <button
                onClick={() => setShowProvidePosModal(true)}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-black rounded-xl text-xs font-bold transition"
              >
                + Provide POS Now
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {posTerminals.map((t) => (
                <div key={t.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 shadow-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-bold text-white">{t.terminalName}</span>
                      <p className="text-[10px] text-slate-400 font-mono">{t.id}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      t.isActive ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'
                    }`}>
                      {t.activationStatus || (t.isActive ? 'ACTIVATED' : 'REVOKED')}
                    </span>
                  </div>

                  <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
                    <span className="text-slate-400">Activation Code:</span>
                    <span className="text-amber-400 font-mono font-bold text-sm tracking-widest">{t.activationCode || '741852'}</span>
                  </div>

                  <div className="flex justify-between items-center text-[11px] text-slate-400 pt-1">
                    <span>Branch: {t.branchName || t.branchId}</span>
                    {t.isActive ? (
                      <button
                        onClick={() => handleRevokePos(t.id)}
                        className="px-2.5 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded text-[10px] font-semibold transition"
                      >
                        Revoke Access
                      </button>
                    ) : (
                      <span className="text-red-400 text-[10px] font-semibold">Access Revoked</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── 6. TAB: BRANCHES & RESTAURANTS ───────────────────────────────────── */}
      {activeTab === 'branches' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">Franchise Restaurants & Branches ({branches.length})</h3>
            <button
              onClick={() => setShowAddBranchModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-black rounded-xl text-xs font-bold transition"
            >
              <Plus className="w-4 h-4" /> Add Branch
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {branches.map((b) => (
              <div key={b.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-white">{b.name}</span>
                  <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded text-[10px] font-mono font-bold">
                    {b.code}
                  </span>
                </div>
                <p className="text-xs text-slate-400 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  {b.address || `${b.city}, Chhattisgarh`}
                </p>
                <div className="grid grid-cols-2 gap-2 text-xs text-slate-300 pt-2 border-t border-slate-800">
                  <div>
                    <span className="text-slate-500 text-[10px] block">Hours</span>
                    <span>{b.openingTime || '12:00'} - {b.closingTime || '23:59'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px] block">Delivery Radius</span>
                    <span>{b.maxDeliveryRadiusKm || 12} km</span>
                  </div>
                </div>
                <div className="pt-2 flex items-center gap-2">
                  <button
                    onClick={() => navigate(`/franchise-management/${currentSlug}/restaurants/${b.id}`)}
                    className="flex-1 py-1.5 bg-amber-500 hover:bg-amber-600 text-black rounded-xl text-xs font-bold transition flex items-center justify-center gap-1"
                  >
                    <Settings className="w-3.5 h-3.5" /> Manage Restaurant Control
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── MODAL: EDIT ACCESS ───────────────────────────────────────────────── */}
      {showEditAccessModal && selectedAccountForAccess && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">Edit Application Access</h3>
                <p className="text-xs text-amber-400 font-mono">{selectedAccountForAccess.name} ({selectedAccountForAccess.email})</p>
              </div>
              <button onClick={() => setShowEditAccessModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleSaveAccessChanges} className="space-y-4 text-xs">
              <div className="space-y-2">
                <label className="text-slate-400 block font-semibold">Application Grants</label>
                
                {/* Franchise App */}
                <label className="flex items-center justify-between p-3 rounded-xl border border-slate-800 bg-slate-950/60 cursor-pointer">
                  <div>
                    <span className="font-semibold text-white block">Franchise Management App</span>
                    <span className="text-[10px] text-slate-400">olive-pizza-franchise (Port 5175)</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={accessForm.app_franchise_management}
                    onChange={(e) => setAccessForm({ ...accessForm, app_franchise_management: e.target.checked })}
                    className="w-4 h-4 accent-amber-500 cursor-pointer"
                  />
                </label>

                {/* Restaurant App */}
                <label className="flex items-center justify-between p-3 rounded-xl border border-slate-800 bg-slate-950/60 cursor-pointer">
                  <div>
                    <span className="font-semibold text-white block">Restaurant Management App</span>
                    <span className="text-[10px] text-slate-400">Olive Pizza restaurant manager (Port 5176)</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={accessForm.app_restaurant_management}
                    onChange={(e) => setAccessForm({ ...accessForm, app_restaurant_management: e.target.checked })}
                    className="w-4 h-4 accent-amber-500 cursor-pointer"
                  />
                </label>

                {/* POS App */}
                <label className="flex items-center justify-between p-3 rounded-xl border border-slate-800 bg-slate-950/60 cursor-pointer">
                  <div>
                    <span className="font-semibold text-white block">POS Billing Terminal</span>
                    <span className="text-[10px] text-slate-400">olive-pizza-pos (Port 5178)</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={accessForm.app_pos}
                    onChange={(e) => setAccessForm({ ...accessForm, app_pos: e.target.checked })}
                    className="w-4 h-4 accent-amber-500 cursor-pointer"
                  />
                </label>

                {/* Delivery App */}
                <label className="flex items-center justify-between p-3 rounded-xl border border-slate-800 bg-slate-950/60 cursor-pointer">
                  <div>
                    <span className="font-semibold text-white block">Delivery Partner App</span>
                    <span className="text-[10px] text-slate-400">olive-pizza-delivery (Port 5177)</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={accessForm.app_delivery}
                    onChange={(e) => setAccessForm({ ...accessForm, app_delivery: e.target.checked })}
                    className="w-4 h-4 accent-amber-500 cursor-pointer"
                  />
                </label>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Account Status</label>
                <select
                  value={accessForm.accountStatus}
                  onChange={(e) => setAccessForm({ ...accessForm, accountStatus: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="SUSPENDED">SUSPENDED</option>
                  <option value="REVOKED">REVOKED</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button type="button" onClick={() => setShowEditAccessModal(false)} className="px-4 py-2 bg-slate-800 text-white rounded-xl">Cancel</button>
                <button type="submit" disabled={actionLoading} className="px-4 py-2 bg-amber-500 font-bold text-black rounded-xl">
                  {actionLoading ? 'Saving...' : 'Save Access Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: PROVIDE POS WIZARD ────────────────────────────────────────── */}
      {showProvidePosModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">Provide POS to Franchise</h3>
                <p className="text-xs text-slate-400">On-demand POS provisioning with instant 6-digit activation code</p>
              </div>
              <button onClick={() => setShowProvidePosModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleProvidePos} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Step 1: Select Target Branch</label>
                <select
                  value={providePosData.branchId}
                  onChange={(e) => setProvidePosData({ ...providePosData, branchId: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Step 2: Terminal Label / Counter Name</label>
                <input
                  type="text"
                  required
                  value={providePosData.terminalName}
                  onChange={(e) => setProvidePosData({ ...providePosData, terminalName: e.target.value })}
                  placeholder="e.g. Counter 1 — Billing Terminal"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Step 3: Number of Terminals</label>
                <select
                  value={providePosData.posTerminalCount}
                  onChange={(e) => setProvidePosData({ ...providePosData, posTerminalCount: Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono"
                >
                  <option value={1}>1 Terminal</option>
                  <option value={2}>2 Terminals</option>
                  <option value={3}>3 Terminals</option>
                </select>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Step 4: Assign POS Cashier / Staff (Optional)</label>
                <select
                  value={providePosData.assignedUserId}
                  onChange={(e) => setProvidePosData({ ...providePosData, assignedUserId: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                >
                  <option value="">-- Auto-generate terminal for branch --</option>
                  {accessAccounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>{acc.name} ({acc.role})</option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button type="button" onClick={() => setShowProvidePosModal(false)} className="px-4 py-2 bg-slate-800 text-white rounded-xl">Cancel</button>
                <button type="submit" disabled={actionLoading} className="px-4 py-2 bg-amber-500 font-bold text-black rounded-xl">
                  {actionLoading ? 'Provisioning...' : 'Provision & Generate Code'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
