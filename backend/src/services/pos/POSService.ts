/**
 * POSService.ts — Central Restaurant Billing & POS Engine
 * 
 * Manages:
 * - Server-authoritative bill recalculation & GST rounding
 * - Multi-terminal shared Hold & Recall Bills (`pos_held_bills`)
 * - Shift opening, live cash tallying, and shift closing reconciliation (`pos_shifts`)
 * - Void bill authorization & security audit logging (`restaurant_audit_logs`)
 * - Daily POS operational summaries (Bills, Sales, Cash, UPI, Card, Split, Dine-in/Takeaway/Delivery)
 */

import { adminDb } from '../../config/firebase.js';
import crypto from 'crypto';

export interface POSCartItem {
  id?: string;
  menuItemId?: string;
  name: string;
  price: number;
  quantity: number;
  size?: string;
  crust?: string;
  addons?: string[];
  notes?: string;
  image?: string;
}

export interface POSCalculateRequest {
  items: POSCartItem[];
  orderType: 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY';
  discountAmount?: number;
  couponCode?: string;
  deliveryFee?: number;
}

export interface POSCalculateResponse {
  subtotal: number;
  discountAmount: number;
  taxableAmount: number;
  couponCode: string | null;
  taxes: number;
  cgst: number;
  sgst: number;
  deliveryFee: number;
  finalTotal: number;
  items: POSCartItem[];
}

export interface POSHeldBill {
  id: string;
  billNumber?: string;
  title: string;
  orderType: 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY';
  tableNumber?: string;
  customerName?: string;
  customerPhone?: string;
  deliveryAddress?: string;
  items: POSCartItem[];
  subtotal: number;
  discountAmount: number;
  taxes: number;
  finalTotal: number;
  heldAt: string;
  heldByCashier: string;
  terminalId: string;
  branchId: string;
  franchiseId: string;
}

export interface POSShift {
  id: string;
  terminalId: string;
  branchId: string;
  franchiseId: string;
  cashierUid: string;
  cashierName: string;
  openedAt: string;
  closedAt?: string;
  status: 'OPEN' | 'CLOSED';
  openingCash: number;
  cashSales: number;
  upiSales: number;
  cardSales: number;
  otherSales: number;
  totalRevenue: number;
  totalBills: number;
  expectedCash: number;
  closingCash?: number;
  cashDifference?: number;
  notes?: string;
}

export class POSService {
  /**
   * Recalculates subtotal, discounts, 5% GST, and grand total server-authoritatively.
   */
  public static async calculateBill(req: POSCalculateRequest): Promise<POSCalculateResponse> {
    let subtotal = 0;
    const validatedItems: POSCartItem[] = [];

    for (const item of req.items) {
      const qty = Math.max(1, Number(item.quantity) || 1);
      let unitPrice = Math.max(0, Number(item.price) || 0);

      // Support structured addon objects: { id, name, price }
      if (Array.isArray(item.addons)) {
        item.addons.forEach((a: any) => {
          if (typeof a === 'object' && a?.price) {
            unitPrice += Number(a.price) || 0;
          }
        });
      }

      subtotal += unitPrice * qty;

      validatedItems.push({
        id: item.id || `item_${crypto.randomUUID().slice(0, 8)}`,
        menuItemId: item.menuItemId || item.id,
        name: item.name || 'Menu Item',
        price: unitPrice,
        quantity: qty,
        size: item.size || 'Regular',
        crust: item.crust || 'Classic',
        addons: Array.isArray(item.addons) ? item.addons.map((a: any) => typeof a === 'object' ? a.name || a.id : String(a)) : [],
        notes: item.notes || '',
        image: item.image || ''
      });
    }

    let discountAmount = Math.max(0, Number(req.discountAmount) || 0);
    discountAmount = Math.min(discountAmount, subtotal);

    // 5% GST calculated on discounted taxable base (2.5% CGST + 2.5% SGST)
    const taxableAmount = Math.max(0, subtotal - discountAmount);
    const taxes = Math.round(taxableAmount * 0.05);
    const cgst = Number((taxes / 2).toFixed(2));
    const sgst = Number((taxes / 2).toFixed(2));

    const deliveryFee = req.orderType === 'DELIVERY' ? Math.max(0, Number(req.deliveryFee ?? 40)) : 0;
    const finalTotal = taxableAmount + taxes + deliveryFee;

    return {
      subtotal,
      discountAmount,
      taxableAmount,
      couponCode: req.couponCode || null,
      taxes,
      cgst,
      sgst,
      deliveryFee,
      finalTotal,
      items: validatedItems
    };
  }

