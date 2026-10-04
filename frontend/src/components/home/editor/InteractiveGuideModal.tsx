import React, { useState } from 'react';
import { X, Sparkles, Layers, Type, Film, Smartphone, Rocket, ChevronRight, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';

interface InteractiveGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const GUIDE_STEPS = [
  {
    id: 'getting-started',
    title: '1. Getting Started',
    subtitle: 'Customize any section without writing a single line of code.',
    icon: Layers,
    content: (
      <div className="flex flex-col gap-4 text-sm text-slate-300">
        <p>
          Welcome to the <strong>Olive Pizza Home Page Manager</strong>! You can customize every section of your customer website and mobile app visually.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-2">
          <div className="p-3 bg-white/5 border border-white/10 rounded-xl flex flex-col gap-1">
            <span className="text-amber-400 font-bold text-xs uppercase">Step 1</span>
            <span className="text-white font-bold text-sm">Select Section</span>
            <span className="text-xs text-slate-400">Click on any section on the left sidebar or the live canvas.</span>
          </div>
          <div className="p-3 bg-white/5 border border-white/10 rounded-xl flex flex-col gap-1">
            <span className="text-emerald-400 font-bold text-xs uppercase">Step 2</span>
            <span className="text-white font-bold text-sm">Change Content</span>
            <span className="text-xs text-slate-400">Update headlines, buttons, offers, or background videos.</span>
          </div>
          <div className="p-3 bg-white/5 border border-white/10 rounded-xl flex flex-col gap-1">
            <span className="text-sky-400 font-bold text-xs uppercase">Step 3</span>
            <span className="text-white font-bold text-sm">Preview & Publish</span>
            <span className="text-xs text-slate-400">Test on mobile and publish live with one click.</span>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 'animations',
    title: '2. Professional Animations',
    subtitle: 'Pre-built motion presets that make your website feel alive.',
    icon: Sparkles,
    content: (
      <div className="flex flex-col gap-4 text-sm text-slate-300">
        <p>
          Select from handcrafted animations. Every animation includes a <strong>mini live preview</strong> so you see the movement before saving.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-1">
          <div className="p-3 bg-black/60 border border-white/10 rounded-xl flex flex-col items-center gap-2 text-center">
            <motion.div animate={{ opacity: [0, 1, 0], y: [10, 0, 10] }} transition={{ duration: 2, repeat: Infinity }} className="text-2xl">
              🍕
            </motion.div>
            <span className="text-xs font-bold text-white">Fade Up</span>
            <span className="text-[10px] text-slate-400">Smooth entrance</span>
          </div>
          <div className="p-3 bg-black/60 border border-white/10 rounded-xl flex flex-col items-center gap-2 text-center">
            <motion.div animate={{ scale: [0.7, 1.2, 0.7] }} transition={{ duration: 1.8, repeat: Infinity }} className="text-2xl">
              🍕
            </motion.div>
            <span className="text-xs font-bold text-white">Pop / Zoom</span>
            <span className="text-[10px] text-slate-400">Playful energy</span>
          </div>
          <div className="p-3 bg-black/60 border border-white/10 rounded-xl flex flex-col items-center gap-2 text-center">
            <motion.div animate={{ y: [-4, 4, -4] }} transition={{ duration: 2, repeat: Infinity }} className="text-2xl">
              🍕
            </motion.div>
            <span className="text-xs font-bold text-white">Floating Wave</span>
            <span className="text-[10px] text-slate-400">Gentle hover</span>
          </div>
          <div className="p-3 bg-black/60 border border-white/10 rounded-xl flex flex-col items-center gap-2 text-center">
            <motion.div animate={{ opacity: [0.3, 1, 0.3], filter: ['blur(4px)', 'blur(0px)', 'blur(4px)'] }} transition={{ duration: 2, repeat: Infinity }} className="text-2xl">
              🍕
            </motion.div>
            <span className="text-xs font-bold text-white">Blur In</span>
            <span className="text-[10px] text-slate-400">Cinematic feel</span>
          </div>
        </div>
        <p className="text-xs text-amber-300 font-medium">
          💡 Tip: Set Animation Speed between <strong>400 ms and 700 ms</strong> for the smoothest experience on phones.
        </p>
      </div>
    ),
  },
  {
    id: 'typography',
    title: '3. Fonts & Text Sizing',
    subtitle: 'Curated premium fonts designed for luxury pizza dining.',
    icon: Type,
    content: (
      <div className="flex flex-col gap-4 text-sm text-slate-300">
        <p>
          Choose from 8 selected fonts. You can adjust text sizes separately for <strong>Desktop</strong>, <strong>Tablet</strong>, and <strong>Mobile</strong> phones.
        </p>
        <div className="space-y-2 my-1">
          <div className="p-2.5 bg-white/5 border border-white/10 rounded-lg flex items-center justify-between">
            <span className="font-bold text-white text-sm" style={{ fontFamily: 'Outfit, sans-serif' }}>Outfit</span>
            <span className="text-xs text-primary-400">Modern & Clean (Default)</span>
          </div>
          <div className="p-2.5 bg-white/5 border border-white/10 rounded-lg flex items-center justify-between">
            <span className="font-bold text-white text-sm" style={{ fontFamily: 'Playfair Display, serif' }}>Playfair Display</span>
            <span className="text-xs text-amber-400">Royal Italian Feast</span>
          </div>
          <div className="p-2.5 bg-white/5 border border-white/10 rounded-lg flex items-center justify-between">
            <span className="font-bold text-white text-sm" style={{ fontFamily: 'Poppins, sans-serif' }}>Poppins</span>
            <span className="text-xs text-emerald-400">Friendly & Approachable</span>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 'media',
    title: '4. Automatic Media Optimization',
    subtitle: 'Upload images or videos — the system automatically shrinks and speeds them up.',
    icon: Film,
    content: (
      <div className="flex flex-col gap-4 text-sm text-slate-300">
        <p>
          You do not need Photoshop or compression tools! Whenever you upload an image or video:
        </p>
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl space-y-2 text-xs">
          <div className="flex items-center gap-2 text-emerald-400 font-bold">
            <CheckCircle2 className="w-4 h-4" />
            <span>Automatic WebP & WebM Conversion: Saves up to 70% data weight</span>
          </div>
          <div className="flex items-center gap-2 text-emerald-400 font-bold">
            <CheckCircle2 className="w-4 h-4" />
            <span>Video Poster Generation: Instant preview frame before the video plays</span>
          </div>
          <div className="flex items-center gap-2 text-emerald-400 font-bold">
            <CheckCircle2 className="w-4 h-4" />
            <span>Responsive Phone Delivery: Phones only download smaller mobile images</span>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 'publish',
    title: '5. Draft, Preview & Publish',
    subtitle: 'Experiment safely without affecting your live website.',
    icon: Rocket,
    content: (
      <div className="flex flex-col gap-4 text-sm text-slate-300">
        <p>
          Take your time creating campaigns. Your changes will not go live until you click <strong>Publish</strong>.
        </p>
        <div className="space-y-2.5">
          <div className="flex items-start gap-3 p-3 bg-white/5 border border-white/10 rounded-xl">
            <span className="px-2 py-1 bg-slate-700 text-white text-xs font-bold rounded">Save Draft</span>
            <span className="text-xs text-slate-300">Saves your work securely. The live website remains unchanged.</span>
          </div>
          <div className="flex items-start gap-3 p-3 bg-white/5 border border-white/10 rounded-xl">
            <span className="px-2 py-1 bg-sky-600 text-white text-xs font-bold rounded">Device Preview</span>
            <span className="text-xs text-slate-300">Toggle between Mobile, Tablet, and Desktop to inspect exactly how your customers will see it.</span>
          </div>
          <div className="flex items-start gap-3 p-3 bg-white/5 border border-white/10 rounded-xl">
            <span className="px-2 py-1 bg-emerald-600 text-white text-xs font-bold rounded">Publish Live</span>
            <span className="text-xs text-slate-300">Instantly updates the website and mobile app in real-time.</span>
          </div>
        </div>
      </div>
    ),
  },
];

export default function InteractiveGuideModal({ isOpen, onClose }: InteractiveGuideModalProps) {
  const [activeStepIndex, setActiveStepIndex] = useState(0);

  if (!isOpen) return null;

  const currentStep = GUIDE_STEPS[activeStepIndex];
  const Icon = currentStep.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-white/15 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/10 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-500/20 border border-primary-500/30 flex items-center justify-center text-primary-400">
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-white">{currentStep.title}</h2>
              <p className="text-xs text-slate-400">{currentStep.subtitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Tabs */}
        <div className="flex overflow-x-auto border-b border-white/10 bg-slate-950/30 p-2 gap-1.5 custom-scrollbar">
          {GUIDE_STEPS.map((step, idx) => (
            <button
              key={step.id}
              onClick={() => setActiveStepIndex(idx)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                activeStepIndex === idx
                  ? 'bg-primary-500 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <span>{idx + 1}.</span>
              <span>{step.title.split('. ')[1]}</span>
            </button>
          ))}
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
          {currentStep.content}
        </div>

        {/* Footer Navigation */}
        <div className="flex items-center justify-between p-4 border-t border-white/10 bg-slate-950/60">
          <button
            disabled={activeStepIndex === 0}
            onClick={() => setActiveStepIndex((prev) => Math.max(0, prev - 1))}
            className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-colors"
          >
            Previous
          </button>

          <span className="text-xs text-slate-500 font-medium">
            Step {activeStepIndex + 1} of {GUIDE_STEPS.length}
          </span>

          {activeStepIndex < GUIDE_STEPS.length - 1 ? (
            <button
              onClick={() => setActiveStepIndex((prev) => Math.min(GUIDE_STEPS.length - 1, prev + 1))}
              className="px-5 py-2 bg-primary-500 hover:bg-primary-400 text-white font-bold text-xs rounded-xl shadow-lg transition-all flex items-center gap-1.5"
            >
              <span>Next</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={onClose}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all"
            >
              Start Customizing
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
