import React, { useState, useEffect } from 'react';
import { fetchApi } from '../lib/api';
import { TableSkeleton } from '../components/ui/Skeleton';
import { ErrorState } from '../components/ui/ErrorState';
import { Modal } from '../components/ui/Modal';
import { StatCard } from '../components/ui/StatCard';
import { 
  Building2, 
  Plus, 
  CheckCircle2, 
  Edit2, 
  Store,
  Layers
} from 'lucide-react';
import toast from 'react-hot-toast';

interface Branch {
  id: string;
  organizationId: string;
  franchiseId: string;
  name: string;
  code: string;
  city: string;
  state: string;
  address: string;
  lat: number;
  lng: number;
  phone: string;
  email: string;
  maxDeliveryRadiusKm: number;
  openingTime: string;
  closingTime: string;
  isActive: boolean;
  isHeadquarters?: boolean;
}

export default function Franchises() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState<Partial<Branch>>({
    name: '',
    code: '',
    city: '',
    state: 'Chhattisgarh',
    address: '',
    lat: 21.0810244,
    lng: 81.0123793,
    phone: '+91 91799 44445',
    email: '',
    maxDeliveryRadiusKm: 12,
    openingTime: '12:00',
    closingTime: '23:59',
    isActive: true,
  });

  const fetchBranches = async () => {
    setLoading(true);
    try {
      const res = await fetchApi('/api/franchises');
      const data = await res.json();
      if (res.ok && data.branches) {
        setBranches(data.branches);
      } else {
        throw new Error(data.error || 'Failed to load franchise branches');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBranches();
  }, []);

  const handleOpenAdd = () => {
    setEditingBranch(null);
    setFormData({
      name: '',
      code: '',
      city: '',
      state: 'Chhattisgarh',
      address: '',
      lat: 21.0810244,
      lng: 81.0123793,
      phone: '+91 91799 44445',
      email: '',
      maxDeliveryRadiusKm: 12,
      openingTime: '12:00',
      closingTime: '23:59',
      isActive: true,
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (b: Branch) => {
    setEditingBranch(b);
    setFormData({ ...b });
    setIsModalOpen(true);
  };

  const handleToggleStatus = async (b: Branch) => {
    try {
      const res = await fetchApi(`/api/franchises/${b.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !b.isActive }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update branch status');
      toast.success(`Branch ${b.name} ${!b.isActive ? 'activated' : 'deactivated'}`);
      fetchBranches();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.city) {
      toast.error('Branch name and city are required.');
      return;
    }

    setSaving(true);
    try {
      if (editingBranch) {
        const res = await fetchApi(`/api/franchises/${editingBranch.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to update branch');
        toast.success('Branch details updated successfully');
      } else {
        const res = await fetchApi('/api/franchises', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to create branch');
        toast.success('New franchise branch provisioned successfully');
      }
      setIsModalOpen(false);
      fetchBranches();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const activeBranches = branches.filter((b) => b.isActive);

  return (
    <div className="space-y-6">
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingBranch ? `Edit ${editingBranch.name}` : 'Provision New Franchise Branch'}
        maxWidth="max-w-xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-300 uppercase block mb-1">Branch Name *</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Olive Pizza — Bilaspur"
                className="w-full p-2.5 bg-[#0E1524] border border-slate-800 rounded-xl text-xs text-white focus:border-orange-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-300 uppercase block mb-1">Branch Code *</label>
              <input
                type="text"
                required
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                placeholder="OP-BSP-05"
                className="w-full p-2.5 bg-[#0E1524] border border-slate-800 rounded-xl text-xs text-white font-mono uppercase focus:border-orange-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-300 uppercase block mb-1">City *</label>
              <input
                type="text"
                required
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                placeholder="Bilaspur"
                className="w-full p-2.5 bg-[#0E1524] border border-slate-800 rounded-xl text-xs text-white focus:border-orange-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-300 uppercase block mb-1">State</label>
              <input
                type="text"
                value={formData.state}
                onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                placeholder="Chhattisgarh"
                className="w-full p-2.5 bg-[#0E1524] border border-slate-800 rounded-xl text-xs text-white focus:border-orange-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-300 uppercase block mb-1">Full Street Address</label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="Main Road, Near City Mall, Bilaspur, CG 495001"
              className="w-full p-2.5 bg-[#0E1524] border border-slate-800 rounded-xl text-xs text-white focus:border-orange-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-300 uppercase block mb-1">Store Phone</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+91 91799 44445"
                className="w-full p-2.5 bg-[#0E1524] border border-slate-800 rounded-xl text-xs text-white font-mono focus:border-orange-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-300 uppercase block mb-1">Store Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="branch@olivepizza.in"
                className="w-full p-2.5 bg-[#0E1524] border border-slate-800 rounded-xl text-xs text-white focus:border-orange-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-300 uppercase block mb-1">Max Radius (km)</label>
              <input
                type="number"
                min="1"
                max="50"
                value={formData.maxDeliveryRadiusKm}
                onChange={(e) => setFormData({ ...formData, maxDeliveryRadiusKm: Number(e.target.value) })}
                className="w-full p-2.5 bg-[#0E1524] border border-slate-800 rounded-xl text-xs text-white font-mono focus:border-orange-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-300 uppercase block mb-1">Opening Time</label>
              <input
                type="text"
                value={formData.openingTime}
                onChange={(e) => setFormData({ ...formData, openingTime: e.target.value })}
                placeholder="12:00"
                className="w-full p-2.5 bg-[#0E1524] border border-slate-800 rounded-xl text-xs text-white font-mono focus:border-orange-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-300 uppercase block mb-1">Closing Time</label>
              <input
                type="text"
                value={formData.closingTime}
                onChange={(e) => setFormData({ ...formData, closingTime: e.target.value })}
                placeholder="23:59"
                className="w-full p-2.5 bg-[#0E1524] border border-slate-800 rounded-xl text-xs text-white font-mono focus:border-orange-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-300 uppercase block mb-1">Store Latitude</label>
              <input
                type="number"
                step="0.0000001"
                value={formData.lat}
                onChange={(e) => setFormData({ ...formData, lat: Number(e.target.value) })}
                className="w-full p-2.5 bg-[#0E1524] border border-slate-800 rounded-xl text-xs text-white font-mono focus:border-orange-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-300 uppercase block mb-1">Store Longitude</label>
              <input
                type="number"
                step="0.0000001"
                value={formData.lng}
                onChange={(e) => setFormData({ ...formData, lng: Number(e.target.value) })}
                className="w-full p-2.5 bg-[#0E1524] border border-slate-800 rounded-xl text-xs text-white font-mono focus:border-orange-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={saving}
              className="w-full py-2.5 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition-colors"
            >
              {saving ? 'Saving Branch...' : 'Save & Provision Branch'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2.5">
            <Building2 className="w-6 h-6 text-orange-400" />
            Franchise & Branch Management
          </h2>
          <p className="text-xs text-slate-400">
            Multi-branch operational hierarchy, regional provisioning, and delivery geofence controls.
          </p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold rounded-xl flex items-center gap-2 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Add Franchise Branch
        </button>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Total Branches"
          value={branches.length}
          subtitle="Configured restaurant nodes"
          icon={Store}
          color="orange"
        />
        <StatCard
          title="Active & Operating"
          value={activeBranches.length}
          subtitle="Currently accepting orders"
          icon={CheckCircle2}
          color="green"
        />
        <StatCard
          title="Primary Region"
          value="Chhattisgarh"
          subtitle="Primary Franchise (fra_primary)"
          icon={Layers}
          color="blue"
        />
      </div>

      {error && <ErrorState message={error} onRetry={fetchBranches} />}

      {/* Branches Table */}
      <div className="bg-[#131B2B] border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-800 font-bold text-xs text-white flex items-center justify-between">
          <span>Configured Branches & Locations</span>
          <span className="text-slate-400 font-normal">{branches.length} total branches</span>
        </div>

        {loading ? (
          <div className="p-5">
            <TableSkeleton rows={4} cols={5} />
          </div>
        ) : branches.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">No branches found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#0E1524] text-slate-400 font-bold border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Branch</th>
                  <th className="py-3 px-4">City / Region</th>
                  <th className="py-3 px-4">Max Radius</th>
                  <th className="py-3 px-4">Hours</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {branches.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-800/40">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-slate-800 flex items-center justify-center text-orange-400 shrink-0">
                          <Store className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="font-bold text-white flex items-center gap-1.5">
                            {b.name}
                            {b.isHeadquarters && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400 font-mono">
                                HQ
                              </span>
                            )}
                          </p>
                          <p className="text-[10px] text-slate-400 font-mono">{b.code} • ID: {b.id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-300">
                      <p className="font-bold text-white">{b.city}, {b.state}</p>
                      <p className="text-[11px] text-slate-400 truncate max-w-xs">{b.address}</p>
                    </td>
                    <td className="py-3 px-4 font-mono text-emerald-400 font-bold">
                      {b.maxDeliveryRadiusKm} km
                    </td>
                    <td className="py-3 px-4 text-slate-300 font-mono text-[11px]">
                      {b.openingTime} - {b.closingTime}
                    </td>
                    <td className="py-3 px-4">
                      <button
                        onClick={() => handleToggleStatus(b)}
                        className={`px-2.5 py-1 rounded text-[10px] font-bold transition-colors ${
                          b.isActive
                            ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                            : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                        }`}
                      >
                        {b.isActive ? '● Operating' : '○ Inactive'}
                      </button>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleOpenEdit(b)}
                        className="p-1.5 text-slate-400 hover:text-white transition-colors"
                        title="Edit Branch"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
