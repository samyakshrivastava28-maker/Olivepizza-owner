import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
} from 'firebase/firestore';
import { Coupon } from '../types/models';
import { TableSkeleton } from '../components/ui/Skeleton';
import { ErrorState } from '../components/ui/ErrorState';
import { EmptyState } from '../components/ui/EmptyState';
import { Modal } from '../components/ui/Modal';
import { Plus, Tag, Trash2, Edit2, Check, X, Calendar } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Coupons() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState<Partial<Coupon>>({
    code: '',
    description: '',
    discountType: 'percentage',
    discountValue: 20,
    minOrderAmount: 299,
    maxDiscount: 100,
    expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    isActive: true,
  });

  useEffect(() => {
    const q = query(collection(db, 'coupons'), orderBy('code', 'asc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setCoupons(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Coupon[]);
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
    setEditingCoupon(null);
    setFormData({
      code: '',
      description: '',
      discountType: 'percentage',
      discountValue: 20,
      minOrderAmount: 299,
      maxDiscount: 100,
      expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      isActive: true,
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (c: Coupon) => {
    setEditingCoupon(c);
    setFormData({ ...c });
    setIsModalOpen(true);
  };

  const handleToggleActive = async (c: Coupon) => {
    try {
      await updateDoc(doc(db, 'coupons', c.id), { isActive: !c.isActive });
      toast.success(`Coupon ${c.code} is now ${!c.isActive ? 'Active' : 'Disabled'}`);
    } catch (e: any) {
      toast.error('Toggle failed: ' + e.message);
    }
  };

  const handleDelete = async (c: Coupon) => {
    if (!window.confirm(`Delete coupon "${c.code}"?`)) return;
    try {
      await deleteDoc(doc(db, 'coupons', c.id));
      toast.success(`Coupon ${c.code} deleted.`);
    } catch (e: any) {
      toast.error('Delete failed: ' + e.message);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        code: formData.code?.toUpperCase().trim() || '',
        description: formData.description?.trim() || '',
        discountType: formData.discountType || 'percentage',
        discountValue: Number(formData.discountValue) || 0,
        minOrderAmount: Number(formData.minOrderAmount) || 0,
        maxDiscount: Number(formData.maxDiscount) || 0,
        expiryDate: formData.expiryDate || '',
        isActive: formData.isActive !== false,
      };

      if (editingCoupon) {
        await updateDoc(doc(db, 'coupons', editingCoupon.id), payload);
        toast.success('Coupon updated.');
      } else {
        await addDoc(collection(db, 'coupons'), {
          ...payload,
          usedCount: 0,
          createdAt: new Date(),
        });
        toast.success('Coupon created.');
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
        title={editingCoupon ? `Edit ${editingCoupon.code}` : 'Create New Coupon'}
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-300 uppercase block mb-1">Coupon Code</label>
            <input
              type="text"
              required
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
              placeholder="e.g. OLIVE50"
              className="w-full p-2.5 bg-[#0E1524] border border-slate-800 rounded-xl text-xs text-white uppercase font-mono font-bold focus:border-orange-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-300 uppercase block mb-1">Discount Type</label>
              <select
                value={formData.discountType}
                onChange={(e) => setFormData({ ...formData, discountType: e.target.value as any })}
                className="w-full p-2.5 bg-[#0E1524] border border-slate-800 rounded-xl text-xs text-white focus:border-orange-500 focus:outline-none"
              >
                <option value="percentage">Percentage (%)</option>
                <option value="flat">Flat Amount (₹)</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-300 uppercase block mb-1">Discount Value</label>
              <input
                type="number"
                required
                min={1}
                value={formData.discountValue}
                onChange={(e) => setFormData({ ...formData, discountValue: Number(e.target.value) })}
                className="w-full p-2.5 bg-[#0E1524] border border-slate-800 rounded-xl text-xs text-white font-mono focus:border-orange-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-300 uppercase block mb-1">Min Order (₹)</label>
              <input
                type="number"
                min={0}
                value={formData.minOrderAmount}
                onChange={(e) => setFormData({ ...formData, minOrderAmount: Number(e.target.value) })}
                className="w-full p-2.5 bg-[#0E1524] border border-slate-800 rounded-xl text-xs text-white font-mono focus:border-orange-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-300 uppercase block mb-1">Max Cap (₹, 0 for none)</label>
              <input
                type="number"
                min={0}
                value={formData.maxDiscount}
                onChange={(e) => setFormData({ ...formData, maxDiscount: Number(e.target.value) })}
                className="w-full p-2.5 bg-[#0E1524] border border-slate-800 rounded-xl text-xs text-white font-mono focus:border-orange-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-300 uppercase block mb-1">Expiry Date</label>
            <input
              type="date"
              required
              value={formData.expiryDate}
              onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
              className="w-full p-2.5 bg-[#0E1524] border border-slate-800 rounded-xl text-xs text-white focus:border-orange-500 focus:outline-none"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2.5 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-xl text-xs"
            >
              {saving ? 'Saving...' : 'Save Coupon'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-white">Coupons & Discount Rules</h2>
          <p className="text-xs text-slate-400">Manage promotional codes, percentage discounts, and order thresholds.</p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold rounded-xl flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Create Coupon
        </button>
      </div>

      {error && <ErrorState message={error} onRetry={() => window.location.reload()} />}

      {/* Table */}
      <div className="bg-[#131B2B] border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-5">
            <TableSkeleton rows={5} cols={5} />
          </div>
        ) : coupons.length === 0 ? (
          <EmptyState
            title="No active coupons"
            message="Create discounts to encourage higher order sizes and repeats."
            action={{ label: 'Create First Coupon', onClick: handleOpenAdd }}
          />
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0E1524] text-slate-400 font-bold border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Code</th>
                <th className="py-3 px-4">Discount</th>
                <th className="py-3 px-4">Min Order</th>
                <th className="py-3 px-4">Expiry</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium">
              {coupons.map((c) => (
                <tr key={c.id} className="hover:bg-slate-800/40">
                  <td className="py-3 px-4 font-mono font-bold text-white flex items-center gap-2">
                    <Tag className="w-3.5 h-3.5 text-orange-400" />
                    {c.code}
                  </td>
                  <td className="py-3 px-4 text-emerald-400 font-bold font-mono">
                    {c.discountType === 'percentage' ? `${c.discountValue}% OFF` : `₹${c.discountValue} FLAT`}
                  </td>
                  <td className="py-3 px-4 text-slate-300 font-mono">₹{c.minOrderAmount}</td>
                  <td className="py-3 px-4 text-slate-400">{c.expiryDate}</td>
                  <td className="py-3 px-4">
                    <button
                      onClick={() => handleToggleActive(c)}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        c.isActive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                      }`}
                    >
                      {c.isActive ? 'Active' : 'Disabled'}
                    </button>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => handleOpenEdit(c)} className="p-1.5 text-slate-400 hover:text-white">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(c)} className="p-1.5 text-slate-400 hover:text-red-400">
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
