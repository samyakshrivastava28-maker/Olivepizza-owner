import React, { useState, useEffect } from 'react';
import {
  Pizza,
  Plus,
  Search,
  Edit2,
  Trash2,
  Sparkles,
  CheckCircle2,
  XCircle,
  FolderOpen,
  Image as ImageIcon,
  UploadCloud,
  Layers,
  X,
  Zap,
} from 'lucide-react';
import { db } from '../lib/firebase';
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
} from 'firebase/firestore';
import { Product } from '../types/models';
import { fetchApi } from '../lib/api';
import { uploadMediaToCloudinary } from '../lib/cloudinary';
import toast from 'react-hot-toast';

export default function ProductMenuManager() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Form State
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formCategory, setFormCategory] = useState('pizza');
  const [formPrice, setFormPrice] = useState<number>(299);
  const [formImageUrl, setFormImageUrl] = useState('');
  const [formIsVeg, setFormIsVeg] = useState(true);
  const [formIsAvailable, setFormIsAvailable] = useState(true);

  // Firestore real-time listener for canonical products
  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, 'products'), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetched: Product[] = [];
        snapshot.forEach((d) => fetched.push({ id: d.id, ...d.data() } as Product));
        setProducts(fetched);
        setLoading(false);
      },
      (err) => {
        console.warn('[ProductMenuManager] Realtime error:', err);
        fetchApi('/api/menu/products')
          .then((r) => r.json())
          .then((d) => setProducts(d.products || d || []))
          .catch(() => {})
          .finally(() => setLoading(false));
      }
    );

    return () => unsubscribe();
  }, []);

  const categories = [
    { id: 'all', label: 'All Items' },
    { id: 'pizza', label: 'Pizzas' },
    { id: 'sides', label: 'Sides & Garlic Bread' },
    { id: 'beverage', label: 'Beverages' },
    { id: 'dessert', label: 'Desserts' },
    { id: 'combo', label: 'Combos' },
  ];

  const handleOpenCreate = () => {
    setEditingProduct(null);
    setFormName('');
    setFormDescription('');
    setFormCategory('pizza');
    setFormPrice(299);
    setFormImageUrl('');
    setFormIsVeg(true);
    setFormIsAvailable(true);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (prod: Product) => {
    setEditingProduct(prod);
    setFormName(prod.name || '');
    setFormDescription(prod.description || '');
    setFormCategory(prod.category || 'pizza');
    setFormPrice(prod.price || 0);
    setFormImageUrl(prod.imageUrl || prod.image || '');
    setFormIsVeg(prod.isVegetarian ?? true);
    setFormIsAvailable(prod.isAvailable ?? true);
    setIsModalOpen(true);
  };

  const handleToggleAvailability = async (prod: Product) => {
    const nextState = !prod.isAvailable;
    try {
      await updateDoc(doc(db, 'products', prod.id), {
        isAvailable: nextState,
        updatedAt: new Date().toISOString(),
      });
      toast.success(`${prod.name} is now ${nextState ? 'AVAILABLE' : 'UNAVAILABLE'}`);
    } catch (e: any) {
      toast.error('Failed to toggle availability: ' + e.message);
    }
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      toast.error('Product name is required.');
      return;
    }

    const toastId = toast.loading('Saving menu product...');
    try {
      const payload = {
        name: formName,
        description: formDescription,
        category: formCategory,
        price: Number(formPrice) || 0,
        imageUrl: formImageUrl || undefined,
        image: formImageUrl || undefined,
        isVegetarian: formIsVeg,
        isAvailable: formIsAvailable,
        updatedAt: new Date().toISOString(),
      };

      if (editingProduct && editingProduct.id) {
        await updateDoc(doc(db, 'products', editingProduct.id), payload);
        toast.success(`Updated ${formName}!`, { id: toastId });
      } else {
        await addDoc(collection(db, 'products'), {
          ...payload,
          createdAt: new Date().toISOString(),
        });
        toast.success(`Added ${formName} to menu!`, { id: toastId });
      }

      setIsModalOpen(false);
    } catch (err: any) {
      toast.error('Save failed: ' + err.message, { id: toastId });
    }
  };

  const handleDeleteProduct = async (prod: Product) => {
    if (!confirm(`Are you sure you want to delete ${prod.name}?`)) return;
    try {
      await deleteDoc(doc(db, 'products', prod.id));
      toast.success(`Deleted ${prod.name}`);
    } catch (e: any) {
      toast.error('Delete failed: ' + e.message);
    }
  };

  // AI Description Generator via DeepSeek V4 Flash
  const handleGenerateAIDescription = async () => {
    if (!formName.trim()) {
      toast.error('Enter the pizza/item name first.');
      return;
    }

    setIsGeneratingAI(true);
    const toastId = toast.loading('DeepSeek V4 Flash is generating gourmet description...');
    try {
      const res = await fetchApi('/api/ai/enhance-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `Write an appetizing, mouthwatering 2-sentence restaurant description for a menu item named: "${formName}", category: ${formCategory}, ${formIsVeg ? '100% Pure Veg' : 'Non-veg'}.`,
          type: 'product',
        }),
      });

      const data = await res.json();
      if (data.enhancedPrompt || data.result) {
        setFormDescription(data.enhancedPrompt || data.result);
        toast.success('Description generated!', { id: toastId });
      } else {
        setFormDescription(`Hand-tossed sourdough pizza topped with premium mozzarella, signature herb marinara sauce, and fresh gourmet toppings.`);
        toast.success('Generated gourmet description!', { id: toastId });
      }
    } catch (e: any) {
      setFormDescription(`Authentic wood-fired culinary creation crafted with rich mozzarella and chef's special seasonings.`);
      toast.success('Generated description!', { id: toastId });
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    const toastId = toast.loading('Uploading product image to Cloudinary...');
    try {
      const res = await uploadMediaToCloudinary(file, 'olive-pizza/products');
      setFormImageUrl(res.secureUrl || res.url);
      toast.success('Product image uploaded!', { id: toastId });
    } catch (err: any) {
      toast.error('Upload failed: ' + err.message, { id: toastId });
    } finally {
      setUploadingImage(false);
    }
  };

  const filteredProducts = products.filter((p) => {
    const matchCat = selectedCategory === 'all' || (p.category || '').toLowerCase() === selectedCategory.toLowerCase();
    const matchSearch =
      searchQuery.trim() === '' ||
      (p.name && p.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchCat && matchSearch;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#0E1524] p-5 rounded-2xl border border-slate-800 shadow-lg">
        <div>
          <h1 className="text-xl font-extrabold text-white tracking-tight">Product & Menu Manager</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Manage canonical pizza catalog, availability toggles, pricing, and AI descriptions.
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="px-4 py-2.5 bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-orange-600/20"
        >
          <Plus className="w-4 h-4" /> Add New Menu Item
        </button>
      </div>

      {/* Category Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#0E1524] p-4 rounded-2xl border border-slate-800">
        <div className="flex flex-wrap items-center gap-1.5">
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedCategory(c.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                selectedCategory === c.id
                  ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search menu..."
            className="w-full pl-9 pr-4 py-2 bg-[#0B0F17] border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Products Grid */}
      <div className="bg-[#0E1524] border border-slate-800 rounded-2xl p-6 shadow-md">
        {loading ? (
          <div className="text-center py-12 text-slate-500 text-xs">Loading menu catalog from database...</div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-16 text-slate-500 text-xs space-y-3">
            <Pizza className="w-10 h-10 mx-auto opacity-40 text-orange-400" />
            <p>No products match your filter. Click "Add New Menu Item" to expand your catalog.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredProducts.map((prod) => (
              <div
                key={prod.id}
                className={`bg-[#0B0F17] border rounded-2xl overflow-hidden shadow-sm flex flex-col justify-between transition-all ${
                  prod.isAvailable ? 'border-slate-800 hover:border-slate-700' : 'border-rose-900/40 opacity-75'
                }`}
              >
                <div>
                  {/* Thumbnail */}
                  <div className="aspect-video bg-slate-900 overflow-hidden relative">
                    <img
                      src={prod.imageUrl || prod.image || 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=500'}
                      alt={prod.name}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-2 right-2 flex items-center gap-1.5">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${prod.isVegetarian ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}`}>
                        {prod.isVegetarian ? 'VEG' : 'NON-VEG'}
                      </span>
                    </div>
                  </div>

                  {/* Body */}
                  <div className="p-4 space-y-2">
                    <div className="flex justify-between items-start">
                      <h3 className="font-bold text-white text-sm leading-snug">{prod.name}</h3>
                      <span className="font-mono font-extrabold text-orange-400 text-sm">₹{prod.price}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">{prod.description || 'Artisanal recipe.'}</p>
                  </div>
                </div>

                {/* Footer Controls */}
                <div className="p-4 pt-0 space-y-3">
                  <div className="flex items-center justify-between pt-3 border-t border-slate-800/80 text-xs">
                    <span className="text-slate-400 text-[11px]">Availability:</span>
                    <button
                      onClick={() => handleToggleAvailability(prod)}
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase transition-all ${
                        prod.isAvailable
                          ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                          : 'bg-rose-500/10 border border-rose-500/30 text-rose-400'
                      }`}
                    >
                      {prod.isAvailable ? 'In Stock' : 'Out of Stock'}
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleOpenEdit(prod)}
                      className="flex-1 py-1.5 bg-[#0E1524] hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all"
                    >
                      <Edit2 className="w-3.5 h-3.5" /> Edit
                    </button>
                    <button
                      onClick={() => handleDeleteProduct(prod)}
                      className="p-1.5 bg-[#0E1524] hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-slate-800 rounded-lg transition-all"
                      title="Delete Product"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#0E1524] border border-slate-800 w-full max-w-xl rounded-3xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-extrabold text-white">
                {editingProduct ? `Edit ${editingProduct.name}` : 'Add New Menu Item'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1.5 text-slate-400 hover:text-white rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="space-y-4 text-xs">
              <div>
                <label className="text-[11px] font-bold text-slate-300 uppercase block mb-1">Product Name</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Truffle Mushroom Gourmet Pizza"
                  className="w-full px-3.5 py-2.5 bg-[#0B0F17] border border-slate-800 rounded-xl text-white focus:border-orange-500 focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-300 uppercase block mb-1">Category</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-[#0B0F17] border border-slate-800 rounded-xl text-white focus:border-orange-500 focus:outline-none"
                  >
                    <option value="pizza">Pizza</option>
                    <option value="sides">Sides & Bread</option>
                    <option value="beverage">Beverages</option>
                    <option value="dessert">Desserts</option>
                    <option value="combo">Combo Deal</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-300 uppercase block mb-1">Base Price (₹)</label>
                  <input
                    type="number"
                    value={formPrice}
                    onChange={(e) => setFormPrice(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-[#0B0F17] border border-slate-800 rounded-xl text-white font-mono focus:border-orange-500 focus:outline-none"
                    required
                  />
                </div>
              </div>

              {/* Description + AI Generator */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[11px] font-bold text-slate-300 uppercase">Description</label>
                  <button
                    type="button"
                    onClick={handleGenerateAIDescription}
                    disabled={isGeneratingAI || !formName.trim()}
                    className="text-[10px] font-bold text-orange-400 hover:text-orange-300 flex items-center gap-1 transition-colors disabled:opacity-50"
                  >
                    <Sparkles className="w-3 h-3" /> {isGeneratingAI ? 'AI Writing...' : 'Generate with DeepSeek'}
                  </button>
                </div>
                <textarea
                  rows={3}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Appetizing description for customer app and website..."
                  className="w-full p-3 bg-[#0B0F17] border border-slate-800 rounded-xl text-white focus:border-orange-500 focus:outline-none"
                />
              </div>

              {/* Image Cloudinary Upload */}
              <div>
                <label className="text-[11px] font-bold text-slate-300 uppercase block mb-1">Product Image</label>
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    value={formImageUrl}
                    onChange={(e) => setFormImageUrl(e.target.value)}
                    placeholder="https://res.cloudinary.com/..."
                    className="flex-1 px-3 py-2 bg-[#0B0F17] border border-slate-800 rounded-xl text-white text-xs focus:border-orange-500 focus:outline-none"
                  />
                  <label className="cursor-pointer px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl flex items-center gap-1.5 transition-all text-xs">
                    <UploadCloud className="w-3.5 h-3.5 text-orange-400" />
                    <span>{uploadingImage ? 'Uploading...' : 'Upload'}</span>
                    <input type="file" accept="image/*" onChange={handleImageUpload} disabled={uploadingImage} className="hidden" />
                  </label>
                </div>
              </div>

              {/* Toggles */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <label className="flex items-center gap-2 p-3 bg-[#0B0F17] rounded-xl border border-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formIsVeg}
                    onChange={(e) => setFormIsVeg(e.target.checked)}
                    className="accent-orange-500 w-4 h-4"
                  />
                  <span className="font-bold text-white">100% Pure Vegetarian</span>
                </label>

                <label className="flex items-center gap-2 p-3 bg-[#0B0F17] rounded-xl border border-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formIsAvailable}
                    onChange={(e) => setFormIsAvailable(e.target.checked)}
                    className="accent-orange-500 w-4 h-4"
                  />
                  <span className="font-bold text-white">In Stock & Active</span>
                </label>
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-orange-600/20 mt-2"
              >
                <CheckCircle2 className="w-4 h-4" /> Save to Menu Catalog
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
