import React from 'react';

export const PizzaLoader: React.FC<{ text?: string }> = ({ text = 'Loading system...' }) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] p-8">
      <div className="relative flex items-center justify-center">
        <div className="w-14 h-14 rounded-full border-4 border-slate-800 border-t-orange-500 animate-spin" />
        <span className="absolute text-xl">🍕</span>
      </div>
      <p className="mt-4 text-xs font-bold text-slate-400 uppercase tracking-widest">{text}</p>
    </div>
  );
};
