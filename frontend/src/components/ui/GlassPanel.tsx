import React from 'react';

interface GlassPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
}

export const GlassPanel: React.FC<GlassPanelProps> = ({ children, className = '', ...props }) => {
  return (
    <div
      className={`bg-[#131B2B]/80 backdrop-blur-md border border-slate-800/80 rounded-2xl shadow-xl shadow-black/30 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
