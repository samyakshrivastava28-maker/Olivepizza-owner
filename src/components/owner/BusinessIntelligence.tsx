import { motion } from 'framer-motion';
import { GlassCard } from '../ui/glass/GlassSystem';
import { BrainCircuit, TrendingUp, Users, AlertTriangle, MessageSquare, Target } from 'lucide-react';

interface BIProps {
  ordersData?: any[];
  deliveryPartners?: any[];
}

export default function BusinessIntelligence({ ordersData = [], deliveryPartners = [] }: BIProps) {
  // Compute basic insights from orders
  const insights = [];

  if (ordersData.length > 0) {
    const totalOrders = ordersData.length;
    const cancelledOrders = ordersData.filter(o => o.status === 'cancelled').length;
    
    // Find most popular item
    const itemCounts: Record<string, number> = {};
    ordersData.forEach(o => {
      (o.items || []).forEach((item: any) => {
        itemCounts[item.name] = (itemCounts[item.name] || 0) + item.quantity;
      });
    });
    const topItem = Object.entries(itemCounts).sort((a, b) => b[1] - a[1])[0];

    if (topItem) {
      insights.push({
        type: "sales",
        icon: TrendingUp,
        color: "text-green-400",
        bg: "bg-green-500/10",
        text: `${topItem[0]} is your top selling item this period with ${topItem[1]} orders.`,
      });
    }

    if (cancelledOrders > 0) {
      insights.push({
        type: "retention",
        icon: AlertTriangle,
        color: "text-red-400",
        bg: "bg-red-500/10",
        text: `You have ${cancelledOrders} cancelled orders out of ${totalOrders} total orders.`,
      });
    } else {
      insights.push({
        type: "retention",
        icon: Users,
        color: "text-purple-400",
        bg: "bg-purple-500/10",
        text: `Great job! 0 cancelled orders recently. Customer retention looks strong.`,
      });
    }
  } else {
    insights.push({
      type: "sales",
      icon: TrendingUp,
      color: "text-green-400",
      bg: "bg-green-500/10",
      text: "Waiting for orders to generate sales insights.",
    });
  }

  insights.push({
    type: "inventory",
    icon: AlertTriangle,
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    text: "AI Tip: Monitor cheese stock closely during weekend volume spikes.",
  });

  return (
    <div className="flex flex-col xl:flex-row gap-6 mb-6">
      <GlassCard className="w-full xl:w-1/2 p-6">
        <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
          <BrainCircuit className="text-primary-500" />
          Business Intelligence AI
        </h2>
        
        <div className="space-y-4">
          {insights.map((insight, idx) => (
            <motion.div 
              key={idx}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.1 }}
              className="flex items-start gap-4 bg-dark-900/50 p-4 rounded-xl border border-white/5"
            >
              <div className={`p-2 rounded-lg ${insight.bg} shrink-0`}>
                <insight.icon className={`w-5 h-5 ${insight.color}`} />
              </div>
              <div>
                <p className="text-sm text-slate-300 font-medium leading-relaxed">
                  {insight.text}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </GlassCard>

      <GlassCard className="w-full xl:w-1/2 p-6">
        <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
          <Target className="text-primary-500" />
          Delivery Partner Performance
        </h2>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10 text-slate-400 text-sm">
                <th className="pb-3 font-medium">Partner</th>
                <th className="pb-3 font-medium text-center">Total Deliveries</th>
                <th className="pb-3 font-medium text-center">Avg Time</th>
                <th className="pb-3 font-medium text-center">Completed</th>
              </tr>
            </thead>
            <tbody>
              {deliveryPartners.length === 0 && (
                 <tr className="text-slate-400 text-sm"><td colSpan={4} className="py-4 text-center">No delivery partners found</td></tr>
              )}
              {deliveryPartners.map((partner, idx) => {
                const metrics = partner.metrics || {};
                const total = metrics.totalDeliveries || 0;
                const completed = metrics.successfulDeliveries || 0;
                const avgMins = total > 0 ? Math.round((metrics.totalTimeTaken || 0) / total) : 0;
                
                return (
                  <tr key={partner.id || idx} className="border-b border-white/5 text-sm text-slate-200">
                    <td className="py-4 font-bold">{partner.name || 'Unknown'}</td>
                    <td className="py-4 text-center">{total}</td>
                    <td className="py-4 text-center text-primary-400 font-medium">{avgMins} mins</td>
                    <td className="py-4 text-center text-green-400 font-bold">{completed}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  );
}
