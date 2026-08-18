import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  Wand2,
  CheckCircle2,
  Edit3,
  X,
  Eye,
  Image as ImageIcon,
  Loader2,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  AlertTriangle,
  History,
  Sliders,
  Upload,
  ExternalLink,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getCurrentAuthToken } from '../../lib/firebase';
import { uploadMediaToCloudinary } from '../../lib/cloudinary';

export interface InlineAIImageGeneratorProps {
  initialPrompt?: string;
  targetType?: 'product' | 'email' | 'ad';
  defaultAspectRatio?: '1:1' | '4:3' | '3:4' | '16:9';
  onSelectImage: (imageUrl: string, publicId?: string) => void;
}

export interface VersionRecord {
  version: number;
  url: string;
  prompt: string;
  modelId: string;
  createdAt: string;
}

export interface ImageRecord {
  tempId: string;
  generationId: string;
  url: string;
  prompt: string;
  enhancedPrompt: string;
  modelId: string;
  aspectRatio: string;
  status: 'PREVIEW' | 'APPROVED' | 'DISCARDED';
  versions: VersionRecord[];
}

export interface AIModelOption {
  id: string;
  name: string;
  description: string;
  badge: string;
  badgeColor: string;
}

const SUPPORTED_MODELS: AIModelOption[] = [
  {
    id: 'all',
    name: 'All 4 Models (Compare All)',
    description: 'Generates 1 preview from each of the 4 models',
    badge: '🌟 Multi-Model',
    badgeColor: 'bg-gradient-to-r from-amber-500/30 to-purple-500/30 text-amber-300 border-amber-500/40 font-black',
  },
  {
    id: 'flux.2-klein-4b',
    name: 'FLUX.2 Klein 4B',
    description: 'Fast generation',
    badge: '⚡ Fast',
    badgeColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 font-bold',
  },
  {
    id: 'qwen-image',
    name: 'Qwen Image',
    description: 'High-quality product generation',
    badge: '✨ Best Quality',
    badgeColor: 'bg-amber-500/20 text-amber-400 border-amber-500/30 font-bold',
  },
  {
    id: 'qwen-image-edit',
    name: 'Qwen Image Edit',
    description: 'Best for modifying an existing image',
    badge: '✏ Edit Existing',
    badgeColor: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30 font-bold',
  },
  {
    id: 'stable-diffusion-3.5-large',
    name: 'Stable Diffusion 3.5 Large',
    description: 'Detailed image generation',
    badge: '🎨 Detailed SD',
    badgeColor: 'bg-purple-500/20 text-purple-400 border-purple-500/30 font-bold',
  },
];

const MODEL_NAME_MAP: Record<string, { label: string; color: string }> = {
  'flux.2-klein-4b': { label: '⚡ FLUX.2 Klein 4B', color: 'bg-emerald-500/90 text-white' },
  'qwen-image': { label: '✨ Qwen Image', color: 'bg-amber-500/90 text-black' },
  'qwen-image-edit': { label: '✏ Qwen Image Edit', color: 'bg-indigo-600/90 text-white' },
  'stable-diffusion-3.5-large': { label: '🎨 Stable Diffusion 3.5 Large', color: 'bg-purple-600/90 text-white' },
};

