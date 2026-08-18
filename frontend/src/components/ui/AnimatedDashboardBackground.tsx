import { motion } from 'framer-motion';

export type DashboardTheme = 'customer' | 'owner' | 'delivery';

interface Props {
  theme?: DashboardTheme;
}

export default function AnimatedDashboardBackground({ theme = 'customer' }: Props) {
  // Theme Configurations
  const configs: Record<string, any> = {
    customer: {
      blobs: [
        { color: 'bg-orange-500/[0.01]', size: 'w-96 h-96', top: '-10%', left: '-10%', delay: 0 },
        { color: 'bg-yellow-500/[0.01]', size: 'w-[500px] h-[500px]', bottom: '-20%', right: '-10%', delay: 2 },
        { color: 'bg-primary-500/[0.01]', size: 'w-64 h-64', top: '40%', left: '50%', delay: 4 },
      ],
      showGrid: false,
      gridColor: 'border-white/[0.01]',
      lines: []
    },
    owner: {
      blobs: [
        { color: 'bg-orange-600/[0.01]', size: 'w-[600px] h-[600px]', top: '-20%', right: '-20%', delay: 0 },
        { color: 'bg-blue-500/[0.01]', size: 'w-80 h-80', bottom: '10%', left: '-10%', delay: 3 },
      ],
      showGrid: true,
      gridColor: 'border-orange-500/[0.01]',
      lines: [
        { top: '30%', duration: 15 },
        { top: '60%', duration: 25 },
        { top: '80%', duration: 20 },
      ]
    },
    delivery: {
      blobs: [
        { color: 'bg-green-500/[0.02]', size: 'w-80 h-80', top: '10%', right: '10%', delay: 0 },
        { color: 'bg-blue-500/[0.02]', size: 'w-96 h-96', bottom: '-10%', left: '-10%', delay: 2 },
      ],
      showGrid: true,
      gridColor: 'border-green-500/[0.01]',
      lines: [
        { top: '20%', duration: 10, vertical: true, left: '20%' },
        { top: '0%', duration: 12, vertical: true, left: '80%' },
      ]
    }
  };

  const currentConfig = configs[theme];

  return (
    <div className="fixed inset-0 z-0 overflow-hidden bg-[#0B0F14] pointer-events-none">
      
      {/* Deep Dark Base Gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#0B0F14] via-[#0B0F14] to-[#111827] opacity-90" />

      {/* Floating Light Blobs */}
      {currentConfig.blobs.map((blob: any, idx: number) => (
        <motion.div
          key={idx}
          className={`absolute rounded-full blur-[100px] ${blob.color} ${blob.size}`}
          style={{ top: blob.top, left: blob.left, right: blob.right, bottom: blob.bottom }}
          animate={{
            x: [0, 30, -20, 0],
            y: [0, -40, 20, 0],
            scale: [1, 1.1, 0.9, 1]
          }}
          transition={{
            duration: 15,
            repeat: Infinity,
            ease: "linear",
            delay: blob.delay
          }}
        />
      ))}

      {/* Subtle Grid Background (Owner/Delivery) */}
      {currentConfig.showGrid && (
        <div 
          className="absolute inset-0"
          style={{
            backgroundImage: `linear-gradient(to right, rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.02) 1px, transparent 1px)`,
            backgroundSize: '4rem 4rem',
            transform: 'none',
            transformOrigin: 'top center',
            opacity: 0.05
          }}
        >
          {/* Animated Graph/Route Lines */}
          {currentConfig.lines.map((line: any, idx: number) => (
            <motion.div
              key={idx}
              className={`absolute ${line.vertical ? 'w-[1px] h-full bg-gradient-to-b' : 'h-[1px] w-full bg-gradient-to-r'} from-transparent via-${theme === 'delivery' ? 'green-500' : 'orange-500'}/5 to-transparent`}
              style={{ top: line.top, left: line.left }}
              animate={{
                [line.vertical ? 'y' : 'x']: ['-100%', '100%']
              }}
              transition={{
                duration: line.duration,
                repeat: Infinity,
                ease: "linear"
              }}
            />
          ))}
        </div>
      )}

      {/* Soft Vignette Overlay to darken edges and frame content */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,#0B0F14_100%)] opacity-80" />
      
      {/* Noise Overlay for texture */}
      <div 
        className="absolute inset-0 opacity-[0.03] mix-blend-overlay"
        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}
      />
    </div>
  );
}
