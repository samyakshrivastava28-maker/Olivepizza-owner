import { motion } from 'framer-motion';
import { ReactNode } from 'react';
import { SPRING_BOUNCE } from '../lib/motion';

interface PageTransitionProps {
  children: ReactNode;
  className?: string;
}

export default function PageTransition({ children, className = '' }: PageTransitionProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.99, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.99, y: -8 }}
      transition={SPRING_BOUNCE}
      className={className}
    >
      {children}
    </motion.div>
  );
}
