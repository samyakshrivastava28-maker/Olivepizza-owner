import React, { useState, useEffect } from 'react';
import { fetchApi } from '../lib/api';
import { SDUISection, SDUIConfig } from '../types/sdui';
import { TableSkeleton } from '../components/ui/Skeleton';
import { ErrorState } from '../components/ui/ErrorState';
import {
  Layers,
  Eye,
  Smartphone,
  Tablet,
  Monitor,
  UploadCloud,
  RotateCcw,
  MoveUp,
  MoveDown,
  Check,
  ToggleLeft,
  ToggleRight,
  ExternalLink,
} from 'lucide-react';
import toast from 'react-hot-toast';

const DEFAULT_SECTIONS: SDUISection[] = [
  { id: 'sec-hero', type: 'hero_banner', title: 'Top Hero Banner', order: 1, isActive: true },
  { id: 'sec-categories', type: 'categories', title: 'Craving Categories', order: 2, isActive: true },
  { id: 'sec-curated', type: 'curated_selections', title: 'Recommended for You', order: 3, isActive: true },
  { id: 'sec-promos', type: 'promotional_banner', title: 'Promotional Banners', order: 4, isActive: true },
  { id: 'sec-story', type: 'storytelling', title: 'Handcrafted Story & Ingredients', order: 5, isActive: true },
  { id: 'sec-testimonials', type: 'testimonials', title: 'Customer Reviews Carousel', order: 6, isActive: true },
  { id: 'sec-app', type: 'app_download', title: 'Mobile App Download CTA', order: 7, isActive: true },
  { id: 'sec-footer', type: 'footer', title: 'Flagship Store Footer', order: 8, isActive: true },
];