export default function InlineAIImageGenerator({
  initialPrompt = '',
  targetType = 'product',
  defaultAspectRatio = '1:1',
  onSelectImage,
}: InlineAIImageGeneratorProps) {
  const [prompt, setPrompt] = useState(initialPrompt);
  const [enhancedPrompt, setEnhancedPrompt] = useState('');
  const [isEnhancing, setIsEnhancing] = useState(false);

  // Model & Ratio Selection (Default to 'all' for 4 model preview)
  const [selectedModel, setSelectedModel] = useState<string>('all');
  const [aspectRatio, setAspectRatio] = useState<'1:1' | '4:3' | '3:4' | '16:9'>(defaultAspectRatio);

  // Advanced Controls
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [imageCount, setImageCount] = useState<number>(4);

  // Previews & History
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<ImageRecord[]>([]);
  const [activeVersionMap, setActiveVersionMap] = useState<Record<string, number>>({});
  const [previewLightboxUrl, setPreviewLightboxUrl] = useState<string | null>(null);

  // Edit State
  const [editingTempId, setEditingTempId] = useState<string | null>(null);
  const [customInputImageUrl, setCustomInputImageUrl] = useState<string>('');
  const [editPrompt, setEditPrompt] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  // Approval Loading
  const [approvingTempId, setApprovingTempId] = useState<string | null>(null);

  // Gemini Studio Section State
  const [showGeminiSection, setShowGeminiSection] = useState(false);
  const [geminiPastedUrl, setGeminiPastedUrl] = useState('');
  const [isSavingGeminiImage, setIsSavingGeminiImage] = useState(false);
  const geminiFileInputRef = useRef<HTMLInputElement>(null);

  // Error Handling
  const [generationError, setGenerationError] = useState<{
    failedModel: string;
    reason: string;
  } | null>(null);

  // Accordion Open/Close
  const [isOpen, setIsOpen] = useState(true);

  useEffect(() => {
    if (initialPrompt && !prompt) {
      setPrompt(initialPrompt);
    }
  }, [initialPrompt]);

  // DeepSeek V4 Flash Prompt Enhancer
  const handleEnhancePrompt = async () => {
    if (!prompt.trim()) {
      toast.error('Please enter a dish description first');
      return;
    }
    setIsEnhancing(true);
    setGenerationError(null);
    try {
      const token = await getCurrentAuthToken().catch(() => '');
      const res = await fetch('/api/ai/image/enhance-prompt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ prompt, targetType, modelId: selectedModel === 'all' ? 'qwen-image' : selectedModel }),
      });
      const data = await res.json();
      if (data.success && data.enhancedPrompt) {
        setEnhancedPrompt(data.enhancedPrompt);
        toast.success('Prompt enhanced with DeepSeek V4 Flash!');
      } else {
        throw new Error(data.error || 'Enhancement failed');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to enhance prompt');
    }
    setIsEnhancing(false);
  };

  // Generate Previews (All 4 models or selected model)
  const handleGenerate = async () => {
    if (!prompt.trim() && !enhancedPrompt.trim()) {
      toast.error('Please enter a prompt first');
      return;
    }
    setIsGenerating(true);
    setGenerationError(null);
    try {
      const token = await getCurrentAuthToken().catch(() => '');
      const res = await fetch('/api/ai/image/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          prompt,
          enhancedPrompt: enhancedPrompt || prompt,
          modelId: selectedModel,
          aspectRatio,
          count: selectedModel === 'all' ? 4 : imageCount,
        }),
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.images) && data.images.length > 0) {
        setGeneratedImages(data.images);

        const vMap: Record<string, number> = {};
        data.images.forEach((img: ImageRecord) => {
          vMap[img.tempId] = img.versions ? img.versions.length - 1 : 0;
        });
        setActiveVersionMap(vMap);

        if (selectedModel === 'all') {
          toast.success('Generated previews from all 4 AI models simultaneously!');
        } else {
          const activeModelSpec = SUPPORTED_MODELS.find((m) => m.id === selectedModel);
          toast.success(`Generated ${data.images.length} previews with ${activeModelSpec?.name || selectedModel}!`);
        }
      } else {
        const activeModelSpec = SUPPORTED_MODELS.find((m) => m.id === selectedModel);
        const errorMsg = data.error || `Generation failed on ${activeModelSpec?.name || selectedModel}.`;
        setGenerationError({
          failedModel: activeModelSpec?.name || selectedModel,
          reason: errorMsg,
        });
        toast.error(`Generation failed on ${activeModelSpec?.name || selectedModel}`);
      }
    } catch (err: any) {
      const activeModelSpec = SUPPORTED_MODELS.find((m) => m.id === selectedModel);
      setGenerationError({
        failedModel: activeModelSpec?.name || selectedModel,
        reason: err.message || 'Network failure connecting to backend provider',
      });
      toast.error('Failed to connect to image provider');
    }
    setIsGenerating(false);
  };

  // Qwen Image Edit Refinement
  const handleApplyEdit = async (baseRecord?: ImageRecord) => {
    if (!editPrompt.trim()) {
      toast.error('Please describe what to change');
      return;
    }
    const sourceUrl = customInputImageUrl || baseRecord?.url;
    if (!sourceUrl) {
      toast.error('Please select or provide an image to edit');
      return;
    }

    setIsEditing(true);
    setGenerationError(null);
    try {
      const token = await getCurrentAuthToken().catch(() => '');
      const res = await fetch('/api/ai/image/edit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          tempId: baseRecord?.tempId,
          baseImageUrl: sourceUrl,
          editPrompt,
          modelId: 'qwen-image-edit',
          aspectRatio,
        }),
      });
      const data = await res.json();
      if (data.success && data.image) {
        if (baseRecord) {
          setGeneratedImages((prev) =>
            prev.map((img) => (img.tempId === baseRecord.tempId ? data.image : img))
          );
          setActiveVersionMap((prev) => ({
            ...prev,
            [baseRecord.tempId]: (data.image.versions?.length || 1) - 1,
          }));
        } else {
          setGeneratedImages((prev) => [data.image, ...prev]);
          setActiveVersionMap((prev) => ({
            ...prev,
            [data.image.tempId]: 0,
          }));
        }
        setEditingTempId(null);
        setEditPrompt('');
        setCustomInputImageUrl('');
        toast.success('Refined with Qwen Image Edit!');
      } else {
        setGenerationError({
          failedModel: 'Qwen Image Edit',
          reason: data.error || 'Qwen Image Edit failed',
        });
        toast.error('Refinement failed');
      }
    } catch (err: any) {
      setGenerationError({
        failedModel: 'Qwen Image Edit',
        reason: err.message || 'Network failure',
      });
      toast.error('Refinement failed');
    }
    setIsEditing(false);
  };

  // Explicit Owner Approval & Cloudinary Upload
  const handleApprove = async (record: ImageRecord) => {
    setApprovingTempId(record.tempId);
    try {
      const activeVerIndex = activeVersionMap[record.tempId] ?? (record.versions?.length ? record.versions.length - 1 : 0);
      const activeVer = record.versions && record.versions[activeVerIndex] ? record.versions[activeVerIndex] : null;
      const targetUrl = activeVer ? activeVer.url : record.url;

      const token = await getCurrentAuthToken().catch(() => '');
      const res = await fetch('/api/ai/image/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          tempId: record.tempId,
          imageUrl: targetUrl,
          folder: targetType === 'email' ? 'olive-pizza/email-banners' : 'olive-pizza/ai-product-images',
        }),
      });
      const data = await res.json();
      if (data.success && data.cloudinaryUrl) {
        toast.success('Approved & Saved to Cloudinary!');
        onSelectImage(data.cloudinaryUrl, data.publicId);
      } else {
        toast.error(data.error || 'Cloudinary upload failed.');
      }
    } catch (err: any) {
      toast.error('Approval upload failed: ' + err.message);
    }
    setApprovingTempId(null);
  };

  // Create Preview Record from Pasted Data / File
  const createPreviewFromDataUrl = (dataUrl: string, sourceLabel = 'Pasted / Gemini Image') => {
    const tempId = 'preview-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
    const newRecord: ImageRecord = {
      tempId,
      generationId: 'gen-' + tempId,
      url: dataUrl,
      prompt: sourceLabel,
      enhancedPrompt: '',
      modelId: 'qwen-image',
      aspectRatio: aspectRatio,
      status: 'PREVIEW',
      versions: [
        {
          version: 1,
          url: dataUrl,
          prompt: sourceLabel,
          modelId: 'qwen-image',
          createdAt: new Date().toISOString(),
        },
      ],
    };

    setGeneratedImages((prev) => [newRecord, ...prev]);
    setActiveVersionMap((prev) => ({ ...prev, [tempId]: 0 }));
    setIsOpen(true);
    toast.success('✨ Preview created! Click [Approve & Save to Cloudinary] to approve.');
  };

  // Process Pasted URL or Gemini URL
  const handleSaveGeminiPastedUrl = async () => {
    if (!geminiPastedUrl.trim()) {
      toast.error('Please paste an image URL first');
      return;
    }
    createPreviewFromDataUrl(geminiPastedUrl.trim(), 'Pasted URL');
    setGeminiPastedUrl('');
  };

  // Process Pasted Image File / File Selection
  const handleGeminiFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        createPreviewFromDataUrl(event.target.result as string, `Pasted File: ${file.name}`);
      }
    };
    reader.readAsDataURL(file);
    if (geminiFileInputRef.current) geminiFileInputRef.current.value = '';
  };

  const handleDiscard = (tempId: string) => {
    setGeneratedImages((prev) => prev.filter((img) => img.tempId !== tempId));
    toast.success('Preview discarded');
  };

  return (
    <div className="w-full bg-[#0B0F14] border border-primary-500/30 p-3.5 sm:p-5 rounded-2xl flex flex-col gap-4 shadow-2xl relative overflow-hidden">
      {/* Title / Mobile Header Toggle */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between flex-wrap gap-2 text-left outline-none group cursor-pointer"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-primary-500 to-amber-500 flex items-center justify-center shadow-md">
            <Sparkles className="w-4 h-4 text-white animate-pulse" />
          </div>
          <div>
            <h4 className="font-black text-sm sm:text-base text-white group-hover:text-primary-300 transition-colors">
              AI Food Photography Studio
            </h4>
            <p className="text-[11px] text-slate-400">
              Generate previews from all 4 models • DeepSeek Enhancer • Cloudinary Approval
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-primary-300 bg-primary-500/10 px-2.5 py-1 rounded-full border border-primary-500/20">
            {SUPPORTED_MODELS.find((m) => m.id === selectedModel)?.name}
          </span>
          <div className="p-1.5 rounded-lg bg-white/5 group-hover:bg-white/15 text-slate-300 transition-all">
            {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex flex-col gap-4 overflow-hidden border-t border-white/10 pt-4"
          >
            {/* 1. PROMPT INPUT & DEEPSEEK ENHANCER */}
            <div className="space-y-2.5">
              <label className="text-xs font-extrabold text-slate-300 uppercase tracking-wider block">
                Food Dish / Banner Description:
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="e.g. Indian Tandoori Paneer Pizza with smoky tandoori paneer, onions, capsicum and melted mozzarella"
                  className="flex-1 bg-black/60 border border-white/15 rounded-xl px-4 py-3 text-white text-xs sm:text-sm outline-none focus:border-primary-500 transition-colors placeholder:text-slate-500"
                />
                <button
                  type="button"
                  onClick={handleEnhancePrompt}
                  disabled={isEnhancing}
                  className="px-4 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 shrink-0 border border-indigo-400/40 transition-all"
                >
                  {isEnhancing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Wand2 className="w-4 h-4 text-indigo-200" />
                  )}
                  <span>Enhance with DeepSeek</span>
                </button>
              </div>

              {/* Enhanced Prompt Display */}
              {enhancedPrompt && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3.5 rounded-xl bg-primary-500/10 border border-primary-500/30 space-y-1.5"
                >
                  <div className="flex items-center justify-between text-xs font-bold text-primary-300">
                    <span className="flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-primary-400" /> DeepSeek V4 Flash Enhanced Prompt:
                    </span>
                    <button
                      type="button"
                      onClick={() => setEnhancedPrompt('')}
                      className="text-slate-400 hover:text-white text-[11px]"
                    >
                      Clear
                    </button>
                  </div>
                  <textarea
                    value={enhancedPrompt}
                    onChange={(e) => setEnhancedPrompt(e.target.value)}
                    rows={2}
                    className="w-full bg-black/50 border border-primary-500/20 rounded-lg p-2.5 text-white text-xs outline-none resize-none focus:border-primary-400 leading-relaxed"
                  />
                </motion.div>
              )}
            </div>

            {/* 2. MODEL SELECTOR CARDS */}
            <div className="space-y-2">
              <label className="text-xs font-extrabold text-slate-300 uppercase tracking-wider block">
                AI IMAGE MODEL SELECTOR
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
                {SUPPORTED_MODELS.map((model) => (
                  <button
                    key={model.id}
                    type="button"
                    onClick={() => setSelectedModel(model.id)}
                    className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all relative overflow-hidden group cursor-pointer ${
                      selectedModel === model.id
                        ? 'bg-primary-500/15 border-primary-500 ring-1 ring-primary-500/50 shadow-lg'
                        : 'bg-black/40 border-white/10 hover:border-white/25 hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="font-extrabold text-[11px] text-white group-hover:text-primary-300 transition-colors">
                        {model.name}
                      </span>
                    </div>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded border inline-block w-fit mb-1 ${model.badgeColor}`}>
                      {model.badge}
                    </span>
                    <p className="text-[10px] text-slate-400 font-medium leading-tight">
                      {model.description}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* 3. ADVANCED SETTINGS TOGGLE */}
            <div className="bg-white/5 rounded-xl border border-white/10 p-3 space-y-3">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="flex items-center gap-1.5 text-xs font-bold text-slate-300 hover:text-white"
                >
                  <Sliders className="w-3.5 h-3.5 text-primary-400" />
                  <span>Advanced Controls</span>
                  <span className="text-[10px] font-normal text-slate-400">
                    ({aspectRatio})
                  </span>
                </button>

                <div className="flex items-center gap-1">
                  {(['1:1', '4:3', '3:4', '16:9'] as const).map((ratio) => (
                    <button
                      key={ratio}
                      type="button"
                      onClick={() => setAspectRatio(ratio)}
                      className={`px-2 py-0.5 rounded border text-[10px] font-extrabold transition-all ${
                        aspectRatio === ratio
                          ? 'bg-primary-500/20 border-primary-500 text-primary-300'
                          : 'bg-black/40 border-white/10 text-slate-400 hover:text-white'
                      }`}
                    >
                      {ratio}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 4. ERROR BANNER */}
            {generationError && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 space-y-2"
              >
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h5 className="text-xs font-bold text-red-400">
                      Generation Failed on {generationError.failedModel}
                    </h5>
                    <p className="text-[11px] text-red-300/80 mt-0.5 break-all">
                      Reason: {generationError.reason}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleGenerate}
                    className="px-3 py-1.5 bg-red-500 hover:bg-red-400 text-white font-bold rounded-lg text-xs flex items-center gap-1 shadow"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Retry
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setGenerationError(null);
                      setSelectedModel('all');
                    }}
                    className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-slate-200 font-bold rounded-lg text-xs"
                  >
                    Choose Another Model / Compare All
                  </button>
                </div>
              </motion.div>
            )}

            {/* 5. GENERATE BUTTON */}
            <button
              type="button"
              onClick={handleGenerate}
              disabled={isGenerating}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-primary-500 via-orange-500 to-amber-500 hover:from-primary-600 hover:to-amber-600 text-white font-black text-xs sm:text-sm tracking-wide shadow-xl shadow-primary-500/20 flex items-center justify-center gap-2 disabled:opacity-50 transition-all hover:scale-[1.005]"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Generating Previews from {selectedModel === 'all' ? 'All 4 Models' : SUPPORTED_MODELS.find((m) => m.id === selectedModel)?.name}...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>
                    {selectedModel === 'all'
                      ? 'Generate Previews from All 4 Models'
                      : `Generate Previews with ${SUPPORTED_MODELS.find((m) => m.id === selectedModel)?.name}`}
                  </span>
                </>
              )}
            </button>

            {/* 6. TEMPORARY PREVIEW CARDS (WITH MODEL BADGES & PROMPT / REFINEMENT) */}
            {generatedImages.length > 0 && (
              <div className="space-y-3 mt-1 border-t border-white/10 pt-3">
                <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                  <span className="flex items-center gap-1.5">
                    <ImageIcon className="w-4 h-4 text-primary-400" /> Temporary Model Previews (Unsaved until approved):
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {generatedImages.length} Options Generated
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {generatedImages.map((record, index) => {
                    const activeVerIndex = activeVersionMap[record.tempId] ?? (record.versions?.length ? record.versions.length - 1 : 0);
                    const activeVer = record.versions && record.versions[activeVerIndex] ? record.versions[activeVerIndex] : null;
                    const displayUrl = activeVer ? activeVer.url : record.url;
                    const modelSpec = MODEL_NAME_MAP[record.modelId] || { label: record.modelId, color: 'bg-primary-500 text-white' };

                    return (
                      <div
                        key={record.tempId}
                        className="group relative rounded-xl overflow-hidden border border-white/15 bg-black/80 aspect-square flex flex-col justify-between hover:border-primary-400 transition-all shadow-lg"
                      >
                        <img
                          src={displayUrl}
                          alt={`Preview ${index + 1}`}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />

                        {/* Top Model Badge */}
                        <div className="absolute top-2 left-2 right-2 z-10 flex items-center justify-between pointer-events-none gap-1">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-black tracking-wider shadow-md backdrop-blur-md ${modelSpec.color}`}>
                            {modelSpec.label}
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-black/75 text-white text-[9px] font-black border border-white/20">
                            #{index + 1}
                          </span>
                        </div>

                        {/* Version History Selector */}
                        {record.versions && record.versions.length > 1 && (
                          <div className="absolute bottom-2 left-2 z-20 flex items-center gap-1 bg-black/85 p-1 rounded-lg border border-white/20">
                            <History className="w-3 h-3 text-amber-400 ml-1" />
                            {record.versions.map((v, vIdx) => (
                              <button
                                key={v.version}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveVersionMap((prev) => ({
                                    ...prev,
                                    [record.tempId]: vIdx,
                                  }));
                                }}
                                className={`px-1.5 py-0.5 text-[9px] font-extrabold rounded ${
                                  activeVerIndex === vIdx
                                    ? 'bg-amber-500 text-black'
                                    : 'bg-white/10 text-slate-300 hover:text-white'
                                }`}
                              >
                                v{v.version}
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Hover Action Overlay */}
                        <div className="absolute inset-0 bg-black/80 backdrop-blur-xs opacity-0 group-hover:opacity-100 transition-opacity p-2.5 flex flex-col justify-end gap-1.5 z-30">
                          <button
                            type="button"
                            onClick={() => setPreviewLightboxUrl(displayUrl)}
                            className="w-full py-1.5 bg-white/15 hover:bg-white/25 text-white rounded text-[11px] font-bold flex items-center justify-center gap-1"
                          >
                            <Eye className="w-3.5 h-3.5" /> Full View
                          </button>

                          <button
                            type="button"
                            onClick={() => setEditingTempId(editingTempId === record.tempId ? null : record.tempId)}
                            className="w-full py-1.5 bg-amber-500/80 hover:bg-amber-500 text-white rounded text-[11px] font-bold flex items-center justify-center gap-1"
                          >
                            <Edit3 className="w-3.5 h-3.5" /> Edit / Refine
                          </button>

                          <button
                            type="button"
                            onClick={() => handleApprove(record)}
                            disabled={approvingTempId === record.tempId}
                            className="w-full py-1.5 bg-emerald-500 hover:bg-emerald-400 text-white rounded text-[11px] font-black flex items-center justify-center gap-1 shadow disabled:opacity-50"
                          >
                            {approvingTempId === record.tempId ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            )}
                            <span>Approve & Add to Cloudinary</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDiscard(record.tempId)}
                            className="w-full py-1 bg-red-950/40 hover:bg-red-900/60 text-red-300 rounded text-[10px] font-bold flex items-center justify-center gap-1"
                          >
                            <X className="w-3 h-3" /> Discard
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 7. QWEN IMAGE EDIT REFINEMENT PANEL */}
            {editingTempId && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2.5"
              >
                <div className="flex items-center justify-between text-xs font-bold text-amber-400">
                  <span className="flex items-center gap-1.5">
                    <Edit3 className="w-4 h-4" /> Qwen Image Edit — Refine Selected Image:
                  </span>
                  <button
                    type="button"
                    onClick={() => setEditingTempId(null)}
                    className="text-slate-400 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={editPrompt}
                    onChange={(e) => setEditPrompt(e.target.value)}
                    placeholder='e.g. "Make the pizza more spicy and add roasted red peppers", "Remove onions", "Add dark wooden table"'
                    className="flex-1 bg-black/60 border border-amber-500/30 rounded-lg px-3.5 py-2.5 text-white text-xs outline-none focus:border-amber-400 placeholder:text-slate-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const rec = generatedImages.find((img) => img.tempId === editingTempId);
                      handleApplyEdit(rec);
                    }}
                    disabled={isEditing}
                    className="px-4 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs flex items-center justify-center gap-1.5 disabled:opacity-50 shrink-0 shadow"
                  >
                    {isEditing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                    <span>Apply Refinement</span>
                  </button>
                </div>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 8. GEMINI STUDIO ULTRA HIGH-QUALITY GENERATOR BUTTON & SECTION — ALWAYS VISIBLE AT BOTTOM */}
      <div className="border-t border-white/15 pt-3.5 mt-2">
        <button
          type="button"
          onClick={() => setShowGeminiSection(!showGeminiSection)}
          className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-black text-xs sm:text-sm flex items-center justify-between shadow-2xl transition-all hover:scale-[1.005] border border-cyan-400/30"
        >
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-cyan-300 animate-pulse" />
            <span>Create High-Quality Image with Gemini Studio</span>
          </div>
          <span className="text-[10px] px-2.5 py-1 rounded-full bg-white/20 text-white font-extrabold flex items-center gap-1">
            {showGeminiSection ? 'Hide Gemini Studio' : 'Open Gemini Studio Chat ↗'}
          </span>
        </button>

        {showGeminiSection && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mt-3 p-4 rounded-2xl bg-gradient-to-br from-indigo-950/90 via-purple-950/90 to-slate-950 border border-cyan-500/40 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h5 className="text-sm font-black text-white flex items-center gap-2">
                  <span>✨ Gemini Studio — Live AI Chat Inside Olive Pizza</span>
                </h5>
                <p className="text-xs text-slate-300 mt-0.5">
                  Generate images in Gemini Chat below, copy the result, and paste (`Ctrl + V`) directly into the box!
                </p>
              </div>
              <a
                href="https://gemini.google.com/u/2/app/29458430f623b65e?hl=en-IN&pageId=none"
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-extrabold text-xs rounded-xl shadow-lg flex items-center gap-1.5 transition-all hover:scale-105"
              >
                <span>Open in External Tab ↗</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            {/* Embedded Gemini Studio Frame with Direct URL Link */}
            <div className="space-y-3">
              <div className="p-3 bg-cyan-950/60 rounded-xl border border-cyan-500/40 flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 text-xs font-bold text-cyan-300">
                  <Sparkles className="w-4 h-4 text-cyan-400 animate-spin" />
                  <span>Gemini Chat Link: https://gemini.google.com/u/2/app/29458430f623b65e?hl=en-IN&pageId=none</span>
                </div>
                <a
                  href="https://gemini.google.com/u/2/app/29458430f623b65e?hl=en-IN&pageId=none"
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-black text-xs rounded-lg shadow flex items-center gap-1.5 transition-all hover:scale-105"
                >
                  <span>⚡ Open Gemini Chat ↗</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>

              <div className="w-full rounded-2xl overflow-hidden border border-cyan-500/30 bg-black/90 relative shadow-inner">
                <iframe
                  src="https://gemini.google.com/u/2/app/29458430f623b65e?hl=en-IN&pageId=none"
                  title="Gemini Chat Studio"
                  className="w-full h-[450px] bg-slate-950 border-0"
                  allow="clipboard-read; clipboard-write; camera; microphone"
                />
              </div>
            </div>

            {/* Native Clipboard Paste Dropzone */}
            <div
              tabIndex={0}
              onPaste={(e) => {
                const items = e.clipboardData?.items;
                if (items) {
                  for (let i = 0; i < items.length; i++) {
                    const item = items[i];
                    if (item.type.indexOf('image') !== -1) {
                      const fileBlob = item.getAsFile();
                      if (fileBlob) {
                        e.preventDefault();
                        const reader = new FileReader();
                        reader.onload = (evt) => {
                          if (evt.target?.result) {
                            createPreviewFromDataUrl(evt.target.result as string, 'Pasted Image');
                          }
                        };
                        reader.readAsDataURL(fileBlob);
                        return;
                      }
                    }
                  }
                }
                const text = e.clipboardData?.getData('text');
                if (text && (text.startsWith('http://') || text.startsWith('https://'))) {
                  e.preventDefault();
                  createPreviewFromDataUrl(text.trim(), 'Pasted Image URL');
                }
              }}
              className="p-4 bg-black/80 rounded-2xl border-2 border-dashed border-cyan-500/50 hover:border-cyan-400 space-y-3 transition-colors text-center cursor-pointer outline-none focus:ring-2 focus:ring-cyan-400"
            >
              <div className="flex flex-col items-center justify-center gap-1.5">
                <div className="w-10 h-10 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center mb-1">
                  {isSavingGeminiImage ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
                </div>
                <h6 className="text-xs font-black text-white">
                  PASTE COPIED GEMINI IMAGE HERE (Press Ctrl + V)
                </h6>
                <p className="text-[11px] text-slate-400">
                  Click here and press <kbd className="px-1.5 py-0.5 bg-slate-800 text-cyan-300 rounded font-mono text-[10px]">Ctrl + V</kbd> to upload directly to Cloudinary and set as product image!
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 pt-2 text-left">
                <input
                  type="text"
                  value={geminiPastedUrl}
                  onChange={(e) => setGeminiPastedUrl(e.target.value)}
                  placeholder="Or paste Gemini Image URL (https://...)"
                  className="flex-1 bg-black/90 border border-white/20 rounded-xl px-3.5 py-2 text-white text-xs outline-none focus:border-cyan-400 placeholder:text-slate-500"
                />
                <button
                  type="button"
                  onClick={handleSaveGeminiPastedUrl}
                  disabled={isSavingGeminiImage || !geminiPastedUrl.trim()}
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-black text-xs rounded-xl flex items-center justify-center gap-1.5 shadow disabled:opacity-50 shrink-0 cursor-pointer"
                >
                  {isSavingGeminiImage ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  <span>Save to Cloudinary & Use</span>
                </button>
              </div>

              <div className="flex items-center justify-center gap-3 pt-1">
                <input
                  type="file"
                  ref={geminiFileInputRef}
                  accept="image/*"
                  onChange={handleGeminiFileUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => geminiFileInputRef.current?.click()}
                  disabled={isSavingGeminiImage}
                  className="px-3.5 py-1.5 bg-white/10 hover:bg-white/20 text-slate-200 font-bold text-xs rounded-xl flex items-center gap-1.5 border border-white/15 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Browse Image File</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Lightbox Modal */}
      {previewLightboxUrl && (
        <div
          onClick={() => setPreviewLightboxUrl(null)}
          className="fixed inset-0 z-[100000] bg-black/90 p-4 flex items-center justify-center cursor-pointer"
        >
          <img
            src={previewLightboxUrl}
            alt="Full Preview"
            className="max-w-full max-h-[90vh] rounded-2xl border-2 border-white/20 shadow-2xl object-contain"
          />
        </div>
      )}
    </div>
  );
}
