import React from 'react';
import { Link } from 'react-router';
import {
  MapPin,
  Phone,
  Mail,
  Clock,
  ShieldCheck,
  Sparkles,
  ExternalLink,
  MessageCircle,
  Navigation,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useStoreStatus } from '../../lib/useStoreStatus';

// Custom SVG Social Icons
const InstagramIcon = () => (
  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
  </svg>
);

const FacebookIcon = () => (
  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
    <path d="M9 8H6v4h3v12h5V12h3.642L18 8h-4V6.333C14 5.374 14.5 5 15.5 5H18V0h-3.808C10.592 0 9 1.583 9 4.615V8z" />
  </svg>
);

const TwitterIcon = () => (
  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const YoutubeIcon = () => (
  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
  </svg>
);

export default function FlagshipFooter() {
  const storeStatus = useStoreStatus();

  const socialLinks = [
    { name: "Instagram", icon: InstagramIcon, href: "https://instagram.com", color: "hover:text-pink-400 hover:border-pink-500/50 hover:bg-pink-500/10" },
    { name: "Facebook", icon: FacebookIcon, href: "https://facebook.com", color: "hover:text-blue-400 hover:border-blue-500/50 hover:bg-blue-500/10" },
    { name: "Twitter", icon: TwitterIcon, href: "https://twitter.com", color: "hover:text-cyan-400 hover:border-cyan-500/50 hover:bg-cyan-500/10" },
    { name: "YouTube", icon: YoutubeIcon, href: "https://youtube.com", color: "hover:text-red-400 hover:border-red-500/50 hover:bg-red-500/10" },
    { name: "WhatsApp", icon: MessageCircle, href: "https://wa.me/919876543210", color: "hover:text-emerald-400 hover:border-emerald-500/50 hover:bg-emerald-500/10" },
  ];

  return (
    <footer className="relative bg-dark-950 border-t border-white/10 pt-12 md:pt-16 pb-24 md:pb-12 z-10 overflow-hidden text-slate-400">
      {/* Background ambient lighting */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-64 bg-gradient-to-t from-primary-500/10 via-amber-500/5 to-transparent blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-8 lg:gap-10 pb-10 border-b border-white/10">
          
          {/* Brand & Slogan Column */}
          <div className="sm:col-span-2 lg:col-span-1 space-y-4">
            <Link to="/" className="inline-flex items-center gap-2">
              <span className="text-3xl">🍕</span>
              <span className="text-2xl font-black text-white tracking-tight">
                OLIVE <span className="text-primary-400">PIZZA</span>
              </span>
            </Link>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed font-medium">
              100% Pure Veg Gourmet Pizzeria. Hand-stretched sourdough crusts, organic ingredients, and wood-fired to perfection.
            </p>

            {/* Social Animated Icons */}
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-3">Connect With Us</p>
              <div className="flex items-center gap-2.5 flex-wrap">
                {socialLinks.map((s) => (
                  <motion.a
                    key={s.name}
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    whileHover={{ scale: 1.15, y: -2 }}
                    whileTap={{ scale: 0.95 }}
                    aria-label={s.name}
                    className={`w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 transition-all duration-300 ${s.color}`}
                  >
                    <s.icon />
                  </motion.a>
                ))}
              </div>
            </div>
          </div>

          {/* Company Links (Available routes only) */}
          <div>
            <h4 className="text-white font-black text-xs uppercase tracking-widest mb-4">Company</h4>
            <ul className="space-y-2.5 text-xs sm:text-sm font-medium">
              <li><Link to="/about" className="hover:text-primary-400 transition-colors">About Olive Pizza</Link></li>
              <li><Link to="/contact" className="hover:text-primary-400 transition-colors">Careers</Link></li>
              <li><Link to="/contact" className="hover:text-primary-400 transition-colors">Contact Us</Link></li>
              <li><Link to="/delete-account" className="hover:text-red-400 transition-colors">Data Deletion</Link></li>
            </ul>
          </div>

          {/* Legal Links (Available routes only) */}
          <div>
            <h4 className="text-white font-black text-xs uppercase tracking-widest mb-4">Legal</h4>
            <ul className="space-y-2 text-xs font-medium">
              <li><Link to="/privacy-policy" className="hover:text-primary-400 transition-colors">Privacy Policy</Link></li>
              <li><Link to="/terms" className="hover:text-primary-400 transition-colors">Terms of Service</Link></li>
              <li><Link to="/refund-policy" className="hover:text-primary-400 transition-colors">Refund Policy</Link></li>
              <li><Link to="/delivery-policy" className="hover:text-primary-400 transition-colors">Delivery Policy</Link></li>
              <li><Link to="/cookie-policy" className="hover:text-primary-400 transition-colors">Cookie Policy</Link></li>
              <li><Link to="/cancellation-policy" className="hover:text-primary-400 transition-colors">Cancellation Policy</Link></li>
              <li><Link to="/accessibility" className="hover:text-primary-400 transition-colors">Accessibility</Link></li>
            </ul>
          </div>

          {/* Customer Links (Available routes only) */}
          <div>
            <h4 className="text-white font-black text-xs uppercase tracking-widest mb-4">Customer</h4>
            <ul className="space-y-2.5 text-xs sm:text-sm font-medium">
              <li><Link to="/menu" className="hover:text-primary-400 transition-colors">Artisan Menu</Link></li>
              <li><Link to="/customer/dashboard" className="hover:text-primary-400 transition-colors">My Dashboard</Link></li>
              <li><Link to="/order-tracking" className="hover:text-primary-400 transition-colors">Track Order Live</Link></li>
              <li><Link to="/faq" className="hover:text-primary-400 transition-colors">Help & FAQ</Link></li>
              <li><Link to="/assistant" className="hover:text-primary-400 transition-colors inline-flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5 text-amber-400" /> AI Assistant</Link></li>
            </ul>
          </div>

          {/* Real Olive Pizza Location & Operating Hours */}
          <div className="sm:col-span-2 lg:col-span-1">
            <h4 className="text-white font-black text-xs uppercase tracking-widest mb-4">Real Store Location</h4>
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3 text-xs font-medium backdrop-blur-md">
              <div className="flex items-start gap-2.5 text-white font-bold leading-snug">
                <MapPin className="w-4 h-4 text-primary-400 shrink-0 mt-0.5" />
                <span>Dongargaon Rd, near Saraswati School, Gokul Nagar, Rajnandgaon, Chhattisgarh 491441</span>
              </div>
              <a
                href="https://www.google.com/maps/dir/?api=1&destination=21.0810244,81.0123793"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-primary-400 hover:text-primary-300 font-bold transition-colors pt-1"
              >
                <Navigation className="w-3.5 h-3.5" /> Get Directions &rarr;
              </a>
              <div className="flex items-center gap-2 pt-2 border-t border-white/10">
                <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="text-slate-300">Timing: 12:00 PM - 12:00 AM</span>
              </div>
              <div className="flex items-center gap-2 pt-1 border-t border-white/10">
                <span className={`w-2.5 h-2.5 rounded-full ${storeStatus.isRestaurantOpen ? "bg-emerald-400 animate-pulse" : "bg-red-500"}`} />
                <span className="font-bold text-white">
                  {storeStatus.isRestaurantOpen ? "Kitchen Currently Open" : "Closed for the Day"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Copyright & S-Web Hub Credit */}
        <div className="pt-6 border-t border-white/10 flex flex-col items-center justify-center gap-3 text-xs font-medium text-slate-400 text-center">
          <p>© {new Date().getFullYear()} Olive Pizza. All rights reserved. Premium Wood-Fired Dining Experience.</p>
          
          {/* Developed & Maintained by S-Web Hub Credit */}
          <div className="flex items-center justify-center gap-2">
            <span>Developed & Maintained by</span>
            <a
              href="https://28webhub.netlify.app"
              target="_blank"
              rel="noopener noreferrer"
              className="group relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-orange-500/10 via-amber-500/10 to-primary-500/10 border border-orange-500/30 text-amber-300 font-extrabold transition-all duration-300 hover:border-amber-400 hover:text-white shadow-lg hover:shadow-orange-500/30"
            >
              <span className="bg-gradient-to-r from-orange-400 via-amber-300 to-yellow-300 bg-clip-text text-transparent group-hover:text-white transition-colors">
                S-Web Hub
              </span>
              <ExternalLink className="w-3.5 h-3.5 text-amber-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
