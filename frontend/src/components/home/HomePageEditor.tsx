import React, { useState, useEffect } from 'react';
import {
  X,
  Plus,
  Save,
  Rocket,
  Trash2,
  Copy,
  Eye,
  EyeOff,
  MoveUp,
  MoveDown,
  Upload,
  Image as ImageIcon,
  Film,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Monitor,
  Smartphone,
  Tablet,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Palette,
  Type,
  Link2,
  Sliders,
  Play,
  Flame,
  Clock,
  ShoppingBag,
  Star,
  ArrowRight,
} from 'lucide-react';
import { PageSchema, SimplifiedSectionSchema, SectionType, AnimationType } from '../../types/PageSchema';
import { fetchApi } from '../../lib/api';
import toast from 'react-hot-toast';

interface HomePageEditorProps {
  initialSchema: PageSchema;
  onSave: (schema: PageSchema, isPublish: boolean) => Promise<void>;
  onClose: () => void;
  isOfficialTemplate?: boolean;
}

const AVAILABLE_SECTION_TYPES: { type: SectionType; label: string; description: string; defaultHeadline: string; icon: any }[] = [
  {
    type: 'HERO',
    label: 'Hero Banner',
    description: 'Flagship hero section with headline, CTA button, and background image/video.',
    defaultHeadline: 'Artisan Wood-Fired Pizza',
    icon: Sparkles,
  },
  {
    type: 'VIDEO_HERO',
    label: 'Video Hero',
    description: 'Cinematic looping video background with high-impact festival announcement.',
    defaultHeadline: 'Festival Celebration Special',
    icon: Film,
  },
  {
    type: 'COUNTDOWN',
    label: 'Flash Sale / Urgency Ribbon',
    description: 'Glowing urgency banner with live countdown timer and discount highlights.',
    defaultHeadline: '⚡ FLASH SALE: Flat 50% OFF On All Large Pizzas • 20 Min Delivery Guarantee',
    icon: Flame,
  },
  {
    type: 'CRAVINGS',
    label: 'Categories & Cravings',
    description: 'Interactive category tiles for quick ordering (Pizzas, Combos, Garlic Breads, Desserts).',
    defaultHeadline: "WHAT'S YOUR CRAVING TODAY?",
    icon: Layers,
  },
  {
    type: 'FEATURED',
    label: 'Popular Pizzas / Best Sellers',
    description: 'Showcases top-selling customer favorites with instant 1-click Add to Cart.',
    defaultHeadline: 'Best-Selling Artisan Pizzas',
    icon: Sparkles,
  },
  {
    type: 'PIZZA_SHOWCASE',
    label: 'Special Offers & Combos',
    description: '3D animated pizza combo card highlighting grand savings.',
    defaultHeadline: 'Royal Feast Combos',
    icon: Palette,
  },
  {
    type: 'COUPONS',
    label: 'Discount Coupons & Deals',
    description: 'Live promotional coupon codes with 1-click customer copy.',
    defaultHeadline: 'Exclusive Deals & Discounts',
    icon: Copy,
  },
  {
    type: 'ADS',
    label: 'Promotional Banner / Ads',
    description: 'Banner carousel for ongoing promotions and brand advertisements.',
    defaultHeadline: 'Limited Time Promotions',
    icon: ImageIcon,
  },
  {
    type: 'TESTIMONIALS',
    label: 'Customer Reviews',
    description: 'Foodie ratings, verified customer feedback, and chef quality badges.',
    defaultHeadline: 'Loved by Foodies Across Rajnandgaon',
    icon: CheckCircle2,
  },
  {
    type: 'DOWNLOAD_APP',
    label: 'App Promotion Banner',
    description: 'Mobile app download banner with direct App Store & Play Store links.',
    defaultHeadline: 'Experience Olive Pizza on Mobile',
    icon: Smartphone,
  },
  {
    type: 'ORDER_AGAIN',
    label: 'Order Again (Recent Orders)',
    description: 'Displays past ordered favorites for logged-in customers with live price revalidation.',
    defaultHeadline: 'Order Again',
    icon: Clock,
  },
  {
    type: 'COMPLETE_MEAL',
    label: 'Complete Your Meal (Sides & Drinks)',
    description: 'Smart cross-selling of garlic breads, cold beverages, and desserts.',
    defaultHeadline: 'Complete Your Meal',
    icon: ShoppingBag,
  },
  {
    type: 'GALLERY',
    label: 'Photo Gallery',
    description: 'Visual showcase of wood-fired crusts, fresh mozzarella, and kitchen craft.',
    defaultHeadline: 'From Our Wood-Fired Oven',
    icon: ImageIcon,
  },
];

