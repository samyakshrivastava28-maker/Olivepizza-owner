/**
 * AppEventBus — Internal Backend Event Bus
 *
 * Decouples domain events from notification, email, analytics, and Slack consumers.
 * Routes should emit events here instead of calling notification code directly.
 *
 * Usage:
 *   import { appEventBus } from './AppEventBus.js';
 *   appEventBus.emit('order.created', { orderId, ...data });
 *
 * Subscribers:
 *   appEventBus.on('order.created', handler);
 */

import { EventEmitter } from 'events';

export interface OrderCreatedEvent {
  orderId: string;
  orderNumber: string;
  userId: string;
  customerName: string;
  totalAmount: number;
  items: any[];
  paymentMethod: string;
  deliveryAddress: string;
  contactPhone: string;
  orderTiming?: string;
  timestamp: string;
  rawOrderData: any;
}

export interface OrderStatusChangedEvent {
  orderId: string;
  orderNumber: string;
  userId: string;
  customerName: string;
  previousStatus: string;
  currentStatus: string;
  totalAmount: number;
  deliveryPartnerId?: string;
  deliveryPartnerName?: string;
  slackThreadTs?: string;
  timestamp: string;
  rawOrderData: any;
}

export interface OrderEventMap {
  'order.created': OrderCreatedEvent;
  'order.status_changed': OrderStatusChangedEvent;
}

class AppEventBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(30); // Allow multiple subscribers without warnings
    console.log('[AppEventBus] Initialized — internal backend event bus ready');
  }

  /** Type-safe emit for order domain events */
  emitTyped<K extends keyof OrderEventMap>(event: K, data: OrderEventMap[K]): boolean {
    return this.emit(event, data);
  }

  /** Type-safe on for order domain events */
  onTyped<K extends keyof OrderEventMap>(event: K, handler: (data: OrderEventMap[K]) => void): this {
    return this.on(event, handler);
  }
}

export const appEventBus = new AppEventBus();
