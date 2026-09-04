/**
 * CanonicalOrderService.ts — Authoritative PostgreSQL Order, Billing & Search Service
 * 
 * CORE ARCHITECTURAL INVARIANTS:
 * 1. RELATIONAL SOURCE OF TRUTH: Orders, Item Snapshots, and Financial Bills are
 *    atomically committed to PostgreSQL (`canonical_orders`, `canonical_order_items`, `canonical_bills`).
 * 2. PERMANENT BILL NUMBER: Generated via PostgreSQL sequence `permanent_bill_seq`.
 * 3. DAILY ORDER NUMBER: Atomically allocated per calendar day in IST.
 * 4. IMMUTABLE HISTORICAL SNAPSHOTS: Item names, sizes, crusts, and line prices are preserved permanently.
 * 5. DETERMINISTIC SEARCH: 100% indexed parameterized SQL queries. Zero AI, zero fake data.
 */

import crypto from 'crypto';
import { query, withTransaction } from '../../config/postgres.js';
import { BillingNumberService } from './BillingNumberService.js';
import { adminDb } from '../../config/firebase.js';

export interface CreateOrderParams {
  id?: string;
  orderSource: string;
  orderType?: string;
  deliveryType?: string;
  customerName?: string;
  customerPhone?: string;
  deliveryAddress?: string;
  tableNumber?: string;
  items: Array<{
    menuItemId?: string;
    name: string;
    price: number;
    quantity: number;
    size?: string;
    crust?: string;
    addons?: any[];
  }>;
  subtotal: number;
  discountAmount?: number;
  couponCode?: string;
  taxAmount?: number;
  cgst?: number;
  sgst?: number;
  deliveryFee?: number;
  totalAmount: number;
  paymentMethod: string;
  paymentStatus?: string;
  orderStatus?: string;
  franchiseId?: string;
  branchId?: string;
  cashierId?: string;
  cashierName?: string;
  terminalId?: string;
  notes?: string;
}

export interface SearchOrderFilters {
  permanentBillNo?: number;
  dailyOrderNo?: number;
  orderId?: string;
  customerPhone?: string;
  customerName?: string;
  startDate?: string;
  endDate?: string;
  minAmount?: number;
  maxAmount?: number;
  paymentMethod?: string;
  paymentStatus?: string;
  orderStatus?: string;
  orderSource?: string;
  orderType?: string;
  itemName?: string;
  branchId?: string;
  franchiseId?: string;
  limit?: number;
  offset?: number;
}

