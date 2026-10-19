import { describe, it, expect, beforeAll } from 'vitest';
import { AuthoritativePricingResolver } from '../src/services/menu/AuthoritativePricingResolver.js';
import { POSService } from '../src/services/pos/POSService.js';
import { query } from '../src/lib/db.js';

describe('Authoritative Multi-Franchise Pricing & RBAC Integration Tests', () => {
  const branchA = 'branch_rajnandgaon_hq';
  const branchB = 'branch_bhilai_express';
  const franchiseA = 'fra_rajnandgaon';
  const franchiseB = 'fra_bhilai';
  const testProductId = 'prod_margherita_auth_test';

  beforeAll(async () => {
    // 1. Seed PostgreSQL franchise_prices with different selling prices for Branch A vs Branch B
    try {
      await query(`
        INSERT INTO franchise_prices (id, franchise_id, branch_id, product_id, selling_price, is_available, version, updated_by)
        VALUES 
          ($1, $2, $3, $4, 199.00, true, 1, 'test_setup'),
          ($5, $6, $7, $8, 229.00, true, 1, 'test_setup')
        ON CONFLICT (franchise_id, branch_id, product_id)
        DO UPDATE SET selling_price = EXCLUDED.selling_price, is_available = EXCLUDED.is_available;
      `, [
        `${branchA}_${testProductId}`, franchiseA, branchA, testProductId,
        `${branchB}_${testProductId}`, franchiseB, branchB, testProductId
      ]);
    } catch (e: any) {
      console.warn('[TestSetup] Postgres seeding warning:', e.message);
    }

    // Seed master catalog item
    POSService.seedCatalogItem(testProductId, {
      id: testProductId,
      name: 'Margherita Pizza Classic',
      basePrice: 189,
      sizes: {
        'medium': { price: 299 },
        'large': { price: 399 }
      },
      addons: [
        { id: 'add_extra_cheese', name: 'Extra Mozzarella', price: 50 }
      ]
    });
  });

  it('resolves Branch A price as ₹199.00 and Branch B price as ₹229.00 for the same product', async () => {
    // Branch A resolution
    const priceA = await AuthoritativePricingResolver.resolveItemPrice({
      branchId: branchA,
      franchiseId: franchiseA,
      productId: testProductId
    });
    expect(priceA.unitPrice).toBe(199.00);
    expect(priceA.source).toBe('FRANCHISE_PRICE_OVERRIDE');

    // Branch B resolution
    const priceB = await AuthoritativePricingResolver.resolveItemPrice({
      branchId: branchB,
      franchiseId: franchiseB,
      productId: testProductId
    });
    expect(priceB.unitPrice).toBe(229.00);
    expect(priceB.source).toBe('FRANCHISE_PRICE_OVERRIDE');
  });

  it('rejects pricing resolution when branchId is missing', async () => {
    await expect(
      AuthoritativePricingResolver.resolveItemPrice({
        branchId: '',
        productId: testProductId
      })
    ).rejects.toThrow(/Authoritative branch context is required/);
  });

  it('rejects pricing resolution when product is unpriced or does not exist', async () => {
    await expect(
      AuthoritativePricingResolver.resolveItemPrice({
        branchId: branchA,
        productId: 'prod_non_existent_fake_item'
      })
    ).rejects.toThrow(/was not found in the authoritative master catalog/);
  });

  it('calculates POS bill with branch-specific prices through POSService.calculateBill', async () => {
    // Calculate for Branch A
    const billA = await POSService.calculateBill({
      branchId: branchA,
      orderType: 'DINE_IN',
      items: [
        {
          id: testProductId,
          menuItemId: testProductId,
          name: 'Margherita Pizza Classic',
          price: 999, // Intentional spoofed client price to test server authoritative override
          quantity: 2
        }
      ]
    });

    // Subtotal must be 199 * 2 = 398 (not client 999*2)
    expect(billA.subtotal).toBe(398);
    expect(billA.taxes).toBe(Math.round(398 * 0.05)); // 20
    expect(billA.finalTotal).toBe(398 + Math.round(398 * 0.05)); // 418

    // Calculate for Branch B
    const billB = await POSService.calculateBill({
      branchId: branchB,
      orderType: 'DINE_IN',
      items: [
        {
          id: testProductId,
          menuItemId: testProductId,
          name: 'Margherita Pizza Classic',
          price: 999, // Intentional spoofed client price
          quantity: 2
        }
      ]
    });

    // Subtotal must be 229 * 2 = 458
    expect(billB.subtotal).toBe(458);
    expect(billB.taxes).toBe(Math.round(458 * 0.05)); // 23
    expect(billB.finalTotal).toBe(458 + Math.round(458 * 0.05)); // 481
  });
});
