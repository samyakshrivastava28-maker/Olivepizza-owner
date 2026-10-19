import { adminDb } from '../../config/firebase.js';
import { query } from '../../lib/db.js';
import { POSService } from '../pos/POSService.js';

export interface AuthoritativePriceRequest {
  branchId: string;
  franchiseId?: string;
  productId: string;
  size?: string;
  crust?: string;
  addons?: Array<string | { id?: string; name?: string; price?: number }>;
}

export interface AuthoritativePriceResult {
  branchId: string;
  franchiseId?: string;
  productId: string;
  productName: string;
  unitPrice: number;
  basePrice: number;
  sizePrice: number;
  crustPrice: number;
  addonsPrice: number;
  addons: Array<{ name: string; price: number }>;
  isAvailable: boolean;
  source: 'FRANCHISE_PRICE_OVERRIDE' | 'MASTER_CATALOG';
}

/**
 * AuthoritativePricingResolver
 * Shared server-authoritative price resolver across POS, Online orders, and Billing.
 * 
 * Rules:
 * 1. Checks PostgreSQL franchise_prices table first for branch-specific selling_price and availability.
 * 2. If no branch override exists, checks Firestore master catalog (or cache).
 * 3. Validates sizes, crusts, and addons against authoritative definitions.
 * 4. NEVER trusts client-submitted prices or totals.
 * 5. NEVER invents fake fallback prices (like ₹249). Throws an error if product is unconfigured or unavailable.
 */
