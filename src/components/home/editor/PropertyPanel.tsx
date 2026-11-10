import React, { useState } from 'react';
import {
  Image as ImageIcon,
  Video,
  Box,
  Trash2,
  Copy,
  EyeOff,
  Eye,
  MoveUp,
  MoveDown,
  Smartphone,
  Tablet,
  Monitor,
  Sparkles,
  Type,
  Palette,
  Sliders,
  Maximize2,
  AlignLeft,
  AlignCenter,
  AlignRight,
} from 'lucide-react';
import {
  SimplifiedSectionSchema,
  AnimationType,
  CuratedFontFamily,
  TextAnimationType,
} from '../../../types/PageSchema';
import MediaLibraryPicker from './MediaLibraryPicker';
import AnimationPreviewBadge from './AnimationPreviewBadge';
import FontPreviewBadge from './FontPreviewBadge';
import HelpTooltip from './HelpTooltip';

interface PropertyPanelProps {
  section: SimplifiedSectionSchema | null;
  sectionIndex: number;
  totalSections: number;
  onUpdate: (key: string, value: any) => void;
  onAction: (action: 'move_up' | 'move_down' | 'duplicate' | 'delete' | 'toggle_hide') => void;
}

const ENTRANCE_ANIMATION_OPTIONS: { value: AnimationType; label: string }[] = [
  { value: 'None', label: 'None (Static)' },
  { value: 'Fade Up', label: 'Fade Up' },
  { value: 'Fade Down', label: 'Fade Down' },
  { value: 'Fade', label: 'Soft Fade In' },
  { value: 'Fade Left', label: 'Slide From Right' },
  { value: 'Fade Right', label: 'Slide From Left' },
  { value: 'Scale', label: 'Scale In / Zoom' },
  { value: 'Blur In', label: 'Cinematic Blur In' },
  { value: 'Pop', label: 'Playful Pop / Bounce' },
  { value: 'Floating', label: 'Gentle Floating Wave' },
  { value: 'Stagger', label: 'Staggered Items' },
];

const TEXT_ANIMATION_OPTIONS: { value: TextAnimationType; label: string }[] = [
  { value: 'None', label: 'None (Instant)' },
  { value: 'Word Reveal', label: 'Word by Word' },
  { value: 'Character Reveal', label: 'Letter by Letter' },
  { value: 'Typewriter', label: 'Typewriter Cursor' },
  { value: 'Mask Reveal', label: 'Mask Slide Reveal' },
  { value: 'Letter Spacing', label: 'Letter Spacing Expand' },
  { value: 'Soft Scale', label: 'Soft Breathing Scale' },
];

const CURATED_FONTS: CuratedFontFamily[] = [
  'Outfit',
  'Inter',
  'Poppins',
  'Plus Jakarta Sans',
  'Manrope',
  'DM Sans',
  'Playfair Display',
  'Space Grotesk',
];

const ACTION_OPTIONS = [
  { value: 'OPEN_MENU', label: 'Open Food Menu' },
  { value: 'OPEN_CART', label: 'Open Shopping Cart' },
  { value: 'OPEN_OFFERS', label: 'View Today’s Offers' },
  { value: 'OPEN_CHECKOUT', label: 'Proceed to Checkout' },
  { value: 'OPEN_PROFILE', label: 'Customer Profile' },
  { value: 'EXTERNAL_LINK', label: 'External Website URL' },
];

