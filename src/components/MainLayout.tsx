import { Outlet, Link, useNavigate, useLocation } from 'react-router';
import { useAuthStore, useCartStore, useAppStore } from '../lib/store';
import { performUpdate } from '../lib/versionManager';
import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState, Suspense } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { Home, Menu as MenuIcon, ShoppingBag, User, Search, MapPin, ReceiptText, WifiOff, Download, RefreshCw, Bot, Bell } from 'lucide-react';

import PWAPrompts from './ui/PWAPrompts';
import { usePWA } from '../lib/usePWA';
import Aurora from './ui/Aurora';
import { prefetchRoute } from '../lib/prefetch';
import NotificationCenter from './ui/NotificationCenter';
import FloatingCart from './layout/FloatingCart';
import FloatingWaitingCard from './layout/FloatingWaitingCard';
import FloatingOrderTracker from './layout/FloatingOrderTracker';
import PizzaLoader from './ui/PizzaLoader';
import FlagshipFooter from './home/FlagshipFooter';

export default function MainLayout() {
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);
  const role = useAuthStore(state => state.role);
  const user = useAuthStore(state => state.user);
  const logout = useAuthStore(state => state.logout);
  const cartItems = useCartStore(state => state.items);
  const updateAvailable = useAppStore(state => state.updateAvailable);
  const navigate = useNavigate();
  const location = useLocation();
  const { isOffline, canInstall, installApp, isStandalone, hasInstalled } = usePWA();

  const cartCount = cartItems.reduce((acc, item) => acc + item.quantity, 0);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  useEffect(() => {
    if (user?.email === 'olivepizzarjn@gmail.com' && role !== 'owner') {
      const upgradeToOwner = async () => {
        try {
          const token = await auth.currentUser?.getIdToken();
          await fetch(`/api/admin/users/${user.uid}/role`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ role: 'owner' })
          });
          console.log('Successfully upgraded olivepizzarjn to owner!');
          useAuthStore.getState().setUser(user, 'owner');
        } catch (err) {
          console.error('Failed to make owner:', err);
        }
      };
      upgradeToOwner();
    }
  }, [user, role]);

  const [scrolled, setScrolled] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-dark-950 pb-[72px] md:pb-0">
      <NotificationCenter isOpen={notifOpen} onClose={() => setNotifOpen(false)} />
      <div className="fixed inset-0 z-0 pointer-events-none opacity-30">
        <Aurora 
          colorStops={["#749578", "#55775a", "#425e47"]}
          amplitude={1.2}
          blend={0.5}
        />
      </div>
      <PWAPrompts />
      
      {/* Premium Floating Components */}
      {(() => {
        const p = location.pathname;
        const hideCart = [
          '/cart',
          '/checkout',
          '/order-tracking',
          '/tracking',
          '/track',
          '/order-success',
          '/recheck-order',
          '/processing-order',
          '/order/',
          '/orders/',
          '/order-details',
          '/owner',
          '/delivery'
        ].some(prefix => p === prefix || p.startsWith(prefix));

        if (hideCart) return null;

        return (
          <>
            <FloatingCart />
            <FloatingWaitingCard />
            <FloatingOrderTracker />
          </>
        );
      })()}
      
      <AnimatePresence>
        {isOffline && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-red-500 text-white font-bold text-center py-2 px-4 shadow-md flex items-center justify-center gap-2 sticky top-0 z-[60]"
          >
            <WifiOff className="w-4 h-4" />
            Offline Mode - Viewing cached menu
          </motion.div>
        )}
      </AnimatePresence>

      {/* â”€â”€â”€ Premium Floating Glass Navbar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <motion.header
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="fixed top-0 left-0 right-0 z-50 px-3 md:px-6 pt-3"
      >
        <div
          className="mx-auto max-w-7xl rounded-2xl transition-all duration-500"
          style={{
            background: scrolled
              ? "rgba(10,10,10,0.85)"
              : "rgba(10,10,10,0.45)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            border: scrolled
              ? "1px solid rgba(255,255,255,0.08)"
              : "1px solid rgba(255,255,255,0.06)",
            boxShadow: scrolled
              ? "0 8px 40px rgba(0,0,0,0.5), 0 1px 0 rgba(255,255,255,0.05)"
              : "0 4px 20px rgba(0,0,0,0.2)",
          }}
        >
          <div className="h-14 md:h-16 flex items-center justify-between px-4 md:px-6">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2.5 group">
              <img
                src="/logo-transparent.png"
                alt="Olive Pizza Logo"
                className="h-8 md:h-10 w-auto object-contain bg-transparent transition-transform duration-200 group-hover:scale-105"
              />
              <span className="text-lg md:text-xl font-black tracking-tight hidden sm:block text-white group-hover:text-orange-400 transition-colors duration-200">
                Olive Pizza
              </span>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex gap-1 items-center">
              {isAuthenticated && user?.fullAddress && (
                <div className="flex items-center gap-2 text-xs text-slate-300 max-w-[180px] px-3 py-1.5 rounded-full mr-2"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <MapPin className="w-3 h-3 text-orange-400 shrink-0" />
                  <span className="truncate">{user.fullAddress}</span>
                </div>
              )}

              {[
                { label: "Home", path: "/" },
                { label: "Menu", path: "/menu" },
                { label: "Contact", path: "/contact" },
              ].map(({ label, path }) => {
                const isActive = location.pathname === path;
                return (
                  <Link
                    key={path}
                    to={path}
                    onMouseEnter={() => prefetchRoute(path)}
                    className="relative px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 group"
                    style={{ color: isActive ? "#fb923c" : "rgba(226,232,240,0.85)" }}
                  >
                    {isActive && (
                      <motion.span
                        layoutId="nav-pill"
                        className="absolute inset-0 rounded-xl"
                        style={{ background: "rgba(249,115,22,0.12)", border: "1px solid rgba(249,115,22,0.2)" }}
                        transition={{ type: "spring", stiffness: 400, damping: 35 }}
                      />
                    )}
                    <span className="relative group-hover:text-white transition-colors duration-200">{label}</span>
                  </Link>
                );
              })}

              {isAuthenticated && role === 'owner' && (
                <Link to="/owner/dashboard" onMouseEnter={() => prefetchRoute('/owner/dashboard')}
                  className="px-4 py-2 rounded-xl text-sm font-bold text-yellow-400 hover:text-yellow-300 hover:bg-yellow-400/10 transition-all duration-200">
                  Owner Panel
                </Link>
              )}
              {isAuthenticated && role === 'delivery_partner' && (
                <Link to="/delivery/dashboard" onMouseEnter={() => prefetchRoute('/delivery/dashboard')}
                  className="px-4 py-2 rounded-xl text-sm font-bold text-orange-400 hover:text-orange-300 hover:bg-orange-400/10 transition-all duration-200">
                  Delivery Panel
                </Link>
              )}
              {isAuthenticated && (!role || role === 'customer') && (
                <Link to="/dashboard" onMouseEnter={() => prefetchRoute('/dashboard')}
                  className="px-4 py-2 rounded-xl text-sm font-bold text-emerald-400 hover:text-emerald-300 hover:bg-emerald-400/10 transition-all duration-200">
                  Dashboard
                </Link>
              )}

              {/* Cart */}
              <Link
                to="/cart"
                onMouseEnter={() => prefetchRoute('/cart')}
                className="relative p-2.5 rounded-xl hover:bg-white/8 transition-all duration-200 ml-1"
                style={{ color: "rgba(226,232,240,0.85)" }}
              >
                <ShoppingBag className="w-5 h-5" />
                <AnimatePresence>
                  {cartCount > 0 && (
                    <motion.span
                      key={cartCount}
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.5, opacity: 0 }}
                      className="absolute -top-0.5 -right-0.5 text-white text-[10px] font-black w-4 h-4 flex items-center justify-center rounded-full"
                      style={{ background: "linear-gradient(135deg, #ea580c, #f97316)" }}
                    >
                      {cartCount}
                    </motion.span>
                  )}
                </AnimatePresence>
              </Link>

              {/* Developer Dashboard 3-Lines Button (webhub2811@gmail.com account strictly) */}
              {user?.email?.toLowerCase() === 'webhub2811@gmail.com' && (
                <Link
                  to="/developer"
                  title="Developer Operations & Control Center"
                  className="p-2.5 rounded-xl bg-primary-500/15 border border-primary-500/35 text-primary-400 hover:bg-primary-500/25 hover:text-primary-300 transition-all duration-200 flex items-center justify-center gap-1.5 ml-1 shadow-[0_0_15px_rgba(249,115,22,0.2)]"
                >
                  <div className="flex flex-col gap-[3px] w-4 justify-center items-center">
                    <span className="w-full h-[2px] bg-current rounded-full" />
                    <span className="w-full h-[2px] bg-current rounded-full" />
                    <span className="w-full h-[2px] bg-current rounded-full" />
                  </div>
                  <span className="text-xs font-bold hidden xl:inline">Dev Ops</span>
                </Link>
              )}

              {/* Notification Center Bell */}
              {isAuthenticated && (
                <button
                  onClick={() => setNotifOpen(true)}
                  className="relative p-2.5 rounded-xl hover:bg-white/8 transition-all duration-200 ml-1"
                  style={{ color: 'rgba(226,232,240,0.85)' }}
                  title="Notifications"
                >
                  <Bell className="w-5 h-5" />
                </button>
              )}


              {updateAvailable && (
                <button onClick={performUpdate}
                  className="ml-2 px-4 py-2 rounded-xl text-sm font-bold text-white bg-green-600 hover:bg-green-500 transition-all flex items-center gap-2 animate-pulse">
                  <RefreshCw className="w-3.5 h-3.5" /> Update
                </button>
              )}
              {!isStandalone && canInstall && !updateAvailable && (
                <button onClick={installApp}
                  className="ml-2 px-4 py-2 rounded-xl text-sm font-bold text-orange-400 border border-orange-400/30 hover:bg-orange-400/10 transition-all flex items-center gap-2">
                  <Download className="w-3.5 h-3.5" /> Install App
                </button>
              )}

              {/* Auth */}
              {isAuthenticated ? (
                <div className="flex items-center gap-3 ml-2">
                  <span className="text-sm font-bold text-white hidden lg:block">
                    {user?.name?.split(' ')[0] || 'User'}
                  </span>
                  <button
                    onClick={handleLogout}
                    className="px-4 py-2 rounded-xl text-sm font-medium text-slate-300 hover:text-white hover:bg-white/8 transition-all border border-white/8"
                  >
                    Sign Out
                  </button>
                </div>
              ) : (
                <Link
                  to="/login"
                  className="ml-2 px-5 py-2 rounded-xl text-sm font-bold text-white transition-all duration-200 hover:-translate-y-0.5"
                  style={{
                    background: "linear-gradient(135deg, #ea580c 0%, #f97316 100%)",
                    boxShadow: "0 4px 16px rgba(249,115,22,0.35)",
                  }}
                >
                  Sign In
                </Link>
              )}
            </nav>

            {/* Mobile Header Actions */}
            <div className="flex md:hidden items-center gap-2">
              {updateAvailable && (
                <button onClick={performUpdate}
                  className="bg-green-600 text-white px-3 py-1.5 rounded-full text-[10px] font-bold flex items-center gap-1 animate-pulse">
                  <RefreshCw className="w-3 h-3" /> Update
                </button>
              )}
              {!isStandalone && canInstall && !updateAvailable && (
                <button onClick={installApp}
                  className="text-orange-400 border border-orange-400/30 px-3 py-1.5 rounded-full text-[10px] font-bold flex items-center gap-1">
                  <Download className="w-3 h-3" /> Install
                </button>
              )}
              {/* Mobile 3-Lines Developer Dashboard Button (webhub2811@gmail.com strictly) */}
              {user?.email?.toLowerCase() === 'webhub2811@gmail.com' && (
                <Link
                  to="/developer"
                  title="Developer Operations Center"
                  className="p-2 rounded-lg bg-primary-500/20 border border-primary-500/40 text-primary-400 flex items-center justify-center shadow-[0_0_10px_rgba(249,115,22,0.3)]"
                >
                  <div className="flex flex-col gap-[2.5px] w-3.5 justify-center items-center">
                    <span className="w-full h-[2px] bg-current rounded-full" />
                    <span className="w-full h-[2px] bg-current rounded-full" />
                    <span className="w-full h-[2px] bg-current rounded-full" />
                  </div>
                </Link>
              )}

              <Link to="/menu?search=1" className="p-2 text-slate-300 hover:text-white transition-colors">
                <Search className="w-5 h-5" />
              </Link>
              {isAuthenticated ? (
                <Link to="/dashboard"
                  className="w-8 h-8 rounded-full overflow-hidden border border-white/15 flex items-center justify-center"
                  style={{ background: "rgba(255,255,255,0.08)" }}>
                  {user?.photoURL
                    ? <img src={user.photoURL} alt="Profile" className="w-full h-full object-cover" />
                    : <User className="w-4 h-4 text-slate-300" />}
                </Link>
              ) : (
                <Link to="/login"
                  className="px-4 py-1.5 rounded-full text-xs font-bold text-white"
                  style={{ background: "linear-gradient(135deg, #ea580c, #f97316)" }}>
                  Sign In
                </Link>
              )}
            </div>
          </div>
        </div>
      </motion.header>

      
      <main className={`flex-1 w-full ${location.pathname === '/' ? '' : 'max-w-7xl mx-auto pt-24 md:pt-24 py-2 md:py-8'}`}>
        <Suspense fallback={
          <PizzaLoader />
        }>
          <Outlet />
        </Suspense>
      </main>

      {/* â”€â”€â”€ Premium Floating Glass Bottom Nav (Mobile) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <nav
        className="md:hidden fixed bottom-3 left-3 right-3 z-[70] rounded-2xl flex items-center justify-between px-2"
        style={{
          background: "rgba(10,10,10,0.88)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 -4px 24px rgba(0,0,0,0.5), 0 8px 32px rgba(0,0,0,0.4)",
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 4px)',
          paddingTop: '4px',
        }}
      >
        {[
          { name: 'Home', path: '/', icon: <Home className="w-5 h-5" /> },
          { name: 'Menu', path: '/menu', icon: <MenuIcon className="w-5 h-5" /> },
          { name: 'AI', path: '/assistant', icon: <Bot className="w-5 h-5" /> },
          { name: 'Cart', path: '/cart', icon: <ShoppingBag className="w-5 h-5" />, badge: cartCount },
          { name: 'Profile', path: isAuthenticated ? '/dashboard' : '/login', icon: <User className="w-5 h-5" /> },
        ].map((item) => {
          const isActive = location.pathname === item.path || (item.path === '/assistant' && location.pathname.startsWith('/assistant')) || (item.path === '/dashboard' && location.pathname.startsWith('/dashboard'));
          return (
            <Link
              key={item.name}
              to={item.path}
              onTouchStart={() => prefetchRoute(item.path)}
              id={item.name === 'Cart' ? 'mobile-cart-nav-target' : undefined}
              className="flex flex-col items-center justify-center w-full min-h-[56px] relative group touch-manipulation"
            >
              {isActive && (
                <motion.div
                  layoutId="premium-mobile-nav-pill"
                  className="absolute inset-0 rounded-xl"
                  style={{ background: "rgba(249,115,22,0.12)", border: "1px solid rgba(249,115,22,0.18)" }}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
              <div
                className="relative transition-all duration-200"
                style={{ color: isActive ? '#fb923c' : 'rgba(148,163,184,0.8)' }}
              >
                {item.icon}
                {item.badge ? (
                  <span
                    className="absolute -top-1.5 -right-2 text-white text-[10px] font-black min-w-[17px] h-[17px] px-1 flex items-center justify-center rounded-full"
                    style={{ background: "linear-gradient(135deg, #ea580c, #f97316)" }}
                  >
                    {item.badge}
                  </span>
                ) : null}
              </div>
              <span
                className="text-[10px] font-bold mt-0.5 tracking-wide transition-all duration-200"
                style={{ color: isActive ? '#fb923c' : 'rgba(100,116,139,0.8)' }}
              >
                {item.name}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Universal Flagship Footer */}
      <FlagshipFooter />
    </div>
  );
}

