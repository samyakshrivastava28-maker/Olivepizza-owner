import { appEventBus, OrderCreatedEvent, OrderStatusChangedEvent } from '../eventBus/AppEventBus.js';
import { OrderEmbeddingService, OrderEmbeddingPayload } from './OrderEmbeddingService.js';
import { ZillizOrderRepository, ZillizOrderRecord } from './ZillizOrderRepository.js';
import { adminDb } from '../../config/firebase.js';

export class OrderArchiveIndexer {
  private static isSubscribed = false;
  private static indexingQueue: Array<{ orderData: any; retryCount: number }> = [];
  private static isProcessing = false;

  public static initialize(): void {
    if (this.isSubscribed) return;

    appEventBus.onTyped('order.created', (event: OrderCreatedEvent) => {
      this.enqueueOrder(event.rawOrderData || event);
    });

    appEventBus.onTyped('order.status_changed', (event: OrderStatusChangedEvent) => {
      this.enqueueOrder(event.rawOrderData || event);
    });

    this.isSubscribed = true;
    console.log('[OrderArchiveIndexer] Realtime order indexing listener attached to AppEventBus');
  }

  public static enqueueOrder(orderData: any): void {
    if (!orderData || (!orderData.orderId && !orderData.id)) return;
    this.indexingQueue.push({ orderData, retryCount: 0 });
    this.processQueue();
  }

  private static async processQueue(): Promise<void> {
    if (this.isProcessing || this.indexingQueue.length === 0) return;
    this.isProcessing = true;

    while (this.indexingQueue.length > 0) {
      const item = this.indexingQueue.shift();
      if (!item) break;

      try {
        await this.indexSingleOrder(item.orderData);
      } catch (err: any) {
        console.error('[OrderArchiveIndexer] Error indexing order ' + (item.orderData.orderId || item.orderData.id) + ': ' + err.message);
        if (item.retryCount < 3) {
          item.retryCount++;
          this.indexingQueue.push(item);
          await new Promise(r => setTimeout(r, 2000 * item.retryCount));
        }
      }
    }

    this.isProcessing = false;
  }

  public static async indexSingleOrder(order: any): Promise<boolean> {
    const orderId = String(order.orderId || order.id || order.orderNumber || 'OP-UNKNOWN');
    const customerName = order.customerName || order.customer?.name || order.userName || 'Customer';
    const customerPhone = order.contactPhone || order.customer?.phone || order.phone || '';
    const branchName = order.branchName || order.restaurantName || order.branch?.name || 'Main Branch';
    const branchId = order.branchId || order.branch_id || 'branch-default';
    const franchiseName = order.franchiseName || order.franchise?.name || 'Olive Pizza';
    const franchiseId = order.franchiseId || order.franchise_id || 'franchise-default';
    const orderDate = order.orderDate || (order.createdAt?.toDate ? order.createdAt.toDate().toISOString().split('T')[0] : (typeof order.createdAt === 'string' ? order.createdAt.split('T')[0] : new Date().toISOString().split('T')[0]));
    const orderTimestamp = order.createdAt?.toMillis ? order.createdAt.toMillis() : Date.now();
    const status = order.status || order.orderStatus || 'delivered';
    const totalAmount = Number(order.totalAmount || order.total || order.finalAmount || 0);
    const paymentMethod = order.paymentMethod || order.payment?.method || 'UPI';

    const items: Array<any> = Array.isArray(order.items) ? order.items.map((it: any) => ({
      name: it.name || it.productName || 'Pizza',
      quantity: it.quantity || 1,
      size: it.size || '',
      crust: it.crust || '',
      customizations: it.customizations || it.toppings || [],
      price: it.price || 0
    })) : [];

    const productNames = items.map(it => it.name).join(', ');

    const payload: OrderEmbeddingPayload = {
      orderId,
      customerName,
      customerPhone,
      branchName,
      franchiseName,
      orderDate,
      status,
      paymentMethod,
      totalAmount,
      items,
      orderNotes: order.orderNotes || order.instructions || ''
    };

    const { vector, text, version } = await OrderEmbeddingService.generateOrderEmbedding(payload);

    const record: ZillizOrderRecord = {
      order_id: orderId,
      vector,
      customer_id: order.userId || order.customerId || '',
      customer_name: customerName,
      customer_phone: customerPhone,
      franchise_id: franchiseId,
      franchise_name: franchiseName,
      branch_id: branchId,
      branch_name: branchName,
      order_date: orderDate,
      order_timestamp: orderTimestamp,
      status,
      total_amount: totalAmount,
      payment_method: paymentMethod,
      product_names: productNames,
      order_text: text,
      embedding_version: version
    };

    const success = await ZillizOrderRepository.upsertOrder(record);
    if (success) {
      console.log('[OrderArchiveIndexer] Indexed order: ' + orderId + ' (' + productNames + ')');
    }
    return success;
  }

  public static async backfillHistoricalOrders(limit = 100): Promise<{ indexed: number; failed: number }> {
    let indexed = 0;
    let failed = 0;

    try {
      console.log('[OrderArchiveIndexer] Starting batch backfill from Firestore (limit: ' + limit + ')...');
      const snapshot = await adminDb.collection('orders').limit(limit).get();

      for (const doc of snapshot.docs) {
        try {
          const data = { id: doc.id, ...doc.data() };
          const ok = await this.indexSingleOrder(data);
          if (ok) indexed++;
          else failed++;
        } catch (e: any) {
          failed++;
        }
      }

      console.log('[OrderArchiveIndexer] Backfill complete: ' + indexed + ' indexed, ' + failed + ' failed');
    } catch (err: any) {
      console.error('[OrderArchiveIndexer] Backfill query failed: ' + err.message);
    }

    return { indexed, failed };
  }
}
