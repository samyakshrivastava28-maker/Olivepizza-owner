import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import {
  Store,
  Building2,
  Users,
  Monitor,
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
  Check
} from 'lucide-react';
import { fetchApi } from '../lib/api';
import toast from 'react-hot-toast';

export default function RestaurantControlPage() {
  const { franchiseSlug, restaurantSlug } = useParams<{ franchiseSlug: string; restaurantSlug: string }>();
  const navigate = useNavigate();

  const currentFranchiseSlug = (franchiseSlug || 'rajnandgaon').toLowerCase();
  const currentRestaurantSlug = (restaurantSlug || 'main_branch').toLowerCase();

  const [activeTab, setActiveTab] = useState<string>('overview');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [restaurant, setRestaurant] = useState<any>(null);
  const [franchise, setFranchise] = useState<any>(null);

  // Form states for settings
  const [openingTime, setOpeningTime] = useState('12:00');
  const [closingTime, setClosingTime] = useState('23:59');
  const [maxRadius, setMaxRadius] = useState(15);
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [isAcceptingOrders, setIsAcceptingOrders] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);

  // Permission settings
  const [selectedManager, setSelectedManager] = useState<any>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [savingPermissions, setSavingPermissions] = useState(false);

  const ALL_PERMISSIONS = [
    { id: 'orders.live', label: 'Live Orders Acceptance & Preparation' },
    { id: 'orders.history', label: 'View Order History & Invoices' },
    { id: 'kitchen.kds', label: 'Kitchen Display System (KDS) Queue' },
    { id: 'inventory.view', label: 'View Inventory & Stock Alerts' },
    { id: 'inventory.mutate', label: 'Modify Stock & Mark Out-of-Stock' },
    { id: 'delivery.view', label: 'View Delivery Fleet & Telemetry' },
    { id: 'notifications.send', label: 'Send Customer & Staff Alerts' },
    { id: 'pos.billing', label: 'Authorize POS Billing & Shifts' },
  ];

  const loadRestaurantControl = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Resolve Franchise
      const fRes = await fetchApi(`/api/franchises/by-slug/${currentFranchiseSlug}`);
      if (!fRes.ok) throw new Error('Franchise not found or access denied');
      const fData = await fRes.json();
      setFranchise(fData.franchise);

      // 2. Resolve Restaurant
      const rRes = await fetchApi(`/api/franchises/${fData.franchise.id}/restaurants/${currentRestaurantSlug}`);
      if (!rRes.ok) throw new Error('Restaurant/Branch control data not found');
      const rData = await rRes.json();
      const rest = rData.restaurant;
      setRestaurant(rest);

      // Populate form
      setOpeningTime(rest.openingTime || '12:00');
      setClosingTime(rest.closingTime || '23:59');
      setMaxRadius(rest.maxDeliveryRadiusKm || 15);
      setAddress(rest.address || '');
      setPhone(rest.phone || '');
      setIsAcceptingOrders(rest.isActive !== false);

      if (rest.managers && rest.managers.length > 0) {
        setSelectedManager(rest.managers[0]);
        setPermissions(rest.managers[0].permissions || ['orders.live', 'orders.history', 'kitchen.kds', 'inventory.view']);
      }

      setLoading(false);
    } catch (err: any) {
      console.error('[RestaurantControlPage] Error loading data:', err);
      setError(err.message || 'Failed to load restaurant control page');
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRestaurantControl();
  }, [currentFranchiseSlug, currentRestaurantSlug]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!franchise || !restaurant) return;
    setSavingSettings(true);
    try {
      const res = await fetchApi(`/api/franchises/${franchise.id}/restaurants/${restaurant.id}/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          openingTime,
          closingTime,
          maxDeliveryRadiusKm: Number(maxRadius),
          address,
          phone,
          isAcceptingOrders
        }),
      });

      if (!res.ok) throw new Error('Failed to update restaurant settings');
      toast.success('Restaurant operating parameters updated successfully!');
    } catch (err: any) {
      toast.error(err.message || 'Save failed');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleTogglePermission = (permId: string) => {
    setPermissions((prev) =>
      prev.includes(permId) ? prev.filter((p) => p !== permId) : [...prev, permId]
    );
  };

  const handleSavePermissions = async () => {
    if (!franchise || !selectedManager) return;
    setSavingPermissions(true);
    try {
      const res = await fetchApi(`/api/franchises/${franchise.id}/permissions`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUserId: selectedManager.id,
          targetRole: 'restaurant_manager',
          permissions
        }),
      });

      if (!res.ok) throw new Error('Failed to update manager permissions');
      toast.success(`Permissions updated for ${selectedManager.name}!`);
    } catch (err: any) {
      toast.error(err.message || 'Permission update failed');
    } finally {
      setSavingPermissions(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] text-center p-6">
        <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mb-4" />
        <h3 className="text-lg font-semibold text-white">Loading Restaurant Control...</h3>
        <p className="text-xs text-slate-400 mt-1">Fetching administrative settings for <span className="text-amber-400 font-mono font-bold">{currentRestaurantSlug}</span></p>
      </div>
    );
  }

  if (error || !restaurant || !franchise) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] text-center p-6">
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-400 max-w-md mb-4">
          <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-red-400" />
          <h3 className="text-base font-bold text-white mb-1">Restaurant Control Error</h3>
          <p className="text-xs text-red-300">{error || 'Restaurant details could not be found.'}</p>
        </div>
        <button
          onClick={() => navigate(`/franchise-management/${currentFranchiseSlug}`)}
          className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-black text-xs font-bold rounded-xl transition"
        >
          Back to Franchise Workspace
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ─── 1. RESTAURANT TOP BAR & SHORTCUTS ─────────────────────────────────── */}
      <div className="bg-slate-900/90 backdrop-blur border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(`/franchise-management/${currentFranchiseSlug}`)}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl transition"
            title="Back to Franchise Workspace"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold">
            <Store className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-white tracking-tight">{restaurant.name}</h1>
              <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-md text-[10px] font-mono font-bold">
                {restaurant.code}
              </span>
              <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-md text-[10px] font-bold uppercase">
                {restaurant.isActive ? 'ACTIVE' : 'INACTIVE'}
              </span>
            </div>
            <p className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
              <span>Franchise: <strong className="text-slate-300">{franchise.name}</strong></span>
              <span>•</span>
              <span className="text-slate-400">{restaurant.city}, Chhattisgarh</span>
            </p>
          </div>
        </div>

        {/* Action: Open Separate Operational App */}
        <div className="flex items-center gap-2">
          <a
            href="http://localhost:5176"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-amber-400 hover:text-amber-300 border border-slate-700 rounded-xl text-xs font-bold transition shadow-sm"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Open Restaurant Management App (Port 5176)</span>
          </a>
        </div>
      </div>

      {/* ─── 2. SUB-TABS ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 border-b border-slate-800 scrollbar-none text-xs font-semibold">
        {[
          { id: 'overview', label: 'Operational Overview', icon: Layers },
          { id: 'settings', label: 'Hours & Delivery Settings', icon: Settings },
          { id: 'permissions', label: 'Manager Permissions', icon: Key },
          { id: 'pos', label: `POS Terminals (${restaurant.posTerminals?.length || 0})`, icon: Monitor },
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
            </button>
          );
        })}
      </div>

      {/* ─── 3. TAB CONTENT ───────────────────────────────────────────────────── */}

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <p className="text-[11px] text-slate-400 uppercase font-semibold">Restaurant Details</p>
              <h4 className="text-sm font-bold text-white mt-1">{restaurant.name}</h4>
              <p className="text-xs text-slate-400 mt-2 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                {restaurant.address}
              </p>
              <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                {restaurant.phone || '+91 91799 44445'}
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <p className="text-[11px] text-slate-400 uppercase font-semibold">Assigned Restaurant Manager</p>
              <h4 className="text-sm font-bold text-emerald-400 mt-1">
                {restaurant.managers?.[0]?.name || 'Primary Branch Manager'}
              </h4>
              <p className="text-xs text-slate-300 mt-1">{restaurant.managers?.[0]?.email || 'webhub2811@gmail.com'}</p>
              <div className="mt-3 pt-2 border-t border-slate-800 flex justify-between items-center text-xs">
                <span className="text-slate-500">Role: Manager</span>
                <span className="text-emerald-400 font-bold uppercase text-[10px]">Active Access</span>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <p className="text-[11px] text-slate-400 uppercase font-semibold">Live Operational Status</p>
              <div className="mt-2 space-y-2 text-xs">
                <div className="flex justify-between text-slate-300">
                  <span>Accepting Online Orders:</span>
                  <span className="text-emerald-400 font-bold">YES</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>Operating Hours:</span>
                  <span className="font-mono text-amber-400 font-bold">{restaurant.openingTime || '12:00'} - {restaurant.closingTime || '23:59'}</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>Delivery Radius:</span>
                  <span className="font-mono text-white font-bold">{restaurant.maxDeliveryRadiusKm || 15} km</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SETTINGS */}
      {activeTab === 'settings' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-2xl">
          <h3 className="text-sm font-bold text-white mb-4">Configure Operating Hours & Delivery Radius</h3>
          <form onSubmit={handleSaveSettings} className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-slate-400 block mb-1">Daily Opening Time</label>
                <input
                  type="time"
                  value={openingTime}
                  onChange={(e) => setOpeningTime(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Daily Closing Time</label>
                <input
                  type="time"
                  value={closingTime}
                  onChange={(e) => setClosingTime(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono"
                />
              </div>
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Max Delivery Radius (Kilometers)</label>
              <input
                type="number"
                min="1"
                max="50"
                value={maxRadius}
                onChange={(e) => setMaxRadius(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono"
              />
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Address</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
              />
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Contact Phone</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono"
              />
            </div>

            <button
              type="submit"
              disabled={savingSettings}
              className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 font-bold text-black rounded-xl transition"
            >
              {savingSettings ? 'Saving...' : 'Save Restaurant Settings'}
            </button>
          </form>
        </div>
      )}

      {/* TAB 3: PERMISSIONS */}
      {activeTab === 'permissions' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-2xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white">Restaurant Manager Permissions</h3>
              <p className="text-xs text-slate-400">Server-enforced RBAC capabilities for this restaurant's manager account</p>
            </div>
            <button
              onClick={handleSavePermissions}
              disabled={savingPermissions}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-black font-bold rounded-xl text-xs transition"
            >
              {savingPermissions ? 'Updating...' : 'Save Permissions'}
            </button>
          </div>

          <div className="space-y-2 pt-2">
            {ALL_PERMISSIONS.map((p) => {
              const isChecked = permissions.includes(p.id);
              return (
                <label
                  key={p.id}
                  onClick={() => handleTogglePermission(p.id)}
                  className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition text-xs ${
                    isChecked
                      ? 'bg-amber-500/10 border-amber-500/40 text-white'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <span className="font-medium">{p.label}</span>
                  <div className={`w-5 h-5 rounded-md flex items-center justify-center border ${isChecked ? 'bg-amber-500 border-amber-500 text-black font-bold' : 'border-slate-700'}`}>
                    {isChecked && <Check className="w-3.5 h-3.5" />}
                  </div>
                </label>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 4: POS TERMINALS */}
      {activeTab === 'pos' && (
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-white">Assigned POS Terminals</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {restaurant.posTerminals?.map((t: any) => (
              <div key={t.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold text-white">{t.terminalName}</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-500/20 text-emerald-400">
                    {t.activationStatus || 'ACTIVATED'}
                  </span>
                </div>
                <p className="text-xs text-slate-400 font-mono">ID: {t.id}</p>
                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex justify-between items-center text-xs">
                  <span className="text-slate-400">Activation Code:</span>
                  <span className="text-amber-400 font-mono font-bold text-sm tracking-widest">{t.activationCode || '741852'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
