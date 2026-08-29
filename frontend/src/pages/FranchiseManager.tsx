import React, { useState, useEffect } from 'react';
import {
  Building2,
  Plus,
  MapPin,
  Phone,
  Mail,
  Clock,
  ShieldCheck,
  Power,
  Edit2,
  X,
  Search,
  CheckCircle2,
  XCircle,
  Truck,
  RefreshCw,
  ExternalLink,
  Users,
  Monitor,
  ArrowRight,
  Eye,
  Layers,
  Map,
  Check,
  AlertCircle
} from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, getDocs, doc, setDoc, updateDoc } from 'firebase/firestore';
import { fetchApi } from '../lib/api';
import toast from 'react-hot-toast';

export interface FranchiseBranch {
  id: string;
  name: string;
  code: string;
  city: string;
  state: string;
  address: string;
  lat: number;
  lng: number;
  phone: string;
  email: string;
  franchiseOwnerEmail?: string;
  restaurantManagerEmail?: string;
  maxDeliveryRadiusKm: number;
  openingTime: string;
  closingTime: string;
  isActive: boolean;
  isHeadquarters?: boolean;
  posTerminalCount?: number;
  createdAt?: string;
}

const DEFAULT_BRANCHES: FranchiseBranch[] = [
  {
    id: 'main_branch',
    name: 'Olive Pizza — Rajnandgaon (Main Branch)',
    code: 'OP-RJN-01',
    city: 'Rajnandgaon',
    state: 'Chhattisgarh',
    address: 'Dongargaon Rd, near Saraswati school, Gokul Nagar, Rajnandgaon, CG 491441',
    lat: 21.0810244,
    lng: 81.0123793,
    phone: '+91 91799 44445',
    email: 'olivepizzarjn@gmail.com',
    franchiseOwnerEmail: 'olivepizzarjn@gmail.com',
    restaurantManagerEmail: 'webhub2811@gmail.com',
    maxDeliveryRadiusKm: 15,
    openingTime: '12:00',
    closingTime: '23:59',
    isActive: true,
    isHeadquarters: true,
    posTerminalCount: 2
  },
  {
    id: 'durg_branch',
    name: 'Olive Pizza — Durg (Branch 2)',
    code: 'OP-DURG-02',
    city: 'Durg',
    state: 'Chhattisgarh',
    address: 'Station Road, Durg, CG 491001',
    lat: 21.190449,
    lng: 81.284920,
    phone: '+91 91799 44446',
    email: 'durg@olivepizza.in',
    franchiseOwnerEmail: 'franchise.durg@olivepizza.in',
    restaurantManagerEmail: 'manager.durg@olivepizza.in',
    maxDeliveryRadiusKm: 12,
    openingTime: '12:00',
    closingTime: '23:59',
    isActive: true,
    isHeadquarters: false,
    posTerminalCount: 1
  },
  {
    id: 'bhilai_branch',
    name: 'Olive Pizza — Bhilai (Branch 3)',
    code: 'OP-BHL-03',
    city: 'Bhilai',
    state: 'Chhattisgarh',
    address: 'Civic Centre, Sector 5, Bhilai, CG 490006',
    lat: 21.193848,
    lng: 81.350941,
    phone: '+91 91799 44447',
    email: 'bhilai@olivepizza.in',
    franchiseOwnerEmail: 'franchise.bhilai@olivepizza.in',
    restaurantManagerEmail: 'manager.bhilai@olivepizza.in',
    maxDeliveryRadiusKm: 12,
    openingTime: '12:00',
    closingTime: '23:59',
    isActive: true,
    isHeadquarters: false,
    posTerminalCount: 1
  },
  {
    id: 'raipur_branch',
    name: 'Olive Pizza — Raipur (Branch 4)',
    code: 'OP-RPR-04',
    city: 'Raipur',
    state: 'Chhattisgarh',
    address: 'VIP Road, Telibandha, Raipur, CG 492006',
    lat: 21.237944,
    lng: 81.667427,
    phone: '+91 91799 44448',
    email: 'raipur@olivepizza.in',
    franchiseOwnerEmail: 'franchise.raipur@olivepizza.in',
    restaurantManagerEmail: 'manager.raipur@olivepizza.in',
    maxDeliveryRadiusKm: 15,
    openingTime: '12:00',
    closingTime: '23:59',
    isActive: true,
    isHeadquarters: false,
    posTerminalCount: 2
  }
];

