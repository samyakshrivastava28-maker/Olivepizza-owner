import React from 'react';
import { motion } from 'framer-motion';

export const SkeletonPulse = ({ className }: { className?: string }) => (
  <motion.div
    animate={{ opacity: [0.5, 1, 0.5] }}
    transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
    className={`bg-gray-200 rounded-md ${className}`}
  />
);

export const MenuGridSkeleton = () => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-4">
    {[1, 2, 3, 4, 5, 6].map((i) => (
      <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 space-y-4">
        <SkeletonPulse className="w-full h-48 rounded-lg" />
        <SkeletonPulse className="w-3/4 h-6" />
        <SkeletonPulse className="w-1/2 h-4" />
        <div className="flex justify-between items-center pt-2">
          <SkeletonPulse className="w-1/4 h-6" />
          <SkeletonPulse className="w-1/3 h-10 rounded-full" />
        </div>
      </div>
    ))}
  </div>
);

export const DashboardStatsSkeleton = () => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
    {[1, 2, 3, 4].map((i) => (
      <div key={i} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-3">
        <SkeletonPulse className="w-1/2 h-4" />
        <SkeletonPulse className="w-3/4 h-8" />
      </div>
    ))}
  </div>
);

export const OrderListSkeleton = () => (
  <div className="space-y-4 w-full">
    {[1, 2, 3].map((i) => (
      <div key={i} className="bg-white p-4 rounded-xl border border-gray-100 flex justify-between items-center">
        <div className="space-y-2 flex-1">
          <SkeletonPulse className="w-1/3 h-5" />
          <SkeletonPulse className="w-1/4 h-4" />
        </div>
        <SkeletonPulse className="w-24 h-10 rounded-lg" />
      </div>
    ))}
  </div>
);
