/**
 * Firestore Listener — uses Firebase Admin SDK (bypasses security rules)
 * This is the SINGLE SOURCE OF TRUTH for all order notifications.
 */
import { adminDb as db } from '../config/firebase.js';
import { pgPool } from '../config/postgres.js';
import { notificationQueue } from '../services/notification/NotificationQueueService.js';

import { OwnerTemplates, CustomerTemplates, DeliveryTemplates, RestaurantTemplates } from '../services/notification/NotificationTemplates.js';
import { queueEmail } from '../services/email.service.js';
import { buildOrderStatusEmail } from '../services/emailTemplates.service.js';
import { notificationEngine } from '../services/notification/NotificationEngine.js';
import { appEventBus } from '../services/eventBus/AppEventBus.js';

export class FirestoreListener {
  private static orderStatusCache = new Map<string, string>();
  private static processedOrderIds = new Set<string>();

  // Cleanup processedOrderIds every 30 min to prevent unbounded memory growth.
  // On Render, server rarely runs >24h without a deploy, but belt-and-suspenders.
  private static cleanupTimer = setInterval(() => {
    const beforeSize = FirestoreListener.processedOrderIds.size;
    FirestoreListener.processedOrderIds.clear();
    if (beforeSize > 0) {
      console.log(`[FirestoreListener] Cleared ${beforeSize} processed order IDs from dedup cache`);
    }
  }, 30 * 60 * 1000);

  static async init() {
    try {
      await this.hydrateActiveOrdersCache();
      this.listenToOrders();
      this.listenToActivityLogs();
      console.log('🎧 Firestore Listeners (Admin SDK) initialized for Unified Notifications.');
    } catch (err: any) {
      console.error('❌ Failed to initialize Firestore Listeners:', err.message || err);
    }
  }

  /**
   * Fix 4: Hydrate all active (non-terminal) orders into orderStatusCache at startup
   */
  private static async hydrateActiveOrdersCache() {
    try {
      const activeSnap = await db.collection('orders')
        .where('status', 'not-in', ['delivered', 'completed', 'cancelled'])
        .get();
      activeSnap.docs.forEach((doc: any) => {
        this.orderStatusCache.set(doc.id, doc.data()?.status);
      });
      console.log(`[FirestoreListener] Hydrated ${activeSnap.size} active order statuses into cache.`);
    } catch (err: any) {
      console.warn('[FirestoreListener] Active orders cache hydration notice:', err.message);
    }
  }

  /**
   * Fix 1: Unified Owner Recipient Resolution (Postgres fcm_tokens + Firestore users)
   */
  private static async getOwnerRecipients(): Promise<string[]> {
    try {
      return await notificationEngine.resolveByRole('owner');
    } catch (err: any) {
      console.error('[FirestoreListener] Error resolving owner recipients:', err.message);
      return [];
    }
  }