export class AuthoritativePricingResolver {
  /**
   * Resolves the authoritative item price for a given branch and item options.
   */
  public static async resolveItemPrice(req: AuthoritativePriceRequest): Promise<AuthoritativePriceResult> {
    const { branchId, productId } = req;
    if (!branchId) {
      throw new Error(`Authoritative branch context is required to resolve pricing for product "${productId}".`);
    }
    if (!productId) {
      throw new Error('Product identifier is required. Client-submitted items without product ID are strictly rejected.');
    }

    // 1. Fetch master catalog item for structure, variants, sizes, addons, and baseline price
    let masterItem: any = null;
    try {
      masterItem = await POSService.getCatalogItem(productId);
    } catch (e: any) {
      console.warn(`[AuthoritativePricingResolver] Master catalog lookup notice for ${productId}:`, e.message);
    }

    if (!masterItem) {
      throw new Error(`Product "${productId}" was not found in the authoritative master catalog. Item cannot be sold.`);
    }

    const productName = masterItem.productName || masterItem.name || 'Menu Item';

    // 2. Query PostgreSQL franchise_prices for branch-specific price override
    let branchOverride: { selling_price: number; is_available: boolean; version: number } | null = null;
    try {
      const pgRes = await query(
        `SELECT selling_price, is_available, version 
         FROM franchise_prices 
         WHERE branch_id = $1 AND product_id = $2 
         LIMIT 1`,
        [branchId, productId]
      );
      if (pgRes.rows.length > 0) {
        branchOverride = {
          selling_price: Number(pgRes.rows[0].selling_price),
          is_available: Boolean(pgRes.rows[0].is_available),
          version: Number(pgRes.rows[0].version) || 1
        };
      }
    } catch (pgErr: any) {
      console.warn(`[AuthoritativePricingResolver] PostgreSQL franchise_prices lookup warning for ${branchId}/${productId}:`, pgErr.message);
    }

    // Fallback to Firestore branch_menu_overrides if PostgreSQL was temporarily unreachable
    if (!branchOverride) {
      try {
        const oDoc = await adminDb.collection('branch_menu_overrides').doc(`${branchId}_${productId}`).get();
        if (oDoc.exists) {
          const oData = oDoc.data()!;
          if (oData.customPrice !== undefined || oData.sellingPrice !== undefined) {
            branchOverride = {
              selling_price: Number(oData.customPrice ?? oData.sellingPrice),
              is_available: oData.isAvailable !== false && oData.isEnabled !== false,
              version: Number(oData.version) || 1
            };
          }
        }
      } catch {}
    }

    // Check availability
    const isAvailable = branchOverride ? branchOverride.is_available : (masterItem.isAvailable !== false && masterItem.isActive !== false);
    if (!isAvailable) {
      throw new Error(`Product "${productName}" (${productId}) is currently marked unavailable at branch "${branchId}".`);
    }

    // Determine base selling price
    let basePrice: number;
    let source: 'FRANCHISE_PRICE_OVERRIDE' | 'MASTER_CATALOG';

    if (branchOverride && !isNaN(branchOverride.selling_price) && branchOverride.selling_price > 0) {
      basePrice = branchOverride.selling_price;
      source = 'FRANCHISE_PRICE_OVERRIDE';
    } else {
      const catBase = Number(masterItem.offerPrice || masterItem.basePrice || masterItem.price || 0);
      if (catBase <= 0) {
        throw new Error(`Authoritative price for "${productName}" (${productId}) is not configured or invalid.`);
      }
      basePrice = catBase;
      source = 'MASTER_CATALOG';
    }

    // 3. Resolve size / variant pricing
    let sizePrice = 0;
    const selectedSize = (req.size || '').toLowerCase().trim();
    if (selectedSize) {
      if (masterItem.sizes && masterItem.sizes[selectedSize]?.price) {
        sizePrice = Number(masterItem.sizes[selectedSize].price);
      } else if (Array.isArray(masterItem.variants)) {
        const v = masterItem.variants.find((vr: any) => (vr.name || vr.size || '').toLowerCase() === selectedSize);
        if (v && v.price) {
          sizePrice = Number(v.price);
        }
      }
    }

    // If size price is explicitly specified in variants and larger than 0, use sizePrice as base or diff
    // In Olive Pizza schema, sizes often define the full price or differential. If sizePrice > basePrice, sizePrice is the unit baseline.
    let itemBasePrice = sizePrice > 0 ? sizePrice : basePrice;

    // If branch has a price override, apply proportional ratio or direct override to size
    if (branchOverride && sizePrice > 0) {
      const masterBase = Number(masterItem.offerPrice || masterItem.basePrice || masterItem.price || 1);
      const ratio = masterBase > 0 ? branchOverride.selling_price / masterBase : 1;
      itemBasePrice = parseFloat((sizePrice * ratio).toFixed(2));
    }

    // 4. Resolve crust pricing
    let crustPrice = 0;
    const selectedCrust = (req.crust || '').toLowerCase().trim();
    if (selectedCrust && Array.isArray(masterItem.crusts)) {
      const c = masterItem.crusts.find((cr: any) => (cr.name || cr.id || '').toLowerCase() === selectedCrust);
      if (c && c.price) {
        crustPrice = Math.max(0, Number(c.price));
      }
    }

    // 5. Resolve addons pricing
    let addonsPrice = 0;
    const formattedAddons: Array<{ name: string; price: number }> = [];

    if (Array.isArray(req.addons) && req.addons.length > 0 && Array.isArray(masterItem.addons)) {
      for (const a of req.addons) {
        if (!a) continue;
        const targetId = typeof a === 'object' ? (a.id || a.name || '') : String(a);
        const targetName = typeof a === 'object' ? (a.name || a.id || '') : String(a);

        const authoritativeAddon = masterItem.addons.find(
          (ma: any) =>
            ma.id === targetId ||
            ma.name === targetName ||
            (ma.id && ma.id.toLowerCase() === targetId.toLowerCase()) ||
            (ma.name && ma.name.toLowerCase() === targetName.toLowerCase())
        );

        if (authoritativeAddon && authoritativeAddon.price != null) {
          const aPrice = Math.max(0, Number(authoritativeAddon.price));
          addonsPrice += aPrice;
          formattedAddons.push({
            name: authoritativeAddon.name || targetName,
            price: aPrice
          });
        }
      }
    }

    const unitPrice = parseFloat((itemBasePrice + crustPrice + addonsPrice).toFixed(2));

    return {
      branchId,
      franchiseId: req.franchiseId,
      productId,
      productName,
      unitPrice,
      basePrice,
      sizePrice,
      crustPrice,
      addonsPrice,
      addons: formattedAddons,
      isAvailable,
      source
    };
  }
}
