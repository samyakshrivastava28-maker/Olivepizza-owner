import React, { useState } from 'react';
import { HelpCircle } from 'lucide-react';

interface HelpTooltipProps {
  content: string;
  recommendation?: string;
}

export default function HelpTooltip({ content, recommendation }: HelpTooltipProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative inline-block ml-1.5 align-middle">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
        className="text-slate-400 hover:text-primary-400 transition-colors focus:outline-hidden p-0.5 rounded-full"
        title="More information"
      >
        <HelpCircle className="w-3.5 h-3.5" />
      </button>

      {isOpen && (
        <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-56 sm:w-64 p-3 bg-slate-900/95 backdrop-blur-md border border-white/15 rounded-xl shadow-2xl z-50 text-left pointer-events-none animate-in fade-in zoom-in-95 duration-150">
          <p className="text-xs text-slate-200 leading-relaxed font-normal">{content}</p>
          {recommendation && (
            <div className="mt-2 pt-2 border-t border-white/10 flex items-center gap-1.5 text-[11px] font-semibold text-amber-300">
              <span>💡 Recommended:</span>
              <span className="text-white">{recommendation}</span>
            </div>
          )}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900/95" />
        </div>
      )}
    </div>
  );
}
