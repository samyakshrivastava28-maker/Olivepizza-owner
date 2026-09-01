import React from 'react';

export interface AppLogoProps {
  variant?: 'full' | 'compact' | 'icon';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  subtitle?: string;
}

export const AppLogo: React.FC<AppLogoProps> = ({
  variant = 'full',
  size = 'md',
  className = '',
  subtitle = 'Owner Operations'
}) => {
  const sizeMap = {
    sm: { icon: 'w-7 h-7', title: 'text-xs', sub: 'text-[9px] px-1.5 py-0.2', gap: 'gap-2' },
    md: { icon: 'w-9 h-9', title: 'text-sm', sub: 'text-[10px] px-2 py-0.5', gap: 'gap-2.5' },
    lg: { icon: 'w-11 h-11', title: 'text-base', sub: 'text-[11px] px-2.5 py-0.5', gap: 'gap-3' },
    xl: { icon: 'w-14 h-14', title: 'text-xl', sub: 'text-xs px-3 py-1', gap: 'gap-3.5' },
  };

  const currentSize = sizeMap[size] || sizeMap.md;

  const renderIcon = () => (
    <div className={`${currentSize.icon} rounded-xl bg-gradient-to-br from-orange-950/80 to-slate-900 border border-orange-500/40 flex items-center justify-center shrink-0 shadow-md p-1`}>
      <svg viewBox="0 0 48 48" className="w-full h-full drop-shadow" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M10 16 C18 10, 30 10, 38 16 L35 20 C28 15, 20 15, 13 20 Z" fill="url(#op-crust-owner)"/>
        <path d="M12.5 19.5 C20 14.5, 28 14.5, 35.5 19.5 L24 40 Z" fill="url(#op-cheese-owner)"/>
        <circle cx="21" cy="23" r="3" fill="#EA580C"/>
        <circle cx="28" cy="27" r="2.6" fill="#EA580C"/>
        <circle cx="23" cy="32" r="2" fill="#EA580C"/>
        <ellipse cx="28" cy="19.5" rx="3.2" ry="2.5" fill="#65A30D" stroke="#166534" strokeWidth="0.8"/>
        <circle cx="28" cy="19.5" r="1" fill="#DC2626"/>
        <ellipse cx="17" cy="27.5" rx="2.8" ry="2.2" fill="#65A30D" stroke="#166534" strokeWidth="0.8"/>
        <circle cx="17" cy="27.5" r="0.9" fill="#DC2626"/>
        <defs>
          <linearGradient id="op-crust-owner" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#F59E0B"/>
            <stop offset="100%" stopColor="#D97706"/>
          </linearGradient>
          <linearGradient id="op-cheese-owner" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FDE047"/>
            <stop offset="100%" stopColor="#EAB308"/>
          </linearGradient>
        </defs>
      </svg>
    </div>
  );

  if (variant === 'icon') {
    return (
      <div className={`inline-flex items-center justify-center shrink-0 ${className}`} title="Olive Pizza Owner">
        {renderIcon()}
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center ${currentSize.gap} ${className} shrink-0`}>
      {renderIcon()}
      <div className="flex flex-col justify-center min-w-0">
        <span className={`${currentSize.title} font-black text-white tracking-wider leading-tight uppercase truncate`}>
          OLIVE PIZZA
        </span>
        {variant === 'full' && (
          <span className={`${currentSize.sub} font-extrabold text-orange-400 bg-orange-500/10 border border-orange-500/30 rounded-md tracking-wider uppercase inline-block mt-0.5 whitespace-nowrap w-fit`}>
            {subtitle}
          </span>
        )}
      </div>
    </div>
  );
};