  /**
   * Holds a bill in Firestore so any terminal in the branch can recall it.
   */
  public static async holdBill(heldData: Omit<POSHeldBill, 'id' | 'heldAt'>): Promise<POSHeldBill> {
    const heldId = `hold_${crypto.randomUUID().slice(0, 8)}`;
    const heldBill: POSHeldBill = {
      ...heldData,
      id: heldId,
      heldAt: new Date().toISOString()
    };

    await adminDb.collection('pos_held_bills').doc(heldId).set(heldBill);
    return heldBill;
  }

  /**
   * Retrieves all active held bills for a branch.
   */
  public static async getHeldBills(branchId: string): Promise<POSHeldBill[]> {
    try {
      const snap = await adminDb.collection('pos_held_bills')
        .where('branchId', '==', branchId)
        .get();

      return snap.docs.map(d => ({ id: d.id, ...d.data() } as POSHeldBill));
    } catch {
      return [];
    }
  }

  /**
   * Deletes / releases a held bill upon recall or discard.
   */
  public static async deleteHeldBill(heldId: string): Promise<boolean> {
    try {
      await adminDb.collection('pos_held_bills').doc(heldId).delete();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Voids an existing completed or pending bill with audit logging.
   */
  public static async voidBill(params: {
    orderId: string;
    reason: string;
    voidedByUid: string;
    voidedByName: string;
    terminalId: string;
    branchId: string;
  }): Promise<{ success: boolean; message: string }> {
    const { orderId, reason, voidedByUid, voidedByName, terminalId, branchId } = params;

    const orderDoc = await adminDb.collection('orders').doc(orderId).get();
    if (!orderDoc.exists) {
      throw new Error(`Order ${orderId} not found`);
    }

    const prevData = orderDoc.data()!;
    if (prevData.status === 'cancelled' || prevData.status === 'voided') {
      return { success: true, message: 'Bill already voided' };
    }

    // Update canonical order status
    await adminDb.collection('orders').doc(orderId).set({
      status: 'cancelled',
      cancellationReason: `POS_VOID: ${reason}`,
      voidedAt: new Date().toISOString(),
      voidedBy: voidedByName,
      voidedByUid,
      updatedAt: new Date()
    }, { merge: true });

    // Record formal security and business audit log
    await adminDb.collection('restaurant_audit_logs').add({
      branchId,
      terminalId,
      actorUid: voidedByUid,
      actorEmail: voidedByName,
      actionType: 'BILL_VOIDED',
      fieldName: 'order_status',
      oldValue: prevData.status,
      newValue: 'cancelled',
      notes: `Bill #${prevData.dailyOrderNumber || orderId.slice(0, 6)} voided. Reason: ${reason}`,
      orderId,
      totalAmount: prevData.totalAmount || 0,
      timestamp: new Date().toISOString()
    });

    return { success: true, message: `Bill #${prevData.dailyOrderNumber || orderId.slice(0, 6)} voided successfully` };
  }

  /**
   * Retrieves active open shift for a given terminal / cashier.
   */
  public static async getActiveShift(branchId: string, terminalId: string): Promise<POSShift | null> {
    try {
      const snap = await adminDb.collection('pos_shifts')
        .where('branchId', '==', branchId)
        .where('terminalId', '==', terminalId)
        .where('status', '==', 'OPEN')
        .limit(1)
        .get();

      if (snap.empty) return null;
      return { id: snap.docs[0].id, ...snap.docs[0].data() } as POSShift;
    } catch {
      return null;
    }
  }

  /**
   * Opens a new POS cashier shift with initial floating opening cash.
   */
  public static async openShift(params: {
    terminalId: string;
    branchId: string;
    franchiseId: string;
    cashierUid: string;
    cashierName: string;
    openingCash: number;
    notes?: string;
  }): Promise<POSShift> {
    const existing = await this.getActiveShift(params.branchId, params.terminalId);
    if (existing) {
      return existing;
    }

    const shiftId = `shift_${crypto.randomUUID().slice(0, 8)}`;
    const newShift: POSShift = {
      id: shiftId,
      terminalId: params.terminalId,
      branchId: params.branchId,
      franchiseId: params.franchiseId,
      cashierUid: params.cashierUid,
      cashierName: params.cashierName,
      openedAt: new Date().toISOString(),
      status: 'OPEN',
      openingCash: Math.max(0, Number(params.openingCash) || 0),
      cashSales: 0,
      upiSales: 0,
      cardSales: 0,
      otherSales: 0,
      totalRevenue: 0,
      totalBills: 0,
      expectedCash: Math.max(0, Number(params.openingCash) || 0),
      notes: params.notes || ''
    };

    await adminDb.collection('pos_shifts').doc(shiftId).set(newShift);
    return newShift;
  }

  /**
   * Closes an active POS shift and calculates cash discrepancies.
   */
  public static async closeShift(shiftId: string, closingCash: number, notes?: string): Promise<POSShift> {
    const shiftDoc = await adminDb.collection('pos_shifts').doc(shiftId).get();
    if (!shiftDoc.exists) {
      throw new Error('Shift not found');
    }

    const shiftData = shiftDoc.data() as POSShift;
    const closedAt = new Date().toISOString();
    const actualClosingCash = Math.max(0, Number(closingCash) || 0);

    // Compute expected cash = opening cash + live cash sales
    const expectedCash = (shiftData.openingCash || 0) + (shiftData.cashSales || 0);
    const cashDifference = actualClosingCash - expectedCash;

    const updatedShift: Partial<POSShift> = {
      status: 'CLOSED',
      closedAt,
      expectedCash,
      closingCash: actualClosingCash,
      cashDifference,
      notes: notes || shiftData.notes || ''
    };

    await adminDb.collection('pos_shifts').doc(shiftId).set(updatedShift, { merge: true });

    return {
      ...shiftData,
      ...updatedShift
    } as POSShift;
  }

  /**
   * Retrieves today's operational summary for POS terminal.
   */
  public static async getDailySummary(branchId: string, dateStr?: string): Promise<{
    date: string;
    totalBills: number;
    totalSales: number;
    cashSales: number;
    upiSales: number;
    cardSales: number;
    dineInCount: number;
    takeawayCount: number;
    deliveryCount: number;
  }> {
    const targetDate = dateStr || new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());

    try {
      const snap = await adminDb.collection('orders')
        .where('branchId', '==', branchId)
        .where('orderDateLocal', '==', targetDate)
        .get();

      let totalBills = 0;
      let totalSales = 0;
      let cashSales = 0;
      let upiSales = 0;
      let cardSales = 0;
      let dineInCount = 0;
      let takeawayCount = 0;
      let deliveryCount = 0;

      for (const doc of snap.docs) {
        const d = doc.data();
        if (d.status === 'cancelled' || d.status === 'voided') continue;

        totalBills++;
        const amount = Number(d.totalAmount || 0);
        totalSales += amount;

        const pMethod = (d.paymentMethod || '').toUpperCase();
        if (pMethod === 'CASH' || pMethod === 'COD') cashSales += amount;
        else if (pMethod === 'UPI' || pMethod === 'ONLINE') upiSales += amount;
        else if (pMethod === 'CARD' || pMethod === 'EDC') cardSales += amount;
        else cashSales += amount;

        const source = (d.orderSource || d.orderType || '').toUpperCase();
        if (source.includes('DINE_IN') || source === 'DINEIN') dineInCount++;
        else if (source.includes('DELIVERY')) deliveryCount++;
        else takeawayCount++;
      }

      return {
        date: targetDate,
        totalBills,
        totalSales,
        cashSales,
        upiSales,
        cardSales,
        dineInCount,
        takeawayCount,
        deliveryCount
      };
    } catch {
      return {
        date: targetDate,
        totalBills: 0,
        totalSales: 0,
        cashSales: 0,
        upiSales: 0,
        cardSales: 0,
        dineInCount: 0,
        takeawayCount: 0,
        deliveryCount: 0
      };
    }
  }

  public static async recordCashAdjustment(params: {
    shiftId: string;
    branchId: string;
    terminalId: string;
    type: 'CASH_IN' | 'CASH_OUT';
    amount: number;
    reason: string;
    cashierUid: string;
    cashierName: string;
  }): Promise<{ success: boolean; shift?: POSShift }> {
    const shiftRef = adminDb.collection('pos_shifts').doc(params.shiftId);
    const snap = await shiftRef.get();
    if (!snap.exists) {
      throw new Error('Shift not found');
    }

    const shift = snap.data() as POSShift;
    const now = new Date().toISOString();
    const adjAmount = Math.abs(Number(params.amount) || 0);

    const adjustmentRecord = {
      type: params.type,
      amount: adjAmount,
      reason: params.reason,
      cashierUid: params.cashierUid,
      cashierName: params.cashierName,
      timestamp: now
    };

    let currentOpening = Number(shift.openingCash || 0);
    let currentCashSales = Number(shift.cashSales || 0);
    let currentAdjustments = (shift as any).cashAdjustments || [];
    currentAdjustments.push(adjustmentRecord);

    let netAdjustments = currentAdjustments.reduce((acc: number, item: any) => {
      return acc + (item.type === 'CASH_IN' ? Number(item.amount) : -Number(item.amount));
    }, 0);

    const newExpectedCash = currentOpening + currentCashSales + netAdjustments;

    await shiftRef.update({
      expectedCash: newExpectedCash,
      cashAdjustments: currentAdjustments,
      updatedAt: now
    });

    return {
      success: true,
      shift: {
        ...shift,
        expectedCash: newExpectedCash,
        cashAdjustments: currentAdjustments
      } as any
    };
  }

  public static async getAnalyticsSummary(params: {
    branchId: string;
    franchiseId?: string;
    period?: 'today' | 'yesterday' | 'this_week' | 'this_month' | 'custom';
    startDate?: string;
    endDate?: string;
  }): Promise<{
    period: string;
    dateRange: { start: string; end: string };
    grossSales: number;
    discounts: number;
    gstTotal: number;
    cgst: number;
    sgst: number;
    netSales: number;
    totalOrders: number;
    averageOrderValue: number;
    paymentBreakdown: {
      cash: { amount: number; count: number; percentage: number };
      upi: { amount: number; count: number; percentage: number };
      card: { amount: number; count: number; percentage: number };
      online: { amount: number; count: number; percentage: number };
    };
    channelBreakdown: {
      dineIn: { amount: number; count: number; percentage: number };
      takeaway: { amount: number; count: number; percentage: number };
      posDelivery: { amount: number; count: number; percentage: number };
      onlineApp: { amount: number; count: number; percentage: number };
    };
  }> {
    const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
    let start = todayStr;
    let end = todayStr;

    if (params.period === 'yesterday') {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      start = end = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(y);
    } else if (params.period === 'this_week') {
      const now = new Date();
      const firstDay = new Date(now.setDate(now.getDate() - now.getDay()));
      start = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(firstDay);
      end = todayStr;
    } else if (params.period === 'this_month') {
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      start = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(firstDay);
      end = todayStr;
    } else if (params.period === 'custom' && params.startDate && params.endDate) {
      start = params.startDate;
      end = params.endDate;
    }

    let query: any = adminDb.collection('orders')
      .where('branchId', '==', params.branchId);

    if (start === end) {
      query = query.where('orderDateLocal', '==', start);
    }

    const snap = await query.get();

    let grossSales = 0;
    let discounts = 0;
    let gstTotal = 0;
    let netSales = 0;
    let totalOrders = 0;

    const pay = {
      cash: { amount: 0, count: 0, percentage: 0 },
      upi: { amount: 0, count: 0, percentage: 0 },
      card: { amount: 0, count: 0, percentage: 0 },
      online: { amount: 0, count: 0, percentage: 0 }
    };

    const chan = {
      dineIn: { amount: 0, count: 0, percentage: 0 },
      takeaway: { amount: 0, count: 0, percentage: 0 },
      posDelivery: { amount: 0, count: 0, percentage: 0 },
      onlineApp: { amount: 0, count: 0, percentage: 0 }
    };

    for (const doc of snap.docs) {
      const d = doc.data();
      if (d.status === 'cancelled' || d.status === 'voided') continue;

      const orderDate = d.orderDateLocal || (d.createdAt?.toDate ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d.createdAt.toDate()) : todayStr);
      if (orderDate < start || orderDate > end) continue;

      totalOrders++;
      const totalAmt = Number(d.totalAmount || 0);
      const subtotal = Number(d.subtotal || totalAmt);
      const disc = Number(d.discountAmount || 0);
      const taxes = Number(d.taxes || totalAmt * 0.05 / 1.05);

      grossSales += (subtotal + disc);
      discounts += disc;
      gstTotal += taxes;
      netSales += totalAmt;

      const method = (d.paymentMethod || 'CASH').toUpperCase();
      if (method === 'CASH' || method === 'COD') {
        pay.cash.amount += totalAmt;
        pay.cash.count += 1;
      } else if (method === 'UPI' || method === 'QR') {
        pay.upi.amount += totalAmt;
        pay.upi.count += 1;
      } else if (method === 'CARD' || method === 'EDC' || method === 'POS_CARD') {
        pay.card.amount += totalAmt;
        pay.card.count += 1;
      } else {
        pay.online.amount += totalAmt;
        pay.online.count += 1;
      }

      const src = (d.orderSource || d.orderType || 'POS_DINE_IN').toUpperCase();
      if (src.includes('DINE_IN') || src.includes('DINEIN')) {
        chan.dineIn.amount += totalAmt;
        chan.dineIn.count += 1;
      } else if (src.includes('TAKEAWAY') || src.includes('PICKUP')) {
        chan.takeaway.amount += totalAmt;
        chan.takeaway.count += 1;
      } else if (src.includes('POS_DELIVERY') || (src.includes('DELIVERY') && d.terminalId)) {
        chan.posDelivery.amount += totalAmt;
        chan.posDelivery.count += 1;
      } else {
        chan.onlineApp.amount += totalAmt;
        chan.onlineApp.count += 1;
      }
    }

    if (netSales > 0) {
      pay.cash.percentage = Number(((pay.cash.amount / netSales) * 100).toFixed(1));
      pay.upi.percentage = Number(((pay.upi.amount / netSales) * 100).toFixed(1));
      pay.card.percentage = Number(((pay.card.amount / netSales) * 100).toFixed(1));
      pay.online.percentage = Number(((pay.online.amount / netSales) * 100).toFixed(1));

      chan.dineIn.percentage = Number(((chan.dineIn.amount / netSales) * 100).toFixed(1));
      chan.takeaway.percentage = Number(((chan.takeaway.amount / netSales) * 100).toFixed(1));
      chan.posDelivery.percentage = Number(((chan.posDelivery.amount / netSales) * 100).toFixed(1));
      chan.onlineApp.percentage = Number(((chan.onlineApp.amount / netSales) * 100).toFixed(1));
    }

    const aov = totalOrders > 0 ? Number((netSales / totalOrders).toFixed(2)) : 0;
    const cgst = Number((gstTotal / 2).toFixed(2));
    const sgst = Number((gstTotal / 2).toFixed(2));

    return {
      period: params.period || 'today',
      dateRange: { start, end },
      grossSales: Number(grossSales.toFixed(2)),
      discounts: Number(discounts.toFixed(2)),
      gstTotal: Number(gstTotal.toFixed(2)),
      cgst,
      sgst,
      netSales: Number(netSales.toFixed(2)),
      totalOrders,
      averageOrderValue: aov,
      paymentBreakdown: pay,
      channelBreakdown: chan
    };
  }

