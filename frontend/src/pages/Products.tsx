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
  getDocs,
} from 'firebase/firestore';
import { Product, Category } from '../types/models';
import { TableSkeleton } from '../components/ui/Skeleton';
import { ErrorState } from '../components/ui/ErrorState';
import { EmptyState } from '../components/ui/EmptyState';
import { Modal } from '../components/ui/Modal';
import { uploadMediaToCloudinary } from '../lib/cloudinary';
import {
  Search,
  Plus,
  Edit2,
  Trash2,
  Image as ImageIcon,
  Check,
  X,
  UploadCloud,
  Layers,
  Sparkles,
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function Products() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  // Form State
  const [formData, setFormData] = useState<Partial<Product>>({
    name: '',
    description: '',
    price: 0,
    offerPrice: 0,
    category: 'pizzas',
    imageUrl: '',
    isVeg: true,
    isAvailable: true,
    isPopular: false,
  });

  // 1. Fetch Categories
  useEffect(() => {
    const fetchCats = async () => {
      try {
        const snap = await getDocs(collection(db, 'categories'));
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Category[];
        setCategories(list);
      } catch (err) {
        console.warn('Could not load categories:', err);
      }
    };
    fetchCats();
  }, []);

  // 2. Realtime Products Stream
  useEffect(() => {
    const q = query(collection(db, 'products'), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as Product[];
        setProducts(list);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  const handleOpenAdd = () => {
    setEditingProduct(null);
    setFormData({
      name: '',
      description: '',
      price: 199,
      offerPrice: 0,
      category: categories[0]?.slug || categories[0]?.name?.toLowerCase() || 'pizzas',
      imageUrl: '',
      isVeg: true,
      isAvailable: true,
      isPopular: false,
    });
    setUploadProgress(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData({ ...product });
    setUploadProgress(null);
    setIsModalOpen(true);
  };

  const handleToggleAvailable = async (product: Product) => {
    try {
      await updateDoc(doc(db, 'products', product.id), {
        isAvailable: !product.isAvailable,
      });
      toast.success(`${product.name} is now ${!product.isAvailable ? 'Available' : 'Unavailable'}`);
    } catch (e: any) {
      toast.error('Toggle failed: ' + e.message);
    }
  };

  const handleDeleteProduct = async (product: Product) => {
    if (!window.confirm(`Are you sure you want to delete "${product.name}"?`)) return;
    try {
      await deleteDoc(doc(db, 'products', product.id));
      toast.success(`Deleted ${product.name}`);
    } catch (e: any) {
      toast.error('Delete failed: ' + e.message);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadProgress(10);
    try {
      const res = await uploadMediaToCloudinary(file, (p) => setUploadProgress(p));
      setFormData((prev) => ({ ...prev, imageUrl: res.url }));
      toast.success('Image uploaded to Cloudinary!');
    } catch (err: any) {
      toast.error('Image upload failed: ' + err.message);
    } finally {
      setUploadProgress(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: formData.name || '',
        description: formData.description || '',
        price: Number(formData.price) || 0,
        offerPrice: Number(formData.offerPrice) || 0,
        category: formData.category || 'pizzas',
        imageUrl: formData.imageUrl || '',
        isVeg: !!formData.isVeg,
        isAvailable: formData.isAvailable !== false,
        isPopular: !!formData.isPopular,
        updatedAt: new Date(),
      };

      if (editingProduct) {
        await updateDoc(doc(db, 'products', editingProduct.id), payload);
        toast.success('Product updated successfully.');
      } else {
        await addDoc(collection(db, 'products'), {
          ...payload,
          createdAt: new Date(),
        });
        toast.success('New product added to catalog.');
      }
      setIsModalOpen(false);
    } catch (err: any) {
      toast.error('Save failed: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat =
      selectedCategory === 'all' ||
      p.category?.toLowerCase() === selectedCategory.toLowerCase();
    return matchesSearch && matchesCat;
  });

  return (
    <div className="space-y-6">
      {/* Product Add/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingProduct ? `Edit ${editingProduct.name}` : 'Add New Product'}
        maxWidth="max-w-xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-300 uppercase block mb-1">Product Name</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Farmhouse Special Pizza"
              className="w-full p-2.5 bg-[#0E1524] border border-slate-800 rounded-xl text-xs text-white focus:border-orange-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-300 uppercase block mb-1">Regular Price (₹)</label>
              <input
                type="number"
                required
                min={0}
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                className="w-full p-2.5 bg-[#0E1524] border border-slate-800 rounded-xl text-xs text-white font-mono focus:border-orange-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-300 uppercase block mb-1">Offer Price (₹, optional)</label>
              <input
                type="number"
                min={0}
                value={formData.offerPrice || ''}
                onChange={(e) => setFormData({ ...formData, offerPrice: Number(e.target.value) })}
                placeholder="0"
                className="w-full p-2.5 bg-[#0E1524] border border-slate-800 rounded-xl text-xs text-white font-mono focus:border-orange-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-300 uppercase block mb-1">Category</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full p-2.5 bg-[#0E1524] border border-slate-800 rounded-xl text-xs text-white focus:border-orange-500 focus:outline-none"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.slug || c.name.toLowerCase()}>
                    {c.name}
                  </option>
                ))}
                <option value="pizzas">Pizzas</option>
                <option value="burgers">Burgers</option>
                <option value="beverages">Beverages</option>
                <option value="sides">Sides</option>
                <option value="desserts">Desserts</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-300 uppercase block mb-1">Dietary Tag</label>
              <select
                value={formData.isVeg ? 'veg' : 'non-veg'}
                onChange={(e) => setFormData({ ...formData, isVeg: e.target.value === 'veg' })}
                className="w-full p-2.5 bg-[#0E1524] border border-slate-800 rounded-xl text-xs text-white focus:border-orange-500 focus:outline-none"
              >
                <option value="veg">🟢 100% Pure Veg</option>
                <option value="non-veg">🔴 Non-Veg</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-300 uppercase block mb-1">Description</label>
            <textarea
              rows={2}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Fresh hand-tossed dough, mozzarella cheese, bell peppers, olives..."
              className="w-full p-2.5 bg-[#0E1524] border border-slate-800 rounded-xl text-xs text-white focus:border-orange-500 focus:outline-none"
            />
          </div>

          {/* Cloudinary Image Selector */}
          <div>
            <label className="text-xs font-bold text-slate-300 uppercase block mb-1">Cloudinary Image URL</label>
            <div className="flex gap-2">
              <input
                type="text"
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
            {uploadProgress !== null && (
              <div className="mt-2 flex items-center gap-2">
                <div className="flex-1 bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-orange-500 h-full transition-all" style={{ width: `${uploadProgress}%` }} />
                </div>
                <span className="text-[10px] text-orange-400 font-mono">{uploadProgress}%</span>
              </div>
            )}
            {formData.imageUrl && (
              <div className="mt-2 flex items-center gap-3 p-2 bg-[#0E1524] border border-slate-800 rounded-xl">
                <img src={formData.imageUrl} alt="Preview" className="w-12 h-12 object-cover rounded-lg" />
                <span className="text-[11px] text-slate-400 truncate flex-1">{formData.imageUrl}</span>
              </div>
            )}
          </div>

          {/* Checkboxes */}
          <div className="flex items-center gap-6 pt-1">
            <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300 font-bold">
              <input
                type="checkbox"
                checked={formData.isAvailable}
                onChange={(e) => setFormData({ ...formData, isAvailable: e.target.checked })}
                className="rounded text-orange-500 focus:ring-0"
              />
              Available for Ordering
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300 font-bold">
              <input
                type="checkbox"
                checked={formData.isPopular}
                onChange={(e) => setFormData({ ...formData, isPopular: e.target.checked })}
                className="rounded text-orange-500 focus:ring-0"
              />
              ⭐ Popular / Recommended
            </label>
          </div>

          <div className="flex gap-3 pt-3">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2.5 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-xl text-xs transition-colors shadow-lg shadow-orange-600/20 disabled:opacity-50"
            >
              {saving ? 'Saving...' : editingProduct ? 'Save Changes' : 'Create Product'}
            </button>
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </Modal>

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-white">Menu & Catalog Manager</h2>
          <p className="text-xs text-slate-400">Add dishes, update pricing, toggle availability, and upload media.</p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold rounded-xl flex items-center gap-2 transition-colors shadow-lg shadow-orange-600/20"
        >
          <Plus className="w-4 h-4" />
          Add New Dish
        </button>
      </div>

      {error && <ErrorState message={error} onRetry={() => window.location.reload()} />}

      {/* Search & Category Filter */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors whitespace-nowrap ${
              selectedCategory === 'all'
                ? 'bg-orange-500 text-white'
                : 'bg-[#131B2B] text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            All Items ({products.length})
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedCategory(c.slug || c.name.toLowerCase())}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors whitespace-nowrap ${
                selectedCategory === (c.slug || c.name.toLowerCase())
                  ? 'bg-orange-500 text-white'
                  : 'bg-[#131B2B] text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search menu..."
            className="w-full pl-10 pr-3 py-1.5 bg-[#131B2B] border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-[#131B2B] border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-5">
            <TableSkeleton rows={8} cols={6} />
          </div>
        ) : filteredProducts.length === 0 ? (
          <EmptyState
            title="No dishes in catalog"
            message="Add dishes to make them available for customers to order."
            action={{ label: 'Add First Dish', onClick: handleOpenAdd }}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#0E1524] text-slate-400 font-bold border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Dish</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Price</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {filteredProducts.map((product) => (
                  <tr key={product.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={product.imageUrl || '/logo-transparent.png'}
                          alt={product.name}
                          className="w-10 h-10 rounded-xl object-cover bg-[#0E1524] border border-slate-800 flex-shrink-0"
                        />
                        <div>
                          <p className="font-bold text-white flex items-center gap-1.5">
                            {product.name}
                            {product.isPopular && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-bold">
                                Popular
                              </span>
                            )}
                          </p>
                          <p className="text-[11px] text-slate-400 truncate max-w-xs">{product.description}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-300 uppercase text-[10px] font-bold">
                      {product.category}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-white">
                      ₹{product.price}
                      {product.offerPrice ? (
                        <span className="text-slate-500 text-[10px] line-through ml-1.5">
                          ₹{product.offerPrice}
                        </span>
                      ) : null}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          product.isVeg ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                        }`}
                      >
                        {product.isVeg ? '🟢 Veg' : '🔴 Non-Veg'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <button
                        onClick={() => handleToggleAvailable(product)}
                        className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-colors ${
                          product.isAvailable
                            ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                            : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                        }`}
                      >
                        {product.isAvailable ? 'Active / In Stock' : 'Out of Stock'}
                      </button>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenEdit(product)}
                          className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteProduct(product)}
                          className="p-1.5 text-slate-400 hover:text-red-400 rounded-lg hover:bg-slate-800 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
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
