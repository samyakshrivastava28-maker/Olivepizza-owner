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
import { Bike, Plus, Phone, MapPin, Trash2, Edit2, CheckCircle2, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function DeliveryPartners() {
  const [partners, setPartners] = useState<DeliveryPartner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      toast.error('Status update failed: ' + e.message);
    }
  };

  const handleDelete = async (p: DeliveryPartner) => {
    if (!window.confirm(`Remove delivery partner "${p.name}"?`)) return;
    try {
      await deleteDoc(doc(db, 'delivery_partners', p.id));
      toast.success(`Removed ${p.name}`);
    } catch (e: any) {
      toast.error('Delete failed: ' + e.message);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: formData.name?.trim() || '',
        phone: formData.phone?.trim() || '',
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
          <h2 className="text-xl sm:text-2xl font-black text-white">Delivery Fleet Management</h2>
          <p className="text-xs text-slate-400">Manage delivery partners, active assignments, and live rider availability.</p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold rounded-xl flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Delivery Partner
        </button>
      </div>

      {error && <ErrorState message={error} onRetry={() => window.location.reload()} />}

      {/* Fleet Table */}
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
                        <p className="text-[10px] text-slate-400 font-mono">Rating: {p.rating || '5.0'} ⭐</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-slate-300 font-mono flex items-center gap-1 mt-2">
                    <Phone className="w-3.5 h-3.5 text-orange-400" />
                    {p.phone}
                  </td>
                  <td className="py-3 px-4 text-slate-300">
                    <p>{p.vehicleType || 'Motorcycle'}</p>
                    <p className="text-[10px] text-slate-400 font-mono">{p.vehicleNumber || 'Registered'}</p>
                  </td>
                  <td className="py-3 px-4">
                    <button
                      onClick={() => handleToggleOnline(p)}
                      className={`px-2.5 py-1 rounded text-[10px] font-bold ${
                        p.isOnline ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {p.isOnline ? '🟢 Online' : '⚪ Offline'}
                    </button>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => handleOpenEdit(p)} className="p-1.5 text-slate-400 hover:text-white">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(p)} className="p-1.5 text-slate-400 hover:text-red-400">
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
    </div>
  );
}
