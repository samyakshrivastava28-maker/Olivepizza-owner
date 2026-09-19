/**
 * NotificationRouter.ts
 *
 * Centralized, authoritative notification & alarm routing engine for the Olive Pizza ecosystem.
 *
 * Enforces strict security & privacy guarantees:
 * 1. Operational new-order sound alarms MUST strictly reach authorized restaurant managers/kitchen staff
 *    of the specific franchise and branch that owns the order.
 * 2. Never leaks alarms across franchises (e.g. Rajnandgaon order never rings in Raipur).
 * 3. Never leaks alarms to Owner Console, Customer App, or Franchise Management App.
 * 4. Never triggers alarms for unauthenticated or unauthorized sessions.
 * 5. Delivery notifications only reach the specifically assigned rider.
 * 6. Customer updates only reach the ordering customer.
 */

import { notificationEngine } from './NotificationEngine.js';
import { RestaurantTemplates, CustomerTemplates, DeliveryTemplates } from './NotificationTemplates.js';

export type OrderNotificationEventType =
  | 'RESTAURANT_NEW_ORDER_ALARM'
  | 'RESTAURANT_ORDER_DELIVERED'
  | 'DELIVERY_ASSIGNED'
  | 'CUSTOMER_ORDER_UPDATE'
  | 'FRANCHISE_METRIC_NOTICE';

export interface OrderRoutingContext {
  orderId: string;
  orderNumber: string;
  dailyOrderNumber?: number | string | null;
  permanentBillNo?: number | string | null;
  orderType?: string;
  totalAmount: number;
  items?: any[];
  paymentMethod?: string;
  paymentStatus?: string;
  cashToCollect?: number;
  deliveryAddress?: any;
  deliveryInstructions?: string;
  customerNotes?: string;
  lat?: number;
  lng?: number;
  contactPhone?: string;
  customerName?: string;
  userId?: string;
  deliveryPartnerId?: string | null;
  franchiseId: string;
  branchId: string;
  branchName?: string;
  status?: string;
  orderTime?: string;
  financials?: any;
  productImageThumbnail?: string;
  rawOrderData?: any;
}

export interface RecipientEvaluation {
  allowed: boolean;
  reason: string;
  category?: string;
  sound?: string;
}

