import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload,
  Clipboard,
  Sparkles,
  ExternalLink,
  Image as ImageIcon,
  CheckCircle2,
  X,
  Loader2,
  Eye,
  RefreshCw,
  Search,
  Check,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getCurrentAuthToken, db } from '../../lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import InlineAIImageGenerator from './InlineAIImageGenerator';

export interface UnifiedImageSelectorHubProps {
  initialPrompt?: string;
  targetType?: 'product' | 'email' | 'ad';
  defaultAspectRatio?: '1:1' | '4:3' | '3:4' | '16:9';
  currentImageUrl?: string | null;
  onSelectImage: (cloudinaryUrl: string, publicId?: string) => void;
  onClearImage?: () => void;
}

type TabMode = 'none' | 'device' | 'paste' | 'generate' | 'gemini' | 'media';

export default function UnifiedImageSelectorHub({
  initialPrompt = 'Tandoori Paneer Pizza',
  targetType = 'product',
  defaultAspectRatio = '1:1',
  currentImageUrl = null,
  onSelectImage,
  onClearImage,
}: UnifiedImageSelectorHubProps) {
  const [activeTab, setActiveTab] = useState<TabMode>('none');

  // Device Upload State
  const [deviceFile, setDeviceFile] = useState<File | null>(null);
  const [devicePreviewUrl, setDevicePreviewUrl] = useState<string | null>(null);
  const [isUploadingDevice, setIsUploadingDevice] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Paste Image State
  const [pastePreviewUrl, setPastePreviewUrl] = useState<string | null>(null);
  const [pastedUrlInput, setPastedUrlInput] = useState<string>('');
  const [isApprovingPaste, setIsApprovingPaste] = useState(false);

  // Gemini State
  const [geminiPastedUrl, setGeminiPastedUrl] = useState<string>('');

  // Media Library State
  const [cloudinaryImages, setCloudinaryImages] = useState<any[]>([]);
  const [isLoadingMedia, setIsLoadingMedia] = useState(false);
  const [mediaSearchQuery, setMediaSearchQuery] = useState('');

  // Fetch Cloudinary Uploaded Media with Client Fallback
  const fetchUploadedMedia = async () => {
    setIsLoadingMedia(true);
    let loadedImages: any[] = [];
    try {
      const token = await getCurrentAuthToken().catch(() => '');
      const res = await fetch('/api/media/ai-images', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.images) && data.images.length > 0) {
        loadedImages = data.images;
      }
    } catch (err: any) {
      console.warn('API media fetch error, using Firestore fallback:', err.message);
    }

    // Client-side Firestore fallback if API returns empty
    if (loadedImages.length === 0) {
      try {
        const imagesMap = new Map<string, any>();
        const prodSnap = await getDocs(collection(db, 'products')).catch(() => null);
        if (prodSnap) {
          prodSnap.forEach((doc) => {
            const data = doc.data();
            const url = data.imageUrl || data.image;
            if (url && typeof url === 'string' && url.startsWith('http')) {
              imagesMap.set(url, {
                public_id: data.cloudinaryPublicId || doc.id,
                secure_url: url,
                format: 'jpg',
                created_at: data.createdAt || new Date().toISOString(),
              });
            }
          });
        }
        const mediaSnap = await getDocs(collection(db, 'media_library')).catch(() => null);
        if (mediaSnap) {
          mediaSnap.forEach((doc) => {
            const data = doc.data();
            if (data.mediaUrl && !imagesMap.has(data.mediaUrl)) {
              imagesMap.set(data.mediaUrl, {
                public_id: data.cloudinaryPublicId || doc.id,
                secure_url: data.mediaUrl,
                format: data.format || 'jpg',
                created_at: data.uploadedAt || new Date().toISOString(),
              });
            }
          });
        }
        loadedImages = Array.from(imagesMap.values());
      } catch (dbErr: any) {
        console.warn('Firestore fallback fetch warning:', dbErr.message);
      }
    }

    setCloudinaryImages(loadedImages);
    setIsLoadingMedia(false);
  };

  useEffect(() => {
    if (activeTab === 'media') {
      fetchUploadedMedia();
    }
  }, [activeTab]);

  // Process Device File Selection
  const handleDeviceFileSelect = (file: File) => {
    setDeviceFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        setDevicePreviewUrl(e.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  // Compress High-Res Base64 Image to Max 1920x1920 to prevent 413 Payload Too Large
  const compressDataUrlIfNeeded = (dataUrl: string, maxWidth = 1920, maxHeight = 1920): Promise<string> => {
    return new Promise((resolve) => {
      if (!dataUrl.startsWith('data:image')) {
        resolve(dataUrl);
        return;
      }
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width <= maxWidth && height <= maxHeight) {
          resolve(dataUrl);
          return;
        }
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.92));
        } else {
          resolve(dataUrl);
        }
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  };

  // Approve Preview Image & Save to Cloudinary via Backend Route
  const handleApprovePreview = async (previewUrl: string, folder: string) => {
    setIsApprovingPaste(true);
    try {
      const optimizedUrl = await compressDataUrlIfNeeded(previewUrl);
      const token = await getCurrentAuthToken().catch(() => '');
      const res = await fetch('/api/ai/image/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          imageUrl: optimizedUrl,
          folder,
        }),
      });
      const data = await res.json();
      if (data.success && data.cloudinaryUrl) {
        toast.success('✨ Approved & Saved to Cloudinary!');
        onSelectImage(data.cloudinaryUrl, data.publicId);
        setActiveTab('none');
        setPastePreviewUrl(null);
        setDevicePreviewUrl(null);
        setDeviceFile(null);
      } else {
        toast.error(data.error || 'Failed to save to Cloudinary');
      }
    } catch (err: any) {
      toast.error('Approval upload failed: ' + err.message);
    }
    setIsApprovingPaste(false);
  };

  const filteredMedia = cloudinaryImages.filter((img) => {
    if (!mediaSearchQuery.trim()) return true;
    const q = mediaSearchQuery.toLowerCase();
    return (
      (img.public_id && img.public_id.toLowerCase().includes(q)) ||
      (img.format && img.format.toLowerCase().includes(q))
    );
  });

  return (
    <div className="w-full space-y-3 bg-black/60 p-4 rounded-2xl border border-white/10 shadow-xl">
      {/* Selected Image Top Bar */}
      {currentImageUrl && (
        <div className="p-3 bg-emerald-950/40 border border-emerald-500/40 rounded-xl flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <img
              src={currentImageUrl}
              alt="Selected Product Image"
              className="w-14 h-14 object-cover rounded-lg border border-emerald-400 shadow"
            />
            <div>
              <span className="text-xs font-black text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Current Image Set
              </span>
              <p className="text-[11px] text-slate-300 truncate max-w-[200px] sm:max-w-xs">
                {currentImageUrl}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(currentImageUrl);
                toast.success('Image URL copied to clipboard!');
              }}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-lg font-bold border border-slate-700"
            >
              Copy URL
            </button>
            <a
              href={currentImageUrl}
              target="_blank"
              rel="noreferrer"
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-lg font-bold border border-slate-700 flex items-center gap-1"
            >
              <Eye className="w-3.5 h-3.5" /> View
            </a>
            {onClearImage && (
              <button
                type="button"
                onClick={onClearImage}
                className="px-2.5 py-1.5 bg-red-950/50 hover:bg-red-900/60 text-red-400 text-xs rounded-lg font-bold border border-red-800/50"
              >
                Remove
              </button>
            )}
          </div>
        </div>
      )}

      {/* 5 Tab Action Buttons */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        <button
          type="button"
          onClick={() => setActiveTab(activeTab === 'device' ? 'none' : 'device')}
          className={`px-3 py-2.5 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
            activeTab === 'device'
              ? 'bg-primary-500 text-white border-primary-400 shadow-lg'
              : 'bg-black/40 text-slate-300 border-white/10 hover:border-white/30 hover:bg-white/5'
          }`}
        >
          <Upload className="w-4 h-4 text-amber-400" />
          <span>Add from device</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab(activeTab === 'paste' ? 'none' : 'paste')}
          className={`px-3 py-2.5 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
            activeTab === 'paste'
              ? 'bg-emerald-600 text-white border-emerald-400 shadow-lg'
              : 'bg-black/40 text-slate-300 border-white/10 hover:border-white/30 hover:bg-white/5'
          }`}
        >
          <Clipboard className="w-4 h-4 text-emerald-400" />
          <span>Paste image</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab(activeTab === 'generate' ? 'none' : 'generate')}
          className={`px-3 py-2.5 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
            activeTab === 'generate'
              ? 'bg-indigo-600 text-white border-indigo-400 shadow-lg'
              : 'bg-black/40 text-slate-300 border-white/10 hover:border-white/30 hover:bg-white/5'
          }`}
        >
          <Sparkles className="w-4 h-4 text-cyan-400 animate-pulse" />
          <span>Generate image</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab(activeTab === 'gemini' ? 'none' : 'gemini')}
          className={`px-3 py-2.5 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
            activeTab === 'gemini'
              ? 'bg-purple-600 text-white border-purple-400 shadow-lg'
              : 'bg-black/40 text-slate-300 border-white/10 hover:border-white/30 hover:bg-white/5'
          }`}
        >
          <ExternalLink className="w-4 h-4 text-purple-400" />
          <span>Gemini & paste</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab(activeTab === 'media' ? 'none' : 'media')}
          className={`px-3 py-2.5 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 border transition-all cursor-pointer col-span-2 sm:col-span-1 ${
            activeTab === 'media'
              ? 'bg-blue-600 text-white border-blue-400 shadow-lg'
              : 'bg-black/40 text-slate-300 border-white/10 hover:border-white/30 hover:bg-white/5'
          }`}
        >
          <ImageIcon className="w-4 h-4 text-blue-400" />
          <span>Uploaded media</span>
        </button>
      </div>

      {/* Expanded Tab Content */}
      <AnimatePresence mode="wait">
        {/* TAB 1: ADD IMAGE FROM DEVICE */}
        {activeTab === 'device' && (
          <motion.div
            key="tab-device"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="p-4 bg-dark-900 rounded-2xl border border-white/15 space-y-3"
          >
            <div className="flex items-center justify-between text-xs font-bold text-slate-300">
              <span className="flex items-center gap-1.5">
                <Upload className="w-4 h-4 text-amber-400" /> Upload Image File from Local Device
              </span>
              <button
                type="button"
                onClick={() => setActiveTab('none')}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {devicePreviewUrl ? (
              <div className="p-3 bg-black/70 rounded-xl border border-white/15 flex flex-col items-center gap-3 text-center">
                <img
                  src={devicePreviewUrl}
                  alt="Device Preview"
                  className="h-40 object-contain rounded-lg border border-white/20"
                />
                <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                  🔍 RAM PREVIEW (Not saved to Cloudinary yet)
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      handleApprovePreview(
                        devicePreviewUrl,
                        targetType === 'email'
                          ? 'olive-pizza/email-banners'
                          : 'olive-pizza/ai-product-images'
                      )
                    }
                    disabled={isApprovingPaste}
                    className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-white font-black text-xs rounded-xl flex items-center gap-1.5 shadow"
                  >
                    {isApprovingPaste ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                    <span>Approve & Save to Cloudinary</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDeviceFile(null);
                      setDevicePreviewUrl(null);
                    }}
                    className="px-3 py-2 bg-red-950/40 hover:bg-red-900/60 text-red-300 font-bold text-xs rounded-xl"
                  >
                    Discard
                  </button>
                </div>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="p-6 border-2 border-dashed border-white/20 hover:border-primary-400 rounded-xl flex flex-col items-center justify-center gap-2 cursor-pointer bg-black/40 transition-colors"
              >
                <Upload className="w-8 h-8 text-primary-400" />
                <p className="text-xs font-bold text-white">Click or Drag & Drop Image File</p>
                <p className="text-[11px] text-slate-400">PNG, JPG, WEBP up to 10MB</p>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={(e) => {
                    if (e.target.files?.[0]) handleDeviceFileSelect(e.target.files[0]);
                  }}
                  className="hidden"
                />
              </div>
            )}
          </motion.div>
        )}

        {/* TAB 2: PASTE IMAGE */}
        {activeTab === 'paste' && (
          <motion.div
            key="tab-paste"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="p-4 bg-dark-900 rounded-2xl border border-white/15 space-y-3"
          >
            <div className="flex items-center justify-between text-xs font-bold text-slate-300">
              <span className="flex items-center gap-1.5">
                <Clipboard className="w-4 h-4 text-emerald-400" /> Quick Clipboard Paste (Ctrl + V)
              </span>
              <button
                type="button"
                onClick={() => setActiveTab('none')}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {pastePreviewUrl ? (
              <div className="p-3 bg-black/70 rounded-xl border border-white/15 flex flex-col items-center gap-3 text-center">
                <img
                  src={pastePreviewUrl}
                  alt="Paste Preview"
                  className="h-40 object-contain rounded-lg border border-white/20"
                />
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                  🔍 RAM PREVIEW (Not saved to Cloudinary yet)
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      handleApprovePreview(
                        pastePreviewUrl,
                        targetType === 'email'
                          ? 'olive-pizza/email-banners'
                          : 'olive-pizza/ai-product-images'
                      )
                    }
                    disabled={isApprovingPaste}
                    className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-white font-black text-xs rounded-xl flex items-center gap-1.5 shadow"
                  >
                    {isApprovingPaste ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                    <span>Approve & Save to Cloudinary</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPastePreviewUrl(null)}
                    className="px-3 py-2 bg-red-950/40 hover:bg-red-900/60 text-red-300 font-bold text-xs rounded-xl"
                  >
                    Discard
                  </button>
                </div>
              </div>
            ) : (
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
                              setPastePreviewUrl(evt.target.result as string);
                              toast.success('✨ Clipboard image preview loaded!');
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
                    setPastePreviewUrl(text.trim());
                    toast.success('✨ Image URL preview loaded!');
                  }
                }}
                className="p-5 bg-black/80 rounded-2xl border-2 border-dashed border-emerald-500/50 hover:border-emerald-400 space-y-3 transition-colors text-center cursor-pointer outline-none focus:ring-2 focus:ring-emerald-400"
              >
                <div className="flex flex-col items-center justify-center gap-1.5">
                  <Clipboard className="w-8 h-8 text-emerald-400" />
                  <h6 className="text-xs font-black text-white">
                    PASTE COPIED IMAGE HERE (Press Ctrl + V)
                  </h6>
                  <p className="text-[11px] text-slate-400">
                    Click here and press <kbd className="px-1.5 py-0.5 bg-slate-800 text-emerald-300 rounded font-mono text-[10px]">Ctrl + V</kbd> to load preview first!
                  </p>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="text"
                    value={pastedUrlInput}
                    onChange={(e) => setPastedUrlInput(e.target.value)}
                    placeholder="Or paste Image URL (https://...)"
                    className="flex-1 bg-black/90 border border-white/20 rounded-xl px-3.5 py-2 text-white text-xs outline-none focus:border-emerald-400 placeholder:text-slate-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (pastedUrlInput.trim()) {
                        setPastePreviewUrl(pastedUrlInput.trim());
                        setPastedUrlInput('');
                      }
                    }}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow"
                  >
                    Load Preview
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* TAB 3: GENERATE IMAGE (4 AI MODELS) */}
        {activeTab === 'generate' && (
          <motion.div
            key="tab-generate"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <InlineAIImageGenerator
              initialPrompt={initialPrompt}
              targetType={targetType}
              defaultAspectRatio={defaultAspectRatio}
              onSelectImage={(cloudinaryUrl, publicId) => {
                onSelectImage(cloudinaryUrl, publicId);
                setActiveTab('none');
              }}
            />
          </motion.div>
        )}

        {/* TAB 4: GENERATE USING GEMINI THEN PASTE */}
        {activeTab === 'gemini' && (
          <motion.div
            key="tab-gemini"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="p-4 bg-dark-900 rounded-2xl border border-purple-500/40 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between text-xs font-bold text-purple-300">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-cyan-300" /> Gemini Studio Ultra High-Quality Section
              </span>
              <button
                type="button"
                onClick={() => setActiveTab('none')}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Direct Gemini Chat Launcher Link */}
            <div className="p-3.5 bg-gradient-to-r from-blue-900/60 via-purple-900/60 to-slate-900 rounded-xl border border-cyan-400/40 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-300 flex items-center justify-center shrink-0">
                  <Sparkles className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <h6 className="text-xs font-black text-white">Generate High Quality Image in Gemini Chat</h6>
                  <p className="text-[11px] text-slate-300">
                    https://gemini.google.com/u/2/app/29458430f623b65e?hl=en-IN&pageId=none
                  </p>
                </div>
              </div>
              <a
                href="https://gemini.google.com/u/2/app/29458430f623b65e?hl=en-IN&pageId=none"
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-black text-xs rounded-xl shadow shrink-0 flex items-center gap-1"
              >
                <span>⚡ Open Gemini Chat ↗</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            {/* Paste Box for Gemini Results */}
            {pastePreviewUrl ? (
              <div className="p-3 bg-black/70 rounded-xl border border-white/15 flex flex-col items-center gap-3 text-center">
                <img
                  src={pastePreviewUrl}
                  alt="Gemini Preview"
                  className="h-40 object-contain rounded-lg border border-white/20"
                />
                <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 font-bold border border-purple-500/30">
                  🔍 GEMINI RAM PREVIEW (Not saved to Cloudinary yet)
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      handleApprovePreview(
                        pastePreviewUrl,
                        targetType === 'email'
                          ? 'olive-pizza/email-banners'
                          : 'olive-pizza/ai-product-images'
                      )
                    }
                    disabled={isApprovingPaste}
                    className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-white font-black text-xs rounded-xl flex items-center gap-1.5 shadow"
                  >
                    {isApprovingPaste ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                    <span>Approve & Save to Cloudinary</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPastePreviewUrl(null)}
                    className="px-3 py-2 bg-red-950/40 hover:bg-red-900/60 text-red-300 font-bold text-xs rounded-xl"
                  >
                    Discard
                  </button>
                </div>
              </div>
            ) : (
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
                              setPastePreviewUrl(evt.target.result as string);
                              toast.success('✨ Gemini image preview loaded!');
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
                    setPastePreviewUrl(text.trim());
                    toast.success('✨ Gemini Image URL loaded!');
                  }
                }}
                className="p-5 bg-black/80 rounded-2xl border-2 border-dashed border-purple-500/50 hover:border-purple-400 space-y-3 transition-colors text-center cursor-pointer outline-none focus:ring-2 focus:ring-purple-400"
              >
                <div className="flex flex-col items-center justify-center gap-1.5">
                  <Clipboard className="w-8 h-8 text-purple-400" />
                  <h6 className="text-xs font-black text-white">
                    PASTE COPIED GEMINI IMAGE HERE (Press Ctrl + V)
                  </h6>
                  <p className="text-[11px] text-slate-400">
                    Copy from Gemini Chat, click here, and press <kbd className="px-1.5 py-0.5 bg-slate-800 text-purple-300 rounded font-mono text-[10px]">Ctrl + V</kbd> to load preview first!
                  </p>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="text"
                    value={geminiPastedUrl}
                    onChange={(e) => setGeminiPastedUrl(e.target.value)}
                    placeholder="Or paste Gemini Image URL (https://...)"
                    className="flex-1 bg-black/90 border border-white/20 rounded-xl px-3.5 py-2 text-white text-xs outline-none focus:border-purple-400 placeholder:text-slate-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (geminiPastedUrl.trim()) {
                        setPastePreviewUrl(geminiPastedUrl.trim());
                        setGeminiPastedUrl('');
                      }
                    }}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl shadow"
                  >
                    Load Preview
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* TAB 5: USE FROM UPLOADED MEDIA (CLOUDINARY LIBRARY) */}
        {activeTab === 'media' && (
          <motion.div
            key="tab-media"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="p-4 bg-dark-900 rounded-2xl border border-blue-500/40 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2 text-xs font-bold text-blue-300">
                <ImageIcon className="w-4 h-4 text-blue-400" /> Cloudinary Media Library ({cloudinaryImages.length} Images)
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('none')}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                value={mediaSearchQuery}
                onChange={(e) => setMediaSearchQuery(e.target.value)}
                placeholder="Search Cloudinary images by name..."
                className="w-full bg-black/70 border border-white/15 rounded-xl pl-9 pr-4 py-2 text-xs text-white outline-none focus:border-blue-400"
              />
            </div>

            {/* Media Grid */}
            {isLoadingMedia ? (
              <div className="p-8 flex items-center justify-center text-slate-400 gap-2 text-xs">
                <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
                <span>Loading Cloudinary images...</span>
              </div>
            ) : filteredMedia.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                No Cloudinary images found matching query.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 max-h-80 overflow-y-auto custom-scrollbar p-1">
                {filteredMedia.map((img) => (
                  <div
                    key={img.public_id}
                    onClick={() => {
                      onSelectImage(img.secure_url, img.public_id);
                      setActiveTab('none');
                      toast.success('Selected image from Cloudinary!');
                    }}
                    className="group relative rounded-xl overflow-hidden border border-white/15 bg-black/80 aspect-square cursor-pointer hover:border-blue-400 transition-all hover:scale-[1.03] shadow"
                  >
                    <img
                      src={img.secure_url}
                      alt={img.public_id}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-blue-600/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1 text-white font-extrabold text-xs">
                      <Check className="w-4 h-4" /> Select
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
