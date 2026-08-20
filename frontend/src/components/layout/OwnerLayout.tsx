import React, { useState, useEffect, Suspense } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router';
import { Header } from './Header';
import { MobileNav } from './MobileNav';
import { PizzaLoader } from '../ui/PizzaLoader';
import OwnerAlertManager from '../owner/OwnerAlertManager';
import NewOrderEmergencyOverlay from '../owner/NewOrderEmergencyOverlay';
import { db } from '../../lib/firebase';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { Order } from '../../types/models';
import { useAuthStore } from '../../lib/store';
import {
  BarChart3,
  Clock,
  FileText,
  Bell,
  Mail,
  FolderOpen,
  Pizza,
  Store,
  X,
  Menu,
} from 'lucide-react';

export const OwnerLayout: React.FC = () => {
  const user = useAuthStore((s) => s.user);
  const location = useLocation();
  const navigate = useNavigate();
  const [emergencyOrder, setEmergencyOrder] = useState<Order | null>(null);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Firestore real-time listener for high-priority incoming orders
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'orders'),
      orderBy('createdAt', 'desc'),
      limit(10)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added' || change.type === 'modified') {
            const data = change.doc.data() as Order;
            const orderStatus = (data.status || 'pending').toLowerCase();
            const orderTime = new Date(data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt || 0).getTime();
            const isRecent = Date.now() - orderTime < 5 * 60 * 1000;

            if (orderStatus === 'pending' && isRecent) {
              setEmergencyOrder({ id: change.doc.id, ...data });
            }
          }
        });
      },
      (error) => {
        console.warn('[OwnerLayout] Order stream error:', error);
      }
    );

    return () => unsubscribe();
  }, [user]);

  // Streamlined 8 Core Primary Navigation Items
  const navItems = [
    { label: 'Analytics', path: '/analytics', icon: BarChart3 },
    { label: 'Orders', path: '/orders', icon: Clock },
    { label: 'Restaurant Reports', path: '/reports', icon: FileText },
    { label: 'Notifications', path: '/notifications', icon: Bell },
    { label: 'Email', path: '/email', icon: Mail },
    { label: 'Media', path: '/media', icon: FolderOpen },
    { label: 'Product & Menu', path: '/products', icon: Pizza },
    { label: 'Restaurant Management', path: '/restaurant', icon: Store },
  ];

  return (
    <div className="min-h-screen bg-[#0B0F17] flex font-sans text-slate-100 antialiased selection:bg-orange-500 selection:text-white">
      {/* Desktop Sidebar */}
      <aside
        className={`hidden md:flex flex-col border-r border-slate-800 bg-[#0E1524] h-screen sticky top-0 transition-all duration-200 z-40 ${
          isSidebarCollapsed ? 'w-20' : 'w-64'
        }`}
      >
        {/* Brand Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-400 flex items-center justify-center font-bold text-sm shrink-0">
              🍕
            </div>
            {!isSidebarCollapsed && (
              <div>
                <h1 className="text-sm font-extrabold text-white leading-tight">OLIVE PIZZA</h1>
                <span className="text-[10px] font-black text-orange-400 bg-orange-500/10 px-1.5 py-0.5 rounded border border-orange-500/30 uppercase tracking-wider">
                  OWNER OPS
                </span>
              </div>
            )}
          </div>
          <button
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Toggle Sidebar"
          >
            <Menu className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1.5">
          <div className="px-3 pb-2 text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">
            {!isSidebarCollapsed && 'Operations'}
          </div>
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  isActive
                    ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                } ${isSidebarCollapsed ? 'justify-center px-2' : ''}`
              }
              title={isSidebarCollapsed ? item.label : undefined}
            >
              <item.icon className="w-4 h-4 flex-shrink-0" />
              {!isSidebarCollapsed && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Mobile Drawer */}
      {isMobileDrawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div className="fixed inset-0 bg-black/75 backdrop-blur-sm" onClick={() => setIsMobileDrawerOpen(false)} />
          <div className="relative w-72 max-w-[80vw] bg-[#0E1524] border-r border-slate-800 h-full flex flex-col p-4 z-10">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
              <div className="flex items-center gap-2">
                <span className="text-xl">🍕</span>
                <span className="font-extrabold text-white text-sm">Olive Pizza Owner</span>
              </div>
              <button
                onClick={() => setIsMobileDrawerOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto space-y-1.5">
              {navItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsMobileDrawerOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-colors ${
                      isActive ? 'bg-orange-500 text-white' : 'text-slate-300 hover:bg-slate-800/60'
                    }`
                  }
                >
                  <item.icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </nav>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 pb-24 md:pb-8">
          <Suspense fallback={<PizzaLoader text="Loading module..." />}>
            <Outlet />
          </Suspense>
        </main>
        <MobileNav onOpenDrawer={() => setIsMobileDrawerOpen(true)} />
      </div>

      {/* Persistent Order Alert Alarm & Audio Manager */}
      <OwnerAlertManager />

      {/* Emergency Full-Screen Audio Overlay for New Pending Orders */}
      {emergencyOrder && (
        <NewOrderEmergencyOverlay
          order={emergencyOrder}
          onClose={() => setEmergencyOrder(null)}
        />
      )}
    </div>
  );
};