export default function FranchiseManager() {
  const [branches, setBranches] = useState<FranchiseBranch[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Detail Modal
  const [viewingBranch, setViewingBranch] = useState<FranchiseBranch | null>(null);

  // 7-Step Provisioning Wizard Modal
  const [isProvisionWizardOpen, setIsProvisionWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Wizard Fields
  const [wizName, setWizName] = useState('');
  const [wizCode, setWizCode] = useState('');
  const [wizCity, setWizCity] = useState('');
  const [wizState, setWizState] = useState('Chhattisgarh');
  const [wizAddress, setWizAddress] = useState('');
  const [wizLat, setWizLat] = useState('21.0810244');
  const [wizLng, setWizLng] = useState('81.0123793');
  const [wizPhone, setWizPhone] = useState('+91 91799 44445');
  const [wizEmail, setWizEmail] = useState('');
  const [wizFranchiseOwnerEmail, setWizFranchiseOwnerEmail] = useState('');
  const [wizFranchiseOwnerName, setWizFranchiseOwnerName] = useState('');
  const [wizRestaurantManagerEmail, setWizRestaurantManagerEmail] = useState('');
  const [wizRestaurantManagerName, setWizRestaurantManagerName] = useState('');
  const [wizMaxRadius, setWizMaxRadius] = useState(12);
  const [wizOpenTime, setWizOpenTime] = useState('12:00');
  const [wizCloseTime, setWizCloseTime] = useState('23:59');
  const [wizPosCount, setWizPosCount] = useState(1);
  const [wizPosNames, setWizPosNames] = useState(['Counter 1']);

  // Edit Modal
  const [editingBranch, setEditingBranch] = useState<FranchiseBranch | null>(null);

  const loadBranches = async () => {
    setLoading(true);
    try {
      const res = await fetchApi('/api/franchises');
      const data = await res.json().catch(() => null);

      if (res.ok && data?.branches && data.branches.length > 0) {
        setBranches(data.branches);
      } else {
        const snap = await getDocs(collection(db, 'franchises')).catch(() => ({ docs: [] } as any));
        if (snap.docs && snap.docs.length > 0) {
          setBranches(snap.docs.map((d: any) => ({ id: d.id, ...d.data() })));
        } else {
          setBranches(DEFAULT_BRANCHES);
          for (const b of DEFAULT_BRANCHES) {
            await setDoc(doc(db, 'franchises', b.id), b, { merge: true }).catch(() => {});
          }
        }
      }
    } catch (err) {
      console.warn('Franchises fallback to defaults:', err);
      setBranches(DEFAULT_BRANCHES);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBranches();
  }, []);

  const handleOpenLaunch = async (targetApp: 'franchise' | 'restaurant_management', branch: FranchiseBranch) => {
    try {
      const res = await fetchApi('/api/auth/context-session', {
        method: 'POST',
        body: JSON.stringify({
          targetApp,
          targetFranchiseId: `fra_${branch.id}`,
          targetBranchId: branch.id,
          targetBranchName: branch.name
        })
      });
      const data = await res.json().catch(() => null);

      if (res.ok && data?.targetUrl) {
        window.open(data.targetUrl, '_blank');
        toast.success(`Launched ${targetApp === 'franchise' ? 'Franchise Suite' : 'Restaurant Manager'} for ${branch.name}`);
      } else {
        const fallbackUrl = targetApp === 'franchise'
          ? `http://localhost:5175?branchId=${encodeURIComponent(branch.id)}`
          : `http://localhost:5176?branchId=${encodeURIComponent(branch.id)}&branchName=${encodeURIComponent(branch.name)}`;
        window.open(fallbackUrl, '_blank');
      }
    } catch (err: any) {
      toast.error('Failed to generate scoped session');
    }
  };

  const handleToggleActive = async (branch: FranchiseBranch) => {
    const nextStatus = !branch.isActive;
    try {
      await fetchApi(`/api/franchises/${branch.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: nextStatus })
      }).catch(() => {});

      await updateDoc(doc(db, 'franchises', branch.id), {
        isActive: nextStatus,
        updatedAt: new Date().toISOString()
      }).catch(() => {});

      setBranches(prev => prev.map(b => b.id === branch.id ? { ...b, isActive: nextStatus } : b));
      toast.success(`Franchise ${nextStatus ? 'activated' : 'deactivated'}`);
    } catch (e: any) {
      toast.error('Failed to update status');
    }
  };

  const handleProvisionFranchise = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wizName.trim() || !wizCity.trim()) {
      toast.error('Franchise name and city are required');
      return;
    }

    setIsSubmitting(true);
    const cleanCode = wizCode ? wizCode.trim().toUpperCase() : `OP-${wizCity.slice(0, 3).toUpperCase()}-01`;
    const branchId = `${wizCity.toLowerCase().replace(/[^a-z0-9]/g, '_')}_branch`;

    const payload = {
      name: wizName.trim(),
      code: cleanCode,
      city: wizCity.trim(),
      state: wizState.trim(),
      address: wizAddress.trim() || `${wizCity}, Chhattisgarh`,
      lat: Number(wizLat) || 21.0810244,
      lng: Number(wizLng) || 81.0123793,
      phone: wizPhone.trim() || '+91 91799 44445',
      email: wizEmail.trim() || `branch.${wizCity.toLowerCase()}@olivepizza.in`,
      franchiseOwnerEmail: wizFranchiseOwnerEmail.trim(),
      franchiseOwnerName: wizFranchiseOwnerName.trim() || 'Franchise Owner',
      restaurantManagerEmail: wizRestaurantManagerEmail.trim(),
      restaurantManagerName: wizRestaurantManagerName.trim() || 'Restaurant Manager',
      maxDeliveryRadiusKm: Number(wizMaxRadius) || 12,
      openingTime: wizOpenTime || '12:00',
      closingTime: wizCloseTime || '23:59',
      posTerminalCount: Number(wizPosCount) || 1,
      posTerminalNames: wizPosNames
    };

    try {
      const res = await fetchApi('/api/franchises/provision', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => null);

      if (res.ok || data?.success) {
        toast.success('Franchise, Staff Accounts & POS Terminals Provisioned!');
      } else {
        // Fallback local set
        await setDoc(doc(db, 'franchises', branchId), {
          id: branchId,
          ...payload,
          isActive: true,
          createdAt: new Date().toISOString()
        }, { merge: true });
        toast.success('Franchise created successfully');
      }

      setIsProvisionWizardOpen(false);
      setWizardStep(1);
      setWizName('');
      setWizCode('');
      setWizCity('');
      setWizAddress('');
      loadBranches();
    } catch (err: any) {
      toast.error('Provisioning error: ' + err?.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredBranches = branches.filter((b) => {
    const matchesSearch =
      b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (b.franchiseOwnerEmail || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (b.restaurantManagerEmail || '').toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;
    if (statusFilter === 'active') return b.isActive;
    if (statusFilter === 'inactive') return !b.isActive;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-400">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Franchise Management Console
              </h1>
              <p className="text-xs text-slate-400">
                Central platform control for provisioning franchises, staff accounts, POS terminals, and map locations.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => loadBranches()}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => {
              setWizardStep(1);
              setIsProvisionWizardOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs shadow-lg shadow-orange-500/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Create Franchise</span>
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Franchises</p>
          <p className="text-2xl font-black text-white mt-1">{branches.length}</p>
        </div>
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
          <p className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Active Stores</p>
          <p className="text-2xl font-black text-emerald-400 mt-1">{branches.filter(b => b.isActive).length}</p>
        </div>
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
          <p className="text-xs font-bold text-amber-400 uppercase tracking-wider">Total POS Terminals</p>
          <p className="text-2xl font-black text-amber-400 mt-1">
            {branches.reduce((acc, b) => acc + (b.posTerminalCount || 1), 0)}
          </p>
        </div>
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
          <p className="text-xs font-bold text-cyan-400 uppercase tracking-wider">Staff Bound</p>
          <p className="text-2xl font-black text-cyan-400 mt-1">
            {branches.filter(b => b.restaurantManagerEmail).length + branches.filter(b => b.franchiseOwnerEmail).length}
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 rounded-2xl bg-slate-900 border border-slate-800">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by franchise, city, code, email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto">
          {(['all', 'active', 'inactive'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition-colors ${
                statusFilter === tab
                  ? 'bg-orange-500 text-white shadow-sm'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Franchise List Table & Cards */}
      <div className="space-y-4">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs font-bold">
            Loading franchises & branch records...
          </div>
        ) : filteredBranches.length === 0 ? (
          <div className="p-12 rounded-3xl bg-slate-900 border border-slate-800 text-center space-y-3">
            <Building2 className="w-12 h-12 text-slate-600 mx-auto" />
            <p className="text-sm font-bold text-white">No franchises found</p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Create a new franchise using the Provisioning Wizard above.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredBranches.map((branch) => (
              <div
                key={branch.id}
                className="p-5 rounded-3xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all space-y-4 shadow-xl"
              >
                {/* Card Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-extrabold text-white text-base leading-tight">
                        {branch.name}
                      </h3>
                      {branch.isHeadquarters && (
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-orange-500/20 text-orange-400 border border-orange-500/30">
                          HQ
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <span className="font-mono text-orange-400 font-bold">{branch.code}</span>
                      <span>•</span>
                      <span>{branch.city}, {branch.state}</span>
                    </div>
                  </div>

                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                      branch.isActive
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${branch.isActive ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                    {branch.isActive ? 'Active' : 'Disabled'}
                  </span>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Franchise Owner</span>
                    <span className="text-white font-medium truncate block" title={branch.franchiseOwnerEmail || 'Unassigned'}>
                      {branch.franchiseOwnerEmail || 'Unassigned'}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Restaurant Manager</span>
                    <span className="text-white font-medium truncate block" title={branch.restaurantManagerEmail || 'Unassigned'}>
                      {branch.restaurantManagerEmail || 'Unassigned'}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">POS Terminals</span>
                    <span className="text-amber-400 font-bold block">
                      {branch.posTerminalCount || 1} Active Counters
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Delivery Radius</span>
                    <span className="text-cyan-400 font-bold block">
                      {branch.maxDeliveryRadiusKm || 12} km Radius
                    </span>
                  </div>
                </div>

                {/* Location address */}
                <div className="flex items-start gap-2 text-xs text-slate-400 bg-slate-950/40 p-2.5 rounded-xl border border-slate-800/60">
                  <MapPin className="w-3.5 h-3.5 text-orange-400 shrink-0 mt-0.5" />
                  <span className="line-clamp-1">{branch.address}</span>
                </div>

                {/* Launch & Management Buttons */}
                <div className="pt-2 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleOpenLaunch('franchise', branch)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 font-bold text-xs transition-colors cursor-pointer"
                      title="Open Franchise Management Suite"
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>Franchise Suite</span>
                    </button>

                    <button
                      onClick={() => handleOpenLaunch('restaurant_management', branch)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 font-bold text-xs transition-colors cursor-pointer"
                      title="Open Restaurant Manager & KDS"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Restaurant KDS</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setViewingBranch(branch)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                      title="View Details"
                    >
                      <Eye className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => handleToggleActive(branch)}
                      className={`p-1.5 rounded-lg border transition-colors ${
                        branch.isActive
                          ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border-rose-500/30'
                          : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                      }`}
                      title={branch.isActive ? 'Deactivate Franchise' : 'Activate Franchise'}
                    >
                      <Power className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── 7-STEP PROVISIONING WIZARD MODAL ─── */}
      {isProvisionWizardOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div>
                <h2 className="text-lg font-black text-white flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-orange-400" />
                  <span>Provision New Franchise</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Step {wizardStep} of 7 — Enterprise Multi-Tenancy Provisioning
                </p>
              </div>
              <button
                onClick={() => setIsProvisionWizardOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Step Indicators */}
            <div className="flex items-center justify-between gap-1 overflow-x-auto pb-2">
              {[
                { s: 1, label: 'Franchise' },
                { s: 2, label: 'Owner Account' },
                { s: 3, label: 'Branch' },
                { s: 4, label: 'Manager' },
                { s: 5, label: 'Map Location' },
                { s: 6, label: 'POS Terminals' },
                { s: 7, label: 'Review' },
              ].map((st) => (
                <div
                  key={st.s}
                  onClick={() => setWizardStep(st.s)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold cursor-pointer whitespace-nowrap ${
                    wizardStep === st.s
                      ? 'bg-orange-500 text-white'
                      : wizardStep > st.s
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-slate-950 text-slate-500 border border-slate-800'
                  }`}
                >
                  <span>{st.s}.</span>
                  <span>{st.label}</span>
                </div>
              ))}
            </div>

            {/* Wizard Forms */}
            <form onSubmit={handleProvisionFranchise} className="space-y-4">
              {wizardStep === 1 && (
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-white">Step 1: Franchise Information</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Franchise Name *</label>
                      <input
                        type="text"
                        required
                        value={wizName}
                        onChange={(e) => setWizName(e.target.value)}
                        placeholder="e.g. Olive Pizza — Raipur"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-orange-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Franchise Code *</label>
                      <input
                        type="text"
                        value={wizCode}
                        onChange={(e) => setWizCode(e.target.value)}
                        placeholder="e.g. OP-RPR-04"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-orange-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">City *</label>
                      <input
                        type="text"
                        required
                        value={wizCity}
                        onChange={(e) => setWizCity(e.target.value)}
                        placeholder="e.g. Raipur"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-orange-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">State</label>
                      <input
                        type="text"
                        value={wizState}
                        onChange={(e) => setWizState(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-orange-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {wizardStep === 2 && (
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-white">Step 2: Franchise Owner Account Assignment</h3>
                  <p className="text-xs text-slate-400">
                    The Franchise Owner account receives restricted access to the Franchise Suite for this franchise only.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Franchise Owner Email *</label>
                      <input
                        type="email"
                        value={wizFranchiseOwnerEmail}
                        onChange={(e) => setWizFranchiseOwnerEmail(e.target.value)}
                        placeholder="franchise.owner@olivepizza.in"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-orange-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Full Name</label>
                      <input
                        type="text"
                        value={wizFranchiseOwnerName}
                        onChange={(e) => setWizFranchiseOwnerName(e.target.value)}
                        placeholder="e.g. Rajesh Agrawal"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-orange-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {wizardStep === 3 && (
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-white">Step 3: Branch Operational Parameters</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Phone Number</label>
                      <input
                        type="text"
                        value={wizPhone}
                        onChange={(e) => setWizPhone(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-orange-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Store Email</label>
                      <input
                        type="email"
                        value={wizEmail}
                        onChange={(e) => setWizEmail(e.target.value)}
                        placeholder="branch@olivepizza.in"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-orange-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Opening Time</label>
                      <input
                        type="time"
                        value={wizOpenTime}
                        onChange={(e) => setWizOpenTime(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-orange-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Closing Time</label>
                      <input
                        type="time"
                        value={wizCloseTime}
                        onChange={(e) => setWizCloseTime(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-orange-500"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-xs text-slate-400 block mb-1">Delivery Radius (km)</label>
                      <input
                        type="number"
                        value={wizMaxRadius}
                        onChange={(e) => setWizMaxRadius(Number(e.target.value))}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-orange-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {wizardStep === 4 && (
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-white">Step 4: Restaurant Manager Account</h3>
                  <p className="text-xs text-slate-400">
                    The Restaurant Manager account is locked to this branch's KDS, live orders, and kitchen inventory.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Manager Email *</label>
                      <input
                        type="email"
                        value={wizRestaurantManagerEmail}
                        onChange={(e) => setWizRestaurantManagerEmail(e.target.value)}
                        placeholder="manager.raipur@olivepizza.in"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-orange-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Manager Name</label>
                      <input
                        type="text"
                        value={wizRestaurantManagerName}
                        onChange={(e) => setWizRestaurantManagerName(e.target.value)}
                        placeholder="e.g. Manoj Sharma"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-orange-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {wizardStep === 5 && (
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-white">Step 5: Exact Location on Map</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Full Street Address *</label>
                      <input
                        type="text"
                        value={wizAddress}
                        onChange={(e) => setWizAddress(e.target.value)}
                        placeholder="e.g. VIP Road, Telibandha, Raipur, Chhattisgarh 492006"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-orange-500"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-slate-400 block mb-1">Latitude</label>
                        <input
                          type="text"
                          value={wizLat}
                          onChange={(e) => setWizLat(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-orange-500 font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-400 block mb-1">Longitude</label>
                        <input
                          type="text"
                          value={wizLng}
                          onChange={(e) => setWizLng(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-orange-500 font-mono"
                        />
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs text-slate-400">
                      <span className="flex items-center gap-1.5">
                        <MapPin className="w-4 h-4 text-orange-400" />
                        <span>Coordinates: {wizLat}, {wizLng}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          if (navigator.geolocation) {
                            navigator.geolocation.getCurrentPosition((pos) => {
                              setWizLat(pos.coords.latitude.toFixed(6));
                              setWizLng(pos.coords.longitude.toFixed(6));
                              toast.success('Updated coordinates from GPS');
                            });
                          }
                        }}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold text-[11px]"
                      >
                        Use Current GPS
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {wizardStep === 6 && (
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-white">Step 6: POS Terminal Provisioning</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Number of Billing Counters</label>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={wizPosCount}
                        onChange={(e) => {
                          const count = Math.max(1, Number(e.target.value));
                          setWizPosCount(count);
                          setWizPosNames(Array.from({ length: count }, (_, i) => `Counter ${i + 1}`));
                        }}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-orange-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs text-slate-400 block">Terminal Names</label>
                      {wizPosNames.map((tName, idx) => (
                        <input
                          key={idx}
                          type="text"
                          value={tName}
                          onChange={(e) => {
                            const newArr = [...wizPosNames];
                            newArr[idx] = e.target.value;
                            setWizPosNames(newArr);
                          }}
                          className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-orange-500"
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {wizardStep === 7 && (
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-white">Step 7: Review & Atomically Provision</h3>
                  <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-slate-800/80">
                      <span className="text-slate-400">Franchise:</span>
                      <strong className="text-white">{wizName || 'Untitled'} ({wizCode || 'Auto'})</strong>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-800/80">
                      <span className="text-slate-400">Location:</span>
                      <span className="text-white">{wizCity}, {wizState}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-800/80">
                      <span className="text-slate-400">Franchise Owner:</span>
                      <span className="text-amber-400">{wizFranchiseOwnerEmail || 'None'}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-800/80">
                      <span className="text-slate-400">Restaurant Manager:</span>
                      <span className="text-emerald-400">{wizRestaurantManagerEmail || 'None'}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-800/80">
                      <span className="text-slate-400">POS Terminals:</span>
                      <span className="text-white">{wizPosCount} Counters</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-400">GPS Coordinates:</span>
                      <span className="text-white font-mono">{wizLat}, {wizLng}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Wizard Navigation Buttons */}
              <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
                {wizardStep > 1 ? (
                  <button
                    type="button"
                    onClick={() => setWizardStep(wizardStep - 1)}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors"
                  >
                    Back
                  </button>
                ) : <div />}

                {wizardStep < 7 ? (
                  <button
                    type="button"
                    onClick={() => setWizardStep(wizardStep + 1)}
                    className="px-5 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs shadow-lg shadow-orange-500/20 transition-all flex items-center gap-1.5"
                  >
                    <span>Next Step</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-lg shadow-emerald-600/20 transition-all flex items-center gap-2 disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Provision Franchise Now</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── FRANCHISE DETAIL VIEW MODAL ─── */}
      {viewingBranch && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-lg font-black text-white">{viewingBranch.name}</h3>
                <span className="text-xs font-mono text-orange-400 font-bold">{viewingBranch.code}</span>
              </div>
              <button
                onClick={() => setViewingBranch(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-white bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Address & Coordinates</span>
                <p className="text-slate-200">{viewingBranch.address}</p>
                <p className="text-slate-400 font-mono text-[11px]">{viewingBranch.lat}, {viewingBranch.lng}</p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Franchise Owner</span>
                  <p className="text-amber-400 font-bold">{viewingBranch.franchiseOwnerEmail || 'Not assigned'}</p>
                </div>
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Restaurant Manager</span>
                  <p className="text-emerald-400 font-bold">{viewingBranch.restaurantManagerEmail || 'Not assigned'}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Operational Hours</span>
                  <p className="text-white">{viewingBranch.openingTime} – {viewingBranch.closingTime}</p>
                </div>
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">POS Terminals</span>
                  <p className="text-cyan-400 font-bold">{viewingBranch.posTerminalCount || 1} Counters Active</p>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
              <button
                onClick={() => setViewingBranch(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
