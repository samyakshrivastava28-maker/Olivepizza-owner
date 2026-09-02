import { adminDb } from '../../config/firebase.js';
import { OrderStateMachine } from './OrderStateMachine.js';

export class OrderTimeoutWorker {
  private static interval: NodeJS.Timeout | null = null;
  private static isProcessing = false;
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

    this.interval = setInterval(() => {
      this.processTimedOutOrders().catch(err => 
        console.warn('[OrderTimeoutWorker] Scheduled run error:', err.message)
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
    if (this.isProcessing) {
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
      console.error('[OrderTimeoutWorker] Error processing timed out orders:', err);
    } finally {
      this.isProcessing = false;
    }

    return { processedCount: cancelledOrderIds.length, cancelledOrderIds };
  }
}
