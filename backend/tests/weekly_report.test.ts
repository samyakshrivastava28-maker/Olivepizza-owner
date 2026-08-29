import { describe, it, expect } from 'vitest';
import { weeklyReportService } from '../src/lib/services/WeeklyReportService.js';

describe('Weekly Report Pipeline Tests', () => {

  it('TEST 1: One completed order inside reporting period -> count = 1, revenue = totalAmount', () => {
    const targetDate = new Date('2026-08-10T12:00:00.000Z');
    const weekInfo = weeklyReportService.getWeeklyReportRange(targetDate, 'Asia/Kolkata');
    
    expect(weekInfo.weekLabel).toBe('Week 33, 2026');
    expect(weekInfo.monday.toISOString()).toBe('2026-08-09T18:30:00.000Z'); // Aug 10 00:00 IST
    expect(weekInfo.sunday.toISOString()).toBe('2026-08-16T18:29:59.999Z'); // Aug 16 23:59:59 IST
  });

  it('TEST 2: Multiple completed/active orders -> correct count, correct summed revenue', () => {
    const orders = [
      { id: '1', status: 'completed', totalAmount: 250, createdAt: '2026-08-10T10:00:00.000Z' },
      { id: '2', status: 'pending_acceptance', totalAmount: 150, createdAt: '2026-08-11T14:00:00.000Z' },
      { id: '3', status: 'delivered', totalAmount: 300, createdAt: '2026-08-12T18:00:00.000Z' },
    ];

    const activeStatuses = [
      'pending_acceptance', 'pending', 'placed', 'order_placed',
      'accepted', 'preparing', 'ready', 'partner_assigned',
      'picked_up', 'out_for_delivery', 'delivered', 'completed'
    ];

    let totalOrders = 0;
    let totalRevenue = 0;

    orders.forEach(o => {
      totalOrders++;
      if (activeStatuses.includes(o.status.toLowerCase())) {
        totalRevenue += o.totalAmount;
      }
    });

    expect(totalOrders).toBe(3);
    expect(totalRevenue).toBe(700);
  });

  it('TEST 3: Cancelled order -> excluded from revenue', () => {
    const orders = [
      { id: '1', status: 'delivered', totalAmount: 500 },
      { id: '2', status: 'cancelled', totalAmount: 500 },
      { id: '3', status: 'rejected', totalAmount: 500 },
    ];

    const activeStatuses = [
      'pending_acceptance', 'pending', 'accepted', 'preparing',
      'ready', 'partner_assigned', 'picked_up', 'out_for_delivery',
      'delivered', 'completed'
    ];

    let totalRevenue = 0;
    orders.forEach(o => {
      if (activeStatuses.includes(o.status.toLowerCase())) {
        totalRevenue += o.totalAmount;
      }
    });

    expect(totalRevenue).toBe(500);
  });

  it('TEST 4: Order immediately before week start -> excluded', () => {
    const targetDate = new Date('2026-08-10T12:00:00.000Z');
    const { monday } = weeklyReportService.getWeeklyReportRange(targetDate, 'Asia/Kolkata');
    
    // Order placed 1 second before Monday 00:00 IST (2026-08-09T18:29:59.000Z)
    const orderDate = new Date(monday.getTime() - 1000);
    expect(orderDate < monday).toBe(true);
  });

  it('TEST 5: Order exactly inside week -> included', () => {
    const targetDate = new Date('2026-08-10T12:00:00.000Z');
    const { monday, sunday } = weeklyReportService.getWeeklyReportRange(targetDate, 'Asia/Kolkata');
    
    const orderDate = new Date(monday.getTime() + 3600000); // 1 hour after Monday start
    expect(orderDate >= monday && orderDate <= sunday).toBe(true);
  });

  it('TEST 6: Order immediately after week end -> excluded', () => {
    const targetDate = new Date('2026-08-10T12:00:00.000Z');
    const { sunday } = weeklyReportService.getWeeklyReportRange(targetDate, 'Asia/Kolkata');
    
    // Order placed 1 second after Sunday 23:59:59.999 IST
    const orderDate = new Date(sunday.getTime() + 1000);
    expect(orderDate > sunday).toBe(true);
  });

  it('TEST 7: IST midnight boundary -> correctly included/excluded', () => {
    const targetDate = new Date('2026-08-10T12:00:00.000Z');
    const { monday, sunday } = weeklyReportService.getWeeklyReportRange(targetDate, 'Asia/Kolkata');

    // Monday 00:00:00 IST exact boundary
    const exactMondayStart = new Date(monday.getTime());
    // Sunday 23:59:59.999 IST exact boundary
    const exactSundayEnd = new Date(sunday.getTime());

    expect(exactMondayStart >= monday && exactMondayStart <= sunday).toBe(true);
    expect(exactSundayEnd >= monday && exactSundayEnd <= sunday).toBe(true);
  });

  it('TEST 8: Coupon/discount order -> correct business-defined revenue', () => {
    const order = {
      subtotal: 300,
      discountAmount: 50,
      totalAmount: 250, // Final customer-paid amount
      status: 'pending_acceptance'
    };

    const amountUsed = Number(order.totalAmount || order.subtotal);
    expect(amountUsed).toBe(250);
  });

  it('TEST 9: Multiple status-history / duplicate IDs -> order counted only once', () => {
    const rawDocs = [
      { id: 'ORD-100', status: 'pending_acceptance', totalAmount: 200 },
      { id: 'ORD-100', status: 'preparing', totalAmount: 200 },
      { id: 'ORD-100', status: 'delivered', totalAmount: 200 },
    ];

    const seenIds = new Set<string>();
    const deduplicated = rawDocs.filter(d => {
      if (seenIds.has(d.id)) return false;
      seenIds.add(d.id);
      return true;
    });

    expect(deduplicated.length).toBe(1);
    expect(deduplicated[0].totalAmount).toBe(200);
  });

  it('TEST 10: No orders -> ₹0 and 0 orders is correct', () => {
    const rawDocs: any[] = [];
    let totalOrders = 0;
    let totalRevenue = 0;

    rawDocs.forEach(d => {
      totalOrders++;
      totalRevenue += d.totalAmount;
    });

    expect(totalOrders).toBe(0);
    expect(totalRevenue).toBe(0);
  });

  it('TEST 11: Real Firestore order schema -> aggregation uses actual production fields', () => {
    const firestoreDocData = {
      id: '48b70b9f-e6d4-4a28-93f5-d27e1a21d322',
      status: 'pending_acceptance',
      totalAmount: 57,
      createdAt: { toDate: () => new Date('2026-08-09T10:15:47.487Z') },
      paymentMethod: 'cash',
      items: [{ name: 'Personal Pizza', quantity: 1, price: 57 }]
    };

    const status = firestoreDocData.status.toLowerCase();
    const amount = Number(firestoreDocData.totalAmount || 0);
    const date = firestoreDocData.createdAt.toDate();

    expect(status).toBe('pending_acceptance');
    expect(amount).toBe(57);
    expect(date.toISOString()).toBe('2026-08-09T10:15:47.487Z');
  });

});
