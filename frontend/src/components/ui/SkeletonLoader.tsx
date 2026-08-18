import { motion } from 'framer-motion';

export const Skeleton = ({ className = '' }: { className?: string }) => (
  <motion.div
    initial={{ opacity: 0.5 }}
    animate={{ opacity: [0.5, 1, 0.5] }}
    transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
    className={`bg-slate-200 dark:bg-slate-800 rounded-md ${className}`}
  />
);

export const ProductSkeleton = () => (
  <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden flex flex-col h-full p-4 gap-4">
    <Skeleton className="w-full h-48 rounded-xl" />
    <div className="space-y-2 flex-1">
      <Skeleton className="w-3/4 h-6" />
      <Skeleton className="w-full h-4" />
      <Skeleton className="w-5/6 h-4" />
    </div>
    <div className="flex justify-between items-center mt-4">
      <Skeleton className="w-16 h-8" />
      <Skeleton className="w-24 h-10 rounded-xl" />
    </div>
  </div>
);

export const DashboardCardSkeleton = () => (
  <div className="bg-white/80 dark:bg-slate-900/80 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 h-32 flex flex-col justify-between">
    <div className="flex justify-between items-start">
      <Skeleton className="w-1/2 h-4" />
      <Skeleton className="w-8 h-8 rounded-full" />
    </div>
    <Skeleton className="w-1/3 h-8 mt-4" />
  </div>
);