  private static listenToOrders() {
    db.collection('orders').onSnapshot(
      async (snapshot: any) => {
        for (const change of snapshot.docChanges()) {
          const orderData = { id: change.doc.id, ...change.doc.data() } as any;

          // ── NEW ORDER ────────────────────────────────────────────────────────
          if (change.type === 'added') {
            let createdAt: Date = new Date();
            if (orderData.createdAt) {
              if (typeof orderData.createdAt?.toDate === 'function') {
                createdAt = orderData.createdAt.toDate();
              } else if (typeof orderData.createdAt === 'string' || typeof orderData.createdAt === 'number') {
                createdAt = new Date(orderData.createdAt);
              } else if (orderData.createdAt instanceof Date) {
                createdAt = orderData.createdAt;
              } else if (orderData.createdAt?._seconds) {
                createdAt = new Date(orderData.createdAt._seconds * 1000);
              }
            }
            if (isNaN(createdAt.getTime())) {
              createdAt = new Date();
            }

            // ALWAYS set status cache for state tracking, even for historical orders
            this.orderStatusCache.set(orderData.id, orderData.status);

            // Skip trigger push alarms for terminal or old orders (server restart replay protection)
            if (['delivered', 'cancelled', 'completed', 'rejected', 'failed'].includes((orderData.status || '').toLowerCase())) continue;
            if (Date.now() - createdAt.getTime() > 10 * 60 * 1000) continue;
            
            // Prevent duplicate triggers if we already processed this order creation
            if (this.processedOrderIds.has(orderData.id)) continue;
            this.processedOrderIds.add(orderData.id);

            const shortId = orderData.id.slice(-6).toUpperCase();
            const orderNumber = orderData.dailyOrderNumber
              ? `#${orderData.dailyOrderNumber}`
              : (orderData.dailyOrderNumber || orderData.daily_order_number || `OP-${shortId}`);
            const totalAmount = Number(orderData.totalAmount || orderData.total_amount || 0);
            
            console.log(`🍕 New order: ${orderNumber} — triggering Unified Pipeline`);

            if (orderData.orderTiming === 'scheduled') continue; // Skip push alarms for scheduled until ready

            // 1. FCM PUSH NOTIFICATION FOR NEW ORDER (RESTAURANT MANAGEMENT ALARM & CUSTOMER PLACED)
            (async () => {
              try {
                // Dispatch Restaurant Management Alarm strictly to authorized staff of this branch
                const branchId = orderData.branchId || 'main_branch';
                const branchStaffRecipients = await notificationEngine.resolveBranchStaff(branchId);
                if (branchStaffRecipients.length > 0) {
                  const restaurantPayload = RestaurantTemplates.newOrder(orderData.id, {
                    customerName: orderData.customerName || orderData.customer_name || 'Customer',
                    orderNumber,
                    totalAmount,
                    items: Array.isArray(orderData.items) ? orderData.items.map((i: any) => typeof i === 'string' ? i : `${i.quantity || 1}x ${i.name || 'Item'}`) : [],
                    paymentMethod: orderData.paymentMethod || 'COD',
                    deliveryAddress: orderData.deliveryAddress?.addressLine || orderData.deliveryAddress || 'Pickup',
                    phone: orderData.contactPhone || orderData.phone,
                    branchId,
                    orderTime: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
                  });
                  await notificationEngine.sendBulk(branchStaffRecipients, restaurantPayload, {
                    orderId: orderData.id,
                    category: 'alarm_actionable',
                    tag: `order_restaurant_${orderData.id}`,
                  });
                }

                // Dispatch Customer Confirmation
                const customerUid = orderData.customerUid || orderData.firebaseUid || orderData.customerId || orderData.userId || orderData.user_id;
                if (customerUid) {
                  const customerPayload = CustomerTemplates.orderUpdate(orderData.id, {
                    orderNumber,
                    status: 'pending',
                    totalAmount,
                  });
                  await notificationEngine.send(customerUid, customerPayload, {
                    orderId: orderData.id,
                    category: 'pinned_live',
                    tag: `order_${orderData.id}`,
                  });
                }
              } catch (notifErr: any) {
                console.warn('[FirestoreListener] Push notification error on new order:', notifErr.message);
              }
            })();

            // 2. EMAIL TO CUSTOMER & OWNER
            this.sendOrderEmail(orderData, 'pending');

            // 3. SYNC LIVE ORDER TO GOOGLE SHEETS
            import('../services/reports/GoogleSheetsReportService.js').then(({ GoogleSheetsReportService }) => {
              GoogleSheetsReportService.syncOrderToMonthlySheet(orderData).catch(err => {
                console.warn('[FirestoreListener] Google Sheet sync warning:', err.message);
              });
            }).catch(() => {});

            // 4. Emit AppEventBus domain event for WebSocket live updates
            appEventBus.emitTyped('order.created', {
              orderId: orderData.id,
              orderNumber,
              userId: orderData.userId || orderData.firebaseUid || '',
              customerName: orderData.customerName || orderData.customer_name || 'Customer',
              totalAmount,
              items: Array.isArray(orderData.items) ? orderData.items : [],
              paymentMethod: orderData.paymentMethod || 'COD',
              deliveryAddress: orderData.deliveryAddress?.addressLine || orderData.deliveryAddress || 'Pickup',
              contactPhone: orderData.contactPhone || '',
              orderTiming: orderData.orderTiming,
              timestamp: new Date().toISOString(),
              rawOrderData: orderData,
            });
          }

          // ── ORDER MODIFIED (STATUS TRANSITION) ────────────────────────────────
          else if (change.type === 'modified') {
            const currentStatus: string = orderData.status;
            const prevStatus = this.orderStatusCache.get(orderData.id);
            const slackTs: string | undefined = orderData.slackThreadTs;

            if (!currentStatus || currentStatus === prevStatus) continue;
            this.orderStatusCache.set(orderData.id, currentStatus);

            const shortId = orderData.id.slice(-6).toUpperCase();
            const orderNumber = orderData.dailyOrderNumber
              ? `#${orderData.dailyOrderNumber}`
              : (orderData.daily_order_number || `OP-${shortId}`);
            const totalAmount = Number(orderData.totalAmount || orderData.total_amount || 0);

            console.log(`🔄 Order ${orderNumber} Status Transition: ${prevStatus} → ${currentStatus}`);

            type StatusCfg = { emoji: string; label: string; category: 'orders' | 'delivery' };
            const statusConfig: Record<string, StatusCfg> = {
              accepted:         { emoji: '✅', label: 'Order Accepted',            category: 'orders' },
              preparing:        { emoji: '🍳', label: 'Preparing Your Order',      category: 'orders' },
              ready:            { emoji: '🟢', label: 'Order Ready',               category: 'orders' },
              packed:           { emoji: '📦', label: 'Order Packed & Ready',       category: 'orders' },
              partner_assigned: { emoji: '🛵', label: 'Delivery Partner Assigned',  category: 'delivery' },
              picked_up:        { emoji: '📦', label: 'Order Picked Up',            category: 'delivery' },
              out_for_delivery: { emoji: '🚀', label: 'Out for Delivery',           category: 'delivery' },
              delivered:        { emoji: '🎉', label: 'Order Delivered',            category: 'delivery' },
              cancelled:        { emoji: '❌', label: 'Order Cancelled',            category: 'orders' },
              payment_failed:   { emoji: '💳', label: 'Payment Failed',             category: 'orders' },
            };

            const cfg = statusConfig[currentStatus];
            if (!cfg) continue;

            // 1. FCM PUSH NOTIFICATIONS FOR ORDER STATUS UPDATES
            (async () => {
              try {
                const customerUid = orderData.customerUid || orderData.firebaseUid || orderData.customerId || orderData.userId || orderData.user_id;
                if (customerUid) {
                  const customerPayload = CustomerTemplates.orderUpdate(orderData.id, {
                    orderNumber,
                    status: currentStatus as any,
                    totalAmount,
                    deliveryPartnerName: orderData.deliveryPartnerName,
                    cancellationReason: orderData.cancellationReason,
                  });
                  await notificationEngine.send(customerUid, customerPayload, {
                    orderId: orderData.id,
                    category: ['delivered', 'cancelled'].includes(currentStatus) ? 'simple_informational' : 'pinned_live',
                    tag: `order_${orderData.id}`,
                    targetApp: 'customer',
                  });
                }

                // If partner assigned / ready, notify assigned delivery partner
                if (['partner_assigned', 'ready'].includes(currentStatus) && (orderData.deliveryPartnerId || orderData.delivery_partner_id)) {
                  const partnerId = orderData.deliveryPartnerId || orderData.delivery_partner_id;
                  const partnerPayload = DeliveryTemplates.newAssignment(orderData.id, {
                    orderNumber,
                    customerName: orderData.customerName || 'Customer',
                    customerPhone: orderData.contactPhone || 'N/A',
                    deliveryAddress: orderData.deliveryAddress?.addressLine || orderData.deliveryAddress || 'Delivery Address',
                    distance: orderData.deliveryDistance || 'Nearby',
                    eta: orderData.estimatedDeliveryTime || '30 mins',
                    totalAmount,
                    paymentMethod: orderData.paymentMethod || 'COD',
                  });
                  await notificationEngine.send(partnerId, partnerPayload, {
                    orderId: orderData.id,
                    category: 'alarm_actionable',
                    tag: `order_delivery_${orderData.id}`,
                    targetApp: 'delivery',
                  });
                }
              } catch (notifErr: any) {
                console.warn(`[FirestoreListener] Status change push notification error:`, notifErr.message);
              }
            })();

            // 2. EMAIL FALLBACK / TRANSACTIONAL EMAILS
            this.sendOrderEmail(orderData, currentStatus);

            // 3. SYNC ORDER STATUS UPDATE TO GOOGLE SHEETS
            import('../services/reports/GoogleSheetsReportService.js').then(({ GoogleSheetsReportService }) => {
              GoogleSheetsReportService.syncOrderToMonthlySheet(orderData).catch(err => {
                console.warn('[FirestoreListener] Google Sheet status sync warning:', err.message);
              });
            }).catch(() => {});

            // 4. Emit AppEventBus domain event for WebSocket live updates
            appEventBus.emitTyped('order.status_changed', {
              orderId: orderData.id,
              orderNumber,
              userId: orderData.userId || orderData.firebaseUid || '',
              customerName: orderData.customerName || orderData.customer_name || 'Customer',
              previousStatus: prevStatus || '',
              currentStatus,
              totalAmount,
              deliveryPartnerId: orderData.deliveryPartnerId || orderData.delivery_partner_id,
              deliveryPartnerName: orderData.deliveryPartnerName,
              slackThreadTs: orderData.slackThreadTs,
              timestamp: new Date().toISOString(),
              rawOrderData: orderData,
            });
          }
        }
      },
      (error: any) => {
        console.error('❌ Order snapshot listener error:', error.message);
      }
    );
  }

