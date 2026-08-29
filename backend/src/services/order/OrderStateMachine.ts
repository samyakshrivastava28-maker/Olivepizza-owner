import { adminDb } from '../../config/firebase.js';
import { pgPool } from '../../config/postgres.js';
import { randomUUID } from 'crypto';
import { PreparationTimeEngine } from './PreparationTimeEngine.js';
import { RiderDispatchEngine } from '../delivery/RiderDispatchEngine.js';
import { notificationEngine } from '../notification/NotificationEngine.js';
import { OwnerTemplates, CustomerTemplates } from '../notification/NotificationTemplates.js';

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
  pending:          ['accepted', 'cancelled'],
  accepted:         ['preparing', 'cancelled'],
  preparing:        ['partner_assigned', 'ready', 'cancelled'],
  partner_assigned: ['ready', 'picked_up', 'cancelled'],
  ready:            ['partner_assigned', 'picked_up', 'cancelled'],
  picked_up:        ['out_for_delivery', 'cancelled'],
  out_for_delivery: ['delivered', 'cancelled'],
  delivered:        [],
  cancelled:        [],
};

// Authority rules per transition
const ROLE_AUTHORITY: Record<string, StateMachineActorRole[]> = {
  'pending->accepted':          ['restaurant_manager', 'cashier', 'owner', 'admin', 'developer', 'system'],
  'pending->cancelled':         ['customer', 'restaurant_manager', 'cashier', 'owner', 'admin', 'developer', 'system'],
  'accepted->preparing':        ['restaurant_manager', 'kitchen_staff', 'cashier', 'owner', 'admin', 'developer', 'system'],
  'accepted->cancelled':        ['restaurant_manager', 'cashier', 'owner', 'admin', 'developer', 'system'],
  'preparing->partner_assigned': ['restaurant_manager', 'delivery_partner', 'cashier', 'owner', 'admin', 'developer', 'system'],
  'preparing->ready':           ['restaurant_manager', 'kitchen_staff', 'cashier', 'owner', 'admin', 'developer', 'system'],
  'preparing->cancelled':       ['restaurant_manager', 'cashier', 'owner', 'admin', 'developer', 'system'],
  'partner_assigned->ready':    ['restaurant_manager', 'kitchen_staff', 'cashier', 'owner', 'admin', 'developer', 'system'],
  'partner_assigned->picked_up': ['delivery_partner', 'owner', 'admin', 'developer', 'system'],
  'partner_assigned->cancelled': ['restaurant_manager', 'cashier', 'owner', 'admin', 'developer', 'system'],
  'ready->partner_assigned':    ['restaurant_manager', 'delivery_partner', 'cashier', 'owner', 'admin', 'developer', 'system'],
  'ready->picked_up':           ['delivery_partner', 'owner', 'admin', 'developer', 'system'],
  'ready->cancelled':           ['restaurant_manager', 'cashier', 'owner', 'admin', 'developer', 'system'],
  'picked_up->out_for_delivery': ['delivery_partner', 'owner', 'admin', 'developer', 'system'],
  'picked_up->cancelled':       ['restaurant_manager', 'owner', 'admin', 'developer', 'system'],
  'out_for_delivery->delivered': ['delivery_partner', 'owner', 'admin', 'developer', 'system'],
  'out_for_delivery->cancelled': ['restaurant_manager', 'owner', 'admin', 'developer', 'system'],
};

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
    toState: CanonicalOrderStatus,
    actor: StateMachineActor,
    metadata: Record<string, any> = {}
  ): Promise<TransitionResult> {
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
      let fromState = (orderData.status || 'pending') as CanonicalOrderStatus;
      if (fromState === ('pending_acceptance' as any)) fromState = 'pending';

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

      // Validate actor authority
      const transitionKey = `${fromState}->${toState}`;
      const authorizedRoles = ROLE_AUTHORITY[transitionKey] || ['owner', 'admin', 'developer', 'system'];
      const normalizedActorRole = (actor.role || 'customer').toLowerCase() as StateMachineActorRole;

      const isAuthorized = authorizedRoles.includes(normalizedActorRole) || ['owner', 'admin', 'developer', 'system'].includes(normalizedActorRole);
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

      // State-specific calculations and lifecycle hooks
      if (toState === 'accepted') {
        updates.acceptedAt = nowIso;
      } else if (toState === 'preparing') {
        updates.preparingAt = nowIso;
        const prepMinutes = PreparationTimeEngine.calculateEstimatedPreparationMinutes(orderData.items || []);
        updates.estimatedPreparationMinutes = prepMinutes;
        updates.expectedReadyAt = PreparationTimeEngine.computeExpectedReadyAt(nowIso, prepMinutes);
        
        // Schedule auto-dispatch at ~2/3 prep time
        const autoDispatchDelayMs = Math.floor((prepMinutes * (2 / 3)) * 60 * 1000);
        setTimeout(() => {
          RiderDispatchEngine.autoDispatchRider(orderId).catch((e) =>
            console.warn('[DispatchEngine] Auto-dispatch background notice:', e.message)
          );
        }, Math.max(2000, autoDispatchDelayMs));

      } else if (toState === 'partner_assigned') {
        updates.partnerAssignedAt = nowIso;
      } else if (toState === 'ready') {
        updates.readyAt = nowIso;
      } else if (toState === 'picked_up') {
        updates.pickedUpAt = nowIso;
      } else if (toState === 'out_for_delivery') {
        updates.outForDeliveryAt = nowIso;
      } else if (toState === 'delivered') {
        updates.deliveredAt = nowIso;
      } else if (toState === 'cancelled') {
        updates.cancelledAt = nowIso;
        if (metadata.cancellationReason) updates.cancellationReason = metadata.cancellationReason;
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
      const customerUid = order.userId;

      // 1. Customer In-App / FCM Notification
      if (customerUid && toState !== 'pending') {
        let title = 'Olive Pizza Order Update';
        let body = `Your order ${orderNumber} status is now ${toState}.`;

        if (toState === 'accepted') {
          title = 'Order Confirmed! 🍕';
          body = 'The kitchen has accepted your order and will begin handcrafted preparation shortly.';
        } else if (toState === 'preparing') {
          title = 'Baking in Stone Ovens 🔥';
          body = `Your pizza is being freshly baked (~ ${order.estimatedPreparationMinutes || 15} mins).`;
        } else if (toState === 'partner_assigned') {
          title = 'Rider Assigned 🛵';
          body = `${order.deliveryPartnerName || 'Your delivery partner'} is assigned to pick up your order.`;
        } else if (toState === 'ready') {
          title = 'Order Ready! ✨';
          body = 'Your order is hot, packaged, and ready for dispatch.';
        } else if (toState === 'picked_up' || toState === 'out_for_delivery') {
          title = 'Out for Delivery 🚀';
          body = 'Your delivery partner is on the way with your hot meal!';
        } else if (toState === 'delivered') {
          title = 'Order Delivered! 🎉';
          body = 'Enjoy your delicious meal! Tap to rate your food and delivery experience.';
        } else if (toState === 'cancelled') {
          title = 'Order Cancelled';
          body = `Your order was cancelled. ${order.cancellationReason || ''}`;
        }

        await notificationEngine.send(customerUid, {
          notification: { title, body },
          data: { orderId, status: toState, orderNumber }
        }, { category: 'pinned_live', orderId });
      }

      // 2. Rider Notification
      if (order.deliveryPartnerId && ['ready', 'cancelled'].includes(toState)) {
        const title = toState === 'ready' ? '📦 Order Ready for Pickup!' : 'Order Cancelled';
        const body = toState === 'ready' ? `Order ${orderNumber} is ready at the counter.` : `Order ${orderNumber} was cancelled.`;
        await notificationEngine.send(order.deliveryPartnerId, {
          notification: { title, body },
          data: { orderId, status: toState }
        }, { category: 'alarm_actionable', priority: 'high', orderId });
      }

    } catch (notifErr: any) {
      console.warn('[OrderStateMachine] Scoped notification warning:', notifErr.message);
    }
  }
}
