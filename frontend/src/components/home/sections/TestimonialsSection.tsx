import React from 'react';
import { motion } from 'framer-motion';

export default function TestimonialsSection({ config }: { config: any }) {
  const testimonials = [
    { name: 'Arjun K.', text: 'Best pizza I have ever had! The delivery was lightning fast.' },
    { name: 'Priya M.', text: 'Absolutely love the new festive toppings. Highly recommended.' },
    { name: 'Rahul S.', text: 'Olive Pizza never disappoints. Always fresh, always hot.' }
  ];

  return (
    <div className="py-12 px-4">
      <h3 className="text-3xl font-bold text-center text-white mb-10">{config.headline || 'What Our Customers Say'}</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
        {testimonials.map((t, idx) => (
          <motion.div 
            key={idx}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.2 }}
            className="bg-white/5 border border-white/10 p-6 rounded-2xl"
          >
            <div className="flex text-amber-400 mb-4">
              {'★'.repeat(5)}
            </div>
            <p className="text-slate-300 italic mb-4">"{t.text}"</p>
            <p className="text-white font-bold">— {t.name}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
