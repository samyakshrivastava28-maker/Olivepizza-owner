import { Outlet, Link, useLocation, useNavigate } from 'react-router';
import { useAuthStore } from '../lib/store';
import { useState, useEffect, Suspense } from 'react';
import { db } from '../lib/firebase';
import { collection, query, orderBy, limit, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { PremiumBackground } from './ui/glass/PremiumBackground';
import { GlassPanel } from './ui/glass/GlassSystem';
import OwnerAlertManager from './owner/OwnerAlertManager';
import NewOrderEmergencyOverlay from './owner/NewOrderEmergencyOverlay';
import PixelSnow from './ui/PixelSnow';

export default function OwnerLayout() {
  const user = useAuthStore(state => state.user);
  const logout = useAuthStore(state => state.logout);
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [profilePic, setProfilePic] = useState('https://ui-avatars.com/api/?name=Owner&background=random');
  const [ownerName, setOwnerName] = useState(user?.name || 'Restaurant Owner');
  const [emergencyOrder, setEmergencyOrder] = useState<any | null>(null);

  useEffect(() => {
    // Attempt to load custom profile pic if available
    const fetchProfile = async () => {
      if (!user) return;
      try {
        const d = await getDoc(doc(db, 'users', user.uid));
        if (d.exists() && d.data().photoURL) {
          setProfilePic(d.data().photoURL);
        }
        if (d.exists() && d.data().name) {
          setOwnerName(d.data().name);
        }
      } catch (e) {}
    };
    fetchProfile();
  }, [user]);

  // Real-time listener for NEW incoming customer orders (triggers emergency overlay for pending orders only)
  useEffect(() => {
    let isInitial = true;
    const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'), limit(1));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (isInitial) {
        isInitial = false;
        return;
      }
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const newOrderData = { id: change.doc.id, ...change.doc.data() } as any;
          const status = (newOrderData.status || '').toLowerCase();
          if (['pending', 'placed', 'created', 'new_order'].includes(status)) {
            let isRecent = true;
            if (newOrderData.createdAt) {
              const cTime = typeof newOrderData.createdAt?.toDate === 'function'
                ? newOrderData.createdAt.toDate().getTime()
                : new Date(newOrderData.createdAt).getTime();
              if (!isNaN(cTime) && Date.now() - cTime > 5 * 60 * 1000) {
                isRecent = false;
              }
            }
            if (isRecent) {
              setEmergencyOrder(newOrderData);
            }
          }
        }
      });
    });
    return () => unsubscribe();
  }, []);

  const navLinks = [
    { name: 'Back to Home Page', path: '/', icon: '🏠' },
    { name: 'Dashboard', path: '/owner/dashboard', icon: '📊' },
    { name: 'Live Orders', path: '/owner/orders', icon: '⏳' },
    { name: 'Order History', path: '/owner/order-history', icon: '📚' },
    { name: 'Notifications', path: '/owner/notifications', icon: '🔔' },
    { name: 'Products', path: '/owner/products', icon: '🍕' },
    { name: 'Promotions & Ads', path: '/owner/ads', icon: '📢' },
    { name: 'Coupons', path: '/owner/coupons', icon: '🎟️' },
    { name: 'Media Library', path: '/owner/media', icon: '📁' },
    { name: 'Customers', path: '/owner/customers', icon: '👥' },
    { name: 'Delivery Partners', path: '/owner/partners', icon: '🛵' },
    { name: 'Reports', path: '/owner/reports', icon: '📑' },
    { name: 'Email Center', path: '/owner/email', icon: '✉️' },
    { name: 'Special Categories', path: '/owner/special-categories', icon: '🎪' },
    { name: 'Home Page Manager', path: '/owner/home-page-manager', icon: '🏠' },
    { name: 'Versions', path: '/owner/versions', icon: '🚀' },
    { name: 'AI Knowledge', path: '/owner/ai-knowledge', icon: '🧠' },
    { name: 'AI Monitor', path: '/owner/ai-monitor', icon: '🤖' },
    { name: 'Notification Diagnostics', path: '/owner/notification-diagnostics', icon: '📡' },
    { name: 'Verification Diagnostics', path: '/owner/verification-metrics', icon: '🛡️' },
    { name: 'Settings', path: '/owner/settings', icon: '⚙️' },
  ];

  return (
    <div className="dark min-h-[100dvh] flex font-sans relative w-full text-slate-200">
      <PremiumBackground />
      {/* Three.js PixelSnow is enabled on desktop only to avoid GPU bottlenecking on mobile devices */}
      <div className="fixed inset-0 z-0 pointer-events-none opacity-40 hidden md:block">
        <PixelSnow 
          color="#ffffff"
          flakeSize={0.01}
          minFlakeSize={1.25}
          pixelResolution={160}
          speed={1.0}
          density={0.2}
          direction={125}
          brightness={0.8}
        />
      </div>
      <OwnerAlertManager />
      <NewOrderEmergencyOverlay order={emergencyOrder} onClose={() => setEmergencyOrder(null)} />
      
      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden" onClick={() => setIsMobileMenuOpen(false)} />
      )}

      {/* Sidebar */}
      <GlassPanel className={`fixed md:sticky top-0 left-0 h-[100dvh] w-64 flex flex-col z-50 transform transition-transform duration-300 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className="p-5 flex items-center justify-between border-b border-white/10">
          <Link to="/" className="flex items-center gap-2.5 group">
            <img
              src="/logo-transparent.png"
              alt="Olive Pizza Logo"
              className="h-8 md:h-9 w-auto object-contain bg-transparent transition-transform duration-200 group-hover:scale-105"
            />
            <span className="text-lg md:text-xl font-black text-white tracking-tight group-hover:text-primary-400 transition-colors">
              Olive Pizza
            </span>
          </Link>
          <button 
            className="md:hidden text-slate-400 p-2 hover:text-white hover:bg-white/10 rounded-lg transition-colors" 
            onClick={() => setIsMobileMenuOpen(false)}
            aria-label="Close Menu"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {navLinks.map(link => {
            const isActive = location.pathname.startsWith(link.path);
            return (
              <Link 
                key={link.name} 
                to={link.path} 
                onClick={() => setIsMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 border ${isActive ? 'bg-primary-500/20 border-primary-500/50 shadow-[0_0_15px_rgba(249,115,22,0.15)] text-white font-black backdrop-blur-md' : 'border-transparent text-slate-400 font-bold hover:bg-white/5 hover:text-slate-200'}`}
              >
                <span className="text-xl opacity-90">{link.icon}</span>
                {link.name}
              </Link>
            )
          })}
        </nav>
      </GlassPanel>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 h-[100dvh] overflow-hidden relative z-10">
        
        {/* Top Navigation Bar */}
        <header className="h-20 bg-white/5 backdrop-blur-xl border-b border-white/10 flex items-center justify-between px-6 z-30 sticky top-0 shadow-[0_8px_40px_rgba(0,0,0,0.15)]">
          <div className="flex items-center gap-4">
            {/* 3-Lines Navigation Menu Button for Mobile */}
            <button 
              className="md:hidden p-2.5 rounded-xl bg-white/10 hover:bg-white/15 active:scale-95 text-white transition-all flex items-center justify-center border border-white/10 shadow-sm cursor-pointer" 
              onClick={() => setIsMobileMenuOpen(true)}
              aria-label="Open Navigation Menu"
            >
              <div className="flex flex-col gap-[3.5px] w-5 justify-center items-center">
                <span className="w-full h-[2.5px] bg-white rounded-full transition-all" />
                <span className="w-full h-[2.5px] bg-white rounded-full transition-all" />
                <span className="w-full h-[2.5px] bg-white rounded-full transition-all" />
              </div>
            </button>
            <div className="hidden sm:block">
              <h2 className="text-xl font-black text-white">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                <p className="text-xs font-bold text-green-400 uppercase tracking-wider">System Online</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">

            <div className="flex items-center gap-3 border-l border-white/10 pl-4">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-black text-white">{ownerName}</p>
                <p className="text-xs font-bold text-slate-400">Store Owner</p>
              </div>
              <img src={profilePic} alt="Owner" className="w-10 h-10 rounded-full border-2 border-primary-500 object-cover shadow-lg" />
              <button onClick={logout} className="ml-2 text-xs font-bold text-white bg-red-500 hover:bg-red-600 px-4 py-2 rounded-xl transition-all shadow-lg shadow-red-500/20">Logout</button>
            </div>
          </div>
        </header>

        {/* Scrollable Page Content */}
        <div 
          className="flex-1 overflow-y-auto flex flex-col will-change-scroll"
          style={{ WebkitOverflowScrolling: 'touch', transform: 'translateZ(0)' }}
        >
          <div className={`flex-1 ${
            location.pathname === '/owner/dashboard'
              ? 'p-4 md:p-8'
              : location.pathname.startsWith('/owner/home-page-manager')
                ? 'p-2 md:p-4 relative z-10'
                : 'p-4 md:p-8 bg-[#1E293B] border border-white/10 rounded-tl-[40px] shadow-[0_0_50px_rgba(0,0,0,0.5)] m-4 md:m-6 relative z-10'
          }`}>
            <Suspense fallback={
              <div className="w-full h-full flex flex-col items-center justify-center min-h-[400px]">
                <div className="w-10 h-10 border-4 border-dark-800 border-t-primary-500 rounded-full animate-spin" />
              </div>
            }>
              <Outlet />
            </Suspense>
          </div>
          
          <footer className="w-full text-center py-6 mt-8 text-xs font-medium text-slate-500 border-t border-slate-200 dark:border-slate-800">
            A Premium Website By <a href="https://28webhub.netlify.app" target="_blank" rel="noopener noreferrer" className="text-primary-500 hover:text-primary-600 hover:underline transition-colors">S-Web Hub</a>
          </footer>
        </div>

      </main>
    </div>
  );
}

