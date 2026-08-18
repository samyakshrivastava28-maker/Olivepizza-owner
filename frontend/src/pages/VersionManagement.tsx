import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { GitBranch, Save, Smartphone, Globe } from 'lucide-react';
import toast from 'react-hot-toast';

export default function VersionManagement() {
  const [minVersion, setMinVersion] = useState('1.0.0');
  const [currentVersion, setCurrentVersion] = useState('1.0.0');
  const [forceUpdate, setForceUpdate] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchVersion = async () => {
      try {
        const snap = await getDoc(doc(db, 'app_version', 'current'));
        if (snap.exists()) {
          const d = snap.data();
          setMinVersion(d.minVersion || '1.0.0');
          setCurrentVersion(d.currentVersion || '1.0.0');
          setForceUpdate(!!d.forceUpdate);
        }
      } catch (e) {
        console.warn(e);
      }
    };
    fetchVersion();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await setDoc(doc(db, 'app_version', 'current'), {
        minVersion,
        currentVersion,
        forceUpdate,
        updatedAt: new Date().toISOString(),
      });
      toast.success('App version constraints published.');
    } catch (e: any) {
      toast.error('Save failed: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl sm:text-2xl font-black text-white">App Version Management</h2>
        <p className="text-xs text-slate-400">Configure minimum required PWA and Android APK build versions.</p>
      </div>

      <div className="bg-[#131B2B] border border-slate-800 rounded-2xl p-6 max-w-lg">
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-300 uppercase block mb-1">Current Production Version</label>
            <input
              type="text"
              value={currentVersion}
              onChange={(e) => setCurrentVersion(e.target.value)}
              className="w-full p-2.5 bg-[#0E1524] border border-slate-800 rounded-xl text-xs text-white font-mono focus:border-orange-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-300 uppercase block mb-1">Minimum Required Version</label>
            <input
              type="text"
              value={minVersion}
              onChange={(e) => setMinVersion(e.target.value)}
              className="w-full p-2.5 bg-[#0E1524] border border-slate-800 rounded-xl text-xs text-white font-mono focus:border-orange-500 focus:outline-none"
            />
          </div>

          <label className="flex items-center gap-2 text-xs text-slate-300 font-bold cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={forceUpdate}
              onChange={(e) => setForceUpdate(e.target.checked)}
              className="rounded text-orange-500 focus:ring-0"
            />
            Enforce Hard Update (blocks legacy clients)
          </label>

          <button
            type="submit"
            disabled={saving}
            className="w-full py-2.5 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-xl text-xs transition-colors shadow-lg shadow-orange-600/20 disabled:opacity-50"
          >
            {saving ? 'Publishing...' : 'Save Version Settings'}
          </button>
        </form>
      </div>
    </div>
  );
}