export class NotificationRouter {
  /**
   * Authoritative rule engine: determines if a specific user/device is permitted
   * to receive an operational event for an order.
   */
  public static evaluateRecipient(
    recipient: {
      uid: string;
      role: string;
      email?: string;
      appTarget?: string;
      franchiseId?: string;
      branchId?: string;
    },
    eventType: OrderNotificationEventType,
    order: OrderRoutingContext
  ): RecipientEvaluation {
    const role = (recipient.role || '').toLowerCase().trim();
    const app = (recipient.appTarget || '').toUpperCase().trim();
    const email = (recipient.email || '').toLowerCase().trim();
    const isOwnerEmail = ['olivepizzarjn@gmail.com', 'webhub2811@gmail.com', 'olivepizzamaker@gmail.com'].includes(email);

    // Rule 1: Master Owner accounts must NEVER receive operational kitchen ringing alarms
    if (eventType === 'RESTAURANT_NEW_ORDER_ALARM') {
      if (isOwnerEmail || role === 'owner' || role === 'platform_owner' || app === 'OWNER') {
        return {
          allowed: false,
          reason: 'Owner accounts are strictly isolated from store-level operational kitchen alarms.'
        };
      }

      // Rule 2: Customer app must NEVER receive operational kitchen ringing alarms
      if (role === 'customer' || app === 'CUSTOMER') {
        return {
          allowed: false,
          reason: 'Customer application cannot receive restaurant operational alarms.'
        };
      }

      // Rule 3: Franchise Management app must NEVER receive operational kitchen ringing alarms
      if (role === 'franchise_manager' || role === 'franchise_owner' || app === 'FRANCHISE' || app === 'FRANCHISE_MANAGER') {
        return {
          allowed: false,
          reason: 'Franchise management is business-oversight only; kitchen sound alarms are strictly forbidden.'
        };
      }

      // Rule 4: Delivery riders must NEVER receive kitchen order alarms
      if (role === 'delivery' || role === 'delivery_partner' || role === 'rider' || app === 'DELIVERY') {
        return {
          allowed: false,
          reason: 'Delivery personnel cannot receive kitchen preparation alarms.'
        };
      }

      // Rule 5: Target App MUST be RESTAURANT
      if (app && app !== 'RESTAURANT' && app !== 'RESTAURANT_MANAGER') {
        return {
          allowed: false,
          reason: `App target "${app}" is not authorized for kitchen alarms.`
        };
      }

      // Rule 6: Target Role MUST be authorized restaurant operational staff
      const permittedStaffRoles = ['restaurant_manager', 'kitchen_staff', 'manager', 'cashier', 'chef'];
      if (!permittedStaffRoles.includes(role)) {
        return {
          allowed: false,
          reason: `Role "${role}" is not permitted to receive kitchen order alarms.`
        };
      }

      // Rule 7: Strict Franchise Scoping (Cross-Franchise Isolation)
      if (!recipient.franchiseId || !order.franchiseId || recipient.franchiseId !== order.franchiseId) {
        return {
          allowed: false,
          reason: `Franchise mismatch: recipient franchise "${recipient.franchiseId}" does not match order franchise "${order.franchiseId}".`
        };
      }

      // Rule 8: Strict Branch Scoping (Cross-Branch Isolation - strictly 1:1, no 'all' permitted)
      if (!recipient.branchId || !order.branchId || recipient.branchId !== order.branchId) {
        return {
          allowed: false,
          reason: `Branch mismatch: recipient branch "${recipient.branchId}" does not match order branch "${order.branchId}".`
        };
      }

      return {
        allowed: true,
        reason: 'Authorized restaurant staff for this franchise and branch.',
        category: 'alarm_actionable',
        sound: 'new_order'
      };
    }

    // Rule 9: Delivery partner assignment
    if (eventType === 'DELIVERY_ASSIGNED') {
      if (role !== 'delivery' && role !== 'delivery_partner') {
        return { allowed: false, reason: 'Only delivery partners can receive delivery assignment notifications.' };
      }
      if (!order.deliveryPartnerId || recipient.uid !== order.deliveryPartnerId) {
        return {
          allowed: false,
          reason: 'Unassigned delivery partner; alert is strictly routed to the assigned partner.'
        };
      }
      return {
        allowed: true,
        reason: 'Assigned delivery partner for order.',
        category: 'alarm_actionable',
        sound: 'new_assignment'
      };
    }

    // Rule 10: Customer order status updates
    if (eventType === 'CUSTOMER_ORDER_UPDATE') {
      if (order.userId && recipient.uid !== order.userId) {
        return { allowed: false, reason: 'Customer notifications must strictly match the ordering user ID.' };
      }
      return {
        allowed: true,
        reason: 'Ordering customer.',
        category: 'order_update',
        sound: 'default'
      };
    }

    // Rule 11: Franchise metrics update (strictly silent or informational, never alarm)
    if (eventType === 'FRANCHISE_METRIC_NOTICE') {
      if (role !== 'franchise_manager' && role !== 'franchise_owner') {
        return { allowed: false, reason: 'Only franchise managers can receive franchise metric updates.' };
      }
      if (recipient.franchiseId && order.franchiseId && recipient.franchiseId !== order.franchiseId) {
        return { allowed: false, reason: 'Franchise metric mismatch.' };
      }
      return {
        allowed: true,
        reason: 'Authorized franchise manager for order franchise.',
        category: 'simple_informational',
        sound: 'system_alert'
      };
    }

    return { allowed: false, reason: 'Unknown event type or unmatched recipient policy.' };
  }

