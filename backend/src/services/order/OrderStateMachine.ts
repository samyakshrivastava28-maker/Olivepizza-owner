import { adminDb } from '../../config/firebase.js';
import { pgPool } from '../../config/postgres.js';
import { randomUUID } from 'crypto';
import { PreparationTimeEngine } from './PreparationTimeEngine.js';
import { RiderDispatchEngine } from '../delivery/RiderDispatchEngine.js';
import { notificationEngine } from '../notification/NotificationEngine.js';
import { OwnerTemplates, CustomerTemplates, RestaurantTemplates, DeliveryTemplates } from '../notification/NotificationTemplates.js';

export type CanonicalOrderStatus =
  | 'pending'
  | 'accepted'
  | 'preparing'
  | 'partner_assigned'
  | 'ready'
  | 'picked_up'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled';

export type StateMachineActorRole =
  | 'customer'
  | 'restaurant_manager'
  | 'kitchen_staff'
  | 'delivery_partner'
  | 'cashier'
  | 'franchise_owner'
  | 'owner'
  | 'admin'
  | 'developer'
  | 'system';

export interface StateMachineActor {
  uid: string;
  role: StateMachineActorRole | string;
  name?: string;
  branchId?: string;
}

export interface TransitionResult {
  success: boolean;
  orderId: string;
  previousStatus: CanonicalOrderStatus;
  currentStatus: CanonicalOrderStatus;
  version: number;
  message?: string;
  error?: string;
}

// Canonical transition matrix
const ALLOWED_TRANSITIONS: Record<CanonicalOrderStatus, CanonicalOrderStatus[]> = {
  pending:          ['accepted', 'preparing', 'cancelled'],
  accepted:         ['preparing', 'cancelled'],
  preparing:        ['partner_assigned', 'ready', 'delivered', 'cancelled'],
  partner_assigned: ['ready', 'picked_up', 'out_for_delivery', 'cancelled'],
  ready:            ['partner_assigned', 'picked_up', 'out_for_delivery', 'delivered', 'cancelled'],
  picked_up:        ['out_for_delivery', 'delivered', 'cancelled'],
  out_for_delivery: ['delivered', 'cancelled'],
  delivered:        [],
  cancelled:        [],
};

// Authority rules per transition — strictly operational roles (Owner has read-only surveillance)
const ROLE_AUTHORITY: Record<string, StateMachineActorRole[]> = {
  'pending->accepted':          ['restaurant_manager', 'cashier', 'system'],
  'pending->preparing':         ['restaurant_manager', 'kitchen_staff', 'cashier', 'system'],
  'pending->cancelled':         ['customer', 'restaurant_manager', 'cashier', 'system'],
  'accepted->preparing':        ['restaurant_manager', 'kitchen_staff', 'cashier', 'system'],
  'accepted->cancelled':        ['restaurant_manager', 'cashier', 'system'],
  'preparing->partner_assigned': ['restaurant_manager', 'cashier', 'system'],
  'preparing->ready':           ['restaurant_manager', 'kitchen_staff', 'cashier', 'system'],
  'preparing->delivered':       ['restaurant_manager', 'kitchen_staff', 'cashier', 'system'],
  'preparing->cancelled':       ['restaurant_manager', 'cashier', 'system'],
  'partner_assigned->ready':    ['restaurant_manager', 'kitchen_staff', 'cashier', 'system'],
  'partner_assigned->picked_up': ['delivery_partner', 'restaurant_manager', 'cashier', 'system'],
  'partner_assigned->out_for_delivery': ['delivery_partner', 'restaurant_manager', 'system'],
  'partner_assigned->cancelled': ['restaurant_manager', 'cashier', 'system'],
  'ready->partner_assigned':    ['restaurant_manager', 'cashier', 'system'],
  'ready->picked_up':           ['delivery_partner', 'restaurant_manager', 'cashier', 'system'],
  'ready->out_for_delivery':    ['restaurant_manager', 'cashier', 'system'],
  'ready->delivered':           ['restaurant_manager', 'cashier', 'kitchen_staff', 'system'],
  'ready->cancelled':           ['restaurant_manager', 'cashier', 'system'],
  'picked_up->out_for_delivery': ['delivery_partner', 'system'],
  'picked_up->delivered':       ['delivery_partner', 'system'],
  'picked_up->cancelled':       ['restaurant_manager', 'system'],
  'out_for_delivery->delivered': ['delivery_partner', 'restaurant_manager', 'cashier', 'system'],
  'out_for_delivery->cancelled': ['restaurant_manager', 'system'],
};

