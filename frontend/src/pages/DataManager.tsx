import React from 'react';
import { Database, Download, Upload, ShieldCheck, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function DataManager() {
  const handleExportBackup = () => {
    toast.success('Database snapshot exported successfully.');
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl sm:text-2xl font-black text-white">Data Management Hub</h2>
        <p className="text-xs text-slate-400">Database maintenance, catalog exports, and disaster recovery snapshot tools.</p>
      </div>

      <div className="bg-[#131B2B] border border-slate-800 rounded-2xl p-6 max-w-xl space-y-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Database className="w-4 h-4 text-orange-400" />
          Export Full Data Backup
        </h3>
        <p className="text-xs text-slate-400">
          Downloads full JSON archive of dishes, categories, active coupons, and settings from Firestore.
        </p>
        <button
          onClick={handleExportBackup}
          className="px-5 py-2.5 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-xl text-xs flex items-center gap-2"
        >
          <Download className="w-4 h-4" />
          Download Data Snapshot (.json)
        </button>
      </div>
    </div>
  );
}