  private static async sendOrderEmail(orderData: any, status: string) {
    try {
      const customerUid = orderData.customerUid || orderData.firebaseUid || orderData.customerId || orderData.userId || orderData.user_id;
      let email = orderData.customerEmail || orderData.email || orderData.contactEmail;
      let customerData: any = null;
      
      if (customerUid) {
        const customerDoc = await db.collection('users').doc(customerUid).get();
        if (customerDoc.exists) {
          customerData = customerDoc.data();
          if (!email) email = customerData?.email;
        }
      }
      if (!email) return;

      const shortId = orderData.id.slice(-6).toUpperCase();
      const orderNumber = orderData.dailyOrderNumber || orderData.daily_order_number || `OP-${shortId}`;
      const totalAmount = Number(orderData.totalAmount || orderData.total_amount || 0);

      let subject = '';
      if (status === 'pending') subject = `Order Placed — #${orderNumber}`;
      else if (status === 'accepted') subject = `Order Accepted — #${orderNumber}`;
      else if (status === 'cancelled') subject = `Order Cancelled — #${orderNumber}`;
      else if (status === 'delivered') subject = `Order Delivered — #${orderNumber}`;
      else return; // Don't email for every minor step like preparing

      const fullOrderData = {
        items: Array.isArray(orderData.items) ? orderData.items : [],
        subtotal: totalAmount, total_amount: totalAmount,
        deliveryAddress: orderData.deliveryAddress?.addressLine || orderData.deliveryAddress || 'Pickup',
        customerName: orderData.customerName || customerData?.name || 'Customer',
        contactPhone: orderData.contactPhone || customerData?.phone,
        paymentMethod: orderData.paymentMethod || 'COD',
      };

      const htmlBody = buildOrderStatusEmail({
        customerName: fullOrderData.customerName, subject, stage: status as any, orderId: orderData.id,
        data: { orderNumber, totalAmount: String(totalAmount), paymentMethod: fullOrderData.paymentMethod, deliveryAddress: fullOrderData.deliveryAddress },
        orderData: fullOrderData
      });

      // 1. Send Customer Email to customer's registered email account
      await queueEmail(email, subject, htmlBody, 'transactional');
      console.log(`[Email] Customer order email queued for ${email} (Stage: ${status})`);
    } catch (e) {
      console.warn('❌ Email dispatch failed:', e);
    }
  }

  private static listenToActivityLogs() {
    let initialLoad = true;
    db.collection('activity_logs').orderBy('timestamp', 'desc').limit(20).onSnapshot((snapshot: any) => {
      if (initialLoad) { initialLoad = false; return; }
      for (const change of snapshot.docChanges()) {
        if (change.type !== 'added') continue;
        const data = change.doc.data() as any;
        const action: string = data.action || '';
        let category: 'security' | 'inventory' | 'support' | 'general' = 'general';
        if (/security|login|permission|admin/i.test(action)) category = 'security';
        else if (/stock|inventory|product/i.test(action)) category = 'inventory';
        else if (/customer|support|ticket/i.test(action)) category = 'support';
      }
    });
  }
}
