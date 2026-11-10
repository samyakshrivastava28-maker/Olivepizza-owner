import { motion } from 'framer-motion';
import { Check, Clock, Package, ChefHat, Bike, MapPin } from 'lucide-react';

interface Props {
  status: string;
}

const steps = [
  { id: "pending", label: "Order Placed", icon: Clock },
  { id: "accepted", label: "Accepted", icon: Check },
  { id: "preparing", label: "Preparing", icon: ChefHat },
  { id: "ready", label: "Ready", icon: Package },
  { id: "partner_assigned", label: "Partner Assigned", icon: Bike },
  { id: "out_for_delivery", label: "Out for Delivery", icon: MapPin },
  { id: "delivered", label: "Delivered", icon: Check },
];

export default function OrderTimeline({ status }: Props) {
  const currentStepIndex = steps.findIndex((s) => s.id === status) || 0;

  return (
    <div className="w-full bg-dark-900 rounded-3xl p-6 border border-white/5 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-primary-500/10 to-transparent opacity-50 pointer-events-none" />
      
      <h3 className="text-xl font-black text-white mb-8 relative z-10">Order Timeline</h3>
      
      <div className="relative z-10">
        {steps.map((step, index) => {
          const isActive = index === currentStepIndex;
          const isPassed = index < currentStepIndex;
          
          return (
            <div key={step.id} className="flex gap-4 relative group">
              {/* Vertical Line */}
              {index !== steps.length - 1 && (
                <div className="absolute left-5 top-10 bottom-[-1.5rem] w-0.5 bg-dark-800">
                  {(isPassed || isActive) && (
                    <motion.div 
                      initial={{ height: 0 }}
                      animate={{ height: "100%" }}
                      className="w-full bg-primary-500"
                    />
                  )}
                </div>
              )}
              
              <div className="pb-6">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                  isActive ? "bg-primary-500 text-white shadow-[0_0_20px_rgba(249,115,22,0.4)] scale-110" :
                  isPassed ? "bg-primary-500/20 text-primary-500" :
                  "bg-dark-800 text-slate-500"
                }`}>
                  <step.icon size={20} />
                </div>
              </div>
              
              <div className="pt-2 pb-6 flex-1">
                <h4 className={`font-bold ${isActive ? "text-primary-400 text-lg" : isPassed ? "text-white" : "text-slate-500"}`}>
                  {step.label}
                </h4>
                {isActive && (
                  <motion.p 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-sm text-slate-400 mt-1"
                  >
                    Current Status
                  </motion.p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