export default function HomePageManager() {
  const [sections, setSections] = useState<SDUISection[]>(DEFAULT_SECTIONS);
  const [version, setVersion] = useState<number>(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [previewDevice, setPreviewDevice] = useState<'mobile' | 'tablet' | 'desktop'>('mobile');
  const [publishing, setPublishing] = useState(false);

  const fetchConfig = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchApi('/api/home-page-manager/config');
      if (res.ok) {
        const data = await res.json();
        if (data.config?.sections?.length > 0) {
          setSections(data.config.sections);
          setVersion(data.config.version || 1);
        }
      }
    } catch (err: any) {
      console.warn('Using default SDUI config:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const handleToggleSection = (id: string) => {
    setSections((prev) =>
      prev.map((s) => (s.id === id ? { ...s, isActive: !s.isActive } : s))
    );
  };

  const handleMove = (index: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= sections.length) return;

    const newSections = [...sections];
    const temp = newSections[index];
    newSections[index] = newSections[targetIdx];
    newSections[targetIdx] = temp;

    // Re-index orders
    newSections.forEach((s, idx) => (s.order = idx + 1));
    setSections(newSections);
  };

  const handlePublish = async () => {
    setPublishing(true);
    try {
      const res = await fetchApi('/api/home-page-manager/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config: {
            version: version + 1,
            sections,
            updatedAt: new Date().toISOString(),
            updatedBy: 'Store Owner',
          },
        }),
      });

      if (!res.ok) throw new Error('Publish API returned failure status');

      setVersion((v) => v + 1);
      toast.success(`SDUI Layout v${version + 1} published live to customer website!`);
    } catch (err: any) {
      toast.error('Publish failed: ' + err.message);
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-black text-white">Home Page Manager (SDUI)</h2>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-orange-500/20 text-orange-400 border border-orange-500/30">
              v{version} LIVE
            </span>
          </div>
          <p className="text-xs text-slate-400">Server-Driven UI configuration: Arrange, toggle, and preview customer homepage sections.</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handlePublish}
            disabled={publishing}
            className="px-5 py-2.5 bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-orange-600/20 disabled:opacity-50"
          >
            <UploadCloud className="w-4 h-4" />
            {publishing ? 'Publishing Live...' : 'Publish to Live Site'}
          </button>
        </div>
      </div>

      {error && <ErrorState message={error} onRetry={fetchConfig} />}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Section Controls */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-[#131B2B] border border-slate-800 rounded-2xl p-4 sm:p-5">
            <h3 className="text-xs font-extrabold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
              <Layers className="w-4 h-4 text-orange-400" />
              Homepage Layout Sections
            </h3>

            {loading ? (
              <TableSkeleton rows={6} cols={2} />
            ) : (
              <div className="space-y-2.5">
                {sections.map((sec, idx) => (
                  <div
                    key={sec.id}
                    className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 transition-colors ${
                      sec.isActive
                        ? 'bg-[#0E1524] border-slate-800 hover:border-slate-700'
                        : 'bg-[#0B0F17]/60 border-slate-900 opacity-60'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono font-bold text-slate-500 w-5">
                        #{idx + 1}
                      </span>
                      <div>
                        <p className="text-xs font-bold text-slate-200">{sec.title}</p>
                        <p className="text-[10px] text-slate-500 font-mono">{sec.type}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleMove(idx, 'up')}
                        disabled={idx === 0}
                        className="p-1 text-slate-400 hover:text-white rounded disabled:opacity-30"
                        title="Move Up"
                      >
                        <MoveUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleMove(idx, 'down')}
                        disabled={idx === sections.length - 1}
                        className="p-1 text-slate-400 hover:text-white rounded disabled:opacity-30"
                        title="Move Down"
                      >
                        <MoveDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleToggleSection(sec.id)}
                        className={`px-2.5 py-1 rounded text-[10px] font-bold ${
                          sec.isActive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {sec.isActive ? 'Visible' : 'Hidden'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Interactive Device Viewport Preview */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-[#131B2B] border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col h-full">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <span className="text-xs font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
                <Eye className="w-4 h-4 text-blue-400" />
                Live SDUI Mockup
              </span>

              {/* Device Selector */}
              <div className="flex items-center gap-1 bg-[#0E1524] p-1 rounded-xl border border-slate-800">
                <button
                  onClick={() => setPreviewDevice('mobile')}
                  className={`p-1.5 rounded-lg text-xs font-bold transition-colors ${
                    previewDevice === 'mobile' ? 'bg-orange-500 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                  title="Mobile View (375px)"
                >
                  <Smartphone className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setPreviewDevice('tablet')}
                  className={`p-1.5 rounded-lg text-xs font-bold transition-colors ${
                    previewDevice === 'tablet' ? 'bg-orange-500 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                  title="Tablet View (768px)"
                >
                  <Tablet className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setPreviewDevice('desktop')}
                  className={`p-1.5 rounded-lg text-xs font-bold transition-colors ${
                    previewDevice === 'desktop' ? 'bg-orange-500 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                  title="Desktop View (Full)"
                >
                  <Monitor className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Device Container Frame */}
            <div className="flex-1 flex items-center justify-center p-2 bg-[#080C14] rounded-xl border border-slate-900 overflow-y-auto min-h-[450px]">
              <div
                className={`transition-all duration-300 bg-[#0B0F17] border border-slate-800 rounded-2xl p-4 shadow-2xl space-y-3 ${
                  previewDevice === 'mobile'
                    ? 'w-[320px]'
                    : previewDevice === 'tablet'
                    ? 'w-[520px]'
                    : 'w-full'
                }`}
              >
                <div className="flex justify-between items-center pb-2 border-b border-slate-800/80">
                  <span className="text-xs font-extrabold text-orange-400">🍕 Olive Pizza</span>
                  <span className="text-[10px] text-slate-500 font-mono">Live Customer Preview</span>
                </div>

                {sections
                  .filter((s) => s.isActive)
                  .map((s, i) => (
                    <div
                      key={s.id}
                      className="p-3 bg-[#131B2B]/90 border border-slate-800 rounded-xl text-center space-y-1"
                    >
                      <span className="text-[9px] font-mono text-orange-400 uppercase tracking-widest">
                        Section #{i + 1}
                      </span>
                      <p className="text-xs font-bold text-white">{s.title}</p>
                      <div className="h-6 bg-slate-800/60 rounded flex items-center justify-center text-[10px] text-slate-400 italic">
                        {s.type.replace('_', ' ')} component
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
