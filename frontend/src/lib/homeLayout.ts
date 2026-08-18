/**
 * Home Layout Config Store
 * Caches the published `home_layout/config` document from Firestore.
 * Prevents unnecessary re-reads while maintaining real-time sync.
 */

import { create } from 'zustand';
import { db } from './firebase';
import { doc, onSnapshot, getDoc, setDoc, updateDoc, collection, addDoc } from 'firebase/firestore';

export interface HomeSection {
  id: string;
  type:
    | 'hero'
    | 'ads'
    | 'coupons'
    | 'special_categories'
    | 'top_selling'
    | 'menu'
    | 'order_again'
    | 'wishlist'
    | 'personalization';
  name: string;
  isEnabled: boolean;
  order: number;
  style?: string;
  size?: 'full' | 'half';
}

export interface TopSellingConfig {
  mode: 'automatic' | 'manual';
  manualProductIds: string[];
}

interface HomeLayoutState {
  sections: HomeSection[];
  topSelling: TopSellingConfig;
  isLoading: boolean;
  // Draft management
  draftSections: HomeSection[] | null;
  hasDraft: boolean;
  versionHistory: VersionEntry[];
  // Actions
  subscribePublished: () => () => void;
  saveDraft: (sections: HomeSection[]) => Promise<void>;
  publish: (sections: HomeSection[], editedBy: string) => Promise<void>;
  discardDraft: () => void;
  restoreVersion: (versionId: string, editedBy: string) => Promise<void>;
  updateTopSelling: (config: TopSellingConfig) => Promise<void>;
}

export interface VersionEntry {
  id: string;
  timestamp: string;
  editedBy: string;
  sections: HomeSection[];
}

// Default sections with priority scores
export const DEFAULT_SECTIONS: HomeSection[] = [
  { id: 'hero', type: 'hero', name: 'Hero Banner', isEnabled: true, order: 0 },
  { id: 'ads', type: 'ads', name: 'Advertisements', isEnabled: true, order: 1 },
  { id: 'coupons', type: 'coupons', name: 'Active Coupons', isEnabled: true, order: 2 },
  { id: 'special_categories', type: 'special_categories', name: 'Special Categories', isEnabled: true, order: 3 },
  { id: 'top_selling', type: 'top_selling', name: 'Top Selling', isEnabled: true, order: 4 },
  { id: 'menu', type: 'menu', name: 'Menu Categories', isEnabled: true, order: 5 },
  { id: 'personalization', type: 'personalization', name: 'AI Recommendations', isEnabled: true, order: 6 },
  { id: 'order_again', type: 'order_again', name: 'Order Again', isEnabled: true, order: 7 },
  { id: 'wishlist', type: 'wishlist', name: 'Saved Products', isEnabled: true, order: 8 },
];

const DEFAULT_TOP_SELLING: TopSellingConfig = { mode: 'automatic', manualProductIds: [] };

export const useHomeLayoutStore = create<HomeLayoutState>((set, get) => ({
  sections: DEFAULT_SECTIONS,
  topSelling: DEFAULT_TOP_SELLING,
  isLoading: true,
  draftSections: null,
  hasDraft: false,
  versionHistory: [],

  subscribePublished: () => {
    const configRef = doc(db, 'home_layout', 'published');
    const topRef = doc(db, 'home_layout', 'top_selling');

    let unsubConfig: () => void = () => {};
    let retryTimer: ReturnType<typeof setTimeout>;
    let currentBackoff = 1000;

    const setupListener = () => {
      unsubConfig = onSnapshot(configRef, (snap) => {
        if (snap.exists()) {
          set({
            sections: snap.data().sections || DEFAULT_SECTIONS,
            isLoading: false,
          });
        } else {
          // Initialize defaults on first run
          setDoc(configRef, { sections: DEFAULT_SECTIONS }).catch(() => {});
          set({ sections: DEFAULT_SECTIONS, isLoading: false });
        }
        currentBackoff = 1000; // reset on success
      }, (error) => {
        console.warn('[homeLayout] Firebase listener failed:', error);
        currentBackoff = Math.min(currentBackoff * 2, 30000);
        retryTimer = setTimeout(() => {
          setupListener();
        }, currentBackoff);
      });
    };

    setupListener();

    // Load draft status
    getDoc(doc(db, 'home_layout', 'draft')).then((snap) => {
      if (snap.exists() && snap.data().sections) {
        set({ draftSections: snap.data().sections, hasDraft: true });
      }
    });

    // Load top selling config
    getDoc(topRef).then((snap) => {
      if (snap.exists()) {
        set({ topSelling: snap.data() as TopSellingConfig });
      } else {
        setDoc(topRef, DEFAULT_TOP_SELLING).catch(() => {});
      }
    });

    return () => {
      if (unsubConfig) unsubConfig();
      if (retryTimer) clearTimeout(retryTimer);
    };
  },

  saveDraft: async (sections) => {
    await setDoc(doc(db, 'home_layout', 'draft'), { sections, savedAt: new Date().toISOString() });
    set({ draftSections: sections, hasDraft: true });
  },

  publish: async (sections, editedBy) => {
    const publishedRef = doc(db, 'home_layout', 'published');

    // Save current published as version history
    const currentSnap = await getDoc(publishedRef);
    if (currentSnap.exists()) {
      await addDoc(collection(db, 'home_layout_versions'), {
        timestamp: new Date().toISOString(),
        editedBy,
        sections: currentSnap.data().sections,
      });
    }

    // Publish new
    await setDoc(publishedRef, { sections, updatedAt: new Date().toISOString(), updatedBy: editedBy });

    // Clear draft
    await setDoc(doc(db, 'home_layout', 'draft'), { sections: null }).catch(() => {});
    set({ sections, draftSections: null, hasDraft: false });
  },

  discardDraft: () => {
    setDoc(doc(db, 'home_layout', 'draft'), { sections: null }).catch(() => {});
    set({ draftSections: null, hasDraft: false });
  },

  restoreVersion: async (versionId, editedBy) => {
    const vRef = doc(db, 'home_layout_versions', versionId);
    const snap = await getDoc(vRef);
    if (!snap.exists()) return;
    const { sections } = snap.data();
    await get().publish(sections, editedBy);
  },

  updateTopSelling: async (config) => {
    await setDoc(doc(db, 'home_layout', 'top_selling'), config);
    set({ topSelling: config });
  },
}));