export function normalizeStateMachineRole(role?: string): StateMachineActorRole {
  const r = (role || 'customer').toLowerCase().trim();
  if (r === 'manager' || r === 'kitchen_manager' || r === 'chef') {
    return 'restaurant_manager';
  }
  if (r === 'delivery' || r === 'rider') {
    return 'delivery_partner';
  }
  return r as StateMachineActorRole;
}

export class OrderStateMachine {
  /**
   * Reconciles any legacy status strings into canonical order state.
   */
  public static reconcileStatus(status: string): CanonicalOrderStatus {
    const s = (status || '').toLowerCase().trim();
    if (s === 'pending_acceptance') return 'pending';
    if (['pending', 'accepted', 'preparing', 'partner_assigned', 'ready', 'picked_up', 'out_for_delivery', 'delivered', 'cancelled'].includes(s)) {
      return s as CanonicalOrderStatus;
    }
    return 'pending';
  }

  public static async transition(
    orderId: string,
    toStateInput: CanonicalOrderStatus,
    actor: StateMachineActor,
    metadata: Record<string, any> = {}
  ): Promise<TransitionResult> {
    const toState = OrderStateMachine.reconcileStatus(toStateInput);
    const normalizedActorRole = normalizeStateMachineRole(actor.role);
    if ((normalizedActorRole === 'owner' || normalizedActorRole === 'admin') && toState !== 'cancelled') {
      return {
        success: false,
        orderId,
        previousStatus: 'pending',
        currentStatus: 'pending',
        version: 0,
        error: `Owner has read-only authority. Operational stage transition '${toState}' must be performed by restaurant managers, kitchen staff, or delivery partners.`,
      };
    }

    const client = await pgPool.connect().catch(() => null);
    
    try {
      if (client) {
        await client.query('BEGIN').catch(() => {});
        await client.query(
          `INSERT INTO order_locks (order_id) VALUES ($1) ON CONFLICT (order_id) DO UPDATE SET locked_at = NOW()`,
          [orderId]
        ).catch(() => {});
      }

      const orderRef = adminDb.collection('orders').doc(orderId);
      const docSnap = await orderRef.get();

      if (!docSnap.exists) {
        if (client) await client.query('ROLLBACK').catch(() => {});
        return {
          success: false,
          orderId,
          previousStatus: 'pending',
          currentStatus: 'pending',
          version: 0,
          error: 'Order not found',
        };
      }

      const orderData = docSnap.data()!;
      const fromState = OrderStateMachine.reconcileStatus(orderData.status);

      if (fromState === toState) {
        if (metadata && Object.keys(metadata).length > 0) {
          await orderRef.update({
            ...metadata,
            updatedAt: new Date()
          });
        }
        if (client) await client.query('COMMIT').catch(() => {});
        return {
          success: true,
          orderId,
          previousStatus: fromState,
          currentStatus: toState,
          version: orderData.notification_version || 1,
          message: 'Order state confirmed with updated metadata',
        };
      }

      // Validate transition matrix
      const allowedNext = ALLOWED_TRANSITIONS[fromState] || [];
      if (!allowedNext.includes(toState)) {
        if (client) await client.query('ROLLBACK').catch(() => {});
        return {
          success: false,
          orderId,
          previousStatus: fromState,
          currentStatus: fromState,
          version: orderData.notification_version || 1,
          error: `Invalid order state transition from '${fromState}' to '${toState}'.`,
        };
      }

      // Validate actor authority — strictly operational roles
      const transitionKey = `${fromState}->${toState}`;
      const authorizedRoles = ROLE_AUTHORITY[transitionKey] || ['system'];
      const normalizedActorRole = normalizeStateMachineRole(actor.role);

      // Enforce Owner Read-Only Rule at Backend Level
      if (normalizedActorRole === 'owner' || normalizedActorRole === 'admin') {
        if (client) await client.query('ROLLBACK').catch(() => {});
        return {
          success: false,
          orderId,
          previousStatus: fromState,
          currentStatus: fromState,
          version: orderData.notification_version || 1,
          error: `Owner has read-only authority. Operational stage transition '${transitionKey}' must be performed by restaurant managers, kitchen staff, or delivery partners.`,
        };
      }

      const isAuthorized = authorizedRoles.includes(normalizedActorRole) || normalizedActorRole === 'system';
      if (!isAuthorized) {
        if (client) await client.query('ROLLBACK').catch(() => {});
        return {
          success: false,
          orderId,
          previousStatus: fromState,
          currentStatus: fromState,
          version: orderData.notification_version || 1,
          error: `Actor '${actor.name || actor.uid}' with role '${actor.role}' lacks authority for transition '${transitionKey}'.`,
        };
      }

      const currentVersion = Number(orderData.notification_version || 1);
      const newVersion = currentVersion + 1;
      const nowIso = new Date().toISOString();

      const updates: Record<string, any> = {
        status: toState,
        notification_version: newVersion,
        updatedAt: new Date(),
        ...metadata,
      };

      // State-specific calculations and authoritative server timestamps
      switch (toState) {
        case 'accepted': {
          updates.acceptedAt = nowIso;
          if (!orderData.expectedReadyAt && !metadata.expectedReadyAt) {
            const prepMinutes = metadata.estimatedPreparationMinutes || PreparationTimeEngine.calculateEstimatedPreparationMinutes(orderData.items || []);
            updates.estimatedPreparationMinutes = prepMinutes;
            const readyTime = PreparationTimeEngine.computeExpectedReadyAt(nowIso, prepMinutes);
            updates.expectedReadyAt = readyTime;
            updates.estimatedReadyAt = readyTime;
          }
          break;
        }

        case 'preparing': {
          updates.preparingAt = nowIso;
          const prepMinutes = metadata.estimatedPreparationMinutes || orderData.estimatedPreparationMinutes || PreparationTimeEngine.calculateEstimatedPreparationMinutes(orderData.items || []);
          updates.estimatedPreparationMinutes = prepMinutes;
          if (!orderData.expectedReadyAt && !metadata.expectedReadyAt) {
            const readyTime = PreparationTimeEngine.computeExpectedReadyAt(nowIso, prepMinutes);
            updates.expectedReadyAt = readyTime;
            updates.estimatedReadyAt = readyTime;
          }
          
          // Schedule auto-dispatch at ~2/3 prep time
          const autoDispatchDelayMs = Math.floor((prepMinutes * (2 / 3)) * 60 * 1000);
          setTimeout(() => {
            RiderDispatchEngine.autoDispatchRider(orderId).catch((e) =>
              console.warn('[DispatchEngine] Auto-dispatch background notice:', e.message)
            );
          }, Math.max(2000, autoDispatchDelayMs));
          break;
        }

        case 'partner_assigned': {
          updates.partnerAssignedAt = nowIso;
          updates.riderAssignedAt = nowIso;
          break;
        }

        case 'ready': {
          updates.readyAt = nowIso;
          // If this is a delivery order without an assigned partner yet, auto-dispatch immediately
          const fulfillment = (orderData.fulfillmentType || orderData.deliveryType || 'delivery').toLowerCase();
          if (fulfillment === 'delivery' && !orderData.deliveryPartnerId && !metadata.deliveryPartnerId) {
            RiderDispatchEngine.autoDispatchRider(orderId).catch((e) =>
              console.warn('[OrderStateMachine] Auto-dispatch on ready notice:', e.message)
            );
          }
          break;
        }

        case 'picked_up': {
          updates.pickedUpAt = nowIso;
          break;
        }

        case 'out_for_delivery': {
          updates.outForDeliveryAt = nowIso;
          break;
        }

        case 'delivered': {
          updates.deliveredAt = nowIso;
          // Release rider active order lock
          const riderId = orderData.deliveryPartnerId || metadata.deliveryPartnerId;
          if (riderId) {
            adminDb.collection('users').doc(riderId).set({ activeOrderId: null }, { merge: true }).catch(() => {});
            adminDb.collection('delivery_partners').doc(riderId).set({ activeOrderId: null }, { merge: true }).catch(() => {});
          }
          break;
        }

        case 'cancelled': {
          updates.cancelledAt = nowIso;
          updates.cancellationReason = metadata.cancellationReason || 'CUSTOMER_CANCELLED';
          updates.cancellationSource = metadata.cancellationSource || actor.role || 'system';
          updates.cancellationExplanation = metadata.cancellationExplanation || (
            metadata.cancellationReason === 'RESTAURANT_ACCEPT_TIMEOUT'
              ? 'The restaurant was unable to accept your order within the required time.'
              : 'Order was cancelled.'
          );
          updates.cancellationAcknowledged = false;
          updates.cancellationAcknowledgedAt = null;

          // Release rider active order lock if assigned
          const riderId = orderData.deliveryPartnerId || metadata.deliveryPartnerId;
          if (riderId) {
            adminDb.collection('users').doc(riderId).set({ activeOrderId: null }, { merge: true }).catch(() => {});
            adminDb.collection('delivery_partners').doc(riderId).set({ activeOrderId: null }, { merge: true }).catch(() => {});
          }

          // Authoritative payment/refund status
          const isPaid = (orderData.paymentStatus || '').toLowerCase() === 'paid' || orderData.paymentCaptured === true;
          const isCod = (orderData.paymentMethod || '').toLowerCase() === 'cod';
          if (!isPaid || isCod) {
            updates.refundStatus = 'not_applicable';
          } else {
            // Trigger payment reconciliation/refund queue without falsely claiming refund completed
            updates.refundStatus = 'pending_review';
          }
          break;
        }

        default:
          break;
      }

      await orderRef.update(updates);

      // Audit log entry
      adminDb.collection('order_audit_logs').add({
        orderId,
        previousStatus: fromState,
        currentStatus: toState,
        actorUid: actor.uid,
        actorRole: actor.role,
        actorName: actor.name || 'Staff',
        branchId: orderData.branchId || 'main_branch',
        timestamp: nowIso,
        metadata,
      }).catch(() => {});

      // Notification Scoped Dispatch (Section 9)
      this.dispatchScopedNotifications(orderId, fromState, toState, { ...orderData, ...updates });

      // Google Sheets sync on delivered
      if (toState === 'delivered') {
        import('../reports/GoogleSheetsReportService.js').then(({ GoogleSheetsReportService }) => {
          GoogleSheetsReportService.appendOrderToMonthlySheet({
            orderId,
            customerName: orderData.customerName || 'Customer',
            customerPhone: orderData.contactPhone || 'N/A',
            totalAmount: orderData.totalAmount || 0,
            paymentMethod: orderData.paymentMethod || 'COD',
            orderType: orderData.deliveryType || 'delivery',
            status: 'delivered',
            itemCount: (orderData.items || []).length,
            couponCode: orderData.appliedCouponCode,
            deliveryTimeMins: orderData.estimatedPreparationMinutes || 20,
            timestamp: nowIso,
          }).catch((e) => console.warn('[GoogleSheets] Append warning:', e.message));
        }).catch(() => {});
      }

      if (client) {
        await client.query('COMMIT').catch(() => {});
      }

      return {
        success: true,
        orderId,
        previousStatus: fromState,
        currentStatus: toState,
        version: newVersion,
      };

    } catch (err: any) {
      if (client) await client.query('ROLLBACK').catch(() => {});
      console.error('[OrderStateMachine] Transition error:', err);
      return {
        success: false,
        orderId,
        previousStatus: 'pending',
        currentStatus: 'pending',
        version: 0,
        error: err.message || 'Internal state transition error',
      };
    } finally {
      if (client) {
        client.query('DELETE FROM order_locks WHERE order_id = $1', [orderId]).catch(() => {});
        client.release();
      }
    }
  }

