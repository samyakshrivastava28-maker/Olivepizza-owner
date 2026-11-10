/**
 * Wishlist Service
 * Architecture: Firestore `wishlists/{userId}` document.
 * Security: Users can only read/write their own document.
 */

import { db } from './firebase';
import { doc, getDoc, setDoc, updateDoc, arrayUnion, arrayRemove, onSnapshot } from 'firebase/firestore';
import { trackEvent } from './analytics';

export async function getWishlist(userId: string): Promise<string[]> {
  const ref = doc(db, 'wishlists', userId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return [];
  return snap.data().productIds || [];
}

export function subscribeToWishlist(
  userId: string,
  callback: (productIds: string[]) => void
): () => void {
  const ref = doc(db, 'wishlists', userId);
  return onSnapshot(ref, (snap) => {
    callback(snap.exists() ? (snap.data().productIds || []) : []);
  });
}

export async function addToWishlist(userId: string, productId: string): Promise<void> {
  const ref = doc(db, 'wishlists', userId);
  try {
    await updateDoc(ref, { productIds: arrayUnion(productId) });
  } catch {
    await setDoc(ref, { productIds: [productId] }, { merge: true });
  }
  trackEvent({ type: 'wishlist_add', productId });
}

export async function removeFromWishlist(userId: string, productId: string): Promise<void> {
  const ref = doc(db, 'wishlists', userId);
  await updateDoc(ref, { productIds: arrayRemove(productId) }).catch(() => {});
  trackEvent({ type: 'wishlist_remove', productId });
}

export async function toggleWishlist(
  userId: string,
  productId: string,
  currentIds: string[]
): Promise<void> {
  if (currentIds.includes(productId)) {
    await removeFromWishlist(userId, productId);
  } else {
    await addToWishlist(userId, productId);
  }
}