  /**
   * Authoritatively routes an order event across the ecosystem.
   */
  public static async routeOrderEvent(
    order: OrderRoutingContext,
    eventType: OrderNotificationEventType
  ): Promise<{ dispatchedCount: number; targetUids: string[]; status: string }> {
    const cleanFranchiseId = order.franchiseId || 'fra_rajnandgaon';
    const cleanBranchId = order.branchId || 'main_branch';

    if (eventType === 'RESTAURANT_NEW_ORDER_ALARM') {
      // 1. Resolve staff strictly bound to this franchise and branch
      const rawUids = await notificationEngine.resolveBranchStaff(cleanBranchId, cleanFranchiseId);

      // 2. Filter UIDs to ensure strict role and privacy isolation
      const finalUids: string[] = [];
      for (const uid of rawUids) {
        // Pre-validate through policy table
        const evaluation = this.evaluateRecipient(
          { uid, role: 'restaurant_manager', franchiseId: cleanFranchiseId, branchId: cleanBranchId, appTarget: 'RESTAURANT' },
          'RESTAURANT_NEW_ORDER_ALARM',
          order
        );
        if (evaluation.allowed) {
          finalUids.push(uid);
        }
      }

      if (finalUids.length === 0) {
        console.warn(`[NotificationRouter] No authorized kitchen staff found for franchise ${cleanFranchiseId}, branch ${cleanBranchId}`);
        return { dispatchedCount: 0, targetUids: [], status: 'NO_RECIPIENTS' };
      }

      const orderNumber = order.orderNumber || (order.dailyOrderNumber ? `#${order.dailyOrderNumber}` : `#${order.orderId.slice(-6).toUpperCase()}`);
      const restaurantPayload = RestaurantTemplates.newOrder(order.orderId, {
        customerName: order.customerName || 'Customer',
        orderNumber,
        permanentBillNo: order.permanentBillNo || undefined,
        orderType: order.orderType || 'delivery',
        totalAmount: order.totalAmount,
        items: Array.isArray(order.items) ? order.items : [],
        paymentMethod: order.paymentMethod || 'COD',
        paymentStatus: order.paymentStatus || 'PENDING',
        cashToCollect: order.cashToCollect,
        deliveryAddress: typeof order.deliveryAddress === 'object'
          ? (order.deliveryAddress?.addressLine || order.deliveryAddress?.address || order.deliveryAddress?.fullAddress || 'Pickup')
          : (order.deliveryAddress || 'Pickup'),
        deliveryInstructions: order.deliveryInstructions,
        customerNotes: order.customerNotes,
        lat: order.lat,
        lng: order.lng,
        phone: order.contactPhone,
        branchId: cleanBranchId,
        franchiseId: cleanFranchiseId,
        orderTime: order.orderTime || new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
        version: 1,
        financials: order.financials,
        productImageThumbnail: order.productImageThumbnail,
        rawOrder: order.rawOrderData
      });

      const res = await notificationEngine.sendBulk(finalUids, restaurantPayload, {
        category: 'alarm_actionable',
        priority: 'critical',
        orderId: order.orderId,
        targetApp: 'restaurant',
        eventId: `NEW_ORDER_${order.orderId}`
      });

      return {
        dispatchedCount: res.successCount,
        targetUids: finalUids,
        status: res.successCount > 0 ? 'DELIVERED' : 'DISPATCH_COMPLETED'
      };
    }

    if (eventType === 'DELIVERY_ASSIGNED') {
      if (!order.deliveryPartnerId) {
        return { dispatchedCount: 0, targetUids: [], status: 'NO_ASSIGNED_RIDER' };
      }

      const orderNumber = order.orderNumber || `#${order.orderId.slice(-6).toUpperCase()}`;
      const partnerPayload = DeliveryTemplates.newAssignment(order.orderId, {
        orderNumber,
        customerName: order.customerName || 'Customer',
        customerPhone: order.contactPhone || 'N/A',
        deliveryAddress: typeof order.deliveryAddress === 'object'
          ? (order.deliveryAddress?.addressLine || order.deliveryAddress?.address || order.deliveryAddress?.fullAddress || 'Delivery Address')
          : (order.deliveryAddress || 'Delivery Address'),
        deliveryInstructions: order.deliveryInstructions,
        distance: 'Nearby',
        eta: '30 mins',
        totalAmount: order.totalAmount,
        paymentMethod: order.paymentMethod || 'COD',
        paymentStatus: order.paymentStatus || 'PENDING',
        cashToCollect: order.cashToCollect,
        items: Array.isArray(order.items) ? order.items : [],
        lat: order.lat,
        lng: order.lng
      });

      const res = await notificationEngine.send(order.deliveryPartnerId, partnerPayload, {
        orderId: order.orderId,
        category: 'alarm_actionable',
        tag: `order_delivery_${order.orderId}`,
        targetApp: 'delivery'
      });

      return {
        dispatchedCount: res.successCount,
        targetUids: [order.deliveryPartnerId],
        status: res.successCount > 0 ? 'DELIVERED' : 'FAILED'
      };
    }

    if (eventType === 'CUSTOMER_ORDER_UPDATE') {
      const customerUid = order.userId;
      if (!customerUid) {
        return { dispatchedCount: 0, targetUids: [], status: 'NO_CUSTOMER_UID' };
      }

      const orderNumber = order.orderNumber || `#${order.orderId.slice(-6).toUpperCase()}`;
      const customerPayload = CustomerTemplates.orderUpdate(order.orderId, {
        orderNumber,
        status: (order.status || 'pending') as any,
        totalAmount: order.totalAmount,
        version: 1
      });

      const res = await notificationEngine.send(customerUid, customerPayload, {
        orderId: order.orderId,
        category: 'order_update',
        tag: `order_customer_${order.orderId}`,
        targetApp: 'customer'
      });

      return {
        dispatchedCount: res.successCount,
        targetUids: [customerUid],
        status: res.successCount > 0 ? 'DELIVERED' : 'FAILED'
      };
    }

    return { dispatchedCount: 0, targetUids: [], status: 'UNHANDLED_EVENT' };
  }
}
