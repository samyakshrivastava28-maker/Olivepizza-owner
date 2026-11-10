import React from 'react';
import { motion } from 'framer-motion';

export const PizzaBakingLoader = () => (
  <div className="flex flex-col items-center justify-center p-8 space-y-4">
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
      className="w-16 h-16 rounded-full border-4 border-olive-500 border-t-orange-500"
    />
    <p className="text-olive-700 font-medium animate-pulse">Baking your pizza...</p>
  </div>
);

export const CheeseMeltLoader = () => (
  <div className="flex flex-col items-center justify-center p-6 space-y-3">
    <div className="flex space-x-2">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          animate={{ y: [0, -10, 0] }}
          transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.2 }}
          className="w-4 h-4 bg-orange-400 rounded-full"
        />
      ))}
    </div>
    <p className="text-orange-600 text-sm font-semibold">Melting the cheese...</p>
  </div>
);

export const DeliveryBikeLoader = () => (
  <div className="flex flex-col items-center justify-center p-6 overflow-hidden w-full max-w-sm mx-auto">
    <motion.div
      animate={{ x: [-100, 100, -100] }}
      transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      className="text-4xl"
    >
      🛵
    </motion.div>
    <p className="text-olive-600 text-sm font-medium mt-2">Assigning delivery partner...</p>
  </div>
);

export const AnimatedProgressBar = ({ progress }: { progress: number }) => (
  <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
    <motion.div
      className="bg-orange-500 h-2.5 rounded-full"
      initial={{ width: 0 }}
      animate={{ width: `${progress}%` }}
      transition={{ duration: 0.3 }}
    />
  </div>
);
