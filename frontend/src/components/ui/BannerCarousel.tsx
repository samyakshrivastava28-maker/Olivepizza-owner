import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router';
import { trackEvent } from '../../lib/analytics';

interface Banner {
  id: string;
  title: string;
  description?: string;
  mediaUrl: string;
  mediaType?: string;
  ctaText?: string;
  ctaLink?: string;
  ctaType?: 'product' | 'category' | 'special_category' | 'combo' | 'coupon' | 'url' | 'internal';
}

interface BannerCarouselProps {
  banners: Banner[];
  autoPlayMs?: number;
  className?: string;
}

export default function BannerCarousel({ banners, autoPlayMs = 5000, className = '' }: BannerCarouselProps) {
  const [current, setCurrent] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const touchStartX = useRef(0);
  const navigate = useNavigate();

  const go = useCallback((index: number) => {
    setCurrent(((index % banners.length) + banners.length) % banners.length);
  }, [banners.length]);

  // Auto-slide
  useEffect(() => {
    if (isHovered || banners.length <= 1) return;
    intervalRef.current = setInterval(() => go(current + 1), autoPlayMs);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [current, isHovered, autoPlayMs, go, banners.length]);

  // Intersection Observer for impression tracking
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!containerRef.current || banners.length === 0) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && banners[current]) {
          trackEvent({ type: 'ad_view', adId: banners[current].id });
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [current, banners]);

  if (banners.length === 0) return null;

  const handleBannerClick = (banner: Banner) => {
    trackEvent({ type: 'ad_click', adId: banner.id, targetUrl: banner.ctaLink });
    if (!banner.ctaLink) return;
    if (banner.ctaType === 'url') {
      window.open(banner.ctaLink, '_blank', 'noopener');
    } else {
      navigate(banner.ctaLink);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) go(diff > 0 ? current + 1 : current - 1);
  };

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden rounded-2xl md:rounded-3xl group ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={current}
          initial={{ opacity: 0, scale: 1.04 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.97 }}
          transition={{ duration: 0.6, ease: 'easeInOut' }}
          className="relative aspect-[21/7] md:aspect-[21/6] min-h-[180px] w-full cursor-pointer"
          onClick={() => handleBannerClick(banners[current])}
        >
          {banners[current].mediaType === 'video' ? (
            <video
              src={banners[current].mediaUrl}
              autoPlay muted loop playsInline
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <img
              src={banners[current].mediaUrl.replace('/upload/', '/upload/f_auto,q_auto,w_1400/')}
              alt={banners[current].title}
              className="absolute inset-0 w-full h-full object-cover"
              loading="lazy"
            />
          )}

          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/30 to-transparent" />

          {/* Text overlay */}
          <div className="absolute inset-0 flex flex-col justify-end p-6 md:p-10">
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              <h3 className="text-xl md:text-3xl font-black text-white mb-1 drop-shadow-lg">
                {banners[current].title}
              </h3>
              {banners[current].description && (
                <p className="text-sm md:text-base text-white/80 mb-3 font-medium max-w-xs md:max-w-lg line-clamp-2">
                  {banners[current].description}
                </p>
              )}
              {banners[current].ctaText && (
                <span className="inline-block bg-primary-600 text-white px-5 py-2 rounded-full text-sm font-bold hover:bg-primary-500 transition-colors shadow-lg">
                  {banners[current].ctaText}
                </span>
              )}
            </motion.div>
          </div>

          {/* Glass status badge */}
          <div className="absolute top-3 right-3 bg-black/40 backdrop-blur-md border border-white/20 text-white text-xs font-bold px-3 py-1 rounded-full">
            {current + 1} / {banners.length}
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Navigation arrows */}
      {banners.length > 1 && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); go(current - 1); }}
            className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/50 backdrop-blur-sm text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-all hover:bg-black/70 border border-white/20"
            aria-label="Previous banner"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); go(current + 1); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/50 backdrop-blur-sm text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-all hover:bg-black/70 border border-white/20"
            aria-label="Next banner"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </>
      )}

      {/* Dot indicators */}
      {banners.length > 1 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
          {banners.map((_, i) => (
            <button
              key={i}
              onClick={(e) => { e.stopPropagation(); go(i); }}
              className={`h-1.5 rounded-full transition-all duration-300 ${i === current ? 'w-6 bg-primary-400' : 'w-1.5 bg-white/50'}`}
              aria-label={`Go to banner ${i + 1}`}
            />
          ))}
        </div>
      )}

      {/* Progress bar */}
      {!isHovered && banners.length > 1 && (
        <motion.div
          key={`progress-${current}`}
          className="absolute bottom-0 left-0 h-0.5 bg-primary-500"
          initial={{ width: '0%' }}
          animate={{ width: '100%' }}
          transition={{ duration: autoPlayMs / 1000, ease: 'linear' }}
        />
      )}
    </div>
  );
}
