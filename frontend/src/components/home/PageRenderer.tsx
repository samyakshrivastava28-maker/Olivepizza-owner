import React from 'react';
import { PageSchema, SimplifiedSectionSchema } from '../../types/PageSchema';
import LiveAdvertisements from './LiveAdvertisements';
import LiveMenuCategories from './LiveMenuCategories';
import CravingCategoriesSection from './CravingCategoriesSection';
import LiveCoupons from './LiveCoupons';
import FeaturedShowcase from './FeaturedShowcase';
import AppDownloadSection from './AppDownloadSection';
import LuxuryHero from '../ui/LuxuryHero';

// Premium sections
import HeroVideo from './sections/HeroVideo';
import PizzaShowcase3D from './sections/PizzaShowcase3D';
import CountdownBanner from './sections/CountdownBanner';
import GallerySection from './sections/GallerySection';
import TestimonialsSection from './sections/TestimonialsSection';

interface PageRendererProps {
  schema: PageSchema;
  isEditorMode?: boolean;
  onElementSelect?: (sectionId: string, elementId?: string) => void;
  selectedSectionId?: string | null;
  viewMode?: 'mobile' | 'tablet' | 'desktop';
}

const renderSection = (
  section: SimplifiedSectionSchema, 
  isEditorMode: boolean, 
  onElementSelect?: (sid: string, eid?: string) => void,
  selectedSectionId?: string | null,
  viewMode: 'mobile' | 'tablet' | 'desktop' = 'mobile'
) => {
  if (section.isHidden && !isEditorMode) return null;
  
  const opacity = section.isHidden ? 'opacity-30' : 'opacity-100';
  const isSelected = selectedSectionId === section.id;
  const borderClass = isEditorMode
    ? isSelected 
      ? 'ring-2 ring-primary-500 bg-primary-500/5 rounded-2xl transition-all cursor-pointer' 
      : 'border border-dashed border-white/20 hover:border-primary-500 hover:bg-white/5 m-2 p-1.5 rounded-2xl transition-all cursor-pointer'
    : '';

  const isMobile = viewMode === 'mobile';
  const activeMediaUrl = (isMobile && section.config.useSeparateMobileMedia && section.config.mobileMediaUrl) 
    ? section.config.mobileMediaUrl 
    : (section.config.mediaUrl || '');

  const isVideo = activeMediaUrl.match(/\.(mp4|mov|webm)(\?.*)?$/i) || activeMediaUrl.includes('/video/upload/');

  const normalizedType = (section.type || '').toUpperCase();

  let Component = null;
  switch (normalizedType) {
    case 'HERO':
      Component = !activeMediaUrl ? (
        <div className={opacity}>
          <LuxuryHero isStoreOpen={true} showIntro={false} />
        </div>
      ) : (
        <div 
          className={`relative min-h-[360px] sm:min-h-[450px] md:min-h-[550px] flex items-center justify-center p-6 text-center rounded-3xl overflow-hidden shadow-2xl ${opacity}`}
          style={{ backgroundColor: section.config.styleOverrides?.backgroundColor || '#0f172a' }}
        >
          {isVideo ? (
            <video 
              src={activeMediaUrl} 
              autoPlay 
              muted 
              loop 
              playsInline 
              className="absolute inset-0 w-full h-full object-cover opacity-55 z-0" 
            />
          ) : (
            <img 
              src={activeMediaUrl} 
              alt="Hero Media" 
              className="absolute inset-0 w-full h-full object-cover opacity-55 z-0" 
            />
          )}

          <div className="relative z-10 max-w-3xl">
            <h2 
              className="text-3xl sm:text-5xl md:text-6xl font-black mb-4 tracking-tight drop-shadow-md"
              style={{ color: section.config.styleOverrides?.textColor || '#ffffff' }}
            >
              {section.config.headline || 'Olive Pizza'}
            </h2>
            {section.config.subtitle && (
              <p 
                className="text-base sm:text-xl md:text-2xl mb-6 font-medium drop-shadow"
                style={{ color: section.config.styleOverrides?.textColor || '#cbd5e1' }}
              >
                {section.config.subtitle}
              </p>
            )}
            {section.config.buttonText && (
              <button className="px-8 py-3.5 bg-gradient-to-r from-primary-500 to-amber-500 hover:from-primary-600 hover:to-amber-600 text-white font-bold rounded-full text-base sm:text-lg shadow-xl shadow-primary-500/30 transition-transform hover:scale-105">
                {section.config.buttonText}
              </button>
            )}
          </div>
        </div>
      );
      break;
    case 'VIDEO_HERO':
      Component = <div className={opacity}><HeroVideo config={section.config} viewMode={viewMode} /></div>;
      break;
    case 'PIZZA_SHOWCASE':
      Component = <div className={opacity}><PizzaShowcase3D config={section.config} viewMode={viewMode} /></div>;
      break;
    case 'COUNTDOWN':
      Component = <div className={opacity}><CountdownBanner config={section.config} /></div>;
      break;
    case 'TESTIMONIALS':
      Component = <div className={opacity}><TestimonialsSection config={section.config} /></div>;
      break;
    case 'GALLERY':
      Component = <div className={opacity}><GallerySection config={section.config} /></div>;
      break;
    case 'ADS':
    case 'ADVERTISEMENTS':
    case 'PROMOTIONS':
      Component = <div className={opacity}><LiveAdvertisements /></div>;
      break;
    case 'CRAVINGS':
    case 'CRAVING_CATEGORIES':
      Component = <div className={opacity}><CravingCategoriesSection config={section.config} /></div>;
      break;
    case 'CATEGORIES':
      Component = null; // Suppressed obsolete duplicate categories section
      break;
    case 'COUPONS':
      Component = <div className={opacity}><LiveCoupons /></div>;
      break;
    case 'FEATURED':
    case 'RECOMMENDATIONS':
      Component = <div className={opacity}><FeaturedShowcase /></div>;
      break;
    case 'DOWNLOAD_APP':
    case 'APP':
      Component = <div className={opacity}><AppDownloadSection /></div>;
      break;
    default:
      Component = <div className={`text-white p-4 bg-white/5 border border-white/10 ${opacity}`}>Unknown Section Type: {section.type}</div>;
  }

  return (
    <div 
      key={section.id} 
      className={`relative ${borderClass}`}
      onClick={(e) => {
        if (isEditorMode && onElementSelect) {
          e.stopPropagation();
          onElementSelect(section.id);
        }
      }}
    >
      {isEditorMode && (
        <div className="absolute top-3 right-3 bg-black/70 backdrop-blur-md text-[10px] text-white px-2.5 py-1 rounded-lg border border-white/10 shadow-lg z-30 pointer-events-none uppercase tracking-wider font-bold">
          {section.type}
        </div>
      )}
      {Component}
    </div>
  );
};