  public static async getHourlySalesTrend(branchId: string, dateStr?: string): Promise<{
    date: string;
    hours: Array<{ hour: string; label: string; sales: number; orders: number }>;
    peakHour: { hour: string; sales: number };
  }> {
    const today = dateStr || new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
    const snap = await adminDb.collection('orders')
      .where('branchId', '==', branchId)
      .where('orderDateLocal', '==', today)
      .get();

    const hourlyMap: Record<number, { sales: number; orders: number }> = {};
    for (let h = 0; h < 24; h++) {
      hourlyMap[h] = { sales: 0, orders: 0 };
    }

    for (const doc of snap.docs) {
      const d = doc.data();
      if (d.status === 'cancelled' || d.status === 'voided') continue;

      let hour = 12;
      if (d.createdAt?.toDate) {
        hour = d.createdAt.toDate().getHours();
      } else if (d.orderTimeLocal) {
        hour = parseInt(d.orderTimeLocal.split(':')[0], 10) || 12;
      }

      const total = Number(d.totalAmount || 0);
      if (hourlyMap[hour]) {
        hourlyMap[hour].sales += total;
        hourlyMap[hour].orders += 1;
      }
    }

    let maxSales = 0;
    let peakH = '19:00';

    const hours = Object.keys(hourlyMap).map((hKey) => {
      const h = parseInt(hKey, 10);
      const data = hourlyMap[h];
      const label = h.toString().padStart(2, '0') + ':00';
      if (data.sales > maxSales) {
        maxSales = data.sales;
        peakH = label;
      }
      return {
        hour: label,
        label,
        sales: Number(data.sales.toFixed(2)),
        orders: data.orders
      };
    });

    return {
      date: today,
      hours,
      peakHour: { hour: peakH, sales: maxSales }
    };
  }

