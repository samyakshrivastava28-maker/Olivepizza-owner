import React, { useState } from 'react';
import { Image as ImageIcon, Video, Box, Trash2, Copy, EyeOff, MoveUp, MoveDown, Smartphone, Monitor } from 'lucide-react';
import { SimplifiedSectionSchema } from '../../../types/PageSchema';
import MediaLibraryPicker from './MediaLibraryPicker';

interface PropertyPanelProps {
  section: SimplifiedSectionSchema | null;
  sectionIndex: number;
  totalSections: number;
  onUpdate: (key: string, value: any) => void;
  onAction: (action: 'move_up' | 'move_down' | 'duplicate' | 'delete' | 'toggle_hide') => void;
}

const ANIMATION_OPTIONS = ['None', 'Fade', 'Fade Up', 'Fade Down', 'Slide', 'Scale', 'Pop', 'Floating', 'Stagger'];
const ACTION_OPTIONS = ['OPEN_MENU', 'OPEN_CART', 'ADD_TO_CART', 'OPEN_CHECKOUT', 'LOGIN', 'OPEN_OFFERS', 'OPEN_PROFILE', 'EXTERNAL_LINK'];

export default function PropertyPanel({ section, sectionIndex, totalSections, onUpdate, onAction }: PropertyPanelProps) {
  const [activeMediaTarget, setActiveMediaTarget] = useState<'mediaUrl' | 'mobileMediaUrl' | null>(null);

  if (!section) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500 p-8 text-center">
        <Box className="w-12 h-12 mb-4 opacity-50 text-slate-600" />
        <p className="text-sm font-medium">Select a section on the canvas to edit its properties & media.</p>
      </div>
    );
  }

  const { config } = section;

  const isVideo = (url?: string) => {
    if (!url) return false;
    return url.match(/\.(mp4|mov|webm)(\?.*)?$/i) || url.includes('/video/upload/');
  };

  const renderMediaBox = (targetKey: 'mediaUrl' | 'mobileMediaUrl', label: string, isMobile = false) => {
    const url = config[targetKey];
    const hasMedia = !!url;

    return (
      <div className="bg-white/5 p-3 rounded-xl border border-white/10 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
            {isMobile ? <Smartphone className="w-3.5 h-3.5 text-primary-400" /> : <Monitor className="w-3.5 h-3.5 text-sky-400" />}
            {label}
          </label>
          {hasMedia && (
            <span className="text-[10px] uppercase font-bold text-slate-400 bg-black/40 px-2 py-0.5 rounded">
              {isVideo(url) ? 'Video' : 'Image'}
            </span>
          )}
        </div>

        {hasMedia ? (
          <div className="relative group rounded-lg overflow-hidden border border-white/10 aspect-video bg-black/80">
            {isVideo(url) ? (
              <video src={url} className="w-full h-full object-cover" muted loop autoPlay playsInline />
            ) : (
              <img src={url} className="w-full h-full object-cover" alt="Selected Media" />
            )}
            <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 backdrop-blur-xs">
              <button 
                onClick={() => setActiveMediaTarget(targetKey)} 
                className="px-3 py-1.5 bg-primary-500 hover:bg-primary-400 text-white rounded font-bold text-xs shadow-md transition-all"
              >
                Change
              </button>
              <button 
                onClick={() => onUpdate(targetKey, '')} 
                className="px-3 py-1.5 bg-red-500/80 hover:bg-red-500 text-white rounded font-bold text-xs shadow-md transition-all"
              >
                Remove
              </button>
            </div>
          </div>
        ) : (
          <button 
            onClick={() => setActiveMediaTarget(targetKey)}
            className="w-full py-5 border border-dashed border-white/20 hover:border-primary-500 rounded-lg flex flex-col items-center justify-center text-slate-400 hover:bg-white/5 transition-all group"
          >
            <ImageIcon className="w-5 h-5 mb-1 text-slate-500 group-hover:text-primary-400 transition-colors" />
            <span className="text-xs font-bold text-slate-300">Select {label}</span>
          </button>
        )}
      </div>
    );
  };

  const supportsMedia = ['HERO', 'VIDEO_HERO', 'PIZZA_SHOWCASE', 'GALLERY', 'ADS', 'COUPONS', 'DOWNLOAD_APP', 'FEATURED'].includes(section.type);

  return (
    <div className="w-full h-full overflow-y-auto custom-scrollbar p-5 flex flex-col gap-6">
      
      {/* Header & Actions */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-base font-black text-white uppercase tracking-wider">{section.type.replace('_', ' ')}</h3>
          {section.isHidden && <span className="bg-red-500/20 text-red-400 text-[10px] px-2 py-0.5 rounded font-bold uppercase">Hidden</span>}
        </div>
        
        <div className="flex gap-2">
          <button onClick={() => onAction('move_up')} disabled={sectionIndex === 0} className="p-2 bg-white/5 hover:bg-white/10 disabled:opacity-30 rounded-lg text-slate-300 transition-colors" title="Move Up"><MoveUp className="w-4 h-4" /></button>
          <button onClick={() => onAction('move_down')} disabled={sectionIndex === totalSections - 1} className="p-2 bg-white/5 hover:bg-white/10 disabled:opacity-30 rounded-lg text-slate-300 transition-colors" title="Move Down"><MoveDown className="w-4 h-4" /></button>
          <button onClick={() => onAction('toggle_hide')} className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-slate-300 transition-colors" title="Hide/Show"><EyeOff className="w-4 h-4" /></button>
          <button onClick={() => onAction('duplicate')} className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-slate-300 transition-colors" title="Duplicate"><Copy className="w-4 h-4" /></button>
          <button onClick={() => onAction('delete')} className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors" title="Delete"><Trash2 className="w-4 h-4" /></button>
        </div>
      </div>

      <hr className="border-white/10" />

      {/* Dynamic Properties */}
      <div className="flex flex-col gap-4">
        
        {/* TEXT SETTINGS */}
        {(['HERO', 'VIDEO_HERO', 'PIZZA_SHOWCASE', 'COUNTDOWN', 'TESTIMONIALS', 'GALLERY', 'CRAVINGS', 'CRAVING_CATEGORIES'].includes(section.type)) && (
          <>
            <div>
              <label className="text-xs font-bold text-slate-400 block mb-1">Headline</label>
              <input 
                type="text" 
                value={config.headline || ''}
                onChange={(e) => onUpdate('headline', e.target.value)}
                placeholder="Enter headline..."
                className="w-full bg-black/50 border border-white/10 rounded-lg p-2.5 text-white text-sm focus:border-primary-500 outline-none transition-colors"
              />
            </div>
            {section.type !== 'COUNTDOWN' && section.type !== 'GALLERY' && (
              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">Subtitle</label>
                <textarea 
                  value={config.subtitle || ''}
                  onChange={(e) => onUpdate('subtitle', e.target.value)}
                  placeholder="Enter subtitle..."
                  rows={2}
                  className="w-full bg-black/50 border border-white/10 rounded-lg p-2.5 text-white text-sm focus:border-primary-500 outline-none resize-none transition-colors"
                />
              </div>
            )}
          </>
        )}

        {/* MEDIA MANAGEMENT (DESKTOP & MOBILE MEDIA) */}
        {supportsMedia && (
          <div className="flex flex-col gap-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">Media Settings</h4>
            
            {/* Desktop / Default Media */}
            {renderMediaBox('mediaUrl', 'Desktop Media (Default)')}

            {/* Separate Mobile Media Toggle */}
            <div className="flex items-center justify-between p-2.5 bg-black/40 rounded-xl border border-white/5 mt-1">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Smartphone className="w-3.5 h-3.5 text-primary-400" /> Use Separate Mobile Media
              </span>
              <input 
                type="checkbox"
                checked={!!config.useSeparateMobileMedia}
                onChange={(e) => onUpdate('useSeparateMobileMedia', e.target.checked)}
                className="w-4 h-4 rounded bg-slate-900 border-white/20 accent-primary-500 cursor-pointer"
              />
            </div>

            {/* Mobile Specific Media Box */}
            {config.useSeparateMobileMedia && (
              <div className="pl-2 border-l-2 border-primary-500/50 flex flex-col gap-2">
                {renderMediaBox('mobileMediaUrl', 'Mobile Media (Smartphone)', true)}
                <p className="text-[11px] text-slate-400 italic">
                  This media will display when customers view the website on mobile devices.
                </p>
              </div>
            )}
          </div>
        )}

        {/* BUTTON SETTINGS */}
        {(['HERO', 'VIDEO_HERO'].includes(section.type)) && (
          <div className="bg-white/5 p-3 rounded-xl border border-white/5">
            <h4 className="text-xs font-bold text-white mb-3">Button Settings</h4>
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-slate-400 block mb-1">Button Text</label>
                <input 
                  type="text" 
                  value={config.buttonText || ''}
                  onChange={(e) => onUpdate('buttonText', e.target.value)}
                  placeholder="e.g. ORDER NOW"
                  className="w-full bg-black/50 border border-white/10 rounded-lg p-2 text-white text-sm"
                />
              </div>
              {config.buttonText && (
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-slate-400 block mb-1">Action Type</label>
                  <select 
                    value={config.buttonAction?.type || 'OPEN_MENU'}
                    onChange={(e) => onUpdate('buttonAction', { type: e.target.value })}
                    className="w-full bg-black/50 border border-white/10 rounded-lg p-2 text-white text-sm"
                  >
                    {ACTION_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ANIMATION SETTINGS */}
        <div>
          <label className="text-xs font-bold text-slate-400 block mb-1">Entrance Animation</label>
          <select 
            value={config.animationType || 'None'}
            onChange={(e) => onUpdate('animationType', e.target.value)}
            className="w-full bg-black/50 border border-white/10 rounded-lg p-2 text-white text-sm"
          >
            {ANIMATION_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        </div>

        {/* STYLING OVERRIDES */}
        <div className="bg-white/5 p-3 rounded-xl border border-white/5">
          <h4 className="text-xs font-bold text-white mb-3">Style Overrides</h4>
          <div className="flex flex-col gap-3">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-slate-400 block mb-1">Background Color</label>
              <div className="flex items-center gap-2">
                <input 
                  type="color" 
                  value={config.styleOverrides?.backgroundColor || '#000000'}
                  onChange={(e) => onUpdate('styleOverrides', { ...config.styleOverrides, backgroundColor: e.target.value })}
                  className="w-8 h-8 rounded cursor-pointer border-none p-0 bg-transparent"
                />
                <input 
                  type="text" 
                  value={config.styleOverrides?.backgroundColor || ''}
                  onChange={(e) => onUpdate('styleOverrides', { ...config.styleOverrides, backgroundColor: e.target.value })}
                  placeholder="e.g. #0f172a or transparent"
                  className="flex-1 bg-black/50 border border-white/10 rounded p-2 text-white text-sm"
                />
              </div>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-slate-400 block mb-1">Text Color</label>
              <div className="flex items-center gap-2">
                <input 
                  type="color" 
                  value={config.styleOverrides?.textColor || '#ffffff'}
                  onChange={(e) => onUpdate('styleOverrides', { ...config.styleOverrides, textColor: e.target.value })}
                  className="w-8 h-8 rounded cursor-pointer border-none p-0 bg-transparent"
                />
                <input 
                  type="text" 
                  value={config.styleOverrides?.textColor || ''}
                  onChange={(e) => onUpdate('styleOverrides', { ...config.styleOverrides, textColor: e.target.value })}
                  placeholder="e.g. #ffffff"
                  className="flex-1 bg-black/50 border border-white/10 rounded p-2 text-white text-sm"
                />
              </div>
            </div>
          </div>
        </div>

      </div>

      {activeMediaTarget && (
        <MediaLibraryPicker 
          title={activeMediaTarget === 'mobileMediaUrl' ? "Select Mobile Media" : "Select Desktop Media"}
          onClose={() => setActiveMediaTarget(null)}
          onSelect={(url) => {
            onUpdate(activeMediaTarget, url);
            setActiveMediaTarget(null);
          }}
        />
      )}
    </div>
  );
}
