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
  RefreshCw,
  AlertTriangle,
  History,
  Upload,
  ExternalLink,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getCurrentAuthToken } from '../../lib/firebase';
import { uploadMediaToCloudinary } from '../../lib/cloudinary';

export interface AIImageGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectImage: (imageUrl: string, publicId?: string) => void;
  initialPrompt?: string;
  targetType?: 'product' | 'email' | 'ad';
  defaultAspectRatio?: '1:1' | '4:3' | '3:4' | '16:9';
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

export default function AIImageGeneratorModal({
  isOpen,
  onClose,
  onSelectImage,
  initialPrompt = '',
  targetType = 'product',
  defaultAspectRatio = '1:1',
}: AIImageGeneratorModalProps) {
  const [prompt, setPrompt] = useState(initialPrompt);
  const [enhancedPrompt, setEnhancedPrompt] = useState('');
  const [isEnhancing, setIsEnhancing] = useState(false);

  // Model & Aspect Ratio Selection
  const [selectedModel, setSelectedModel] = useState<string>('all');
  const [aspectRatio, setAspectRatio] = useState<'1:1' | '4:3' | '3:4' | '16:9'>(defaultAspectRatio);

  // Advanced Controls
  const [imageCount, setImageCount] = useState<number>(4);

  // Results & Versions
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<ImageRecord[]>([]);
  const [activeVersionMap, setActiveVersionMap] = useState<Record<string, number>>({});
  const [previewLightboxUrl, setPreviewLightboxUrl] = useState<string | null>(null);

  // Editing State
  const [editingTempId, setEditingTempId] = useState<string | null>(null);
  const [editPrompt, setEditPrompt] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  // Approval Loading
  const [approvingTempId, setApprovingTempId] = useState<string | null>(null);

  // Gemini Studio Section State
  const [showGeminiSection, setShowGeminiSection] = useState(false);
  const [geminiPastedUrl, setGeminiPastedUrl] = useState('');
  const [isSavingGeminiImage, setIsSavingGeminiImage] = useState(false);
  const geminiFileInputRef = useRef<HTMLInputElement>(null);

  // Error State
  const [generationError, setGenerationError] = useState<{
    failedModel: string;
    reason: string;
  } | null>(null);

  useEffect(() => {
    if (isOpen && initialPrompt) {
      setPrompt(initialPrompt);
    }
  }, [isOpen, initialPrompt]);

  // DeepSeek V4 Flash Prompt Enhancer
  const handleEnhancePrompt = async () => {
    if (!prompt.trim()) {
      toast.error('Please enter a prompt to enhance');
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

  // Generate Preview Images
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
        toast.success(`Generated ${data.images.length} previews!`);
      } else {
        const activeModelSpec = SUPPORTED_MODELS.find((m) => m.id === selectedModel);
        setGenerationError({
          failedModel: activeModelSpec?.name || selectedModel,
          reason: data.error || 'Generation failed.',
        });
        toast.error('Generation failed');
      }
    } catch (err: any) {
      const activeModelSpec = SUPPORTED_MODELS.find((m) => m.id === selectedModel);
      setGenerationError({
        failedModel: activeModelSpec?.name || selectedModel,
        reason: err.message || 'Connection failure',
      });
      toast.error('Generation request failed');
    }
    setIsGenerating(false);
  };

  // Apply Qwen Image Edit
  const handleApplyEdit = async (baseRecord: ImageRecord) => {
    if (!editPrompt.trim()) {
      toast.error('Please enter what to change');
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
          tempId: baseRecord.tempId,
          baseImageUrl: baseRecord.url,
          editPrompt,
          modelId: 'qwen-image-edit',
          aspectRatio,
        }),
      });
      const data = await res.json();
      if (data.success && data.image) {
        setGeneratedImages((prev) =>
          prev.map((img) => (img.tempId === baseRecord.tempId ? data.image : img))
        );
        setActiveVersionMap((prev) => ({
          ...prev,
          [baseRecord.tempId]: (data.image.versions?.length || 1) - 1,
        }));
        setEditingTempId(null);
        setEditPrompt('');
        toast.success('Image refined with Qwen Edit!');
      } else {
        setGenerationError({
          failedModel: 'Qwen Image Edit',
          reason: data.error || 'Refinement failed',
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

  // Approve & Save to Cloudinary
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
        toast.success('Approved! Saved to Cloudinary.');
        onSelectImage(data.cloudinaryUrl, data.publicId);
        onClose();
      } else {
        toast.error(data.error || 'Cloudinary upload failed.');
      }
    } catch (err: any) {
      toast.error('Approval upload failed: ' + err.message);
    }
    setApprovingTempId(null);
  };

  // Save Gemini Studio Image (Pasted URL)
  const handleSaveGeminiPastedUrl = async () => {
    if (!geminiPastedUrl.trim()) {
      toast.error('Please paste a Gemini image URL first');
      return;
    }
    setIsSavingGeminiImage(true);
    try {
      const token = await getCurrentAuthToken().catch(() => '');
      const res = await fetch('/api/ai/image/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          imageUrl: geminiPastedUrl.trim(),
          folder: targetType === 'email' ? 'olive-pizza/email-banners' : 'olive-pizza/ai-product-images',
        }),
      });
      const data = await res.json();
      if (data.success && data.cloudinaryUrl) {
        toast.success('Gemini Image Saved to Cloudinary & Applied!');
        onSelectImage(data.cloudinaryUrl, data.publicId);
        setGeminiPastedUrl('');
        onClose();
      } else {
        toast.error(data.error || 'Failed to save Gemini image to Cloudinary');
      }
    } catch (err: any) {
      toast.error('Gemini image upload error: ' + err.message);
    }
    setIsSavingGeminiImage(false);
  };

  // Save Gemini Studio Image (File Upload)
  const handleGeminiFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsSavingGeminiImage(true);
    try {
      const folder = targetType === 'email' ? 'olive-pizza/email-banners' : 'olive-pizza/ai-product-images';
      const result = await uploadMediaToCloudinary(file, folder);
      if (result.secureUrl) {
        toast.success('Gemini Image File Saved to Cloudinary & Applied!');
        onSelectImage(result.secureUrl, result.publicId);
        onClose();
      }
    } catch (err: any) {
      toast.error('File upload error: ' + err.message);
    }
    setIsSavingGeminiImage(false);
    if (geminiFileInputRef.current) geminiFileInputRef.current.value = '';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 md:p-6 bg-black/85 backdrop-blur-md overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-4xl bg-dark-900 border border-white/15 rounded-3xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-dark-950/80">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-primary-500 to-amber-500 flex items-center justify-center shadow-lg">
              <Sparkles className="w-5 h-5 text-white animate-spin" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white tracking-tight flex items-center gap-2">
                AI Product Image Studio
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary-500/20 text-primary-300 font-bold border border-primary-500/30">
                  4 MODEL COMPARISON
                </span>
              </h2>
              <p className="text-slate-400 text-xs font-medium">
                Compare previews from all 4 models, refine with Qwen Edit, and approve to Cloudinary.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1 custom-scrollbar">
          {/* Prompt Section */}
          <div className="space-y-2.5">
            <label className="text-xs font-extrabold text-slate-300 uppercase tracking-wider block">
              Describe Dish / Visual:
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g. Indian Tandoori Paneer Pizza with melted mozzarella..."
                className="flex-1 bg-black/60 border border-white/15 rounded-xl px-4 py-3 text-white text-sm focus:border-primary-500 outline-none transition-colors"
              />
              <button
                onClick={handleEnhancePrompt}
                disabled={isEnhancing}
                className="px-4 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg disabled:opacity-50 shrink-0 border border-indigo-400/40"
              >
                {isEnhancing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                <span>Enhance with DeepSeek</span>
              </button>
            </div>

            {enhancedPrompt && (
              <div className="p-3.5 rounded-xl bg-primary-500/10 border border-primary-500/30 space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold text-primary-300">
                  <span className="flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5" /> DeepSeek V4 Flash Enhanced Prompt:
                  </span>
                  <button onClick={() => setEnhancedPrompt('')} className="text-slate-400 hover:text-white text-[11px]">
                    Clear
                  </button>
                </div>
                <textarea
                  value={enhancedPrompt}
                  onChange={(e) => setEnhancedPrompt(e.target.value)}
                  rows={2}
                  className="w-full bg-black/50 border border-primary-500/20 rounded-lg p-2 text-white text-xs outline-none resize-none"
                />
              </div>
            )}
          </div>

          {/* Model Cards Selector */}
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
                  className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all ${
                    selectedModel === model.id
                      ? 'bg-primary-500/15 border-primary-500 ring-1 ring-primary-500/50 shadow-lg'
                      : 'bg-black/40 border-white/10 hover:border-white/25 hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="font-extrabold text-[11px] text-white">{model.name}</span>
                  </div>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded border inline-block w-fit mb-1 ${model.badgeColor}`}>
                    {model.badge}
                  </span>
                  <p className="text-[10px] text-slate-400 font-medium leading-tight">{model.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Error Banner */}
          {generationError && (
            <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 space-y-2">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <div>
                  <h5 className="text-xs font-bold text-red-400">
                    Generation Failed on {generationError.failedModel}
                  </h5>
                  <p className="text-[11px] text-red-300/80 mt-0.5">{generationError.reason}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleGenerate}
                  className="px-3 py-1.5 bg-red-500 hover:bg-red-400 text-white font-bold rounded-lg text-xs flex items-center gap-1"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Retry
                </button>
                <button
                  onClick={() => {
                    setGenerationError(null);
                    setSelectedModel('all');
                  }}
                  className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-slate-200 font-bold rounded-lg text-xs"
                >
                  Choose Another Model / Compare All
                </button>
              </div>
            </div>
          )}

          {/* Generate Button */}
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-primary-500 via-orange-500 to-amber-500 hover:from-primary-600 hover:to-amber-600 text-white font-black text-sm tracking-wide shadow-xl shadow-primary-500/20 flex items-center justify-center gap-2 disabled:opacity-50 transition-all"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Generating Previews from {selectedModel === 'all' ? 'All 4 Models' : SUPPORTED_MODELS.find((m) => m.id === selectedModel)?.name}...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                <span>
                  {selectedModel === 'all'
                    ? 'Generate Previews from All 4 Models'
                    : `Generate Previews with ${SUPPORTED_MODELS.find((m) => m.id === selectedModel)?.name}`}
                </span>
              </>
            )}
          </button>

          {/* Previews Grid */}
          {generatedImages.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-extrabold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <ImageIcon className="w-4 h-4 text-primary-400" /> Preview Results (Model Tagged — Approve to save):
                </h3>
                <span className="text-[11px] font-bold text-slate-400">{generatedImages.length} Previews</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {generatedImages.map((record, index) => {
                  const activeVerIndex = activeVersionMap[record.tempId] ?? (record.versions?.length ? record.versions.length - 1 : 0);
                  const activeVer = record.versions && record.versions[activeVerIndex] ? record.versions[activeVerIndex] : null;
                  const displayUrl = activeVer ? activeVer.url : record.url;
                  const modelSpec = MODEL_NAME_MAP[record.modelId] || { label: record.modelId, color: 'bg-primary-500 text-white' };

                  return (
                    <div
                      key={record.tempId}
                      className="group relative rounded-2xl overflow-hidden border border-white/15 bg-black/80 aspect-square flex flex-col justify-between hover:border-primary-400 transition-all shadow-lg"
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

                      {/* Hover Overlay */}
                      <div className="absolute inset-0 bg-black/80 backdrop-blur-xs opacity-0 group-hover:opacity-100 transition-opacity p-2.5 flex flex-col justify-end gap-1.5 z-20">
                        <button
                          onClick={() => setPreviewLightboxUrl(displayUrl)}
                          className="w-full py-1.5 bg-white/15 hover:bg-white/25 text-white rounded-lg text-[11px] font-bold flex items-center justify-center gap-1"
                        >
                          <Eye className="w-3.5 h-3.5" /> Full View
                        </button>

                        <button
                          onClick={() => setEditingTempId(editingTempId === record.tempId ? null : record.tempId)}
                          className="w-full py-1.5 bg-amber-500/80 hover:bg-amber-500 text-white rounded-lg text-[11px] font-bold flex items-center justify-center gap-1"
                        >
                          <Edit3 className="w-3.5 h-3.5" /> Edit / Refine
                        </button>

                        <button
                          onClick={() => handleApprove(record)}
                          disabled={approvingTempId === record.tempId}
                          className="w-full py-1.5 bg-emerald-500 hover:bg-emerald-400 text-white rounded-lg text-[11px] font-black flex items-center justify-center gap-1 shadow disabled:opacity-50"
                        >
                          {approvingTempId === record.tempId ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          )}
                          <span>Approve & Save</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Edit Panel */}
          {editingTempId && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-3"
            >
              <div className="flex items-center justify-between text-xs font-bold text-amber-400">
                <span className="flex items-center gap-1.5">
                  <Edit3 className="w-4 h-4" /> Qwen Image Refinement — What should change?
                </span>
                <button onClick={() => setEditingTempId(null)} className="text-slate-400 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={editPrompt}
                  onChange={(e) => setEditPrompt(e.target.value)}
                  placeholder="e.g. Add roasted red peppers, more melted cheese..."
                  className="flex-1 bg-black/60 border border-amber-500/30 rounded-xl px-3.5 py-2.5 text-white text-xs outline-none"
                />
                <button
                  onClick={() => {
                    const rec = generatedImages.find((img) => img.tempId === editingTempId);
                    if (rec) handleApplyEdit(rec);
                  }}
                  disabled={isEditing}
                  className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs flex items-center justify-center gap-1.5 shadow"
                >
                  {isEditing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                  <span>Apply Refinement</span>
                </button>
              </div>
            </motion.div>
          )}

          {/* GEMINI STUDIO SECTION — ALWAYS VISIBLE AT BOTTOM OF MODAL */}
          <div className="border-t border-white/15 pt-3.5 mt-2">
            <button
              type="button"
              onClick={() => setShowGeminiSection(!showGeminiSection)}
              className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-black text-xs sm:text-sm flex items-center justify-between shadow-2xl transition-all hover:scale-[1.005] border border-cyan-400/30 cursor-pointer"
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
              onPaste={async (e) => {
                const items = e.clipboardData?.items;
                if (items) {
                  for (let i = 0; i < items.length; i++) {
                    const item = items[i];
                    if (item.type.indexOf('image') !== -1) {
                      const fileBlob = item.getAsFile();
                      if (fileBlob) {
                        e.preventDefault();
                        setIsSavingGeminiImage(true);
                        try {
                          const folder = targetType === 'email' ? 'olive-pizza/email-banners' : 'olive-pizza/ai-product-images';
                          const file = new File([fileBlob], `gemini-${Date.now()}.png`, { type: fileBlob.type });
                          const result = await uploadMediaToCloudinary(file, folder);
                          if (result.secureUrl) {
                            toast.success('✨ Gemini image pasted & uploaded to Cloudinary!');
                            onSelectImage(result.secureUrl, result.publicId);
                            onClose();
                          }
                        } catch (err: any) {
                          toast.error('Upload error: ' + err.message);
                        }
                        setIsSavingGeminiImage(false);
                        return;
                      }
                    }
                  }
                }
                const text = e.clipboardData?.getData('text');
                if (text && (text.startsWith('http://') || text.startsWith('https://'))) {
                  e.preventDefault();
                  setGeminiPastedUrl(text);
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
        </div>
      </motion.div>

      {/* Lightbox */}
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
