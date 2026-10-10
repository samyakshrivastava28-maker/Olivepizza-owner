import { adminDb } from '../../config/firebase.js';
import { OrderStateMachine } from './OrderStateMachine.js';

export class OrderTimeoutWorker {
  private static interval: NodeJS.Timeout | null = null;
  private static isProcessing = false;
  private static quotaBackoffUntil = 0;
  public static readonly DEFAULT_TIMEOUT_MINUTES = 10;

  /**
   * Starts the periodic background scanner (runs every 30 seconds).
   */
  public static init() {
    if (this.interval) return;
    console.log('⏰ [OrderTimeoutWorker] Initializing 10-minute order acceptance auto-cancel worker...');
    
    // Process immediately on boot, then every 30 seconds
    this.processTimedOutOrders().catch(err => 
      console.warn('[OrderTimeoutWorker] Startup run error:', err.message)
    );
    this.processAutoRiderAssignments().catch(err =>
      console.warn('[OrderTimeoutWorker] Auto rider assignment startup run error:', err.message)
    );

    this.interval = setInterval(() => {
      this.processTimedOutOrders().catch(err => 
        console.warn('[OrderTimeoutWorker] Scheduled run error:', err.message)
      );
      this.processAutoRiderAssignments().catch(err =>
        console.warn('[OrderTimeoutWorker] Scheduled auto rider assignment error:', err.message)
      );
    }, 30 * 1000);
  }

