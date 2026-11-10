import React from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, Flame, Leaf, Zap, Award } from 'lucide-react';

interface StoryCard {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  image: string;
  badge: string;
  gradient: string;
}

const STORIES: StoryCard[] = [
  {
    id: "story-1",
    title: "48-Hour Slow Fermented Sourdough",
    subtitle: "Airy, crispy, & easily digestible",
    description:
      "Our signature dough is crafted using natural Italian wild yeast starter and aged for 48 hours to develop rich complex flavors with a light, airy crust.",
    icon: ShieldCheck,
    image: "https://images.unsplash.com/photo-1579751626657-72bc17010498?w=600&q=80",
    badge: "Crust Perfection",
    gradient: "from-amber-500/20 to-orange-500/10",
  },
  {
    id: "story-2",
    title: "100% Organic Farm Fresh Tops",
    subtitle: "Sourced daily from local farms",
    description:
      "We partner directly with organic farmers in Chhattisgarh for sun-ripened tomatoes, fresh sweet basil, and premium Fior di Latte mozzarella.",
    icon: Leaf,
    image: "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=600&q=80",
    badge: "100% Organic",
    gradient: "from-emerald-500/20 to-teal-500/10",
  },
  {
    id: "story-3",
    title: "500°C Wood-Fired Brick Oven",
    subtitle: "Authentic Neapolitan sear",
    description:
      "Every pizza is baked inside our custom dome oven at 500°C for 90 seconds, producing those signature leopard spots and smoky char.",
    icon: Flame,
    image: "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=600&q=80",
    badge: "Wood-Fired",
    gradient: "from-red-500/20 to-rose-500/10",
  },
  {
    id: "story-4",
    title: "30-Minute Hot Express Delivery",
    subtitle: "Thermal insulated heated bags",
    description:
      "Delivered steaming hot directly to your doorstep with real-time GPS tracking and dedicated delivery champions.",
    icon: Zap,
    image: "https://images.unsplash.com/photo-1526367790999-0150786686a2?w=600&q=80",
    badge: "Fastest Delivery",
    gradient: "from-blue-500/20 to-cyan-500/10",
  },
];

export default function StorytellingSection() {
  return (
    <section className="relative py-16 md:py-24 z-10 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-12 md:mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-md mb-4">
            <Award className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-amber-300">
              The Olive Standard
            </span>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-tight">
            Why Olive Pizza Taste <span className="bg-gradient-to-r from-amber-400 via-orange-400 to-red-500 bg-clip-text text-transparent">Extraordinary</span>
          </h2>
          <p className="text-slate-400 text-sm md:text-base mt-3">
            We refuse to compromise on quality. Every slice tells a story of passion, tradition, and perfection.
          </p>
        </div>

        {/* Story Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {STORIES.map((story, idx) => {
            const Icon = story.icon;
            return (
              <motion.div
                key={story.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: idx * 0.1 }}
                whileHover={{ y: -8 }}
                className={`relative rounded-3xl overflow-hidden border border-white/10 backdrop-blur-xl bg-gradient-to-br ${story.gradient} flex flex-col sm:flex-row group`}
                style={{
                  boxShadow: "0 20px 40px rgba(0,0,0,0.5)",
                }}
              >
                {/* Image Section */}
                <div className="relative sm:w-1/2 h-52 sm:h-auto overflow-hidden">
                  <img
                    src={story.image}
                    alt={story.title}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t sm:bg-gradient-to-r from-slate-950/80 via-transparent to-transparent" />
                  <span className="absolute top-4 left-4 px-3 py-1 rounded-full bg-black/60 border border-white/10 backdrop-blur-md text-[10px] font-black uppercase text-amber-300 tracking-wider">
                    {story.badge}
                  </span>
                </div>

                {/* Content Section */}
                <div className="sm:w-1/2 p-6 sm:p-8 flex flex-col justify-between">
                  <div>
                    <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center mb-4 text-amber-400">
                      <Icon className="w-5 h-5" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-1 group-hover:text-amber-300 transition-colors">
                      {story.title}
                    </h3>
                    <p className="text-xs text-amber-400/90 font-semibold mb-3">
                      {story.subtitle}
                    </p>
                    <p className="text-xs text-slate-300 leading-relaxed font-medium">
                      {story.description}
                    </p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
