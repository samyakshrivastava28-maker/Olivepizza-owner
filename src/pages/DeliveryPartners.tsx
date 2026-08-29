import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import {
  collection,
  query,
  onSnapshot,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
} from 'firebase/firestore';
import { DeliveryPartner } from '../types/models';
import { TableSkeleton } from '../components/ui/Skeleton';
import { ErrorState } from '../components/ui/ErrorState';
import { EmptyState } from '../components/ui/EmptyState';
import { Modal } from '../components/ui/Modal';
import { 
  Bike, 
  Plus, 
  Phone, 
  Trash2, 
  Edit2, 
  Radio, 
  ListFilter 
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function DeliveryPartners() {
  const [partners, setPartners] = useState<DeliveryPartner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'roster' | 'radar'>('roster');
  const [selectedRider, setSelectedRider] = useState<DeliveryPartner | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPartner, setEditingPartner] = useState<DeliveryPartner | null>(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState<Partial<DeliveryPartner>>({
    name: '',
    phone: '',
    email: '',
    vehicleType: 'Motorcycle',
    vehicleNumber: '',
    isOnline: true,
  });

  useEffect(() => {
    const q = query(collection(db, 'delivery_partners'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setPartners(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as DeliveryPartner[]);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  const handleOpenAdd = () => {
    setEditingPartner(null);
    setFormData({
      name: '',
      phone: '',
      email: '',
      vehicleType: 'Motorcycle',
      vehicleNumber: '',
      isOnline: true,
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (p: DeliveryPartner) => {
    setEditingPartner(p);
    setFormData({ ...p });
    setIsModalOpen(true);
  };

  const handleToggleOnline = async (p: DeliveryPartner) => {
    try {
      await updateDoc(doc(db, 'delivery_partners', p.id), {
        isOnline: !p.isOnline,
        lastActiveAt: new Date(),
      });
      toast.success(`${p.name} is now marked ${!p.isOnline ? 'Online' : 'Offline'}`);
    } catch (e: any) {
      toast.error('Could not update status: ' + e.message);
    }
  };

  const handleDelete = async (p: DeliveryPartner) => {
    if (!window.confirm(`Are you sure you want to remove ${p.name} from the delivery fleet?`)) return;
    try {
      await deleteDoc(doc(db, 'delivery_partners', p.id));
      toast.success('Rider deleted from registry.');
    } catch (e: any) {
      toast.error('Delete failed: ' + e.message);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.phone) {
      toast.error('Name and phone are required.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        email: formData.email?.trim() || '',
        vehicleType: formData.vehicleType || 'Motorcycle',
        vehicleNumber: formData.vehicleNumber?.toUpperCase().trim() || '',
        isOnline: formData.isOnline !== false,
        updatedAt: new Date(),
      };

      if (editingPartner) {
        await updateDoc(doc(db, 'delivery_partners', editingPartner.id), payload);
        toast.success('Rider profile updated.');
      } else {
        await addDoc(collection(db, 'delivery_partners'), {
          ...payload,
          completedDeliveries: 0,
          rating: 5.0,
          createdAt: new Date(),
        });
        toast.success('New delivery partner registered.');
      }
      setIsModalOpen(false);
    } catch (e: any) {
      toast.error('Save failed: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const onlineRiders = partners.filter((p) => p.isOnline);
  const offlineRiders = partners.filter((p) => !p.isOnline);

  const defaultStoreLat = 21.0810244;
  const defaultStoreLng = 81.0123793;

  return (
    <div className="space-y-6">
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingPartner ? `Edit ${editingPartner.name}` : 'Register Delivery Partner'}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-300 uppercase block mb-1">Rider Full Name</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Ramesh Kumar"
              className="w-full p-2.5 bg-[#0E1524] border border-slate-800 rounded-xl text-xs text-white focus:border-orange-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-300 uppercase block mb-1">Phone Number</label>
            <input
              type="tel"
              required
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="+91 9876543210"
              className="w-full p-2.5 bg-[#0E1524] border border-slate-800 rounded-xl text-xs text-white font-mono focus:border-orange-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-300 uppercase block mb-1">Vehicle Type</label>
              <select
                value={formData.vehicleType}
                onChange={(e) => setFormData({ ...formData, vehicleType: e.target.value })}
                className="w-full p-2.5 bg-[#0E1524] border border-slate-800 rounded-xl text-xs text-white focus:border-orange-500 focus:outline-none"
              >
                <option value="Motorcycle">Motorcycle</option>
                <option value="Scooter">Scooter</option>
                <option value="EV Bike">EV Bike</option>
                <option value="Bicycle">Bicycle</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-300 uppercase block mb-1">Vehicle Plate #</label>
              <input
                type="text"
                value={formData.vehicleNumber}
                onChange={(e) => setFormData({ ...formData, vehicleNumber: e.target.value.toUpperCase() })}
                placeholder="CG 08 AB 1234"
                className="w-full p-2.5 bg-[#0E1524] border border-slate-800 rounded-xl text-xs text-white font-mono uppercase focus:border-orange-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={saving}
              className="w-full py-2.5 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-xl text-xs"
            >
              {saving ? 'Saving...' : 'Save Rider Profile'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2.5">
            <Bike className="w-6 h-6 text-orange-400" />
            Delivery Fleet & Radar
          </h2>
          <p className="text-xs text-slate-400">
            Real-time GPS telemetry, active fleet radar, and rider roster management.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Tab Switcher */}
          <div className="flex items-center gap-1 p-1 bg-[#131B2B] border border-slate-800 rounded-2xl">
            <button
              onClick={() => setActiveTab('roster')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 ${
                activeTab === 'roster' ? 'bg-orange-500 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <ListFilter className="w-3.5 h-3.5" />
              Roster ({partners.length})
            </button>
            <button
              onClick={() => setActiveTab('radar')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 ${
                activeTab === 'radar' ? 'bg-orange-500 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
              Live Radar ({onlineRiders.length} Online)
            </button>
          </div>

          <button
            onClick={handleOpenAdd}
            className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold rounded-xl flex items-center gap-2 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Rider
          </button>
        </div>
      </div>

      {error && <ErrorState message={error} onRetry={() => window.location.reload()} />}

      {/* VIEW 1: LIVE FLEET RADAR */}
      {activeTab === 'radar' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Map Container */}
            <div className="lg:col-span-2 relative h-[480px] rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-xl">
              <iframe
                title="Fleet Radar Map"
                width="100%"
                height="100%"
                frameBorder="0"
                scrolling="no"
                src={`https://www.openstreetmap.org/export/embed.html?bbox=80.95%2C21.03%2C81.12%2C21.15&layer=mapnik&marker=${defaultStoreLat}%2C${defaultStoreLng}`}
                className="w-full h-full filter invert-[0.9] hue-rotate-180 contrast-125"
              />
              <div className="absolute top-4 left-4 bg-[#0B0F17]/90 backdrop-blur-md px-3.5 py-2 rounded-xl border border-slate-800 text-xs font-bold text-emerald-400 flex items-center gap-2 shadow-lg">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                Live Fleet Radar Active • Rajnandgaon Hub
              </div>
              <div className="absolute bottom-4 left-4 bg-[#0B0F17]/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-800 text-[11px] text-slate-300 flex items-center gap-3 shadow-lg">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" /> Online: {onlineRiders.length}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-slate-500" /> Offline: {offlineRiders.length}
                </span>
              </div>
            </div>

            {/* Live Riders Telemetry List */}
            <div className="bg-[#131B2B] border border-slate-800 rounded-2xl p-4 flex flex-col h-[480px] overflow-hidden">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center justify-between">
                <span>Active Telemetry</span>
                <span className="text-[10px] text-emerald-400 font-mono">{onlineRiders.length} Active</span>
              </h3>

              <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
                {partners.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-8">No riders available</p>
                ) : (
                  partners.map((p) => {
                    const isSelected = selectedRider?.id === p.id;
                    return (
                      <div
                        key={p.id}
                        onClick={() => setSelectedRider(p)}
                        className={`p-3 rounded-xl border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-orange-500/10 border-orange-500/50'
                            : 'bg-[#0E1524] border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span
                              className={`w-2 h-2 rounded-full ${
                                p.isOnline ? 'bg-emerald-400' : 'bg-slate-600'
                              }`}
                            />
                            <strong className="text-xs text-white">{p.name}</strong>
                          </div>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                              p.isOnline
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {p.isOnline ? 'Online' : 'Offline'}
                          </span>
                        </div>

                        <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400 font-mono">
                          <span>{p.vehicleType || 'Motorcycle'}</span>
                          <a
                            href={`tel:${p.phone}`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-orange-400 hover:underline flex items-center gap-1"
                          >
                            <Phone className="w-3 h-3" /> {p.phone}
                          </a>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: ROSTER TABLE */}
      {activeTab === 'roster' && (
        <div className="bg-[#131B2B] border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          {loading ? (
            <div className="p-5">
              <TableSkeleton rows={5} cols={5} />
            </div>
          ) : partners.length === 0 ? (
            <EmptyState
              title="No delivery partners registered"
              message="Add delivery riders to dispatch orders for home delivery."
              action={{ label: 'Register First Rider', onClick: handleOpenAdd }}
            />
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-[#0E1524] text-slate-400 font-bold border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Partner Name</th>
                  <th className="py-3 px-4">Contact Phone</th>
                  <th className="py-3 px-4">Vehicle</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {partners.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-800/40">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-orange-400">
                          <Bike className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="font-bold text-white">{p.name}</p>
                          <p className="text-[10px] text-slate-400 font-mono">Rating: {p.rating || '5.0'} ★</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-300 font-mono">
                      <a href={`tel:${p.phone}`} className="flex items-center gap-1 hover:text-orange-400">
                        <Phone className="w-3.5 h-3.5 text-orange-400" />
                        {p.phone}
                      </a>
                    </td>
                    <td className="py-3 px-4 text-slate-300">
                      <p>{p.vehicleType || 'Motorcycle'}</p>
                      <p className="text-[10px] text-slate-400 font-mono">{p.vehicleNumber || 'Registered'}</p>
                    </td>
                    <td className="py-3 px-4">
                      <button
                        onClick={() => handleToggleOnline(p)}
                        className={`px-2.5 py-1 rounded text-[10px] font-bold transition-colors ${
                          p.isOnline
                            ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                            : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                        }`}
                      >
                        {p.isOnline ? '● Online' : '○ Offline'}
                      </button>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => handleOpenEdit(p)} className="p-1.5 text-slate-400 hover:text-white" title="Edit Rider">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(p)} className="p-1.5 text-slate-400 hover:text-red-400" title="Delete Rider">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
