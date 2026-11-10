import React, { useEffect } from 'react';
import { CuratedFontFamily } from '../../../types/PageSchema';

interface FontPreviewBadgeProps {
  font: CuratedFontFamily;
  isSelected?: boolean;
  onClick?: () => void;
}

const GOOGLE_FONT_MAPPING: Record<CuratedFontFamily, string> = {
  Inter: 'Inter:wght@400;600;800',
  Outfit: 'Outfit:wght@400;600;800',
  Poppins: 'Poppins:wght@400;600;800',
  Manrope: 'Manrope:wght@400;600;800',
  'Plus Jakarta Sans': 'Plus+Jakarta+Sans:wght@400;600;800',
  'DM Sans': 'DM+Sans:wght@400;600;800',
  'Playfair Display': 'Playfair+Display:ital,wght@0,600;0,800;1,600',
  'Space Grotesk': 'Space+Grotesk:wght@400;600;700',
};

export default function FontPreviewBadge({ font, isSelected = false, onClick }: FontPreviewBadgeProps) {
  useEffect(() => {
    const fontSpec = GOOGLE_FONT_MAPPING[font];
    if (!fontSpec) return;

    const linkId = `google-font-${font.replace(/\s+/g, '-').toLowerCase()}`;
    if (!document.getElementById(linkId)) {
      const link = document.createElement('link');
      link.id = linkId;
      link.rel = 'stylesheet';
      link.href = `https://fonts.googleapis.com/css2?family=${fontSpec}&display=swap`;
      document.head.appendChild(link);
    }
  }, [font]);

  return (
    <div
      onClick={onClick}
      className={`group relative p-3 rounded-xl border transition-all cursor-pointer flex flex-col gap-1.5 ${
        isSelected
          ? 'bg-primary-500/15 border-primary-500 shadow-md shadow-primary-500/10'
          : 'bg-white/5 border-white/10 hover:border-primary-500/50 hover:bg-white/10'
      }`}
    >
      <div className="flex items-center justify-between">
        <span className={`text-xs font-bold ${isSelected ? 'text-primary-300' : 'text-slate-200'}`}>
          {font}
        </span>
        {isSelected && (
          <span className="text-[10px] font-bold uppercase tracking-wider text-primary-400 bg-primary-500/20 px-2 py-0.5 rounded-full">
            Active
          </span>
        )}
      </div>

      <div
        className="text-sm tracking-wide text-slate-100"
        style={{ fontFamily: `'${font}', sans-serif` }}
      >
        Olive Pizza — Fresh. Hot. Fast.
      </div>
      <div
        className="text-[11px] text-slate-400 font-light truncate"
        style={{ fontFamily: `'${font}', sans-serif` }}
      >
        Authentic wood-fired crusts, rich mozzarella, and secret herb marinara.
      </div>
    </div>
  );
}
