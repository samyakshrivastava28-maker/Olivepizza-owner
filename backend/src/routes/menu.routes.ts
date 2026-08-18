import { Router, Request, Response } from 'express';
import { adminDb } from '../config/firebase.js';

const router = Router();

// Get all available menu items (aggregating products, combos, and menu_items)
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const itemsMap = new Map<string, any>();

    // 1. Fetch from products collection
    try {
      const pSnap = await adminDb.collection('products').get();
      pSnap.docs.forEach((doc) => {
        const data = doc.data();
        const isActive = data.isActive ?? data.isAvailable ?? true;
        if (!isActive) return;

        const basePrice = Number(data.basePrice ?? data.price ?? 299);
        const offerPrice = data.offerPrice ? Number(data.offerPrice) : undefined;
        let price = basePrice;
        let originalPrice: number | undefined = undefined;
        if (offerPrice && offerPrice > 0 && offerPrice < basePrice) {
          price = offerPrice;
          originalPrice = basePrice;
        }

        let name = String(data.productName || data.name || data.title || '').trim();
        const description = String(data.description || '').trim();
        if (!name || name.toLowerCase() === 'pizza') {
          name = description && description.toLowerCase() !== 'pizza' ? description : 'Artisan Woodfired Pizza';
        }

        itemsMap.set(doc.id, {
          id: doc.id,
          name,
          productName: name,
          description: description || 'Handcrafted 100% Pure Vegetarian delicacy from Olive Pizza stone ovens.',
          basePrice: price,
          price,
          originalPrice,
          category: data.category || 'pizza',
          image: data.imageUrl || data.image || 'https://res.cloudinary.com/dxmlvkff1/image/upload/v1786517437/olive-pizza/ai-product-images/dv4uty06rq4tznlpqz2i.jpg',
          isVegetarian: data.isVegetarian ?? data.isVeg ?? true,
          isSpicy: data.isSpicy ?? false,
          isAvailable: true,
          variants: data.variants || [],
          crusts: data.crusts || [],
          addons: data.addons || [],
          rating: Number(data.rating ?? 4.8),
        });
      });
    } catch (pErr: any) {
      console.warn('[MenuRoute] Products fetch warning:', pErr.message);
    }

    // 2. Fetch from combos collection
    try {
      const cSnap = await adminDb.collection('combos').get();
      cSnap.docs.forEach((doc) => {
        const data = doc.data();
        const isActive = data.isActive ?? data.isAvailable ?? true;
        if (!isActive) return;

        const price = Number(data.price ?? data.offerPrice ?? data.basePrice ?? 499);
        const name = String(data.name || data.title || data.comboName || 'Artisan Combo').trim();

        itemsMap.set(doc.id, {
          id: doc.id,
          name,
          productName: name,
          description: data.description || 'Special curated pizza & beverage combo.',
          basePrice: price,
          price,
          category: 'combos',
          image: data.imageUrl || data.image || 'https://res.cloudinary.com/dxmlvkff1/image/upload/v1786517437/olive-pizza/ai-product-images/dv4uty06rq4tznlpqz2i.jpg',
          isVegetarian: true,
          isSpicy: false,
          isAvailable: true,
          isComboOnly: true,
          variants: [],
          crusts: [],
          addons: [],
          rating: 4.9,
        });
      });
    } catch (cErr: any) {
      console.warn('[MenuRoute] Combos fetch warning:', cErr.message);
    }

    // 3. Fetch from menu_items collection
    try {
      const mSnap = await adminDb.collection('menu_items').where('isAvailable', '==', true).get();
      mSnap.docs.forEach((doc) => {
        if (itemsMap.has(doc.id)) return;
        const data = doc.data();
        itemsMap.set(doc.id, {
          id: doc.id,
          name: data.name,
          productName: data.name,
          description: data.description || '',
          basePrice: Number(data.basePrice || data.price || 299),
          price: Number(data.basePrice || data.price || 299),
          category: data.category || 'pizza',
          image: data.image || data.imageUrl || '',
          isVegetarian: data.isVegetarian || false,
          isSpicy: data.isSpicy || false,
          isAvailable: true,
          variants: data.variants || [],
          crusts: data.crusts || [],
          addons: data.addons || [],
        });
      });
    } catch (mErr: any) {
      console.warn('[MenuRoute] menu_items fetch warning:', mErr.message);
    }

    const items = Array.from(itemsMap.values());
    
    // Sort by category, then name
    items.sort((a, b) => {
      if (a.category !== b.category) {
        return a.category.localeCompare(b.category);
      }
      return a.name.localeCompare(b.name);
    });

    res.json(items);
  } catch (error: any) {
    console.error('[MenuRoute] Menu fetch error:', error.message);
    res.status(500).json({ error: 'Failed to fetch menu' });
  }
});

export default router;
