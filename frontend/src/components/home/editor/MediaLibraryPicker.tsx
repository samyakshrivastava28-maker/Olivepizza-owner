import React, { useState, useEffect, useRef } from 'react';
import { X, Upload, Search, Image as ImageIcon, Video, Loader2, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';

interface MediaLibraryPickerProps {
  onSelect: (url: string) => void;
  onClose: () => void;
  title?: string;
}

export default function MediaLibraryPicker({ onSelect, onClose, title = "Media Library" }: MediaLibraryPickerProps) {
  const [assets, setAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchAssets = async () => {
    setLoading(true);
    try {
      const { getCurrentAuthToken } = await import('../../../lib/firebase');
      const token = await getCurrentAuthToken().catch(() => '');

      const res = await fetch('/api/media-library/assets?folder=olive-pizza', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) setAssets(data.assets || []);
    } catch (e) {
      toast.error('Failed to load media');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAssets();
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      // 1. Get Signature
      const { getCurrentAuthToken } = await import('../../../lib/firebase');
      const token = await getCurrentAuthToken().catch(() => '');

      const sigRes = await fetch('/api/media/sign-upload?folder=olive-pizza/media', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const sigData = await sigRes.json();
      
      if (!sigData.signature || !sigData.cloudName) {
        throw new Error(sigData.error || 'Failed to get upload signature');
      }

      // 2. Upload directly to Cloudinary
      const formData = new FormData();
      formData.append('file', file);
      formData.append('api_key', sigData.apiKey);
      formData.append('timestamp', sigData.timestamp.toString());
      formData.append('signature', sigData.signature);
      formData.append('folder', sigData.folder);

      const isVideo = file.type.startsWith('video/') || file.name.match(/\.(mp4|mov|webm)$/i);
      const resourceType = isVideo ? 'video' : 'image';

      const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${sigData.cloudName}/${resourceType}/upload`, {
        method: 'POST',
        body: formData
      });
      
      const uploadData = await uploadRes.json();
      if (uploadData.secure_url) {
        toast.success(`${isVideo ? 'Video' : 'Image'} uploaded successfully!`);
        fetchAssets(); // Refresh list
        onSelect(uploadData.secure_url); // Auto select
      } else {
        throw new Error(uploadData.error?.message || 'Cloudinary upload failed');
      }
    } catch (err: any) {
      toast.error(err.message || 'Upload failed');
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const isVideoAsset = (asset: any) => {
    const format = asset.format?.toLowerCase() || '';
    const url = asset.url?.toLowerCase() || '';
    return format === 'mp4' || format === 'mov' || format === 'webm' || url.match(/\.(mp4|mov|webm)(\?.*)?$/);
  };

  const [typeFilter, setTypeFilter] = useState<'all' | 'image' | 'video'>('all');

  const filteredAssets = assets.filter(asset => {
    const isVid = isVideoAsset(asset);
    if (typeFilter === 'image' && isVid) return false;
    if (typeFilter === 'video' && !isVid) return false;
    if (!searchQuery) return true;
    const name = (asset.name || asset.id || '').toLowerCase();
    return name.includes(searchQuery.toLowerCase());
  });

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-[#0f172a] border border-white/10 rounded-3xl w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden shadow-2xl">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10 bg-[#0f172a]">
          <div>
            <h2 className="text-2xl font-black text-white flex items-center gap-2">
              <ImageIcon className="w-6 h-6 text-primary-500" />
              {title}
            </h2>
            <p className="text-xs text-slate-400 mt-1">Select an image or video to use in your layout</p>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="px-4 py-2.5 bg-primary-500 hover:bg-primary-400 text-white rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-primary-500/20 transition-all"
            >
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {uploading ? 'Uploading...' : 'Upload Image/Video'}
            </button>
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*,video/*" onChange={handleUpload} />
            
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
              <X className="w-6 h-6 text-slate-400" />
            </button>
          </div>
        </div>

        {/* Search & Tabs */}
        <div className="px-6 py-3 border-b border-white/5 bg-black/20 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search media by filename..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent text-sm text-white focus:outline-none placeholder-slate-500"
            />
          </div>

          <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/10">
            <button
              onClick={() => setTypeFilter('all')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                typeFilter === 'all' ? 'bg-primary-500 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              All ({assets.length})
            </button>
            <button
              onClick={() => setTypeFilter('image')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                typeFilter === 'image' ? 'bg-primary-500 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Images
            </button>
            <button
              onClick={() => setTypeFilter('video')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                typeFilter === 'video' ? 'bg-primary-500 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Videos
            </button>
          </div>
        </div>
        
        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          {loading ? (
            <div className="w-full h-full flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
              <span className="text-xs text-slate-400">Fetching media items...</span>
            </div>
          ) : filteredAssets.length === 0 ? (
            <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 gap-2">
              <ImageIcon className="w-16 h-16 opacity-40" />
              <p className="font-bold text-slate-400">No media assets found</p>
              <p className="text-xs text-slate-500">Upload your first image or video above!</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {filteredAssets.map((asset) => {
                const isVid = isVideoAsset(asset);
                return (
                  <div 
                    key={asset.id || asset.url} 
                    onClick={() => onSelect(asset.url)}
                    className="group relative aspect-square bg-black/60 rounded-xl overflow-hidden cursor-pointer border border-white/10 hover:border-primary-500 transition-all shadow-md"
                  >
                    {isVid ? (
                      <div className="w-full h-full relative bg-slate-950 flex items-center justify-center">
                        <video 
                          src={asset.url} 
                          className="w-full h-full object-cover" 
                          muted 
                          loop 
                          playsInline 
                          onMouseOver={(e) => (e.target as HTMLVideoElement).play().catch(() => {})}
                          onMouseLeave={(e) => (e.target as HTMLVideoElement).pause()}
                        />
                        <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-md p-1.5 rounded-lg border border-white/10 text-white">
                          <Video className="w-3.5 h-3.5 text-primary-400" />
                        </div>
                      </div>
                    ) : (
                      <img 
                        src={asset.thumbnailUrl || asset.url} 
                        alt={asset.name} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                      />
                    )}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-2 text-center">
                      <CheckCircle className="w-8 h-8 text-primary-500 mb-1 drop-shadow-lg" />
                      <span className="text-white text-xs font-bold truncate w-full px-1">{asset.name || 'Select'}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