export class CanonicalOrderService {
  /**
   * Atomically commits a new order, immutable line items, and financial bill to PostgreSQL.
   */
  public static async createCanonicalOrder(params: CreateOrderParams) {
    const orderId = params.id || crypto.randomUUID();

    // 1. Allocate continuous Permanent Bill No. and Daily Order No.
    const nums = await BillingNumberService.allocateNumbers();
    const { permanentBillNo, dailyOrderNo, orderDate, orderTime } = nums;

    const discountAmount = Math.max(0, Number(params.discountAmount) || 0);
    const taxAmount = Math.max(0, Number(params.taxAmount) || Math.round(params.subtotal * 0.05));
    const cgst = params.cgst ?? parseFloat((taxAmount / 2).toFixed(2));
    const sgst = params.sgst ?? parseFloat((taxAmount - cgst).toFixed(2));
    const deliveryFee = Math.max(0, Number(params.deliveryFee) || 0);
    const subtotal = Math.max(0, Number(params.subtotal) || 0);
    const totalAmount = Math.max(0, Number(params.totalAmount) || (subtotal - discountAmount + taxAmount + deliveryFee));

    const paymentMethod = (params.paymentMethod || 'CASH').toUpperCase();
    const paymentStatus = (params.paymentStatus || (paymentMethod === 'COD' ? 'PENDING' : 'PAID')).toUpperCase();
    const resolvedOrderType = params.orderType || params.deliveryType || (params.orderSource === 'POS_DINE_IN' ? 'dine_in' : (params.orderSource === 'POS_TAKEAWAY' ? 'pickup' : 'delivery'));
    const orderStatus = params.orderStatus || (params.orderSource === 'ONLINE' ? 'PLACED' : (resolvedOrderType === 'dine_in' ? 'PREPARING' : 'ACCEPTED'));

    const franchiseId = params.franchiseId || 'fra_primary';
    const branchId = params.branchId || 'main_branch';
    const cashierName = params.cashierName || (params.orderSource === 'ONLINE' ? 'Online Customer App' : 'Cashier');

    // 2. Execute atomic PostgreSQL transaction for Order, Line Items, and Bill
    await withTransaction(async (client) => {
      // 2.1 Insert canonical order
      await client.query(`
        INSERT INTO canonical_orders (
          id, permanent_bill_no, daily_order_no, order_date, order_time,
          order_source, order_type, order_status, payment_method, payment_status,
          customer_name, customer_phone, delivery_address, table_number,
          subtotal, discount_amount, coupon_code, tax_amount, cgst, sgst,
          delivery_fee, total_amount, franchise_id, branch_id, cashier_id,
          cashier_name, terminal_id, notes
        ) VALUES (
          $1, $2, $3, $4::date, $5::time,
          $6, $7, $8, $9, $10,
          $11, $12, $13, $14,
          $15, $16, $17, $18, $19, $20,
          $21, $22, $23, $24, $25,
          $26, $27, $28
        );
      `, [
        orderId, permanentBillNo, dailyOrderNo, orderDate, orderTime,
        params.orderSource, resolvedOrderType, orderStatus, paymentMethod, paymentStatus,
        params.customerName || 'Walk-in Customer', params.customerPhone || 'N/A',
        params.deliveryAddress || null, params.tableNumber || null,
        subtotal, discountAmount, params.couponCode || null, taxAmount, cgst, sgst,
        deliveryFee, totalAmount, franchiseId, branchId, params.cashierId || null,
        cashierName, params.terminalId || 'POS-TERM-01', params.notes || ''
      ]);

      // 2.2 Insert immutable line items
      for (const item of params.items) {
        const itemId = crypto.randomUUID();
        const qty = Math.max(1, Number(item.quantity) || 1);
        const unitPrice = Math.max(0, Number(item.price) || 0);
        const lineTotal = parseFloat((qty * unitPrice).toFixed(2));

        await client.query(`
          INSERT INTO canonical_order_items (
            id, order_id, menu_item_id, item_name, size_variant,
            crust, quantity, unit_price, addons_json, line_total
          ) VALUES (
            $1, $2, $3, $4, $5,
            $6, $7, $8, $9::jsonb, $10
          );
        `, [
          itemId, orderId, item.menuItemId || null, item.name, item.size || 'Regular',
          item.crust || 'Normal', qty, unitPrice, JSON.stringify(item.addons || []), lineTotal
        ]);
      }

      // 2.3 Insert canonical financial bill
      const billId = crypto.randomUUID();
      await client.query(`
        INSERT INTO canonical_bills (
          id, permanent_bill_no, order_id, bill_date, subtotal,
          discount, tax, net_amount, payment_method, payment_status
        ) VALUES (
          $1, $2, $3, $4::date, $5,
          $6, $7, $8, $9, $10
        );
      `, [
        billId, permanentBillNo, orderId, orderDate, subtotal,
        discountAmount, taxAmount, totalAmount, paymentMethod, paymentStatus
      ]);
    });

    // 3. Backward-compatible Firestore synchronization (maintains instant mobile/client notifications)
    try {
      await adminDb.collection('orders').doc(orderId).set({
        id: orderId,
        permanentBillNo,
        billNumber: `#${permanentBillNo}`,
        dailyOrderNumber: dailyOrderNo,
        orderNumber: `#${dailyOrderNo}`,
        orderDateLocal: orderDate,
        orderTimeLocal: orderTime,
        orderSource: params.orderSource,
        orderType: params.orderType,
        customerName: params.customerName || 'Walk-in Customer',
        contactPhone: params.customerPhone || 'N/A',
        items: params.items,
        subtotal,
        discountAmount,
        couponCode: params.couponCode || null,
        taxes: taxAmount,
        cgst,
        sgst,
        deliveryFee,
        totalAmount,
        finalTotal: totalAmount,
        status: orderStatus,
        paymentMethod,
        paymentStatus,
        franchiseId,
        branchId,
        cashierName,
        terminalId: params.terminalId || 'POS-TERM-01',
        tableNumber: params.tableNumber || null,
        deliveryAddress: params.deliveryAddress ? { addressLine: params.deliveryAddress } : null,
        createdAt: new Date(),
        updatedAt: new Date()
      }, { merge: true });
    } catch (e: any) {
      console.warn('[CanonicalOrder] Firestore mirror warning:', e.message);
    }

    return {
      id: orderId,
      orderId,
      permanentBillNo,
      dailyOrderNo,
      orderDate,
      orderTime,
      totalAmount,
      orderStatus,
      paymentStatus
    };
  }