export default function PropertyPanel({
  section,
  sectionIndex,
  totalSections,
  onUpdate,
  onAction,
}: PropertyPanelProps) {
  const [activeMediaTarget, setActiveMediaTarget] = useState<'mediaUrl' | 'mobileMediaUrl' | null>(null);
  const [activeTab, setActiveTab] = useState<'content' | 'animations' | 'typography' | 'design'>('content');
  const [fontDeviceTab, setFontDeviceTab] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');

  if (!section) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500 p-8 text-center">
        <Box className="w-12 h-12 mb-4 opacity-50 text-slate-600" />
        <p className="text-sm font-medium">Select any section on the canvas or sidebar to customize it.</p>
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
            <HelpTooltip content="Media to show for this section. The system automatically converts images to WebP and videos to WebM." recommendation="JPG, PNG, or MP4 under 15MB." />
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
                type="button"
                onClick={() => setActiveMediaTarget(targetKey)}
                className="px-3 py-1.5 bg-primary-500 hover:bg-primary-400 text-white rounded font-bold text-xs shadow-md transition-all"
              >
                Change
              </button>
              <button
                type="button"
                onClick={() => onUpdate(targetKey, '')}
                className="px-3 py-1.5 bg-red-500/80 hover:bg-red-500 text-white rounded font-bold text-xs shadow-md transition-all"
              >
                Remove
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setActiveMediaTarget(targetKey)}
            className="w-full py-5 border border-dashed border-white/20 hover:border-primary-500 rounded-lg flex flex-col items-center justify-center text-slate-400 hover:bg-white/5 transition-all group"
          >
            <ImageIcon className="w-5 h-5 mb-1 text-slate-500 group-hover:text-primary-400 transition-colors" />
            <span className="text-xs font-bold text-slate-300">Choose {label}</span>
          </button>
        )}
      </div>
    );
  };

  const supportsMedia = [
    'HERO',
    'VIDEO_HERO',
    'PIZZA_SHOWCASE',
    'GALLERY',
    'ADS',
    'COUPONS',
    'DOWNLOAD_APP',
    'FEATURED',
    'WHY_US',
  ].includes(section.type);

  return (
    <div className="w-full h-full overflow-y-auto custom-scrollbar p-5 flex flex-col gap-5">
      {/* Header & Quick Action Buttons */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-black text-white uppercase tracking-wider">
              {section.type.replace(/_/g, ' ')}
            </h3>
            {section.isHidden && (
              <span className="bg-red-500/20 text-red-400 text-[10px] px-2 py-0.5 rounded font-bold uppercase">
                Hidden
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onAction('move_up')}
              disabled={sectionIndex === 0}
              className="p-1.5 bg-white/5 hover:bg-white/10 disabled:opacity-30 rounded-lg text-slate-300 transition-colors"
              title="Move Up"
            >
              <MoveUp className="w-4 h-4" />
            </button>
            <button
              onClick={() => onAction('move_down')}
              disabled={sectionIndex === totalSections - 1}
              className="p-1.5 bg-white/5 hover:bg-white/10 disabled:opacity-30 rounded-lg text-slate-300 transition-colors"
              title="Move Down"
            >
              <MoveDown className="w-4 h-4" />
            </button>
            <button
              onClick={() => onAction('toggle_hide')}
              className="p-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-slate-300 transition-colors"
              title={section.isHidden ? 'Show Section' : 'Hide Section'}
            >
              {section.isHidden ? <Eye className="w-4 h-4 text-emerald-400" /> : <EyeOff className="w-4 h-4" />}
            </button>
            <button
              onClick={() => onAction('duplicate')}
              className="p-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-slate-300 transition-colors"
              title="Duplicate Section"
            >
              <Copy className="w-4 h-4" />
            </button>
            <button
              onClick={() => onAction('delete')}
              className="p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors"
              title="Delete Section"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Property Category Tabs */}
        <div className="grid grid-cols-4 gap-1 p-1 bg-black/40 border border-white/10 rounded-xl mt-3">
          <button
            onClick={() => setActiveTab('content')}
            className={`py-1.5 text-xs font-bold rounded-lg transition-all ${
              activeTab === 'content' ? 'bg-primary-500 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            Content
          </button>
          <button
            onClick={() => setActiveTab('animations')}
            className={`py-1.5 text-xs font-bold rounded-lg transition-all ${
              activeTab === 'animations' ? 'bg-primary-500 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            Animation
          </button>
          <button
            onClick={() => setActiveTab('typography')}
            className={`py-1.5 text-xs font-bold rounded-lg transition-all ${
              activeTab === 'typography' ? 'bg-primary-500 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            Fonts
          </button>
          <button
            onClick={() => setActiveTab('design')}
            className={`py-1.5 text-xs font-bold rounded-lg transition-all ${
              activeTab === 'design' ? 'bg-primary-500 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            Design
          </button>
        </div>
      </div>

      <hr className="border-white/10" />

      {/* TAB 1: CONTENT */}
      {activeTab === 'content' && (
        <div className="flex flex-col gap-4">
          {/* Headline & Subtitle */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-slate-300">Section Title</label>
              <HelpTooltip content="The main headline shown to customers for this section." recommendation="Keep under 6 words for highest impact." />
            </div>
            <input
              type="text"
              value={config.headline || ''}
              onChange={(e) => onUpdate('headline', e.target.value)}
              placeholder="e.g. Artisan Wood-Fired Pizza"
              className="w-full bg-black/50 border border-white/10 rounded-lg p-2.5 text-white text-sm focus:border-primary-500 outline-hidden transition-colors"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-slate-300">Subtitle / Description</label>
              <HelpTooltip content="Additional details or taglines displayed below the main title." />
            </div>
            <textarea
              value={config.subtitle || ''}
              onChange={(e) => onUpdate('subtitle', e.target.value)}
              placeholder="e.g. Handcrafted dough fermented for 48 hours..."
              rows={2}
              className="w-full bg-black/50 border border-white/10 rounded-lg p-2.5 text-white text-sm focus:border-primary-500 outline-hidden resize-none transition-colors"
            />
          </div>

          {/* Primary Action Button */}
          <div className="bg-white/5 p-3.5 rounded-xl border border-white/5 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">Primary Button</h4>
              <HelpTooltip content="Call-to-action button that encourages customers to order." recommendation="ORDER NOW or EXPLORE MENU." />
            </div>

            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Button Text</label>
              <input
                type="text"
                value={config.buttonText || ''}
                onChange={(e) => onUpdate('buttonText', e.target.value)}
                placeholder="e.g. ORDER NOW"
                className="w-full bg-black/50 border border-white/10 rounded-lg p-2 text-white text-xs"
              />
            </div>

            {config.buttonText && (
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Button Action</label>
                <select
                  value={config.buttonAction?.type || 'OPEN_MENU'}
                  onChange={(e) => onUpdate('buttonAction', { type: e.target.value })}
                  className="w-full bg-black/50 border border-white/10 rounded-lg p-2 text-white text-xs"
                >
                  {ACTION_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Media Section */}
          {supportsMedia && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">Background Media</h4>
                <HelpTooltip content="Background picture or looping video for this section." recommendation="High resolution pizza photos or short 5-10s video clips." />
              </div>

              {renderMediaBox('mediaUrl', 'Desktop Media (Default)')}

              {/* Mobile Media Toggle */}
              <div className="flex items-center justify-between p-2.5 bg-black/40 rounded-xl border border-white/5">
                <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5 text-primary-400" />
                  Separate Mobile Version
                </span>
                <input
                  type="checkbox"
                  checked={!!config.useSeparateMobileMedia}
                  onChange={(e) => onUpdate('useSeparateMobileMedia', e.target.checked)}
                  className="w-4 h-4 rounded bg-slate-900 border-white/20 accent-primary-500 cursor-pointer"
                />
              </div>

              {config.useSeparateMobileMedia && (
                <div className="pl-2 border-l-2 border-primary-500/50 flex flex-col gap-2">
                  {renderMediaBox('mobileMediaUrl', 'Mobile Media (Vertical Phone View)', true)}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: ANIMATIONS WITH LIVE PREVIEWS */}
      {activeTab === 'animations' && (
        <div className="flex flex-col gap-5">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-white uppercase tracking-wider">Entrance Animation</label>
              <HelpTooltip content="How this section animates into view when a customer scrolls to it." recommendation="Fade Up is the most elegant for food websites." />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {ENTRANCE_ANIMATION_OPTIONS.map((opt) => (
                <AnimationPreviewBadge
                  key={opt.value}
                  animation={opt.value}
                  label={opt.label}
                  isSelected={(config.animationType || 'None') === opt.value}
                  onClick={() => onUpdate('animationType', opt.value)}
                />
              ))}
            </div>
          </div>

          {/* Animation Duration & Delay Controls */}
          <div className="bg-white/5 p-4 rounded-xl border border-white/5 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white uppercase tracking-wider">Timing & Feel</span>
              <HelpTooltip content="Fine-tune how fast or smooth the movement feels." recommendation="Speed: 500-700 ms, Delay: 0-100 ms." />
            </div>

            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-slate-300 font-medium">Animation Speed</span>
                <span className="font-mono text-primary-400 font-bold">
                  {config.animationSettings?.durationMs || 600} ms
                </span>
              </div>
              <input
                type="range"
                min="200"
                max="1500"
                step="50"
                value={config.animationSettings?.durationMs || 600}
                onChange={(e) =>
                  onUpdate('animationSettings', {
                    ...config.animationSettings,
                    durationMs: Number(e.target.value),
                  })
                }
                className="w-full accent-primary-500 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                <span>Fast (200ms)</span>
                <span>Smooth (600ms)</span>
                <span>Gentle (1500ms)</span>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-slate-300 font-medium">Start Delay</span>
                <span className="font-mono text-primary-400 font-bold">
                  {config.animationSettings?.delayMs || 0} ms
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="800"
                step="50"
                value={config.animationSettings?.delayMs || 0}
                onChange={(e) =>
                  onUpdate('animationSettings', {
                    ...config.animationSettings,
                    delayMs: Number(e.target.value),
                  })
                }
                className="w-full accent-primary-500 cursor-pointer"
              />
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: TYPOGRAPHY MANAGER */}
      {activeTab === 'typography' && (
        <div className="flex flex-col gap-5">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-white uppercase tracking-wider">Font Family</label>
              <HelpTooltip content="Choose a clean, curated font specifically selected for Olive Pizza." recommendation="Outfit or Poppins." />
            </div>

            <div className="grid grid-cols-1 gap-2.5">
              {CURATED_FONTS.map((font) => (
                <FontPreviewBadge
                  key={font}
                  font={font}
                  isSelected={(config.typography?.fontFamily || 'Outfit') === font}
                  onClick={() =>
                    onUpdate('typography', {
                      ...config.typography,
                      fontFamily: font,
                    })
                  }
                />
              ))}
            </div>
          </div>

          {/* Text Animation Presets */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-white uppercase tracking-wider">Title Text Animation</label>
              <HelpTooltip content="Adds engaging motion to the title text as the customer scrolls down." recommendation="Word Reveal or Soft Breathing." />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {TEXT_ANIMATION_OPTIONS.map((opt) => (
                <AnimationPreviewBadge
                  key={opt.value}
                  animation={opt.value}
                  label={opt.label}
                  isSelected={(config.typography?.textAnimation || 'None') === opt.value}
                  onClick={() =>
                    onUpdate('typography', {
                      ...config.typography,
                      textAnimation: opt.value,
                    })
                  }
                />
              ))}
            </div>
          </div>

          {/* Responsive Font Sizing Controls */}
          <div className="bg-white/5 p-4 rounded-xl border border-white/5 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white uppercase tracking-wider">Text Size by Device</span>
              <div className="flex gap-1 bg-black/40 p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => setFontDeviceTab('desktop')}
                  className={`p-1.5 rounded ${fontDeviceTab === 'desktop' ? 'bg-primary-500 text-white' : 'text-slate-400'}`}
                  title="Desktop"
                >
                  <Monitor className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setFontDeviceTab('tablet')}
                  className={`p-1.5 rounded ${fontDeviceTab === 'tablet' ? 'bg-primary-500 text-white' : 'text-slate-400'}`}
                  title="Tablet"
                >
                  <Tablet className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setFontDeviceTab('mobile')}
                  className={`p-1.5 rounded ${fontDeviceTab === 'mobile' ? 'bg-primary-500 text-white' : 'text-slate-400'}`}
                  title="Mobile"
                >
                  <Smartphone className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-300">
                  Heading Size ({fontDeviceTab})
                </span>
                <span className="font-mono text-primary-400 font-bold">
                  {config.typography?.headingSize?.[fontDeviceTab] || (fontDeviceTab === 'mobile' ? 32 : fontDeviceTab === 'tablet' ? 44 : 56)} px
                </span>
              </div>
              <input
                type="range"
                min="20"
                max="80"
                step="2"
                value={config.typography?.headingSize?.[fontDeviceTab] || (fontDeviceTab === 'mobile' ? 32 : fontDeviceTab === 'tablet' ? 44 : 56)}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  const current = config.typography?.headingSize || { desktop: 56, tablet: 44, mobile: 32 };
                  onUpdate('typography', {
                    ...config.typography,
                    headingSize: { ...current, [fontDeviceTab]: val },
                  });
                }}
                className="w-full accent-primary-500 cursor-pointer"
              />
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: DESIGN & LAYOUT */}
      {activeTab === 'design' && (
        <div className="flex flex-col gap-4">
          {/* Alignment */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-300">Text Alignment</label>
              <HelpTooltip content="Align text to the left, center, or right." recommendation="Center for hero banners, Left for menus." />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => onUpdate('layout', { ...config.layout, contentAlignment: 'left' })}
                className={`py-2 px-3 rounded-lg border text-xs font-bold flex items-center justify-center gap-1.5 ${
                  (config.layout?.contentAlignment || 'center') === 'left'
                    ? 'bg-primary-500/20 border-primary-500 text-primary-300'
                    : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                }`}
              >
                <AlignLeft className="w-3.5 h-3.5" /> Left
              </button>
              <button
                type="button"
                onClick={() => onUpdate('layout', { ...config.layout, contentAlignment: 'center' })}
                className={`py-2 px-3 rounded-lg border text-xs font-bold flex items-center justify-center gap-1.5 ${
                  (config.layout?.contentAlignment || 'center') === 'center'
                    ? 'bg-primary-500/20 border-primary-500 text-primary-300'
                    : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                }`}
              >
                <AlignCenter className="w-3.5 h-3.5" /> Center
              </button>
              <button
                type="button"
                onClick={() => onUpdate('layout', { ...config.layout, contentAlignment: 'right' })}
                className={`py-2 px-3 rounded-lg border text-xs font-bold flex items-center justify-center gap-1.5 ${
                  (config.layout?.contentAlignment || 'center') === 'right'
                    ? 'bg-primary-500/20 border-primary-500 text-primary-300'
                    : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                }`}
              >
                <AlignRight className="w-3.5 h-3.5" /> Right
              </button>
            </div>
          </div>

          {/* Section Height */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-300">Section Height</label>
              <HelpTooltip content="Height of this section on customer screens." recommendation="Cinematic or Standard." />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {['compact', 'standard', 'cinematic', 'fullscreen'].map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => onUpdate('layout', { ...config.layout, sectionHeight: h })}
                  className={`py-1.5 px-2 rounded-lg border text-[11px] font-bold capitalize ${
                    (config.layout?.sectionHeight || 'standard') === h
                      ? 'bg-primary-500/20 border-primary-500 text-primary-300'
                      : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                  }`}
                >
                  {h}
                </button>
              ))}
            </div>
          </div>

          {/* Background Overlay & Darkening */}
          <div className="bg-white/5 p-4 rounded-xl border border-white/5 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-white uppercase tracking-wider">Image / Video Darkening</label>
              <HelpTooltip content="Darkens background media so headlines are crystal clear and easy to read." recommendation="40% to 60%." />
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-300">Darken Overlay</span>
                <span className="font-mono text-primary-400 font-bold">
                  {config.background?.overlayOpacity ?? 50}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={config.background?.overlayOpacity ?? 50}
                onChange={(e) =>
                  onUpdate('background', {
                    ...config.background,
                    overlayOpacity: Number(e.target.value),
                  })
                }
                className="w-full accent-primary-500 cursor-pointer"
              />
            </div>
          </div>

          {/* Colors */}
          <div className="bg-white/5 p-4 rounded-xl border border-white/5 flex flex-col gap-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">Colors</h4>
            
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Background Color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={config.styleOverrides?.backgroundColor || '#0f172a'}
                  onChange={(e) =>
                    onUpdate('styleOverrides', { ...config.styleOverrides, backgroundColor: e.target.value })
                  }
                  className="w-8 h-8 rounded cursor-pointer border-none p-0 bg-transparent"
                />
                <input
                  type="text"
                  value={config.styleOverrides?.backgroundColor || '#0f172a'}
                  onChange={(e) =>
                    onUpdate('styleOverrides', { ...config.styleOverrides, backgroundColor: e.target.value })
                  }
                  className="flex-1 bg-black/50 border border-white/10 rounded p-2 text-white text-xs"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Text Color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={config.styleOverrides?.textColor || '#ffffff'}
                  onChange={(e) =>
                    onUpdate('styleOverrides', { ...config.styleOverrides, textColor: e.target.value })
                  }
                  className="w-8 h-8 rounded cursor-pointer border-none p-0 bg-transparent"
                />
                <input
                  type="text"
                  value={config.styleOverrides?.textColor || '#ffffff'}
                  onChange={(e) =>
                    onUpdate('styleOverrides', { ...config.styleOverrides, textColor: e.target.value })
                  }
                  className="flex-1 bg-black/50 border border-white/10 rounded p-2 text-white text-xs"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Media Picker Modal */}
      {activeMediaTarget && (
        <MediaLibraryPicker
          title={activeMediaTarget === 'mobileMediaUrl' ? 'Select Mobile Media' : 'Select Desktop Media'}
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