  private static async dispatchScopedNotifications(
    orderId: string,
    fromState: CanonicalOrderStatus,
    toState: CanonicalOrderStatus,
    order: Record<string, any>
  ) {
    try {
      const orderNumber = order.orderNumber || ('#' + (order.dailyOrderNumber || orderId.slice(-6)));
      const branchId = order.branchId || 'main_branch';
      const customerUid = order.userId || order.customerId || order.customerUid || order.firebaseUid || order.user_id;
      const fulfillment = (order.fulfillmentType || order.deliveryType || 'delivery').toLowerCase();
      const isPickup = fulfillment === 'pickup' || fulfillment === 'dine_in' || fulfillment === 'takeaway';
      const eventVersion = order.notification_version || 1;
      const eventId = `notif_${orderId}_${toState}_v${eventVersion}`;

      // 1. Customer In-App / FCM Notification (Strict template copy)
      if (customerUid && toState !== 'pending') {
        const customerPayload = CustomerTemplates.orderUpdate(orderId, {
          orderNumber,
          status: toState as any,
          eta: order.estimatedPreparationMinutes ? `${order.estimatedPreparationMinutes} mins` : (order.expectedReadyAt ? 'soon' : undefined),
          deliveryPartnerName: order.deliveryPartnerName,
          totalAmount: Number(order.totalAmount || 0),
          version: eventVersion,
          eventId,
          previousStatus: fromState,
          cancellationReason: order.cancellationReason,
          isPickup,
        });

        await notificationEngine.send(customerUid, customerPayload, {
          category: (toState === 'cancelled' || toState === 'delivered') ? 'simple_informational' : 'pinned_live',
          orderId,
          targetApp: 'customer',
          eventId,
        });
      }

      // 2. Assigned Rider Notification (Only assigned rider receives alert — no broadcast)
      if (order.deliveryPartnerId && ['ready', 'cancelled'].includes(toState)) {
        const riderEventId = `notif_rider_${orderId}_${toState}_v${eventVersion}`;
        const title = toState === 'ready' ? '📦 Order Ready for Pickup!' : 'Order Cancelled';
        const body = toState === 'ready'
          ? `Order #${orderNumber} is hot, packaged, and ready at the counter.`
          : `Order #${orderNumber} was cancelled. Return to standby.`;

        await notificationEngine.send(order.deliveryPartnerId, {
          notification: { title, body },
          data: {
            orderId,
            status: toState,
            orderNumber,
            type: toState === 'ready' ? 'ORDER_READY' : 'ORDER_CANCELLED',
            notificationType: toState === 'ready' ? 'ORDER_READY' : 'ORDER_CANCELLED',
            eventId: riderEventId,
            deepLink: `/live-orders?orderId=${orderId}`,
            url: `/live-orders?orderId=${orderId}`,
            stage: toState,
            role: 'delivery'
          }
        }, {
          category: 'alarm_actionable',
          priority: 'high',
          orderId,
          targetApp: 'delivery',
          eventId: riderEventId,
        });
      }

      // 3. Restaurant Branch Notification on DELIVERED (Immediate alert + distinct delivered sound)
      if (toState === 'delivered') {
        const branchStaffUids = await notificationEngine.resolveBranchStaff(branchId);
        if (branchStaffUids.length > 0) {
          const restEventId = `notif_rest_deliv_${orderId}_v${eventVersion}`;
          const deliveredPayload = RestaurantTemplates.orderDelivered(orderId, {
            orderNumber,
            customerName: order.customerName || 'Customer',
            totalAmount: Number(order.totalAmount || 0),
            branchId,
            franchiseId: order.franchiseId || 'default',
            riderName: order.deliveryPartnerName,
            deliveryAddress: typeof order.deliveryAddress === 'string' ? order.deliveryAddress : (order.deliveryAddress?.addressLine || 'Address'),
            deliveredAt: new Date().toISOString(),
            version: eventVersion,
          });

          await notificationEngine.sendBulk(branchStaffUids, deliveredPayload, {
            category: 'simple_informational',
            priority: 'high',
            orderId,
            targetApp: 'restaurant',
            eventId: restEventId,
          });
        }
      }

    } catch (notifErr: any) {
      console.warn('[OrderStateMachine] Scoped notification warning:', notifErr.message);
    }
  }
}
