import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  getCountFromServer,
} from 'firebase/firestore';
import { ShieldAlert, UserX, AlertTriangle, Key, Phone, Ticket } from 'lucide-react';

export default function OwnerSecurity() {
  const [logs, setLogs] = useState<any[]>([]);
  const [verifiedPhones, setVerifiedPhones] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, "security_logs"),
      orderBy("timestamp", "desc"),
      limit(50),
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setLogs(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });

    const fetchVerifiedCount = async () => {
      try {
        const snap = await getCountFromServer(collection(db, "customer_identities"));
        setVerifiedPhones(snap.data().count);
      } catch (e) {}
    };
    fetchVerifiedCount();

    return () => unsubscribe();
  }, []);

  if (loading)
    return (
      <div className="p-8 text-center animate-pulse text-slate-400 font-bold">
        Loading Security Logs...
      </div>
    );

  const duplicatePhones = logs.filter(l => l.action === "duplicate_phone_attempt").length;
  const couponAbuse = logs.filter(l => l.action === "coupon_abuse_attempt").length;
  const invalidRoles = logs.filter((l) => l.role !== "owner" && l.role !== "admin" && l.action.includes("owner")).length;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 bg-red-500/20 rounded-xl flex items-center justify-center text-red-500">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-3xl font-black text-white">Security Center</h1>
          <p className="text-slate-400 font-bold">
            Monitor unauthorized access attempts, fraud, and API violations.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-dark-900 border border-dark-800 p-6 rounded-2xl">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-slate-400 font-bold text-sm">Total Violations</h3>
            <AlertTriangle className="w-5 h-5 text-orange-500" />
          </div>
          <p className="text-3xl font-black text-white">{logs.length}</p>
        </div>
        <div className="bg-dark-900 border border-dark-800 p-6 rounded-2xl">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-slate-400 font-bold text-sm">Verified Phones</h3>
            <Phone className="w-5 h-5 text-green-500" />
          </div>
          <p className="text-3xl font-black text-white">{verifiedPhones}</p>
        </div>
        <div className="bg-dark-900 border border-dark-800 p-6 rounded-2xl">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-slate-400 font-bold text-sm">Duplicate Phones</h3>
            <UserX className="w-5 h-5 text-red-500" />
          </div>
          <p className="text-3xl font-black text-white">{duplicatePhones}</p>
        </div>
        <div className="bg-dark-900 border border-dark-800 p-6 rounded-2xl">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-slate-400 font-bold text-sm">Coupon Abuse</h3>
            <Ticket className="w-5 h-5 text-purple-500" />
          </div>
          <p className="text-3xl font-black text-white">{couponAbuse}</p>
        </div>
      </div>

      <div className="bg-dark-900 border border-dark-800 rounded-3xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-dark-800 text-slate-400 font-bold text-sm uppercase tracking-wider">
              <tr>
                <th className="p-4">Timestamp</th>
                <th className="p-4">Action</th>
                <th className="p-4">User Details</th>
                <th className="p-4">Route / Location</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-800">
              {logs.map((log) => (
                <tr
                  key={log.id}
                  className="hover:bg-dark-800/50 transition-colors"
                >
                  <td className="p-4 text-sm text-slate-300">
                    {new Date(log.timestamp).toLocaleString()}
                  </td>
                  <td className="p-4">
                    <span className="bg-red-500/10 text-red-400 border border-red-500/20 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">
                      {log.action.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="p-4 text-sm text-slate-300">
                    <p className="font-bold">{log.email || "Unknown User"}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      UID: {log.uid || "N/A"} • Role: {log.role || "Guest"}
                    </p>
                    {log.details && (
                       <p className="text-[10px] text-amber-400/80 mt-1">{log.details}</p>
                    )}
                  </td>
                  <td className="p-4 text-sm font-mono text-slate-400">
                    {log.route || log.path || "N/A"}
                  </td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="p-8 text-center text-slate-400 font-bold"
                  >
                    No security events logged.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
