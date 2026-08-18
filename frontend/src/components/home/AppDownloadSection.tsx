import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Download, QrCode, Smartphone, Zap, WifiOff, BellRing, Bot, Gift, CheckCircle2, Sparkles } from 'lucide-react';
import { isCapacitorNative } from '../../lib/platform';

export default function AppDownloadSection() {
  const [apkUrl, setApkUrl] = useState<string>("https://github.com/samyakshrivastava28-maker/Olive-Pizza/releases/latest");
  const [apkSize, setApkSize] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Hide section completely if running inside native Android/iOS shell
  if (isCapacitorNative()) {
    return null;
  }

  useEffect(() => {
    // Fetch latest GitHub APK release link from backend endpoint
    const fetchLatestRelease = async () => {
      try {
        const res = await fetch("/api/github/latest-release");
        if (res.ok) {
          const data = await res.json();
          if (data?.apk?.downloadUrl) {
            setApkUrl(data.apk.downloadUrl);
          }
          if (data?.apk?.size) {
            setApkSize((data.apk.size / (1024 * 1024)).toFixed(1) + " MB");
          }
        }
      } catch (err) {
        console.warn("Could not fetch latest release URL:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchLatestRelease();
  }, []);

  // Generate QR Code image URL pointing to the APK URL
  const qrCodeImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(apkUrl)}&color=f97316&bgcolor=000000`;

  const features = [
    { icon: Zap, title: "1-Tap Ultra Speed", desc: "Instant checkout with cached user preferences" },
    { icon: WifiOff, title: "Offline Support", desc: "Browse menu & draft orders even without internet" },
    { icon: BellRing, title: "Realtime Tracking", desc: "Push updates as your pizza enters the oven" },
    { icon: Bot, title: "AI Voice Assistant", desc: "Order by talking directly to Olive AI" },
    { icon: Gift, title: "App Exclusive Deals", desc: "Extra 15% discount on all mobile app orders" },
  ];

  return (
    <section className="relative py-20 sm:py-28 overflow-hidden z-10">
      {/* Ambient background blur circles */}
      <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-96 h-96 bg-primary-500/10 blur-[120px] pointer-events-none rounded-full" />
      <div className="absolute top-1/2 right-1/4 -translate-y-1/2 w-96 h-96 bg-emerald-500/10 blur-[120px] pointer-events-none rounded-full" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="relative rounded-3xl overflow-hidden border border-white/10 p-8 sm:p-14 backdrop-blur-2xl"
          style={{
            background: "linear-gradient(135deg, rgba(24, 24, 27, 0.95) 0%, rgba(9, 9, 11, 0.98) 100%)",
            boxShadow: "0 20px 60px rgba(0, 0, 0, 0.8)",
          }}>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            {/* Left Content Column */}
            <div className="lg:col-span-7">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary-500/10 border border-primary-500/20 text-primary-400 mb-4 backdrop-blur-md">
                <Sparkles className="w-4 h-4 animate-spin" />
                <span className="text-xs font-black uppercase tracking-wider">
                  Native Android Experience
                </span>
              </div>

              <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight mb-4">
                Get The <span className="bg-gradient-to-r from-primary-400 via-amber-300 to-orange-500 bg-clip-text text-transparent">Olive Pizza App</span>
              </h2>

              <p className="text-slate-300 text-sm sm:text-base font-medium mb-8 leading-relaxed max-w-xl">
                Experience lightning-fast ordering, offline menu browsing, real-time live order tracking, and app-exclusive coupons directly on your phone.
              </p>

              {/* App Features List */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                {features.map((f, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-2xl bg-white/5 border border-white/5">
                    <div className="p-2 rounded-xl bg-primary-500/10 text-primary-400 shrink-0">
                      <f.icon className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white">{f.title}</h4>
                      <p className="text-[11px] text-slate-400 font-medium leading-tight mt-0.5">{f.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Action Buttons & QR Code */}
              <div className="flex flex-col sm:flex-row items-center gap-6 pt-4 border-t border-white/10">
                <a
                  href={apkUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-primary-500 to-amber-500 hover:from-primary-600 hover:to-amber-600 text-white font-extrabold text-sm sm:text-base flex items-center justify-center gap-3 shadow-xl shadow-primary-500/30 transition-all hover:scale-105 active:scale-95"
                >
                  <Download className="w-5 h-5 animate-bounce" />
                  <span>Download APK {apkSize ? `(${apkSize})` : ""}</span>
                </a>

                {/* QR Code Container */}
                <div className="flex items-center gap-3 bg-black/60 p-2.5 rounded-2xl border border-white/10">
                  <img
                    src={qrCodeImageUrl}
                    alt="Scan to download Olive Pizza App"
                    className="w-16 h-16 rounded-xl border border-white/10"
                  />
                  <div className="text-left pr-2">
                    <p className="text-xs font-extrabold text-white flex items-center gap-1">
                      <QrCode className="w-3.5 h-3.5 text-primary-400" /> Scan QR Code
                    </p>
                    <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                      Point phone camera to install
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: 3D Floating Phone Mockup */}
            <div className="lg:col-span-5 flex justify-center">
              <motion.div
                animate={{
                  y: [0, -14, 0],
                  rotate: [0, 1.5, 0],
                }}
                transition={{
                  duration: 6,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                className="relative w-64 sm:w-72 aspect-[9/19] rounded-[42px] border-4 border-slate-700 bg-black p-3 shadow-2xl shadow-primary-500/20"
                style={{
                  boxShadow: "0 25px 60px -15px rgba(249, 115, 22, 0.3)",
                }}
              >
                {/* Phone Top Speaker Notch */}
                <div className="absolute top-5 left-1/2 -translate-x-1/2 w-24 h-4 bg-slate-950 rounded-full border border-white/10 z-30 flex items-center justify-center">
                  <div className="w-3 h-3 rounded-full bg-black border border-slate-700" />
                </div>

                {/* Phone Screen Mockup Content */}
                <div className="relative w-full h-full rounded-[32px] overflow-hidden bg-dark-950 flex flex-col justify-between pt-8 pb-4 px-4 text-left border border-white/5">
                  {/* Mock App Header */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-primary-500 flex items-center justify-center text-xs font-black text-white">
                          🍕
                        </div>
                        <span className="text-xs font-black text-white">Olive Pizza</span>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-500/20 text-emerald-400">
                        ONLINE
                      </span>
                    </div>

                    {/* Mock Pizza Banner Card */}
                    <div className="rounded-2xl bg-gradient-to-br from-orange-500/20 to-amber-500/10 p-3 border border-orange-500/30 mb-3">
                      <p className="text-[10px] font-black text-amber-300 uppercase">Chef's Special</p>
                      <p className="text-xs font-bold text-white mt-0.5">Wood-Fired Truffle Pizza</p>
                      <span className="text-xs font-black text-orange-400 mt-1 block">₹399</span>
                    </div>

                    {/* Mock Menu Quick Buttons */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-2 rounded-xl bg-white/5 border border-white/10 text-center">
                        <span className="text-xs">🍕 Pizzas</span>
                      </div>
                      <div className="p-2 rounded-xl bg-white/5 border border-white/10 text-center">
                        <span className="text-xs">🥗 Sides</span>
                      </div>
                    </div>
                  </div>

                  {/* Mock Floating Cart Button */}
                  <div className="p-3 rounded-2xl bg-primary-500 text-white flex items-center justify-between font-bold text-xs shadow-lg shadow-primary-500/40">
                    <span>🛒 View Cart (2 items)</span>
                    <span>₹648</span>
                  </div>
                </div>
              </motion.div>
            </div>

          </div>
        </div>
      </div>
    </section>
  );
}
