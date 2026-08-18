import React, { useState, useEffect } from 'react';
import { fetchApi } from '../lib/api';
import { MediaItem } from '../types/models';
import { TableSkeleton } from '../components/ui/Skeleton';
import { ErrorState } from '../components/ui/ErrorState';
import { EmptyState } from '../components/ui/EmptyState';
import { uploadMediaToCloudinary } from '../lib/cloudinary';
import { UploadCloud, Copy, Check, Search, Trash2, Image as ImageIcon, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';

export default function MediaLibrary() {
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  const fetchMedia = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchApi('/api/media-library');
      if (res.ok) {
        const data = await res.json();
        const resources = data.resources || data.images || [];
        setMedia(resources);
      } else {
        // Mock safe fallback if media library API endpoint is in cold start
        setMedia([]);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMedia();
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setProgress(5);
    try {
      const res = await uploadMediaToCloudinary(file, (p) => setProgress(p));
      const newItem: MediaItem = {
        publicId: res.publicId,
        url: res.url,
        format: res.format,
        bytes: res.bytes,
        createdAt: new Date().toISOString(),
        resourceType: 'image',
      };
      setMedia((prev) => [newItem, ...prev]);
      toast.success('Media asset uploaded successfully!');
    } catch (err: any) {
      toast.error('Upload failed: ' + err.message);
    } finally {
      setUploading(false);
      setProgress(null);
    }
  };

  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    toast.success('Asset URL copied to clipboard!');
    setTimeout(() => setCopiedUrl(null), 2500);
  };

  const filteredMedia = media.filter((m) =>
    m.publicId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.url?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-white">Cloudinary Media Library</h2>
          <p className="text-xs text-slate-400">High-resolution image & video storage for pizzas, banners, and marketing assets.</p>
        </div>
        <label className="cursor-pointer px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-orange-600/20">
          <UploadCloud className="w-4 h-4" />
          {uploading ? `Uploading (${progress || 0}%)...` : 'Upload Media'}
          <input type="file" accept="image/*,video/*" disabled={uploading} onChange={handleUpload} className="hidden" />
        </label>
      </div>

      {progress !== null && (
        <div className="p-4 bg-[#131B2B] border border-orange-500/30 rounded-2xl space-y-2">
          <div className="flex justify-between text-xs font-bold text-slate-200">
            <span>Uploading to Cloudinary...</span>
            <span className="text-orange-400 font-mono">{progress}%</span>
          </div>
          <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
            <div className="bg-orange-500 h-full transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {error && <ErrorState message={error} onRetry={fetchMedia} />}

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search media files..."
          className="w-full pl-10 pr-3 py-1.5 bg-[#131B2B] border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none"
        />
      </div>

      {/* Media Grid */}
      {loading ? (
        <TableSkeleton rows={4} cols={4} />
      ) : filteredMedia.length === 0 ? (
        <EmptyState
          title="No media items found"
          message="Upload your first high-res product or banner image directly to Cloudinary."
        />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {filteredMedia.map((item, idx) => (
            <div
              key={item.publicId || idx}
              className="bg-[#131B2B] border border-slate-800 rounded-2xl overflow-hidden shadow-sm flex flex-col group hover:border-slate-700 transition-colors"
            >
              <div className="h-32 w-full bg-slate-900 overflow-hidden relative flex items-center justify-center">
                <img
                  src={item.url}
                  alt={item.publicId}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                />
                <span className="absolute bottom-2 right-2 text-[9px] font-mono px-1.5 py-0.5 rounded bg-black/80 text-white uppercase">
                  {item.format}
                </span>
              </div>

              <div className="p-3 flex flex-col justify-between flex-1 space-y-2">
                <p className="text-[11px] font-bold text-slate-200 truncate" title={item.publicId}>
                  {item.publicId?.split('/').pop() || 'media_asset'}
                </p>
                <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                  <span className="text-[10px] text-slate-500 font-mono">
                    {(item.bytes ? (item.bytes / 1024).toFixed(0) + ' KB' : '')}
                  </span>
                  <button
                    onClick={() => handleCopyUrl(item.url)}
                    className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                    title="Copy URL"
                  >
                    {copiedUrl === item.url ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