export default function PageRenderer({ schema, isEditorMode = false, onElementSelect, selectedSectionId, viewMode = 'mobile' }: PageRendererProps) {
  if (!schema) return null;

  if (schema.type === 'CUSTOM_STATIC_PACKAGE') {
    const src = `${schema.r2Url}/${schema.entryFile}`;
    return (
      <div className="w-full h-full min-h-screen relative">
        {isEditorMode && (
          <div className="absolute inset-0 bg-transparent z-50" onClick={() => onElementSelect && onElementSelect('iframe-root')}>
            {/* Overlay to catch clicks in editor mode for Custom Packages */}
          </div>
        )}
        <iframe 
          src={src} 
          sandbox="allow-scripts allow-same-origin"
          className={`w-full h-full min-h-[800px] border-none bg-white ${isEditorMode && selectedSectionId === 'iframe-root' ? 'ring-4 ring-primary-500' : ''}`}
          title="Custom Static Package"
        />
      </div>
    );
  }

  // Filter out any obsolete duplicate categories sections from schema and deduplicate cravings
  const cleanSections = (schema.sections || []).filter((s, idx, arr) => {
    const type = (s.type || '').toUpperCase();
    if (type === 'CATEGORIES') return false; // Remove obsolete duplicate categories
    if (type === 'CRAVINGS' || type === 'CRAVING_CATEGORIES') {
      const firstIdx = arr.findIndex((item) =>
        ['CRAVINGS', 'CRAVING_CATEGORIES'].includes((item.type || '').toUpperCase())
      );
      if (idx !== firstIdx) return false;
    }
    return true;
  });

  // Check if sections array explicitly includes an ads section
  const hasAdsSection = cleanSections.some(
    (s) => ['ADS', 'ADVERTISEMENTS', 'PROMOTIONS'].includes((s.type || '').toUpperCase()) && !s.isHidden
  );

  return (
    <div className="w-full flex flex-col gap-6 py-6 relative z-10">
      {cleanSections.map((section) => {
        const isCravings = ['CRAVINGS', 'CRAVING_CATEGORIES'].includes((section.type || '').toUpperCase());
        return (
          <React.Fragment key={section.id}>
            {renderSection(section, isEditorMode, onElementSelect, selectedSectionId, viewMode)}
            {/* If schema didn't contain an explicit ADS section, guarantee published Ads appear directly below Cravings section */}
            {!hasAdsSection && isCravings && (
              <div key={`auto-ads-${section.id}`}>
                <LiveAdvertisements />
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
