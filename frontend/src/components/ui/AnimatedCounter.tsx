import { useEffect, useState } from 'react';
import { motion, useAnimation } from 'framer-motion';

export default function AnimatedCounter({ from = 0, to, duration = 1 }: { from?: number, to: number, duration?: number }) {
  const [count, setCount] = useState(from);

  useEffect(() => {
    let startTime: number;
    let animationFrame: number;

    const animate = (time: number) => {
      if (!startTime) startTime = time;
      const progress = Math.min((time - startTime) / (duration * 1000), 1);
      
      // easeOutExpo
      const easeProgress = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      
      setCount(from + (to - from) * easeProgress);

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animationFrame);
  }, [from, to, duration]);

  // Handle formatting for currency vs standard numbers
  const isCurrency = to.toString().includes('.') && !Number.isInteger(to);
  const displayValue = isCurrency ? count.toFixed(2) : Math.round(count);

  return <>{displayValue}</>;
}
