import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { 
  Monitor, Smartphone, Upload, CheckCircle, History, Save, Tablet, 
  EyeOff, RefreshCw, Layout, Layers, Plus, Code, Maximize2, ArrowLeft, X
} from 'lucide-react';
import toast from 'react-hot-toast';
import PageRenderer from '../components/home/PageRenderer';
import { PageSchema, BuiltInPageSchema, SimplifiedSectionSchema } from '../types/PageSchema';
import PropertyPanel from '../components/home/editor/PropertyPanel';
import { PREDEFINED_TEMPLATES } from '../utils/HomePageTemplates';
import PizzaLoader from '../components/ui/PizzaLoader';

type ViewMode = 'desktop' | 'tablet' | 'mobile';

export default function HomePageManager() {
  const [schema, setSchema] = useState<PageSchema | null>(null);
  const [collection, setCollection] = useState<PageSchema[]>(PREDEFINED_TEMPLATES);
  const [activePageId, setActivePageId] = useState<string>('default');
  
  const [history, setHistory] = useState<PageSchema[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [viewMode, setViewMode] = useState<ViewMode>('mobile');
  const [mobileWidthPreset, setMobileWidthPreset] = useState<number>(390);
  const [isFullScreenPreview, setIsFullScreenPreview] = useState(false);
  
  const [isPublishing, setIsPublishing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Visual Editor State
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { getCurrentAuthToken } = await import('../lib/firebase');
      const token = await getCurrentAuthToken().catch(() => '');

      // Fetch Live Config
      const resConfig = await fetch('/api/homepage/config', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const dataConfig = await resConfig.json();
      
      if (dataConfig.success && dataConfig.config) {
        setSchema(dataConfig.config);
        setActivePageId(dataConfig.config.pageId || 'default');
        setHistory([dataConfig.config]);
        setHistoryIndex(0);
      } else {
        // Fallback to default template if live config fails
        const defaultTmpl = PREDEFINED_TEMPLATES[0];
        setSchema(defaultTmpl);
        setActivePageId('default');
        setHistory([defaultTmpl]);
        setHistoryIndex(0);
      }

      // Fetch Collection
      const resCol = await fetch('/api/homepage/collection', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const dataCol = await resCol.json();
      if (dataCol.success && Array.isArray(dataCol.collection) && dataCol.collection.length > 0) {
        setCollection(dataCol.collection);
      }
    } catch (error) {
      console.error(error);
      toast.error('Loaded default template studio.');
      if (!schema && PREDEFINED_TEMPLATES.length > 0) {
        setSchema(PREDEFINED_TEMPLATES[0]);
        setHistory([PREDEFINED_TEMPLATES[0]]);
        setHistoryIndex(0);
      }
    }
    setLoading(false);
  };

  const pushHistory = (newSchema: PageSchema) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newSchema);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    setSchema(newSchema);
  };

  const handleSwitchPage = async (pageId: string) => {
    const target = collection.find(p => p.pageId === pageId);
    if (!target) return;
    
    // Switch locally to preview
    setActivePageId(pageId);
    pushHistory(target);
    setSelectedSectionId(null);
  };

  const handleMakeTemplateLive = async () => {
    if (!schema) return;
    setIsPublishing(true);
    try {
      const { getCurrentAuthToken } = await import('../lib/firebase');
      const token = await getCurrentAuthToken().catch(() => '');

      const res = await fetch('/api/homepage/switch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ pageId: activePageId, schema })
      });
      const data = await res.json();
      
      if (data.success) {
        toast.success(`Published! ${activePageId} layout is now live.`);
        setSchema(data.config);
      } else {
        throw new Error(data.error || 'Failed to switch live layout');
      }
    } catch (error: any) {
      toast.error('Failed to make live: ' + error.message);
    }
    setIsPublishing(false);
  };

  const handleSaveDraft = async () => {
    if (!schema) return;
    try {
      const { getCurrentAuthToken } = await import('../lib/firebase');
      const token = await getCurrentAuthToken().catch(() => '');

      const res = await fetch('/api/homepage/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ schema })
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Draft saved successfully.');
        setSchema(data.config);
      } else {
        toast.error('Failed to save draft');
      }
    } catch (e: any) {
      toast.error('Network error');
    }
  };

  const handleRollback = async () => {
    try {
      const { getCurrentAuthToken } = await import('../lib/firebase');
      const token = await getCurrentAuthToken().catch(() => '');

      const res = await fetch('/api/homepage/rollback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({})
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Restored to default live version.');
        pushHistory(data.config);
      } else {
        toast.error('Failed to rollback');
      }
    } catch (e: any) {
      toast.error('Network error');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsUploading(true);
    const formData = new FormData();
    formData.append('package', file);
    formData.append('pageId', 'custom-upload-' + Date.now());

    try {
      const { getCurrentAuthToken } = await import('../lib/firebase');
      const token = await getCurrentAuthToken().catch(() => '');

      const res = await fetch('/api/homepage/upload-custom', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        pushHistory(data.schema);
        setCollection([...collection, data.schema]);
        setActivePageId(data.schema.pageId);
        toast.success('Custom package uploaded successfully');
      } else {
        toast.error('Upload failed: ' + data.error);
      }
    } catch (err) {
      toast.error('Upload error');
    }
    setIsUploading(false);
  };

  const handleSectionUpdate = (key: string, value: any) => {
    if (!schema || (schema.type !== 'BUILT_IN' && schema.type !== 'CUSTOM_SCHEMA') || !selectedSectionId) return;
    
    const newSections = schema.sections.map(s => {
      if (s.id === selectedSectionId) {
        return { ...s, config: { ...s.config, [key]: value } };
      }
      return s;
    });
    pushHistory({ ...schema, sections: newSections });
  };

  const handleSectionAction = (action: 'move_up' | 'move_down' | 'duplicate' | 'delete' | 'toggle_hide') => {
    if (!schema || (schema.type !== 'BUILT_IN' && schema.type !== 'CUSTOM_SCHEMA') || !selectedSectionId) return;
    const idx = schema.sections.findIndex(s => s.id === selectedSectionId);
    if (idx === -1) return;
    
    const newSections = [...schema.sections];
    
    if (action === 'move_up' && idx > 0) {
      [newSections[idx - 1], newSections[idx]] = [newSections[idx], newSections[idx - 1]];
    } else if (action === 'move_down' && idx < newSections.length - 1) {
      [newSections[idx], newSections[idx + 1]] = [newSections[idx + 1], newSections[idx]];
    } else if (action === 'duplicate') {
      const dup = { ...newSections[idx], id: newSections[idx].id + '-copy-' + Date.now() };
      newSections.splice(idx + 1, 0, dup);
    } else if (action === 'delete') {
      newSections.splice(idx, 1);
      setSelectedSectionId(null);
    } else if (action === 'toggle_hide') {
      newSections[idx].isHidden = !newSections[idx].isHidden;
    }
    
    pushHistory({ ...schema, sections: newSections });
  };

  const handleAddSection = () => {
    if (!schema || (schema.type !== 'BUILT_IN' && schema.type !== 'CUSTOM_SCHEMA')) return;
    const newSection: SimplifiedSectionSchema = {
      id: 'new_section_' + Date.now(),
      type: 'HERO',
      isHidden: false,
      config: { headline: 'New Section' }
    };
    pushHistory({ ...schema, sections: [...schema.sections, newSection] });
    setSelectedSectionId(newSection.id);
  };

  if (loading) {
    return (
      <div className="w-full h-[calc(100vh-80px)] flex flex-col items-center justify-center gap-4 bg-[#020617] text-white">
        <PizzaLoader text="Loading Home Page Studio Engine..." size="medium" />
      </div>
    );
  }

  const selectedSectionData = (schema?.type === 'BUILT_IN' || schema?.type === 'CUSTOM_SCHEMA') 
    ? schema.sections.find(s => s.id === selectedSectionId) 
    : null;

  const viewWidth = viewMode === 'mobile' ? mobileWidthPreset : viewMode === 'tablet' ? 768 : '100%';

  return (
    <div className="w-full h-[calc(100vh-80px)] flex flex-col md:flex-row bg-[#020617] text-white relative">
      
      {/* ─── LEFT PANEL: PAGES & LAYERS ─────────────────────────────────────── */}
      <div className="w-full md:w-[300px] h-full flex flex-col shrink-0 bg-[#0f172a] border-r border-white/10 overflow-y-auto custom-scrollbar">
        
        {/* Header Actions */}
        <div className="p-4 border-b border-white/10 sticky top-0 bg-[#0f172a]/95 backdrop-blur z-20">
          <h1 className="text-xl font-black text-white flex items-center gap-2 mb-4">
            <Layout className="w-5 h-5 text-primary-500" />
            Studio
          </h1>
          <div className="flex flex-col gap-2">
            <button onClick={handleMakeTemplateLive} disabled={isPublishing} className="w-full py-2 bg-primary-500 hover:bg-primary-400 font-bold rounded-lg flex justify-center items-center gap-2 shadow-lg shadow-primary-500/20 transition-all">
              <CheckCircle className="w-4 h-4" /> {isPublishing ? 'PUBLISHING...' : 'MAKE LIVE'}
            </button>
            <div className="flex gap-2">
              <button onClick={handleSaveDraft} className="flex-1 py-1.5 bg-white/10 hover:bg-white/20 text-xs font-bold rounded-lg flex justify-center items-center gap-1 transition-all">
                <Save className="w-3 h-3" /> Save Draft
              </button>
              <button onClick={handleRollback} className="flex-1 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold rounded-lg flex justify-center items-center gap-1 transition-all">
                <History className="w-3 h-3" /> Revert
              </button>
            </div>
          </div>
        </div>

        {/* Template Collection */}
        <div className="p-4 border-b border-white/10">
          <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Templates</h3>
          <div className="flex flex-col gap-2">
            {collection.map(t => (
              <button 
                key={t.pageId}
                onClick={() => handleSwitchPage(t.pageId)}
                className={`text-left px-3 py-2 rounded-lg text-sm transition-colors ${activePageId === t.pageId ? 'bg-primary-500 text-white font-bold' : 'text-slate-300 hover:bg-white/5'}`}
              >
                {t.metadata?.name || t.pageId}
              </button>
            ))}
          </div>

          <div className="mt-4 border border-dashed border-white/20 rounded-lg p-3 text-center cursor-pointer hover:bg-white/5 relative transition-colors">
            <input type="file" accept=".zip" onChange={handleFileUpload} disabled={isUploading} className="absolute inset-0 opacity-0 cursor-pointer" />
            <Upload className="w-5 h-5 text-slate-400 mx-auto mb-1" />
            <span className="text-xs font-bold text-slate-300">Upload Custom Page</span>
          </div>
        </div>

        {/* Layers / Sections */}
        {(schema?.type === 'BUILT_IN' || schema?.type === 'CUSTOM_SCHEMA') && (
          <div className="p-4 flex-1">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1"><Layers className="w-3 h-3" /> Layers</h3>
              <button onClick={handleAddSection} className="text-primary-400 hover:text-primary-300 p-1 bg-primary-500/10 hover:bg-primary-500/20 rounded-full transition-colors"><Plus className="w-3 h-3" /></button>
            </div>
            
            <div className="flex flex-col gap-1">
              {schema.sections?.map((section) => (
                <div 
                  key={section.id} 
                  onClick={() => setSelectedSectionId(section.id)}
                  className={`flex items-center justify-between p-2 rounded-lg text-xs cursor-pointer ${selectedSectionId === section.id ? 'bg-white/10 font-bold border border-white/20' : 'hover:bg-white/5 border border-transparent'}`}
                >
                  <span className={section.isHidden ? 'opacity-50 line-through' : ''}>{section.type.replace('_', ' ')}</span>
                  {section.isHidden && <EyeOff className="w-3 h-3 opacity-50 text-red-400" />}
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* ─── CENTER PANEL: CANVAS PREVIEW ─────────────────────────────────────── */}
      <div className="flex-1 bg-[#020617] relative flex flex-col overflow-hidden">
        
        {/* Device Toggle Navbar */}
        <div className="h-14 border-b border-white/5 flex items-center justify-between px-6 bg-[#0f172a]/50">
          <div className="flex items-center gap-3">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <span>Viewport:</span>
              <span className="text-primary-400 capitalize">{viewMode} ({typeof viewWidth === 'number' ? `${viewWidth}px` : viewWidth})</span>
            </div>

            {/* Sub-presets for Mobile */}
            {viewMode === 'mobile' && (
              <div className="hidden sm:flex items-center gap-1 bg-black/40 px-2 py-1 rounded-lg border border-white/5">
                {[375, 390, 412, 430].map((w) => (
                  <button
                    key={w}
                    onClick={() => setMobileWidthPreset(w)}
                    className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold transition-all ${
                      mobileWidthPreset === w ? 'bg-primary-500 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {w}px
                  </button>
                ))}
              </div>
            )}

            {/* Sub-presets for Tablet */}
            {viewMode === 'tablet' && (
              <div className="hidden sm:flex items-center gap-1 bg-black/40 px-2 py-1 rounded-lg border border-white/5">
                {[768, 820].map((w) => (
                  <button
                    key={w}
                    onClick={() => setMobileWidthPreset(w)}
                    className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold transition-all ${
                      viewWidth === w ? 'bg-primary-500 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {w}px
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="bg-black/50 p-1 rounded-xl flex items-center border border-white/10 shadow-inner">
            <button 
              onClick={() => { setViewMode('mobile'); setMobileWidthPreset(390); }} 
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === 'mobile' ? 'bg-primary-500 text-white shadow' : 'text-slate-400 hover:text-white'}`}
              title="Mobile Viewport"
            >
              <Smartphone className="w-3.5 h-3.5" /> Mobile
            </button>
            <button 
              onClick={() => { setViewMode('tablet'); setMobileWidthPreset(768); }} 
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === 'tablet' ? 'bg-primary-500 text-white shadow' : 'text-slate-400 hover:text-white'}`}
              title="Tablet Viewport (768px)"
            >
              <Tablet className="w-3.5 h-3.5" /> Tablet
            </button>
            <button 
              onClick={() => setViewMode('desktop')} 
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === 'desktop' ? 'bg-primary-500 text-white shadow' : 'text-slate-400 hover:text-white'}`}
              title="Desktop Viewport (1440px / 100%)"
            >
              <Monitor className="w-3.5 h-3.5" /> Desktop
            </button>
          </div>

          <button
            onClick={() => setIsFullScreenPreview(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-primary-500 to-amber-500 hover:from-primary-600 hover:to-amber-600 text-white font-bold text-xs rounded-xl transition-all shadow-lg shadow-primary-500/25 cursor-pointer"
          >
            <Maximize2 className="w-4 h-4" /> Live Preview
          </button>
        </div>

        {/* Canvas Frame */}
        <div className="flex-1 flex justify-center items-start overflow-y-auto p-4 custom-scrollbar">
          <motion.div 
            layout
            initial={false}
            animate={{ width: viewWidth, minHeight: '800px' }}
            transition={{ type: "spring", bounce: 0, duration: 0.4 }}
            className="bg-[#06070a] shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden relative origin-top"
            style={{ 
              borderRadius: viewMode === 'desktop' ? 8 : 40, 
              border: viewMode === 'desktop' ? '1px solid rgba(255,255,255,0.1)' : '4px solid #1e293b' 
            }}
          >
            {schema && (
              <PageRenderer 
                schema={schema} 
                isEditorMode={true} 
                onElementSelect={setSelectedSectionId} 
                selectedSectionId={selectedSectionId}
                viewMode={viewMode}
              />
            )}
          </motion.div>
        </div>
      </div>

      {/* ─── RIGHT PANEL: PROPERTIES ─────────────────────────────────────── */}
      <div className="w-full md:w-[320px] h-full shrink-0 bg-[#0f172a] border-l border-white/10">
        {(schema?.type === 'BUILT_IN' || schema?.type === 'CUSTOM_SCHEMA') ? (
          <PropertyPanel 
            section={selectedSectionData || null}
            sectionIndex={schema.sections.findIndex(s => s.id === selectedSectionId)}
            totalSections={schema.sections.length}
            onUpdate={handleSectionUpdate}
            onAction={handleSectionAction}
          />
        ) : (
          <div className="p-6 text-center text-slate-400 mt-20">
            <Code className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-bold text-white mb-2">Custom Static Package</h3>
            <p className="text-sm">This package is rendered securely via iframe sandbox.</p>
            <p className="text-xs mt-4 bg-white/5 p-3 rounded-lg text-left">
              <strong>Dev Guide:</strong> To make text editable, ask your developer to add <code className="text-primary-400">data-op-editable="heading"</code> to elements. 
            </p>
          </div>
        )}
      </div>

      {/* ─── FULL SCREEN PREVIEW OVERLAY ─────────────────────────────────────── */}
      {isFullScreenPreview && (
        <div className="fixed inset-0 z-[9999] bg-[#020617] flex flex-col overflow-hidden text-white animate-in fade-in duration-200">
          {/* Top Navbar */}
          <div className="h-16 px-6 bg-[#0f172a] border-b border-white/10 flex items-center justify-between shadow-2xl z-50 shrink-0">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setIsFullScreenPreview(false)}
                className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white font-bold text-sm rounded-xl transition-all border border-white/10 shadow-md group"
              >
                <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform text-primary-400" />
                <span>Back to Studio</span>
              </button>
              <div className="h-6 w-px bg-white/10" />
              <div>
                <h2 className="text-sm font-black text-white flex items-center gap-2">
                  Full Screen Preview Mode
                </h2>
                <p className="text-[11px] text-slate-400">Viewing real layout across device viewports</p>
              </div>
            </div>

            {/* Viewport Switcher inside Full Screen */}
            <div className="bg-black/60 p-1.5 rounded-xl flex items-center border border-white/10 shadow-inner">
              <button
                onClick={() => setViewMode('mobile')}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  viewMode === 'mobile' ? 'bg-primary-500 text-white shadow-lg' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Smartphone className="w-4 h-4" /> Mobile View (375px)
              </button>
              <button
                onClick={() => setViewMode('tablet')}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  viewMode === 'tablet' ? 'bg-primary-500 text-white shadow-lg' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Tablet className="w-4 h-4" /> Tablet View (768px)
              </button>
              <button
                onClick={() => setViewMode('desktop')}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  viewMode === 'desktop' ? 'bg-primary-500 text-white shadow-lg' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Monitor className="w-4 h-4" /> Desktop (Full Width)
              </button>
            </div>

            <div className="flex items-center gap-3">
              <button 
                onClick={() => setIsFullScreenPreview(false)}
                className="p-2 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition-colors"
                title="Close Full Screen"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* Full Screen Content Body */}
          <div className="flex-1 overflow-y-auto custom-scrollbar flex justify-center items-start p-6 bg-[#020617]">
            {viewMode === 'mobile' ? (
              /* Authentic Mobile Device Frame */
              <div className="w-[390px] max-w-[95vw] my-4 rounded-[44px] border-[12px] border-[#1e293b] bg-[#06070a] shadow-[0_0_80px_rgba(0,0,0,0.9)] overflow-hidden relative">
                {/* Phone Camera Pill Notch */}
                <div className="w-32 h-4 bg-[#1e293b] rounded-b-xl mx-auto absolute top-0 left-1/2 -translate-x-1/2 z-40 flex items-center justify-center">
                  <div className="w-3 h-3 rounded-full bg-black/80 border border-slate-700" />
                </div>

                <div className="pt-6 pb-4 min-h-[780px]">
                  {schema && <PageRenderer schema={schema} isEditorMode={false} viewMode="mobile" />}
                </div>
              </div>
            ) : viewMode === 'tablet' ? (
              /* Authentic Tablet Device Frame */
              <div className="w-[790px] max-w-[95vw] my-4 rounded-[36px] border-[14px] border-[#1e293b] bg-[#06070a] shadow-[0_0_80px_rgba(0,0,0,0.9)] overflow-hidden relative">
                <div className="w-3 h-3 rounded-full bg-slate-700 mx-auto absolute top-2 left-1/2 -translate-x-1/2 z-40" />

                <div className="pt-6 pb-4 min-h-[850px]">
                  {schema && <PageRenderer schema={schema} isEditorMode={false} viewMode="tablet" />}
                </div>
              </div>
            ) : (
              /* Desktop Full Width Layout */
              <div className="w-full max-w-7xl mx-auto bg-[#06070a] min-h-screen rounded-2xl border border-white/10 p-6 shadow-2xl">
                {schema && <PageRenderer schema={schema} isEditorMode={false} viewMode="desktop" />}
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