const ANIMATION_OPTIONS: { value: AnimationType; label: string }[] = [
  { value: 'None', label: 'None (Static)' },
  { value: 'Fade Up', label: 'Fade In & Slide Up' },
  { value: 'Fade Down', label: 'Fade In & Slide Down' },
  { value: 'Fade', label: 'Soft Fade In' },
  { value: 'Slide', label: 'Slide In From Left' },
  { value: 'Scale', label: 'Soft Zoom / Scale In' },
  { value: 'Pop', label: 'Playful Pop / Bounce' },
  { value: 'Floating', label: 'Gentle Floating Wave' },
  { value: 'Stagger', label: 'Staggered Children Reveal' },
];

export default function HomePageEditor({ initialSchema, onSave, onClose, isOfficialTemplate = false }: HomePageEditorProps) {
  const [schema, setSchema] = useState<PageSchema>(() => JSON.parse(JSON.stringify(initialSchema)));
  const sectionsList: SimplifiedSectionSchema[] = (schema as any).sections || [];
  const [selectedSectionId, setSelectedSectionId] = useState<string>(
    sectionsList.length > 0 ? sectionsList[0].id : ''
  );
  const [viewMode, setViewMode] = useState<'mobile' | 'tablet' | 'desktop'>('mobile');
  const [activeTab, setActiveTab] = useState<'sections' | 'add_section' | 'settings'>('sections');
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Media Library Picker Modal state
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [mediaList, setMediaList] = useState<any[]>([]);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [mediaTargetField, setMediaTargetField] = useState<'mediaUrl' | 'mobileMediaUrl'>('mediaUrl');

  // Load existing media assets
  useEffect(() => {
    fetchApi('/api/media/list')
      .then((r) => r.json())
      .then((d) => setMediaList(Array.isArray(d) ? d : d.media || d.resources || []))
      .catch(() => {});
  }, []);

  const selectedSection = sectionsList.find((s) => s.id === selectedSectionId) || sectionsList[0];

  const updateSectionConfig = (sectionId: string, updates: Partial<SimplifiedSectionSchema['config']>) => {
    setSchema((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      const sec = (next.sections || []).find((s: SimplifiedSectionSchema) => s.id === sectionId);
      if (sec) {
        sec.config = { ...sec.config, ...updates };
      }
      return next;
    });
    setHasUnsavedChanges(true);
  };

  const updateSectionMeta = (sectionId: string, updates: Partial<SimplifiedSectionSchema>) => {
    setSchema((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      const idx = (next.sections || []).findIndex((s: SimplifiedSectionSchema) => s.id === sectionId);
      if (idx !== -1) {
        next.sections[idx] = { ...next.sections[idx], ...updates };
      }
      return next;
    });
    setHasUnsavedChanges(true);
  };

  // Move section up/down
  const moveSection = (index: number, direction: 'up' | 'down') => {
    setSchema((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= (next.sections || []).length) return prev;
      const temp = next.sections[index];
      next.sections[index] = next.sections[targetIndex];
      next.sections[targetIndex] = temp;
      return next;
    });
    setHasUnsavedChanges(true);
  };

  // Add new section
  const handleAddSection = (type: SectionType) => {
    const secMeta = AVAILABLE_SECTION_TYPES.find((s) => s.type === type);
    const newSection: SimplifiedSectionSchema = {
      id: `${type.toLowerCase()}_${Date.now().toString(36)}`,
      type,
      isHidden: false,
      config: {
        headline: secMeta?.defaultHeadline || 'New Section',
        subtitle: 'Custom section description.',
        animationType: 'Fade Up',
        buttonText: type === 'HERO' || type === 'VIDEO_HERO' ? 'ORDER NOW' : undefined,
        buttonAction: { type: 'OPEN_MENU' },
        styleOverrides: {
          backgroundColor: '#0F172A',
          textColor: '#FFFFFF',
        },
      },
    };

    setSchema((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      next.sections = [...(next.sections || []), newSection];
      return next;
    });

    setSelectedSectionId(newSection.id);
    setActiveTab('sections');
    setHasUnsavedChanges(true);
    toast.success(`Added ${secMeta?.label || type} to page!`);
  };

  // Duplicate Section
  const handleDuplicateSection = (sec: SimplifiedSectionSchema) => {
    const duplicated: SimplifiedSectionSchema = {
      ...JSON.parse(JSON.stringify(sec)),
      id: `${sec.type.toLowerCase()}_copy_${Date.now().toString(36)}`,
      config: {
        ...sec.config,
        headline: sec.config.headline ? `${sec.config.headline} (Copy)` : 'Section Copy',
      },
    };

    setSchema((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      next.sections = [...(next.sections || []), duplicated];
      return next;
    });

    setSelectedSectionId(duplicated.id);
    setHasUnsavedChanges(true);
    toast.success('Section duplicated!');
  };

  // Remove Section
  const handleRemoveSection = (sectionId: string) => {
    if (sectionsList.length <= 1) {
      toast.error('The homepage must contain at least one section.');
      return;
    }

    setSchema((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      next.sections = (next.sections || []).filter((s: SimplifiedSectionSchema) => s.id !== sectionId);
      return next;
    });

    const remaining = sectionsList.filter((s) => s.id !== sectionId);
    if (remaining.length > 0) {
      setSelectedSectionId(remaining[0].id);
    }
    setHasUnsavedChanges(true);
    toast.success('Section removed.');
  };

  // Media Upload handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingMedia(true);
    const toastId = toast.loading(`Uploading ${file.name} to Cloudinary...`);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', 'olive-pizza/homepage-assets');

      const res = await fetchApi('/api/media/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (data.url || data.secure_url) {
        const uploadedUrl = data.secure_url || data.url;
        if (selectedSection) {
          updateSectionConfig(selectedSection.id, { [mediaTargetField]: uploadedUrl });
        }
        setMediaList((prev) => [data, ...prev]);
        setShowMediaPicker(false);
        toast.success('Media uploaded and attached to section!', { id: toastId });
      } else {
        throw new Error(data.error || 'Upload failed');
      }
    } catch (err: any) {
      toast.error(`Media upload failed: ${err.message}`, { id: toastId });
    } finally {
      setUploadingMedia(false);
    }
  };

  // Handle Save
  const handleSaveDraft = async () => {
    setSaving(true);
    try {
      await onSave(schema, false);
      setHasUnsavedChanges(false);
    } finally {
      setSaving(false);
    }
  };

  // Handle Publish
  const handlePublishLive = async () => {
    setPublishing(true);
    try {
      await onSave(schema, true);
      setHasUnsavedChanges(false);
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0B0F17] flex flex-col overflow-hidden text-slate-100 font-sans">
      {/* Top Action Bar */}
      <header className="h-16 border-b border-slate-800 bg-[#0E1524] px-4 sm:px-6 flex items-center justify-between shrink-0 shadow-lg">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (hasUnsavedChanges && !window.confirm('You have unsaved changes. Exit editor anyway?')) {
                return;
              }
              onClose();
            }}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all"
            title="Exit Editor"
          >
            <X className="w-5 h-5" />
          </button>

          <div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={schema.metadata?.name || 'Custom Home Page'}
                onChange={(e) => {
                  setSchema((prev) => ({
                    ...prev,
                    metadata: { ...prev.metadata, name: e.target.value },
                  }));
                  setHasUnsavedChanges(true);
                }}
                className="bg-transparent text-sm sm:text-base font-extrabold text-white border-b border-dashed border-slate-700 hover:border-orange-500 focus:border-orange-500 focus:outline-none px-1"
              />
              {isOfficialTemplate && (
                <span className="px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-[10px] font-extrabold uppercase">
                  Customizing Template
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400">
              {sectionsList.length} editable sections • Live customer parity preview
            </p>
          </div>
        </div>

        {/* Device Mode Switcher & Primary Actions */}
        <div className="flex items-center gap-3">
          {/* Responsive Viewport Switcher */}
          <div className="hidden sm:flex items-center bg-[#0B0F17] p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setViewMode('mobile')}
              className={`p-1.5 rounded-lg transition-all ${
                viewMode === 'mobile' ? 'bg-orange-500 text-white' : 'text-slate-400 hover:text-white'
              }`}
              title="Mobile View (390px)"
            >
              <Smartphone className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('tablet')}
              className={`p-1.5 rounded-lg transition-all ${
                viewMode === 'tablet' ? 'bg-orange-500 text-white' : 'text-slate-400 hover:text-white'
              }`}
              title="Tablet View (768px)"
            >
              <Tablet className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('desktop')}
              className={`p-1.5 rounded-lg transition-all ${
                viewMode === 'desktop' ? 'bg-orange-500 text-white' : 'text-slate-400 hover:text-white'
              }`}
              title="Desktop View (100%)"
            >
              <Monitor className="w-4 h-4" />
            </button>
          </div>

          {/* Save Draft */}
          <button
            onClick={handleSaveDraft}
            disabled={saving || publishing}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Save to Made by Me</span>
          </button>

          {/* Publish Live Button */}
          <button
            onClick={handlePublishLive}
            disabled={saving || publishing}
            className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-xl text-xs flex items-center gap-2 transition-all shadow-lg shadow-orange-600/25 disabled:opacity-50"
          >
            <Rocket className="w-4 h-4" />
            <span>Publish to Homepage</span>
          </button>
        </div>
      </header>

      {/* Main Studio Body: Side-by-Side Editor & Live Preview */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Side: Control Drawer */}
        <aside className="w-full lg:w-[460px] border-r border-slate-800 bg-[#0E1524] flex flex-col shrink-0 overflow-hidden">
          {/* Navigation Sub-Tabs */}
          <div className="flex items-center border-b border-slate-800 bg-[#0B0F17]/60 p-2 gap-1.5 shrink-0">
            <button
              onClick={() => setActiveTab('sections')}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'sections' ? 'bg-orange-500 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              Page Sections ({sectionsList.length})
            </button>
            <button
              onClick={() => setActiveTab('add_section')}
              className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                activeTab === 'add_section' ? 'bg-orange-500 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Plus className="w-3.5 h-3.5" /> Add Section
            </button>
          </div>

          {/* TAB 1: SECTION LIST & CONFIGURATION */}
          {activeTab === 'sections' && (
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Section Accordion / List */}
              <div className="space-y-2">
                <label className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider block">
                  Reorder & Configure Sections
                </label>

                {sectionsList.map((sec, idx) => {
                  const isSelected = selectedSectionId === sec.id;
                  const secMeta = AVAILABLE_SECTION_TYPES.find((s) => s.type === sec.type);
                  const Icon = secMeta?.icon || Layers;

                  return (
                    <div
                      key={sec.id}
                      className={`border rounded-2xl transition-all ${
                        isSelected
                          ? 'border-orange-500 bg-[#131B2B] shadow-lg shadow-orange-500/10'
                          : 'border-slate-800 bg-[#0B0F17] hover:border-slate-700'
                      }`}
                    >
                      {/* Section Summary Header */}
                      <div
                        onClick={() => setSelectedSectionId(sec.id)}
                        className="p-3 flex items-center justify-between cursor-pointer"
                      >
                        <div className="flex items-center gap-3 overflow-hidden">
                          <div
                            className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs shrink-0 ${
                              isSelected ? 'bg-orange-500 text-white' : 'bg-slate-800 text-slate-300'
                            }`}
                          >
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="overflow-hidden">
                            <div className="font-bold text-xs text-white truncate">
                              {sec.config?.headline || secMeta?.label || sec.type}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono capitalize">
                              {secMeta?.label || sec.type}
                            </div>
                          </div>
                        </div>

                        {/* Quick Controls */}
                        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                          {/* Visibility Eye */}
                          <button
                            onClick={() => updateSectionMeta(sec.id, { isHidden: !sec.isHidden })}
                            className={`p-1.5 rounded-lg transition-colors ${
                              sec.isHidden ? 'text-slate-600 hover:text-slate-400' : 'text-emerald-400 hover:text-emerald-300'
                            }`}
                            title={sec.isHidden ? 'Hidden on customer home' : 'Visible on customer home'}
                          >
                            {sec.isHidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>

                          {/* Move Up */}
                          <button
                            disabled={idx === 0}
                            onClick={() => moveSection(idx, 'up')}
                            className="p-1.5 text-slate-400 hover:text-white disabled:opacity-20 rounded-lg"
                            title="Move Section Up"
                          >
                            <MoveUp className="w-3.5 h-3.5" />
                          </button>

                          {/* Move Down */}
                          <button
                            disabled={idx === sectionsList.length - 1}
                            onClick={() => moveSection(idx, 'down')}
                            className="p-1.5 text-slate-400 hover:text-white disabled:opacity-20 rounded-lg"
                            title="Move Section Down"
                          >
                            <MoveDown className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Expanded Section Configuration Form */}
                      {isSelected && (
                        <div className="p-4 border-t border-slate-800 bg-[#0E1524]/80 space-y-4 text-xs">
                          {/* Protected Section Notice for Cravings */}
                          {(sec.type === 'CRAVINGS' || sec.type === 'CRAVING_CATEGORIES') && (
                            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-start gap-2.5 text-amber-300">
                              <Sparkles className="w-4 h-4 shrink-0 mt-0.5" />
                              <div>
                                <p className="font-bold text-[11px]">Protected Visual Anchor Section</p>
                                <p className="text-[10px] text-amber-200/80 leading-relaxed mt-0.5">
                                  "What's Your Craving For?" automatically synchronizes with active menu categories with 4-second 3D rotating product imagery. Its visual structure is preserved for peak conversion.
                                </p>
                              </div>
                            </div>
                          )}

                          {/* Headline Input */}
                          <div>
                            <label className="text-[11px] font-bold text-slate-400 uppercase block mb-1">
                              Section Title / Headline
                            </label>
                            <input
                              type="text"
                              value={sec.config?.headline || ''}
                              onChange={(e) => updateSectionConfig(sec.id, { headline: e.target.value })}
                              placeholder="e.g. Festival Pizza Special"
                              className="w-full px-3 py-2 bg-[#0B0F17] border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none text-xs"
                            />
                          </div>

                          {/* Subtitle Input */}
                          <div>
                            <label className="text-[11px] font-bold text-slate-400 uppercase block mb-1">
                              Subtitle / Promotional Tagline
                            </label>
                            <input
                              type="text"
                              value={sec.config?.subtitle || ''}
                              onChange={(e) => updateSectionConfig(sec.id, { subtitle: e.target.value })}
                              placeholder="e.g. Handcrafted dough with fresh mozzarella"
                              className="w-full px-3 py-2 bg-[#0B0F17] border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none text-xs"
                            />
                          </div>

                          {/* Button Text & Action (For Hero / Promo sections) */}
                          {(sec.type === 'HERO' || sec.type === 'VIDEO_HERO' || sec.type === 'ADS') && (
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-[11px] font-bold text-slate-400 uppercase block mb-1">
                                  CTA Button Label
                                </label>
                                <input
                                  type="text"
                                  value={sec.config?.buttonText || ''}
                                  onChange={(e) => updateSectionConfig(sec.id, { buttonText: e.target.value })}
                                  placeholder="ORDER NOW"
                                  className="w-full px-3 py-2 bg-[#0B0F17] border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none text-xs"
                                />
                              </div>

                              <div>
                                <label className="text-[11px] font-bold text-slate-400 uppercase block mb-1">
                                  Button Action Target
                                </label>
                                <select
                                  value={sec.config?.buttonAction?.type || 'OPEN_MENU'}
                                  onChange={(e) =>
                                    updateSectionConfig(sec.id, {
                                      buttonAction: { type: e.target.value as any },
                                    })
                                  }
                                  className="w-full px-3 py-2 bg-[#0B0F17] border border-slate-800 rounded-xl text-white focus:border-orange-500 focus:outline-none text-xs"
                                >
                                  <option value="OPEN_MENU">Open Menu</option>
                                  <option value="OPEN_OFFERS">Open Offers & Combos</option>
                                  <option value="OPEN_CART">Open Cart</option>
                                  <option value="LOGIN">Open Login</option>
                                </select>
                              </div>
                            </div>
                          )}

                          {/* Media Chooser (Hero Image or Video) */}
                          <div className="space-y-1.5">
                            <label className="text-[11px] font-bold text-slate-400 uppercase flex items-center justify-between">
                              <span>Background Image / Video Asset</span>
                              {sec.config?.mediaUrl && (
                                <button
                                  onClick={() => updateSectionConfig(sec.id, { mediaUrl: '' })}
                                  className="text-[10px] text-rose-400 hover:underline"
                                >
                                  Remove Media
                                </button>
                              )}
                            </label>

                            {sec.config?.mediaUrl ? (
                              <div className="relative rounded-xl overflow-hidden border border-slate-800 aspect-video bg-black/50">
                                {sec.config.mediaUrl.match(/\.(mp4|mov|webm)/i) ? (
                                  <video src={sec.config.mediaUrl} className="w-full h-full object-cover" autoPlay muted loop />
                                ) : (
                                  <img src={sec.config.mediaUrl} alt="Preview" className="w-full h-full object-cover" />
                                )}
                              </div>
                            ) : null}

                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setMediaTargetField('mediaUrl');
                                  setShowMediaPicker(true);
                                }}
                                className="flex-1 py-2 bg-[#0B0F17] hover:bg-slate-800 border border-slate-700 text-slate-200 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all"
                              >
                                <ImageIcon className="w-3.5 h-3.5 text-orange-400" />
                                {sec.config?.mediaUrl ? 'Replace Media' : 'Choose / Upload Media'}
                              </button>
                            </div>
                          </div>

                          {/* Animation Picker */}
                          <div>
                            <label className="text-[11px] font-bold text-slate-400 uppercase block mb-1">
                              Section Animation
                            </label>
                            <select
                              value={sec.config?.animationType || 'None'}
                              onChange={(e) =>
                                updateSectionConfig(sec.id, { animationType: e.target.value as AnimationType })
                              }
                              className="w-full px-3 py-2 bg-[#0B0F17] border border-slate-800 rounded-xl text-white focus:border-orange-500 focus:outline-none text-xs"
                            >
                              {ANIMATION_OPTIONS.map((a) => (
                                <option key={a.value} value={a.value}>
                                  {a.label}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Theme Color Overrides */}
                          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800">
                            <div>
                              <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                                Background Tint
                              </label>
                              <div className="flex items-center gap-2 bg-[#0B0F17] p-1.5 rounded-xl border border-slate-800">
                                <input
                                  type="color"
                                  value={sec.config?.styleOverrides?.backgroundColor || '#0F172A'}
                                  onChange={(e) =>
                                    updateSectionConfig(sec.id, {
                                      styleOverrides: {
                                        ...sec.config?.styleOverrides,
                                        backgroundColor: e.target.value,
                                      },
                                    })
                                  }
                                  className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent"
                                />
                                <span className="text-[11px] font-mono text-slate-300">
                                  {sec.config?.styleOverrides?.backgroundColor || '#0F172A'}
                                </span>
                              </div>
                            </div>

                            <div>
                              <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                                Text Color
                              </label>
                              <div className="flex items-center gap-2 bg-[#0B0F17] p-1.5 rounded-xl border border-slate-800">
                                <input
                                  type="color"
                                  value={sec.config?.styleOverrides?.textColor || '#FFFFFF'}
                                  onChange={(e) =>
                                    updateSectionConfig(sec.id, {
                                      styleOverrides: {
                                        ...sec.config?.styleOverrides,
                                        textColor: e.target.value,
                                      },
                                    })
                                  }
                                  className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent"
                                />
                                <span className="text-[11px] font-mono text-slate-300">
                                  {sec.config?.styleOverrides?.textColor || '#FFFFFF'}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Duplicate & Delete Actions */}
                          <div className="flex gap-2 pt-2 border-t border-slate-800">
                            <button
                              type="button"
                              onClick={() => handleDuplicateSection(sec)}
                              className="flex-1 py-1.5 bg-[#0B0F17] hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-lg text-xs font-bold flex items-center justify-center gap-1"
                            >
                              <Copy className="w-3 h-3" /> Duplicate
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveSection(sec.id)}
                              className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500 border border-rose-500/30 text-rose-400 hover:text-white rounded-lg text-xs font-bold transition-all"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: ADD SECTION PICKER */}
          {activeTab === 'add_section' && (
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <label className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider block">
                Choose Component to Add
              </label>

              <div className="space-y-2">
                {AVAILABLE_SECTION_TYPES.map((sec) => {
                  const Icon = sec.icon;
                  return (
                    <button
                      key={sec.type}
                      type="button"
                      onClick={() => handleAddSection(sec.type)}
                      className="w-full p-3.5 bg-[#0B0F17] hover:bg-slate-800 border border-slate-800 hover:border-orange-500 rounded-2xl text-left flex items-start gap-3.5 transition-all group"
                    >
                      <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-400 flex items-center justify-center shrink-0 group-hover:bg-orange-500 group-hover:text-white transition-all">
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <div className="font-bold text-white text-xs flex items-center justify-between">
                          <span>{sec.label}</span>
                          <Plus className="w-4 h-4 text-orange-400" />
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">{sec.description}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </aside>

        {/* Right Side: Interactive Live Customer Parity Preview */}
        <main className="flex-1 bg-[#06070A] overflow-y-auto p-4 sm:p-8 flex flex-col items-center justify-start relative">
          <div
            className={`w-full transition-all duration-300 rounded-3xl overflow-hidden border border-slate-800 shadow-2xl bg-[#06070A] ${
              viewMode === 'mobile'
                ? 'max-w-[420px] min-h-[780px]'
                : viewMode === 'tablet'
                ? 'max-w-[768px] min-h-[850px]'
                : 'max-w-5xl min-h-[900px]'
            }`}
          >
            {/* Mock Header Preview */}
            <div className="bg-[#0E1524]/95 backdrop-blur-md p-3.5 border-b border-slate-800 flex items-center justify-between sticky top-0 z-30">
              <div className="flex items-center gap-2">
                <span className="text-base">🍕</span>
                <span className="font-black text-xs text-white">OLIVE PIZZA</span>
                <span className="text-[9px] font-extrabold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30">
                  OPEN NOW
                </span>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-slate-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Live View</span>
              </div>
            </div>

            {/* Render Sections with Rich Visual Parity */}
            <div className="p-4 space-y-5">
              {sectionsList
                .filter((s) => !s.isHidden)
                .map((sec) => {
                  const isSelected = selectedSectionId === sec.id;
                  const bg = sec.config?.styleOverrides?.backgroundColor || '#0F172A';
                  const textCol = sec.config?.styleOverrides?.textColor || '#FFFFFF';

                  return (
                    <div
                      key={sec.id}
                      onClick={() => setSelectedSectionId(sec.id)}
                      className={`relative rounded-3xl overflow-hidden transition-all cursor-pointer ${
                        isSelected ? 'ring-2 ring-orange-500 ring-offset-2 ring-offset-black' : 'hover:opacity-95'
                      }`}
                      style={{ backgroundColor: bg }}
                    >
                      {/* Section Type Tag in Preview */}
                      <span className="absolute top-3 right-3 px-2.5 py-0.5 rounded-md bg-black/70 backdrop-blur-sm text-[9px] font-black text-white uppercase tracking-wider z-20 border border-white/10">
                        {sec.type}
                      </span>

                      {/* 1. HERO / VIDEO HERO */}
                      {sec.type === 'HERO' || sec.type === 'VIDEO_HERO' ? (
                        <div className="p-8 sm:p-12 text-center relative overflow-hidden min-h-[300px] flex flex-col items-center justify-center">
                          {sec.config?.mediaUrl && (
                            <img
                              src={sec.config.mediaUrl}
                              alt="Hero Background"
                              className="absolute inset-0 w-full h-full object-cover opacity-45 z-0"
                            />
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent z-0" />
                          <div className="relative z-10 space-y-3 max-w-lg mx-auto">
                            <span className="px-3 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/20 text-[10px] font-black text-amber-300 inline-flex items-center gap-1">
                              <Flame className="w-3 h-3 text-orange-400" /> 34 people ordering right now
                            </span>
                            <h2 className="text-2xl sm:text-4xl font-black drop-shadow-lg" style={{ color: textCol }}>
                              {sec.config?.headline || 'Wood-Fired Gourmet Perfection'}
                            </h2>
                            {sec.config?.subtitle && (
                              <p className="text-xs sm:text-sm font-medium opacity-90 leading-relaxed" style={{ color: textCol }}>
                                {sec.config?.subtitle}
                              </p>
                            )}
                            {sec.config?.buttonText && (
                              <button className="mt-2 px-6 py-2.5 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-black text-xs sm:text-sm shadow-xl shadow-orange-500/40 inline-flex items-center gap-2">
                                <span>{sec.config.buttonText}</span>
                                <ArrowRight className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      ) : sec.type === 'COUNTDOWN' ? (
                        /* 2. FLASH SALE COUNTDOWN RIBBON */
                        <div className="p-4 flex items-center justify-between gap-3 text-xs">
                          <div className="flex items-center gap-2.5">
                            <Flame className="w-4 h-4 text-yellow-300 animate-bounce" />
                            <div>
                              <div className="font-black text-xs" style={{ color: textCol }}>
                                {sec.config?.headline || '⚡ FLASH SALE: Flat 50% OFF'}
                              </div>
                              {sec.config?.subtitle && (
                                <div className="text-[10px] opacity-80" style={{ color: textCol }}>
                                  {sec.config?.subtitle}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="bg-black/40 px-3 py-1 rounded-xl border border-white/20 font-mono font-black text-xs text-yellow-200 shrink-0">
                            02:45:10
                          </div>
                        </div>
                      ) : sec.type === 'CRAVINGS' ? (
                        /* 3. CRAVINGS CATEGORIES */
                        <div className="p-5 space-y-3">
                          <h3 className="text-xs font-black uppercase tracking-wider" style={{ color: textCol }}>
                            {sec.config?.headline || "WHAT'S YOUR CRAVING TODAY?"}
                          </h3>
                          <div className="grid grid-cols-4 gap-2">
                            {[
                              { label: 'Wood-Fired', emoji: '🍕', desc: 'Hand-stretched' },
                              { label: 'Cheese Burst', emoji: '🧀', desc: 'Liquid gold' },
                              { label: 'Garlic Bread', emoji: '🥖', desc: 'Herb butter' },
                              { label: 'Desserts', emoji: '🍫', desc: 'Lava cakes' },
                            ].map((cat, i) => (
                              <div
                                key={i}
                                className="p-2.5 rounded-2xl bg-black/40 border border-white/10 text-center hover:border-orange-500 transition-colors"
                              >
                                <span className="text-lg block mb-1">{cat.emoji}</span>
                                <div className="font-bold text-[10px] text-white leading-tight">{cat.label}</div>
                                <div className="text-[8px] text-slate-400 mt-0.5">{cat.desc}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : sec.type === 'FEATURED' ? (
                        /* 4. FEATURED BEST SELLERS */
                        <div className="p-5 space-y-3">
                          <div className="flex justify-between items-center">
                            <h3 className="text-xs font-black uppercase tracking-wider" style={{ color: textCol }}>
                              {sec.config?.headline || 'BEST SELLERS'}
                            </h3>
                            <span className="text-[10px] text-orange-400 font-bold">View Menu →</span>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            {[
                              { name: 'Margherita Supreme', price: '₹199', tag: '100% Pure Veg' },
                              { name: 'Spicy Paneer Tikka', price: '₹399', tag: '100% Pure Veg' },
                            ].map((p, i) => (
                              <div
                                key={i}
                                className="p-3 rounded-2xl bg-black/50 border border-white/10 flex flex-col justify-between space-y-2"
                              >
                                <div className="w-full aspect-video rounded-xl bg-slate-800 flex items-center justify-center text-xl">
                                  🍕
                                </div>
                                <div>
                                  <span className="text-[8px] font-extrabold text-emerald-400 uppercase tracking-wider">
                                    {p.tag}
                                  </span>
                                  <div className="font-bold text-xs text-white truncate">{p.name}</div>
                                </div>
                                <div className="flex justify-between items-center pt-1 border-t border-white/10">
                                  <span className="font-mono font-black text-xs text-orange-400">{p.price}</span>
                                  <button className="px-2.5 py-1 bg-orange-500 text-white font-black text-[10px] rounded-lg">
                                    + ADD
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : sec.type === 'COUPONS' ? (
                        /* 5. COUPONS & PROMOS */
                        <div className="p-5 space-y-2">
                          <h3 className="text-xs font-black uppercase tracking-wider" style={{ color: textCol }}>
                            {sec.config?.headline || 'EXCLUSIVE PROMO CODES'}
                          </h3>
                          <div className="p-3.5 bg-gradient-to-r from-orange-600/30 via-amber-600/20 to-transparent rounded-2xl border border-orange-500/40 flex justify-between items-center">
                            <div>
                              <div className="font-black text-white text-xs">DIWALI50 — FLAT 50% OFF</div>
                              <div className="text-[10px] text-slate-300">On all orders above ₹499 • Auto-applied</div>
                            </div>
                            <span className="px-3 py-1.5 bg-orange-500 text-white font-black text-[10px] rounded-xl shadow-md">
                              COPY CODE
                            </span>
                          </div>
                        </div>
                      ) : sec.type === 'TESTIMONIALS' ? (
                        /* 6. TESTIMONIALS & SOCIAL PROOF */
                        <div className="p-5 space-y-3">
                          <h3 className="text-xs font-black uppercase tracking-wider" style={{ color: textCol }}>
                            {sec.config?.headline || 'CUSTOMER REVIEWS'}
                          </h3>
                          <div className="p-3.5 bg-black/40 rounded-2xl border border-white/10 space-y-1.5">
                            <div className="flex items-center gap-1 text-amber-400">
                              {[...Array(5)].map((_, i) => (
                                <Star key={i} className="w-3 h-3 fill-current" />
                              ))}
                            </div>
                            <p className="text-[11px] text-slate-300 italic">
                              "The crunchiest wood-fired crust in town! Fresh toppings and delivered piping hot in 20 minutes."
                            </p>
                            <div className="text-[10px] font-bold text-white">— Priya S., Verified Foodie</div>
                          </div>
                        </div>
                      ) : (
                        /* 7. GENERIC SECTION */
                        <div className="p-6 text-center space-y-1">
                          <h4 className="font-black text-sm" style={{ color: textCol }}>
                            {sec.config?.headline || sec.type}
                          </h4>
                          <p className="text-[11px] opacity-75" style={{ color: textCol }}>
                            {sec.config?.subtitle || 'Live section component'}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>

            {/* Mock Floating Cart Bar in Preview */}
            <div className="sticky bottom-0 bg-[#0E1524]/95 backdrop-blur-md p-3 border-t border-slate-800 flex items-center justify-between z-30">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-orange-400" />
                <span className="text-xs font-black text-white">View Cart (2 Items)</span>
              </div>
              <button className="px-4 py-1.5 bg-orange-500 text-white font-black text-xs rounded-xl shadow-md">
                Checkout ₹598 →
              </button>
            </div>
          </div>
        </main>
      </div>

      {/* Media Library Picker Modal */}
      {showMediaPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="bg-[#0E1524] border border-slate-800 w-full max-w-2xl rounded-3xl p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-white">Media Library & Cloudinary Assets</h3>
                <p className="text-xs text-slate-400">Select an existing photo/video or upload a new file from your device.</p>
              </div>
              <button
                onClick={() => setShowMediaPicker(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Direct Upload Box */}
            <label className="p-4 border-2 border-dashed border-slate-700 hover:border-orange-500 rounded-2xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-all bg-[#0B0F17]">
              <Upload className="w-6 h-6 text-orange-400" />
              <div className="text-xs font-bold text-white">
                {uploadingMedia ? 'Uploading to Cloudinary...' : 'Click to Upload Image or Video'}
              </div>
              <div className="text-[10px] text-slate-400">Supports JPG, PNG, WEBP, MP4, MOV (Up to 10MB)</div>
              <input
                type="file"
                accept="image/*,video/*"
                onChange={handleFileUpload}
                disabled={uploadingMedia}
                className="hidden"
              />
            </label>

            {/* Existing Assets Grid */}
            <div className="flex-1 overflow-y-auto space-y-2">
              <label className="text-[11px] font-bold text-slate-400 uppercase block">
                Existing Cloudinary Media ({mediaList.length})
              </label>

              {mediaList.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-xs">No media assets found in library.</div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {mediaList.map((m: any, idx: number) => {
                    const url = m.url || m.secure_url;
                    if (!url) return null;
                    const isVid = url.match(/\.(mp4|mov|webm)/i) || (m.resource_type === 'video');

                    return (
                      <div
                        key={idx}
                        onClick={() => {
                          if (selectedSection) {
                            updateSectionConfig(selectedSection.id, { [mediaTargetField]: url });
                          }
                          setShowMediaPicker(false);
                          toast.success('Media attached to section!');
                        }}
                        className="relative rounded-xl overflow-hidden border border-slate-800 hover:border-orange-500 aspect-video bg-black cursor-pointer group"
                      >
                        {isVid ? (
                          <div className="w-full h-full flex items-center justify-center bg-slate-900">
                            <Film className="w-6 h-6 text-slate-500" />
                          </div>
                        ) : (
                          <img src={url} alt="Media" className="w-full h-full object-cover" />
                        )}
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-[10px] font-black text-white">
                          Select
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
