import React from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';

// Common tokens used throughout the system
export const GLASS_TOKENS = {
  background: 'bg-white/5 dark:bg-white/[0.08]',
  backdrop: 'backdrop-blur-[20px]',
  border: 'border border-white/10 dark:border-white/[0.15]',
  shadow: 'shadow-[0_8px_40px_rgba(0,0,0,0.1)] dark:shadow-[0_8px_40px_rgba(0,0,0,0.25)]',
  radius: 'rounded-[24px]',
  textPrimary: 'text-slate-900 dark:text-[#FFFFFF]',
  textSecondary: 'text-slate-600 dark:text-[rgba(255,255,255,0.8)]',
  textMuted: 'text-slate-500 dark:text-[rgba(255,255,255,0.6)]',
};

// 1. Glass Card
export interface GlassCardProps extends Omit<HTMLMotionProps<"div">, "style"> {
  children: React.ReactNode;
  className?: string;
  hoverEffect?: boolean;
  style?: React.CSSProperties;
}

export function GlassCard({ children, className = '', hoverEffect = false, style, ...props }: GlassCardProps) {
  return (
    <motion.div
      whileHover={hoverEffect ? { y: -4, boxShadow: '0 20px 40px rgba(0,0,0,0.3)' } : undefined}
      transition={{ duration: 0.2 }}
      className={`
        ${GLASS_TOKENS.background} 
        ${GLASS_TOKENS.backdrop} 
        ${GLASS_TOKENS.border} 
        ${GLASS_TOKENS.shadow} 
        ${GLASS_TOKENS.radius} 
        ${className}
      `}
      style={style as any}
      {...(props as any)}
    >
      {children}
    </motion.div>
  );
}

// 2. Glass Button
export interface GlassButtonProps extends Omit<HTMLMotionProps<"button">, "style"> {
  children: React.ReactNode;
  className?: string;
  variant?: 'primary' | 'secondary' | 'danger';
  style?: React.CSSProperties;
}

export function GlassButton({ children, className = '', variant = 'secondary', style, ...props }: GlassButtonProps) {
  const baseStyle = `relative overflow-hidden font-bold transition-all duration-300 rounded-xl px-5 py-2.5 backdrop-blur-md`;
  
  let variantStyle = '';
  switch (variant) {
    case 'primary':
      variantStyle = 'bg-primary-500/80 hover:bg-primary-500 text-white border border-primary-400/50 shadow-[0_0_15px_rgba(249,115,22,0.3)]';
      break;
    case 'secondary':
      variantStyle = 'bg-white/10 hover:bg-white/20 text-slate-800 dark:text-white border border-white/20';
      break;
    case 'danger':
      variantStyle = 'bg-red-500/20 hover:bg-red-500/30 text-red-500 border border-red-500/30';
      break;
  }

  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={`${baseStyle} ${variantStyle} ${className}`}
      style={style as any}
      {...(props as any)}
    >
      {children}
    </motion.button>
  );
}

// 3. Glass Panel (for Navbars/Sidebars)
export interface GlassPanelProps extends Omit<HTMLMotionProps<"div">, "style"> {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function GlassPanel({ children, className = '', style, ...props }: GlassPanelProps) {
  return (
    <motion.div
      className={`
        ${GLASS_TOKENS.background} 
        ${GLASS_TOKENS.backdrop} 
        border-r border-white/10 dark:border-white/[0.15]
        ${className}
      `}
      style={style as any}
      {...(props as any)}
    >
      {children}
    </motion.div>
  );
}
