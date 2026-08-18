import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../lib/firebase';
import {
  collection,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
} from 'firebase/firestore';
import { useAuthStore } from '../lib/store';
import {
  uploadMediaToCloudinary,
  deleteMediaFromCloudinary,
} from '../lib/cloudinary';
import { getCurrentAuthToken } from '../lib/firebase';
import { logActivity } from '../lib/logger';
import { getScheduleStatus } from '../lib/scheduling';
import {
  Plus, Trash2, Edit3, Eye, EyeOff, Search, ChevronDown, ChevronUp,
  Package, Tag, Zap, Clock, X, Sparkles, Star, Check
} from 'lucide-react';

const TEMPLATES = [
  { id: "weekend_sale", name: "🎉 Weekend Sale", color: "#8B5CF6", desc: "Perfect for Sat-Sun promotions" },
  { id: "festival", name: "🎊 Festival Special", color: "#f97316", desc: "Festivals and celebrations" },
  { id: "bogo", name: "🛍️ Buy 1 Get 1", color: "#10b981", desc: "BOGO deals for any category" },
  { id: "family_feast", name: "👨‍👩‍👧‍👦 Family Feast", color: "#ef4444", desc: "Large portions and combos" },
  { id: "student", name: "🎓 Student Offer", color: "#3b82f6", desc: "Budget-friendly student deals" },
  { id: "limited", name: "⚡ Limited Edition", color: "#f59e0b", desc: "Rare and exclusive items" },
  { id: "custom", name: "✏️ Custom", color: "#6b7280", desc: "Start from scratch" },
];

const BADGE_OPTIONS = ["Ending Soon", "New", "Limited Stock", "Bestseller", "Hot Deal", "Fresh Pick", "Staff Pick"];

const DEFAULT_FORM = {
  name: "",
  description: "",
  themeColor: "#f97316",
  displayPriority: 50,
  isActive: true,
  status: "published",
  templateType: "custom",
  bannerImage: "",
  cloudinaryPublicId: "",
  badges: [] as string[],
  countdown: { enabled: false, targetDate: "" },
  isScheduled: false,
  startDate: "",
  endDate: "",
  featuredProductId: "",
  items: [] as any[],
};

