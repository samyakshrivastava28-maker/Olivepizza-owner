import { motion } from 'framer-motion';
import AnimatedCounter from '../ui/AnimatedCounter';
import { GlassCard } from '../ui/glass/GlassSystem';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: string;
  trend?: string;
  isPositive?: boolean;
  delay?: number;
  prefix?: string;
  colorTheme?: 'orange' | 'blue' | 'green' | 'purple' | 'gold' | 'red' | 'default';
}

export default function StatCard({ title, value, icon, trend, isPositive, delay = 0, prefix = '', colorTheme = 'default' }: StatCardProps) {
  
  // Try to parse the value as a number if it's a string, removing non-numeric characters except decimals
  const isNumeric = typeof value === 'number' || !isNaN(parseFloat(value.toString().replace(/[^0-9.-]+/g,"")));
  const numValue = isNumeric ? parseFloat(value.toString().replace(/[^0-9.-]+/g,"")) : 0;
  
  // Extract prefix if it's a string (like '₹')
  const actualPrefix = prefix || (typeof value === 'string' && value.startsWith('₹') ? '₹' : '');

  const themeGlows = {
    orange: 'shadow-[0_0_20px_rgba(249,115,22,0.15)] border-orange-500/30 text-orange-400 bg-gradient-to-br from-orange-500/10 via-dark-900 to-dark-950',
    blue: 'shadow-[0_0_20px_rgba(59,130,246,0.15)] border-blue-500/30 text-blue-400 bg-gradient-to-br from-blue-500/10 via-dark-900 to-dark-950',
    green: 'shadow-[0_0_20px_rgba(16,185,129,0.15)] border-emerald-500/30 text-emerald-400 bg-gradient-to-br from-emerald-500/10 via-dark-900 to-dark-950',
    purple: 'shadow-[0_0_20px_rgba(168,85,247,0.15)] border-purple-500/30 text-purple-400 bg-gradient-to-br from-purple-500/10 via-dark-900 to-dark-950',
    gold: 'shadow-[0_0_20px_rgba(234,179,8,0.15)] border-amber-500/30 text-amber-400 bg-gradient-to-br from-amber-500/10 via-dark-900 to-dark-950',
    red: 'shadow-[0_0_20px_rgba(239,68,68,0.15)] border-rose-500/30 text-rose-400 bg-gradient-to-br from-rose-500/10 via-dark-900 to-dark-950',
    default: 'shadow-[0_0_15px_rgba(255,255,255,0.05)] border-white/10 text-slate-400 bg-dark-900/90'
  };

  const themeClass = themeGlows[colorTheme] || themeGlows.default;

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      whileHover={{ y: -4, scale: 1.02 }}
      className={`p-5 sm:p-6 rounded-2xl sm:rounded-3xl border border-white/12 backdrop-blur-xl relative overflow-hidden flex flex-col justify-between transition-all duration-300 ${themeClass}`}
    >
      {/* Top rim highlight */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />

      <div className="flex justify-between items-start mb-3">
        <p className="text-xs uppercase tracking-wider font-extrabold text-slate-300/80">{title}</p>
        <motion.span 
          whileHover={{ rotate: 15, scale: 1.2 }}
          className="text-2xl p-2 rounded-xl bg-white/5 border border-white/10"
        >
          {icon}
        </motion.span>
      </div>

      <div>
        <h3 className="text-2xl sm:text-3xl font-black text-white font-mono tracking-tight flex items-center gap-0.5">
          <span>{actualPrefix}</span>
          {isNumeric ? <AnimatedCounter to={numValue} /> : value}
        </h3>
        {trend && (
          <p className={`text-xs mt-2 font-extrabold flex items-center gap-1 ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
            <span>{isPositive ? '↑' : '↓'}</span>
            <span>{trend}</span>
          </p>
        )}
      </div>
    </motion.div>
  );
}