  public static async getProductPerformanceLeaderboard(branchId: string, limitCount = 10): Promise<{
    products: Array<{ name: string; category: string; quantitySold: number; revenue: number }>;
    categoryDistribution: Record<string, { quantity: number; revenue: number }>;
  }> {
    const snap = await adminDb.collection('orders')
      .where('branchId', '==', branchId)
      .limit(200)
      .get();

    const itemMap: Record<string, { name: string; category: string; quantity: number; revenue: number }> = {};
    const catMap: Record<string, { quantity: number; revenue: number }> = {};

    for (const doc of snap.docs) {
      const d = doc.data();
      if (d.status === 'cancelled' || d.status === 'voided') continue;

      const items = d.items || [];
      for (const it of items) {
        const name = it.name || it.productName || 'Pizza';
        const cat = it.category || 'Veg Pizzas';
        const qty = Number(it.quantity || 1);
        const rev = Number(it.price || it.unitPrice || 0) * qty;

        if (!itemMap[name]) {
          itemMap[name] = { name, category: cat, quantity: 0, revenue: 0 };
        }
        itemMap[name].quantity += qty;
        itemMap[name].revenue += rev;

        if (!catMap[cat]) {
          catMap[cat] = { quantity: 0, revenue: 0 };
        }
        catMap[cat].quantity += qty;
        catMap[cat].revenue += rev;
      }
    }

    const sortedProducts = Object.values(itemMap)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, limitCount)
      .map(p => ({
        name: p.name,
        category: p.category,
        quantitySold: p.quantity,
        revenue: Number(p.revenue.toFixed(2))
      }));

    return {
      products: sortedProducts,
      categoryDistribution: catMap
    };
  }

}