  /**
   * SECTION 11: Deterministic PostgreSQL Bill & Order Search.
   */
  public static async searchCanonicalOrders(filters: SearchOrderFilters) {
    const conditions: string[] = [];
    const values: any[] = [];

    if (filters.permanentBillNo) {
      values.push(filters.permanentBillNo);
      conditions.push(`o.permanent_bill_no = $${values.length}`);
    }

    if (filters.dailyOrderNo) {
      values.push(filters.dailyOrderNo);
      conditions.push(`o.daily_order_no = $${values.length}`);
    }

    if (filters.orderId) {
      values.push(`%${filters.orderId}%`);
      conditions.push(`o.id ILIKE $${values.length}`);
    }

    if (filters.customerPhone) {
      values.push(`%${filters.customerPhone.trim()}%`);
      conditions.push(`o.customer_phone ILIKE $${values.length}`);
    }

    if (filters.customerName) {
      values.push(`%${filters.customerName.trim()}%`);
      conditions.push(`o.customer_name ILIKE $${values.length}`);
    }

    if (filters.startDate) {
      values.push(filters.startDate);
      conditions.push(`o.order_date >= $${values.length}`);
    }

    if (filters.endDate) {
      values.push(filters.endDate);
      conditions.push(`o.order_date <= $${values.length}`);
    }

    if (filters.minAmount !== undefined) {
      values.push(filters.minAmount);
      conditions.push(`o.total_amount >= $${values.length}`);
    }

    if (filters.maxAmount !== undefined) {
      values.push(filters.maxAmount);
      conditions.push(`o.total_amount <= $${values.length}`);
    }

    if (filters.paymentMethod) {
      values.push(filters.paymentMethod.toUpperCase());
      conditions.push(`UPPER(o.payment_method) = $${values.length}`);
    }

    if (filters.paymentStatus) {
      values.push(filters.paymentStatus.toUpperCase());
      conditions.push(`UPPER(o.payment_status) = $${values.length}`);
    }

    if (filters.orderStatus) {
      values.push(filters.orderStatus.toUpperCase());
      conditions.push(`UPPER(o.order_status) = $${values.length}`);
    }

    if (filters.orderSource) {
      values.push(filters.orderSource.toUpperCase());
      conditions.push(`UPPER(o.order_source) = $${values.length}`);
    }

    if (filters.orderType) {
      values.push(filters.orderType.toLowerCase());
      conditions.push(`LOWER(o.order_type) = $${values.length}`);
    }

    if (filters.branchId) {
      values.push(filters.branchId);
      conditions.push(`o.branch_id = $${values.length}`);
    }

    if (filters.franchiseId) {
      values.push(filters.franchiseId);
      conditions.push(`o.franchise_id = $${values.length}`);
    }

    if (filters.itemName) {
      values.push(`%${filters.itemName.trim()}%`);
      conditions.push(`EXISTS (
        SELECT 1 FROM canonical_order_items i
        WHERE i.order_id = o.id AND i.item_name ILIKE $${values.length}
      )`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = Math.min(100, Math.max(1, filters.limit || 50));
    const offset = Math.max(0, filters.offset || 0);

    values.push(limit);
    const limitIdx = values.length;
    values.push(offset);
    const offsetIdx = values.length;

    const sql = `
      SELECT
        o.id,
        o.permanent_bill_no,
        o.daily_order_no,
        TO_CHAR(o.order_date, 'YYYY-MM-DD') AS order_date,
        TO_CHAR(o.order_time, 'HH24:MI:SS') AS order_time,
        o.order_source,
        o.order_type,
        o.order_status,
        o.payment_method,
        o.payment_status,
        o.customer_name,
        o.customer_phone,
        o.delivery_address,
        o.table_number,
        o.subtotal,
        o.discount_amount,
        o.coupon_code,
        o.tax_amount,
        o.delivery_fee,
        o.total_amount,
        o.franchise_id,
        o.branch_id,
        o.cashier_name,
        o.terminal_id,
        o.cancellation_reason,
        o.refund_amount,
        COALESCE(
          json_agg(
            json_build_object(
              'id', i.id,
              'menuItemId', i.menu_item_id,
              'name', i.item_name,
              'size', i.size_variant,
              'crust', i.crust,
              'quantity', i.quantity,
              'unitPrice', i.unit_price,
              'lineTotal', i.line_total,
              'addons', i.addons_json
            )
          ) FILTER (WHERE i.id IS NOT NULL),
          '[]'::json
        ) AS items
      FROM canonical_orders o
      LEFT JOIN canonical_order_items i ON o.id = i.order_id
      ${whereClause}
      GROUP BY o.id
      ORDER BY o.permanent_bill_no DESC
      LIMIT $${limitIdx} OFFSET $${offsetIdx};
    `;

    const res = await query(sql, values);

    return res.rows.map(r => ({
      id: r.id,
      permanentBillNo: parseInt(r.permanent_bill_no, 10),
      dailyOrderNo: parseInt(r.daily_order_no, 10),
      orderDate: r.order_date,
      orderTime: r.order_time,
      orderSource: r.order_source,
      orderType: r.order_type,
      orderStatus: r.order_status,
      paymentMethod: r.payment_method,
      paymentStatus: r.payment_status,
      customerName: r.customer_name,
      customerPhone: r.customer_phone,
      deliveryAddress: r.delivery_address,
      tableNumber: r.table_number,
      subtotal: parseFloat(r.subtotal),
      discountAmount: parseFloat(r.discount_amount),
      couponCode: r.coupon_code,
      taxAmount: parseFloat(r.tax_amount),
      deliveryFee: parseFloat(r.delivery_fee),
      totalAmount: parseFloat(r.total_amount),
      franchiseId: r.franchise_id,
      branchId: r.branch_id,
      cashierName: r.cashier_name,
      terminalId: r.terminal_id,
      cancellationReason: r.cancellation_reason,
      refundAmount: parseFloat(r.refund_amount || '0'),
      items: r.items
    }));
  }

  /**
   * SECTION 18: Auditable Cancellation & Refund.
   */
  public static async cancelOrRefundOrder(params: {
    orderId: string;
    reason: string;
    refundAmount?: number;
    cancelledBy: string;
  }) {
    const { orderId, reason, refundAmount = 0, cancelledBy } = params;
    const now = new Date();

    return await withTransaction(async (client) => {
      // 1. Fetch current order
      const fetchRes = await client.query(`
        SELECT id, permanent_bill_no, total_amount, order_status FROM canonical_orders WHERE id = $1 FOR UPDATE;
      `, [orderId]);

      if (fetchRes.rows.length === 0) {
        throw new Error('Order not found in canonical records');
      }

      const order = fetchRes.rows[0];
      const actualRefund = refundAmount > 0 ? refundAmount : parseFloat(order.total_amount);

      // 2. Update canonical order
      await client.query(`
        UPDATE canonical_orders
        SET order_status = 'CANCELLED',
            payment_status = 'REFUNDED',
            cancellation_reason = $2,
            cancelled_at = $3,
            refund_amount = $4,
            updated_at = $3
        WHERE id = $1;
      `, [orderId, reason, now, actualRefund]);

      // 3. Update canonical bill
      await client.query(`
        UPDATE canonical_bills
        SET is_cancelled = TRUE,
            cancelled_at = $2,
            cancellation_reason = $3,
            payment_status = 'REFUNDED'
        WHERE order_id = $1;
      `, [orderId, now, reason]);

      // 4. Update Firestore mirror
      await adminDb.collection('orders').doc(orderId).update({
        status: 'cancelled',
        paymentStatus: 'REFUNDED',
        cancellationReason: reason,
        cancelledAt: now.toISOString(),
        refundAmount: actualRefund,
        updatedAt: now
      }).catch(() => {});

      return {
        success: true,
        orderId,
        permanentBillNo: parseInt(order.permanent_bill_no, 10),
        refundAmount: actualRefund
      };
    });
  }

  /**
   * SECTION 5 & 21: Live Online Orders stream for POS.
   */
  public static async getLiveOnlineOrders(branchId: string = 'main_branch') {
    const today = BillingNumberService.getLocalDateString();
    const sql = `
      SELECT
        o.id,
        o.permanent_bill_no,
        o.daily_order_no,
        TO_CHAR(o.order_date, 'YYYY-MM-DD') AS order_date,
        TO_CHAR(o.order_time, 'HH24:MI:SS') AS order_time,
        o.order_source,
        o.order_type,
        o.order_status,
        o.payment_method,
        o.payment_status,
        o.customer_name,
        o.customer_phone,
        o.delivery_address,
        o.subtotal,
        o.discount_amount,
        o.total_amount,
        COALESCE(
          json_agg(
            json_build_object(
              'name', i.item_name,
              'size', i.size_variant,
              'quantity', i.quantity,
              'unitPrice', i.unit_price,
              'lineTotal', i.line_total
            )
          ) FILTER (WHERE i.id IS NOT NULL),
          '[]'::json
        ) AS items
      FROM canonical_orders o
      LEFT JOIN canonical_order_items i ON o.id = i.order_id
      WHERE (o.branch_id = $1 OR o.franchise_id = $1 OR $1 = 'main_branch' OR $1 = '' OR $1 IS NULL)
        AND o.order_source IN ('ONLINE', 'CUSTOMER_APP', 'ONLINE_APP')
        AND o.order_date >= ($2::date - INTERVAL '1 day')
        AND o.order_status IN ('PLACED', 'pending_acceptance', 'ACCEPTED', 'PREPARING', 'READY', 'READY_FOR_PICKUP')
      GROUP BY o.id
      ORDER BY o.permanent_bill_no DESC;
    `;

    const res = await query(sql, [branchId, today]);
    return res.rows.map(r => ({
      id: r.id,
      permanentBillNo: parseInt(r.permanent_bill_no, 10),
      dailyOrderNo: parseInt(r.daily_order_no, 10),
      orderDate: r.order_date,
      orderTime: r.order_time,
      orderSource: r.order_source,
      orderType: r.order_type,
      orderStatus: r.order_status,
      paymentMethod: r.payment_method,
      paymentStatus: r.payment_status,
      customerName: r.customer_name,
      customerPhone: r.customer_phone,
      deliveryAddress: r.delivery_address,
      subtotal: parseFloat(r.subtotal),
      discountAmount: parseFloat(r.discount_amount),
      totalAmount: parseFloat(r.total_amount),
      items: r.items
    }));
  }
}
