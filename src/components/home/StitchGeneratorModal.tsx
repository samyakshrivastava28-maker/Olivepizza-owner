import React, { useState } from 'react';
import {
  X,
  Sparkles,
  Flame,
  Smartphone,
  Monitor,
  Tablet,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Edit3,
  Rocket,
  Layers,
  ArrowRight,
  ShieldCheck,
  ChevronRight,
  Eye,
  Sliders,
} from 'lucide-react';
import { PageSchema } from '../../types/PageSchema';
import { fetchApi } from '../../lib/api';
import toast from 'react-hot-toast';

interface StitchGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyToEditor: (schema: PageSchema) => void;
  onPublishDirectly?: (schema: PageSchema) => Promise<void>;
}

interface StitchPreviewResult {
  previewId: string;
  screenId: string;
  screenTitle: string;
  layoutName: string;
  sduiSchema: PageSchema;
  rawHtml?: string;
  screenshotResource?: string;
  enhancedPrompt?: string;
}

const PRESET_PROMPTS = [
  {
    label: '🌌 Midnight Galaxy Showcase',
    prompt: 'Midnight Galaxy woodfired pizza showcase with glowing ember flames, pure veg artisan malai paneer, and dark obsidian glass aesthetics.',
  },
  {
    label: '🪔 Diwali Grand Festival',
    prompt: 'Diwali Grand Festival celebration with warm golden diya glows, royal saffron accents, festive paneer tikka specials, and 50% discount urgency ribbon.',
  },
  {
    label: '🎨 Holi Color Splash Fiesta',
    prompt: 'Vibrant Holi festival special with natural herbal gulal color splashes, farm-fresh spicy garden pizzas, and chilled thandai pairing combos.',
  },
  {
    label: '🧀 72h Artisanal Cheese Pull',
    prompt: 'Ultra-luxury woodfired sourdough showcase highlighting 72h cold fermented crusts, dramatic Fior di Latte mozzarella cheese pulls, and volcanic stone oven heritage.',
  },
  {
    label: '👑 Royal Truffle Sommelier',
    prompt: 'Michelin-level sommelier tasting menu featuring Italian black summer truffles, edible 24k gold stardust flakes, and artisanal sparkling beverage pairings.',
  },
];

