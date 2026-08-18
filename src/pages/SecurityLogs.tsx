import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { TableSkeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { Lock, ShieldAlert, CheckCircle2 } from 'lucide-react';

export default function SecurityLogs() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const snap = await getDocs(query(collection(db, 'security_logs'), orderBy('timestamp', 'desc'), limit(100)));
        setLogs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch {
        setLogs([]);
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl sm:text-2xl font-black text-white">Security & Audit Logs</h2>
        <p className="text-xs text-slate-400">Monitor access control events, privileged actions, and security alerts.</p>
      </div>

      <div className="bg-[#131B2B] border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-5">
            <TableSkeleton rows={5} cols={4} />
          </div>
        ) : logs.length === 0 ? (
          <EmptyState
            title="No suspicious events detected"
            message="System is secure. All access requests are complying with RBAC rules."
            icon={ShieldAlert}
          />
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0E1524] text-slate-400 font-bold border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Event Action</th>
                <th className="py-3 px-4">Account / Email</th>
                <th className="py-3 px-4">Route</th>
                <th className="py-3 px-4 text-right">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium">
              {logs.map((l) => (
                <tr key={l.id} className="hover:bg-slate-800/40">
                  <td className="py-3 px-4 font-mono font-bold text-orange-400">{l.action}</td>
                  <td className="py-3 px-4 text-white">{l.email || l.uid || 'Anonymous'}</td>
                  <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">{l.route || '/'}</td>
                  <td className="py-3 px-4 text-right text-slate-500 font-mono">{new Date(l.timestamp).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
