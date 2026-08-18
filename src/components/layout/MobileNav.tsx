import React from 'react';
import { NavLink } from 'react-router';
import { LayoutDashboard, Clock, Pizza, Bell, Menu } from 'lucide-react';

interface MobileNavProps {
  onOpenDrawer: () => void;
}

export const MobileNav: React.FC<MobileNavProps> = ({ onOpenDrawer }) => {
  const items = [
    { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { label: 'Orders', path: '/orders', icon: Clock },
    { label: 'Products', path: '/products', icon: Pizza },
    { label: 'Alerts', path: '/notifications', icon: Bell },
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
