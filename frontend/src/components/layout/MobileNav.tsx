import React from 'react';
import { NavLink } from 'react-router';
import { BarChart3, Clock, Pizza, Store, Menu } from 'lucide-react';
import { useAuthStore, isAuthorizedOwnerEmail } from '../../lib/store';

interface MobileNavProps {
  onOpenDrawer: () => void;
}

export const MobileNav: React.FC<MobileNavProps> = ({ onOpenDrawer }) => {
  const user = useAuthStore((s) => s.user);
  const isMasterOwner = !user?.email ? false : (
    isAuthorizedOwnerEmail(user.email) ||
    user.role === 'owner' || 
    user.role === 'admin' || 
    user.role === 'developer'
  );

  const items = isMasterOwner ? [
    { label: 'Analytics', path: '/analytics', icon: BarChart3 },
    { label: 'Orders', path: '/orders', icon: Clock },
    { label: 'Restaurant', path: '/restaurant', icon: Store },
    { label: 'Menu', path: '/products', icon: Pizza },
  ] : [
    { label: 'Orders', path: '/orders', icon: Clock },
    { label: 'Restaurant', path: '/restaurant', icon: Store },
    { label: 'Menu', path: '/products', icon: Pizza },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-[#0E1524]/95 backdrop-blur-lg border-t border-slate-800 flex items-center justify-around z-40 px-2 pb-safe">
      {items.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          className={({ isActive }) =>
            `flex flex-col items-center justify-center flex-1 h-full gap-1 text-[11px] font-bold transition-colors ${
              isActive ? 'text-orange-500' : 'text-slate-400 hover:text-slate-200'
            }`
          }
        >
          <item.icon className="w-5 h-5" />
          <span>{item.label}</span>
        </NavLink>
      ))}
      <button
        onClick={onOpenDrawer}
        className="flex flex-col items-center justify-center flex-1 h-full gap-1 text-[11px] font-bold text-slate-400 hover:text-slate-200"
      >
        <Menu className="w-5 h-5" />
        <span>More</span>
      </button>
    </nav>
  );
};
