import { useEffect, useState } from 'react';
import { auth, db } from '../../../lib/firebase';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { Laptop, Smartphone, Monitor, Globe, ShieldAlert, LogOut, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface Session {
  id: string;
  deviceId: string;
  deviceName: string;
  browser: string;
  os: string;
  lastActive: number;
  createdAt: number;
  isActive: boolean;
  isPWA: boolean;
}

export default function MyDevices() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revokingAll, setRevokingAll] = useState(false);
  const [currentDeviceId, setCurrentDeviceId] = useState<string>("");

  useEffect(() => {
    setCurrentDeviceId(localStorage.getItem('device_fingerprint') || '');
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    if (!auth.currentUser) return;
    try {
      const q = query(
        collection(db, "device_heartbeats"),
        where("uid", "==", auth.currentUser.uid),
        where("isActive", "==", true)
      );
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Session));
      setSessions(data.sort((a, b) => b.lastActive - a.lastActive));
    } catch (e) {
      console.error("Failed to fetch sessions", e);
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async (sessionId: string) => {
    setRevokingId(sessionId);
    try {
      await updateDoc(doc(db, "device_heartbeats", sessionId), {
        isActive: false
      });
      toast.success("Device logged out successfully");
      fetchSessions();
    } catch (e) {
      toast.error("Failed to log out device");
    } finally {
      setRevokingId(null);
    }
  };

  const handleRevokeAll = async () => {
    if (!window.confirm("Are you sure you want to log out from ALL devices? This includes your current session.")) return;
    setRevokingAll(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/user/revoke-all-sessions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!res.ok) throw new Error("Failed to revoke");
      
      toast.success("All sessions revoked");
      // Current device will be logged out automatically via the hook or Firebase token expiry
    } catch (e) {
      toast.error("Failed to revoke sessions");
    } finally {
      setRevokingAll(false);
    }
  };

  const getDeviceIcon = (os: string) => {
    if (os.includes("iOS") || os.includes("Android")) return <Smartphone className="w-6 h-6" />;
    if (os.includes("Mac") || os.includes("Windows") || os.includes("Linux")) return <Laptop className="w-6 h-6" />;
    return <Monitor className="w-6 h-6" />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-white">My Devices</h2>
          <p className="text-slate-400 text-sm mt-1">Manage your active sessions across all devices.</p>
        </div>
        <button
          onClick={handleRevokeAll}
          disabled={revokingAll}
          className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl font-bold transition-colors disabled:opacity-50"
        >
          {revokingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldAlert className="w-4 h-4" />}
          Log Out All Devices
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {sessions.map((session) => {
          const isCurrent = session.deviceId === currentDeviceId;
          
          return (
            <div key={session.id} className={`p-5 rounded-2xl border ${isCurrent ? 'bg-primary-500/10 border-primary-500/30' : 'bg-dark-800/50 border-white/5'} flex flex-col md:flex-row justify-between items-start md:items-center gap-4`}>
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-xl ${isCurrent ? 'bg-primary-500/20 text-primary-400' : 'bg-white/5 text-slate-400'}`}>
                  {getDeviceIcon(session.os)}
                </div>
                <div>
                  <h3 className="font-bold text-white flex items-center gap-2">
                    {session.deviceName}
                    {isCurrent && <span className="bg-primary-500/20 text-primary-400 text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider">Current</span>}
                  </h3>
                  <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                    <span className="flex items-center gap-1"><Globe className="w-3 h-3" /> {session.browser} {session.isPWA ? '(App)' : ''}</span>
                    <span>•</span>
                    <span>Active {new Date(session.lastActive).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
              
              {!isCurrent && (
                <button
                  onClick={() => handleRevoke(session.id)}
                  disabled={revokingId === session.id}
                  className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 text-slate-300 rounded-lg text-sm font-bold transition-colors w-full md:w-auto justify-center"
                >
                  {revokingId === session.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
                  Log Out
                </button>
              )}
            </div>
          );
        })}

        {sessions.length === 0 && (
          <div className="text-center py-10 bg-dark-800/30 rounded-2xl border border-white/5">
            <ShieldAlert className="w-12 h-12 text-slate-500 mx-auto mb-3" />
            <p className="text-slate-400 font-bold">No active sessions found.</p>
          </div>
        )}
      </div>
    </div>
  );
}
