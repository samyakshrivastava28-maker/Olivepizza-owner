import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Order, CartItem } from '../../../types/models';
import { useNavigate } from 'react-router';
import { useCartStore } from '../../../lib/store';
import { toast } from 'react-hot-toast';
import { GlassButton } from '../../ui/glass/GlassSystem';
import { MapPin, RotateCcw, Search } from 'lucide-react';

interface Props {
  orders: Order[];
}

export default function OrderHistory({ orders }: Props) {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");

  const filteredOrders = useMemo(() => {
    if (!searchTerm.trim()) return orders;
    const lower = searchTerm.toLowerCase();
    return orders.filter(o => 
      o.dailyOrderNumber?.toLowerCase().includes(lower) || 
      o.id?.toLowerCase().includes(lower)
    );
  }, [orders, searchTerm]);

  const handleReorder = (order: Order, e: React.MouseEvent) => {
    e.stopPropagation();
    const { addItem } = useCartStore.getState();
    order.items.forEach((item: CartItem) => {
      addItem({
        id: item.id || Math.random().toString(),
        menuItemId: item.menuItemId || item.id || 'unknown',
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        image: item.image,
      });
    });
    toast.success("Items restored to cart!");
    setTimeout(() => navigate('/cart'), 800);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-2">
        <h2 className="text-2xl text-white font-black flex items-center gap-2">
          <RotateCcw className="text-primary-500" /> Order History
        </h2>
        <div className="relative w-full md:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search Order Number..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-dark-900/50 border border-white/10 rounded-xl py-2 pl-9 pr-4 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-primary-500 transition-colors"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredOrders.length === 0 && (
          <div className="col-span-full text-center text-slate-500 bg-dark-900/50 p-12 rounded-2xl border border-dark-800">
            {searchTerm ? "No orders found matching your search." : "No orders yet. Start your pizza journey!"}
          </div>
        )}
        
        {filteredOrders.map((order, idx) => {
          const isActive = !["delivered", "cancelled"].includes(order.status);
          
          return (
            <motion.div
              key={order.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              whileHover={{ y: -4 }}
              className={`relative p-5 rounded-2xl transition-all duration-300 overflow-hidden cursor-pointer border hover:shadow-xl ${
                isActive
                  ? "bg-[#273449] border-primary-500/50 shadow-[0_0_20px_rgba(249,115,22,0.15)]"
                  : "bg-white/5 border-white/10"
              }`}
              onClick={() => navigate(`/order-tracking/${order.id}`)}
            >
              {/* Active pulse indicator */}
              {isActive && (
                <div className="absolute top-4 right-4">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-primary-500"></span>
                  </span>
                </div>
              )}

              <div className="flex justify-between items-start mb-4">
                <div>
                  <span className="font-bold text-white text-lg">
                    {order.dailyOrderNumber || `Order #${order.id?.slice(-6).toUpperCase()}`}
                  </span>
                  <p className="text-xs text-slate-400 mt-1">
                    {new Date(order.createdAt).toLocaleString(undefined, {
                      weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                    })}
                  </p>
                </div>
                <span className="font-black text-primary-400 text-lg">
                  ₹{order.totalAmount}
                </span>
              </div>

              {/* Cancelled Reason Snippet */}
              {order.status === "cancelled" && (
                <div className="mb-4 bg-red-950/40 border border-red-500/30 rounded-xl p-3 text-xs text-red-200">
                  <span className="font-bold text-red-400 block uppercase tracking-wider text-[10px] mb-0.5">
                    Cancellation Reason:
                  </span>
                  <p className="italic font-medium text-white">
                    {order.cancellationReason || (order as any).cancellation_reason || (order as any).lastRejectionReason || (order as any).reason ? `"${order.cancellationReason || (order as any).cancellation_reason || (order as any).lastRejectionReason || (order as any).reason}"` : "Cancelled by restaurant."}
                  </p>
                </div>
              )}

              {/* Items preview */}
              <div className="flex gap-2 mb-5 overflow-hidden">
                {order.items.slice(0, 4).map((item: CartItem, i: number) => (
                  item.image && (
                    <div key={i} className="relative w-12 h-12 rounded-xl overflow-hidden border border-white/10 group">
                      <img src={item.image} alt={item.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform" />
                    </div>
                  )
                ))}
                {order.items.length > 4 && (
                  <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-xs font-bold text-slate-300">
                    +{order.items.length - 4}
                  </div>
                )}
              </div>

              {/* Status Badge & Actions */}
              <div className="flex items-center justify-between mt-auto">
                <span
                  className={`px-3 py-1.5 text-xs font-bold rounded-full border ${
                    order.status === "delivered"
                      ? "bg-green-500/10 text-green-400 border-green-500/20"
                      : order.status === "cancelled"
                        ? "bg-red-500/10 text-red-400 border-red-500/20"
                        : "bg-primary-500/10 text-primary-400 border-primary-500/20"
                  }`}
                >
                  {order.status.replace("_", " ").toUpperCase()}
                </span>
                
                <div className="flex items-center gap-2">
                  <a
                    href={`/api/payment/invoice/${order.id}`}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-xs font-bold text-slate-300 hover:text-white flex items-center gap-1 bg-white/10 px-3 py-1.5 rounded-lg border border-white/10 transition-colors"
                    title="Download Official Tax Invoice"
                  >
                    📄 Invoice
                  </a>
                  {order.status === "delivered" && (
                    <GlassButton
                      variant="primary"
                      className="!px-4 !py-1.5 text-xs font-bold h-auto rounded-lg hover:shadow-lg hover:shadow-primary-500/25"
                      onClick={(e) => handleReorder(order, e)}
                    >
                      <RotateCcw className="w-3 h-3 mr-1 inline" /> Reorder
                    </GlassButton>
                  )}
                  {order.status === "cancelled" && (
                    <span className="text-xs font-bold text-red-400 flex items-center gap-1 bg-red-500/10 px-3 py-1.5 rounded-lg border border-red-500/20">
                      View Details
                    </span>
                  )}
                  {isActive && (
                    <span className="text-xs font-bold text-primary-400 flex items-center gap-1 bg-primary-500/10 px-3 py-1.5 rounded-lg border border-primary-500/20">
                      <MapPin className="w-3 h-3" /> Track
                    </span>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
