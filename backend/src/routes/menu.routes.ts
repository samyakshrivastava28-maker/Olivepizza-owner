import { Router, Request, Response } from 'express';
import { adminDb } from '../config/firebase.js';
import { verifyToken, AuthRequest, requireRole } from '../middleware/auth.middleware.js';
import { FranchiseScopeService } from '../services/franchise/FranchiseScopeService.js';
import { webSocketServer } from '../services/websocket/WebSocketServer.js';

const router = Router();

// ============================================================================
// 1. MASTER PRODUCTS CATALOG (Owner Managed)
// ============================================================================

router.get('/master-catalog', async (req: Request, res: Response): Promise<void> => {
  try {
    const pSnap = await adminDb.collection('products').get();
    let products = pSnap.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.productName || data.name || 'Master Product',
        description: data.description || '',
        category: data.category || 'Pizzas',
        basePrice: Number(data.basePrice || data.price || 299),
        imageUrl: data.imageUrl || data.image || '',
        isVegetarian: data.isVegetarian ?? true,
        isGlobalActive: data.isActive ?? data.isAvailable ?? true,
        allSizes: data.variants || ['Regular (7")', 'Medium (10")', 'Large (12")'],
        allCrusts: data.crusts || ['Classic Hand Tossed', 'Thin Crust', 'Cheese Burst', 'Wheat Crust'],
        allAddons: data.addons || [
          { id: 'add_extra_cheese', name: 'Extra Cheese', price: 60 },
          { id: 'add_jalapeno', name: 'Pickled Jalapenos', price: 40 },
          { id: 'add_olives', name: 'Black Olives', price: 45 },
          { id: 'add_mushrooms', name: 'Fresh Mushrooms', price: 45 }
        ],
        defaultChannels: data.channelAvailability || {
          online: true,
          dineIn: true,
          takeaway: true,
          posDelivery: true
        },
        createdAt: data.createdAt || new Date().toISOString()
      };
    });

    if (products.length === 0) {
      products = [
        {
          id: 'prod_margherita',
          name: 'Classic Margherita',
          description: 'San Marzano tomatoes, fresh mozzarella, and sweet basil.',
          category: 'Pizzas',
          basePrice: 199,
          imageUrl: 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=400',
          isVegetarian: true,
          isGlobalActive: true,
          allSizes: ['Regular (7")', 'Medium (10")', 'Large (12")'],
          allCrusts: ['Classic Hand Tossed', 'Thin Crust', 'Cheese Burst'],
          allAddons: [{ id: 'add_extra_cheese', name: 'Extra Cheese', price: 60 }],
          defaultChannels: { online: true, dineIn: true, takeaway: true, posDelivery: true },
          createdAt: new Date().toISOString()
        },
        {
          id: 'prod_farmhouse',
          name: 'Farmhouse Special Pizza',
          description: 'Crunchy capsicum, sweet corn, mushrooms, and onions.',
          category: 'Pizzas',
          basePrice: 349,
          imageUrl: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400',
          isVegetarian: true,
          isGlobalActive: true,
          allSizes: ['Regular (7")', 'Medium (10")', 'Large (12")'],
          allCrusts: ['Classic Hand Tossed', 'Thin Crust', 'Cheese Burst'],
          allAddons: [{ id: 'add_extra_cheese', name: 'Extra Cheese', price: 60 }],
          defaultChannels: { online: true, dineIn: true, takeaway: true, posDelivery: true },
          createdAt: new Date().toISOString()
        }
      ];
    }

    res.json({
      success: true,
      count: products.length,
      products
    });
  } catch (error: any) {
    console.error('[MenuRoutes] Error fetching master catalog:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/master-products', verifyToken, requireRole(['owner', 'admin', 'developer', 'platform_owner']), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id, name, description, category, basePrice, imageUrl, variants, crusts, addons, channelAvailability, isActive, isAvailable, createdAt } = req.body;
    if (!name || !category || basePrice === undefined) {
      res.status(400).json({ success: false, error: 'name, category, and basePrice are required' });
      return;
    }
    const docId = id || ('prod_' + Date.now());
    const isNew = !id;
    const nowIso = new Date().toISOString();

    const activeState = isActive !== undefined ? Boolean(isActive) : (isAvailable !== undefined ? Boolean(isAvailable) : true);
    const availState = isAvailable !== undefined ? Boolean(isAvailable) : activeState;

    const productPayload: any = {
      id: docId,
      productName: name,
      name,
      description: description || '',
      category,
      basePrice: Number(basePrice),
      price: Number(basePrice),
      imageUrl: imageUrl || 'https://res.cloudinary.com/dxmlvkff1/image/upload/v1786517437/olive-pizza/ai-product-images/dv4uty06rq4tznlpqz2i.jpg',
      isVegetarian: req.body.isVegetarian ?? true,
      isActive: activeState,
      isAvailable: availState,
      variants: variants || ['Regular (7")', 'Medium (10")', 'Large (12")'],
      crusts: crusts || ['Classic Hand Tossed', 'Thin Crust', 'Cheese Burst'],
      addons: addons || [{ id: 'add_extra_cheese', name: 'Extra Cheese', price: 60 }],
      channelAvailability: channelAvailability || { online: true, dineIn: true, takeaway: true, posDelivery: true },
      createdAt: createdAt || nowIso,
      updatedAt: nowIso
    };

    await adminDb.collection('products').doc(docId).set(productPayload, { merge: true });

    // Structured logging
    console.log(isNew ? '[PRODUCT_CREATED]' : '[PRODUCT_UPDATED]', {
      productId: docId,
      name,
      category,
      price: basePrice,
      isActive: activeState,
      isAvailable: availState,
      timestamp: nowIso
    });

    // Realtime broadcast to all operational apps
    webSocketServer.broadcastToAll({
      type: isNew ? 'product.created' : 'product.updated',
      data: {
        productId: docId,
        action: isNew ? 'create' : 'update',
        product: productPayload,
        timestamp: nowIso
      }
    });

    res.json({ success: true, message: 'Master product saved successfully', product: productPayload });
  } catch (error: any) {
    console.error('[MenuRoutes] Error creating master product:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/menu/master-products/:id, /api/menu/products/:id, /api/menu/:id, /api/products/:id
router.delete(['/master-products/:id', '/products/:id', '/:id'], verifyToken, requireRole(['owner', 'admin', 'developer', 'platform_owner']), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ success: false, error: 'Product ID is required' });
      return;
    }

    // 1. Delete from master products collection
    await adminDb.collection('products').doc(id).delete();

    // 2. Also clean up any branch menu overrides associated with this product
    try {
      const overridesSnap = await adminDb.collection('branch_menu_overrides')
        .where('productId', '==', id)
        .get();
      
      const batch = adminDb.batch();
      overridesSnap.docs.forEach(doc => batch.delete(doc.ref));
      if (!overridesSnap.empty) {
        await batch.commit();
      }
    } catch (overrideErr) {
      console.warn('[MenuRoutes] Warning cleaning up branch overrides on product delete:', overrideErr);
    }

    console.log('[PRODUCT_DISABLED]', { productId: id, timestamp: new Date().toISOString() });

    // Realtime broadcast deletion to all connected apps
    webSocketServer.broadcastToAll({
      type: 'product.deleted',
      data: { productId: id, action: 'delete', timestamp: new Date().toISOString() }
    });

    res.json({
      success: true,
      message: `Product ${id} deleted successfully from master catalog`,
      productId: id
    });
  } catch (error: any) {
    console.error('[MenuRoutes] Error deleting master product:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/menu/products/delete — Alternative deletion route for clients without DELETE method support
router.post(['/master-products/:id/delete', '/products/:id/delete', '/:id/delete', '/products/delete', '/delete'], verifyToken, requireRole(['owner', 'admin', 'developer', 'platform_owner']), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const productId = req.params.id || req.body.id || req.body.productId;
    if (!productId) {
      res.status(400).json({ success: false, error: 'Product ID is required' });
      return;
    }

    await adminDb.collection('products').doc(productId).delete();

    try {
      const overridesSnap = await adminDb.collection('branch_menu_overrides')
        .where('productId', '==', productId)
        .get();
      
      const batch = adminDb.batch();
      overridesSnap.docs.forEach(doc => batch.delete(doc.ref));
      if (!overridesSnap.empty) {
        await batch.commit();
      }
    } catch (overrideErr) {
      console.warn('[MenuRoutes] Warning cleaning up branch overrides:', overrideErr);
    }

    console.log('[PRODUCT_DISABLED]', { productId, timestamp: new Date().toISOString() });

    webSocketServer.broadcastToAll({
      type: 'product.deleted',
      data: { productId, action: 'delete', timestamp: new Date().toISOString() }
    });

    res.json({
      success: true,
      message: `Product ${productId} deleted successfully`,
      productId
    });
  } catch (error: any) {
    console.error('[MenuRoutes] Error deleting product:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// 2. FRANCHISE & BRANCH SCOPED MENU SELECTION
// ============================================================================

router.get('/branch/:branchId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { branchId } = req.params;
    const channel = (req.query.channel as string || 'ONLINE').toUpperCase();
    const pSnap = await adminDb.collection('products').get();
    let masterProducts = pSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
    if (masterProducts.length === 0) {
      masterProducts = [
        { id: 'prod_margherita', name: 'Classic Margherita', category: 'Pizzas', basePrice: 199, variants: ['Regular (7")', 'Medium (10")', 'Large (12")'], crusts: ['Classic Hand Tossed', 'Thin Crust'], addons: [{ id: 'add_extra_cheese', name: 'Extra Cheese', price: 60 }], channelAvailability: { online: true, dineIn: true, takeaway: true, posDelivery: true } },
        { id: 'prod_farmhouse', name: 'Farmhouse Special Pizza', category: 'Pizzas', basePrice: 349, variants: ['Regular (7")', 'Medium (10")', 'Large (12")'], crusts: ['Classic Hand Tossed', 'Thin Crust'], addons: [{ id: 'add_extra_cheese', name: 'Extra Cheese', price: 60 }], channelAvailability: { online: true, dineIn: true, takeaway: true, posDelivery: true } }
      ];
    }
    const oSnap = await adminDb.collection('branch_menu_overrides').where('branchId', '==', branchId).get().catch(() => ({ docs: [] } as any));
    const overridesMap = new Map<string, any>();
    oSnap.docs.forEach((d: any) => overridesMap.set(d.data().productId, d.data()));
    const branchProducts = masterProducts.map(mp => {
      const override = overridesMap.get(mp.id);
      const isEnabled = override ? override.isEnabledForBranch : (mp.isActive ?? true);
      const stockStatus = override?.stockStatus || (mp.isAvailable !== false ? 'IN_STOCK' : 'OUT_OF_STOCK');
      const channels = override?.channelAvailability || mp.channelAvailability || { online: true, dineIn: true, takeaway: true, posDelivery: true };
      const allowedSizes = override?.allowedSizes || mp.variants || ['Regular (7")', 'Medium (10")', 'Large (12")'];
      const allowedCrusts = override?.allowedCrusts || mp.crusts || ['Classic Hand Tossed', 'Thin Crust'];
      const allowedAddons = override?.allowedAddons || mp.addons || [];
      let channelMatch = true;
      if (channel === 'ONLINE' && !channels.online) channelMatch = false;
      if (channel === 'POS' && !channels.dineIn && !channels.takeaway && !channels.posDelivery) channelMatch = false;
      if (channel === 'DINE_IN' && !channels.dineIn) channelMatch = false;
      if (channel === 'TAKEAWAY' && !channels.takeaway) channelMatch = false;
      if (channel === 'POS_DELIVERY' && !channels.posDelivery) channelMatch = false;
      if (!isEnabled || !channelMatch) return null;
      return {
        id: mp.id,
        name: mp.productName || mp.name,
        description: mp.description || '',
        category: mp.category || 'Pizzas',
        basePrice: override?.customPrice || mp.basePrice || mp.price || 299,
        price: override?.customPrice || mp.basePrice || mp.price || 299,
        imageUrl: mp.imageUrl || mp.image || 'https://res.cloudinary.com/dxmlvkff1/image/upload/v1786517437/olive-pizza/ai-product-images/dv4uty06rq4tznlpqz2i.jpg',
        isVegetarian: mp.isVegetarian ?? true,
        stockStatus,
        isAvailable: stockStatus === 'IN_STOCK',
        allowedSizes,
        allowedCrusts,
        allowedAddons,
        channelAvailability: channels,
        isPhysicalOnly: !channels.online
      };
    }).filter(Boolean);
    res.json({ success: true, branchId, channel, count: branchProducts.length, products: branchProducts });
  } catch (error: any) {
    console.error('[MenuRoutes] Error fetching branch menu:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/branch/:branchId/management', async (req: Request, res: Response): Promise<void> => {
  try {
    const { branchId } = req.params;
    const pSnap = await adminDb.collection('products').get();
    let masterProducts = pSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
    if (masterProducts.length === 0) {
      masterProducts = [
        { id: 'prod_margherita', name: 'Classic Margherita', category: 'Pizzas', basePrice: 199, variants: ['Regular (7")', 'Medium (10")', 'Large (12")'], crusts: ['Classic Hand Tossed', 'Thin Crust', 'Cheese Burst'], addons: [{ id: 'add_extra_cheese', name: 'Extra Cheese', price: 60 }], channelAvailability: { online: true, dineIn: true, takeaway: true, posDelivery: true } },
        { id: 'prod_farmhouse', name: 'Farmhouse Special Pizza', category: 'Pizzas', basePrice: 349, variants: ['Regular (7")', 'Medium (10")', 'Large (12")'], crusts: ['Classic Hand Tossed', 'Thin Crust', 'Cheese Burst'], addons: [{ id: 'add_extra_cheese', name: 'Extra Cheese', price: 60 }], channelAvailability: { online: true, dineIn: true, takeaway: true, posDelivery: true } }
      ];
    }
    const oSnap = await adminDb.collection('branch_menu_overrides').where('branchId', '==', branchId).get().catch(() => ({ docs: [] } as any));
    const overridesMap = new Map<string, any>();
    oSnap.docs.forEach((d: any) => overridesMap.set(d.data().productId, d.data()));
    const managementItems = masterProducts.map(mp => {
      const override = overridesMap.get(mp.id);
      return {
        id: mp.id,
        name: mp.productName || mp.name,
        category: mp.category || 'Pizzas',
        basePrice: mp.basePrice || mp.price || 299,
        description: mp.description || '',
        imageUrl: mp.imageUrl || mp.image || '',
        allSizes: mp.variants || ['Regular (7")', 'Medium (10")', 'Large (12")'],
        allCrusts: mp.crusts || ['Classic Hand Tossed', 'Thin Crust', 'Cheese Burst'],
        allAddons: mp.addons || [{ id: 'add_extra_cheese', name: 'Extra Cheese', price: 60 }],
        isEnabledForBranch: override ? Boolean(override.isEnabledForBranch) : true,
        selectedSizes: override?.allowedSizes || mp.variants || ['Regular (7")', 'Medium (10")', 'Large (12")'],
        selectedCrusts: override?.allowedCrusts || mp.crusts || ['Classic Hand Tossed', 'Thin Crust'],
        selectedAddons: override?.allowedAddons || mp.addons || [],
        channelAvailability: override?.channelAvailability || mp.channelAvailability || { online: true, dineIn: true, takeaway: true, posDelivery: true },
        stockStatus: override?.stockStatus || 'IN_STOCK'
      };
    });
    res.json({ success: true, branchId, products: managementItems });
  } catch (error: any) {
    console.error('[MenuRoutes] Error fetching branch management items:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/branch/:branchId/toggle', verifyToken, requireRole(['restaurant_manager', 'franchise_owner', 'franchise_manager', 'owner', 'admin']), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { branchId } = req.params;
    const { productId, isEnabled } = req.body;
    if (!productId || typeof isEnabled !== 'boolean') {
      res.status(400).json({ success: false, error: 'productId and isEnabled (boolean) are required' });
      return;
    }
    const docKey = branchId + '_' + productId;
    const nowIso = new Date().toISOString();
    await adminDb.collection('branch_menu_overrides').doc(docKey).set({
      branchId,
      productId,
      isEnabledForBranch: isEnabled,
      updatedAt: nowIso,
      updatedBy: req.user?.email || 'manager'
    }, { merge: true });

    console.log('[PRODUCT_UPDATED]', { branchId, productId, isEnabled, type: 'branch_toggle', timestamp: nowIso });

    webSocketServer.broadcastToAll({
      type: 'branch_menu.updated',
      data: { branchId, productId, isEnabledForBranch: isEnabled, timestamp: nowIso }
    });

    res.json({ success: true, message: 'Product ' + productId + ' ' + (isEnabled ? 'enabled' : 'disabled') + ' for branch ' + branchId, branchId, productId, isEnabledForBranch: isEnabled });
  } catch (error: any) {
    console.error('[MenuRoutes] Error toggling branch product:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/branch/:branchId/customizations', verifyToken, requireRole(['restaurant_manager', 'franchise_owner', 'franchise_manager', 'owner', 'admin']), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { branchId } = req.params;
    const { productId, allowedSizes, allowedCrusts, allowedAddons, channelAvailability, customPrice } = req.body;
    if (!productId) {
      res.status(400).json({ success: false, error: 'productId is required' });
      return;
    }
    const docKey = branchId + '_' + productId;
    const nowIso = new Date().toISOString();
    const overrideData: any = {
      branchId,
      productId,
      updatedAt: nowIso,
      updatedBy: req.user?.email || 'manager'
    };
    if (allowedSizes) overrideData.allowedSizes = allowedSizes;
    if (allowedCrusts) overrideData.allowedCrusts = allowedCrusts;
    if (allowedAddons) overrideData.allowedAddons = allowedAddons;
    if (channelAvailability) overrideData.channelAvailability = channelAvailability;
    if (customPrice) overrideData.customPrice = Number(customPrice);
    await adminDb.collection('branch_menu_overrides').doc(docKey).set(overrideData, { merge: true });

    webSocketServer.broadcastToAll({
      type: 'branch_menu.updated',
      data: { branchId, productId, override: overrideData, timestamp: nowIso }
    });

    res.json({ success: true, message: 'Customizations updated for product ' + productId + ' in branch ' + branchId, override: overrideData });
  } catch (error: any) {
    console.error('[MenuRoutes] Error saving branch customizations:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/branch/:branchId/stock-status', verifyToken, requireRole(['cashier', 'restaurant_manager', 'franchise_owner', 'franchise_manager', 'owner', 'admin']), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { branchId } = req.params;
    const { productId, stockStatus, inStock } = req.body;
    const normalizedStock = stockStatus || (inStock === false ? 'OUT_OF_STOCK' : 'IN_STOCK');
    if (!productId) {
      res.status(400).json({ success: false, error: 'productId is required' });
      return;
    }
    const docKey = branchId + '_' + productId;
    const nowIso = new Date().toISOString();
    await adminDb.collection('branch_menu_overrides').doc(docKey).set({
      branchId,
      productId,
      stockStatus: normalizedStock,
      inStock: normalizedStock === 'IN_STOCK',
      updatedAt: nowIso,
      updatedBy: req.user?.email || 'manager'
    }, { merge: true });

    console.log('[PRODUCT_UPDATED]', { branchId, productId, stockStatus: normalizedStock, timestamp: nowIso });

    webSocketServer.broadcastToAll({
      type: 'stock.updated',
      data: { branchId, productId, stockStatus: normalizedStock, inStock: normalizedStock === 'IN_STOCK', timestamp: nowIso }
    });

    res.json({ success: true, message: 'Stock status updated for ' + productId, branchId, productId, stockStatus: normalizedStock });
  } catch (error: any) {
    console.error('[MenuRoutes] Error updating branch stock status:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/branch/:branchId/local-product', verifyToken, requireRole(['restaurant_manager', 'franchise_owner', 'owner', 'admin']), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { branchId } = req.params;
    const { name, category, price, description } = req.body;
    if (!name || !price) {
      res.status(400).json({ success: false, error: 'name and price are required' });
      return;
    }
    const localProdId = 'local_' + branchId + '_' + Date.now();
    const productData = {
      id: localProdId,
      name,
      productName: name,
      category: category || 'Local Specials',
      basePrice: Number(price),
      price: Number(price),
      description: description || 'Local branch counter exclusive item.',
      isLocalBranchProduct: true,
      branchId,
      channelAvailability: { online: false, dineIn: true, takeaway: true, posDelivery: false },
      isActive: true,
      isAvailable: true,
      createdAt: new Date().toISOString()
    };
    await adminDb.collection('products').doc(localProdId).set(productData);
    const docKey = branchId + '_' + localProdId;
    await adminDb.collection('branch_menu_overrides').doc(docKey).set({
      branchId,
      productId: localProdId,
      isEnabledForBranch: true,
      channelAvailability: { online: false, dineIn: true, takeaway: true, posDelivery: false },
      stockStatus: 'IN_STOCK'
    });
    res.status(201).json({ success: true, message: 'Local physical-only product created for branch ' + branchId, product: productData });
  } catch (error: any) {
    console.error('[MenuRoutes] Error creating local product:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const pSnap = await adminDb.collection('products').get();
    const items = pSnap.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.productName || data.name || 'Artisan Woodfired Pizza',
        productName: data.productName || data.name || 'Artisan Woodfired Pizza',
        description: data.description || 'Handcrafted 100% Pure Vegetarian delicacy from Olive Pizza stone ovens.',
        basePrice: Number(data.basePrice || data.price || 299),
        price: Number(data.basePrice || data.price || 299),
        category: data.category || 'pizza',
        image: data.imageUrl || data.image || 'https://res.cloudinary.com/dxmlvkff1/image/upload/v1786517437/olive-pizza/ai-product-images/dv4uty06rq4tznlpqz2i.jpg',
        isVegetarian: data.isVegetarian ?? true,
        isAvailable: data.isActive ?? data.isAvailable ?? true,
        variants: data.variants || [],
        crusts: data.crusts || [],
        addons: data.addons || []
      };
    });
    res.json({ success: true, count: items.length, items });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;