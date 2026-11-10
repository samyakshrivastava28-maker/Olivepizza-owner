import React, { useEffect, useState } from 'react';
import { motion, useScroll, useSpring, AnimatePresence } from 'framer-motion';
import { Shield, Lock, CreditCard, CheckCircle, FileText, ChevronRight, Menu as MenuIcon, X, ArrowUpRight, Sparkles } from 'lucide-react';
import { Link } from 'react-router';
import SEO from '../SEO';

export interface TocItem {
  id: string;
  label: string;
}

export interface HighlightCard {
  icon?: React.ReactNode;
  title: string;
  description: string;
}

export interface LegalPageLayoutProps {
  title: string;
  subtitle?: string;
  badge?: string;
  description: string;
  lastUpdated: string;
  children: React.ReactNode;
  toc?: TocItem[];
  highlights?: HighlightCard[];
  canonicalUrl?: string;
  breadcrumbs?: Array<{ name: string; url: string }>;
  icon?: React.ReactNode;
}

export default function LegalPageLayout({
  title,
  subtitle,
  badge = "Policy & Transparency",
  description,
  lastUpdated,
  children,
  toc = [],
  highlights = [],
  canonicalUrl,
  breadcrumbs,
  icon
}: LegalPageLayoutProps) {
  const [activeSection, setActiveSection] = useState<string>('');
  const [mobileTocOpen, setMobileTocOpen] = useState<boolean>(false);
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001
  });

  useEffect(() => {
    if (!toc.length) return;

    const handleScroll = () => {
      const scrollPosition = window.scrollY + 140;
      let current = '';

      for (let i = 0; i < toc.length; i++) {
        const el = document.getElementById(toc[i].id);
        if (el && el.offsetTop <= scrollPosition) {
          current = toc[i].id;
        }
      }
      if (current) setActiveSection(current);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, [toc]);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      const top = element.offsetTop - 90;
      window.scrollTo({ top, behavior: 'smooth' });
      setActiveSection(id);
      setMobileTocOpen(false);
    }
  };

  return (
    <>
      <SEO 
        title={`${title} • Olive Pizza`} 
        description={description} 
        canonicalUrl={canonicalUrl} 
        breadcrumbs={breadcrumbs}
      />
      
      {/* Top Reading Progress Bar */}
      <motion.div 
        className="fixed top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-primary-500 to-amber-400 origin-left z-50 shadow-sm shadow-emerald-500/20"
        style={{ scaleX }}
      />

      <main className="min-h-screen bg-dark-950 text-slate-100 pt-24 pb-20 relative overflow-hidden">
        {/* Ambient background glow accents */}
        <div className="fixed inset-0 pointer-events-none z-0">
          <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[800px] h-[450px] bg-gradient-to-b from-emerald-500/10 via-amber-500/5 to-transparent blur-3xl opacity-70" />
          <div className="absolute top-1/3 -left-48 w-96 h-96 bg-primary-600/10 blur-3xl rounded-full pointer-events-none" />
          <div className="absolute top-2/3 -right-48 w-96 h-96 bg-amber-500/10 blur-3xl rounded-full pointer-events-none" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* ── Hero Header ── */}
          <div className="text-center max-w-3xl mx-auto mb-10 md:mb-14">
            {/* Tag Pill */}
            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-4 shadow-sm"
            >
              {icon ? (
                <span className="text-emerald-400">{icon}</span>
              ) : (
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              )}
              <span>{badge}</span>
            </motion.div>

            {/* Main Title */}
            <motion.h1 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="text-3xl sm:text-4xl md:text-5xl font-black text-white mb-4 tracking-tight leading-tight"
            >
              {title}
            </motion.h1>

            {subtitle && (
              <motion.p
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="text-emerald-400 font-semibold text-sm md:text-base mb-3"
              >
                {subtitle}
              </motion.p>
            )}

            {/* Description */}
            <motion.p 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="text-sm sm:text-base text-slate-400 max-w-2xl mx-auto mb-5 leading-relaxed"
            >
              {description}
            </motion.p>

            {/* Metadata Pill */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 bg-white/[0.04] border border-white/10 px-4 py-1.5 rounded-full backdrop-blur-md"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Official Policy • Last Updated: <strong className="text-slate-200">{lastUpdated}</strong></span>
            </motion.div>
          </div>

          {/* ── Key Highlights / Summary Grid (If provided) ── */}
          {highlights.length > 0 && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="mb-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
            >
              {highlights.map((card, idx) => (
                <div 
                  key={idx}
                  className="bg-[#121418]/80 backdrop-blur-xl border border-white/10 hover:border-emerald-500/30 p-5 rounded-2xl transition-all duration-300 flex items-start gap-4 shadow-lg shadow-black/40 group"
                >
                  <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shrink-0 group-hover:scale-110 transition-transform">
                    {card.icon || <Shield className="w-5 h-5" />}
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-white mb-1 group-hover:text-emerald-300 transition-colors">
                      {card.title}
                    </h2>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      {card.description}
                    </p>
                  </div>
                </div>
              ))}
            </motion.div>
          )}

          {/* ── Mobile / Tablet Sticky Quick-Navigation Bar ── */}
          {toc.length > 0 && (
            <div className="lg:hidden sticky top-16 z-30 mb-6 -mx-4 px-4 py-2.5 bg-dark-950/90 backdrop-blur-xl border-y border-white/10 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setMobileTocOpen(!mobileTocOpen)}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 text-xs font-bold text-slate-200 transition-all"
                aria-expanded={mobileTocOpen}
                aria-label="Toggle Table of Contents"
              >
                {mobileTocOpen ? <X className="w-4 h-4 text-emerald-400" /> : <MenuIcon className="w-4 h-4 text-emerald-400" />}
                <span>Table of Contents ({toc.length})</span>
              </button>

              {/* Horizontal quick jump scroll */}
              <div className="flex-1 overflow-x-auto no-scrollbar flex items-center gap-1.5 ml-2">
                {toc.slice(0, 4).map((item) => (
                  <button
                    key={item.id}
                    onClick={() => scrollToSection(item.id)}
                    className={`whitespace-nowrap px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      activeSection === item.id 
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold' 
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Mobile TOC Drawer Modal */}
          <AnimatePresence>
            {mobileTocOpen && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="lg:hidden mb-6 bg-[#121418] border border-white/15 rounded-2xl p-4 shadow-2xl space-y-1.5"
              >
                <div className="flex items-center justify-between pb-2 border-b border-white/10 mb-2">
                  <span className="text-xs font-black uppercase tracking-wider text-emerald-400">Quick Navigation</span>
                  <button onClick={() => setMobileTocOpen(false)} className="text-slate-400 hover:text-white p-1">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 max-h-72 overflow-y-auto">
                  {toc.map((item, idx) => (
                    <button
                      key={item.id}
                      onClick={() => scrollToSection(item.id)}
                      className={`text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between transition-all ${
                        activeSection === item.id
                          ? 'bg-emerald-500/15 text-emerald-300 font-bold border border-emerald-500/30'
                          : 'text-slate-300 hover:bg-white/[0.04]'
                      }`}
                    >
                      <span className="truncate">{idx + 1}. {item.label}</span>
                      <ChevronRight className="w-3.5 h-3.5 opacity-50 shrink-0 ml-2" />
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Main Two-Column Layout ── */}
          <div className="flex flex-col lg:flex-row gap-8 items-start">
            
            {/* Desktop Sticky Table of Contents (Left Column) */}
            {toc.length > 0 && (
              <aside className="hidden lg:block w-72 shrink-0 sticky top-28">
                <div className="bg-[#121418]/85 backdrop-blur-xl border border-white/10 rounded-3xl p-5 shadow-xl shadow-black/40">
                  <div className="flex items-center gap-2 pb-3 mb-3 border-b border-white/10">
                    <FileText className="w-4 h-4 text-emerald-400" />
                    <h2 className="font-black text-white text-xs uppercase tracking-widest">
                      Contents
                    </h2>
                  </div>
                  <nav aria-label="Table of Contents">
                    <ul className="space-y-1 max-h-[calc(100vh-16rem)] overflow-y-auto pr-1">
                      {toc.map((item, idx) => {
                        const isActive = activeSection === item.id;
                        return (
                          <li key={item.id}>
                            <button
                              type="button"
                              onClick={() => scrollToSection(item.id)}
                              className={`text-xs text-left w-full px-3 py-2 rounded-xl flex items-center gap-2.5 transition-all duration-200 ${
                                isActive 
                                  ? 'bg-emerald-500/15 text-emerald-300 font-bold border border-emerald-500/25 shadow-sm' 
                                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.03]'
                              }`}
                            >
                              <span className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] shrink-0 font-mono ${
                                isActive ? 'bg-emerald-500 text-dark-950 font-black' : 'bg-white/5 text-slate-400'
                              }`}>
                                {idx + 1}
                              </span>
                              <span className="truncate">{item.label}</span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </nav>

                  {/* Need Help Card */}
                  <div className="mt-5 pt-4 border-t border-white/10">
                    <p className="text-[11px] text-slate-400 mb-2">Have a question regarding this policy?</p>
                    <Link
                      to="/contact"
                      className="inline-flex items-center justify-between w-full px-3 py-2 rounded-xl bg-white/[0.04] hover:bg-emerald-500/10 border border-white/10 hover:border-emerald-500/30 text-xs font-bold text-slate-200 hover:text-emerald-300 transition-all group"
                    >
                      <span>Contact Support</span>
                      <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-400 transition-colors" />
                    </Link>
                  </div>
                </div>
              </aside>
            )}

            {/* Main Content Area (Right Column) */}
            <div className="flex-1 w-full min-w-0">
              <motion.article 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-[#121418]/85 backdrop-blur-2xl border border-white/10 p-6 sm:p-8 md:p-12 rounded-3xl shadow-2xl shadow-black/60 text-slate-200 leading-relaxed legal-content-body space-y-6"
              >
                {children}
              </motion.article>

              {/* ── Trust & Compliance Pillars ── */}
              <div className="mt-10 grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4">
                <TrustBadge icon={<Shield className="w-5 h-5" />} title="Privacy Protected" subtitle="Zero Third-Party Ads" />
                <TrustBadge icon={<Lock className="w-5 h-5" />} title="GDPR & DPDP" subtitle="Strict Data Rights" />
                <TrustBadge icon={<CreditCard className="w-5 h-5" />} title="Secure Checkout" subtitle="PCI-DSS 256-Bit SSL" />
                <TrustBadge icon={<CheckCircle className="w-5 h-5" />} title="Quality Promise" subtitle="100% Fresh & Authentic" />
              </div>

              {/* ── Still Have Questions Card ── */}
              <div className="mt-8 bg-gradient-to-r from-emerald-950/40 via-[#121418] to-amber-950/30 border border-emerald-500/20 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
                <div>
                  <h2 className="text-base font-bold text-white mb-1 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span>Need further clarification?</span>
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-400">
                    Our compliance and customer delight team is always available to help.
                  </p>
                </div>
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <Link
                    to="/faq"
                    className="flex-1 sm:flex-none text-center px-4 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-xs font-bold text-white transition-all"
                  >
                    View FAQs
                  </Link>
                  <Link
                    to="/contact"
                    className="flex-1 sm:flex-none text-center px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-dark-950 font-black text-xs transition-all shadow-lg shadow-emerald-500/20"
                  >
                    Get in Touch
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}

function TrustBadge({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="flex flex-col items-center justify-center p-3.5 sm:p-4 bg-[#121418]/60 backdrop-blur-md border border-white/10 rounded-2xl text-center hover:border-emerald-500/30 transition-all group">
      <div className="text-emerald-400 mb-2 p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 group-hover:scale-110 transition-transform">
        {icon}
      </div>
      <div className="text-xs font-bold text-white mb-0.5">
        {title}
      </div>
      <div className="text-[10px] text-slate-400">
        {subtitle}
      </div>
    </div>
  );
}
