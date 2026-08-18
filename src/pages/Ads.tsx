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
import { Advertisement } from '../types/models';
import { TableSkeleton } from '../components/ui/Skeleton';
import { ErrorState } from '../components/ui/ErrorState';
import { EmptyState } from '../components/ui/EmptyState';
import { Modal } from '../components/ui/Modal';
import { uploadMediaToCloudinary } from '../lib/cloudinary';
import { Plus, Megaphone, Trash2, Edit2, UploadCloud, Eye } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Ads() {
  const [ads, setAds] = useState<Advertisement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAd, setEditingAd] = useState<Advertisement | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  const [formData, setFormData] = useState<Partial<Advertisement>>({
    title: '',
    description: '',
    imageUrl: '',
    targetUrl: '',
    placement: 'home_hero',
    isActive: true,
  });

  useEffect(() => {
    const q = query(collection(db, 'advertisements'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setAds(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Advertisement[]);
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
    setEditingAd(null);
    setFormData({
      title: '',
      description: '',
      imageUrl: '',
      targetUrl: '/menu',
      placement: 'home_hero',
      isActive: true,
    });
    setUploadProgress(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (ad: Advertisement) => {
    setEditingAd(ad);
    setFormData({ ...ad });
    setUploadProgress(null);
    setIsModalOpen(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadProgress(10);
    try {
      const res = await uploadMediaToCloudinary(file, (p) => setUploadProgress(p));
      setFormData((prev) => ({ ...prev, imageUrl: res.url }));
      toast.success('Banner uploaded to Cloudinary!');
    } catch (err: any) {
      toast.error('Upload failed: ' + err.message);
    } finally {
      setUploadProgress(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        title: formData.title?.trim() || '',
        description: formData.description?.trim() || '',
        imageUrl: formData.imageUrl?.trim() || '',
        targetUrl: formData.targetUrl?.trim() || '/menu',
        placement: formData.placement || 'home_hero',
        isActive: formData.isActive !== false,
        updatedAt: new Date(),
      };

      if (editingAd) {
        await updateDoc(doc(db, 'advertisements', editingAd.id), payload);
        toast.success('Promotion updated.');
      } else {
        await addDoc(collection(db, 'advertisements'), {
          ...payload,
          createdAt: new Date(),
        });
        toast.success('Promotion created.');
      }
      setIsModalOpen(false);
    } catch (e: any) {
      toast.error('Save failed: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (ad: Advertisement) => {
    if (!window.confirm(`Delete promotion "${ad.title}"?`)) return;
    try {
      await deleteDoc(doc(db, 'advertisements', ad.id));
      toast.success('Promotion removed.');
    } catch (e: any) {
      toast.error('Delete failed: ' + e.message);
    }
  };

  return (
    <div className="space-y-6">
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingAd ? `Edit ${editingAd.title}` : 'Create Banner Campaign'}
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-300 uppercase block mb-1">Campaign Title</label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g. Weekend Mega 1+1 Pizza Blast"
              className="w-full p-2.5 bg-[#0E1524] border border-slate-800 rounded-xl text-xs text-white focus:border-orange-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-300 uppercase block mb-1">Placement</label>
              <select
                value={formData.placement}
                onChange={(e) => setFormData({ ...formData, placement: e.target.value as any })}
                className="w-full p-2.5 bg-[#0E1524] border border-slate-800 rounded-xl text-xs text-white focus:border-orange-500 focus:outline-none"
              >
                <option value="home_hero">Home Top Hero Banner</option>
                <option value="home_banner">In-Page Promotional Banner</option>
                <option value="popup">Welcome Modal Popup</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-300 uppercase block mb-1">Target Link</label>
              <input
                type="text"
                value={formData.targetUrl}
                onChange={(e) => setFormData({ ...formData, targetUrl: e.target.value })}
                placeholder="/menu or /product/..."
                className="w-full p-2.5 bg-[#0E1524] border border-slate-800 rounded-xl text-xs text-white font-mono focus:border-orange-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Image upload */}
          <div>
            <label className="text-xs font-bold text-slate-300 uppercase block mb-1">Banner Image URL</label>
            <div className="flex gap-2">
              <input
                type="text"
                required
                value={formData.imageUrl}
                onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                placeholder="https://res.cloudinary.com/..."
                className="flex-1 p-2.5 bg-[#0E1524] border border-slate-800 rounded-xl text-xs text-white focus:border-orange-500 focus:outline-none"
              />
              <label className="cursor-pointer px-3 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors">
                <UploadCloud className="w-4 h-4 text-orange-400" />
                Upload
                <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
              </label>
            </div>
            {formData.imageUrl && (
              <img src={formData.imageUrl} alt="Banner Preview" className="mt-2 w-full h-28 object-cover rounded-xl border border-slate-800" />
            )}
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={saving}
              className="w-full py-2.5 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-xl text-xs"
            >
              {saving ? 'Saving...' : 'Save Promotion'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-white">Promotions & Advertisements</h2>
          <p className="text-xs text-slate-400">Launch marketing banners, welcome popups, and seasonal deals.</p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold rounded-xl flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Create Campaign
        </button>
      </div>

      {error && <ErrorState message={error} onRetry={() => window.location.reload()} />}

      {/* Cards Grid */}
      {loading ? (
        <TableSkeleton rows={4} cols={4} />
      ) : ads.length === 0 ? (
        <EmptyState
          title="No active campaigns"
          message="Create promotional banners to showcase your best offers on the home screen."
          action={{ label: 'Create First Campaign', onClick: handleOpenAdd }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {ads.map((ad) => (
            <div key={ad.id} className="bg-[#131B2B] border border-slate-800 rounded-2xl overflow-hidden shadow-sm flex flex-col">
              <div className="h-36 w-full relative bg-slate-900 overflow-hidden">
                <img src={ad.imageUrl} alt={ad.title} className="w-full h-full object-cover" />
                <span className="absolute top-3 right-3 text-[10px] font-bold px-2 py-0.5 rounded bg-[#0B0F17]/90 text-orange-400 border border-slate-800 uppercase">
                  {ad.placement.replace('_', ' ')}
                </span>
              </div>
              <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                <div>
                  <h4 className="text-sm font-bold text-white">{ad.title}</h4>
                  <p className="text-xs text-slate-400 mt-1">{ad.description || 'No description'}</p>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${ad.isActive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                    {ad.isActive ? 'Active' : 'Paused'}
                  </span>
                  <div className="flex items-center gap-1">
                    <button onClick={() => handleOpenEdit(ad)} className="p-1.5 text-slate-400 hover:text-white rounded-lg">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(ad)} className="p-1.5 text-slate-400 hover:text-red-400 rounded-lg">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
