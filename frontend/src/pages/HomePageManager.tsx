import React, { useState, useEffect } from 'react';
import {
  LayoutTemplate,
  Plus,
  Sparkles,
  Eye,
  Edit3,
  Copy,
  Trash2,
  Rocket,
  CheckCircle2,
  Clock,
  Layers,
  Film,
  Calendar,
  Smartphone,
  Tablet,
  Monitor,
  X,
  AlertCircle,
  HelpCircle,
  FolderHeart,
  Palette,
  RotateCcw,
} from 'lucide-react';
import { PageSchema, BuiltInPageSchema } from '../types/PageSchema';
import { PREDEFINED_TEMPLATES } from '../utils/HomePageTemplates';
import HomePageEditor from '../components/home/HomePageEditor';
import { db } from '../lib/firebase';
import { collection, onSnapshot, doc } from 'firebase/firestore';
import { fetchApi } from '../lib/api';
import toast from 'react-hot-toast';

type TabCategory = 'available' | 'default' | 'draft' | 'made_by_me';

export default function HomePageManager() {
  const [activeTab, setActiveTab] = useState<TabCategory>('available');
  const [madeByMeTemplates, setMadeByMeTemplates] = useState<PageSchema[]>([]);
  const [livePageId, setLivePageId] = useState<string>('default');
  const [liveTemplateName, setLiveTemplateName] = useState<string>('Default Home');
  const [loading, setLoading] = useState(true);

  // Active Editor state
  const [editingTemplate, setEditingTemplate] = useState<PageSchema | null>(null);
  const [isEditingOfficial, setIsEditingOfficial] = useState(false);

  // Preview Modal state
  const [previewTemplate, setPreviewTemplate] = useState<PageSchema | null>(null);
  const [previewDevice, setPreviewDevice] = useState<'mobile' | 'tablet' | 'desktop'>('mobile');

  // Publish Confirmation Dialog state
  const [publishTarget, setPublishTarget] = useState<PageSchema | null>(null);
  const [publishing, setPublishing] = useState(false);

  // Rename modal state
  const [renameTarget, setRenameTarget] = useState<{ id: string; name: string } | null>(null);

  // 1. Listen for Live Homepage Configuration in Firestore
  useEffect(() => {
    // Initial fetch from live API
    fetchApi('/api/homepage/live')
      .then((r) => r.json())
      .then((d) => {
        if (d.config) {
          setLivePageId(d.config.pageId || 'default');
          setLiveTemplateName(d.config.metadata?.name || 'Default Home');
        }
      })
      .catch(() => {});

    // Real-time Firestore sync for instant live badge updates
    const unsubscribeLive = onSnapshot(
      doc(db, 'settings', 'homepage'),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (data?.activePageId) setLivePageId(data.activePageId);
          if (data?.activeTemplateName) setLiveTemplateName(data.activeTemplateName);
        }
      },
      () => {}
    );

    return () => unsubscribeLive();
  }, []);

  // 2. Listen for "Made by Me" Templates in Firestore & API
  useEffect(() => {
    setLoading(true);
    const unsubscribeTemplates = onSnapshot(
      collection(db, 'made_by_me_templates'),
      (snapshot) => {
        const fetched: PageSchema[] = [];
        snapshot.forEach((d) => {
          fetched.push({ ...d.data(), pageId: d.id } as PageSchema);
        });
        setMadeByMeTemplates(fetched);
        setLoading(false);
      },
      () => {
        // Fallback to API endpoint
        fetchApi('/api/homepage/made-by-me')
          .then((r) => r.json())
          .then((d) => setMadeByMeTemplates(d.templates || []))
          .catch(() => {})
          .finally(() => setLoading(false));
      }
    );

    return () => unsubscribeTemplates();
  }, []);

  // Official Seasonal Templates (Excluding default and draft)
  const availableTemplates = PREDEFINED_TEMPLATES.filter(
    (t) => t.pageId !== 'default' && t.pageId !== 'draft_template'
  );

  // Default Home Template
  const defaultHomeTemplate = PREDEFINED_TEMPLATES.find((t) => t.pageId === 'default') || PREDEFINED_TEMPLATES[0];

  // Draft Blank Template
  const draftTemplate = PREDEFINED_TEMPLATES.find((t) => t.pageId === 'draft_template') || {
    versionId: 'v1',
    pageId: 'draft_template',
    type: 'BUILT_IN',
    templateId: 'draft_template',
    metadata: {
      name: 'Draft Template',
      description: 'Blank customizable canvas to build a completely custom homepage from scratch.',
      publishedBy: 'system',
      publishedAt: new Date().toISOString(),
    },
    sections: [
      {
        id: 'hero_1',
        type: 'HERO',
        isHidden: false,
        config: {
          headline: 'New Campaign Headline',
          subtitle: 'Add your custom campaign description here.',
          animationType: 'Fade Up',
          buttonText: 'ORDER NOW',
          buttonAction: { type: 'OPEN_MENU' },
        },
      },
      {
        id: 'cravings_1',
        type: 'CRAVINGS',
        isHidden: false,
        config: { headline: "WHAT'S YOUR CRAVING FOR?", subtitle: 'Choose from our artisan menu.' },
      },
      { id: 'featured_1', type: 'FEATURED', isHidden: false, config: {} },
    ],
  };

  // Start Editing a Template
  const handleStartEdit = (template: PageSchema, isOfficial: boolean) => {
    if (isOfficial) {
      // Create a customized copy under Made by Me to protect the official immutable template
      const copyName = `${template.metadata?.name || 'Template'} — Made by Me`;
      const clonedSchema: PageSchema = {
        ...JSON.parse(JSON.stringify(template)),
        pageId: `custom_${template.pageId}_${Date.now().toString(36)}`,
        isOwnerCustom: true,
        metadata: {
          ...template.metadata,
          name: copyName,
          publishedAt: new Date().toISOString(),
        },
      };
      setEditingTemplate(clonedSchema);
      setIsEditingOfficial(true);
      toast(`Customizing ${template.metadata?.name}. Original official template remains protected.`, {
        icon: '🎨',
      });
    } else {
      setEditingTemplate(JSON.parse(JSON.stringify(template)));
      setIsEditingOfficial(false);
    }
  };

  // Duplicate a Template
  const handleDuplicate = async (template: PageSchema) => {
    const toastId = toast.loading('Duplicating template into Made by Me...');
    try {
      const newPageId = `custom_${template.pageId}_${Date.now().toString(36)}`;
      const duplicated: PageSchema = {
        ...JSON.parse(JSON.stringify(template)),
        pageId: newPageId,
        metadata: {
          ...template.metadata,
          name: `${template.metadata?.name || 'Custom Home'} (Copy)`,
          publishedAt: new Date().toISOString(),
        },
      };

      await fetchApi('/api/homepage/made-by-me', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schema: duplicated }),
      });

      toast.success(`Duplicated as "${duplicated.metadata.name}" in Made by Me!`, { id: toastId });
      setActiveTab('made_by_me');
    } catch (e: any) {
      toast.error('Failed to duplicate: ' + e.message, { id: toastId });
    }
  };

  // Delete a Made by Me Template
  const handleDeleteTemplate = async (template: PageSchema) => {
    if (PREDEFINED_TEMPLATES.some((t) => t.pageId === template.pageId)) {
      toast.error('Official prebuilt templates cannot be deleted.');
      return;
    }

    if (!window.confirm(`Delete "${template.metadata?.name || template.pageId}" permanently from Made by Me?`)) {
      return;
    }

    const toastId = toast.loading('Deleting template...');
    try {
      await fetchApi(`/api/homepage/made-by-me/${template.pageId}`, {
        method: 'DELETE',
      });
      toast.success('Template deleted from Made by Me.', { id: toastId });
    } catch (e: any) {
      toast.error('Delete failed: ' + e.message, { id: toastId });
    }
  };

  // Rename a Made by Me Template
  const handleSaveRename = async () => {
    if (!renameTarget || !renameTarget.name.trim()) return;
    const target = madeByMeTemplates.find((t) => t.pageId === renameTarget.id);
    if (!target) return;

    const toastId = toast.loading('Renaming template...');
    try {
      const updated: PageSchema = {
        ...target,
        metadata: {
          ...target.metadata,
          name: renameTarget.name.trim(),
        },
      };

      await fetchApi('/api/homepage/made-by-me', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schema: updated }),
      });

      toast.success('Template renamed successfully!', { id: toastId });
      setRenameTarget(null);
    } catch (e: any) {
      toast.error('Rename failed: ' + e.message, { id: toastId });
    }
  };

  // Save changes from editor (Draft or Publish)
  const handleSaveFromEditor = async (savedSchema: PageSchema, isPublish: boolean) => {
    const toastId = toast.loading(isPublish ? 'Publishing live to customer homepage...' : 'Saving to Made by Me...');
    try {
      // 1. Save to Made by Me collection
      const saveRes = await fetchApi('/api/homepage/made-by-me', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schema: savedSchema }),
      });
      const saveData = await saveRes.json();

      if (!saveData.success) {
        throw new Error(saveData.error || 'Failed to save template');
      }

      // 2. If publish requested, execute 1-click switch
      if (isPublish) {
        const pubRes = await fetchApi('/api/homepage/switch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pageId: savedSchema.pageId, schema: savedSchema }),
        });
        const pubData = await pubRes.json();
        if (!pubData.success) throw new Error(pubData.error || 'Publish failed');

        setLivePageId(savedSchema.pageId);
        setLiveTemplateName(savedSchema.metadata?.name || 'Custom Home');
        toast.success(`🎉 "${savedSchema.metadata?.name}" is now LIVE on the customer website and app!`, {
          id: toastId,
          duration: 5000,
        });
      } else {
        toast.success(`Saved "${savedSchema.metadata?.name}" to Made by Me.`, { id: toastId });
      }

      setEditingTemplate(null);
      setActiveTab('made_by_me');
    } catch (err: any) {
      toast.error(`Operation failed: ${err.message}`, { id: toastId });
      throw err;
    }
  };

  // Direct 1-Click Publish from Card Action
  const handleConfirmPublish = async () => {
    if (!publishTarget) return;
    setPublishing(true);
    const toastId = toast.loading(`Publishing "${publishTarget.metadata?.name}" to live homepage...`);
    try {
      const res = await fetchApi('/api/homepage/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageId: publishTarget.pageId, schema: publishTarget }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Publish failed');

      setLivePageId(publishTarget.pageId);
      setLiveTemplateName(publishTarget.metadata?.name || publishTarget.pageId);
      toast.success(`🎉 "${publishTarget.metadata?.name}" is now the active live homepage!`, {
        id: toastId,
        duration: 5000,
      });
      setPublishTarget(null);
    } catch (e: any) {
      toast.error(`Publish failed: ${e.message}`, { id: toastId });
    } finally {
      setPublishing(false);
    }
  };

  // Card Component for Displaying Templates
  const renderTemplateCard = (template: PageSchema, category: 'official' | 'default' | 'draft' | 'made_by_me') => {
    const isLive = livePageId === template.pageId;
    const isOfficial = category === 'official' || category === 'default' || category === 'draft';
    const sectionCount = (template as any).sections?.length || 0;
    const heroSection = (template as any).sections?.find((s) => s.type === 'HERO' || s.type === 'VIDEO_HERO');
    const heroBg = heroSection?.config?.styleOverrides?.backgroundColor || '#0F172A';

    return (
      <div
        key={template.pageId}
        className={`bg-[#0E1524] border rounded-3xl overflow-hidden shadow-xl flex flex-col justify-between transition-all group ${
          isLive ? 'border-orange-500 ring-2 ring-orange-500/20' : 'border-slate-800 hover:border-slate-700'
        }`}
      >
        {/* Card Header Preview Banner */}
        <div
          className="h-32 p-4 relative flex flex-col justify-between overflow-hidden"
          style={{ backgroundColor: heroBg }}
        >
          {/* Subtle Ambient Radial Gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent z-10" />

          {/* Badges */}
          <div className="relative z-20 flex items-center justify-between">
            <span
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                isLive
                  ? 'bg-emerald-500 text-black shadow-md shadow-emerald-500/30 animate-pulse'
                  : category === 'made_by_me'
                  ? 'bg-purple-500/20 border border-purple-500/40 text-purple-300'
                  : 'bg-black/60 border border-white/10 text-slate-300'
              }`}
            >
              {isLive ? '🟢 Currently Live' : category === 'made_by_me' ? 'Made by Me' : 'Available Template'}
            </span>

            <span className="text-[10px] font-bold text-slate-300 bg-black/60 px-2 py-0.5 rounded-md border border-white/10">
              {sectionCount} Sections
            </span>
          </div>

          {/* Title on Banner */}
          <div className="relative z-20">
            <h3 className="text-base font-black text-white truncate drop-shadow-md">
              {template.metadata?.name || template.pageId}
            </h3>
          </div>
        </div>

        {/* Card Body */}
        <div className="p-5 space-y-4 flex-1 flex flex-col justify-between">
          <div className="space-y-2">
            <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
              {template.metadata?.description || 'Customized Olive Pizza homepage layout.'}
            </p>

            {/* Section Tag Pills */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {(template as any).sections?.slice(0, 4).map((sec, i) => (
                <span
                  key={i}
                  className="px-2 py-0.5 rounded-md bg-[#0B0F17] border border-slate-800 text-[10px] font-mono text-slate-400 uppercase"
                >
                  {sec.type}
                </span>
              ))}
              {sectionCount > 4 && (
                <span className="px-1.5 py-0.5 rounded-md bg-[#0B0F17] text-[10px] text-slate-500 font-mono">
                  +{sectionCount - 4} more
                </span>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2 pt-3 border-t border-slate-800/80">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPreviewTemplate(template)}
                className="py-2 px-3 bg-[#0B0F17] hover:bg-slate-800 border border-slate-800 text-slate-200 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all"
              >
                <Eye className="w-3.5 h-3.5 text-slate-400" /> Preview
              </button>

              <button
                type="button"
                onClick={() => handleStartEdit(template, isOfficial)}
                className="py-2 px-3 bg-orange-500/10 hover:bg-orange-500 border border-orange-500/30 text-orange-400 hover:text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all"
              >
                <Edit3 className="w-3.5 h-3.5" /> Edit Page
              </button>
            </div>

            {/* Publish Live / Duplicate / Manage Row */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPublishTarget(template)}
                disabled={isLive}
                className={`flex-1 py-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all ${
                  isLive
                    ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 opacity-60 cursor-default'
                    : 'bg-orange-600 hover:bg-orange-500 text-white shadow-md shadow-orange-600/20'
                }`}
              >
                <Rocket className="w-3.5 h-3.5" />
                {isLive ? 'Active on Live Site' : 'Publish to Home Page'}
              </button>

              <button
                type="button"
                onClick={() => handleDuplicate(template)}
                className="p-2 bg-[#0B0F17] hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white rounded-xl"
                title="Duplicate to Made by Me"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>

              {!isOfficial && (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      setRenameTarget({
                        id: template.pageId,
                        name: template.metadata?.name || '',
                      })
                    }
                    className="p-2 bg-[#0B0F17] hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white rounded-xl"
                    title="Rename Template"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDeleteTemplate(template)}
                    className="p-2 bg-rose-500/10 hover:bg-rose-500 border border-rose-500/30 text-rose-400 hover:text-white rounded-xl transition-all"
                    title="Delete from Made by Me"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#0E1524] p-5 sm:p-6 rounded-3xl border border-slate-800 shadow-xl">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">Home Page Manager</h1>
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-black">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Live: {liveTemplateName}</span>
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Visual homepage designer, festival seasonal templates, live preview & 1-click publishing.
          </p>
        </div>

        {/* Create Blank Custom Page */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleStartEdit(draftTemplate, true)}
            className="px-4 py-2.5 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-xl text-xs flex items-center gap-2 transition-all shadow-lg shadow-orange-600/25 cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Create Custom Page
          </button>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex flex-wrap items-center gap-2 bg-[#0E1524] p-2 rounded-2xl border border-slate-800">
        <button
          onClick={() => setActiveTab('available')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'available'
              ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          Available Templates ({availableTemplates.length})
        </button>

        <button
          onClick={() => setActiveTab('default')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'default'
              ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <LayoutTemplate className="w-3.5 h-3.5" />
          Default Home
        </button>

        <button
          onClick={() => setActiveTab('draft')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'draft'
              ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Edit3 className="w-3.5 h-3.5" />
          Draft Template
        </button>

        <button
          onClick={() => setActiveTab('made_by_me')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'made_by_me'
              ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <FolderHeart className="w-3.5 h-3.5" />
          Made by Me ({madeByMeTemplates.length})
        </button>
      </div>

      {/* TAB 1: AVAILABLE SEASONAL TEMPLATES */}
      {activeTab === 'available' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-extrabold text-white uppercase tracking-wider">
                Prebuilt Festival & Seasonal Templates
              </h2>
              <p className="text-xs text-slate-400">
                Official Olive Pizza festival designs. Editing creates an owner-customized copy under Made by Me.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {availableTemplates.map((t) => renderTemplateCard(t, 'official'))}
          </div>
        </div>
      )}

      {/* TAB 2: DEFAULT HOME */}
      {activeTab === 'default' && (
        <div className="space-y-4">
          <div>
            <h2 className="text-sm font-extrabold text-white uppercase tracking-wider">
              Default Flagship Olive Pizza Homepage
            </h2>
            <p className="text-xs text-slate-400">
              The standard wood-fired artisan customer experience. Always available as an immutable baseline.
            </p>
          </div>

          <div className="max-w-md">
            {renderTemplateCard(defaultHomeTemplate, 'default')}
          </div>
        </div>
      )}

      {/* TAB 3: DRAFT TEMPLATE */}
      {activeTab === 'draft' && (
        <div className="space-y-4">
          <div>
            <h2 className="text-sm font-extrabold text-white uppercase tracking-wider">
              Blank Draft Template
            </h2>
            <p className="text-xs text-slate-400">
              Start with a clean canvas to build a completely customized campaign or special event page.
            </p>
          </div>

          <div className="max-w-md">
            {renderTemplateCard(draftTemplate as any, 'draft')}
          </div>
        </div>
      )}

      {/* TAB 4: MADE BY ME (CUSTOM OWNER TEMPLATES) */}
      {activeTab === 'made_by_me' && (
        <div className="space-y-4">
          <div>
            <h2 className="text-sm font-extrabold text-white uppercase tracking-wider">
              Customized Pages & Templates Created by You
            </h2>
            <p className="text-xs text-slate-400">
              All your customized festival themes, drafts, and campaign pages are preserved here permanently.
            </p>
          </div>

          {madeByMeTemplates.length === 0 ? (
            <div className="bg-[#0E1524] border border-slate-800 rounded-3xl p-12 text-center space-y-4">
              <FolderHeart className="w-12 h-12 text-orange-400 mx-auto opacity-60" />
              <div>
                <h3 className="text-base font-extrabold text-white">No Custom Pages Saved Yet</h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
                  You haven't created any custom homepage designs yet. Choose any prebuilt template or start from Draft to build one.
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleStartEdit(draftTemplate, true)}
                className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-xl text-xs inline-flex items-center gap-2"
              >
                <Plus className="w-4 h-4" /> Start New Design
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {madeByMeTemplates.map((t) => renderTemplateCard(t, 'made_by_me'))}
            </div>
          )}
        </div>
      )}

      {/* FULL SCREEN HOME PAGE EDITOR MODAL */}
      {editingTemplate && (
        <HomePageEditor
          initialSchema={editingTemplate}
          isOfficialTemplate={isEditingOfficial}
          onSave={handleSaveFromEditor}
          onClose={() => setEditingTemplate(null)}
        />
      )}

      {/* INTERACTIVE PREVIEW MODAL */}
      {previewTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="bg-[#0E1524] border border-slate-800 w-full max-w-4xl rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
            {/* Preview Header */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-[#0B0F17]">
              <div>
                <h3 className="text-base font-extrabold text-white">{previewTemplate.metadata?.name}</h3>
                <p className="text-[11px] text-slate-400">Live Customer Parity Preview</p>
              </div>

              {/* Viewport controls */}
              <div className="flex items-center gap-2">
                <div className="flex items-center bg-[#0E1524] p-1 rounded-xl border border-slate-800">
                  <button
                    onClick={() => setPreviewDevice('mobile')}
                    className={`p-1.5 rounded-lg ${previewDevice === 'mobile' ? 'bg-orange-500 text-white' : 'text-slate-400'}`}
                  >
                    <Smartphone className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setPreviewDevice('tablet')}
                    className={`p-1.5 rounded-lg ${previewDevice === 'tablet' ? 'bg-orange-500 text-white' : 'text-slate-400'}`}
                  >
                    <Tablet className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setPreviewDevice('desktop')}
                    className={`p-1.5 rounded-lg ${previewDevice === 'desktop' ? 'bg-orange-500 text-white' : 'text-slate-400'}`}
                  >
                    <Monitor className="w-4 h-4" />
                  </button>
                </div>

                <button
                  onClick={() => setPreviewTemplate(null)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Preview Viewport Frame */}
            <div className="flex-1 overflow-y-auto p-6 flex justify-center bg-[#06070A]">
              <div
                className={`w-full bg-[#06070A] rounded-2xl overflow-hidden border border-slate-800 shadow-2xl space-y-4 p-4 ${
                  previewDevice === 'mobile'
                    ? 'max-w-[400px]'
                    : previewDevice === 'tablet'
                    ? 'max-w-[768px]'
                    : 'max-w-4xl'
                }`}
              >
                {(previewTemplate as any).sections?.map((sec, idx) => (
                  <div
                    key={idx}
                    className="p-6 rounded-2xl border border-slate-800 text-center relative overflow-hidden"
                    style={{
                      backgroundColor: sec.config?.styleOverrides?.backgroundColor || '#0F172A',
                      color: sec.config?.styleOverrides?.textColor || '#FFFFFF',
                    }}
                  >
                    {sec.config?.mediaUrl && (
                      <img
                        src={sec.config.mediaUrl}
                        alt="Media"
                        className="absolute inset-0 w-full h-full object-cover opacity-30"
                      />
                    )}
                    <div className="relative z-10 space-y-2">
                      <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-black/50">
                        {sec.type}
                      </span>
                      <h4 className="text-lg font-black">{sec.config?.headline || sec.type}</h4>
                      {sec.config?.subtitle && <p className="text-xs opacity-80">{sec.config.subtitle}</p>}
                      {sec.config?.buttonText && (
                        <button className="px-4 py-1.5 rounded-full bg-orange-500 text-white font-bold text-xs mt-2">
                          {sec.config.buttonText}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Preview Footer Actions */}
            <div className="p-4 border-t border-slate-800 bg-[#0B0F17] flex justify-end gap-3">
              <button
                onClick={() => setPreviewTemplate(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs"
              >
                Close Preview
              </button>
              <button
                onClick={() => {
                  const t = previewTemplate;
                  setPreviewTemplate(null);
                  setPublishTarget(t);
                }}
                className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5"
              >
                <Rocket className="w-3.5 h-3.5" /> Publish this Page
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 1-CLICK PUBLISH CONFIRMATION MODAL */}
      {publishTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="bg-[#0E1524] border border-slate-800 w-full max-w-md rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-orange-500/10 border border-orange-500/20 text-orange-400 flex items-center justify-center text-2xl mx-auto">
              🚀
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-extrabold text-white">Publish Live to Customer Homepage?</h3>
              <p className="text-xs text-slate-400">
                You are about to make <strong className="text-white">"{publishTarget.metadata?.name}"</strong> the active homepage for all customers on the Olive Pizza website and Android app.
              </p>
            </div>

            <div className="p-3 bg-[#0B0F17] rounded-xl border border-slate-800 space-y-1 text-xs text-slate-300">
              <div className="flex justify-between">
                <span className="text-slate-500">Template ID:</span>
                <span className="font-mono text-white">{publishTarget.pageId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Total Sections:</span>
                <span className="font-bold text-white">{(publishTarget as any).sections?.length || 0}</span>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPublishTarget(null)}
                disabled={publishing}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmPublish}
                disabled={publishing}
                className="flex-1 py-2.5 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-orange-600/20 disabled:opacity-50"
              >
                {publishing ? 'Publishing...' : 'Yes, Publish Live'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RENAME MODAL */}
      {renameTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="bg-[#0E1524] border border-slate-800 w-full max-w-sm rounded-3xl p-6 shadow-2xl space-y-4">
            <h3 className="text-sm font-extrabold text-white">Rename Custom Template</h3>
            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase block mb-1">New Template Name</label>
              <input
                type="text"
                value={renameTarget.name}
                onChange={(e) => setRenameTarget({ ...renameTarget, name: e.target.value })}
                className="w-full px-3 py-2 bg-[#0B0F17] border border-slate-800 rounded-xl text-white text-xs focus:border-orange-500 focus:outline-none"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRenameTarget(null)}
                className="flex-1 py-2 bg-slate-800 text-slate-300 font-bold rounded-xl text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveRename}
                className="flex-1 py-2 bg-orange-600 text-white font-bold rounded-xl text-xs"
              >
                Save Name
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
