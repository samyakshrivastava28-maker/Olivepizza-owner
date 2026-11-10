import { Outlet, Link, Navigate, useLocation } from 'react-router';
import { useAuthStore } from '../lib/store';
import { db, auth } from '../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { useState, Suspense } from 'react';
import toast from 'react-hot-toast';
import { GlassPanel, GlassCard } from './ui/glass/GlassSystem';
import DeliveryAlertManager from './delivery/DeliveryAlertManager';
import Particles from './ui/Particles';
import { Home } from 'lucide-react';


export default function DeliveryLayout() {
  const user = useAuthStore(state => state.user);
  const role = useAuthStore(state => state.role);
  const isLoading = useAuthStore(state => state.isLoading);
  const location = useLocation();
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  if (isLoading) return <div className="h-screen flex items-center justify-center font-bold text-xl text-primary-500">Loading...</div>;

  if (!user || role !== 'delivery_partner') {
    return <Navigate to="/login" replace />;
  }

  // Guard for approval status
  if (user.approvalStatus !== 'approved') {
    return (
      <div className="min-h-[100dvh] relative flex flex-col items-center justify-center p-6 text-center w-full text-slate-200">
        <div className="fixed inset-0 z-0 pointer-events-none bg-dark-950">
          <Particles
            particleColors={["#ffffff", "#f97316", "#fb923c"]}
            particleCount={150}
            particleSpread={10}
            speed={0.1}
            particleBaseSize={100}
            moveParticlesOnHover={false}
            alphaParticles={false}
            disableRotation={false}
          />
        </div>
        <DeliveryAlertManager />
        <GlassCard className="p-8 max-w-md w-full z-10 flex flex-col items-center">
          <div className="text-6xl mb-6">â³</div>
          <h1 className="text-2xl font-black mb-2 text-white">Waiting for Approval</h1>
          <p className="text-white/60 font-medium mb-6">
            Your delivery partner account is currently <strong>{user.approvalStatus || 'pending'}</strong>. 
            Please wait for an administrator to approve your account before you can start delivering orders.
          </p>
          <button 
            onClick={() => window.location.reload()}
            className="w-full bg-primary-500/80 hover:bg-primary-500 border border-primary-400/50 shadow-[0_0_15px_rgba(249,115,22,0.3)] text-white py-3 rounded-xl font-bold transition-all hover:scale-105 active:scale-95"
          >
            Check Status Again
          </button>
          
          <Link to="/" className="w-full mt-4 bg-white/10 hover:bg-white/20 border border-white/20 text-white py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2">
            <Home className="w-5 h-5" /> Back to Homepage
          </Link>
        </GlassCard>
      </div>
    );
  }

  const handleStatusChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newStatus = e.target.value;
    setIsUpdatingStatus(true);
    try {
      await fetch(`/api/admin/users/${user.uid}/role`, { // Mock endpoint
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await auth.currentUser?.getIdToken()}` },
        body: JSON.stringify({ status: newStatus as 'online' | 'offline' | 'busy' | 'break' })
      });
      // Update the local auth store so the UI reflects the change immediately
      useAuthStore.getState().setUser({ ...user, status: newStatus as 'online' | 'offline' | 'busy' | 'break' }, role as any);
      toast.success(`Status updated to ${newStatus}`);
    } catch (err) {
      toast.error('Failed to update status');
      console.error(err);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const currentStatus = user.status || 'offline';

  return (
    <div className="min-h-[100dvh] flex flex-col relative w-full text-white">
      <div className="fixed inset-0 z-0 pointer-events-none bg-dark-950">
        <Particles
          particleColors={["#ffffff", "#f97316", "#fb923c"]}
          particleCount={150}
          particleSpread={10}
          speed={0.1}
          particleBaseSize={100}
          moveParticlesOnHover={false}
          alphaParticles={false}
          disableRotation={false}
        />
      </div>
      <DeliveryAlertManager />
      <header className="bg-white/5 backdrop-blur-xl border-b border-white/10 p-4 sticky top-0 z-50 flex items-center justify-between shadow-[0_8px_40px_rgba(0,0,0,0.15)]">
        <div className="flex justify-between items-center container mx-auto max-w-md w-full">
          <div className="flex items-center gap-3">
            <Link to="/" className="w-10 h-10 bg-white/10 hover:bg-primary-500 rounded-full flex items-center justify-center transition-colors shadow-sm border border-white/20">
              <Home className="w-5 h-5 text-white" />
            </Link>
            <img 
              src={user.photoUrl || `https://ui-avatars.com/api/?name=${user.name}&background=f97316&color=fff`} 
              alt={user.name} 
              className="w-10 h-10 rounded-full object-cover shadow-sm border border-white/20"
            />
            <div>
              <div className="font-bold text-sm leading-tight text-white">{user.name}</div>
              <div className="text-xs text-white/60">Delivery Partner</div>
            </div>
          </div>
          <div>
            <select 
              value={currentStatus}
              onChange={handleStatusChange}
              disabled={isUpdatingStatus}
              className={`text-sm font-bold px-3 py-1.5 rounded-full outline-none appearance-none cursor-pointer border ${
                currentStatus === 'online' ? 'bg-green-500/20 text-green-400 border-green-500/30' :
                currentStatus === 'busy' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' :
                currentStatus === 'break' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' :
                'bg-white/10 text-white/60 border-white/20'
              } backdrop-blur-md transition-colors shadow-lg`}
            >
              <option value="online">🟢 Online</option>
              <option value="busy">🟡 Busy</option>
              <option value="break">🔵 Break</option>
              <option value="offline">âšª Offline</option>
            </select>
          </div>
        </div>
      </header>
      
      <main className="flex-1 overflow-y-auto p-4 relative z-10">
        <div className="flex-1">
          <Suspense fallback={
            <div className="w-full h-full flex flex-col items-center justify-center min-h-[400px]">
              <div className="w-10 h-10 border-4 border-dark-800 border-t-primary-500 rounded-full animate-spin" />
            </div>
          }>
            <Outlet />
          </Suspense>
        </div>
        <div className="w-full text-center py-4 mt-8 text-[10px] font-medium text-slate-500 border-t border-slate-200 dark:border-slate-800">
          A Premium Website By <a href="https://28webhub.netlify.app" target="_blank" rel="noopener noreferrer" className="text-primary-500 hover:text-primary-600 hover:underline transition-colors">S-Web Hub</a>
        </div>
      </main>
      
      <nav className="bg-dark-950/80 backdrop-blur-xl border-t border-dark-800 p-2 fixed bottom-0 left-0 right-0 z-50 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.5)] pb-safe">
        <div className="flex justify-around items-center container mx-auto max-w-md">
          <Link 
            to="/delivery/dashboard" 
            className={`flex flex-col items-center p-2 transition-colors ${location.pathname === '/delivery/dashboard' ? 'text-primary-600' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <span className="text-2xl mb-1">🛵</span>
            <span className="text-[10px] font-bold uppercase tracking-wide">Tasks</span>
          </Link>
          <Link 
            to="/delivery/earnings" 
            className={`flex flex-col items-center p-2 transition-colors ${location.pathname === '/delivery/earnings' ? 'text-primary-600' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <span className="text-2xl mb-1">💰</span>
            <span className="text-[10px] font-bold uppercase tracking-wide">Earnings</span>
          </Link>
          <Link 
            to="/delivery/performance" 
            className={`flex flex-col items-center p-2 transition-colors ${location.pathname === '/delivery/performance' ? 'text-primary-600' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <span className="text-2xl mb-1">📈</span>
            <span className="text-[10px] font-bold uppercase tracking-wide">Stats</span>
          </Link>
          <Link 
            to="/delivery/profile" 
            className={`flex flex-col items-center p-2 transition-colors ${location.pathname === '/delivery/profile' ? 'text-primary-600' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <span className="text-2xl mb-1">👤</span>
            <span className="text-[10px] font-bold uppercase tracking-wide">Profile</span>
          </Link>
          <Link 
            to="/delivery/notifications" 
            className={`flex flex-col items-center p-2 transition-colors ${location.pathname === '/delivery/notifications' ? 'text-primary-600' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <span className="text-2xl mb-1">🔔</span>
            <span className="text-[10px] font-bold uppercase tracking-wide">Alerts</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}
