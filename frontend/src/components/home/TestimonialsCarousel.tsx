import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, ChevronLeft, ChevronRight, Quote, CheckCircle2 } from 'lucide-react';

interface Testimonial {
  id: string;
  name: string;
  role: string;
  avatar: string;
  rating: number;
  comment: string;
  favoritePizza: string;
}

const REVIEWS: Testimonial[] = [
  {
    id: "rev-1",
    name: "Aarav Sharma",
    role: "Verified Food Critic",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&q=80",
    rating: 5,
    comment:
      "Hands down the best sourdough pizza in town. The crust has that crisp Neapolitan char with zero heavy stomach feeling afterwards!",
    favoritePizza: "Truffle Mushroom Supreme",
  },
  {
    id: "rev-2",
    name: "Priya Patel",
    role: "Regular Customer",
    avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&q=80",
    rating: 5,
    comment:
      "Arrived piping hot in under 25 minutes. The 100% pure veg options and garlic cheese dip are absolute heaven!",
    favoritePizza: "Paneer Tikka Passion",
  },
  {
    id: "rev-3",
    name: "Rohan Verma",
    role: "Local Foodie",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&q=80",
    rating: 5,
    comment:
      "The AI Assistant recommended a custom combo that blew my mind. Super fast checkout and premium quality packaging.",
    favoritePizza: "Fiery Jalapeno Blast",
  },
];

export default function TestimonialsCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0);

  const prevSlide = () => {
    setCurrentIndex((prev) => (prev === 0 ? REVIEWS.length - 1 : prev - 1));
  };

  const nextSlide = () => {
    setCurrentIndex((prev) => (prev === REVIEWS.length - 1 ? 0 : prev + 1));
  };

  const current = REVIEWS[currentIndex];

  return (
    <section className="relative py-16 md:py-24 z-10 overflow-hidden">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        {/* Title */}
        <div className="text-center mb-10 md:mb-14">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-400/10 border border-amber-400/20 backdrop-blur-md mb-3">
            <Quote className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-amber-300">
              Community Love
            </span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
            Loved By Over <span className="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">50,000+ Foodies</span>
          </h2>
        </div>

        {/* Testimonial Glass Card */}
        <div className="relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={current.id}
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              transition={{ duration: 0.4 }}
              className="p-8 sm:p-12 rounded-3xl backdrop-blur-2xl border border-white/10 relative overflow-hidden"
              style={{
                background: "linear-gradient(145deg, rgba(30,41,59,0.6) 0%, rgba(15,23,42,0.9) 100%)",
                boxShadow: "0 25px 60px rgba(0,0,0,0.6)",
              }}
            >
              {/* Stars */}
              <div className="flex gap-1 mb-6">
                {[...Array(current.rating)].map((_, i) => (
                  <Star key={i} className="w-5 h-5 fill-amber-400 text-amber-400" />
                ))}
              </div>

              {/* Quote Comment */}
              <p className="text-slate-200 text-base sm:text-xl font-medium leading-relaxed italic mb-8">
                "{current.comment}"
              </p>

              {/* User Profile Footer */}
              <div className="flex items-center justify-between pt-6 border-t border-white/10">
                <div className="flex items-center gap-4">
                  <img
                    src={current.avatar}
                    alt={current.name}
                    className="w-12 h-12 rounded-full object-cover border-2 border-amber-400/50 shadow-md"
                  />
                  <div>
                    <h4 className="text-white font-bold text-base flex items-center gap-1.5">
                      {current.name} <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    </h4>
                    <p className="text-xs text-slate-400 font-medium">
                      {current.role} • Fav: <span className="text-amber-300 font-bold">{current.favoritePizza}</span>
                    </p>
                  </div>
                </div>

                {/* Controls */}
                <div className="flex gap-2">
                  <button
                    onClick={prevSlide}
                    className="p-3 rounded-full bg-white/5 border border-white/10 hover:bg-white/15 text-white transition-all active:scale-95"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={nextSlide}
                    className="p-3 rounded-full bg-white/5 border border-white/10 hover:bg-white/15 text-white transition-all active:scale-95"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
