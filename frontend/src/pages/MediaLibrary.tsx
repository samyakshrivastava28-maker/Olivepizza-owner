import React, { useState, useEffect } from 'react';
import {
  FolderOpen,
  UploadCloud,
  Search,
  Copy,
  Trash2,
  Eye,
  CheckCircle2,
  RefreshCw,
  ExternalLink,
  Image as ImageIcon,
  FileText,
  X,
} from 'lucide-react';
import { fetchApi } from '../lib/api';
import { uploadMediaToCloudinary, deleteMediaFromCloudinary } from '../lib/cloudinary';
import { db } from '../lib/firebase';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import toast from 'react-hot-toast';

export default function MediaLibrary() {
  const [media, setMedia] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedPreview, setSelectedPreview] = useState<any | null>(null);

  const fetchMedia = () => {
    setLoading(true);
    // Listen to real-time media items or fetch via backend
    const q = query(collection(db, 'media_library'), orderBy('uploadedAt', 'desc'), limit(100));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items: any[] = [];
        snapshot.forEach((d) => items.push({ id: d.id, ...d.data() }));
        if (items.length > 0) {
          setMedia(items);
          setLoading(false);
        } else {
          fallbackFetch();
        }
      },
      () => fallbackFetch()
    );

    return () => unsubscribe();
  };

  const fallbackFetch = () => {
    fetchApi('/api/media/list')
      .then((r) => r.json())
      .then((d) => setMedia(d.media || d || []))
      .catch((e) => console.warn('[MediaLibrary] Fetch fallback:', e))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const unsub = fetchMedia();
    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadProgress(0);
    const toastId = toast.loading('Uploading asset to Cloudinary...');
    try {
      const result = await uploadMediaToCloudinary(file, 'olive-pizza/media', (pct) => setUploadProgress(pct));
      toast.success('Asset uploaded successfully!', { id: toastId });
      setMedia((prev) => [
        {
          id: `media-${Date.now()}`,
          name: file.name,
          url: result.secureUrl || result.url,
          mediaUrl: result.secureUrl || result.url,
          publicId: result.publicId,
          cloudinaryPublicId: result.publicId,
          format: result.format || 'jpg',
          bytes: result.bytes || file.size,
          uploadedAt: new Date().toISOString(),
        },
        ...prev,
      ]);
    } catch (err: any) {
      toast.error('Upload failed: ' + err.message, { id: toastId });
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDelete = async (item: any) => {
    const publicId = item.cloudinaryPublicId || item.publicId || item.public_id;
    if (!confirm(`Are you sure you want to delete this media asset?`)) return;

    const toastId = toast.loading('Deleting asset...');
    try {
      if (publicId) {
        await deleteMediaFromCloudinary(publicId);
      }
      setMedia((prev) => prev.filter((m) => m.id !== item.id && (m.cloudinaryPublicId || m.publicId) !== publicId));
      toast.success('Asset removed.', { id: toastId });
    } catch (err: any) {
      toast.error('Failed to delete: ' + err.message, { id: toastId });
    }
  };

  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success('Copied Cloudinary URL to clipboard!');
  };

  const filteredMedia = media.filter((m) => {
    const term = searchQuery.toLowerCase();
    const name = (m.name || m.publicId || m.cloudinaryPublicId || '').toLowerCase();
    const fmt = (m.format || '').toLowerCase();
    return name.includes(term) || fmt.includes(term);
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#0E1524] p-5 rounded-2xl border border-slate-800 shadow-lg">
        <div>
          <h1 className="text-xl font-extrabold text-white tracking-tight">Cloudinary Media Library</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Store and manage product images, marketing banners, and menu assets securely.
          </p>
        </div>

        {/* Upload Button */}
        <label className="cursor-pointer px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-md shadow-orange-600/20">
          <UploadCloud className="w-4 h-4" />
          <span>{uploading ? `Uploading (${uploadProgress}%)...` : 'Upload Asset'}</span>
          <input type="file" accept="image/*" onChange={handleFileUpload} disabled={uploading} className="hidden" />
        </label>
      </div>

      {/* Search Bar */}
      <div className="bg-[#0E1524] border border-slate-800 rounded-2xl p-4 flex items-center gap-3">
        <Search className="w-4 h-4 text-slate-500" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search media by filename, public ID, or format..."
          className="w-full bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none"
        />
      </div>

      {/* Media Grid */}
      <div className="bg-[#0E1524] border border-slate-800 rounded-2xl p-6 shadow-md">
        {loading ? (
          <div className="text-center py-12 text-slate-500 text-xs">Loading Cloudinary media assets...</div>
        ) : filteredMedia.length === 0 ? (
          <div className="text-center py-16 text-slate-500 text-xs space-y-3">
            <FolderOpen className="w-10 h-10 mx-auto opacity-40 text-orange-400" />
            <p>No media files found. Upload your first product or banner image above.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {filteredMedia.map((item) => {
              const url = item.url || item.mediaUrl || item.secure_url;
              return (
                <div
                  key={item.id || item.publicId || url}
                  className="group bg-[#0B0F17] border border-slate-800 hover:border-slate-700 rounded-2xl overflow-hidden p-2 shadow-sm space-y-2 flex flex-col justify-between transition-all"
                >
                  <div
                    onClick={() => setSelectedPreview(item)}
                    className="cursor-pointer aspect-square rounded-xl overflow-hidden bg-slate-900 relative group"
                  >
                    <img src={url} alt="Media" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      <Eye className="w-5 h-5 text-white" />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="text-[11px] font-bold text-white truncate" title={item.name || item.publicId}>
                      {item.name || item.publicId || 'Asset'}
                    </div>
                    <div className="text-[10px] text-slate-500 flex justify-between">
                      <span className="uppercase">{item.format || 'JPG'}</span>
                      <span>{item.bytes ? `${Math.round(item.bytes / 1024)} KB` : ''}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 pt-2 border-t border-slate-800/80">
                    <button
                      onClick={() => copyUrl(url)}
                      className="flex-1 py-1 bg-[#0E1524] hover:bg-slate-800 text-slate-300 text-[10px] font-bold rounded-lg flex items-center justify-center gap-1 transition-all"
                      title="Copy URL"
                    >
                      <Copy className="w-3 h-3 text-orange-400" /> Copy
                    </button>
                    <button
                      onClick={() => handleDelete(item)}
                      className="p-1 bg-[#0E1524] hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded-lg transition-all"
                      title="Delete"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Preview Modal */}
      {selectedPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#0E1524] border border-slate-800 w-full max-w-xl rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-extrabold text-white truncate">{selectedPreview.name || selectedPreview.publicId || 'Asset Preview'}</h3>
              <button onClick={() => setSelectedPreview(null)} className="p-1.5 text-slate-400 hover:text-white rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="aspect-video rounded-2xl overflow-hidden bg-slate-900 border border-slate-800">
              <img
                src={selectedPreview.url || selectedPreview.mediaUrl || selectedPreview.secure_url}
                alt="Preview"
                className="w-full h-full object-contain"
              />
            </div>

            <div className="p-3 bg-[#0B0F17] rounded-xl border border-slate-800 text-xs flex justify-between items-center">
              <span className="text-slate-400 truncate max-w-xs font-mono text-[11px]">
                {selectedPreview.url || selectedPreview.mediaUrl || selectedPreview.secure_url}
              </span>
              <button
                onClick={() => copyUrl(selectedPreview.url || selectedPreview.mediaUrl || selectedPreview.secure_url)}
                className="px-3 py-1.5 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-lg text-xs flex items-center gap-1.5"
              >
                <Copy className="w-3.5 h-3.5" /> Copy URL
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
