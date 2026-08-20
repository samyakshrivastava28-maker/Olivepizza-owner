import React, { useState, useEffect, Suspense } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router';
import { Header } from './Header';
import { MobileNav } from './MobileNav';
import { PizzaLoader } from '../ui/PizzaLoader';
import { EmergencyOrderModal } from '../orders/EmergencyOrderModal';
import { db } from '../../lib/firebase';
import { collection, query, orderBy, limit, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { Order } from '../../types/models';
import { soundPlayer } from '../../lib/audio';
import { initFCMNotifications } from '../../lib/fcm';
import { useAuthStore } from '../../lib/store';
import {
  LayoutDashboard,
  Clock,
  BookOpen,
  Pizza,
  Layers,
  Tag,
  Megaphone,
  FolderOpen,
  Home,
  Bike,
  FileText,
  Users,
  Mail,
  Bell,
  Radio,
  ShieldCheck,
  Cpu,
  Brain,
  Lock,
  GitBranch,
  Calendar,
  BarChart3,
  Database,
  Settings,
  X,
  Menu,
} from 'lucide-react';
import toast from 'react-hot-toast';

export const OwnerLayout: React.FC = () => {
  const user = useAuthStore((s) => s.user);
  const location = useLocation();
  const navigate = useNavigate();
  const [emergencyOrder, setEmergencyOrder] = useState<Order | null>(null);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Initialize FCM for push alerts
  useEffect(() => {
    if (user?.uid) {
      initFCMNotifications(user.uid);
    }
  }, [user]);

  // Real-time listener for incoming customer orders (triggering emergency audio/modal)
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
          const newOrder = { id: change.doc.id, ...change.doc.data() } as Order;
          const status = (newOrder.status || '').toLowerCase();
          if (['pending', 'placed', 'created', 'new_order'].includes(status)) {
            soundPlayer.playNewOrderAlarm();
            setEmergencyOrder(newOrder);
          }
        }
      });
    });
    return () => unsubscribe();
  }, []);

  const handleAcceptOrder = async (orderId: string) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), {
        status: 'preparing',
        updatedAt: new Date(),
      });
      setEmergencyOrder(null);
      toast.success('Order accepted! Moving to Preparing state.');
      navigate('/orders');
    } catch (e: any) {
      toast.error('Failed to accept order: ' + e.message);
    }
  };

  const navGroups = [
    {
      group: 'Core Operations',
      items: [
        { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
        { label: 'Live Orders', path: '/orders', icon: Clock },
        { label: 'Order History', path: '/order-history', icon: BookOpen },
        { label: 'Delivery Fleet', path: '/partners', icon: Bike },
      ],
    },
    {
      group: 'Menu & Marketing',
      items: [
        { label: 'Products & Menu', path: '/products', icon: Pizza },
        { label: 'Special Categories', path: '/special-categories', icon: Layers },
        { label: 'Coupons & Discounts', path: '/coupons', icon: Tag },
        { label: 'Promotions & Ads', path: '/ads', icon: Megaphone },
        { label: 'Media Library', path: '/media', icon: FolderOpen },
        { label: 'Home Page Manager', path: '/home-page-manager', icon: Home },
      ],
    },
    {
      group: 'Business & CRM',
      items: [
        { label: 'Financial Reports', path: '/reports', icon: FileText },
        { label: 'Customer CRM', path: '/customers', icon: Users },
        { label: 'Email Center', path: '/email', icon: Mail },
        { label: 'Events & Campaigns', path: '/events', icon: Calendar },
        { label: 'Website Analytics', path: '/analytics', icon: BarChart3 },
      ],
    },
    {
      group: 'System & Diagnostics',
      items: [
        { label: 'Notification Center', path: '/notifications', icon: Bell },
        { label: 'Push Diagnostics', path: '/notification-diagnostics', icon: Radio },
        { label: 'Verification Metrics', path: '/verification-metrics', icon: ShieldCheck },
        { label: 'AI Health Monitor', path: '/ai-monitor', icon: Cpu },
        { label: 'AI Knowledge Sync', path: '/ai-knowledge', icon: Brain },
        { label: 'Security Logs', path: '/security', icon: Lock },
        { label: 'Version Control', path: '/versions', icon: GitBranch },
        { label: 'Data Manager', path: '/data-manager', icon: Database },
        { label: 'Store Settings', path: '/settings', icon: Settings },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-[#0B0F17] flex font-sans text-slate-100 antialiased selection:bg-orange-500 selection:text-white">
      {/* Desktop Sidebar */}
      <aside
        className={`hidden md:flex flex-col border-r border-slate-800 bg-[#0E1524] h-screen sticky top-0 transition-all duration-200 z-40 ${
          isSidebarCollapsed ? 'w-20' : 'w-64'
        }`}
      >
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <span className="text-2xl">🍕</span>
            {!isSidebarCollapsed && (
              <div>
                <h1 className="text-sm font-extrabold text-white leading-tight">OLIVE PIZZA</h1>
                <span className="text-[10px] font-bold text-orange-400 uppercase tracking-wider">Owner Panel</span>
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

        <nav className="flex-1 overflow-y-auto p-3 space-y-6">
          {navGroups.map((g) => (
            <div key={g.group} className="space-y-1">
              {!isSidebarCollapsed && (
                <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest px-3">
                  {g.group}
                </span>
              )}
              {g.items.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-bold transition-colors ${
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
            </div>
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
                <span className="text-2xl">🍕</span>
                <span className="font-extrabold text-white text-sm">Olive Pizza Owner</span>
              </div>
              <button
                onClick={() => setIsMobileDrawerOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto space-y-4">
              {navGroups.map((g) => (
                <div key={g.group} className="space-y-1">
                  <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest px-2">
                    {g.group}
                  </span>
                  {g.items.map((item) => (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      onClick={() => setIsMobileDrawerOpen(false)}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-colors ${
                          isActive
                            ? 'bg-orange-500 text-white'
                            : 'text-slate-300 hover:bg-slate-800/60'
                        }`
                      }
                    >
                      <item.icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </NavLink>
                  ))}
                </div>
              ))}
            </nav>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 pb-24 md:pb-8">
          <Suspense fallback={<PizzaLoader text="Loading section data..." />}>
            <Outlet />
          </Suspense>
        </main>
        <MobileNav onOpenDrawer={() => setIsMobileDrawerOpen(true)} />
      </div>
    </div>
  );
};
