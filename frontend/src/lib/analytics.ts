/**
 * Anonymous Analytics & Activity Tracking Service
 * Architecture: Writes to Firestore analytics subcollections.
 * No personal data stored for anonymous events.
 */

import { db } from './firebase';
import { doc, increment, setDoc, updateDoc, getDoc, collection, addDoc } from 'firebase/firestore';

// ─── Event Types ──────────────────────────────────────────────────────────────

export type AnalyticsEvent =
  | { type: 'ad_view'; adId: string }
  | { type: 'ad_click'; adId: string; targetUrl?: string }
  | { type: 'coupon_view'; couponId: string }
  | { type: 'coupon_copy'; couponId: string }
  | { type: 'coupon_use'; couponId: string }
  | { type: 'category_view'; categoryId: string }
  | { type: 'category_product_click'; categoryId: string; productId: string }
  | { type: 'combo_view'; comboId: string }
  | { type: 'combo_purchase'; comboId: string }
  | { type: 'product_view'; productId: string }
  | { type: 'wishlist_add'; productId: string }
  | { type: 'wishlist_remove'; productId: string }
  | { type: 'section_view'; sectionId: string }
  | { type: 'order_again'; productId: string }
  | { type: 'search'; query: string };

// ─── Track Event ─────────────────────────────────────────────────────────────

/**
 * Fire-and-forget analytics tracking.
 * All events increment counters atomically in Firestore.
 * Errors are swallowed to prevent breaking the UI.
 */
export async function trackEvent(event: AnalyticsEvent): Promise<void> {
  try {
    switch (event.type) {
      case 'ad_view':
      case 'ad_click': {
        const field = event.type === 'ad_view' ? 'views' : 'clicks';
        const ref = doc(db, 'ads', event.adId);
        await updateDoc(ref, { [field]: increment(1) }).catch(() =>
          setDoc(ref, { [field]: 1 }, { merge: true })
        );
        break;
      }
      case 'coupon_view':
      case 'coupon_copy':
      case 'coupon_use': {
        const field =
          event.type === 'coupon_view'
            ? 'views'
            : event.type === 'coupon_copy'
            ? 'copies'
            : 'uses';
        const ref = doc(db, 'coupons', event.couponId);
        await updateDoc(ref, { [`analytics.${field}`]: increment(1) }).catch(() =>
          setDoc(ref, { analytics: { [field]: 1 } }, { merge: true })
        );
        break;
      }
      case 'category_view':
      case 'category_product_click': {
        const catRef = doc(db, 'special_categories', event.categoryId);
        const updateData: Record<string, any> = { 'analytics.views': increment(1) };
        if (event.type === 'category_product_click') {
          updateData[`analytics.productClicks.${event.productId}`] = increment(1);
        }
        await updateDoc(catRef, updateData).catch(() =>
          setDoc(catRef, { analytics: { views: 1 } }, { merge: true })
        );
        break;
      }
      case 'combo_view':
      case 'combo_purchase': {
        const field = event.type === 'combo_view' ? 'views' : 'purchases';
        // Combos are stored inside categories – track globally via a separate collection
        const ref = doc(db, 'combo_analytics', event.comboId);
        await updateDoc(ref, { [field]: increment(1) }).catch(() =>
          setDoc(ref, { [field]: 1 }, { merge: true })
        );
        break;
      }
      case 'section_view': {
        const ref = doc(db, 'home_analytics', event.sectionId);
        await updateDoc(ref, { views: increment(1) }).catch(() =>
          setDoc(ref, { views: 1 }, { merge: true })
        );
        break;
      }
      case 'product_view': {
        const ref = doc(db, 'products', event.productId);
        await updateDoc(ref, { 'analytics.views': increment(1) }).catch(() =>
          setDoc(ref, { analytics: { views: 1 } }, { merge: true })
        );
        break;
      }
      case 'wishlist_add':
      case 'wishlist_remove': {
        const delta = event.type === 'wishlist_add' ? 1 : -1;
        const ref = doc(db, 'products', event.productId);
        await updateDoc(ref, { 'analytics.wishlistAdds': increment(delta) }).catch(() => {});
        break;
      }
      case 'search': {
        if (event.query.trim().length < 2) break;
        await addDoc(collection(db, 'search_analytics'), {
          query: event.query.toLowerCase().trim(),
          timestamp: new Date().toISOString(),
        });
        break;
      }
    }
  } catch {
    // Silently fail - analytics should never break the UI
  }
}

// ─── Smart Product Ranking ────────────────────────────────────────────────────

/**
 * Computes a weighted ranking score for a product.
 * Used for the "Top Selling" section automatic mode.
 * 
 * Weights:
 *   orders       → 40%
 *   views        → 20%
 *   wishlistAdds → 15%
 *   revenueScore → 15%
 *   recency      → 10%
 */
export function computeRankingScore(product: {
  analytics?: {
    views?: number;
    wishlistAdds?: number;
    orders?: number;
    revenue?: number;
  };
  createdAt?: string;
}): number {
  const a = product.analytics || {};
  const views = a.views || 0;
  const wishlist = a.wishlistAdds || 0;
  const orders = a.orders || 0;
  const revenue = a.revenue || 0;

  // Recency bonus: newer products get a slight boost (max 100 pts over 30 days)
  let recencyScore = 0;
  if (product.createdAt) {
    const ageMs = Date.now() - new Date(product.createdAt).getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    recencyScore = Math.max(0, 100 - ageDays * (100 / 30));
  }

  return (
    orders * 0.40 * 10 +
    views * 0.20 +
    wishlist * 0.15 * 5 +
    revenue * 0.15 * 0.01 +
    recencyScore * 0.10
  );
}
