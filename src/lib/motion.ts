import { Variants, Transition } from 'framer-motion';
import { useState, useEffect } from 'react';

// ── 60 FPS Spring Physics Configurations ──
export const SPRING_BOUNCE: Transition = {
  type: 'spring',
  stiffness: 400,
  damping: 22,
  mass: 0.8,
};

export const SPRING_SNAPPY: Transition = {
  type: 'spring',
  stiffness: 500,
  damping: 30,
};

export const SPRING_GENTLE: Transition = {
  type: 'spring',
  stiffness: 200,
  damping: 20,
};

export const SPRING_ELASTIC: Transition = {
  type: 'spring',
  stiffness: 300,
  damping: 15,
  mass: 1,
};

// ── Easing Curves ──
export const EASE_OUT_EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1];
export const EASE_OUT_BACK: [number, number, number, number] = [0.34, 1.56, 0.64, 1];
export const EASE_IN_OUT_CUBIC: [number, number, number, number] = [0.65, 0, 0.35, 1];

// ── Animation Durations (Seconds) ──
export const DURATION_MICRO = 0.2;
export const DURATION_COMPONENT = 0.35;
export const DURATION_PAGE = 0.5;

// ── Framer Motion Variants ──
export const staggerContainerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.05,
    },
  },
};

export const fadeInUpVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 18,
    scale: 0.98,
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: SPRING_BOUNCE,
  },
  exit: {
    opacity: 0,
    y: -10,
    scale: 0.98,
    transition: { duration: DURATION_MICRO, ease: EASE_IN_OUT_CUBIC },
  },
};

export const buttonPressVariants: Variants = {
  idle: { scale: 1, y: 0 },
  hover: { scale: 1.03, y: -1, transition: SPRING_SNAPPY },
  tap: { scale: 0.94, y: 1, transition: SPRING_SNAPPY },
};

export const card3DHoverVariants: Variants = {
  idle: {
    scale: 1,
    y: 0,
    rotateX: 0,
    rotateY: 0,
    boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
  },
  hover: {
    scale: 1.02,
    y: -4,
    boxShadow: '0 20px 35px rgba(245, 158, 11, 0.15)',
    transition: SPRING_BOUNCE,
  },
  tap: {
    scale: 0.98,
    y: 0,
    transition: SPRING_SNAPPY,
  },
};

export const floatingIdleVariants: Variants = {
  initial: { y: 0, scale: 1 },
  animate: {
    y: [-3, 3, -3],
    transition: {
      duration: 4,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
};

// ── Accessibility Hook for Reduced Motion ──
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mediaQuery.matches);

    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mediaQuery.addEventListener('change', onChange);
    return () => mediaQuery.removeEventListener('change', onChange);
  }, []);

  return reduced;
}
