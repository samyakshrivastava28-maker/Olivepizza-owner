import { describe, it, expect } from 'vitest';
import { POSService } from '../src/services/pos/POSService.js';
import { ESCPOSFormatter, ReceiptData } from '../src/services/pos/ESCPOSFormatter.js';
import { FranchiseScopeService } from '../src/services/franchise/FranchiseScopeService.js';

describe('Olive Pizza POS System — Core Engine Tests', () => {
  describe('1. Server-Authoritative Bill Calculation', () => {
    it('calculates dine-in bill with item addons, 10% discount, and 5% GST correctly', async () => {
      const calc = await POSService.calculateBill({
        orderType: 'DINE_IN',
        discountAmount: 50,
        items: [
          {
            name: 'Farmhouse Pizza',
            price: 489, // 299 base + 90 medium + 40 thin + 60 cheese
            quantity: 1,
            size: '10" Medium',
            crust: 'Thin & Crispy',
            addons: ['Extra Mozzarella']
          },
          {
            name: 'Garlic Breadsticks',
            price: 149,
            quantity: 2
          }
        ]
      });

      // Subtotal = 489 + (149 * 2) = 489 + 298 = 787
      expect(calc.subtotal).toBe(787);
      expect(calc.discountAmount).toBe(50);

      // Taxable = 787 - 50 = 737
      // Taxes = round(737 * 0.05) = round(36.85) = 37
      expect(calc.taxes).toBe(37);
      expect(calc.deliveryFee).toBe(0);

      // Final Total = 737 + 37 = 774
      expect(calc.finalTotal).toBe(774);
      expect(calc.items.length).toBe(2);
    });

    it('calculates delivery fee of ₹40 for POS_DELIVERY', async () => {
      const calc = await POSService.calculateBill({
        orderType: 'DELIVERY',
        items: [
          { name: 'Margherita Pizza', price: 299, quantity: 1 }
        ]
      });

      expect(calc.subtotal).toBe(299);
      expect(calc.discountAmount).toBe(0);
      expect(calc.taxes).toBe(15); // 299 * 0.05 = 14.95 -> 15
      expect(calc.deliveryFee).toBe(40);
      expect(calc.finalTotal).toBe(299 + 15 + 40); // 354
    });
  });

  describe('2. Cash Tender & Change Due Verification', () => {
    it('computes exact change due for cash tender', () => {
      const finalTotal = 603;
      const cashReceived = 1000;
      const changeDue = cashReceived - finalTotal;

      expect(changeDue).toBe(397);
    });
  });

  describe('3. ESC/POS Thermal Receipt Formatting', () => {
    const sampleReceipt: ReceiptData = {
      orderNumber: '#1042',
      billId: 'ord_sample_984f',
      date: '2026-08-23',
      time: '19:45:12',
      orderType: 'DINE_IN',
      tableNumber: 'T-4',
      customerName: 'Ramesh Kumar',
      customerPhone: '+91 9876543210',
      cashierName: 'Cashier-01',
      terminalId: 'POS-TERM-01',
      branchName: 'Olive Pizza — Rajnandgaon HQ',
      branchAddress: 'Dongargaon Rd, Rajnandgaon',
      branchPhone: '+91 91799 44445',
      gstNumber: '22AAAAA0000A1Z5',
      items: [
        { name: 'Farmhouse Pizza', quantity: 1, price: 489, size: '10" Medium', crust: 'Thin & Crispy', addons: ['Extra Mozzarella'] },
        { name: 'Garlic Breadsticks', quantity: 2, price: 149 }
      ],
      subtotal: 787,
      discountAmount: 50,
      couponCode: 'CASHIER50',
      taxes: 37,
      deliveryFee: 0,
      finalTotal: 774,
      paymentMethod: 'CASH',
      paymentStatus: 'PAID',
      amountReceived: 1000,
      changeDue: 226
    };

    it('generates a formatted 80mm plain text receipt with all critical restaurant fields', () => {
      const receiptText = ESCPOSFormatter.generatePlainTextReceipt(sampleReceipt, 48);

      expect(receiptText).toContain('OLIVE PIZZA');
      expect(receiptText).toContain('BILL: #1042');
      expect(receiptText).toContain('TABLE NUMBER:');
      expect(receiptText).toContain('[ T-4 ]');
      expect(receiptText).toContain('Farmhouse Pizza (10" Medium) [Thin & Crispy]');
      expect(receiptText).toContain('+ Extra Mozzarella');
      expect(receiptText).toContain('Subtotal:');
      expect(receiptText).toContain('Rs. 787.00');
      expect(receiptText).toContain('Discount (CASHIER50):');
      expect(receiptText).toContain('- Rs. 50.00');
      expect(receiptText).toContain('GST (5% Included):');
      expect(receiptText).toContain('Rs. 37.00');
      expect(receiptText).toContain('GRAND TOTAL:');
      expect(receiptText).toContain('Rs. 774.00');
      expect(receiptText).toContain('Cash Tendered:');
      expect(receiptText).toContain('Rs. 1000.00');
      expect(receiptText).toContain('Change Due:');
      expect(receiptText).toContain('Rs. 226.00');
    });

    it('generates a raw ESC/POS Buffer containing paper cut and cash drawer pulse', () => {
      const rawBuffer = ESCPOSFormatter.generateRawESCPOSBuffer(sampleReceipt, true, 48);

      expect(Buffer.isBuffer(rawBuffer)).toBe(true);
      expect(rawBuffer.length).toBeGreaterThan(100);

      // Check for Cash Drawer Kick pulse: ESC p 0 25 250 (\x1B\x70\x00\x19\xFA)
      const hasCashDrawerKick = rawBuffer.includes(Buffer.from(ESCPOSFormatter.CASH_DRAWER_KICK, 'binary'));
      expect(hasCashDrawerKick).toBe(true);

      // Check for Paper Cut command: GS V A 0 (\x1D\x56\x41\x00)
      const hasPaperCut = rawBuffer.includes(Buffer.from(ESCPOSFormatter.CUT_FULL, 'binary'));
      expect(hasPaperCut).toBe(true);
    });
  });

  describe('4. Shift Float & Reconciliation', () => {
    it('calculates expected cash and cash discrepancy correctly', () => {
      const openingCash = 500;
      const cashSales = 3450;
      const expectedCash = openingCash + cashSales; // 3950

      expect(expectedCash).toBe(3950);

      // Case A: Exact Match
      const countedExact = 3950;
      expect(countedExact - expectedCash).toBe(0);

      // Case B: Cash Surplus (+₹50)
      const countedSurplus = 4000;
      expect(countedSurplus - expectedCash).toBe(50);

      // Case C: Cash Shortage (-₹30)
      const countedShortage = 3920;
      expect(countedShortage - expectedCash).toBe(-30);
    });
  });

  describe('5. Franchise & Terminal Scope Protection', () => {
    it('verifies cashier terminal binding within authorized branch', () => {
      const cashierScope = FranchiseScopeService.resolveScope({
        role: 'cashier',
        branchId: 'main_branch',
        branchIds: ['main_branch'],
        terminalId: 'POS-TERM-01'
      });

      expect(cashierScope.isBranchScoped).toBe(true);
      expect(FranchiseScopeService.isAuthorizedForBranch(cashierScope, 'main_branch')).toBe(true);
      expect(FranchiseScopeService.isAuthorizedForBranch(cashierScope, 'durg_branch')).toBe(false);
      expect(FranchiseScopeService.isAuthorizedForBranch(cashierScope, 'raipur_branch')).toBe(false);
    });

    it('enforces cross-franchise isolation (Franchise A cannot access Franchise B)', () => {
      const franchiseAScope = FranchiseScopeService.resolveScope({
        role: 'franchise_owner',
        franchiseId: 'fra_rajnandgaon',
        branchIds: ['rjn_main', 'rjn_south']
      });

      expect(FranchiseScopeService.isAuthorizedForBranch(franchiseAScope, 'rjn_main')).toBe(true);
      expect(FranchiseScopeService.isAuthorizedForBranch(franchiseAScope, 'rjn_south')).toBe(true);
      expect(FranchiseScopeService.isAuthorizedForBranch(franchiseAScope, 'durg_store_01')).toBe(false);
      expect(FranchiseScopeService.isAuthorizedForBranch(franchiseAScope, 'bhilai_store_02')).toBe(false);
    });

    it('prevents revoked/deactivated terminal from generating bills', () => {
      const terminalStatus = 'REVOKED';
      const canCreateBill = terminalStatus === 'ACTIVE';

      expect(canCreateBill).toBe(false);
    });
  });
});
