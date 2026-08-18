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
import { Category, Combo } from '../types/models';
import { TableSkeleton } from '../components/ui/Skeleton';
import { ErrorState } from '../components/ui/ErrorState';
import { EmptyState } from '../components/ui/EmptyState';
import { Modal } from '../components/ui/Modal';
import { Plus, Edit2, Trash2, Layers, Sparkles, MoveUp, MoveDown } from 'lucide-react';
import toast from 'react-hot-toast';

export default function SpecialCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [combos, setCombos] = useState<Combo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'categories' | 'combos'>('categories');
  const [isCatModalOpen, setIsCatModalOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [catName, setCatName] = useState('');
  const [catSlug, setCatSlug] = useState('');

  // 1. Fetch Categories
  useEffect(() => {
    const q = query(collection(db, 'categories'), orderBy('displayOrder', 'asc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setCategories(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Category[]);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  // 2. Fetch Combos
  useEffect(() => {
    const q = query(collection(db, 'combos'), orderBy('name', 'asc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setCombos(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Combo[]);
      },
      (err) => console.warn(err)
    );
    return () => unsub();
  }, []);

  const handleOpenCatModal = (cat?: Category) => {
    if (cat) {
      setEditingCat(cat);
      setCatName(cat.name);
      setCatSlug(cat.slug || cat.name.toLowerCase().replace(/\s+/g, '-'));
    } else {
      setEditingCat(null);
      setCatName('');
      setCatSlug('');
    }
    setIsCatModalOpen(true);
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        name: catName.trim(),
        slug: catSlug.trim() || catName.trim().toLowerCase().replace(/\s+/g, '-'),
        displayOrder: editingCat ? editingCat.displayOrder || 1 : categories.length + 1,
        isActive: true,
      };

      if (editingCat) {
        await updateDoc(doc(db, 'categories', editingCat.id), payload);
        toast.success('Category updated.');
      } else {
        await addDoc(collection(db, 'categories'), payload);
        toast.success('Category created.');
      }
      setIsCatModalOpen(false);
    } catch (e: any) {
      toast.error('Save failed: ' + e.message);
    }
  };

  const handleDeleteCategory = async (cat: Category) => {
    if (!window.confirm(`Delete category "${cat.name}"?`)) return;
    try {
      await deleteDoc(doc(db, 'categories', cat.id));
      toast.success('Category deleted.');
    } catch (e: any) {
      toast.error('Delete failed: ' + e.message);
    }
  };

  return (
    <div className="space-y-6">
      <Modal
        isOpen={isCatModalOpen}
        onClose={() => setIsCatModalOpen(false)}
        title={editingCat ? `Edit ${editingCat.name}` : 'New Category'}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleSaveCategory} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-300 uppercase block mb-1">Category Title</label>
            <input
              type="text"
              required
              value={catName}
              onChange={(e) => {
                setCatName(e.target.value);
                if (!editingCat) setCatSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'));
              }}
              placeholder="e.g. Gourmet Garlic Bread"
              className="w-full p-2.5 bg-[#0E1524] border border-slate-800 rounded-xl text-xs text-white focus:border-orange-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-300 uppercase block mb-1">Slug / Identifier</label>
            <input
              type="text"
              required
              value={catSlug}
              onChange={(e) => setCatSlug(e.target.value)}
              placeholder="gourmet-garlic-bread"
              className="w-full p-2.5 bg-[#0E1524] border border-slate-800 rounded-xl text-xs text-white font-mono focus:border-orange-500 focus:outline-none"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              className="flex-1 py-2.5 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-xl text-xs"
            >
              Save Category
            </button>
          </div>
        </form>
      </Modal>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-white">Special Categories & Combos</h2>
          <p className="text-xs text-slate-400">Manage catalog taxonomy, custom menu sections, and value combo bundles.</p>
        </div>
        <button
          onClick={() => handleOpenCatModal()}
          className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold rounded-xl flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Category
        </button>
      </div>

      {error && <ErrorState message={error} onRetry={() => window.location.reload()} />}

      {/* Categories Table */}
      <div className="bg-[#131B2B] border border-slate-800 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-slate-800 font-bold text-xs text-white">
          Active Categories & Display Sequence
        </div>
        {loading ? (
          <div className="p-5">
            <TableSkeleton rows={5} cols={4} />
          </div>
        ) : categories.length === 0 ? (
          <EmptyState title="No categories defined" message="Create custom categories to organize menu items." />
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0E1524] text-slate-400 font-bold border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Order</th>
                <th className="py-3 px-4">Category Name</th>
                <th className="py-3 px-4">Slug ID</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium">
              {categories.map((cat, idx) => (
                <tr key={cat.id} className="hover:bg-slate-800/40">
                  <td className="py-3 px-4 font-mono text-slate-400">#{idx + 1}</td>
                  <td className="py-3 px-4 font-bold text-white">{cat.name}</td>
                  <td className="py-3 px-4 font-mono text-slate-400 text-[11px]">{cat.slug || cat.name.toLowerCase()}</td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleOpenCatModal(cat)}
                        className="p-1.5 text-slate-400 hover:text-white rounded-lg"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteCategory(cat)}
                        className="p-1.5 text-slate-400 hover:text-red-400 rounded-lg"
                      >
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
