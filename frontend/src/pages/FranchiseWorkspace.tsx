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
  ShieldAlert,
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
  Smartphone,
  ChevronLeft,
  Activity,
  BarChart3,
  PieChart,
  UtensilsCrossed,
  ArrowRight,
  Download,
  Eye,
  Trash2
} from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import { fetchApi } from '../lib/api';
import toast from 'react-hot-toast';
import { PdfViewerModal } from '../components/common/PdfViewerModal';

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
  const [posAccounts, setPosAccounts] = useState<any[]>([]);
  const [pendingPosRequests, setPendingPosRequests] = useState<any[]>([]);
  const [pendingPasswordResets, setPendingPasswordResets] = useState<any[]>([]);
  const [liveOrders, setLiveOrders] = useState<any[]>([]);
  const [historicalOrders, setHistoricalOrders] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [reportsData, setReportsData] = useState<any>(null);
  const [monthlyPdfReports, setMonthlyPdfReports] = useState<any[]>([]);
  const [reportsLoading, setReportsLoading] = useState<boolean>(false);
  const [generatingCustomPdf, setGeneratingCustomPdf] = useState<boolean>(false);
  const [customTimeRange, setCustomTimeRange] = useState<string>('Ongoing Month');
  const [pdfModal, setPdfModal] = useState<{
    isOpen: boolean;
    title: string;
    pdfUrl: string;
    downloadUrl?: string;
    subtitle?: string;
  }>({
    isOpen: false,
    title: '',
    pdfUrl: '',
  });

  const openPdfViewer = (title: string, pdfUrl: string, downloadUrl?: string, subtitle?: string) => {
    setPdfModal({
      isOpen: true,
      title,
      pdfUrl,
      downloadUrl: downloadUrl || `${pdfUrl}?download=true`,
      subtitle,
    });
  };

  const [accessAccounts, setAccessAccounts] = useState<any[]>([]);
  const [pendingManagers, setPendingManagers] = useState<any[]>([]);

  // Modals
  const [showAddBranchModal, setShowAddBranchModal] = useState<boolean>(false);
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

  // Rider management modals and form
  const [showAddRiderModal, setShowAddRiderModal] = useState<boolean>(false);
  const [showEditRiderModal, setShowEditRiderModal] = useState<boolean>(false);
  const [selectedRider, setSelectedRider] = useState<any>(null);
  const [riderForm, setRiderForm] = useState({
    name: '',
    phone: '',
    email: '',
    branchId: '',
    vehicleNumber: '',
    vehicleType: 'Bike'
  });

  const handleOpenAddRider = () => {
    setRiderForm({
      name: '',
      phone: '',
      email: '',
      branchId: branches[0]?.id || 'main_branch',
      vehicleNumber: '',
      vehicleType: 'Bike'
    });
    setShowAddRiderModal(true);
  };

  const handleOpenEditRider = (r: any) => {
    setSelectedRider(r);
    setRiderForm({
      name: r.name || '',
      phone: r.phone || r.phoneNumber || '',
      email: r.email || '',
      branchId: r.branchId || branches[0]?.id || 'main_branch',
      vehicleNumber: r.vehicleNumber || '',
      vehicleType: r.vehicleType || 'Bike'
    });
    setShowEditRiderModal(true);
  };

  const handleCreateRider = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!franchise?.id) return;
    if (!riderForm.name.trim() || !riderForm.phone.trim()) {
      toast.error('Rider name and phone number are required');
      return;
    }
    setActionLoading(true);
    try {
      const res = await fetchApi(`/api/franchises/${franchise.id}/riders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(riderForm)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to onboard rider');
      toast.success(`Rider ${riderForm.name} onboarded successfully!`);
      setShowAddRiderModal(false);
      const rRes = await fetchApi(`/api/franchises/${franchise.id}/riders`);
      const rData = await rRes.json();
      if (Array.isArray(rData.riders)) setRiders(rData.riders);
    } catch (err: any) {
      toast.error(err.message || 'Failed to onboard rider');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateRider = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!franchise?.id || !selectedRider?.id) return;
    setActionLoading(true);
    try {
      const res = await fetchApi(`/api/franchises/${franchise.id}/riders/${selectedRider.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(riderForm)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update rider');
      toast.success('Rider details updated successfully!');
      setShowEditRiderModal(false);
      const rRes = await fetchApi(`/api/franchises/${franchise.id}/riders`);
      const rData = await rRes.json();
      if (Array.isArray(rData.riders)) setRiders(rData.riders);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update rider');
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleRiderStatus = async (r: any) => {
    if (!franchise?.id) return;
    const isCurrentlyActive = r.isActive !== false && r.status !== 'INACTIVE' && r.status !== 'REVOKED';
    const newActive = !isCurrentlyActive;
    const actionLabel = newActive ? 'Reinstate' : 'Suspend';
    if (!confirm(`Are you sure you want to ${actionLabel} ${r.name}?`)) return;
    setActionLoading(true);
    try {
      const res = await fetchApi(`/api/franchises/${franchise.id}/riders/${r.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: newActive })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed to ${actionLabel} rider`);
      toast.success(`Rider ${r.name} ${newActive ? 'reinstated' : 'suspended & session revoked'}!`);
      const rRes = await fetchApi(`/api/franchises/${franchise.id}/riders`);
      const rData = await rRes.json();
      if (Array.isArray(rData.riders)) setRiders(rData.riders);
    } catch (err: any) {
      toast.error(err.message || `Failed to ${actionLabel} rider`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteRider = async (r: any) => {
    if (!franchise?.id) return;
    if (!confirm(`Permanently remove rider ${r.name}? Their login tokens will be immediately revoked.`)) return;
    setActionLoading(true);
    try {
      const res = await fetchApi(`/api/franchises/${franchise.id}/riders/${r.id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete rider');
      toast.success(`Rider ${r.name} deleted and revoked`);
      const rRes = await fetchApi(`/api/franchises/${franchise.id}/riders`);
      const rData = await rRes.json();
      if (Array.isArray(rData.riders)) setRiders(rData.riders);
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete rider');
    } finally {
      setActionLoading(false);
    }
  };

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

      // 5. Fetch POS Accounts & Legacy Terminals
      fetchApi(`/api/franchises/${fId}/pos-accounts`)
        .then(async (r) => (r.ok ? r.json() : {}))
        .then((d) => setPosAccounts(Array.isArray(d.accounts) ? d.accounts : []))
        .catch(() => {});

      fetchApi('/api/auth/password-reset/pending')
        .then(async (r) => (r.ok ? r.json() : {}))
        .then((d) => setPendingPasswordResets(Array.isArray(d.requests) ? d.requests : []))
        .catch(() => {});

      fetchApi('/api/franchises/pos-requests')
        .then(async (r) => (r.ok ? r.json() : {}))
        .then((d) => setPendingPosRequests(Array.isArray(d.requests) ? d.requests : []))
        .catch(() => {});

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

      // 8. Fetch Pending Restaurant Managers for Owner Approval Queue
      fetchApi(`/api/franchises/${fId}/restaurant-managers/pending`)
        .then(async (r) => (r.ok ? r.json() : {}))
        .then((d) => setPendingManagers(Array.isArray(d.pending) ? d.pending : []))
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
  }, [currentSlug]);

  // Fast targeted refresh for branch filter change without reloading the whole workspace
  useEffect(() => {
    if (!franchise?.id) return;
    fetchApi(`/api/franchises/${franchise.id}/dashboard?branchId=${selectedBranchFilter}`)
      .then(async (res) => (res.ok ? res.json() : {}))
      .then((dashData) => setDashboardMetrics(dashData.dashboard || null))
      .catch(() => {});
  }, [selectedBranchFilter, franchise?.id]);

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

  // Sync URL search params tab to activeTab state
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  // Tab horizontal scroll ref & helper
  const tabsContainerRef = React.useRef<HTMLDivElement>(null);
  const scrollTabs = (direction: 'left' | 'right') => {
    if (tabsContainerRef.current) {
      const offset = direction === 'left' ? -220 : 220;
      tabsContainerRef.current.scrollBy({ left: offset, behavior: 'smooth' });
    }
  };

  // Canonical franchises list for context switcher
  const canonicalFranchises = useMemo(() => {
    return allFranchises.map((f) => ({
      ...f,
      name: f.name || 'Olive Pizza'
    }));
  }, [allFranchises]);

  const cleanFranchiseName = useMemo(() => {
    return franchise?.name || 'Olive Pizza';
  }, [franchise]);

  // Load All-Time Monthly Reports for this Franchise & Branch
  useEffect(() => {
    if (!franchise?.id) return;
    setReportsLoading(true);
    const branchQuery = selectedBranchFilter !== 'all' ? `&branchId=${encodeURIComponent(selectedBranchFilter)}` : '';
    fetchApi(`/api/reports/monthly?franchiseId=${encodeURIComponent(franchise.id)}${branchQuery}`)
      .then(async (r) => (r.ok ? r.json() : {}))
      .then((d) => {
        if (Array.isArray(d)) setMonthlyPdfReports(d);
        else if (Array.isArray(d.reports)) setMonthlyPdfReports(d.reports);
      })
      .catch((e) => console.warn('[FranchiseWorkspace] PDF reports load fallback:', e))
      .finally(() => setReportsLoading(false));
  }, [franchise?.id, selectedBranchFilter]);

  const handleGenerateFranchiseCustomPdf = async (timeRange: string, action: 'preview' | 'download' = 'preview') => {
    if (!franchise) return;
    setGeneratingCustomPdf(true);
    const toastId = toast.loading(`Generating ${timeRange} audit PDF for ${cleanFranchiseName}...`);
    try {
      const targetBranchId = selectedBranchFilter !== 'all' ? selectedBranchFilter : (branches[0]?.id || 'main_branch');
      const targetBranchName = selectedBranchFilter !== 'all'
        ? (branches.find((b) => b.id === selectedBranchFilter)?.name || selectedBranchFilter)
        : `${cleanFranchiseName} — Consolidated`;

      const res = await fetchApi('/api/reports/generate-custom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          timeRange,
          branchId: targetBranchId,
          branchName: targetBranchName,
          franchiseId: franchise.id,
          franchiseName: cleanFranchiseName,
        }),
      });
      const data = await res.json();
      if (data.success && data.report) {
        toast.success(`Custom ${timeRange} PDF ready!`, { id: toastId });
        const viewUrl = data.report.viewUrl || data.report.pdfUrl;
        const downloadUrl = data.report.downloadUrl || `${viewUrl}?download=true`;

        if (action === 'download') {
          const a = document.createElement('a');
          a.href = downloadUrl;
          a.download = `OlivePizza_${cleanFranchiseName.replace(/\s+/g, '_')}_${timeRange.replace(/\s+/g, '_')}.pdf`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        } else {
          openPdfViewer(
            `Custom Statement — ${timeRange}`,
            viewUrl,
            downloadUrl,
            `${cleanFranchiseName} • ${targetBranchName} • Owner Unlimited Access`
          );
        }

        // Refresh monthly list
        const branchQuery = selectedBranchFilter !== 'all' ? `&branchId=${encodeURIComponent(selectedBranchFilter)}` : '';
        fetchApi(`/api/reports/monthly?franchiseId=${encodeURIComponent(franchise.id)}${branchQuery}`)
          .then(async (r) => (r.ok ? r.json() : {}))
          .then((d) => {
            if (Array.isArray(d)) setMonthlyPdfReports(d);
            else if (Array.isArray(d.reports)) setMonthlyPdfReports(d.reports);
          });
      } else {
        toast.error(data.error || 'Failed to generate custom report', { id: toastId });
      }
    } catch (err: any) {
      toast.error('Failed to generate PDF: ' + err.message, { id: toastId });
    } finally {
      setGeneratingCustomPdf(false);
    }
  };

  // State for Live Dashboard Stream filters
  const [liveStreamFilter, setLiveStreamFilter] = useState<'all' | 'active' | 'preparing' | 'ready' | 'delivery' | 'completed'>('all');
  const [liveStreamSearch, setLiveStreamSearch] = useState<string>('');

  // Real-time Today's Orders & Operational Metrics for this Franchise
  const isToday = (dateVal: any) => {
    if (!dateVal) return false;
    const d = new Date(dateVal?.toDate ? dateVal.toDate() : dateVal);
    const now = new Date();
    return (
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear()
    );
  };

  const todayOrders = useMemo(() => {
    const all = [...liveOrders, ...historicalOrders];
    return all.filter((o) => isToday(o.createdAt));
  }, [liveOrders, historicalOrders]);

  const liveStats = useMemo(() => {
    const totalTodayRevenue = todayOrders.reduce((sum, o) => sum + (Number(o.totalAmount || o.total || 0)), 0);
    const onlineRevenue = todayOrders
      .filter((o) => (o.orderSource || 'online').toLowerCase() !== 'pos')
      .reduce((sum, o) => sum + (Number(o.totalAmount || o.total || 0)), 0);
    const posRevenue = todayOrders
      .filter((o) => (o.orderSource || '').toLowerCase() === 'pos')
      .reduce((sum, o) => sum + (Number(o.totalAmount || o.total || 0)), 0);
    const takeawayRevenue = todayOrders
      .filter((o) => ['takeaway', 'pickup'].includes((o.deliveryType || o.fulfillmentType || '').toLowerCase()))
      .reduce((sum, o) => sum + (Number(o.totalAmount || o.total || 0)), 0);

    const completedToday = todayOrders.filter((o) => ['delivered', 'completed'].includes((o.status || '').toLowerCase()));
    const cancelledToday = todayOrders.filter((o) => ['cancelled', 'rejected'].includes((o.status || '').toLowerCase()));

    // Active pipeline
    const pendingOrders = liveOrders.filter((o) => (o.status || '').toLowerCase() === 'pending');
    const preparingOrders = liveOrders.filter((o) => ['accepted', 'preparing'].includes((o.status || '').toLowerCase()));
    const readyOrders = liveOrders.filter((o) => ['ready', 'partner_assigned'].includes((o.status || '').toLowerCase()));
    const dispatchOrders = liveOrders.filter((o) => ['picked_up', 'out_for_delivery'].includes((o.status || '').toLowerCase()));

    const aov = todayOrders.length > 0 ? Math.round(totalTodayRevenue / todayOrders.length) : 0;

    // Hourly Breakdown (Today 00:00 to 23:00)
    const hourlySales: { [hour: number]: { count: number; revenue: number } } = {};
    for (let h = 0; h < 24; h++) {
      hourlySales[h] = { count: 0, revenue: 0 };
    }
    todayOrders.forEach((o) => {
      const d = new Date(o.createdAt?.toDate ? o.createdAt.toDate() : o.createdAt || Date.now());
      const h = d.getHours();
      if (hourlySales[h]) {
        hourlySales[h].count += 1;
        hourlySales[h].revenue += Number(o.totalAmount || o.total || 0);
      }
    });

    // Top Selling Items Today
    const itemMap: { [key: string]: { name: string; count: number; revenue: number } } = {};
    todayOrders.forEach((o) => {
      if (Array.isArray(o.items)) {
        o.items.forEach((it: any) => {
          const name = it.name || it.title || 'Special Pizza';
          const qty = Number(it.quantity || 1);
          const price = Number(it.price || 0) * qty;
          if (!itemMap[name]) itemMap[name] = { name, count: 0, revenue: 0 };
          itemMap[name].count += qty;
          itemMap[name].revenue += price;
        });
      }
    });
    const topItems = Object.values(itemMap).sort((a, b) => b.count - a.count).slice(0, 6);

    return {
      totalTodayRevenue,
      onlineRevenue,
      posRevenue,
      takeawayRevenue,
      todayOrdersCount: todayOrders.length,
      completedTodayCount: completedToday.length,
      cancelledTodayCount: cancelledToday.length,
      pendingOrders,
      preparingOrders,
      readyOrders,
      dispatchOrders,
      aov,
      hourlySales,
      topItems
    };
  }, [todayOrders, liveOrders]);

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

  // Handler: Approve POS Account
  const handleApprovePosAccount = async (posId: string) => {
    if (!franchise) return;
    setActionLoading(true);
    try {
      const res = await fetchApi(`/api/franchises/${franchise.id}/pos-accounts/${posId}/approve`, {
        method: 'PUT'
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to approve POS account');
      toast.success('POS account verified and approved!');
      loadFranchiseWorkspace();
    } catch (err: any) {
      toast.error(err.message || 'Approval failed');
    } finally {
      setActionLoading(false);
    }
  };

  // Handler: Reject POS Account
  const handleRejectPosAccount = async (posId: string) => {
    if (!franchise) return;
    const reason = window.prompt('Enter reason for rejecting this POS account (optional):') || 'Rejected by Store Owner';
    setActionLoading(true);
    try {
      const res = await fetchApi(`/api/franchises/${franchise.id}/pos-accounts/${posId}/reject`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reject POS account');
      toast.success('POS account rejected');
      loadFranchiseWorkspace();
    } catch (err: any) {
      toast.error(err.message || 'Rejection failed');
    } finally {
      setActionLoading(false);
    }
  };

  // Handler: Revoke POS Account
  const handleRevokePosAccount = async (posId: string) => {
    if (!franchise) return;
    if (!window.confirm('Are you sure you want to revoke access for this POS account? Billing will be disabled immediately.')) return;
    setActionLoading(true);
    try {
      const res = await fetchApi(`/api/franchises/${franchise.id}/pos-accounts/${posId}/revoke`, {
        method: 'PUT'
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to revoke POS account');
      toast.success('POS account access revoked');
      loadFranchiseWorkspace();
    } catch (err: any) {
      toast.error(err.message || 'Revocation failed');
    } finally {
      setActionLoading(false);
    }
  };

  // Handler: Approve POS Request
  const handleApprovePosRequest = async (reqId: string) => {
    setActionLoading(true);
    try {
      const res = await fetchApi(`/api/franchises/pos-request/${reqId}/approve`, {
        method: 'PUT'
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to approve POS request');
      toast.success('POS Access request approved!');
      loadFranchiseWorkspace();
    } catch (err: any) {
      toast.error(err.message || 'Approval failed');
    } finally {
      setActionLoading(false);
    }
  };

  // Handler: Reject POS Request
  const handleRejectPosRequest = async (reqId: string) => {
    const reason = window.prompt('Enter reason for rejecting this POS request (optional):') || 'Rejected by Store Owner';
    setActionLoading(true);
    try {
      const res = await fetchApi(`/api/franchises/pos-request/${reqId}/reject`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reject POS request');
      toast.success('POS Access request rejected');
      loadFranchiseWorkspace();
    } catch (err: any) {
      toast.error(err.message || 'Rejection failed');
    } finally {
      setActionLoading(false);
    }
  };

  // Handler: Send Password Reset Email for POS
  const handleSendResetEmail = async (requestId: string) => {
    setActionLoading(true);
    try {
      const res = await fetchApi('/api/auth/password-reset/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to send reset email');
      toast.success(data.message || 'Password reset link sent to operator email!');
      loadFranchiseWorkspace();
    } catch (err: any) {
      toast.error(err.message || 'Reset dispatch failed');
    } finally {
      setActionLoading(false);
    }
  };

  // Handler: Reject Password Reset
  const handleRejectReset = async (requestId: string) => {
    setActionLoading(true);
    try {
      const res = await fetchApi('/api/auth/password-reset/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, reason: 'Rejected by Store Owner' })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to reject reset');
      toast.success('Password reset request rejected');
      loadFranchiseWorkspace();
    } catch (err: any) {
      toast.error(err.message || 'Reject failed');
    } finally {
      setActionLoading(false);
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

  // Handler: Approve Restaurant Manager (Owner Gate)
  const handleApproveManager = async (managerId: string) => {
    if (!franchise) return;
    setActionLoading(true);
    try {
      const res = await fetchApi(`/api/franchises/${franchise.id}/restaurant-managers/${managerId}/approve`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to approve manager');

      toast.success('Restaurant Manager approved successfully! Account is now active.');
      loadFranchiseWorkspace();
    } catch (err: any) {
      toast.error(err.message || 'Approval failed');
    } finally {
      setActionLoading(false);
    }
  };

  // Handler: Reject Restaurant Manager (Owner Gate)
  const handleRejectManager = async (managerId: string) => {
    if (!franchise) return;
    const reason = window.prompt('Enter rejection reason (optional):') || 'Owner discretion';
    setActionLoading(true);
    try {
      const res = await fetchApi(`/api/franchises/${franchise.id}/restaurant-managers/${managerId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rejectionReason: reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reject manager');

      toast.success('Restaurant Manager application rejected.');
      loadFranchiseWorkspace();
    } catch (err: any) {
      toast.error(err.message || 'Rejection failed');
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
    <div className="w-full max-w-full overflow-x-hidden min-h-screen pb-20 space-y-6">
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
              <h1 className="text-lg font-bold text-white tracking-tight">{cleanFranchiseName}</h1>
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
          {/* Quick Action: Live Dashboard */}
          <button
            onClick={() => setActiveTab('live-dashboard')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
            </span>
            <span>Live Reports</span>
          </button>

          {/* Quick Action: Edit Access */}
          <button
            onClick={() => setActiveTab('access')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 rounded-xl text-xs font-bold transition shadow-sm"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Edit Access</span>
          </button>

          {/* Franchise Context Switcher (Single Rajnandgaon Franchise) */}
          <div className="flex items-center gap-1.5 bg-slate-950/80 border border-slate-700/60 rounded-xl px-3 py-1.5 shadow-inner">
            <span className="text-[10px] text-slate-400 font-semibold uppercase">Franchise:</span>
            <select
              value={currentSlug}
              onChange={(e) => handleSwitchFranchise(e.target.value)}
              className="bg-transparent text-amber-400 text-xs font-bold font-mono focus:outline-none cursor-pointer"
            >
              {canonicalFranchises.map((f) => (
                <option key={f.id} value={f.slug || f.id.replace('fra_', '')} className="bg-slate-900 text-white">
                  {f.name} ({f.code})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ─── 2. TAB NAVIGATION (SMOOTH HORIZONTAL SCROLL) ────────────────────────── */}
      <div className="relative w-full border-b border-slate-800 pb-2">
        <div className="flex items-center justify-between gap-2 mb-1.5 px-0.5">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-amber-500" />
              <span>Workspace Modules</span>
            </span>
            <span className="text-[10px] text-slate-500 font-medium hidden sm:inline">• Horizontal scrollable</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => scrollTabs('left')}
              className="p-1.5 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-slate-300 hover:text-white transition shadow-sm"
              title="Scroll tabs left"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => scrollTabs('right')}
              className="p-1.5 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-slate-300 hover:text-white transition shadow-sm"
              title="Scroll tabs right"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div
          ref={tabsContainerRef}
          className="flex items-center gap-1.5 overflow-x-auto scrollbar-thin scrollbar-thumb-amber-500/40 scrollbar-track-slate-900/60 pb-2 text-xs font-semibold select-none flex-nowrap"
          style={{ WebkitOverflowScrolling: 'touch', scrollBehavior: 'smooth' }}
        >
          {[
            { id: 'live-dashboard', label: 'Live Dashboard & Reports', icon: Activity, isLivePill: true },
            { id: 'overview', label: 'Overview & Summary', icon: TrendingUp },
            { id: 'approvals', label: `Manager Approvals (${pendingManagers.length})`, icon: CheckCircle2, badge: pendingManagers.length > 0 ? pendingManagers.length : null },
            { id: 'access', label: `Access Control (${accessAccounts.length})`, icon: ShieldCheck },
            { id: 'live-orders', label: `Live Kitchen (${liveOrders.length})`, icon: Flame, badge: liveOrders.length > 0 ? liveOrders.length : null },
            { id: 'orders', label: `Orders History (${historicalOrders.length})`, icon: History },
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
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition whitespace-nowrap shrink-0 cursor-pointer ${
                  isActive
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-lg shadow-amber-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60 border border-transparent hover:border-slate-700'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
                {tab.isLivePill && (
                  <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-rose-500 text-white font-mono text-[9px] font-black uppercase tracking-wider animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping"></span>
                    <span>LIVE</span>
                  </span>
                )}
                {tab.badge && (
                  <span className="px-1.5 py-0.2 bg-red-600 text-white rounded-full text-[10px] animate-pulse">
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── 2.1 TAB: LIVE REPORTS DASHBOARD (SCOPED FRANCHISE LIVE OBSERVABILITY) ── */}
      {activeTab === 'live-dashboard' && (
        <div className="space-y-6">
          {/* Top Live Telemetry Bar */}
          <div className="bg-gradient-to-r from-rose-950/40 via-slate-900 to-amber-950/20 border border-rose-500/30 rounded-2xl p-4 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
                <Activity className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-400 text-[10px] font-mono font-black uppercase tracking-wider">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping"></span>
                    LIVE REALTIME STREAM
                  </span>
                  <span className="text-xs font-bold text-slate-400 hidden sm:inline">•</span>
                  <span className="text-xs text-white font-semibold">
                    {cleanFranchiseName}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
                  <span>Firestore realtime listener active</span>
                  <span>•</span>
                  <span className="text-emerald-400 font-medium">⚡ Zero-latency sync</span>
                  <span>•</span>
                  <span>{new Date().toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</span>
                </p>
              </div>
            </div>

            {/* Filter & Refresh */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 bg-slate-950/80 border border-slate-700/60 rounded-xl px-3 py-1.5 text-xs">
                <Filter className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-[10px] text-slate-400 font-semibold uppercase">Branch:</span>
                <select
                  value={selectedBranchFilter}
                  onChange={(e) => setSelectedBranchFilter(e.target.value)}
                  className="bg-transparent text-amber-300 font-bold focus:outline-none cursor-pointer text-xs"
                >
                  <option value="all" className="bg-slate-900 text-white">All Branches ({branches.length})</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id} className="bg-slate-900 text-white">{b.name}</option>
                  ))}
                </select>
              </div>

              <button
                onClick={() => loadFranchiseWorkspace()}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition border border-slate-700 cursor-pointer"
                title="Refresh Live Data"
              >
                <RefreshCw className="w-3.5 h-3.5 text-rose-400" />
                <span>Sync Now</span>
              </button>
            </div>
          </div>

          {/* 6 Hero Operational Live Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* 1. Today's Revenue */}
            <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-4 relative overflow-hidden shadow-lg">
              <div className="absolute top-0 right-0 w-16 h-16 bg-amber-500/5 rounded-full blur-xl pointer-events-none"></div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Today's Live Revenue</p>
              <h3 className="text-xl sm:text-2xl font-black text-amber-400 mt-1 font-mono tracking-tight">
                ₹{liveStats.totalTodayRevenue.toLocaleString('en-IN')}
              </h3>
              <div className="mt-2 text-[10px] space-y-0.5 text-slate-400 border-t border-slate-800/60 pt-1.5 font-mono">
                <div className="flex justify-between">
                  <span>Delivery:</span>
                  <span className="text-white font-semibold">₹{liveStats.onlineRevenue.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between">
                  <span>POS / Counter:</span>
                  <span className="text-emerald-400 font-semibold">₹{liveStats.posRevenue.toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>

            {/* 2. Today's Total Orders */}
            <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-4 relative overflow-hidden shadow-lg">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Today's Orders</p>
              <h3 className="text-xl sm:text-2xl font-black text-white mt-1 font-mono tracking-tight">
                {liveStats.todayOrdersCount}
              </h3>
              <div className="mt-2 text-[10px] space-y-0.5 text-slate-400 border-t border-slate-800/60 pt-1.5 font-mono">
                <div className="flex justify-between">
                  <span className="text-emerald-400">Delivered:</span>
                  <span className="text-emerald-400 font-semibold">{liveStats.completedTodayCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-rose-400">Cancelled:</span>
                  <span className="text-rose-400 font-semibold">{liveStats.cancelledTodayCount}</span>
                </div>
              </div>
            </div>

            {/* 3. Live Active Kitchen Queue */}
            <div className="bg-slate-900/80 border border-amber-500/30 rounded-2xl p-4 relative overflow-hidden shadow-lg">
              <div className="absolute top-2 right-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                </span>
              </div>
              <p className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">Kitchen Queue</p>
              <h3 className="text-xl sm:text-2xl font-black text-amber-400 mt-1 font-mono tracking-tight">
                {liveStats.pendingOrders.length + liveStats.preparingOrders.length}
              </h3>
              <div className="mt-2 text-[10px] space-y-0.5 text-slate-400 border-t border-slate-800/60 pt-1.5 font-mono">
                <div className="flex justify-between">
                  <span>Pending:</span>
                  <span className="text-amber-300 font-semibold">{liveStats.pendingOrders.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Cooking:</span>
                  <span className="text-orange-400 font-semibold">{liveStats.preparingOrders.length}</span>
                </div>
              </div>
            </div>

            {/* 4. Live AOV */}
            <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-4 relative overflow-hidden shadow-lg">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Average Order Value</p>
              <h3 className="text-xl sm:text-2xl font-black text-cyan-400 mt-1 font-mono tracking-tight">
                ₹{liveStats.aov.toLocaleString('en-IN')}
              </h3>
              <div className="mt-2 text-[10px] text-slate-400 border-t border-slate-800/60 pt-1.5">
                <span className="text-cyan-300 font-medium">Real-time basket size</span>
              </div>
            </div>

            {/* 5. In Transit / Out for Delivery */}
            <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-4 relative overflow-hidden shadow-lg">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Dispatch / On Road</p>
              <h3 className="text-xl sm:text-2xl font-black text-sky-400 mt-1 font-mono tracking-tight">
                {liveStats.dispatchOrders.length}
              </h3>
              <div className="mt-2 text-[10px] space-y-0.5 text-slate-400 border-t border-slate-800/60 pt-1.5 font-mono">
                <div className="flex justify-between">
                  <span>Ready at Hub:</span>
                  <span className="text-sky-300 font-semibold">{liveStats.readyOrders.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Active Riders:</span>
                  <span className="text-emerald-400 font-semibold">{riders.length}</span>
                </div>
              </div>
            </div>

            {/* 6. Active POS Counters */}
            <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-4 relative overflow-hidden shadow-lg">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">POS Terminals</p>
              <h3 className="text-xl sm:text-2xl font-black text-emerald-400 mt-1 font-mono tracking-tight">
                {posTerminals.filter((t) => t.isActive).length}
              </h3>
              <div className="mt-2 text-[10px] text-slate-400 border-t border-slate-800/60 pt-1.5">
                <span className="text-emerald-300 font-medium">Live counters active</span>
              </div>
            </div>
          </div>

          {/* Real-Time Kitchen & Fulfillment Pipeline Stages */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Flame className="w-4 h-4 text-amber-500" />
                  <span>Real-Time Kitchen & Fulfillment Pipeline</span>
                </h4>
                <p className="text-xs text-slate-400">Live progression across all order fulfillment stages for {cleanFranchiseName}</p>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                {liveOrders.length} Active in Pipeline
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {/* Stage 1: Received */}
              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-amber-500/30 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-amber-400">1. Received</span>
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                </div>
                <div className="text-xl font-black text-white font-mono">{liveStats.pendingOrders.length}</div>
                <p className="text-[10px] text-slate-400 font-mono">
                  ₹{liveStats.pendingOrders.reduce((sum, o) => sum + Number(o.totalAmount || 0), 0).toLocaleString('en-IN')}
                </p>
              </div>

              {/* Stage 2: Preparing */}
              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-orange-500/30 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-orange-400">2. In Oven / Prep</span>
                  <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
                </div>
                <div className="text-xl font-black text-white font-mono">{liveStats.preparingOrders.length}</div>
                <p className="text-[10px] text-slate-400 font-mono">
                  ₹{liveStats.preparingOrders.reduce((sum, o) => sum + Number(o.totalAmount || 0), 0).toLocaleString('en-IN')}
                </p>
              </div>

              {/* Stage 3: Ready */}
              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-blue-500/30 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-blue-400">3. Ready for Pickup</span>
                  <span className="w-2 h-2 rounded-full bg-blue-400" />
                </div>
                <div className="text-xl font-black text-white font-mono">{liveStats.readyOrders.length}</div>
                <p className="text-[10px] text-slate-400 font-mono">
                  ₹{liveStats.readyOrders.reduce((sum, o) => sum + Number(o.totalAmount || 0), 0).toLocaleString('en-IN')}
                </p>
              </div>

              {/* Stage 4: Out for Delivery */}
              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-purple-500/30 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-purple-400">4. Out for Delivery</span>
                  <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
                </div>
                <div className="text-xl font-black text-white font-mono">{liveStats.dispatchOrders.length}</div>
                <p className="text-[10px] text-slate-400 font-mono">
                  ₹{liveStats.dispatchOrders.reduce((sum, o) => sum + Number(o.totalAmount || 0), 0).toLocaleString('en-IN')}
                </p>
              </div>

              {/* Stage 5: Completed Today */}
              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-emerald-500/30 space-y-1.5 col-span-2 sm:col-span-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-emerald-400">5. Delivered Today</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                </div>
                <div className="text-xl font-black text-white font-mono">{liveStats.completedTodayCount}</div>
                <p className="text-[10px] text-emerald-400/80 font-mono">Completed</p>
              </div>
            </div>
          </div>

          {/* Two-Column Analytics: Hourly Velocity & Top Selling Items */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Hourly Sales & Order Velocity Today */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-cyan-400" />
                    <span>Hourly Sales Velocity (Today)</span>
                  </h4>
                  <p className="text-xs text-slate-400">Real-time hourly order volume and revenue generation</p>
                </div>
                <span className="text-[10px] font-mono text-cyan-400 font-bold">Today: 00:00 - 23:59</span>
              </div>

              {/* Hourly Grid Bars */}
              <div className="grid grid-cols-6 sm:grid-cols-12 gap-1.5 pt-2">
                {Array.from({ length: 24 }).map((_, h) => {
                  const stat = liveStats.hourlySales[h] || { count: 0, revenue: 0 };
                  const isCurrentHour = new Date().getHours() === h;
                  const hasOrders = stat.count > 0;
                  return (
                    <div
                      key={h}
                      className={`p-2 rounded-xl text-center flex flex-col items-center justify-between min-h-[70px] border transition ${
                        isCurrentHour
                          ? 'bg-amber-500/20 border-amber-500/50 shadow-sm shadow-amber-500/20'
                          : hasOrders
                          ? 'bg-slate-950/80 border-cyan-500/30'
                          : 'bg-slate-950/40 border-slate-800/60 opacity-60'
                      }`}
                      title={`${h}:00 - ${h}:59: ${stat.count} orders, ₹${stat.revenue}`}
                    >
                      <span className="text-[9px] font-mono font-bold text-slate-400">{h}:00</span>
                      <div className="my-1">
                        <span className={`text-xs font-black font-mono block ${hasOrders ? 'text-amber-400' : 'text-slate-600'}`}>
                          {stat.count}
                        </span>
                      </div>
                      <span className="text-[8px] font-mono text-slate-400 truncate max-w-full">
                        {stat.revenue > 0 ? `₹${stat.revenue}` : '—'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right: Top Selling Products & Channel Split */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <UtensilsCrossed className="w-4 h-4 text-amber-500" />
                    <span>Top-Selling Menu Items (Today)</span>
                  </h4>
                  <p className="text-xs text-slate-400">Live items ordered today from {cleanFranchiseName}</p>
                </div>
                <span className="text-[10px] font-mono text-amber-400 font-bold">{liveStats.topItems.length} Products Sold</span>
              </div>

              {liveStats.topItems.length === 0 ? (
                <div className="p-8 text-center bg-slate-950/40 rounded-xl border border-slate-800 text-slate-500 text-xs">
                  No products ordered yet today. Live orders will populate item rankings in real time.
                </div>
              ) : (
                <div className="space-y-2">
                  {liveStats.topItems.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs">
                      <div className="flex items-center gap-2.5">
                        <span className="w-5 h-5 rounded-lg bg-amber-500/10 text-amber-400 font-mono font-bold text-[10px] flex items-center justify-center border border-amber-500/20">
                          #{idx + 1}
                        </span>
                        <div>
                          <span className="font-bold text-white block">{item.name}</span>
                          <span className="text-[10px] text-slate-400 font-mono">{item.count} units ordered</span>
                        </div>
                      </div>
                      <div className="text-right font-mono">
                        <span className="font-bold text-amber-400 block">₹{item.revenue.toLocaleString('en-IN')}</span>
                        <span className="text-[10px] text-slate-500">Gross Sales</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Channel Split Footer */}
              <div className="pt-3 border-t border-slate-800/80 grid grid-cols-3 gap-2 text-center text-xs">
                <div className="p-2 bg-slate-950/40 rounded-xl border border-slate-800/60">
                  <span className="text-[10px] text-slate-500 block">Delivery</span>
                  <span className="font-bold text-white font-mono">₹{liveStats.onlineRevenue.toLocaleString('en-IN')}</span>
                </div>
                <div className="p-2 bg-slate-950/40 rounded-xl border border-slate-800/60">
                  <span className="text-[10px] text-slate-500 block">POS Counter</span>
                  <span className="font-bold text-emerald-400 font-mono">₹{liveStats.posRevenue.toLocaleString('en-IN')}</span>
                </div>
                <div className="p-2 bg-slate-950/40 rounded-xl border border-slate-800/60">
                  <span className="text-[10px] text-slate-500 block">Takeaway</span>
                  <span className="font-bold text-cyan-400 font-mono">₹{liveStats.takeawayRevenue.toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Real-Time Live Orders Stream Table */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl space-y-3 p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Flame className="w-4 h-4 text-rose-500 animate-pulse" />
                  <span>Real-Time Order Ledger & Dispatch Feed ({todayOrders.length})</span>
                </h4>
                <p className="text-xs text-slate-400">Continuous Firestore stream • Real-time order logs scoped to {cleanFranchiseName}</p>
              </div>

              {/* Status Filters & Search */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
                  <input
                    type="text"
                    value={liveStreamSearch}
                    onChange={(e) => setLiveStreamSearch(e.target.value)}
                    placeholder="Search orders..."
                    className="pl-8 pr-3 py-1 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
                  />
                </div>

                <div className="flex items-center gap-1 flex-wrap">
                  {[
                    { id: 'all', label: `All (${todayOrders.length})` },
                    { id: 'active', label: `Active (${liveOrders.length})` },
                    { id: 'preparing', label: `Cooking (${liveStats.preparingOrders.length})` },
                    { id: 'ready', label: `Ready (${liveStats.readyOrders.length})` },
                    { id: 'delivery', label: `Transit (${liveStats.dispatchOrders.length})` },
                    { id: 'completed', label: `Done (${liveStats.completedTodayCount})` }
                  ].map((flt) => (
                    <button
                      key={flt.id}
                      onClick={() => setLiveStreamFilter(flt.id as any)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                        liveStreamFilter === flt.id
                          ? 'bg-amber-500 text-slate-950 font-bold'
                          : 'bg-slate-800/80 text-slate-400 hover:text-white'
                      }`}
                    >
                      {flt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Filtered Order Table */}
            <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-slate-700">
              {todayOrders.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  No orders recorded yet today for this franchise. When customers place orders or POS cashiers ring orders, they will stream here live.
                </div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="text-[11px] text-slate-400 uppercase bg-slate-950/80 border-b border-slate-800">
                    <tr>
                      <th className="p-3">Order ID</th>
                      <th className="p-3">Customer</th>
                      <th className="p-3">Items Summary</th>
                      <th className="p-3">Total Amount</th>
                      <th className="p-3">Channel / Payment</th>
                      <th className="p-3">Live Status</th>
                      <th className="p-3 text-right">Time Elapsed</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {todayOrders
                      .filter((o) => {
                        const s = (o.status || '').toLowerCase();
                        if (liveStreamFilter === 'active') return ['pending', 'accepted', 'preparing', 'partner_assigned', 'ready', 'picked_up', 'out_for_delivery'].includes(s);
                        if (liveStreamFilter === 'preparing') return ['accepted', 'preparing'].includes(s);
                        if (liveStreamFilter === 'ready') return ['ready', 'partner_assigned'].includes(s);
                        if (liveStreamFilter === 'delivery') return ['picked_up', 'out_for_delivery'].includes(s);
                        if (liveStreamFilter === 'completed') return ['delivered', 'completed'].includes(s);
                        return true;
                      })
                      .filter((o) => {
                        if (!liveStreamSearch.trim()) return true;
                        const q = liveStreamSearch.toLowerCase();
                        return (
                          (o.id || '').toLowerCase().includes(q) ||
                          (o.customerName || o.userName || '').toLowerCase().includes(q) ||
                          (o.customerPhone || o.userPhone || '').toLowerCase().includes(q) ||
                          (Array.isArray(o.items) && o.items.some((it: any) => (it.name || it.title || '').toLowerCase().includes(q)))
                        );
                      })
                      .map((o) => (
                        <tr key={o.id} className="hover:bg-slate-800/40 transition">
                          <td className="p-3 font-mono font-bold text-amber-400">
                            #{o.id.slice(-6).toUpperCase()}
                          </td>
                          <td className="p-3">
                            <strong className="text-white block">{o.customerName || o.userName || 'Customer'}</strong>
                            <span className="text-[10px] text-slate-400 font-mono">{o.customerPhone || o.userPhone || '—'}</span>
                          </td>
                          <td className="p-3 max-w-xs truncate text-slate-300">
                            {Array.isArray(o.items) && o.items.length > 0
                              ? o.items.map((it: any) => `${it.quantity || 1}x ${it.name || it.title}`).join(', ')
                              : 'Standard Order Items'}
                          </td>
                          <td className="p-3 font-mono font-bold text-white">
                            ₹{Number(o.totalAmount || o.total || 0).toLocaleString('en-IN')}
                          </td>
                          <td className="p-3">
                            <span className="capitalize block text-slate-300">
                              {o.orderSource || 'online'} • {o.deliveryType || o.fulfillmentType || 'delivery'}
                            </span>
                            <span className="text-[10px] font-mono text-emerald-400 uppercase">
                              {o.paymentMethod || 'online'} ({o.paymentStatus || 'PAID'})
                            </span>
                          </td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              o.status === 'delivered' || o.status === 'completed'
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : o.status === 'out_for_delivery'
                                ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30 animate-pulse'
                                : o.status === 'preparing' || o.status === 'accepted'
                                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse'
                                : 'bg-slate-800 text-slate-300'
                            }`}>
                              {o.status || 'PENDING'}
                            </span>
                          </td>
                          <td className="p-3 text-right font-mono text-slate-400 text-[11px]">
                            {new Date(o.createdAt?.toDate ? o.createdAt.toDate() : o.createdAt || Date.now()).toLocaleTimeString()}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── 2.5 TAB: PENDING RESTAURANT MANAGER APPROVALS ──────────────────────── */}
      {activeTab === 'approvals' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-amber-500" />
                <span>Restaurant Manager Approval Queue ({pendingManagers.length})</span>
              </h3>
              <p className="text-xs text-slate-400">
                Franchise-provisioned branch managers require Master Owner authorization before kitchen and restaurant operations access is granted.
              </p>
            </div>
            <button
              onClick={() => loadFranchiseWorkspace()}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs transition flex items-center gap-1"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh Queue
            </button>
          </div>

          {pendingManagers.length === 0 ? (
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-12 text-center max-w-lg mx-auto space-y-3">
              <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-500/60" />
              <h4 className="text-sm font-bold text-white">All Clear — No Pending Approvals</h4>
              <p className="text-xs text-slate-400">
                When a Franchise Manager provisions a candidate for Restaurant Manager, their verification profile will appear here for Master Owner review and approval.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {pendingManagers.map((mgr) => (
                <div key={mgr.id} className="bg-slate-900 border border-amber-500/30 rounded-2xl p-5 space-y-4 shadow-xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-xl pointer-events-none" />
                  
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-white tracking-tight">{mgr.name}</h4>
                      <p className="text-xs text-slate-400 font-mono mt-0.5">{mgr.email}</p>
                      {mgr.phone && (
                        <p className="text-xs text-slate-400 font-mono mt-0.5">{mgr.phone}</p>
                      )}
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-500/20 text-amber-400 border border-amber-500/30">
                      PENDING REVIEW
                    </span>
                  </div>

                  <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800 space-y-1.5 text-xs text-slate-300">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Franchise:</span>
                      <span className="text-amber-400 font-medium">{franchise.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Assigned Branch:</span>
                      <span className="text-white font-medium">{mgr.branchName || mgr.branchId || 'Primary Branch'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Email Verification:</span>
                      <span className={mgr.emailVerified ? 'text-emerald-400 font-semibold' : 'text-amber-400 font-semibold'}>
                        {mgr.emailVerified ? '✓ Verified' : 'Pending Verification'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Security PIN:</span>
                      <span className="text-slate-400 font-mono">Hashed (bcrypt 12 rounds)</span>
                    </div>
                    {mgr.createdAt && (
                      <div className="flex justify-between text-[11px] text-slate-500">
                        <span>Provisioned:</span>
                        <span>{new Date(mgr.createdAt).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => handleRejectManager(mgr.id)}
                      className="flex-1 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-xl text-xs font-bold transition disabled:opacity-50"
                    >
                      Reject
                    </button>
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => handleApproveManager(mgr.id)}
                      className="flex-1 py-2 bg-emerald-500 hover:bg-emerald-600 text-black font-bold rounded-xl text-xs transition shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                    >
                      Approve Account
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

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
                    <th className="p-3.5 text-center">Franchise Workspace</th>
                    <th className="p-3.5 text-center">Restaurant Operations</th>
                    <th className="p-3.5 text-center">POS Terminal</th>
                    <th className="p-3.5 text-center">Delivery Fleet</th>
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
                ₹{(dashboardMetrics?.todaySales || 0).toLocaleString('en-IN')}
              </h3>
              <p className="text-[10px] text-slate-500 mt-1">POS: ₹{(dashboardMetrics?.posSales || 0).toLocaleString('en-IN')}</p>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
              <p className="text-[11px] text-slate-400 font-semibold uppercase">Total Orders</p>
              <h3 className="text-xl font-bold text-white mt-1 font-mono">
                {dashboardMetrics?.totalOrders || 0}
              </h3>
              <p className="text-[10px] text-emerald-400 mt-1">Avg: ₹{dashboardMetrics?.avgOrderValue || 0}</p>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
              <p className="text-[11px] text-slate-400 font-semibold uppercase">Active Queue</p>
              <h3 className="text-xl font-bold text-amber-500 mt-1 font-mono">
                {liveOrders.length || dashboardMetrics?.activeOrders || 0}
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
                {riders.length}
              </h3>
              <p className="text-[10px] text-sky-400/80 mt-1">Fleet Ready</p>
            </div>
          </div>
        </div>
      )}

      {/* ─── 5. TAB: POS ACCOUNT APPROVALS & CONTROL ────────────────────────── */}
      {activeTab === 'pos' && (
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-white">POS Account Approvals & Access Control</h3>
              <p className="text-xs text-slate-400">Review, verify, and approve POS terminal accounts provisioned by Franchise Management (Max 1 per franchise)</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs rounded-xl font-bold">
                Franchise-Initiated POS Architecture
              </span>
            </div>
          </div>

          {/* Pending POS Access Requests from Franchise Managers */}
          {pendingPosRequests.length > 0 && (
            <div className="space-y-3 p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400" />
                <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                  Pending POS Access Requests ({pendingPosRequests.length})
                </h4>
              </div>
              <div className="space-y-2">
                {pendingPosRequests.map((req) => (
                  <div key={req.id} className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-2">
                        <span>Manager: {req.managerEmail || req.managerUid}</span>
                        <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-mono">
                          Franchise: {req.franchiseId}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Requested: {new Date(req.createdAt).toLocaleString()} {req.notes ? `• "${req.notes}"` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleApprovePosRequest(req.id)}
                        disabled={actionLoading}
                        className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-black font-bold rounded-lg text-xs flex items-center gap-1 cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Approve Request</span>
                      </button>
                      <button
                        onClick={() => handleRejectPosRequest(req.id)}
                        disabled={actionLoading}
                        className="px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 font-semibold rounded-lg text-xs cursor-pointer"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* POS Accounts List */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Configured POS Account</h4>
            {posAccounts.length === 0 ? (
              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8 text-center max-w-lg mx-auto space-y-3">
                <Monitor className="w-10 h-10 mx-auto text-slate-600" />
                <h4 className="text-sm font-bold text-white">No POS Account Configured</h4>
                <p className="text-xs text-slate-400">
                  This franchise does not currently have a POS account. The Franchise Manager initiates POS account setup inside the Franchise Management App.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {posAccounts.map((account) => (
                  <div key={account.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4 shadow-lg">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2.5">
                      <div className="min-w-0 flex-1">
                        <span className="text-sm font-bold text-white flex items-center gap-2 truncate">
                          <Monitor className="w-4 h-4 text-amber-400 shrink-0" />
                          <span className="truncate">{account.name}</span>
                        </span>
                        <p className="text-xs text-slate-400 font-mono mt-0.5 truncate">{account.email}</p>
                      </div>
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider self-start shrink-0 ${
                        account.status === 'APPROVED' || account.status === 'ACTIVE'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : account.status === 'PENDING_OWNER_APPROVAL'
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse'
                          : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                      }`}>
                        {account.status === 'PENDING_OWNER_APPROVAL' ? 'Pending Approval' : account.status}
                      </span>
                    </div>

                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1 text-xs">
                      <div className="flex justify-between text-slate-400">
                        <span>Franchise ID:</span>
                        <span className="font-mono text-slate-300">{account.franchiseId}</span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Created Date:</span>
                        <span className="text-slate-300">{account.createdAt ? new Date(account.createdAt).toLocaleDateString() : '—'}</span>
                      </div>
                      {account.approvedBy && (
                        <div className="flex justify-between text-slate-400">
                          <span>Approved By:</span>
                          <span className="text-emerald-400 font-mono">{account.approvedBy}</span>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1 border-t border-slate-800">
                      {account.status === 'PENDING_OWNER_APPROVAL' && (
                        <>
                          <button
                            onClick={() => handleApprovePosAccount(account.id)}
                            disabled={actionLoading}
                            className="flex-1 min-h-[44px] py-2 px-3 bg-emerald-500 hover:bg-emerald-600 text-black font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition shadow-lg shadow-emerald-500/20 cursor-pointer active:scale-[0.98]"
                          >
                            <CheckCircle2 className="w-4 h-4 shrink-0" />
                            <span>Verify & Approve</span>
                          </button>
                          <button
                            onClick={() => handleRejectPosAccount(account.id)}
                            disabled={actionLoading}
                            className="min-h-[44px] px-4 py-2 bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 rounded-xl text-xs font-semibold transition cursor-pointer active:scale-[0.98] flex items-center justify-center"
                          >
                            Reject
                          </button>
                        </>
                      )}

                      {(account.status === 'APPROVED' || account.status === 'ACTIVE') && (
                        <button
                          onClick={() => handleRevokePosAccount(account.id)}
                          disabled={actionLoading}
                          className="min-h-[44px] px-4 py-2 bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.98] w-full sm:w-auto"
                        >
                          <ShieldAlert className="w-4 h-4 shrink-0" />
                          <span>Revoke Access</span>
                        </button>
                      )}

                      {(account.status === 'REJECTED' || account.status === 'REVOKED') && (
                        <span className="text-xs text-rose-400 font-medium py-2">Access Disabled</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pending Password Reset Requests Queue */}
          <div className="space-y-3 pt-4 border-t border-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  POS Operator Password Reset Requests ({pendingPasswordResets.length})
                </h4>
                <p className="text-[11px] text-slate-400">Owner approves and dispatches secure password reset links directly to verified operators</p>
              </div>
            </div>

            {pendingPasswordResets.length === 0 ? (
              <div className="bg-slate-900/40 border border-slate-800/60 rounded-xl p-4 text-center text-xs text-slate-400">
                No pending password reset requests.
              </div>
            ) : (
              <div className="space-y-2">
                {pendingPasswordResets.map((req) => (
                  <div key={req.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <span className="text-xs font-bold text-white truncate block">{req.email}</span>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        Requested: {new Date(req.requestedAt).toLocaleString()} • App: {req.appTarget || 'POS'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <button
                        onClick={() => handleSendResetEmail(req.id)}
                        disabled={actionLoading}
                        className="flex-1 sm:flex-initial min-h-[44px] px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-black font-bold rounded-xl text-xs transition cursor-pointer active:scale-[0.98] flex items-center justify-center"
                      >
                        Send Reset Email
                      </button>
                      <button
                        onClick={() => handleRejectReset(req.id)}
                        disabled={actionLoading}
                        className="flex-1 sm:flex-initial min-h-[44px] px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs transition cursor-pointer active:scale-[0.98] flex items-center justify-center"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
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

      {/* ─── 7. TAB: LIVE ORDERS (READ-ONLY MONITORING FOR MASTER OWNER) ──────── */}
      {activeTab === 'live-orders' && (
        <div className="space-y-4">
          {/* Read-Only Safety Banner */}
          <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-amber-500 text-slate-950 font-black text-[10px] uppercase">
                READ-ONLY
              </span>
              <span className="font-bold text-amber-300">
                Franchise Live Order Stream — Master Owner Observability Mode
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Real-time Firestore listener active • Order mutations must be performed within Restaurant Manager or POS terminal
            </p>
          </div>

          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Flame className="w-4 h-4 text-amber-500 animate-pulse" />
              <span>Active Orders in Kitchen & Delivery ({liveOrders.length})</span>
            </h3>
            <span className="text-xs text-slate-400 font-mono">
              Filtered: {selectedBranchFilter === 'all' ? 'All Branches' : selectedBranchFilter}
            </span>
          </div>

          {liveOrders.length === 0 ? (
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-12 text-center max-w-md mx-auto space-y-2">
              <Flame className="w-8 h-8 mx-auto text-slate-600" />
              <h4 className="text-sm font-bold text-white">No Active Orders Right Now</h4>
              <p className="text-xs text-slate-400">
                New incoming orders will appear here automatically via live Firestore streaming.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {liveOrders.map((o) => (
                <div key={o.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 shadow-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-mono font-bold text-amber-400">#{o.id.slice(-6).toUpperCase()}</span>
                      <p className="text-xs text-white font-semibold mt-0.5">{o.customerName || o.userName || 'Customer'}</p>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-500/20 text-amber-400 border border-amber-500/30">
                      {o.status || 'PENDING'}
                    </span>
                  </div>

                  <div className="space-y-1 text-xs text-slate-300 pt-2 border-t border-slate-800">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Total:</span>
                      <span className="font-mono font-bold text-white">₹{Number(o.totalAmount || 0).toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Source / Type:</span>
                      <span className="capitalize text-slate-300">{o.orderSource || 'online'} • {o.deliveryType || o.fulfillmentType || 'delivery'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Payment:</span>
                      <span className="uppercase text-[11px] font-mono text-emerald-400">{o.paymentMethod || 'online'} ({o.paymentStatus || 'PAID'})</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Branch:</span>
                      <span className="text-slate-300 font-medium">{o.branchId || 'main_branch'}</span>
                    </div>
                  </div>

                  {Array.isArray(o.items) && o.items.length > 0 && (
                    <div className="pt-2 border-t border-slate-800/60">
                      <p className="text-[10px] text-slate-500 font-mono mb-1">ITEMS ({o.items.length}):</p>
                      <div className="space-y-0.5">
                        {o.items.slice(0, 3).map((it: any, idx: number) => (
                          <p key={idx} className="text-[11px] text-slate-300 truncate">
                            {it.quantity || 1}x {it.name || it.title}
                          </p>
                        ))}
                        {o.items.length > 3 && (
                          <p className="text-[10px] text-slate-500 font-semibold">+{o.items.length - 3} more items...</p>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[10px] text-slate-500 font-mono">
                    <span>⏱ {new Date(o.createdAt?.toDate ? o.createdAt.toDate() : o.createdAt || Date.now()).toLocaleTimeString()}</span>
                    <span className="text-amber-400/80 font-semibold">👀 Pure Observability</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── 8. TAB: ORDERS HISTORY (PAST ORDERS AUDIT) ───────────────────────── */}
      {activeTab === 'orders' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">Completed & Past Orders ({historicalOrders.length})</h3>
            <span className="text-xs text-slate-400">Read-only historical order archive</span>
          </div>

          {historicalOrders.length === 0 ? (
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-8 text-center text-slate-400 text-xs">
              No historical orders recorded yet.
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-[11px] text-slate-400 uppercase bg-slate-950/80 border-b border-slate-800">
                    <tr>
                      <th className="p-3">Order ID</th>
                      <th className="p-3">Customer</th>
                      <th className="p-3">Branch</th>
                      <th className="p-3">Amount</th>
                      <th className="p-3">Payment</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {historicalOrders.slice(0, 50).map((o) => (
                      <tr key={o.id} className="hover:bg-slate-800/40">
                        <td className="p-3 font-mono text-amber-400">#{o.id.slice(-6).toUpperCase()}</td>
                        <td className="p-3 text-white font-medium">{o.customerName || o.userName || 'Customer'}</td>
                        <td className="p-3">{o.branchId || 'main_branch'}</td>
                        <td className="p-3 font-mono font-bold text-white">₹{Number(o.totalAmount || 0).toLocaleString('en-IN')}</td>
                        <td className="p-3 uppercase text-[11px] font-mono text-emerald-400">{o.paymentMethod || 'online'}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            o.status === 'delivered' || o.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                          }`}>
                            {o.status}
                          </span>
                        </td>
                        <td className="p-3 text-right font-mono text-slate-500 text-[11px]">
                          {new Date(o.createdAt?.toDate ? o.createdAt.toDate() : o.createdAt || Date.now()).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── 9. TAB: DELIVERY FLEET ─────────────────────────────────────────── */}
      {activeTab === 'delivery' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Bike className="w-4 h-4 text-sky-400" />
                <span>Delivery Fleet & Rider Telemetry ({riders.length})</span>
              </h3>
              <p className="text-xs text-slate-400">
                Store-bound delivery fleet assigned to {cleanFranchiseName}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleOpenAddRider}
                className="px-3.5 py-2 bg-sky-500 hover:bg-sky-400 text-black font-bold rounded-xl text-xs transition flex items-center gap-1.5 shadow-lg shadow-sky-500/20"
              >
                <Plus className="w-3.5 h-3.5" /> Onboard Rider
              </button>
              <button
                onClick={() => loadFranchiseWorkspace()}
                className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs transition flex items-center gap-1"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Refresh Fleet
              </button>
            </div>
          </div>

          {riders.length === 0 ? (
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-12 text-center max-w-md mx-auto space-y-4">
              <Bike className="w-12 h-12 mx-auto text-slate-600" />
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-white">No Riders Assigned Yet</h4>
                <p className="text-xs text-slate-400">
                  Onboard your first delivery rider to enable store-bound delivery dispatch for {cleanFranchiseName}.
                </p>
              </div>
              <button
                onClick={handleOpenAddRider}
                className="px-4 py-2.5 bg-sky-500 hover:bg-sky-400 text-black font-bold rounded-xl text-xs transition inline-flex items-center gap-1.5 shadow-lg shadow-sky-500/20"
              >
                <Plus className="w-4 h-4" /> Onboard Delivery Partner
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {riders.map((r) => {
                const isRiderActive = r.isActive !== false && r.status !== 'INACTIVE' && r.status !== 'REVOKED' && r.status !== 'SUSPENDED';
                const branchObj = branches.find((b) => b.id === r.branchId);
                const branchName = branchObj?.name || r.branchId || 'Main Branch';

                return (
                  <div key={r.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 shadow-lg flex flex-col justify-between">
                    <div className="space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-sm font-bold text-white block">{r.name}</span>
                          <p className="text-xs text-slate-400 font-mono flex items-center gap-1 mt-0.5">
                            <Phone className="w-3 h-3 text-slate-500" />
                            {r.phone || r.phoneNumber || 'No phone'}
                          </p>
                          {r.email && (
                            <p className="text-[11px] text-slate-500 font-mono truncate max-w-[200px]">
                              {r.email}
                            </p>
                          )}
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          !isRiderActive
                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            : r.status === 'ON_DELIVERY' || r.status === 'BUSY'
                            ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30 animate-pulse'
                            : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        }`}>
                          {!isRiderActive ? 'SUSPENDED' : (r.status || 'AVAILABLE')}
                        </span>
                      </div>

                      <div className="space-y-1 text-xs text-slate-300 pt-2 border-t border-slate-800">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Branch:</span>
                          <span className="text-slate-200 font-medium truncate max-w-[150px]">{branchName}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Vehicle:</span>
                          <span className="text-white font-mono">{r.vehicleNumber || r.vehicleType || 'Bike'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Active Deliveries:</span>
                          <span className="text-amber-400 font-bold font-mono">{r.activeOrdersCount || 0} Orders</span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-800/80 flex items-center gap-1.5">
                      <button
                        onClick={() => handleOpenEditRider(r)}
                        className="flex-1 py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition"
                      >
                        <Edit2 className="w-3 h-3 text-sky-400" />
                        <span>Edit</span>
                      </button>

                      <button
                        onClick={() => handleToggleRiderStatus(r)}
                        className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition ${
                          isRiderActive
                            ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        }`}
                      >
                        <Power className="w-3 h-3" />
                        <span>{isRiderActive ? 'Suspend' : 'Reinstate'}</span>
                      </button>

                      <button
                        onClick={() => handleDeleteRider(r)}
                        className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg transition border border-rose-500/30"
                        title="Delete rider & revoke session"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── 10. TAB: FINANCIAL & REPORTS ─────────────────────────────────────── */}
      {activeTab === 'reports' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                <span>Financial Statements & Operational Reports</span>
              </h3>
              <p className="text-xs text-slate-400">
                Authoritative financial reporting and Cloudflare R2 archive for {cleanFranchiseName}
              </p>
            </div>
            <button
              onClick={() => {
                loadFranchiseWorkspace();
                if (franchise?.id) {
                  const branchQuery = selectedBranchFilter !== 'all' ? `&branchId=${encodeURIComponent(selectedBranchFilter)}` : '';
                  fetchApi(`/api/reports/monthly?franchiseId=${encodeURIComponent(franchise.id)}${branchQuery}`)
                    .then(async (r) => (r.ok ? r.json() : {}))
                    .then((d) => {
                      if (Array.isArray(d)) setMonthlyPdfReports(d);
                      else if (Array.isArray(d.reports)) setMonthlyPdfReports(d.reports);
                    });
                }
              }}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs transition flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh Reports
            </button>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2">
              <span className="text-xs text-slate-400 font-semibold uppercase">Total Recorded Revenue</span>
              <h3 className="text-2xl font-black text-amber-400 font-mono">
                ₹{liveStats.totalTodayRevenue.toLocaleString('en-IN')}
              </h3>
              <p className="text-[11px] text-slate-500">Live gross sales today across online and in-store</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2">
              <span className="text-xs text-slate-400 font-semibold uppercase">Google Sheets Integration</span>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                <h4 className="text-base font-bold text-white">Live Sheets Active</h4>
              </div>
              <p className="text-[11px] text-slate-500">Automated shift close and daily financial export enabled</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2">
              <span className="text-xs text-slate-400 font-semibold uppercase">Cloudflare R2 Archive</span>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
                <h4 className="text-base font-bold text-white">Encrypted Object Store</h4>
              </div>
              <p className="text-[11px] text-slate-500">{monthlyPdfReports.length} statements archived</p>
            </div>
          </div>

          {/* Section B: Custom Reports with 7 Time Filters */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Filter className="w-4 h-4 text-amber-400" />
                  <span>On-Demand Custom Audit Reports</span>
                </h4>
                <p className="text-xs text-slate-400">Select any window to export. Owner has unlimited custom PDF downloads.</p>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" /> Unlimited Downloads
              </span>
            </div>

            {/* 7 Time Filters */}
            <div className="flex flex-wrap gap-2">
              {[
                'Ongoing Month',
                'Previous Month',
                'This Week',
                'Previous Week',
                'Last Day',
                'Last 2 Days',
                'All Time',
              ].map((range) => {
                const isSelected = customTimeRange === range;
                return (
                  <button
                    key={range}
                    onClick={() => setCustomTimeRange(range)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-amber-500 text-black shadow-md shadow-amber-500/20'
                        : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/60'
                    }`}
                  >
                    <Clock className="w-3 h-3" />
                    {range}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
              <div className="text-xs text-slate-400">
                Selected Filter: <strong className="text-amber-400">{customTimeRange}</strong> • Branch Scope:{' '}
                <strong className="text-white">
                  {selectedBranchFilter === 'all'
                    ? 'All Branches'
                    : branches.find((b) => b.id === selectedBranchFilter)?.name || selectedBranchFilter}
                </strong>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  onClick={() => handleGenerateFranchiseCustomPdf(customTimeRange, 'preview')}
                  disabled={generatingCustomPdf}
                  className="flex-1 sm:flex-none px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition disabled:opacity-50"
                >
                  <Eye className="w-3.5 h-3.5 text-blue-400" />
                  <span>Preview in App</span>
                </button>
                <button
                  onClick={() => handleGenerateFranchiseCustomPdf(customTimeRange, 'download')}
                  disabled={generatingCustomPdf}
                  className="flex-1 sm:flex-none px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition shadow-md shadow-amber-500/20 disabled:opacity-50"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Custom PDF</span>
                </button>
              </div>
            </div>
          </div>

          {/* Section C: All-Time Monthly Reports from Cloudflare R2 */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <FileText className="w-4 h-4 text-cyan-400" />
                  <span>All-Time Monthly Statements Archive (Cloudflare R2)</span>
                </h4>
                <p className="text-xs text-slate-400">
                  Authoritative monthly executive balance sheets & financial statements
                </p>
              </div>
              <span className="text-xs font-bold text-slate-400">
                {monthlyPdfReports.length} {monthlyPdfReports.length === 1 ? 'Report' : 'Reports'}
              </span>
            </div>

            {reportsLoading ? (
              <div className="text-center py-10 space-y-2">
                <div className="w-8 h-8 rounded-full border-2 border-amber-500 border-t-transparent animate-spin mx-auto" />
                <p className="text-xs text-slate-400">Loading Cloudflare R2 archive...</p>
              </div>
            ) : monthlyPdfReports.length === 0 ? (
              <div className="text-center py-12 text-slate-500 space-y-3">
                <FileText className="w-10 h-10 mx-auto text-slate-600 opacity-40" />
                <p className="text-xs font-semibold text-slate-400">No monthly PDF statements found for this branch.</p>
                <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                  Monthly audit reports are archived on the 1st of every month at 00:05 AM IST.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {monthlyPdfReports.map((r: any, idx: number) => {
                  const viewLink = r.viewUrl || r.reportUrl || `/api/reports/monthly/${r.id}/view`;
                  const downloadLink = r.downloadUrl || `${viewLink}?download=true`;
                  const revenue = Number(r.revenue || 0);
                  const ordersCount = Number(r.orders || 0);
                  const aov = r.averageOrderValue
                    ? Math.round(r.averageOrderValue)
                    : ordersCount > 0
                    ? Math.round(revenue / ordersCount)
                    : 0;

                  return (
                    <div
                      key={r.id || idx}
                      className="p-4 bg-slate-950/70 border border-slate-800 rounded-xl space-y-3 flex flex-col justify-between"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="px-2.5 py-0.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-full text-[11px] font-black uppercase flex items-center gap-1">
                            <Calendar className="w-3 h-3" /> {r.period || `${r.month || ''} ${r.year || ''}`}
                          </span>
                          <span className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full text-[10px] font-bold flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Audited
                          </span>
                        </div>

                        <div>
                          <h5 className="text-xs font-extrabold text-white">
                            {r.branchName || r.title || `Olive Pizza — ${r.branchId || 'HQ'}`}
                          </h5>
                          <span className="text-[10px] text-slate-400 block">
                            {cleanFranchiseName} • Cloudflare R2
                          </span>
                        </div>

                        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800/80 text-[10px]">
                          <div className="bg-slate-900 p-2 rounded-lg">
                            <span className="text-slate-500 block uppercase font-bold">Gross</span>
                            <span className="text-emerald-400 font-mono font-bold block mt-0.5">
                              ₹{revenue.toLocaleString('en-IN')}
                            </span>
                          </div>
                          <div className="bg-slate-900 p-2 rounded-lg">
                            <span className="text-slate-500 block uppercase font-bold">Orders</span>
                            <span className="text-white font-mono font-bold block mt-0.5">{ordersCount}</span>
                          </div>
                          <div className="bg-slate-900 p-2 rounded-lg">
                            <span className="text-slate-500 block uppercase font-bold">AOV</span>
                            <span className="text-amber-400 font-mono font-bold block mt-0.5">₹{aov}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-2 border-t border-slate-800/60">
                        <button
                          onClick={() =>
                            openPdfViewer(
                              r.title || `${r.period || ''} Statement`,
                              viewLink,
                              downloadLink,
                              `${cleanFranchiseName} • ${r.branchName || r.branchId || 'Branch'}`
                            )
                          }
                          className="flex-1 py-1.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5 text-blue-400" />
                          <span>View PDF</span>
                        </button>
                        <a
                          href={downloadLink}
                          download
                          className="flex-1 py-1.5 px-3 bg-amber-500 hover:bg-amber-400 text-black rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Download</span>
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── 11. TAB: FRANCHISE SETTINGS & AUDIT ───────────────────────────────── */}
      {activeTab === 'settings' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Settings className="w-4 h-4 text-amber-500" />
              <span>Franchise Identity & Operational Configuration</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="space-y-1 p-3 bg-slate-950/60 rounded-xl border border-slate-800">
                <span className="text-slate-500 text-[10px] uppercase font-bold">Franchise Name</span>
                <p className="text-white font-semibold text-sm">{cleanFranchiseName}</p>
                <p className="text-amber-400 font-mono">{franchise.code}</p>
              </div>
              <div className="space-y-1 p-3 bg-slate-950/60 rounded-xl border border-slate-800">
                <span className="text-slate-500 text-[10px] uppercase font-bold">Geographic Center</span>
                <p className="text-white font-semibold">{franchise.address || 'Dongargaon Rd, Rajnandgaon, CG 491441'}</p>
                <p className="text-slate-400">{franchise.city}, {franchise.region || 'Chhattisgarh'}</p>
              </div>
              <div className="space-y-1 p-3 bg-slate-950/60 rounded-xl border border-slate-800">
                <span className="text-slate-500 text-[10px] uppercase font-bold">Master Contact</span>
                <p className="text-white font-mono">{franchise.contactEmail || franchise.email || 'olivepizzarjn@gmail.com'}</p>
                <p className="text-slate-400 font-mono">{franchise.contactPhone || franchise.phone || '+91 91799 44445'}</p>
              </div>
              <div className="space-y-1 p-3 bg-slate-950/60 rounded-xl border border-slate-800">
                <span className="text-slate-500 text-[10px] uppercase font-bold">Operational Scope</span>
                <p className="text-emerald-400 font-semibold">Single Autonomous Franchise Mode</p>
                <p className="text-slate-400">Scoped exclusively to Rajnandgaon hub</p>
              </div>
            </div>
          </div>

          {/* Audit Logs */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <History className="w-4 h-4 text-slate-400" />
              <span>Administrative Audit Trail ({auditLogs.length})</span>
            </h4>
            {auditLogs.length === 0 ? (
              <p className="text-xs text-slate-500">No administrative audit events recorded yet.</p>
            ) : (
              <div className="space-y-2">
                {auditLogs.slice(0, 10).map((log, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2.5 bg-slate-950/60 rounded-xl border border-slate-800/80 text-xs">
                    <div>
                      <span className="font-bold text-white block">{log.actionType || 'CONFIG_CHANGE'}</span>
                      <span className="text-[10px] text-slate-400">{log.actorEmail || 'owner'} • {log.entityType || 'franchise'}</span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-500">
                      {new Date(log.timestamp || Date.now()).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
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

            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-[11px] text-amber-300">
              Granted applications empower this user to log in and use authorized features directly inside this unified console without requiring separate external web applications.
            </div>

            <form onSubmit={handleSaveAccessChanges} className="space-y-4 text-xs">
              <div className="space-y-2">
                <label className="text-slate-400 block font-semibold">Application Grants</label>
                
                {/* Franchise App */}
                <label className="flex items-center justify-between p-3 rounded-xl border border-slate-800 bg-slate-950/60 cursor-pointer hover:border-amber-500/40 transition">
                  <div>
                    <span className="font-semibold text-white block">Franchise Management Workspace</span>
                    <span className="text-[10px] text-emerald-400 font-medium">In-App Franchise Management & Configuration</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={accessForm.app_franchise_management}
                    onChange={(e) => setAccessForm({ ...accessForm, app_franchise_management: e.target.checked })}
                    className="w-4 h-4 accent-amber-500 cursor-pointer"
                  />
                </label>

                {/* Restaurant App */}
                <label className="flex items-center justify-between p-3 rounded-xl border border-slate-800 bg-slate-950/60 cursor-pointer hover:border-amber-500/40 transition">
                  <div>
                    <span className="font-semibold text-white block">Restaurant Operations & Kitchen KDS</span>
                    <span className="text-[10px] text-emerald-400 font-medium">In-App Restaurant Controls, Store Status & Orders</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={accessForm.app_restaurant_management}
                    onChange={(e) => setAccessForm({ ...accessForm, app_restaurant_management: e.target.checked })}
                    className="w-4 h-4 accent-amber-500 cursor-pointer"
                  />
                </label>

                {/* POS App */}
                <label className="flex items-center justify-between p-3 rounded-xl border border-slate-800 bg-slate-950/60 cursor-pointer hover:border-amber-500/40 transition">
                  <div>
                    <span className="font-semibold text-white block">POS Billing Terminal</span>
                    <span className="text-[10px] text-amber-400 font-medium">Terminal Billing & Cashier Shifts</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={accessForm.app_pos}
                    onChange={(e) => setAccessForm({ ...accessForm, app_pos: e.target.checked })}
                    className="w-4 h-4 accent-amber-500 cursor-pointer"
                  />
                </label>

                {/* Delivery App */}
                <label className="flex items-center justify-between p-3 rounded-xl border border-slate-800 bg-slate-950/60 cursor-pointer hover:border-amber-500/40 transition">
                  <div>
                    <span className="font-semibold text-white block">Delivery Fleet Dispatch</span>
                    <span className="text-[10px] text-sky-400 font-medium">Rider Dispatch, Tracking & Fleet Operations</span>
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

      {/* Onboard Rider Modal */}
      {showAddRiderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Bike className="w-5 h-5 text-sky-400" />
                <h3 className="font-bold text-white text-base">Onboard Delivery Partner</h3>
              </div>
              <button
                onClick={() => setShowAddRiderModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateRider} className="space-y-3.5 text-xs">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">Rider Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rahul Verma"
                  value={riderForm.name}
                  onChange={(e) => setRiderForm({ ...riderForm, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white placeholder-slate-600 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Mobile Number (Login Identity) *</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-slate-500 font-mono font-bold">+91</span>
                  <input
                    type="tel"
                    required
                    placeholder="9876543210"
                    value={riderForm.phone}
                    onChange={(e) => setRiderForm({ ...riderForm, phone: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-12 pr-3.5 py-2.5 text-white font-mono placeholder-slate-600 focus:outline-none focus:border-sky-500"
                  />
                </div>
                <p className="text-[10px] text-slate-500 mt-1">Used for Rider App SMS OTP and Truecaller login</p>
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Email Address (Optional)</label>
                <input
                  type="email"
                  placeholder="rider@olivepizza.in"
                  value={riderForm.email}
                  onChange={(e) => setRiderForm({ ...riderForm, email: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white placeholder-slate-600 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Assigned Branch *</label>
                  <select
                    value={riderForm.branchId}
                    onChange={(e) => setRiderForm({ ...riderForm, branchId: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-sky-500"
                  >
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Vehicle Type</label>
                  <select
                    value={riderForm.vehicleType}
                    onChange={(e) => setRiderForm({ ...riderForm, vehicleType: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-sky-500"
                  >
                    <option value="Bike">Motorcycle</option>
                    <option value="Scooter">Scooter</option>
                    <option value="EV_Bike">Electric Bike</option>
                    <option value="Car">Car</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Vehicle Registration Number</label>
                <input
                  type="text"
                  placeholder="e.g. CG-08-AB-1234"
                  value={riderForm.vehicleNumber}
                  onChange={(e) => setRiderForm({ ...riderForm, vehicleNumber: e.target.value.toUpperCase() })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white uppercase font-mono placeholder-slate-600 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddRiderModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-sky-500 hover:bg-sky-400 text-black font-bold rounded-xl shadow-lg shadow-sky-500/20 disabled:opacity-50"
                >
                  {actionLoading ? 'Onboarding...' : 'Onboard Partner'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Rider Modal */}
      {showEditRiderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-sky-400" />
                <h3 className="font-bold text-white text-base">Edit Delivery Partner</h3>
              </div>
              <button
                onClick={() => setShowEditRiderModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateRider} className="space-y-3.5 text-xs">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">Rider Full Name *</label>
                <input
                  type="text"
                  required
                  value={riderForm.name}
                  onChange={(e) => setRiderForm({ ...riderForm, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Mobile Number (Canonical Phone) *</label>
                <input
                  type="tel"
                  required
                  value={riderForm.phone}
                  onChange={(e) => setRiderForm({ ...riderForm, phone: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white font-mono focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Email Address</label>
                <input
                  type="email"
                  value={riderForm.email}
                  onChange={(e) => setRiderForm({ ...riderForm, email: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Assigned Branch</label>
                  <select
                    value={riderForm.branchId}
                    onChange={(e) => setRiderForm({ ...riderForm, branchId: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-sky-500"
                  >
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Vehicle Type</label>
                  <select
                    value={riderForm.vehicleType}
                    onChange={(e) => setRiderForm({ ...riderForm, vehicleType: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-sky-500"
                  >
                    <option value="Bike">Motorcycle</option>
                    <option value="Scooter">Scooter</option>
                    <option value="EV_Bike">Electric Bike</option>
                    <option value="Car">Car</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Vehicle Number</label>
                <input
                  type="text"
                  value={riderForm.vehicleNumber}
                  onChange={(e) => setRiderForm({ ...riderForm, vehicleNumber: e.target.value.toUpperCase() })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white uppercase font-mono focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowEditRiderModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-sky-500 hover:bg-sky-400 text-black font-bold rounded-xl shadow-lg shadow-sky-500/20 disabled:opacity-50"
                >
                  {actionLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* In-App PDF Viewer Modal */}
      <PdfViewerModal
        isOpen={pdfModal.isOpen}
        onClose={() => setPdfModal((prev) => ({ ...prev, isOpen: false }))}
        title={pdfModal.title}
        pdfUrl={pdfModal.pdfUrl}
        downloadUrl={pdfModal.downloadUrl}
        subtitle={pdfModal.subtitle}
      />
    </div>
  );
}
