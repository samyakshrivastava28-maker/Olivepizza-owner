import React, { useState, useEffect } from 'react';
import { Play, Download, Clock, GitBranch, Terminal, RefreshCw, CheckCircle, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function OwnerAndroidBuilds() {
  const [status, setStatus] = useState<any>(null);
  const [release, setRelease] = useState<any>(null);
  const [isTriggering, setIsTriggering] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000); // Poll every 15 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const [statusRes, releaseRes] = await Promise.all([
        fetch('/api/github/build-status').then(r => r.json()),
        fetch('/api/github/latest-release').then(r => r.json())
      ]);
      
      if (!statusRes.error) setStatus(statusRes);
      if (!releaseRes.error) setRelease(releaseRes);
    } catch (error) {
      console.error('Failed to fetch build data', error);
    } finally {
      setIsLoading(false);
    }
  };

  const triggerBuild = async () => {
    setIsTriggering(true);
    const toastId = toast.loading('Triggering new APK build...');
    try {
      const res = await fetch('/api/github/build-apk', { method: 'POST' });
      const data = await res.json();
      
      if (res.ok) {
        toast.success('Build triggered successfully! It will appear shortly.', { id: toastId });
        setTimeout(fetchData, 5000); // Fetch again soon to see the new run
      } else {
        toast.error(data.details || 'Failed to trigger build (Make sure GITHUB_TOKEN is set in backend)', { id: toastId });
      }
    } catch (e) {
      toast.error('Network error triggering build', { id: toastId });
    } finally {
      setIsTriggering(false);
    }
  };

  const getStatusColor = (statusText: string, conclusion: string) => {
    if (statusText === 'in_progress' || statusText === 'queued') return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
    if (conclusion === 'success') return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
    if (conclusion === 'failure') return 'text-red-400 bg-red-500/10 border-red-500/20';
    return 'text-slate-400 bg-slate-500/10 border-slate-500/20';
  };

  const getStatusIcon = (statusText: string, conclusion: string) => {
    if (statusText === 'in_progress' || statusText === 'queued') return <RefreshCw className="w-4 h-4 animate-spin" />;
    if (conclusion === 'success') return <CheckCircle className="w-4 h-4" />;
    if (conclusion === 'failure') return <XCircle className="w-4 h-4" />;
    return <Clock className="w-4 h-4" />;
  };

  if (isLoading) return <div className="text-slate-400 text-center py-4">Loading build status...</div>;

  const isBuilding = status?.status === 'in_progress' || status?.status === 'queued';
  const apkSizeMB = release?.apk?.size ? (release.apk.size / (1024 * 1024)).toFixed(2) : null;

  return (
    <div className="bg-slate-800 rounded-3xl p-6 border border-slate-700/50 shadow-xl overflow-hidden relative">
      <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none">
        <Terminal className="w-48 h-48 text-emerald-500" />
      </div>

      <div className="flex justify-between items-start mb-6 relative z-10">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Terminal className="w-5 h-5 text-emerald-500" /> Android APK Build Pipeline
          </h2>
          <p className="text-slate-400 mt-1">Manage physical APK builds via GitHub Actions</p>
        </div>
        <button
          onClick={triggerBuild}
          disabled={isTriggering || isBuilding}
          className={`px-4 py-2 rounded-xl font-bold flex items-center gap-2 transition-all ${
            isBuilding || isTriggering 
              ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
              : 'bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg shadow-emerald-500/25'
          }`}
        >
          {isBuilding || isTriggering ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          {isBuilding ? 'Build in Progress...' : 'Retry Build APK'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
        {/* Live Build Status */}
        <div className="space-y-4 bg-slate-900/50 p-4 rounded-2xl border border-slate-700/50">
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-2">Live Build Status</h3>
          {status && status.status !== 'No builds found' ? (
            <div className="space-y-3">
              <div className="flex justify-between items-center pb-3 border-b border-slate-700/50">
                <span className="text-slate-400">Status</span>
                <span className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 ${getStatusColor(status.status, status.conclusion)}`}>
                  {getStatusIcon(status.status, status.conclusion)}
                  {status.status === 'completed' ? status.conclusion?.toUpperCase() : status.status?.toUpperCase()}
                </span>
              </div>
              <div className="flex justify-between items-center pb-3 border-b border-slate-700/50">
                <span className="text-slate-400">Build Number</span>
                <span className="text-white font-mono bg-slate-800 px-2 py-1 rounded">#{status.run_number}</span>
              </div>
              <div className="flex justify-between items-center pb-3 border-b border-slate-700/50">
                <span className="text-slate-400">Commit</span>
                <div className="flex items-center gap-2 text-white">
                  <GitBranch className="w-3 h-3 text-slate-400" />
                  <span className="font-mono text-xs">{status.head_sha?.substring(0, 7)}</span>
                </div>
              </div>
              <div className="flex justify-between items-center pb-3 border-b border-slate-700/50">
                <span className="text-slate-400">Message</span>
                <span className="text-slate-300 text-sm truncate max-w-[200px]" title={status.head_commit_message}>
                  {status.head_commit_message || 'N/A'}
                </span>
              </div>
              <div className="pt-2">
                <a 
                  href={status.html_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="w-full block text-center py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm rounded-lg border border-slate-700 transition-colors"
                >
                  View Full Build Logs
                </a>
              </div>
            </div>
          ) : (
            <p className="text-slate-500 italic text-sm">No recent builds found.</p>
          )}
        </div>

        {/* Latest Release Download */}
        <div className="space-y-4 bg-slate-900/50 p-4 rounded-2xl border border-slate-700/50">
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-2">Latest Available APK</h3>
          {release?.apk ? (
            <div className="space-y-3">
              <div className="flex justify-between items-center pb-3 border-b border-slate-700/50">
                <span className="text-slate-400">Version</span>
                <span className="text-white font-bold">{release.release.name}</span>
              </div>
              <div className="flex justify-between items-center pb-3 border-b border-slate-700/50">
                <span className="text-slate-400">APK Size</span>
                <span className="text-slate-300">{apkSizeMB} MB</span>
              </div>
              <div className="flex justify-between items-center pb-3 border-b border-slate-700/50">
                <span className="text-slate-400">Released</span>
                <span className="text-slate-300 text-sm">{new Date(release.release.published_at).toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center pb-3 border-b border-slate-700/50">
                <span className="text-slate-400">Downloads</span>
                <span className="text-slate-300">{release.apk.download_count}</span>
              </div>
              <div className="pt-2">
                <a 
                  href={release.apk.download_url}
                  className="w-full py-3 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/25 transition-all flex justify-center items-center gap-2"
                >
                  <Download className="w-5 h-5" /> Download APK
                </a>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-48 text-center">
              <Download className="w-12 h-12 text-slate-700 mb-2" />
              <p className="text-slate-500 text-sm">No APK release available yet.</p>
              <p className="text-slate-600 text-xs mt-1">Trigger a build to generate one.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