export default function StitchGeneratorModal({
  isOpen,
  onClose,
  onApplyToEditor,
  onPublishDirectly,
}: StitchGeneratorModalProps) {
  const [prompt, setPrompt] = useState(
    'Midnight Galaxy woodfired pizza showcase with glowing ember flames, pure veg artisan malai paneer, and dark obsidian glass aesthetics.'
  );
  const [deviceType, setDeviceType] = useState<'mobile' | 'desktop' | 'tablet'>('mobile');
  const [usePromptEnhancer, setUsePromptEnhancer] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [previewResult, setPreviewResult] = useState<StitchPreviewResult | null>(null);
  const [previewTab, setPreviewTab] = useState<'sections' | 'html'>('sections');
  const [publishing, setPublishing] = useState(false);

  if (!isOpen) return null;

  const handleGenerate = async (screenResourceToReuse?: string) => {
    if (!prompt.trim() && !screenResourceToReuse) {
      toast.error('Please enter a prompt describing your desired visual design.');
      return;
    }

    setLoading(true);
    setError(null);
    setPreviewResult(null);

    try {
      setLoadingStep('Enhancing prompt with DeepSeek V4 Flash & dispatching to Google Stitch...');
      const toastId = toast.loading('Connecting to Google Stitch Visual Design Engine...');

      const response = await fetchApi('/api/homepage/generate-stitch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          deviceType: deviceType.toUpperCase(),
          existingScreenResource: screenResourceToReuse,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        toast.dismiss(toastId);
        const errMsg = data.error || 'Google Stitch failed to generate screen.';
        setError(errMsg);
        toast.error('Google Stitch error: ' + errMsg);
        return;
      }

      toast.success(`Generated: ${data.screenTitle || 'Stitch Layout'}`, { id: toastId });
      setPreviewResult(data);
    } catch (err: any) {
      console.error('[StitchModal] Generation failed:', err);
      setError(err.message || 'Network error connecting to Stitch design service.');
      toast.error(`Stitch generation failed: ${err.message}`);
    } finally {
      setLoading(false);
      setLoadingStep('');
    }
  };

  const handlePublish = async () => {
    if (!previewResult?.sduiSchema) return;
    setPublishing(true);
    try {
      if (onPublishDirectly) {
        await onPublishDirectly(previewResult.sduiSchema);
      } else {
        const res = await fetchApi('/api/homepage/publish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ schema: previewResult.sduiSchema }),
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'Failed to publish');
        toast.success('Successfully published Stitch layout to live website!');
      }
      onClose();
    } catch (err: any) {
      toast.error(`Publish failed: ${err.message}`);
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-[#0B0F17] border border-slate-800 rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-slate-100 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-800 flex items-center justify-between bg-gradient-to-r from-orange-950/40 via-slate-900 to-slate-900">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-orange-500 to-amber-500 flex items-center justify-center text-white shadow-lg shadow-orange-500/30">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-white">Google Stitch Visual Design Engine</h2>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-extrabold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                  Stitch MCP Active
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Generate high-end, responsive SDUI layouts directly from Google Stitch with 1-click preview & publishing.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {!previewResult ? (
            /* Input & Prompt Step */
            <div className="space-y-6">
              {/* Presets */}
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-2">Curated Campaign Themes</label>
                <div className="flex flex-wrap gap-2">
                  {PRESET_PROMPTS.map((p, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setPrompt(p.prompt)}
                      className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-orange-500 text-slate-300 hover:text-white text-xs font-semibold transition-all cursor-pointer"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Text Prompt */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-300">Design Atmosphere & Instructions</label>
                  <span className="text-[11px] text-slate-500">Google Stitch Design Engine</span>
                </div>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={4}
                  placeholder="Describe colors, atmosphere, specials, festival urgency, hero style, or menu categories..."
                  className="w-full bg-[#070A10] border border-slate-800 focus:border-orange-500 rounded-2xl p-4 text-xs sm:text-sm text-slate-200 focus:outline-none transition-all resize-none shadow-inner"
                />
              </div>

              {/* Device Selector (Mobile First Policy) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setDeviceType('mobile')}
                  className={`p-3 rounded-2xl border flex items-center gap-3 transition-all cursor-pointer ${
                    deviceType === 'mobile'
                      ? 'bg-orange-500/15 border-orange-500 text-white shadow-lg shadow-orange-500/10'
                      : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <Smartphone className="w-5 h-5 text-orange-400 shrink-0" />
                  <div className="text-left">
                    <div className="text-xs font-bold">Mobile First (Native App)</div>
                    <div className="text-[10px] text-slate-400">PWA & Capacitor Android/iOS</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setDeviceType('desktop')}
                  className={`p-3 rounded-2xl border flex items-center gap-3 transition-all cursor-pointer ${
                    deviceType === 'desktop'
                      ? 'bg-orange-500/15 border-orange-500 text-white shadow-lg shadow-orange-500/10'
                      : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <Monitor className="w-5 h-5 text-amber-400 shrink-0" />
                  <div className="text-left">
                    <div className="text-xs font-bold">Desktop Web</div>
                    <div className="text-[10px] text-slate-400">Cinematic wide resolution</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setDeviceType('tablet')}
                  className={`p-3 rounded-2xl border flex items-center gap-3 transition-all cursor-pointer ${
                    deviceType === 'tablet'
                      ? 'bg-orange-500/15 border-orange-500 text-white shadow-lg shadow-orange-500/10'
                      : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <Tablet className="w-5 h-5 text-emerald-400 shrink-0" />
                  <div className="text-left">
                    <div className="text-xs font-bold">Tablet / POS Display</div>
                    <div className="text-[10px] text-slate-400">Medium touch viewport</div>
                  </div>
                </button>
              </div>

              {/* Options */}
              <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-orange-400">
                    <Flame className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-200">DeepSeek V4 Flash Prompt Enhancer</div>
                    <div className="text-[11px] text-slate-400">
                      Enriches prompts with pure veg artisan pizza vocabulary, 72h fermentation specs, and brand tokens.
                    </div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={usePromptEnhancer}
                  onChange={(e) => setUsePromptEnhancer(e.target.checked)}
                  className="w-4 h-4 rounded text-orange-500 focus:ring-orange-500 bg-slate-800 border-slate-700"
                />
              </div>

              {/* Pre-cached Verified Screen Option */}
              <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-800/60 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-slate-300">Fast Verified Flagship Screen Available</div>
                  <div className="text-[11px] text-slate-500">
                    Load pre-verified screen <code className="text-orange-400 font-mono">0ccfac272f28432e99ec9627224b32ef</code> (Midnight Galaxy Showcase) instantly.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleGenerate('projects/7981844069186888768/screens/0ccfac272f28432e99ec9627224b32ef')}
                  disabled={loading}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-orange-400 border border-slate-700 transition-all cursor-pointer disabled:opacity-50"
                >
                  Load Fast
                </button>
              </div>

              {/* Error Alert (Rule 7: Real diagnostics) */}
              {error && (
                <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 shrink-0 text-red-400 mt-0.5" />
                  <div>
                    <div className="font-bold mb-1">Google Stitch Diagnostic Error:</div>
                    <div className="font-mono text-[11px] text-red-300 bg-red-950/30 p-2 rounded-lg border border-red-900/30 break-all">
                      {error}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Generated Preview & Conversion Review Step */
            <div className="space-y-6">
              {/* Top Banner Info */}
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
                  <div>
                    <div className="text-xs font-extrabold text-white flex items-center gap-2">
                      {previewResult.screenTitle}
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-mono">
                        Screen ID: {previewResult.screenId.substring(0, 12)}...
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Converted {(previewResult.sduiSchema as any).sections?.length || 0} canonical SDUI sections from Google Stitch HTML.
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 bg-[#070A10] p-1 rounded-xl border border-slate-800">
                  <button
                    onClick={() => setPreviewTab('sections')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      previewTab === 'sections' ? 'bg-orange-500 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    SDUI Sections
                  </button>
                  <button
                    onClick={() => setPreviewTab('html')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      previewTab === 'html' ? 'bg-orange-500 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Raw HTML
                  </button>
                </div>
              </div>

              {previewTab === 'sections' ? (
                /* Sections List */
                <div className="space-y-3">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Extracted SDUI Sections ({(previewResult.sduiSchema as any).sections?.length || 0})
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {((previewResult.sduiSchema as any).sections as any[])?.map((sec, idx) => (
                      <div
                        key={sec.id || idx}
                        className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 hover:border-slate-700 flex flex-col justify-between gap-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="px-2 py-0.5 rounded-full bg-orange-500/10 border border-orange-500/30 text-orange-400 text-[10px] font-bold">
                            {sec.type}
                          </span>
                          <span className="text-[10px] text-slate-500">Order #{idx + 1}</span>
                        </div>
                        <div>
                          <h4 className="text-xs font-extrabold text-white line-clamp-1">
                            {sec.config?.headline || 'Section Headline'}
                          </h4>
                          <p className="text-[11px] text-slate-400 line-clamp-2 mt-0.5">
                            {sec.config?.subtitle || sec.config?.description || 'Custom configured section'}
                          </p>
                        </div>
                        {sec.config?.items && sec.config.items.length > 0 && (
                          <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[10px] text-slate-400">
                            <span>{sec.config.items.length} Menu Items Included</span>
                            <span className="text-amber-400 font-bold">₹{sec.config.items[0]?.price}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                /* Raw HTML View */
                <div className="bg-[#070A10] rounded-2xl border border-slate-800 p-4 max-h-96 overflow-y-auto">
                  <pre className="text-[11px] font-mono text-slate-300 whitespace-pre-wrap">
                    {previewResult.rawHtml?.substring(0, 3000)}...
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="p-5 sm:p-6 border-t border-slate-800 bg-[#070A10] flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-500 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Strict Rule: Live website is never overwritten without explicit Owner Approval.</span>
          </div>

          <div className="flex items-center gap-2">
            {!previewResult ? (
              <button
                type="button"
                onClick={() => handleGenerate()}
                disabled={loading}
                className="px-6 py-2.5 bg-gradient-to-r from-orange-500 via-amber-500 to-emerald-500 hover:from-orange-400 hover:to-emerald-400 text-white font-extrabold rounded-xl text-xs flex items-center gap-2 transition-all shadow-lg shadow-orange-500/25 cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>{loadingStep || 'Generating Screen...'}</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Generate with Stitch</span>
                  </>
                )}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setPreviewResult(null)}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs transition-all cursor-pointer"
                >
                  Regenerate
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onApplyToEditor(previewResult.sduiSchema);
                    onClose();
                  }}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-orange-400 border border-orange-500/30 font-bold rounded-xl text-xs flex items-center gap-2 transition-all cursor-pointer"
                >
                  <Edit3 className="w-4 h-4" />
                  <span>Customize in Visual Editor</span>
                </button>

                <button
                  type="button"
                  onClick={handlePublish}
                  disabled={publishing}
                  className="px-6 py-2.5 bg-orange-600 hover:bg-orange-500 text-white font-extrabold rounded-xl text-xs flex items-center gap-2 transition-all shadow-lg shadow-orange-600/25 cursor-pointer disabled:opacity-50"
                >
                  {publishing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Publishing...</span>
                    </>
                  ) : (
                    <>
                      <Rocket className="w-4 h-4" />
                      <span>Approve & Publish Live</span>
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
