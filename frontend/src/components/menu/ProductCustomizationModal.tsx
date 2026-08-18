import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MenuItem } from '../../types/models';
import { X, Plus, Minus, Check, Flame, Sparkles, ChefHat } from 'lucide-react';
import { useCartStore } from '../../lib/store';
import { useCartAnimation } from '../ui/CartAnimationProvider';
import toast from 'react-hot-toast';

interface Props {
  item: MenuItem | null;
  onClose: () => void;
}

export default function ProductCustomizationModal({ item, onClose }: Props) {
  const addItem = useCartStore((state) => state.addItem);
  const { triggerAnimation } = useCartAnimation();

  const [quantity, setQuantity] = useState(1);
  const [selectedCrust, setSelectedCrust] = useState<'Classic' | 'Thin' | 'Pan'>('Classic');
  const [cheeseLevel, setCheeseLevel] = useState(5);
  const [selectedToppings, setSelectedToppings] = useState<string[]>(['Extra Cheese']);

  if (!item) return null;

  const basePrice = item.pricingMode === 'offer' && item.offerPrice ? item.offerPrice : item.basePrice;
  const isPizza = item.category === 'pizza' || (item.crusts && item.crusts.length > 0) || item.name.toLowerCase().includes('pizza');
  const crustPrice = isPizza ? (selectedCrust === 'Pan' ? 40 : selectedCrust === 'Thin' ? 20 : 0) : 0;
  const cheesePrice = isPizza && cheeseLevel > 5 ? 30 : 0;
  const toppingsPrice = isPizza ? selectedToppings.length * 25 : 0;
  const unitPrice = basePrice + crustPrice + cheesePrice + toppingsPrice;
  const totalPrice = unitPrice * quantity;

  const toggleTopping = (topping: string) => {
    setSelectedToppings(prev => 
      prev.includes(topping) ? prev.filter(t => t !== topping) : [...prev, topping]
    );
  };

  const handleAddToCart = (e: React.MouseEvent) => {
    const itemData = {
      id: `${item.id}-${isPizza ? selectedCrust : 'Standard'}-${isPizza ? cheeseLevel : 0}-${isPizza ? selectedToppings.join('-') : 'None'}`,
      menuItemId: item.id || '',
      name: isPizza ? `${item.name} (${selectedCrust} Crust)` : item.name,
      price: unitPrice,
      quantity,
      image: item.image,
      isVegetarian: item.isVegetarian,
      crust: isPizza ? `${selectedCrust} Crust` : undefined,
      size: 'Medium',
      addons: isPizza ? selectedToppings : []
    };

    onClose();

    triggerAnimation(e, item.image, () => {
      addItem(itemData);
      toast.success(`Added ${item.name} to order! 🍕`);
    });
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-dark-950/80 backdrop-blur-md overflow-y-auto">
        <motion.div
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 250 }}
          className="w-full max-w-lg bg-dark-900 border border-white/15 rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <div className="flex items-center gap-3">
              <img src={item.image} alt={item.name} className="w-12 h-12 rounded-xl object-cover border border-white/10" />
              <div>
                <h3 className="font-bold text-white text-base sm:text-lg">{item.name}</h3>
                <p className="text-xs text-slate-400">
                  {isPizza ? 'Customize your crust, cheese & toppings' : 'Select quantity & add to cart'}
                </p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white bg-dark-800 rounded-full transition-colors min-touch-target"
            >
              <X size={18} />
            </button>
          </div>

          {/* Quantity Stepper */}
          <div className="flex items-center justify-between bg-dark-950/60 p-3.5 rounded-2xl border border-white/5">
            <span className="text-sm font-bold text-slate-300">Quantity</span>
            <div className="flex items-center gap-3 bg-dark-900 px-2 py-1 rounded-full border border-dark-700">
              <button 
                onClick={() => setQuantity(q => Math.max(1, q - 1))}
                className="w-7 h-7 rounded-full bg-dark-800 flex items-center justify-center text-white min-touch-target"
              >
                <Minus size={14} />
              </button>
              <span className="font-black text-sm text-white px-2">{quantity}</span>
              <button 
                onClick={() => setQuantity(q => q + 1)}
                className="w-7 h-7 rounded-full bg-dark-800 flex items-center justify-center text-white min-touch-target"
              >
                <Plus size={14} />
              </button>
            </div>
          </div>

          {/* Render Pizza Customizations ONLY if product is a Pizza */}
          {isPizza && (
            <>
              {/* Crust Selection */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Crust Selection</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Classic', 'Thin', 'Pan'] as const).map(crust => (
                    <button
                      key={crust}
                      onClick={() => setSelectedCrust(crust)}
                      className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all border min-touch-target ${
                        selectedCrust === crust 
                          ? 'bg-primary-600 text-white border-primary-400 shadow-md' 
                          : 'bg-dark-950 text-slate-400 border-dark-800 hover:text-white'
                      }`}
                    >
                      {crust} {crust === 'Pan' ? '(+₹40)' : crust === 'Thin' ? '(+₹20)' : ''}
                    </button>
                  ))}
                </div>
              </div>

              {/* Cheese Level Slider */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-400 uppercase tracking-wider">Cheese Level</span>
                  <span className="font-bold text-accent-400">{cheeseLevel > 7 ? 'Extra Cheese 🧀' : cheeseLevel > 3 ? 'Standard' : 'Light'}</span>
                </div>
                <input 
                  type="range"
                  min="0"
                  max="10"
                  value={cheeseLevel}
                  onChange={(e) => setCheeseLevel(Number(e.target.value))}
                  className="w-full accent-primary-500 bg-dark-950 h-2 rounded-lg cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-500 font-bold">
                  <span>Zero</span>
                  <span>Classic</span>
                  <span>Ten</span>
                </div>
              </div>

              {/* Extra Toppings */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Extra Toppings (+₹25 each)</label>
                <div className="grid grid-cols-2 gap-2">
                  {['Extra Cheese', 'Jalapeños', 'Fresh Olives', 'Crispy Paneer', 'Mushrooms', 'Red Paprika'].map(topping => {
                    const isSelected = selectedToppings.includes(topping);
                    return (
                      <button
                        key={topping}
                        onClick={() => toggleTopping(topping)}
                        className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-between border min-touch-target ${
                          isSelected 
                            ? 'bg-emerald-950/60 text-emerald-400 border-emerald-500/40' 
                            : 'bg-dark-950 text-slate-400 border-dark-800'
                        }`}
                      >
                        <span>{topping}</span>
                        {isSelected && <Check size={14} />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* Live Price Footer & Add Button */}
          <div className="pt-4 border-t border-white/10 flex items-center justify-between gap-4">
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Live Price</p>
              <p className="text-2xl font-black text-white">₹{totalPrice}</p>
            </div>

            <button
              onClick={handleAddToCart}
              className="flex-1 bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-500 hover:to-primary-400 text-white py-3.5 px-6 rounded-2xl font-bold transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2 text-sm min-touch-target"
            >
              <Sparkles size={16} /> Add to Order • ₹{totalPrice}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
