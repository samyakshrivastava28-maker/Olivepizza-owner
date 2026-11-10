import { useState, useEffect, useMemo } from 'react';
import { useAuthStore } from '../../../lib/store';
import { subscribeToWishlist } from '../../../lib/wishlist';
import { useDataStore } from '../../../lib/dataStore';
import { Heart } from 'lucide-react';
import ProductCard from '../../ProductCard';
import ComboCard from '../../ui/ComboCard';
import WishlistButton from '../../ui/WishlistButton';

export default function Wishlist() {
  const { user } = useAuthStore();
  const { products, combos } = useDataStore();
  const [wishlistIds, setWishlistIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToWishlist(user.uid, (ids: string[]) => {
      setWishlistIds(ids);
      setIsLoading(false);
    });
    return unsub;
  }, [user]);

  const savedProducts = useMemo(() => {
    return products.filter((p: any) => wishlistIds.includes(p.id!));
  }, [products, wishlistIds]);

  const savedCombos = useMemo(() => {
    return combos.filter((c: any) => wishlistIds.includes(c.id!));
  }, [combos, wishlistIds]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-2xl text-white font-black flex items-center gap-2">
          <Heart className="text-red-500 fill-red-500" /> Saved Items
        </h2>
      </div>

      {isLoading ? (
        <div className="text-slate-400">Loading saved items...</div>
      ) : wishlistIds.length === 0 ? (
        <div className="text-center text-slate-500 bg-dark-900/50 p-12 rounded-2xl border border-dark-800">
          You haven't saved any items yet. Tap the heart icon on a pizza to save it for later!
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {savedProducts.length > 0 && (
            <div>
              <h3 className="text-lg font-bold text-white mb-4">Pizzas & Sides</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {savedProducts.map((p: any) => (
                  <div key={p.id} className="relative">
                    <ProductCard item={p as any} />
                    <div className="absolute top-2 right-2 z-10">
                      <WishlistButton productId={p.id!} wishlistIds={wishlistIds} size="sm" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {savedCombos.length > 0 && (
            <div>
              <h3 className="text-lg font-bold text-white mb-4">Combos</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {savedCombos.map((c: any, idx: number) => (
                  <ComboCard key={c.id} combo={c as any} wishlistIds={wishlistIds} index={idx} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
