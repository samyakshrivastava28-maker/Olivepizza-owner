import React from 'react';
import { motion } from 'framer-motion';
import { AnimationType, TextAnimationType } from '../../../types/PageSchema';

interface AnimationPreviewBadgeProps {
  animation: AnimationType | TextAnimationType;
  isSelected?: boolean;
  onClick?: () => void;
  label?: string;
}

export default function AnimationPreviewBadge({
  animation,
  isSelected = false,
  onClick,
  label
}: AnimationPreviewBadgeProps) {
  const displayLabel = label || animation;

  const renderVisualDemo = () => {
    switch (animation) {
      case 'Fade':
      case 'Fade In':
        return (
          <motion.div
            key="fade"
            animate={{ opacity: [0, 1, 1, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            className="text-lg"
          >
            🍕
          </motion.div>
        );

      case 'Fade Up':
        return (
          <motion.div
            key="fade-up"
            animate={{ opacity: [0, 1, 1, 0], y: [14, 0, 0, 14] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
            className="text-lg"
          >
            🍕
          </motion.div>
        );

      case 'Fade Down':
        return (
          <motion.div
            key="fade-down"
            animate={{ opacity: [0, 1, 1, 0], y: [-14, 0, 0, -14] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
            className="text-lg"
          >
            🍕
          </motion.div>
        );

      case 'Fade Left':
      case 'Slide':
        return (
          <motion.div
            key="fade-left"
            animate={{ opacity: [0, 1, 1, 0], x: [14, 0, 0, 14] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
            className="text-lg"
          >
            🍕
          </motion.div>
        );

      case 'Fade Right':
        return (
          <motion.div
            key="fade-right"
            animate={{ opacity: [0, 1, 1, 0], x: [-14, 0, 0, -14] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
            className="text-lg"
          >
            🍕
          </motion.div>
        );

      case 'Scale':
      case 'Scale In':
        return (
          <motion.div
            key="scale"
            animate={{ opacity: [0, 1, 1, 0], scale: [0.5, 1, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
            className="text-lg"
          >
            🍕
          </motion.div>
        );

      case 'Blur In':
        return (
          <motion.div
            key="blur-in"
            animate={{ opacity: [0, 1, 1, 0], filter: ['blur(6px)', 'blur(0px)', 'blur(0px)', 'blur(6px)'] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
            className="text-lg"
          >
            🍕
          </motion.div>
        );

      case 'Pop':
        return (
          <motion.div
            key="pop"
            animate={{ scale: [0.7, 1.25, 1, 0.7] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
            className="text-lg"
          >
            🍕
          </motion.div>
        );

      case 'Floating':
        return (
          <motion.div
            key="floating"
            animate={{ y: [-4, 4, -4] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
            className="text-lg"
          >
            🍕
          </motion.div>
        );

      case 'Stagger':
        return (
          <div className="flex items-center gap-1">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                animate={{ opacity: [0.2, 1, 0.2], y: [4, 0, 4] }}
                transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.2 }}
                className="w-2 h-2 rounded-full bg-amber-400"
              />
            ))}
          </div>
        );

      case 'Word Reveal':
        return (
          <div className="flex gap-1 text-[10px] font-bold text-amber-400">
            {['Fresh', 'Hot', 'Fast'].map((w, idx) => (
              <motion.span
                key={idx}
                animate={{ opacity: [0, 1, 1, 0], y: [6, 0, 0, 6] }}
                transition={{ duration: 2, repeat: Infinity, delay: idx * 0.3 }}
              >
                {w}
              </motion.span>
            ))}
          </div>
        );

      case 'Typewriter':
        return (
          <div className="flex items-center text-[10px] font-mono text-emerald-400 font-bold">
            <motion.span
              animate={{ opacity: [0, 1, 1] }}
              transition={{ duration: 1.8, repeat: Infinity }}
            >
              Olive
            </motion.span>
            <motion.span
              animate={{ opacity: [0, 1, 0] }}
              transition={{ duration: 0.6, repeat: Infinity }}
              className="inline-block w-1.5 h-3 bg-emerald-400 ml-0.5"
            />
          </div>
        );

      case 'Mask Reveal':
      case 'Letter Spacing':
        return (
          <motion.span
            animate={{ letterSpacing: ['0px', '4px', '4px', '0px'], opacity: [0.4, 1, 1, 0.4] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="text-[10px] font-black uppercase text-orange-400 tracking-wider"
          >
            PIZZA
          </motion.span>
        );

      default:
        return <div className="text-xs text-slate-500 font-medium">Static</div>;
    }
  };

  return (
    <div
      onClick={onClick}
      className={`group relative flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer ${
        isSelected
          ? 'bg-primary-500/15 border-primary-500 shadow-md shadow-primary-500/10'
          : 'bg-white/5 border-white/10 hover:border-primary-500/50 hover:bg-white/10'
      }`}
    >
      <div className="flex flex-col">
        <span className={`text-xs font-bold ${isSelected ? 'text-primary-300' : 'text-slate-200'}`}>
          {displayLabel}
        </span>
        <span className="text-[10px] text-slate-400">Live motion preview</span>
      </div>

      <div className="w-14 h-10 rounded-lg bg-black/60 border border-white/10 flex items-center justify-center overflow-hidden">
        {renderVisualDemo()}
      </div>
    </div>
  );
}
