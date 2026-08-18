import { motion } from 'framer-motion';
import { Order } from '../../../types/models';
import { useAuthStore, useCartStore } from '../../../lib/store';
import { TiltCard } from '../../ui/TiltCard';
import { GlassButton } from '../../ui/glass/GlassSystem';
import { Package, MapPin, MessageSquare, DollarSign, Award, Heart, Navigation, XCircle } from 'lucide-react';
import { useNavigate } from 'react-router';
import toast from 'react-hot-toast';

interface Props {
  orders: Order[];
  stats: any;
  setActiveTab: (tab: string) => void;
}

export default function DashboardHome({ orders, stats, setActiveTab }: Props) {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const activeOrder = orders.find((o) => !["delivered", "cancelled", "pending"].includes(o.status));
  const latestOrder = orders[0];
  const isLatestCancelled = latestOrder && latestOrder.status === "cancelled";
  const cancelReason = isLatestCancelled
    ? latestOrder.cancellationReason || (latestOrder as any).cancellation_reason || (latestOrder as any).lastRejectionReason || (latestOrder as any).reason
    : null;

  // Determine Loyalty Tier
  let tier = "Bronze Member";
  if (stats.rewardPoints > 1000) tier = "Platinum Member";
  else if (stats.rewardPoints > 500) tier = "Gold Member";
  else if (stats.rewardPoints > 200) tier = "Silver Member";

  return (
    <div className="flex flex-col gap-8">
      {/* Cancelled Order Banner */}
      {isLatestCancelled && (
        <div className="bg-red-950/40 border border-red-500/40 rounded-2xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-lg">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-red-500/20 rounded-xl text-red-400 border border-red-500/30">
              <XCircle size={20} />
            </div>
            <div>
              <p className="text-xs font-bold text-red-400 uppercase tracking-wider">
                Order {latestOrder.dailyOrderNumber || `#${latestOrder.id?.slice(-6).toUpperCase()}`} Cancelled
              </p>
              <p className="text-white text-sm font-medium mt-0.5">
                Reason: <span className="font-semibold italic">{cancelReason ? `"${cancelReason}"` : "Cancelled by restaurant."}</span>
              </p>
            </div>
          </div>
          <GlassButton
            variant="secondary"
            onClick={() => navigate(`/order-tracking/${latestOrder.id}`)}
            className="text-xs font-bold whitespace-nowrap !py-2 !px-4"
          >
            View Details
          </GlassButton>
        </div>
      )}
      {/* 3D Hero Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Welcome Card */}
        <TiltCard className="lg:col-span-2 p-8 overflow-hidden bg-gradient-to-br from-white/10 to-transparent">
          <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex-1">
              <p className="text-primary-400 font-bold mb-1">Good Evening,</p>
              <h2 className="text-3xl md:text-4xl font-black text-white mb-2 flex items-center gap-2">
                {user?.name?.split(" ")[0] || "Friend"} 👋
              </h2>
              <div className="flex items-center gap-2 mb-4">
                <span className="bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 px-3 py-1 rounded-full text-sm font-bold flex items-center gap-1">
                  <Award size={14} /> {tier}
                </span>
                <span className="text-slate-300 text-sm font-medium border border-white/10 bg-dark-900/50 px-3 py-1 rounded-full">
                  {stats.rewardPoints} Reward Points
                </span>
              </div>
              
              <div className="flex flex-wrap gap-3 mt-6">
                <GlassButton variant="primary" onClick={() => navigate("/menu")} className="flex items-center gap-2 text-sm">
                  <Package size={16} /> Order Again
                </GlassButton>
                {activeOrder && (
                  <GlassButton onClick={() => navigate(`/order-tracking/${activeOrder.id}`)} className="flex items-center gap-2 text-sm border-green-500/30 text-green-400 hover:bg-green-500/10">
                    <Navigation size={16} /> Track Order
                  </GlassButton>
                )}
              </div>
            </div>
            
            {/* Floating Avatar or Pizza */}
            <motion.div
              animate={{ y: [-10, 10, -10], rotateZ: [-5, 5, -5] }}
              transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
              className="relative w-40 h-40 drop-shadow-2xl hidden md:flex items-center justify-center"
            >
              <div className="absolute inset-0 bg-primary-500/20 blur-3xl rounded-full" />
              {user?.photoUrl ? (
                <img src={user.photoUrl} className="w-32 h-32 rounded-full object-cover border-4 border-white/20 shadow-2xl relative z-10" />
              ) : (
                <span className="text-8xl relative z-10" style={{ filter: "drop-shadow(0 20px 30px rgba(0,0,0,0.5))" }}>🍕</span>
              )}
            </motion.div>
          </div>
        </TiltCard>

        {/* Quick Actions Card */}
        <TiltCard className="p-8 flex flex-col justify-center items-center text-center bg-gradient-to-br from-accent-500/10 to-transparent">
          <div className="w-16 h-16 bg-accent-500/20 rounded-full flex items-center justify-center mb-4 border border-accent-500/30">
            <motion.span animate={{ rotateY: 360 }} transition={{ duration: 4, repeat: Infinity, ease: "linear" }} className="text-3xl">
              ✨
            </motion.span>
          </div>
          <h3 className="text-xl font-bold text-white mb-2">AI Assistant</h3>
          <p className="text-sm text-white/60 mb-6">Build the perfect pizza based on your past favorites.</p>
          <GlassButton
            onClick={() => navigate('/assistant')}
            className="w-full flex items-center justify-center gap-2"
          >
            <MessageSquare size={18} /> Open Assistant
          </GlassButton>
        </TiltCard>
      </div>

      {/* 3D Statistics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {[
          { label: "Total Orders", value: stats.totalOrders.toString(), icon: Package, color: "text-orange-400", bg: "bg-orange-500/20", border: "border-orange-500/30" },
          { label: "Total Spent", value: `₹${stats.totalSpent}`, icon: DollarSign, color: "text-green-400", bg: "bg-green-500/20", border: "border-green-500/30" },
          { label: "Pizza Points", value: stats.rewardPoints.toString(), icon: Award, color: "text-yellow-400", bg: "bg-yellow-500/20", border: "border-yellow-500/30" },
          { label: "Favorite Pizza", value: stats.favoritePizza, icon: Heart, color: "text-red-400", bg: "bg-red-500/20", border: "border-red-500/30", truncate: true },
        ].map((stat, idx) => (
          <TiltCard key={idx} className="p-6">
            <div className={`w-12 h-12 rounded-xl ${stat.bg} ${stat.border} border flex items-center justify-center mb-4`}>
              <stat.icon className={`w-6 h-6 ${stat.color}`} />
            </div>
            <p className="text-sm text-slate-400 font-medium mb-1">{stat.label}</p>
            <p className={`text-2xl font-black text-white ${stat.truncate ? "truncate" : ""}`}>{stat.value}</p>
          </TiltCard>
        ))}
      </div>

      {/* Recommended For You Section */}
      {stats.recommended.length > 0 && (
        <div className="mb-8">
          <h3 className="text-2xl font-black text-white mb-6 flex items-center gap-2">
            <Heart size={24} className="text-red-500" /> AI Recommendations
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {stats.recommended.map((item: any, idx: number) => (
              <TiltCard key={idx} className="p-4 flex flex-col justify-between hover:border-primary-500/30">
                <div className="flex items-center gap-4 mb-4">
                  {item.image && (
                    <img src={item.image} alt={item.name} className="w-16 h-16 rounded-xl object-cover border border-white/10" />
                  )}
                  <div>
                    <h4 className="font-bold text-white text-lg leading-tight mb-1">{item.name}</h4>
                    <p className="text-primary-400 font-bold">₹{item.price}</p>
                  </div>
                </div>
                <GlassButton
                  variant="primary"
                  onClick={() => {
                    useCartStore.getState().addItem({
                      id: item.id || Math.random().toString(),
                      menuItemId: item.menuItemId || item.id || 'unknown',
                      name: item.name,
                      price: item.price,
                      quantity: 1,
                      image: item.image,
                    });
                    toast.success(`${item.name} added to cart`);
                  }}
                  className="w-full"
                >
                  Add to Cart
                </GlassButton>
              </TiltCard>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
