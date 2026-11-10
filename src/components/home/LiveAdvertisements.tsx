import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, ChevronLeft, ChevronRight, Volume2, VolumeX, ExternalLink, Tag } from 'lucide-react';
import { useDataStore } from '../../lib/dataStore';
import { isItemActiveAndValid } from '../../lib/scheduling';
import { db } from '../../lib/firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { Link } from 'react-router';

interface AdItem {
  id: string;
  title: string;
  description: string;
  mediaUrl?: string;
  imageUrl?: string;
  image?: string;
  bannerUrl?: string;
  bannerImage?: string;
  url?: string;
  mediaType?: "image" | "video";
  ctaText?: string;
  ctaLink?: string;
  ctaType?: "internal" | "external";
  tag?: string;
  isActive?: boolean;
  startDate?: string;
  endDate?: string;
  expiryDate?: string;
  createdAt?: string;
}

export default function LiveAdvertisements() {
  const { ads: storeAds } = useDataStore();
  const [liveAds, setLiveAds] = useState<AdItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Real-time Firestore subscription to guarantee 0ms latency when owner publishes/toggles an ad
  useEffect(() => {
    try {
      const q = query(collection(db, "ads"), orderBy("createdAt", "desc"));
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const fetchedAds = snapshot.docs.map((d) => ({
            id: d.id,
            ...(d.data() as any),
          }));
          setLiveAds(fetchedAds);
        },
        (error) => {
          console.warn("[LiveAdvertisements] Firestore direct onSnapshot notice:", error);
        }
      );
      return () => unsubscribe();
    } catch (e) {
      console.warn("[LiveAdvertisements] Subscription error fallback:", e);
    }
  }, []);

  const activeAds: AdItem[] = useMemo(() => {
    const source = liveAds.length > 0 ? liveAds : (storeAds || []);
    return source.filter((ad: any) => {
      if (!ad) return false;
      if (ad.isActive === false) return false;
      return isItemActiveAndValid(ad);
    });
  }, [liveAds, storeAds]);

  // Auto rotate banner every 7 seconds
  useEffect(() => {
    if (activeAds.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % activeAds.length);
    }, 7000);
    return () => clearInterval(interval);
  }, [activeAds.length]);

  if (activeAds.length === 0) return null;

  const currentAd = activeAds[currentIndex % activeAds.length];
  const mediaSrc =
    currentAd.mediaUrl ||
    currentAd.imageUrl ||
    currentAd.image ||
    currentAd.bannerUrl ||
    currentAd.bannerImage ||
    currentAd.url ||
    "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=1600&q=80";

  const isVideo =
    currentAd.mediaType === "video" ||
    /\.(mp4|mov|webm)(\?.*)?$/i.test(mediaSrc) ||
    mediaSrc.includes("/video/upload/");

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + activeAds.length) % activeAds.length);
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % activeAds.length);
  };

  return (
    <section className="relative py-8 sm:py-12 overflow-hidden z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Section Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 backdrop-blur-md mb-2">
              <Sparkles className="w-3.5 h-3.5 text-purple-400 animate-pulse" />
              <span className="text-xs font-black uppercase tracking-wider text-purple-300">
                Special Announcements
              </span>
            </div>
            <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
              Featured <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-orange-400 bg-clip-text text-transparent">Promotions & News</span>
            </h2>
          </div>

          {/* Carousel Arrows */}
          {activeAds.length > 1 && (
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrev}
                className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/15 border border-white/10 text-white flex items-center justify-center transition-colors"
                aria-label="Previous announcement"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={handleNext}
                className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/15 border border-white/10 text-white flex items-center justify-center transition-colors"
                aria-label="Next announcement"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>

        {/* Main 3D Transition Banner Container */}
        <div className="relative rounded-3xl overflow-hidden border border-white/10 shadow-2xl bg-dark-900 aspect-[16/9] sm:aspect-[21/9] max-h-[500px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentAd.id || currentIndex}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="absolute inset-0 w-full h-full flex flex-col justify-end p-6 sm:p-12"
            >
              {/* Media Element: Image vs Video */}
              {isVideo ? (
                <div className="absolute inset-0 w-full h-full z-0 overflow-hidden">
                  <video
                    ref={videoRef}
                    src={mediaSrc}
                    autoPlay
                    loop
                    muted={isMuted}
                    playsInline
                    className="w-full h-full object-cover"
                  />
                  <button
                    onClick={() => setIsMuted(!isMuted)}
                    className="absolute top-4 right-4 z-20 p-2.5 rounded-full bg-black/60 backdrop-blur-md border border-white/20 text-white hover:bg-black/80 transition-colors"
                  >
                    {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  </button>
                </div>
              ) : (
                <img
                  src={mediaSrc}
                  alt={currentAd.title || "Olive Pizza Promotion"}
                  className="absolute inset-0 w-full h-full object-cover z-0"
                />
              )}

              {/* Gradient Dark Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-dark-950 via-dark-950/70 to-transparent z-10" />
              <div className="absolute inset-0 bg-gradient-to-r from-dark-950/90 via-dark-950/40 to-transparent z-10" />

              {/* Content Overlay */}
              <div className="relative z-20 max-w-2xl">
                {/* Ad Tag Badge */}
                {currentAd.tag && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-orange-500 text-white shadow-lg mb-3">
                    <Tag className="w-3 h-3" />
                    {currentAd.tag}
                  </span>
                )}

                <h3 className="text-2xl sm:text-4xl md:text-5xl font-black text-white tracking-tight mb-3 leading-tight">
                  {currentAd.title}
                </h3>

                <p className="text-slate-300 text-sm sm:text-base font-medium mb-6 line-clamp-2 sm:line-clamp-3 leading-relaxed">
                  {currentAd.description}
                </p>

                {/* CTA Button */}
                {currentAd.ctaText && (
                  <div>
                    {currentAd.ctaType === "external" ? (
                      <a
                        href={currentAd.ctaLink || "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-primary-500 to-amber-500 hover:from-primary-600 hover:to-amber-600 text-white font-bold text-sm shadow-xl shadow-primary-500/30 transition-all hover:scale-105"
                      >
                        {currentAd.ctaText} <ExternalLink className="w-4 h-4" />
                      </a>
                    ) : (
                      <Link
                        to={currentAd.ctaLink || "/menu"}
                        className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-primary-500 to-amber-500 hover:from-primary-600 hover:to-amber-600 text-white font-bold text-sm shadow-xl shadow-primary-500/30 transition-all hover:scale-105"
                      >
                        {currentAd.ctaText} &rarr;
                      </Link>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Dots Indicator Bar */}
          {activeAds.length > 1 && (
            <div className="absolute bottom-4 right-6 z-30 flex items-center gap-2">
              {activeAds.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentIndex(idx)}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    idx === currentIndex % activeAds.length
                      ? "w-8 bg-primary-400"
                      : "w-2 bg-white/40 hover:bg-white/70"
                  }`}
                  aria-label={`Go to ad ${idx + 1}`}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
