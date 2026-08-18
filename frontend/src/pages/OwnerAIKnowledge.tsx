import React, { useState, useEffect } from 'react';
import { Database, Search, Upload, RefreshCw, Trash2, CheckCircle2, XCircle, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '../lib/store';
import { auth } from '../lib/firebase';

export default function OwnerAIKnowledge() {
  const [health, setHealth] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Upload state
  const [file, setFile] = useState<File | null>(null);
  const [uploadCategory, setUploadCategory] = useState('Owner Document');
  const [isUploading, setIsUploading] = useState(false);

  // Sync state
  const [isSyncing, setIsSyncing] = useState(false);

  const fetchHealth = async () => {
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/ai/health', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setHealth(data.qdrant);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/ai/search', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ query: searchQuery, topK: 5 })
      });
      
      const data = await res.json();
      if (data.success) {
        setSearchResults(data.results);
      } else {
        toast.error(data.error || 'Search failed');
      }
    } catch (e) {
      toast.error('Search request failed');
    } finally {
      setIsSearching(false);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    
    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('category', uploadCategory);

    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/ai/index-file', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      
      const data = await res.json();
      if (data.success) {
        toast.success('Document indexed successfully!');
        setFile(null);
        fetchHealth(); // refresh stats
      } else {
        toast.error(data.error || 'Upload failed');
      }
    } catch (e) {
      toast.error('Upload request failed');
    } finally {
      setIsUploading(false);
    }
  };

  const handleReindex = async () => {
    if (!confirm('Are you sure you want to completely rebuild the Pinecone database from Firestore? This may take a moment.')) return;
    
    setIsSyncing(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/ai/reindex', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        fetchHealth(); // refresh stats
      } else {
        toast.error(data.error || 'Reindex failed');
      }
    } catch (e) {
      toast.error('Reindex request failed');
    } finally {
      setIsSyncing(false);
    }
  };

  if (isLoading) {
    return <div className="p-8 text-center text-white">Loading Pinecone Status...</div>;
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
            <Database className="text-orange-500" /> 
            AI Knowledge Base
          </h1>
          <p className="text-slate-400">Manage Pinecone Vector Embeddings and Semantic Search</p>
        </div>
        <button
          onClick={handleReindex}
          disabled={isSyncing}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-5 h-5 ${isSyncing ? 'animate-spin' : ''}`} />
          {isSyncing ? 'Syncing...' : 'Sync Firestore to Pinecone'}
        </button>
      </div>

      {/* System Health */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-slate-400 font-medium">Pinecone Status</h3>
            {health?.ok ? <CheckCircle2 className="text-emerald-500" /> : <XCircle className="text-red-500" />}
          </div>
          <p className="text-3xl font-bold text-white">{health?.ok ? 'Connected' : 'Offline'}</p>
        </div>
        <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-slate-400 font-medium">Collection Name</h3>
            <Database className="text-slate-500 w-5 h-5" />
          </div>
          <p className="text-3xl font-bold text-white">{health?.collection || 'N/A'}</p>
        </div>
        <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-slate-400 font-medium">Total Vectors (Chunks)</h3>
            <FileText className="text-slate-500 w-5 h-5" />
          </div>
          <p className="text-3xl font-bold text-white">{health?.vectorCount?.toLocaleString() || 0}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Upload Document */}
        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Upload className="w-5 h-5 text-orange-500" />
            Upload Knowledge Document
          </h2>
          <form onSubmit={handleUpload} className="space-y-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">File (PDF, DOCX, TXT)</label>
              <input 
                type="file" 
                accept=".pdf,.docx,.txt,.md"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Category</label>
              <select 
                value={uploadCategory}
                onChange={(e) => setUploadCategory(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white"
              >
                <option value="Owner Document">Owner Document</option>
                <option value="HR Policy">HR Policy</option>
                <option value="Training Manual">Training Manual</option>
                <option value="Marketing Material">Marketing Material</option>
              </select>
            </div>
            <button 
              type="submit" 
              disabled={!file || isUploading}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 rounded-xl transition-all disabled:opacity-50"
            >
              {isUploading ? 'Extracting & Indexing...' : 'Upload & Index to Pinecone'}
            </button>
          </form>
        </div>

        {/* Semantic Search Tester */}
        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 flex flex-col h-full">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Search className="w-5 h-5 text-orange-500" />
            Semantic Search Tester
          </h2>
          <form onSubmit={handleSearch} className="flex gap-2 mb-4">
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Ask a question about the restaurant..."
              className="flex-1 bg-slate-900 border border-slate-700 rounded-xl p-3 text-white"
            />
            <button 
              type="submit"
              disabled={isSearching}
              className="bg-slate-700 hover:bg-slate-600 text-white px-6 rounded-xl transition-all"
            >
              {isSearching ? '...' : 'Search'}
            </button>
          </form>
          
          <div className="flex-1 overflow-y-auto space-y-4 max-h-[400px] pr-2">
            {searchResults.length === 0 && !isSearching && (
              <div className="text-center text-slate-500 mt-10">No results. Try searching for something.</div>
            )}
            {searchResults.map((res, i) => (
              <div key={i} className="bg-slate-900 p-4 rounded-xl border border-slate-700">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-bold bg-orange-500/20 text-orange-400 px-2 py-1 rounded-md">
                    {res.metadata.category}
                  </span>
                  <span className="text-xs text-slate-500">Score: {(res.score * 100).toFixed(1)}%</span>
                </div>
                <p className="text-slate-300 text-sm whitespace-pre-wrap">{res.content}</p>
                <div className="mt-3 text-xs text-slate-500">Source: {res.metadata.source}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