export default function OwnerSpecialCategories() {
  const { user } = useAuthStore();
  const [categories, setCategories] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<any>(DEFAULT_FORM);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Product selector state
  const [productSearch, setProductSearch] = useState("");
  const [productFilter, setProductFilter] = useState("all");
  const [showProductSelector, setShowProductSelector] = useState(false);

  // Combo builder state
  const [showComboBuilder, setShowComboBuilder] = useState(false);
  const [comboForm, setComboForm] = useState({ name: "", description: "", image: "", price: 0, originalTotal: 0, productIds: [] as string[] });

  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => {
    const qCat = query(collection(db, "special_categories"), orderBy("displayPriority", "desc"));
    const unsubCat = onSnapshot(qCat, (snap) => {
      setCategories(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    const unsubProd = onSnapshot(
      query(collection(db, "products"), orderBy("createdAt", "desc")),
      (snap) => setProducts(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    return () => { unsubCat(); unsubProd(); };
  }, []);

  const filteredProducts = products.filter((p) => {
    const matchSearch = p.productName?.toLowerCase().includes(productSearch.toLowerCase());
    const matchFilter = productFilter === "all" || p.category === productFilter;
    return matchSearch && matchFilter;
  });

  const handleUpload = async (file: File) => {
    if (!user) throw new Error("Not authenticated");
    setUploading(true);
    setUploadProgress(0);
    try {
      const result = await uploadMediaToCloudinary(file, "olive-pizza/special-categories", setUploadProgress);
      return result;
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const resetForm = () => {
    setForm(DEFAULT_FORM);
    setSelectedFile(null);
    setEditingId(null);
    setIsAdding(false);
    setProductSearch("");
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let bannerData: any = { bannerImage: form.bannerImage, cloudinaryPublicId: form.cloudinaryPublicId };
      if (selectedFile) {
        const result = await handleUpload(selectedFile);
        bannerData = { bannerImage: result.secureUrl, cloudinaryPublicId: result.publicId };
      }

      const payload = {
        ...form,
        ...bannerData,
        updatedAt: new Date().toISOString(),
      };

      if (editingId) {
        await updateDoc(doc(db, "special_categories", editingId), payload);
        await logActivity("Special Category Updated", `Updated: ${form.name}`, user?.email);
      } else {
        await addDoc(collection(db, "special_categories"), {
          ...payload,
          createdAt: new Date().toISOString(),
        });
        await logActivity("Special Category Created", `Created: ${form.name}`, user?.email);
      }
      resetForm();
    } catch (err) {
      console.error("Error saving category", err);
      alert("Error saving category. Check console.");
    }
  };

  const handleEdit = (cat: any) => {
    setForm({
      name: cat.name || "",
      description: cat.description || "",
      themeColor: cat.themeColor || "#f97316",
      displayPriority: cat.displayPriority || 50,
      isActive: cat.isActive ?? true,
      status: cat.status || "published",
      templateType: cat.templateType || "custom",
      bannerImage: cat.bannerImage || "",
      cloudinaryPublicId: cat.cloudinaryPublicId || "",
      badges: cat.badges || [],
      countdown: cat.countdown || { enabled: false, targetDate: "" },
      isScheduled: cat.isScheduled || false,
      startDate: cat.startDate || "",
      endDate: cat.endDate || "",
      featuredProductId: cat.featuredProductId || "",
      items: cat.items || [],
    });
    setEditingId(cat.id);
    setIsAdding(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (cat: any) => {
    if (!confirm(`Delete "${cat.name}"? This cannot be undone.`)) return;
    if (cat.cloudinaryPublicId) {
      const token = await getCurrentAuthToken();
      await deleteMediaFromCloudinary(cat.cloudinaryPublicId, token).catch(console.error);
    }
    await deleteDoc(doc(db, "special_categories", cat.id));
    await logActivity("Special Category Deleted", `Deleted: ${cat.name}`, user?.email);
  };

  const toggleProductInCategory = (productId: string) => {
    const existing = form.items.find((i: any) => i.type === "product" && i.productId === productId);
    if (existing) {
      setForm({ ...form, items: form.items.filter((i: any) => !(i.type === "product" && i.productId === productId)) });
    } else {
      setForm({ ...form, items: [...form.items, { type: "product", productId, promoDiscount: 0, promoType: "percentage", promoText: "" }] });
    }
  };

  const updateProductPromo = (productId: string, field: string, value: any) => {
    setForm({
      ...form,
      items: form.items.map((i: any) =>
        i.type === "product" && i.productId === productId ? { ...i, [field]: value } : i
      ),
    });
  };

  const addComboToCategory = () => {
    const savings = comboForm.originalTotal - comboForm.price;
    setForm({
      ...form,
      items: [...form.items, {
        type: "combo",
        id: `combo_${Date.now()}`,
        ...comboForm,
        savings,
        isAvailable: true,
      }],
    });
    setComboForm({ name: "", description: "", image: "", price: 0, originalTotal: 0, productIds: [] });
    setShowComboBuilder(false);
  };

  const removeItem = (index: number) => {
    const newItems = [...form.items];
    newItems.splice(index, 1);
    setForm({ ...form, items: newItems });
  };

  if (loading) return <div className="p-8 text-center text-white font-bold">Loading Special Categories...</div>;

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-white">Special Categories</h1>
          <p className="text-slate-400 text-sm mt-1">Create promotional sections that appear dynamically on the Home Page</p>
        </div>
        <button
          onClick={() => { resetForm(); setIsAdding(!isAdding); }}
          className="bg-primary-600 hover:bg-primary-500 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all"
        >
          <Plus className="w-4 h-4" />
          {isAdding && !editingId ? "Cancel" : "New Category"}
        </button>
      </div>

      {/* Form */}
      <AnimatePresence>
        {isAdding && (
          <motion.form
            onSubmit={handleSave}
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-[#1E293B] border border-white/10 rounded-2xl p-6 space-y-6"
          >
            <h2 className="text-xl font-black text-white">{editingId ? "Edit Category" : "Create Special Category"}</h2>

            {/* Template selector */}
            {!editingId && (
              <div>
                <label className="text-sm font-bold text-slate-400 block mb-2">Start from a Template</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {TEMPLATES.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setForm({ ...form, templateType: t.id, themeColor: t.color, name: t.id !== "custom" ? t.name.split(" ").slice(1).join(" ") : form.name })}
                      className={`p-3 rounded-xl border text-left transition-all ${form.templateType === t.id ? "border-primary-500 bg-primary-500/10" : "border-white/10 hover:border-white/30"}`}
                    >
                      <p className="font-bold text-white text-sm">{t.name}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{t.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Basic info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-bold text-slate-400 block mb-1">Category Name *</label>
                <input required type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full p-3 rounded-xl border border-white/10 bg-dark-900 text-white" placeholder="e.g. Diwali Special" />
              </div>
              <div>
                <label className="text-sm font-bold text-slate-400 block mb-1">Theme Color</label>
                <div className="flex gap-2">
                  <input type="color" value={form.themeColor} onChange={(e) => setForm({ ...form, themeColor: e.target.value })}
                    className="w-12 h-12 rounded-xl border border-white/10 bg-dark-900 cursor-pointer p-1" />
                  <input type="text" value={form.themeColor} onChange={(e) => setForm({ ...form, themeColor: e.target.value })}
                    className="flex-1 p-3 rounded-xl border border-white/10 bg-dark-900 text-white font-mono" />
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="text-sm font-bold text-slate-400 block mb-1">Description</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full p-3 rounded-xl border border-white/10 bg-dark-900 text-white h-20 resize-none"
                  placeholder="Short description shown on Home Page..." />
              </div>
            </div>

            {/* Banner image */}
            <div>
              <label className="text-sm font-bold text-slate-400 block mb-1">Banner Image</label>
              <div className="border-2 border-dashed border-white/10 rounded-xl p-6 text-center relative">
                {selectedFile ? (
                  <div>
                    <img src={URL.createObjectURL(selectedFile)} alt="Preview" className="h-32 mx-auto rounded-lg object-cover" />
                    <button type="button" onClick={() => setSelectedFile(null)} className="text-red-400 text-xs mt-2 font-bold">Remove</button>
                  </div>
                ) : form.bannerImage ? (
                  <div>
                    <img src={form.bannerImage} alt="Current" className="h-32 mx-auto rounded-lg object-cover" />
                    <button type="button" onClick={() => setForm({ ...form, bannerImage: "", cloudinaryPublicId: "" })} className="text-red-400 text-xs mt-2 font-bold">Remove</button>
                  </div>
                ) : (
                  <>
                    <p className="text-slate-400 text-sm">Click or drag to upload banner image</p>
                    <input type="file" accept="image/*" onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
                  </>
                )}
                {uploading && <div className="absolute bottom-0 left-0 h-1 bg-primary-500 transition-all" style={{ width: `${uploadProgress}%` }} />}
              </div>
            </div>

            {/* Badges */}
            <div>
              <label className="text-sm font-bold text-slate-400 block mb-2">Badges</label>
              <div className="flex flex-wrap gap-2">
                {BADGE_OPTIONS.map((b) => (
                  <button key={b} type="button"
                    onClick={() => setForm({ ...form, badges: form.badges.includes(b) ? form.badges.filter((x: string) => x !== b) : [...form.badges, b] })}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${form.badges.includes(b) ? "bg-primary-600/30 border-primary-500 text-primary-300" : "border-white/10 text-slate-400 hover:border-white/30"}`}
                  >
                    {form.badges.includes(b) ? <Check className="w-3 h-3 inline mr-1" /> : null}{b}
                  </button>
                ))}
              </div>
            </div>

            {/* Scheduling */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-dark-900 rounded-xl border border-white/5">
              <div className="md:col-span-3 flex items-center gap-3">
                <Clock className="w-4 h-4 text-slate-400" />
                <span className="font-bold text-slate-300">Scheduling</span>
                <label className="ml-auto flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.isScheduled} onChange={(e) => setForm({ ...form, isScheduled: e.target.checked })} className="accent-primary-500 w-4 h-4" />
                  <span className="text-sm text-slate-400">Enable date range</span>
                </label>
              </div>
              {form.isScheduled && (
                <>
                  <div>
                    <label className="text-xs font-bold text-slate-400 block mb-1">Start Date</label>
                    <input type="datetime-local" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                      className="w-full p-2.5 rounded-xl border border-white/10 bg-dark-950 text-white text-sm" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-400 block mb-1">End Date</label>
                    <input type="datetime-local" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                      className="w-full p-2.5 rounded-xl border border-white/10 bg-dark-950 text-white text-sm" />
                  </div>
                </>
              )}
              <div className={form.isScheduled ? "" : "md:col-span-3"}>
                <label className="text-xs font-bold text-slate-400 block mb-1">Priority Score (0-100)</label>
                <input type="number" min="0" max="100" value={form.displayPriority}
                  onChange={(e) => setForm({ ...form, displayPriority: Number(e.target.value) })}
                  className="w-full p-2.5 rounded-xl border border-white/10 bg-dark-950 text-white text-sm" />
              </div>
            </div>

            {/* Countdown */}
            <div className="p-4 bg-dark-900 rounded-xl border border-white/5">
              <div className="flex items-center gap-3 mb-3">
                <Zap className="w-4 h-4 text-yellow-400" />
                <span className="font-bold text-slate-300">Countdown Timer</span>
                <label className="ml-auto flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.countdown.enabled}
                    onChange={(e) => setForm({ ...form, countdown: { ...form.countdown, enabled: e.target.checked } })}
                    className="accent-primary-500 w-4 h-4" />
                  <span className="text-sm text-slate-400">Show countdown</span>
                </label>
              </div>
              {form.countdown.enabled && (
                <input type="datetime-local" value={form.countdown.targetDate}
                  onChange={(e) => setForm({ ...form, countdown: { ...form.countdown, targetDate: e.target.value } })}
                  className="w-full p-2.5 rounded-xl border border-white/10 bg-dark-950 text-white text-sm" />
              )}
            </div>

            {/* Product Selector */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-white flex items-center gap-2"><Package className="w-4 h-4" /> Products ({form.items.filter((i: any) => i.type === "product").length} selected)</h3>
                <button type="button" onClick={() => setShowProductSelector(!showProductSelector)}
                  className="text-primary-400 text-sm font-bold flex items-center gap-1">
                  {showProductSelector ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  {showProductSelector ? "Hide" : "Browse Products"}
                </button>
              </div>

              {showProductSelector && (
                <div className="bg-dark-900 border border-white/10 rounded-xl p-4 space-y-3">
                  <div className="flex gap-2">
                    <div className="flex-1 relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input type="text" placeholder="Search products..." value={productSearch}
                        onChange={(e) => setProductSearch(e.target.value)}
                        className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-white/10 bg-dark-950 text-white text-sm" />
                    </div>
                    <select value={productFilter} onChange={(e) => setProductFilter(e.target.value)}
                      className="p-2.5 rounded-xl border border-white/10 bg-dark-950 text-white text-sm">
                      <option value="all">All</option>
                      <option value="pizza">Pizza</option>
                      <option value="sides">Sides</option>
                      <option value="beverage">Beverage</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-64 overflow-y-auto">
                    {filteredProducts.map((p) => {
                      const isSelected = form.items.some((i: any) => i.type === "product" && i.productId === p.id);
                      return (
                        <button key={p.id} type="button" onClick={() => toggleProductInCategory(p.id)}
                          className={`flex items-center gap-2 p-2 rounded-xl border text-left transition-all ${isSelected ? "border-primary-500 bg-primary-500/10" : "border-white/5 hover:border-white/20 bg-dark-950"}`}>
                          {p.imageUrl && <img src={p.imageUrl} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />}
                          <div className="min-w-0">
                            <p className="font-bold text-white text-xs line-clamp-1">{p.productName}</p>
                            <p className="text-slate-400 text-[10px]">₹{p.basePrice}</p>
                          </div>
                          {isSelected && <Check className="w-3 h-3 text-primary-400 ml-auto flex-shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Selected products with promo config */}
              {form.items.filter((i: any) => i.type === "product").length > 0 && (
                <div className="mt-3 space-y-2">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Promo Settings for Selected Products</p>
                  {form.items.filter((i: any) => i.type === "product").map((item: any) => {
                    const p = products.find((x) => x.id === item.productId);
                    if (!p) return null;
                    const isFeatured = form.featuredProductId === p.id;
                    return (
                      <div key={item.productId} className="flex flex-col md:flex-row items-start md:items-center gap-2 p-3 bg-dark-900 rounded-xl border border-white/5">
                        <div className="flex items-center gap-2 flex-shrink-0 min-w-[140px]">
                          {p.imageUrl && <img src={p.imageUrl} alt="" className="w-8 h-8 rounded-lg object-cover" />}
                          <span className="text-white font-bold text-sm line-clamp-1">{p.productName}</span>
                        </div>
                        <select value={item.promoType} onChange={(e) => updateProductPromo(item.productId, "promoType", e.target.value)}
                          className="p-2 rounded-lg border border-white/10 bg-dark-950 text-white text-xs flex-shrink-0">
                          <option value="percentage">% OFF</option>
                          <option value="flat">₹ OFF</option>
                          <option value="free_item">Free Item</option>
                        </select>
                        {item.promoType !== "free_item" && (
                          <input type="number" value={item.promoDiscount} placeholder="Discount"
                            onChange={(e) => updateProductPromo(item.productId, "promoDiscount", Number(e.target.value))}
                            className="w-24 p-2 rounded-lg border border-white/10 bg-dark-950 text-white text-xs" />
                        )}
                        <input type="text" value={item.promoText} placeholder='e.g. "Free Coke!"'
                          onChange={(e) => updateProductPromo(item.productId, "promoText", e.target.value)}
                          className="flex-1 p-2 rounded-lg border border-white/10 bg-dark-950 text-white text-xs min-w-0" />
                        <button type="button" title="Set as featured"
                          onClick={() => setForm({ ...form, featuredProductId: isFeatured ? "" : p.id })}
                          className={`p-2 rounded-lg border transition-all ${isFeatured ? "border-yellow-400 text-yellow-400 bg-yellow-400/10" : "border-white/10 text-slate-400 hover:border-yellow-400/50"}`}>
                          <Star className="w-3.5 h-3.5" />
                        </button>
                        <button type="button" onClick={() => toggleProductInCategory(item.productId)} className="p-2 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Combo Builder */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-white flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary-400" /> Combos ({form.items.filter((i: any) => i.type === "combo").length})</h3>
                <button type="button" onClick={() => setShowComboBuilder(!showComboBuilder)}
                  className="text-primary-400 text-sm font-bold flex items-center gap-1">
                  <Plus className="w-4 h-4" /> Build Combo
                </button>
              </div>

              {showComboBuilder && (
                <div className="bg-dark-900 border border-primary-500/30 rounded-xl p-4 space-y-3">
                  <h4 className="font-bold text-primary-400 text-sm">Combo Builder</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <input type="text" placeholder="Combo Name *" value={comboForm.name} onChange={(e) => setComboForm({ ...comboForm, name: e.target.value })}
                      className="p-2.5 rounded-xl border border-white/10 bg-dark-950 text-white text-sm" />
                    <input type="text" placeholder="Image URL (optional)" value={comboForm.image} onChange={(e) => setComboForm({ ...comboForm, image: e.target.value })}
                      className="p-2.5 rounded-xl border border-white/10 bg-dark-950 text-white text-sm" />
                    <input type="number" placeholder="Original Total Price ₹" value={comboForm.originalTotal || ""}
                      onChange={(e) => setComboForm({ ...comboForm, originalTotal: Number(e.target.value) })}
                      className="p-2.5 rounded-xl border border-white/10 bg-dark-950 text-white text-sm" />
                    <input type="number" placeholder="Combo Price ₹ *" value={comboForm.price || ""}
                      onChange={(e) => setComboForm({ ...comboForm, price: Number(e.target.value) })}
                      className="p-2.5 rounded-xl border border-white/10 bg-dark-950 text-white text-sm" />
                  </div>
                  {comboForm.originalTotal > 0 && comboForm.price > 0 && (
                    <p className="text-green-400 text-sm font-bold">Customer saves ₹{comboForm.originalTotal - comboForm.price} ({Math.round(((comboForm.originalTotal - comboForm.price) / comboForm.originalTotal) * 100)}% OFF)</p>
                  )}
                  <textarea placeholder="Combo description..." value={comboForm.description} onChange={(e) => setComboForm({ ...comboForm, description: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-white/10 bg-dark-950 text-white text-sm h-16 resize-none" />
                  <div className="flex gap-2">
                    <button type="button" onClick={addComboToCategory} disabled={!comboForm.name || !comboForm.price}
                      className="flex-1 bg-primary-600 hover:bg-primary-500 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-sm">
                      Add Combo to Category
                    </button>
                    <button type="button" onClick={() => setShowComboBuilder(false)} className="px-4 py-2.5 border border-white/10 text-slate-400 rounded-xl text-sm">Cancel</button>
                  </div>
                </div>
              )}

              {form.items.filter((i: any) => i.type === "combo").map((combo: any, ci: number) => (
                <div key={combo.id || ci} className="flex items-center gap-3 p-3 bg-dark-900 rounded-xl border border-white/5 mt-2">
                  <span className="text-lg">🎁</span>
                  <div className="flex-1">
                    <p className="font-bold text-white text-sm">{combo.name}</p>
                    <p className="text-xs text-slate-400">₹{combo.price} <span className="text-green-400">(saves ₹{combo.originalTotal - combo.price})</span></p>
                  </div>
                  <button type="button" onClick={() => removeItem(form.items.indexOf(combo))} className="p-1.5 text-red-400 hover:bg-red-500/10 rounded-lg">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            {/* Status */}
            <div className="flex items-center gap-4 p-4 bg-dark-900 rounded-xl border border-white/5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="accent-primary-500 w-4 h-4" />
                <span className="font-bold text-slate-300 text-sm">Active</span>
              </label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="p-2 rounded-xl border border-white/10 bg-dark-950 text-white text-sm">
                <option value="published">Published</option>
                <option value="draft">Draft (not visible)</option>
              </select>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button type="submit" disabled={uploading}
                className="flex-1 bg-primary-600 hover:bg-primary-500 disabled:opacity-60 text-white font-bold py-3 rounded-xl">
                {uploading ? `Uploading... ${uploadProgress}%` : editingId ? "Save Changes" : "Create Category"}
              </button>
              <button type="button" onClick={resetForm} className="px-5 py-3 border border-white/10 text-slate-400 font-bold rounded-xl hover:border-white/30">
                Cancel
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Categories list */}
      <div className="space-y-4">
        {categories.length === 0 && !isAdding && (
          <div className="text-center py-16 text-slate-500">
            <p className="text-4xl mb-3">🎪</p>
            <p className="font-bold text-lg">No special categories yet</p>
            <p className="text-sm">Create your first promotional category to power the Home Page</p>
          </div>
        )}
        {categories.map((cat) => {
          const status = getScheduleStatus(cat);
          return (
            <div key={cat.id} className="bg-[#1E293B] border border-white/10 rounded-2xl overflow-hidden">
              <div
                className="h-1.5"
                style={{ background: `linear-gradient(to right, ${cat.themeColor || "#f97316"}, transparent)` }}
              />
              <div className="p-5">
                <div className="flex items-start gap-4">
                  {cat.bannerImage && (
                    <img src={cat.bannerImage} alt="" className="w-16 h-16 rounded-xl object-cover flex-shrink-0 hidden sm:block" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h3 className="font-black text-white text-lg">{cat.name}</h3>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        status.color === 'green' ? 'bg-green-500/20 text-green-400' :
                        status.color === 'orange' ? 'bg-orange-500/20 text-orange-400' :
                        status.color === 'red' ? 'bg-red-500/20 text-red-400' :
                        'bg-slate-500/20 text-slate-400'
                      }`}>{status.label}</span>
                      {cat.badges?.map((b: string) => (
                        <span key={b} className="text-[10px] px-2 py-0.5 rounded-full border border-white/10 text-slate-400">{b}</span>
                      ))}
                    </div>
                    <p className="text-slate-400 text-sm line-clamp-1">{cat.description}</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 mt-2">
                      <span>{cat.items?.filter((i: any) => i.type === "product").length || 0} products</span>
                      <span>{cat.items?.filter((i: any) => i.type === "combo").length || 0} combos</span>
                      <span>Priority: {cat.displayPriority}</span>
                      {cat.isScheduled && cat.startDate && <span>📅 {new Date(cat.startDate).toLocaleDateString()}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => setExpandedId(expandedId === cat.id ? null : cat.id)}
                      className="p-2 rounded-xl border border-white/10 text-slate-400 hover:text-white hover:border-white/30 transition-all">
                      {expandedId === cat.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                    <button onClick={() => { toggleActive(cat); }}
                      className="p-2 rounded-xl border border-white/10 text-slate-400 hover:text-white hover:border-white/30 transition-all">
                      {cat.isActive ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                    <button onClick={() => handleEdit(cat)}
                      className="p-2 rounded-xl border border-white/10 text-primary-400 hover:border-primary-500/50 transition-all">
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(cat)}
                      className="p-2 rounded-xl border border-red-500/20 text-red-400 hover:bg-red-500/10 transition-all">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Expanded preview */}
                <AnimatePresence>
                  {expandedId === cat.id && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                      className="mt-4 pt-4 border-t border-white/5 overflow-hidden">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {cat.items?.filter((i: any) => i.type === "product").slice(0, 4).map((item: any) => {
                          const p = products.find((x) => x.id === item.productId);
                          if (!p) return null;
                          return (
                            <div key={item.productId} className="bg-dark-900 rounded-xl p-2 flex items-center gap-2">
                              {p.imageUrl && <img src={p.imageUrl} alt="" className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />}
                              <div className="min-w-0">
                                <p className="text-white font-bold text-xs line-clamp-1">{p.productName}</p>
                                {item.promoText && <p className="text-primary-400 text-[10px]">{item.promoText}</p>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {/* Analytics */}
                      {cat.analytics && (
                        <div className="flex gap-4 mt-3 text-xs text-slate-500">
                          <span>👁 {cat.analytics.views || 0} views</span>
                          <span>👆 {cat.analytics.clicks || 0} clicks</span>
                          <span>🛒 {cat.analytics.orders || 0} orders</span>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  async function toggleActive(cat: any) {
    await updateDoc(doc(db, "special_categories", cat.id), { isActive: !cat.isActive });
    await logActivity("Special Category Updated", `Toggled visibility: ${cat.name}`, user?.email);
  }
}
