import React from 'react';
import { motion } from 'framer-motion';

export default function GallerySection({ config }: { config: any }) {
  // Placeholder images
  const images = [
    'https://res.cloudinary.com/demo/image/upload/v1312461204/sample.jpg',
    'https://res.cloudinary.com/demo/image/upload/v1312461204/sample.jpg',
    'https://res.cloudinary.com/demo/image/upload/v1312461204/sample.jpg',
    'https://res.cloudinary.com/demo/image/upload/v1312461204/sample.jpg'
  ];

  return (
    <div className="py-12">
      <h3 className="text-3xl font-bold text-center text-white mb-8">{config.headline || 'Gallery'}</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 px-4">
        {images.map((img, idx) => (
          <motion.div 
            key={idx}
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ delay: idx * 0.1 }}
            className="aspect-square rounded-2xl overflow-hidden cursor-pointer"
          >
            <img src={img} alt="Gallery item" className="w-full h-full object-cover hover:scale-110 transition-transform duration-500" />
          </motion.div>
        ))}
      </div>
    </div>
  );
}
