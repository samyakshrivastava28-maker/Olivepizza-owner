import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, useMotionValue, useSpring, useTransform, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router';
import { ChevronRight, Sparkles } from 'lucide-react';

const DESKTOP_BG = "https://res.cloudinary.com/dxmlvkff1/image/upload/f_auto,q_auto:best,w_1920/v1783008946/olive-pizza-hero-background_d9rbzc.webp";
const MOBILE_BG = "https://res.cloudinary.com/dxmlvkff1/image/upload/f_auto,q_auto:best,w_750/v1783008965/olive-pizza-mobile-hero_h4g3py.webp";

interface LuxuryHeroProps {
  isStoreOpen: boolean;
  showIntro: boolean;
}

// Particle data — pre-computed to avoid layout thrash
const PARTICLES = Array.from({ length: 18 }, (_, i) => ({
  id: i,
  x: Math.random() * 100,
  y: Math.random() * 100,
  size: Math.random() * 3 + 1,
  duration: Math.random() * 8 + 6,
  delay: Math.random() * 4,
  opacity: Math.random() * 0.35 + 0.08,
}));

const SPICES = ["🌿", "🍅", "🧄", "🫒", "🌶️", "🧀"];

export default function LuxuryHero({ isStoreOpen, showIntro }: LuxuryHeroProps) {
  const heroRef = useRef<HTMLDivElement>(null);
  const [gyroSupported, setGyroSupported] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Parallax values
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const springX = useSpring(mouseX, { stiffness: 50, damping: 20 });
  const springY = useSpring(mouseY, { stiffness: 50, damping: 20 });

  const bgX = useTransform(springX, [-0.5, 0.5], ["-2%", "2%"]);
  const bgY = useTransform(springY, [-0.5, 0.5], ["-2%", "2%"]);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile, { passive: true });

    // Gyroscope for mobile
    if (typeof (DeviceMotionEvent as any).requestPermission === "function") {
      setGyroSupported(false); // iOS requires user gesture
    } else if (window.DeviceOrientationEvent) {
      setGyroSupported(true);
    }

    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Mouse parallax handler (desktop only)
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!heroRef.current || isMobile) return;
    const rect = heroRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    mouseX.set(x);
    mouseY.set(y);
  }, [isMobile, mouseX, mouseY]);

  // Gyroscope parallax (mobile)
  const handleOrientation = useCallback((e: DeviceOrientationEvent) => {
    if (!gyroSupported) return;
    const gamma = Math.max(-20, Math.min(20, e.gamma ?? 0));
    const beta = Math.max(-20, Math.min(20, (e.beta ?? 0) - 45));
    mouseX.set(gamma / 20);
    mouseY.set(beta / 20);
  }, [gyroSupported, mouseX, mouseY]);

  useEffect(() => {
    const hero = heroRef.current;
    if (!hero) return;
    hero.addEventListener("mousemove", handleMouseMove, { passive: true });
    if (gyroSupported) {
      window.addEventListener("deviceorientation", handleOrientation, { passive: true });
    }
    return () => {
      hero.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("deviceorientation", handleOrientation);
    };
  }, [handleMouseMove, handleOrientation, gyroSupported]);

  const delay = showIntro ? 1.2 : 0;

  return (
    <div
      ref={heroRef}
      className="relative w-full overflow-hidden"
      style={{ height: "100svh", minHeight: 640 }}
    >
      {/* ─── Responsive Background Image ───────────────────────────────────── */}
      <motion.div
        className="absolute inset-0 z-0"
        style={{
          x: bgX,
          y: bgY,
          scale: 1.05,
          willChange: "transform",
        }}
      >
        {/* Mobile image — hidden on md+ */}
        <img
          src={MOBILE_BG}
          alt="Olive Pizza Hero"
          fetchPriority="high"
          decoding="async"
          className="absolute inset-0 w-full h-full object-cover md:hidden"
          style={{ objectPosition: "center center" }}
        />
        {/* Desktop image — hidden on mobile */}
        <img
          src={DESKTOP_BG}
          alt="Olive Pizza Hero"
          fetchPriority="high"
          decoding="async"
          className="absolute inset-0 w-full h-full object-cover hidden md:block"
          style={{ objectPosition: "center center" }}
        />
      </motion.div>

      {/* ─── Cinematic Overlays ─────────────────────────────────────────────── */}
      {/* Bottom-to-top primary vignette */}
      <div
        className="absolute inset-0 z-10 pointer-events-none"
        style={{
          background:
            "linear-gradient(to top, rgba(10,10,10,0.97) 0%, rgba(10,10,10,0.75) 30%, rgba(10,10,10,0.30) 60%, rgba(10,10,10,0.10) 100%)",
        }}
      />
      {/* Sides vignette */}
      <div
        className="absolute inset-0 z-10 pointer-events-none hidden md:block"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 50%, rgba(10,10,10,0.5) 100%)",
        }}
      />
      {/* Top cinematic dark bar */}
      <div
        className="absolute top-0 left-0 right-0 h-28 z-10 pointer-events-none"
        style={{
          background:
            "linear-gradient(to bottom, rgba(10,10,10,0.6) 0%, transparent 100%)",
        }}
      />
      {/* Warm amber light ray (top-right, desktop) */}
      <div
        className="absolute top-0 right-0 z-10 pointer-events-none hidden md:block"
        style={{
          width: "40%",
          height: "60%",
          background:
            "radial-gradient(ellipse at top right, rgba(251,146,60,0.08) 0%, transparent 70%)",
        }}
      />

      {/* ─── Floating Ambient Particles ─────────────────────────────────────── */}
      <div className="absolute inset-0 z-20 pointer-events-none overflow-hidden">
        {PARTICLES.map((p) => (
          <motion.div
            key={p.id}
            className="absolute rounded-full bg-white"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: p.size,
              height: p.size,
              opacity: p.opacity,
              willChange: "transform, opacity",
            }}
            animate={{
              y: [0, -30, 0],
              opacity: [p.opacity, p.opacity * 2.5, p.opacity],
            }}
            transition={{
              duration: p.duration,
              delay: p.delay,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        ))}

        {/* Floating spice emojis — subtle, barely visible */}
        {SPICES.map((spice, i) => (
          <motion.span
            key={spice}
            className="absolute text-xl select-none"
            style={{
              left: `${10 + i * 15}%`,
              top: `${15 + (i % 3) * 20}%`,
              opacity: 0.07,
              willChange: "transform",
            }}
            animate={{
              y: [0, -20, 0],
              rotate: [0, i % 2 === 0 ? 10 : -10, 0],
            }}
            transition={{
              duration: 7 + i,
              delay: i * 0.8,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>

      {/* ─── Hero Content ────────────────────────────────────────────────────── */}
      <div className="absolute inset-0 z-30 flex flex-col justify-end md:justify-center items-start">
        {/* Mobile layout: bottom-aligned */}
        <div className="w-full px-5 pb-[130px] md:pb-0 md:px-16 lg:px-24 md:max-w-3xl">

          {/* Premium badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay }}
            className="inline-flex items-center gap-2 mb-5 md:mb-6"
          >
            <div
              className="flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-black tracking-[0.15em] uppercase"
              style={{
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.15)",
                backdropFilter: "blur(12px)",
                color: "#fbbf24",
              }}
            >
              <Sparkles className="w-3 h-3" />
              Premium Artisan Pizza
            </div>
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.85, delay: delay + 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="text-[2.8rem] md:text-[4.5rem] lg:text-[5.5rem] font-black text-white leading-[1.05] tracking-tight mb-4 md:mb-5"
          >
            Crafted for
            <br />
            <span
              style={{
                background: "linear-gradient(135deg, #fb923c 0%, #fbbf24 50%, #f97316 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              Connoisseurs.
            </span>
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: delay + 0.22, ease: "easeOut" }}
            className="text-base md:text-xl text-slate-300 font-medium leading-relaxed mb-8 md:mb-10 max-w-md"
          >
            Handcrafted with premium ingredients. Delivered hot to your door in minutes.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: delay + 0.35, ease: "easeOut" }}
            className="flex flex-col sm:flex-row gap-3 sm:gap-4 w-full sm:w-auto"
          >
            <Link to="/menu" className="group relative w-full sm:w-auto">
              <span
                className="absolute inset-0 rounded-2xl blur-lg opacity-0 group-hover:opacity-60 transition-opacity duration-500"
                style={{ background: "linear-gradient(135deg, #f97316, #fbbf24)" }}
              />
              <span
                className="relative flex items-center justify-center gap-2.5 w-full sm:w-auto px-8 py-4 rounded-2xl font-black text-base text-white transition-all duration-300 group-hover:-translate-y-1 group-active:scale-95"
                style={{
                  background: "linear-gradient(135deg, #ea580c 0%, #f97316 50%, #fb923c 100%)",
                  boxShadow: "0 8px 32px rgba(249, 115, 22, 0.4), 0 2px 8px rgba(0,0,0,0.3)",
                }}
              >
                {isStoreOpen ? "Order Now" : "View Menu"}
                <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-200" />
              </span>
            </Link>

            <Link
              to="/menu"
              className="group flex items-center justify-center gap-2 w-full sm:w-auto px-8 py-4 rounded-2xl font-bold text-base text-white transition-all duration-300 hover:-translate-y-1 active:scale-95"
              style={{
                background: "rgba(255,255,255,0.07)",
                border: "1px solid rgba(255,255,255,0.18)",
                backdropFilter: "blur(16px)",
                boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
              }}
            >
              Explore Menu
            </Link>
          </motion.div>

          {/* Stats row */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: delay + 0.55 }}
            className="flex items-center gap-6 mt-8 md:mt-10"
          >
            {[
              { value: "4.9★", label: "Rating" },
              { value: "30min", label: "Delivery" },
              { value: "100%", label: "Fresh" },
            ].map((stat) => (
              <div key={stat.label} className="flex flex-col">
                <span className="text-white font-black text-lg md:text-xl leading-none">
                  {stat.value}
                </span>
                <span className="text-slate-400 text-xs font-medium mt-0.5">
                  {stat.label}
                </span>
              </div>
            ))}
          </motion.div>
        </div>
      </div>

      {/* ─── Scroll indicator ───────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: delay + 1.2, duration: 0.8 }}
        className="absolute bottom-32 md:bottom-10 left-1/2 -translate-x-1/2 z-30 hidden md:flex flex-col items-center gap-2"
      >
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          className="w-6 h-9 border-2 border-white/20 rounded-full flex items-center justify-center"
        >
          <div className="w-1.5 h-2.5 bg-white/40 rounded-full" />
        </motion.div>
        <span className="text-[10px] font-bold text-white/30 tracking-widest uppercase">
          Scroll
        </span>
      </motion.div>
    </div>
  );
}

