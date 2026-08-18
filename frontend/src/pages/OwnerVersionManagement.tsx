import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Rocket, AlertTriangle, CheckCircle, Smartphone, 
  Settings, RefreshCw, ChevronDown, DownloadCloud 
} from 'lucide-react';
import toast from 'react-hot-toast';
import OwnerAndroidBuilds from '../components/OwnerAndroidBuilds';

export default function OwnerVersionManagement() {
  const [settings, setSettings] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // New Version Form State
  const [newVersion, setNewVersion] = useState('');
  const [buildNumber, setBuildNumber] = useState('');
  const [releaseNotes, setReleaseNotes] = useState('');
  const [updateMode, setUpdateMode] = useState('optional');
  const [updateMinimum, setUpdateMinimum] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [settingsRes, historyRes] = await Promise.all([
        fetch('/api/version/settings').then(res => res.json()),
        fetch('/api/version/history').then(res => res.json())
      ]);
      setSettings(settingsRes);
      setHistory(historyRes);
    } catch (err) {
      toast.error('Failed to load version data');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/version/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          version_string: newVersion,
          build_number: parseInt(buildNumber),
          release_notes: releaseNotes,
          update_mode: updateMode,
          update_minimum: updateMinimum
        })
      });
      if (res.ok) {
        toast.success('Version published successfully!');
        setNewVersion('');
        setBuildNumber('');
        setReleaseNotes('');
        fetchData();
      } else {
        toast.error('Failed to publish version');
      }
    } catch (err) {
      toast.error('Error publishing version');
    }
  };

  const handleSettingsChange = async (key: string, value: any) => {
    try {
      const res = await fetch('/api/version/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: value })
      });
      if (res.ok) {
        toast.success('Settings updated');
        fetchData();
      } else {
        toast.error('Failed to update settings');
      }
    } catch (err) {
      toast.error('Error updating settings');
    }
  };

  if (isLoading) {
    return <div className="p-8 text-center text-slate-400">Loading version info...</div>;
  }

  return (
    <div className="p-6 sm:p-10 max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
          <Rocket className="w-8 h-8 text-orange-500" />
          Version & APK Management
        </h1>
        <p className="text-slate-400 mt-2">Manage PWA updates, force updates, and native Android builds.</p>
      </div>

      <OwnerAndroidBuilds />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Deployment Center */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-slate-800 rounded-3xl p-6 border border-slate-700/50 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
               <Rocket className="w-32 h-32 text-orange-500" />
            </div>
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2 relative z-10">
              <Settings className="w-5 h-5 text-orange-500" /> Deployment Center
            </h2>
            
            <div className="space-y-4 relative z-10">
              <div className="flex justify-between items-center pb-4 border-b border-slate-700/50">
                <span className="text-slate-400">Live Version</span>
                <span className="text-white font-mono font-bold bg-slate-900 px-3 py-1 rounded-lg">
                  v{settings?.latest_version}
                </span>
              </div>
              <div className="flex justify-between items-center pb-4 border-b border-slate-700/50">
                <span className="text-slate-400">Last Deployment</span>
                <span className="text-white font-mono font-bold">
                  {settings?.last_deployment_time ? new Date(settings.last_deployment_time).toLocaleString() : 'N/A'}
                </span>
              </div>
              <div className="pt-2">
                <label className="block text-sm text-slate-400 mb-2">Update Mode</label>
                <select 
                  className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-4 py-3 focus:border-orange-500 outline-none"
                  value={settings?.update_mode}
                  onChange={(e) => handleSettingsChange('update_mode', e.target.value)}
                >
                  <option value="optional">Optional (Banner)</option>
                  <option value="recommended">Recommended (Persistent Banner)</option>
                  <option value="required">Required (Force Update Screen)</option>
                </select>
              </div>
              <div className="pt-4 flex items-center justify-between">
                 <span className="text-slate-400">Maintenance Mode</span>
                 <button 
                    onClick={() => handleSettingsChange('maintenance_mode', !settings?.maintenance_mode)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings?.maintenance_mode ? 'bg-red-500' : 'bg-slate-600'}`}
                 >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings?.maintenance_mode ? 'translate-x-6' : 'translate-x-1'}`} />
                 </button>
              </div>

              <div className="pt-4 border-t border-slate-700/50">
                 <button 
                   onClick={async () => {
                     const toastId = toast.loading('Broadcasting critical update...');
                     try {
                        const res = await fetch('/api/admin/deploy', {
                           method: 'POST',
                           headers: { 'Content-Type': 'application/json' },
                           body: JSON.stringify({
                              version: settings?.latest_version,
                              mode: 'required'
                           })
                        });
                        if (res.ok) toast.success('Broadcast successful!', { id: toastId });
                        else toast.error('Broadcast failed', { id: toastId });
                     } catch (e) {
                        toast.error('Network error', { id: toastId });
                     }
                   }}
                   className="w-full py-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/30 font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
                 >
                   <AlertTriangle className="w-4 h-4" />
                   Force Critical Update Now
                 </button>
              </div>
            </div>
          </div>
        </div>

        {/* Publish Panel */}
        <div className="lg:col-span-2">
          <div className="bg-slate-800 rounded-3xl p-6 border border-slate-700/50 shadow-xl">
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <DownloadCloud className="w-5 h-5 text-orange-500" /> Publish New Version
            </h2>
            
            <form onSubmit={handlePublish} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Version String</label>
                  <input 
                    type="text" 
                    placeholder="e.g. 1.2.0"
                    required
                    value={newVersion}
                    onChange={(e) => setNewVersion(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-4 py-3 focus:border-orange-500 outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Build Number</label>
                  <input 
                    type="number" 
                    placeholder="e.g. 42"
                    required
                    value={buildNumber}
                    onChange={(e) => setBuildNumber(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-4 py-3 focus:border-orange-500 outline-none font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Release Notes</label>
                <textarea 
                  rows={4}
                  required
                  placeholder="Describe what's new in this version..."
                  value={releaseNotes}
                  onChange={(e) => setReleaseNotes(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-4 py-3 focus:border-orange-500 outline-none resize-none"
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-6">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-slate-400 mb-2">Default Update Mode</label>
                  <select 
                    value={updateMode}
                    onChange={(e) => setUpdateMode(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-4 py-3 focus:border-orange-500 outline-none"
                  >
                    <option value="optional">Optional</option>
                    <option value="recommended">Recommended</option>
                    <option value="required">Required (Force Update)</option>
                  </select>
                </div>
                
                <div className="flex-1 flex items-end pb-3">
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <div className={`w-6 h-6 rounded border flex items-center justify-center transition-colors ${updateMinimum ? 'bg-orange-500 border-orange-500' : 'bg-slate-900 border-slate-700 group-hover:border-slate-500'}`}>
                      {updateMinimum && <CheckCircle className="w-4 h-4 text-white" />}
                    </div>
                    <span className="text-slate-300 font-medium">Update Minimum Supported Version</span>
                  </label>
                </div>
              </div>

              <button 
                type="submit"
                className="w-full py-4 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-400 hover:to-red-500 text-white font-bold rounded-xl shadow-lg shadow-orange-500/25 transition-all flex justify-center items-center gap-2"
              >
                <Rocket className="w-5 h-5" />
                Publish Release
              </button>
            </form>
          </div>
        </div>

      </div>

      {/* Version History */}
      <div className="bg-slate-800 rounded-3xl p-6 border border-slate-700/50 shadow-xl overflow-hidden">
        <h2 className="text-xl font-bold text-white mb-6">Version History</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="pb-3 text-sm font-semibold text-slate-400">Version</th>
                <th className="pb-3 text-sm font-semibold text-slate-400">Build</th>
                <th className="pb-3 text-sm font-semibold text-slate-400">Date</th>
                <th className="pb-3 text-sm font-semibold text-slate-400">Notes</th>
                <th className="pb-3 text-sm font-semibold text-slate-400">Status</th>
              </tr>
            </thead>
            <tbody>
              {history.map((ver, i) => (
                <tr key={i} className="border-b border-slate-700/50 hover:bg-slate-700/20 transition-colors">
                  <td className="py-4 text-white font-mono font-bold">v{ver.version_string}</td>
                  <td className="py-4 text-slate-400">{ver.build_number}</td>
                  <td className="py-4 text-slate-400">{new Date(ver.created_at).toLocaleDateString()}</td>
                  <td className="py-4 text-slate-300 max-w-xs truncate" title={ver.release_notes}>{ver.release_notes}</td>
                  <td className="py-4">
                    <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                      {ver.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
