import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { Phone, CheckCircle, Smartphone, AlertTriangle, Activity } from 'lucide-react';
import toast from 'react-hot-toast';

export default function OwnerVerificationMetrics() {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({
    totalVerifications: 0,
    truecallerCount: 0,
    fast2smsCount: 0,
  });
  
  const [recentVerifications, setRecentVerifications] = useState<any[]>([]);

  useEffect(() => {
    fetchMetrics();
  }, []);

  const fetchMetrics = async () => {
    try {
      // For a real production app, we would query the backend for aggregated metrics.
      // For this dashboard, we can query recent users who have phoneVerified = true.
      const usersRef = collection(db, 'users');
      const q = query(usersRef, orderBy('verifiedAt', 'desc'), limit(100));
      const snapshot = await getDocs(q);
      
      let truecaller = 0;
      let fast2sms = 0;
      const recent: any[] = [];
      
      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.phoneVerified) {
          if (data.verificationMethod === 'truecaller') truecaller++;
          else fast2sms++;
          
          recent.push({
            id: doc.id,
            name: data.name,
            phone: data.phone,
            method: data.verificationMethod || 'unknown',
            date: data.verifiedAt ? new Date(data.verifiedAt).toLocaleString() : 'N/A'
          });
        }
      });
      
      setMetrics({
        totalVerifications: truecaller + fast2sms,
        truecallerCount: truecaller,
        fast2smsCount: fast2sms
      });
      
      setRecentVerifications(recent);
    } catch (error) {
      console.error(error);
      toast.error('Failed to load verification metrics');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-orange-500" />
            Verification Diagnostics
          </h1>
          <p className="text-slate-500 dark:text-slate-400">Monitor Truecaller and Fast2SMS verification health</p>
        </div>
        <button onClick={fetchMetrics} className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition">
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center gap-4">
          <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/20 rounded-full flex items-center justify-center text-orange-500">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400">Total Verifications</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{metrics.totalVerifications}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center text-blue-500">
            <Smartphone className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400">Truecaller Native</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{metrics.truecallerCount}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center gap-4">
          <div className="w-12 h-12 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center text-green-500">
            <Phone className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400">Fast2SMS OTP</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{metrics.fast2smsCount}</p>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Recent Verifications</h2>
        </div>
        
        {loading ? (
          <div className="p-8 text-center text-slate-500">Loading metrics...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50">
                  <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">User</th>
                  <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Phone</th>
                  <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Method</th>
                  <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {recentVerifications.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                    <td className="px-6 py-4 text-sm text-slate-900 dark:text-white font-medium">{v.name || 'Unknown'}</td>
                    <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">{v.phone}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        v.method === 'truecaller' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                      }`}>
                        {v.method}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">{v.date}</td>
                  </tr>
                ))}
                {recentVerifications.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-slate-500">No recent verifications found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// Add ShieldCheck icon since it's used
function ShieldCheck(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/>
      <path d="m9 12 2 2 4-4"/>
    </svg>
  )
}