  public static stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      console.log('[OrderTimeoutWorker] Stopped.');
    }
  }

  /**
   * Authoritatively queries Firestore for pending orders that have exceeded their acceptance deadline.
   */
  public static async processTimedOutOrders(): Promise<{ processedCount: number; cancelledOrderIds: string[] }> {
    if (this.isProcessing || Date.now() < this.quotaBackoffUntil) {
      return { processedCount: 0, cancelledOrderIds: [] };
    }

    this.isProcessing = true;
    const cancelledOrderIds: string[] = [];

    try {
      // Query pending orders
      const pendingSnap = await adminDb.collection('orders')
        .where('status', 'in', ['pending', 'pending_acceptance'])
        .get();

      if (pendingSnap.empty) {
        this.isProcessing = false;
        return { processedCount: 0, cancelledOrderIds: [] };
      }

      for (const doc of pendingSnap.docs) {
        const data = doc.data();
        const orderId = doc.id;

        // Determine acceptance deadline
        let deadline = data.acceptanceDeadline;
        if (!deadline) {
          // If legacy order without explicit deadline, compute from createdAt
          let createdAtMs = Date.now();
          if (data.createdAt) {
            if (typeof data.createdAt?.toDate === 'function') {
              createdAtMs = data.createdAt.toDate().getTime();
            } else if (typeof data.createdAt === 'string' || typeof data.createdAt === 'number') {
              createdAtMs = new Date(data.createdAt).getTime();
            } else if (data.createdAt?._seconds) {
              createdAtMs = data.createdAt._seconds * 1000;
            }
          }
          const timeoutMinutes = Number(process.env.ORDER_ACCEPT_TIMEOUT_MINUTES || OrderTimeoutWorker.DEFAULT_TIMEOUT_MINUTES);
          deadline = new Date(createdAtMs + timeoutMinutes * 60 * 1000).toISOString();
        }

        // Compare server timestamps
        if (new Date(deadline).getTime() <= Date.now()) {
          console.log(`[OrderTimeoutWorker] Order ${orderId} reached 10-min acceptance deadline (${deadline}). Triggering auto-cancellation...`);

          const result = await OrderStateMachine.transition(
            orderId,
            'cancelled',
            {
              uid: 'system',
              role: 'system',
              name: 'Order Acceptance Timeout Engine'
            },
            {
              cancellationReason: 'RESTAURANT_ACCEPT_TIMEOUT',
              cancellationSource: 'SYSTEM_TIMEOUT',
              acceptanceDeadline: deadline,
              autoCancelled: true,
              cancellationExplanation: 'The restaurant was unable to accept your order within the required 10 minutes.'
            }
          );

          if (result.success) {
            cancelledOrderIds.push(orderId);
            console.log(`[OrderTimeoutWorker] ✅ Order ${orderId} successfully auto-cancelled by system timeout.`);
          } else {
            // If another actor transitioned the order (e.g. restaurant accepted concurrently), this is expected and safe
            console.log(`[OrderTimeoutWorker] ℹ️ Order ${orderId} transition result: ${result.error || 'Already progressed'}`);
          }
        }
      }
    } catch (err: any) {
      if (err?.message?.includes('RESOURCE_EXHAUSTED')) {
        this.quotaBackoffUntil = Date.now() + 2 * 60 * 1000;
      }
      console.warn('[OrderTimeoutWorker] Timed-out orders notice:', err?.message);
    } finally {
      this.isProcessing = false;
    }

    return { processedCount: cancelledOrderIds.length, cancelledOrderIds };
  }

  /**
   * Scans active delivery orders in kitchen prep / accepted states and automatically assigns
   * an eligible online rider when 5 minutes or less remain before order is prepared.
   */
  public static async processAutoRiderAssignments(): Promise<{ assignedCount: number }> {
    if (Date.now() < this.quotaBackoffUntil) {
      return { assignedCount: 0 };
    }
    let assignedCount = 0;
    try {
      const activeDeliverySnap = await adminDb.collection('orders')
        .where('status', 'in', ['accepted', 'preparing', 'ready'])
        .get();

      if (activeDeliverySnap.empty) {
        return { assignedCount: 0 };
      }

      const { RiderDispatchEngine } = await import('../delivery/RiderDispatchEngine.js');
      const nowMs = Date.now();

      for (const orderDoc of activeDeliverySnap.docs) {
        const orderData = orderDoc.data();
        const orderId = orderDoc.id;

        // Skip non-delivery orders (e.g. pickup, dine-in)
        const fulfillment = (orderData.fulfillmentType || orderData.deliveryType || 'delivery').toLowerCase();
        if (fulfillment !== 'delivery') {
          continue;
        }

        // Skip if a delivery partner is already assigned
        if (orderData.deliveryPartnerId || orderData.riderId) {
          continue;
        }

        const status = orderData.status;
        const expectedReadyAt = orderData.expectedReadyAt || orderData.estimatedReadyAt;

        let shouldAssign = false;

        if (status === 'ready') {
          // Food is already cooked and ready for dispatch -> assign immediately!
          shouldAssign = true;
        } else if (expectedReadyAt) {
          const readyMs = new Date(expectedReadyAt).getTime();
          const msRemaining = readyMs - nowMs;
          const minutesRemaining = msRemaining / (60 * 1000);

          // Trigger automatic rider assignment when 5 minutes or less left before order is ready
          if (minutesRemaining <= 5) {
            shouldAssign = true;
          }
        } else {
          // Fallback if no expectedReadyAt recorded: if preparing for > 7 mins, trigger assignment
          const prepAt = orderData.preparingAt || orderData.acceptedAt || orderData.createdAt;
          if (prepAt) {
            const prepMs = new Date(prepAt).getTime();
            if (nowMs - prepMs >= 7 * 60 * 1000) {
              shouldAssign = true;
            }
          }
        }

        if (shouldAssign) {
          console.log(`[OrderTimeoutWorker] 🛵 Order ${orderId} reached 5-minute pre-ready window (status: ${status}). Triggering automatic rider dispatch...`);
          try {
            const dispatchResult = await RiderDispatchEngine.autoDispatchRider(orderId);
            if (dispatchResult.success && dispatchResult.rider) {
              assignedCount++;
              console.log(`[OrderTimeoutWorker] ✅ Successfully auto-assigned rider '${dispatchResult.rider.name}' (${dispatchResult.rider.uid}) to order ${orderId}.`);
            } else {
              console.log(`[OrderTimeoutWorker] ℹ️ Auto-dispatch for order ${orderId}: ${dispatchResult.reason || 'Waiting for online rider'}`);
            }
          } catch (dispatchErr: any) {
            console.warn(`[OrderTimeoutWorker] Auto-dispatch error for order ${orderId}:`, dispatchErr?.message);
          }
        }
      }
    } catch (err: any) {
      if (err?.message?.includes('RESOURCE_EXHAUSTED')) {
        this.quotaBackoffUntil = Date.now() + 2 * 60 * 1000;
      }
      console.warn('[OrderTimeoutWorker] Error in processAutoRiderAssignments:', err?.message);
    }

    return { assignedCount };
  }
}
