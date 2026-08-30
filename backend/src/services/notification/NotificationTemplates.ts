/**
 * Enterprise Notification Templates — Production v2
 *
 * KEY DESIGN DECISIONS:
 * - Every notification carries: eventId, orderId, currentStatus, previousStatus, version, eventTimestamp, serverTimestamp
 * - Android notification channels are role + priority specific (one sound per channel)
 * - Owner new orders use a SEPARATE notification ID per order (no grouping overwrite)
 * - Delivery assignments use a SEPARATE notification ID per order
 * - Customer tracker uses a SINGLE notification ID per order (live card updated in place)
 * - Sounds: order_alert | delivery_chime | success_ding | cancel_buzz | soft_pop | system_alert | order_confirmed
 *
 * ANDROID CHANNELS:
 *   olive_order_new          — Owner: New Orders    (MAX importance, order_alert sound)
 *   olive_order_status       — Updates              (HIGH importance, soft_pop sound)
 *   olive_order_completed    — Delivered/Cancelled  (HIGH importance, success_ding/cancel_buzz)
 *   olive_delivery_assignment— Delivery assignments (MAX importance, delivery_chime sound)
 *   olive_delivery_updates   — Navigation/progress  (HIGH importance, default)
 *   olive_marketing          — Promotions           (DEFAULT importance, soft_pop)
 *   olive_system             — Alerts               (HIGH importance, system_alert)
 */

import type { OrderEvent, OrderSnapshot } from '../order/OrderEventService.js';
import { generateTrackingToken } from '../../utils/trackingToken.js';

export type OrderStatus =
  | 'pending'
  | 'accepted'
  | 'preparing'
  | 'ready'
  | 'partner_assigned'
  | 'picked_up'
  | 'out_for_delivery'
  | 'delivered'
  | 'completed'
  | 'cancelled';

export type NotificationRole = 'customer' | 'owner' | 'delivery';
export type NotificationPriority = 'critical' | 'high' | 'normal';
export type NotificationCategory =
  | 'order'
  | 'delivery'
  | 'marketing'
  | 'coupon'
  | 'announcement'
  | 'alert'
  | 'reward'
  | 'system'
  | 'alarm_actionable'
  | 'pinned_live';

// ─── Android Channel IDs ──────────────────────────────────────────────────────
export const ANDROID_CHANNELS = {
  ORDER_NEW: 'olive_order_new',
  ORDER_STATUS: 'olive_order_status',
  ORDER_COMPLETED: 'olive_order_completed',
  DELIVERY_ASSIGNMENT: 'olive_delivery_assignment',
  DELIVERY_UPDATES: 'olive_delivery_updates',
  MARKETING: 'olive_marketing',
  SYSTEM: 'olive_system',
} as const;

export type AndroidChannelId = typeof ANDROID_CHANNELS[keyof typeof ANDROID_CHANNELS];

// ─── Sound Mapping ────────────────────────────────────────────────────────────
export const SOUNDS = {
  new_order: 'order_alert',        // Owner new order — distinctive bell
  delivery_assigned: 'delivery_chime',     // Delivery partner — chime
  delivered: 'success_ding',       // Delivered — pleasant success
  cancelled: 'cancel_buzz',        // Cancelled — soft warning
  confirmed: 'order_confirmed',    // Customer order confirmed
  marketing: 'soft_pop',           // Promotions
  system: 'system_alert',       // System alerts
  default: 'default',
} as const;

// ─── Progress Bar (Unicode block characters) ──────────────────────────────────
const PROGRESS_STEPS: Record<OrderStatus, number> = {
  pending: 1, accepted: 2, preparing: 3, ready: 4,
  partner_assigned: 5, picked_up: 6, out_for_delivery: 7,
  delivered: 8, completed: 8, cancelled: 0,
};
const TOTAL_STEPS = 8;
const FILLED = '█';
const EMPTY = '░';

function progressBar(status: OrderStatus): string {
  if (status === 'cancelled') return '✖ Cancelled';
  const step = PROGRESS_STEPS[status] || 0;
  const filled = Math.round((step / TOTAL_STEPS) * 8);
  return FILLED.repeat(filled) + EMPTY.repeat(8 - filled);
}

function progressSteps(status: OrderStatus): string {
  const steps: [OrderStatus, string][] = [
    ['pending', 'Order Placed'],
    ['accepted', 'Confirmed'],
    ['preparing', 'Preparing'],
    ['ready', 'Packed'],
    ['partner_assigned', 'Delivery Assigned'],
    ['out_for_delivery', 'Out for Delivery'],
    ['delivered', 'Delivered'],
  ];
  const currentIdx = PROGRESS_STEPS[status] - 1;
  return steps.map(([s, label], i) => {
    if (i < currentIdx) return `✔ ${label}`;
    if (i === currentIdx) return `🟠 ${label}`;
    return `○ ${label}`;
  }).join('\n');
}

// ─── Brand ────────────────────────────────────────────────────────────────────
const ICON = 'ic_notification'; // Android drawable name
const LOGO = 'https://res.cloudinary.com/dxmlvkff1/image/upload/v1782376898/olive-pizza/brand/logo.png';

// ─── Payload Interface ────────────────────────────────────────────────────────
export interface NotificationPayload {
  notification?: { title: string; body: string; image?: string };
  data: {
    // Synchronization fields — ALL REQUIRED for stale guard
    eventId?: string;
    orderId?: string;
    previousStatus?: string;
    currentStatus?: string;
    version?: string;
    eventTimestamp?: string;
    serverTimestamp?: string;
    // Display
    tag?: string;
    url?: string;
    category?: NotificationCategory;
    priority?: NotificationPriority;
    role?: NotificationRole;
    sound?: string;
    stage?: string;
    // Feature flags
    ongoing?: string;        // 'true' — pinned tracker
    groupKey?: string;       // Android notification group
    notificationId?: string; // Unique ID within a group
    actions?: string;        // JSON serialized actions array
    requireInteraction?: string;
    alert?: string;          // 'continuous' | 'single'
    vibrate?: string;        // JSON serialized number[]
    [key: string]: string | undefined;
  };
  android?: {
    priority: 'normal' | 'high';
    collapseKey?: string;
    notification?: {
      title?: string;
      body?: string;
      sound?: string;
      channelId?: string;
      tag?: string;
      icon?: string;
      clickAction?: string;
      defaultVibrateTimings?: boolean;
      defaultSound?: boolean;
      vibrateTimingsMillis?: number[];
      notificationPriority?: 'PRIORITY_MIN' | 'PRIORITY_LOW' | 'PRIORITY_DEFAULT' | 'PRIORITY_HIGH' | 'PRIORITY_MAX';
      notificationCount?: number;
    };
  };
  apns?: {
    headers?: { 'apns-priority'?: string; 'apns-collapse-id'?: string };
    payload?: {
      aps: {
        alert?: { title?: string; body?: string };
        sound?: string;
        badge?: number;
        'mutable-content'?: number;
        'content-available'?: number;
      };
    };
  };
  webpush?: {
    headers?: { Urgency?: string; TTL?: string };
    notification?: {
      icon?: string;
      badge?: string;
      tag?: string;
      renotify?: boolean;
      requireInteraction?: boolean;
      silent?: boolean;
      vibrate?: number[];
      actions?: Array<{ action: string; title: string; icon?: string }>;
      data?: Record<string, unknown>;
    };
    fcm_options?: { link?: string };
  };
}

// ─── Base Builder ─────────────────────────────────────────────────────────────
interface BuildOptions {
  tag: string;
  channelId: AndroidChannelId;
  orderId?: string;
  url?: string;
  sound?: keyof typeof SOUNDS;
  category?: NotificationCategory;
  priority?: NotificationPriority;
  role?: NotificationRole;
  requireInteraction?: boolean;
  actions?: Array<{ action: string; title: string }>;
  stage?: string;
  version?: number;
  alert?: 'continuous' | 'single';
  notificationId?: string;
  vibrate?: number[];
  ongoing?: boolean;
  groupKey?: string;
  // Custom action & branch fields
  actionUrlAccept?: string;
  actionUrlReject?: string;
  branchId?: string;
  // Sync fields from OrderEvent
  eventId?: string;
  previousStatus?: string;
  currentStatus?: string;
  eventTimestamp?: string;
  serverTimestamp?: string;
}

function buildPayload(title: string, body: string, opts: BuildOptions): NotificationPayload {
  const soundKey = opts.sound || 'default';
  const soundFile = SOUNDS[soundKey as keyof typeof SOUNDS] || 'default';
  const isHigh = opts.priority === 'critical' || opts.priority === 'high';

  const safeData: Record<string, string> = {
    title,
    body,
    url: opts.url || '/',
    category: opts.category || 'order',
    priority: opts.priority || 'normal',
    sound: soundFile,
    version: String(opts.version || 1),
    tag: opts.tag,
  };

  // Synchronization fields
  if (opts.eventId) safeData.eventId = opts.eventId;
  if (opts.orderId) safeData.orderId = opts.orderId;
  if (opts.previousStatus) safeData.previousStatus = opts.previousStatus;
  if (opts.currentStatus) safeData.currentStatus = opts.currentStatus;
  if (opts.eventTimestamp) safeData.eventTimestamp = opts.eventTimestamp;
  if (opts.serverTimestamp) safeData.serverTimestamp = opts.serverTimestamp;

  // Custom action & branch fields
  if (opts.channelId) safeData.channelId = opts.channelId;
  if (opts.actionUrlAccept) safeData.actionUrlAccept = opts.actionUrlAccept;
  if (opts.actionUrlReject) safeData.actionUrlReject = opts.actionUrlReject;
  if (opts.branchId) safeData.branchId = opts.branchId;

  // Feature flags
  if (opts.role) safeData.role = opts.role;
  if (opts.alert) safeData.alert = opts.alert;
  if (opts.stage) safeData.stage = opts.stage;
  if (opts.notificationId) safeData.notificationId = opts.notificationId;
  if (opts.groupKey) safeData.groupKey = opts.groupKey;
  if (opts.ongoing) safeData.ongoing = 'true';
  if (opts.requireInteraction) safeData.requireInteraction = 'true';
  if (opts.actions) safeData.actions = JSON.stringify(opts.actions);
  if (opts.vibrate) safeData.vibrate = JSON.stringify(opts.vibrate);

  const basePayload: any = {
    data: safeData,
    android: {
      priority: isHigh ? 'high' : 'normal',
      collapseKey: opts.ongoing ? opts.tag : undefined, // Live card collapse
    },
  };

  // ── ROOT CAUSE FIX: DATA-ONLY FOR ALARMS AND PINNED LIVE TRACKERS ────────
  // When a root notification block is present and the app is backgrounded, Android intercepts the message 
  // and posts a generic system tray notification, entirely skipping our onMessageReceived() handler.
  // By omitting the root notification block for these specific categories, we force a pure data message,
  // which forces Android to wake the app and invoke onMessageReceived(), allowing our custom code to construct the UI.
  if (opts.category !== 'alarm_actionable' && opts.category !== 'pinned_live') {
    basePayload.notification = { title, body };
  }

    // For continuous alarms, use a dedicated clickAction so the system-tray tap
    // launches AlarmActivity (full-screen alarm) instead of MainActivity.
    const clickAction =
      opts.alert === 'continuous'
        ? 'olive_alarm'                       // → AlarmActivity (full-screen alarm)
        : opts.role === 'owner' ? 'owner_order_actions'
          : opts.role === 'delivery' ? 'delivery_actions'
            : 'customer_order_actions';
    basePayload.android.notification = {
      sound: soundFile,
      channelId: opts.channelId,
      tag: opts.tag,
      icon: ICON,
      clickAction,
      defaultVibrateTimings: !opts.vibrate,
      vibrateTimingsMillis: opts.vibrate,
      notificationPriority: opts.priority === 'critical' ? 'PRIORITY_MAX'
        : opts.priority === 'high' ? 'PRIORITY_HIGH' : 'PRIORITY_DEFAULT',
      // For continuous alarms, mark as high-priority so the system tray notification
      // surfaces immediately (heads-up) even in background/killed scenarios.
      ...(opts.alert === 'continuous' ? { notificationCount: 1 } : {}),
    };

  const apnsHeaders: Record<string, string> = {
    'apns-priority': isHigh ? '10' : '5',
  };
  if (opts.ongoing && opts.tag) {
    apnsHeaders['apns-collapse-id'] = String(opts.tag);
  }

  return {
    ...basePayload,
    apns: {
      headers: apnsHeaders,
      payload: {
        aps: {
          alert: { title, body },
          sound: soundFile,
          badge: 1,
          'mutable-content': 1,
        },
      },
    },
    webpush: {
      headers: { Urgency: isHigh ? 'high' : 'normal', TTL: '3600' },
      notification: {
        icon: LOGO,
        tag: opts.tag,
        renotify: true,
        requireInteraction: opts.requireInteraction,
        vibrate: opts.vibrate || [200, 100, 200],
        actions: opts.actions,
        data: {
          url: opts.url || '/',
          orderId: opts.orderId,
          sound: soundFile,
        },
      },
      fcm_options: { link: opts.url || '/' },
    },
  };
}

// ─── iOS ActivityKit Live Activity Payload Builder ─────────────────────────
export function buildLiveActivityPayload(
  orderId: string,
  state: {
    event: 'start' | 'update' | 'end';
    status: OrderStatus;
    step: number;
    orderNumber: string;
    itemsSummary: string;
    totalAmount: number;
    etaMinutes?: number;
    riderName?: string;
    riderPhone?: string;
    restaurantName?: string;
    dismissalDate?: number; // Epoch timestamp in seconds for 'end'
  }
): NotificationPayload {
  const isEnd = state.event === 'end';
  return {
    notification: undefined, // Live Activities do not use top-level notification alerts
    data: {
      orderId,
      orderNumber: state.orderNumber,
      status: state.status,
      step: String(state.step),
      etaMinutes: String(state.etaMinutes || 0),
      totalAmount: String(state.totalAmount),
      isLiveActivity: 'true',
      activityEvent: state.event
    },
    apns: {
      headers: {
        'apns-push-type': 'liveactivity',
        'apns-priority': '10',
        'apns-topic': 'com.olivepizza.app.push-type.liveactivity'
      },
      payload: {
        aps: {
          timestamp: Math.floor(Date.now() / 1000),
          event: state.event,
          'dismissal-date': isEnd ? (state.dismissalDate || Math.floor(Date.now() / 1000) + 300) : undefined,
          'content-state': {
            orderNumber: state.orderNumber,
            status: state.status,
            step: state.step,
            itemsSummary: state.itemsSummary,
            totalAmount: state.totalAmount,
            etaMinutes: state.etaMinutes || 0,
            riderName: state.riderName || '',
            riderPhone: state.riderPhone || '',
            restaurantName: state.restaurantName || 'Olive Pizza',
            updatedAt: new Date().toISOString()
          }
        }
      }
    }
  };
}

// =============================================================================
// RESTAURANT MANAGEMENT TEMPLATES (Actionable Push for Branch Managers)
// =============================================================================
export class RestaurantTemplates {
  /**
   * New Order for Restaurant Management — with REAL actionable buttons: [ ACCEPT ] [ REJECT ]
   * Features: customer name, masked phone, product image thumbnail, item customizations,
   * financial breakdown (subtotal, offers, taxes, total), payment method/status.
   */
  static newOrder(
    orderId: string,
    payload: {
      customerName: string;
      orderNumber: string;
      totalAmount: number;
      items: Array<{
        name: string;
        quantity: number;
        size?: string;
        crust?: string;
        customizations?: string[];
        image?: string;
      }> | string[];
      paymentMethod: string;
      paymentStatus?: string;
      deliveryAddress?: string;
      phone?: string;
      orderTime?: string;
      branchId?: string;
      version?: number;
      productImageThumbnail?: string;
      financials?: {
        subtotal?: number;
        discount?: number;
        deliveryFee?: number;
        gst?: number;
        total?: number;
      };
    }
  ): NotificationPayload {
    // Format item strings and extract first image
    let itemStrings: string[] = [];
    let firstImage = payload.productImageThumbnail || '';

    if (Array.isArray(payload.items)) {
      itemStrings = payload.items.map(item => {
        if (typeof item === 'string') return item;
        if (!firstImage && item.image) firstImage = item.image;
        const customPart = item.customizations && item.customizations.length > 0 ? ` (+${item.customizations.join(', ')})` : '';
        const crustPart = item.crust ? ` [${item.crust}]` : '';
        const sizePart = item.size ? ` ${item.size}` : '';
        return `${item.quantity}× ${item.name}${sizePart}${crustPart}${customPart}`;
      });
    }

    // Mask phone number (e.g., 9179944445 -> ••••••••45)
    let maskedPhone = payload.phone || '';
    if (maskedPhone && maskedPhone.length >= 4) {
      maskedPhone = '••••••••' + maskedPhone.slice(-2);
    }

    const title = `🍕 NEW ORDER #${payload.orderNumber} • ₹${payload.totalAmount}`;
    const itemsPreview = itemStrings.slice(0, 3).join('\n• ');
    const itemsMore = itemStrings.length > 3 ? `\n... and ${itemStrings.length - 3} more items` : '';

    const bodyLines = [
      `Customer: ${payload.customerName}${maskedPhone ? ` (${maskedPhone})` : ''}`,
      `Items:\n• ${itemsPreview}${itemsMore}`,
      `Payment: ${payload.paymentMethod?.toUpperCase()} (${payload.paymentStatus || 'PENDING'})`,
      payload.deliveryAddress ? `📍 ${payload.deliveryAddress}` : ''
    ].filter(Boolean);

    const body = bodyLines.join('\n');

    return buildPayload(title, body, {
      tag: `order_restaurant_${orderId}`,
      channelId: ANDROID_CHANNELS.ORDER_NEW,
      orderId,
      url: `/restaurant/live-orders`,
      sound: 'new_order',
      category: 'alarm_actionable' as any,
      priority: 'critical',
      role: 'restaurant_manager' as any,
      requireInteraction: true,
      stage: 'new_order',
      alert: 'continuous',
      version: payload.version || 1,
      notificationId: `rest_new_${orderId}`,
      vibrate: [300, 200, 300, 200, 300],
      actions: [
        { action: 'ACCEPT', title: 'ACCEPT' },
        { action: 'REJECT', title: 'REJECT' },
      ],
      currentStatus: 'pending',
      serverTimestamp: new Date().toISOString(),
      actionUrlAccept: `/api/orders/${orderId}/accept`,
      actionUrlReject: `/api/orders/${orderId}/reject`,
      branchId: payload.branchId || 'main_branch'
    });
  }
}

// =============================================================================
// OWNER TEMPLATES
// =============================================================================
export class OwnerTemplates {

  /**
   * New Order — CRITICAL wake-up.
   * Each order gets its OWN notification tag (never collapses with another order).
   */
  static newOrder(
    orderId: string,
    payload: {
      customerName: string;
      orderNumber: string;
      totalAmount: number;
      items: string[];
      paymentMethod: string;
      deliveryAddress: string;
      phone?: string;
      distance?: string;
      orderTime: string;
      version?: number;
      notificationId?: string;
      // Sync fields
      eventId?: string;
      previousStatus?: string;
      eventTimestamp?: string;
    }
  ): NotificationPayload {
    const title = `🍕 New Order Received`;
    const body = [
      `Order #${payload.orderNumber}`,
      `Customer:\n${payload.customerName}`,
      `Phone:\n${payload.phone || 'N/A'}`,
      `Delivery Address:\n${payload.deliveryAddress}`,
      `Items:\n${payload.items.slice(0, 5).map(item => `• ${item}`).join('\n')}${payload.items.length > 5 ? `\n• ... and ${payload.items.length - 5} more` : ''}`,
      `Total:\n₹${payload.totalAmount}`,
      `Payment:\n${payload.paymentMethod}`,
      payload.distance ? `Estimated Distance:\n${payload.distance}` : '',
      `Order Time:\n${payload.orderTime}`,
    ].filter(Boolean).join('\n\n');

    return buildPayload(title, body, {
      tag: `order_owner_${orderId}`,
      channelId: ANDROID_CHANNELS.ORDER_NEW,
      orderId,
      url: `/owner/orders`,
      sound: 'new_order',
      category: 'alarm_actionable' as any,
      priority: 'critical',
      role: 'owner',
      requireInteraction: true,
      stage: 'new_order',
      alert: 'continuous',
      version: payload.version || 1,
      notificationId: `owner_new_${orderId}`, // Unique per order
      groupKey: 'owner_orders',               // Groups multiple orders
      vibrate: [300, 200, 300, 200, 300],
      actions: [
        { action: 'accept', title: '✅ Accept' },
        { action: 'reject', title: '❌ Reject' },
        { action: 'stop_alert', title: '🔕 Stop Alert' },
      ],
      eventId: payload.eventId,
      previousStatus: payload.previousStatus,
      currentStatus: 'pending',
      eventTimestamp: payload.eventTimestamp,
      serverTimestamp: new Date().toISOString(),
    });
  }

  /** Live Order Status Update — updates the same notification in-place */
  static orderStatusUpdate(
    orderId: string,
    payload: {
      orderNumber: string;
      customerName: string;
      status: OrderStatus;
      eta?: string;
      deliveryPartnerName?: string;
      totalAmount: number;
      version?: number;
      notificationId?: string;
      eventId?: string;
      previousStatus?: string;
      eventTimestamp?: string;
    }
  ): NotificationPayload {
    const statusLabels: Record<OrderStatus, string> = {
      pending: '⏳ Pending', accepted: '✅ Accepted', preparing: '🔥 Preparing',
      ready: '🟢 Ready', partner_assigned: '🚴 Partner Assigned', picked_up: '📦 Picked Up',
      out_for_delivery: '🛵 Out for Delivery', delivered: '✅ Delivered',
      completed: '🏁 Completed', cancelled: '❌ Cancelled',
    };

    const isCompleted = payload.status === 'delivered' || payload.status === 'completed';
    const isCancelled = payload.status === 'cancelled';

    const title = `${statusLabels[payload.status]} • #${payload.orderNumber}`;
    const body = [
      `${payload.customerName} • ₹${payload.totalAmount}`,
      payload.eta ? `ETA: ${payload.eta}` : '',
      payload.deliveryPartnerName ? `Partner: ${payload.deliveryPartnerName}` : '',
      progressBar(payload.status),
    ].filter(Boolean).join('\n');

    const actions: Array<{ action: string; title: string }> =
      payload.status === 'preparing'
        ? [{ action: 'ready', title: '🟢 Mark Ready' }, { action: 'assign_delivery', title: '🚴 Assign Partner' }, { action: 'open', title: '📊 View' }]
        : payload.status === 'ready'
          ? [{ action: 'assign_delivery', title: '🚴 Assign Partner' }, { action: 'open', title: '📊 View' }]
          : [{ action: 'open', title: '📊 Open Dashboard' }];

    return buildPayload(title, body, {
      tag: `order_owner_${orderId}`,
      channelId: isCompleted ? ANDROID_CHANNELS.ORDER_COMPLETED
        : isCancelled ? ANDROID_CHANNELS.ORDER_COMPLETED
          : ANDROID_CHANNELS.ORDER_STATUS,
      orderId,
      url: `/owner/orders`,
      sound: isCompleted ? 'delivered' : isCancelled ? 'cancelled' : undefined,
      category: 'order',
      priority: isCompleted || isCancelled ? 'high' : 'normal',
      role: 'owner',
      requireInteraction: !isCompleted && !isCancelled,
      stage: payload.status,
      version: payload.version,
      notificationId: `owner_status_${orderId}`,
      groupKey: 'owner_orders',
      actions,
      eventId: payload.eventId,
      previousStatus: payload.previousStatus,
      currentStatus: payload.status,
      eventTimestamp: payload.eventTimestamp,
      serverTimestamp: new Date().toISOString(),
    });
  }
}

// =============================================================================
// DELIVERY PARTNER TEMPLATES
// =============================================================================
export class DeliveryTemplates {

  /** New delivery assignment — CRITICAL, each order has its own notification */
  static newAssignment(
    orderId: string,
    payload: {
      orderNumber: string;
      customerName: string;
      customerPhone: string;
      deliveryAddress: string;
      distance: string;
      eta: string;
      totalAmount: number;
      paymentMethod: string;
      version?: number;
      notificationId?: string;
      eventId?: string;
      previousStatus?: string;
      eventTimestamp?: string;
    }
  ): NotificationPayload {
    const title = `📦 New Delivery • ${payload.distance}`;
    const body = [
      `#${payload.orderNumber} — ${payload.customerName}`,
      `₹${payload.totalAmount} • ${payload.paymentMethod}`,
      `📍 ${payload.deliveryAddress}`,
      `⏱ ETA: ${payload.eta}`,
    ].join('\n');

    return buildPayload(title, body, {
      tag: `order_delivery_${orderId}`,
      channelId: ANDROID_CHANNELS.DELIVERY_ASSIGNMENT,
      orderId,
      url: `/delivery/dashboard`,
      sound: 'delivery_assigned',
      category: 'alarm_actionable' as any,
      priority: 'critical',
      role: 'delivery',
      requireInteraction: true,
      stage: 'delivery_assigned',
      alert: 'continuous',
      version: payload.version || 1,
      notificationId: `delivery_assign_${orderId}`,
      vibrate: [200, 100, 200, 100, 400],
      actions: [
        { action: 'ACCEPT', title: 'ACCEPT' },
        { action: 'DECLINE', title: 'DECLINE' },
      ],
      actionUrlAccept: `/api/delivery/rider/orders/${orderId}/accept`,
      actionUrlReject: `/api/delivery/rider/orders/${orderId}/decline`,
      eventId: payload.eventId,
      previousStatus: payload.previousStatus,
      currentStatus: 'partner_assigned',
      eventTimestamp: payload.eventTimestamp,
      serverTimestamp: new Date().toISOString(),
    });
  }

  /** Live delivery status update — updates the same notification in-place */
  static deliveryUpdate(
    orderId: string,
    payload: {
      orderNumber: string;
      customerName: string;
      deliveryAddress: string;
      stage: 'navigate_restaurant' | 'arrived_restaurant' | 'picked_up' | 'out_for_delivery' | 'arrived_customer' | 'delivered';
      eta?: string;
      version?: number;
      notificationId?: string;
      eventId?: string;
      previousStatus?: string;
      eventTimestamp?: string;
    }
  ): NotificationPayload {
    const stageConfig: Record<string, { title: string; actions: Array<{ action: string; title: string }> }> = {
      navigate_restaurant: { title: '📍 Navigate to Restaurant', actions: [{ action: 'arrived_restaurant', title: '✅ Arrived' }] },
      arrived_restaurant: { title: '🍕 At Restaurant — Pick Up Order', actions: [{ action: 'picked_up', title: '📦 Picked Up' }] },
      picked_up: { title: '🚴 Order Picked Up', actions: [{ action: 'call_customer', title: '📞 Call' }, { action: 'navigate_customer', title: '🗺️ Navigate' }] },
      out_for_delivery: { title: `🛵 Delivering to ${payload.customerName}`, actions: [{ action: 'arrived_customer', title: '📍 Arrived' }, { action: 'call_customer', title: '📞 Call' }] },
      arrived_customer: { title: '🏁 Arrived at Customer', actions: [{ action: 'delivered', title: '✅ Delivered' }, { action: 'report_issue', title: '⚠️ Issue' }] },
      delivered: { title: '🎉 Delivery Complete', actions: [] },
    };

    const config = stageConfig[payload.stage] || stageConfig.navigate_restaurant;
    const isComplete = payload.stage === 'delivered';
    const body = [
      `#${payload.orderNumber} — ${payload.deliveryAddress}`,
      payload.eta ? `ETA: ${payload.eta}` : '',
    ].filter(Boolean).join('\n');

    return buildPayload(config.title, body, {
      tag: `order_delivery_${orderId}`,
      channelId: isComplete ? ANDROID_CHANNELS.ORDER_COMPLETED : ANDROID_CHANNELS.DELIVERY_UPDATES,
      orderId,
      url: `/delivery/dashboard`,
      sound: isComplete ? 'delivered' : undefined,
      category: 'delivery',
      priority: 'high',
      role: 'delivery',
      requireInteraction: !isComplete,
      stage: payload.stage,
      version: payload.version,
      notificationId: `delivery_update_${orderId}`,
      actions: config.actions,
      eventId: payload.eventId,
      previousStatus: payload.previousStatus,
      currentStatus: payload.stage === 'delivered' ? 'delivered' : 'out_for_delivery',
      eventTimestamp: payload.eventTimestamp,
      serverTimestamp: new Date().toISOString(),
    });
  }
}

// =============================================================================
// CUSTOMER TEMPLATES
// =============================================================================
export class CustomerTemplates {
  /**
   * Generic informational notification
   */
  static informational(title: string, body: string, url: string = '/'): NotificationPayload {
    return buildPayload(title, body, {
      priority: 'high',
      url,
      sound: 'default',
      tag: 'informational',
      channelId: ANDROID_CHANNELS.SYSTEM
    });
  }

  /**
   * Live order tracker — ONE notification per order, updated in-place.
   * Uses `ongoing: true` for Android pinned notification.
   */
  static orderUpdate(
    orderId: string,
    payload: {
      orderNumber: string;
      status: OrderStatus;
      eta?: string;
      deliveryPartnerName?: string;
      totalAmount: number;
      version?: number;
      notificationId?: string;
      eventId?: string;
      previousStatus?: string;
      eventTimestamp?: string;
      cancellationReason?: string;
    }
  ): NotificationPayload {
    const statusConfig: Record<OrderStatus, {
      title: string; body: string;
      sound?: keyof typeof SOUNDS;
      requireInteraction?: boolean;
      ongoing?: boolean;
    }> = {
      pending: {
        title: `🍕 Order Placed — #${payload.orderNumber}`,
        body: `₹${payload.totalAmount} • Waiting for restaurant confirmation\n${progressBar('pending')}\n${progressSteps('pending')}`,
        ongoing: true,
      },
      accepted: {
        title: `✅ Order Confirmed — #${payload.orderNumber}`,
        body: `Kitchen is preparing your order${payload.eta ? ` • ETA: ${payload.eta}` : ''}\n${progressBar('accepted')}\n${progressSteps('accepted')}`,
        sound: 'confirmed',
        ongoing: true,
      },
      preparing: {
        title: `🔥 Your Pizza Is Being Made!`,
        body: `Order #${payload.orderNumber}${payload.eta ? ` • Est. ${payload.eta}` : ''}\n${progressBar('preparing')}\n${progressSteps('preparing')}`,
        ongoing: true,
      },
      ready: {
        title: `🟢 Order Packed & Ready!`,
        body: `#${payload.orderNumber} • Looking for your delivery partner\n${progressBar('ready')}\n${progressSteps('ready')}`,
        ongoing: true,
      },
      partner_assigned: {
        title: `🚴 Delivery Partner Assigned`,
        body: `${payload.deliveryPartnerName || 'Partner'} is on the way to the restaurant\n${progressBar('partner_assigned')}\n${progressSteps('partner_assigned')}`,
        ongoing: true,
      },
      picked_up: {
        title: `📦 Order Picked Up`,
        body: `${payload.deliveryPartnerName || 'Partner'} has your order and is heading your way\n${progressBar('picked_up')}\n${progressSteps('picked_up')}`,
        ongoing: true,
      },
      out_for_delivery: {
        title: `🛵 Out for Delivery!`,
        body: [
          `${payload.deliveryPartnerName || 'Your partner'} is heading your way`,
          payload.eta ? `Arriving in ~${payload.eta}` : '',
          progressBar('out_for_delivery'),
          progressSteps('out_for_delivery'),
        ].filter(Boolean).join('\n'),
        sound: 'delivery_assigned',
        ongoing: true,
      },
      delivered: {
        title: `✅ Delivered! Enjoy your pizza 🍕`,
        body: `Order #${payload.orderNumber} delivered. Rate your experience!\n${progressBar('delivered')}`,
        sound: 'delivered',
        requireInteraction: true,
        ongoing: false, // Unpin on delivery per spec — no longer ongoing after delivered
      },
      completed: {
        title: `🏁 Order Completed`,
        body: `Thank you for choosing Olive Pizza! See you again soon.`,
        ongoing: true,
      },
      cancelled: {
        title: `❌ Order Cancelled — #${payload.orderNumber}`,
        body: payload.cancellationReason
          ? `Your order was cancelled: ${payload.cancellationReason}. Contact us if you need help.`
          : `Your order has been cancelled. Contact us if you need help.`,
        sound: 'cancelled',
        ongoing: true,
      },
    };

    const cfg = statusConfig[payload.status];
    const isTerminal = payload.status === 'delivered' || payload.status === 'completed' || payload.status === 'cancelled';
    const isDelivered = payload.status === 'delivered';
    const isCancelled = payload.status === 'cancelled';

    const actions: Array<{ action: string; title: string }> =
      payload.status === 'out_for_delivery' || payload.status === 'partner_assigned'
        ? [{ action: 'track', title: '📍 Track Order' }, { action: 'call_partner', title: '📞 Call Partner' }]
        : isDelivered
          ? [{ action: 'rate', title: '⭐ Rate Order' }, { action: 'reorder', title: '🔄 Reorder' }]
          : [{ action: 'open', title: '📍 Track Order' }];

    // Generate a signed expiring tracking token so the push notification
    // deep-link URL works for unauthenticated/background-closed-app scenarios.
    // The OrderTracking page accepts EITHER a valid token OR an authenticated
    // user session (customer/owner/delivery_partner) — so logged-in users are
    // never broken and unauthenticated deep links remain secure.
    const trackingToken = generateTrackingToken(orderId);
    const trackingUrl = `/order-tracking/${orderId}?trackingToken=${trackingToken}`;

    return buildPayload(cfg.title, cfg.body, {
      tag: `order_customer_${orderId}`,      // Same tag throughout — updates in place
      channelId: isDelivered ? ANDROID_CHANNELS.ORDER_COMPLETED
        : isCancelled ? ANDROID_CHANNELS.ORDER_COMPLETED
          : ANDROID_CHANNELS.ORDER_STATUS,
      orderId,
      url: trackingUrl,
      sound: cfg.sound,
      category: (isTerminal ? 'simple_informational' : 'pinned_live') as any,
      priority: isTerminal ? 'high' : 'normal',
      role: 'customer',
      requireInteraction: cfg.requireInteraction,
      stage: payload.status,
      version: payload.version,
      notificationId: `customer_tracker_${orderId}`, // Same ID throughout
      ongoing: cfg.ongoing,
      actions,
      eventId: payload.eventId,
      previousStatus: payload.previousStatus,
      currentStatus: payload.status,
      eventTimestamp: payload.eventTimestamp,
      serverTimestamp: new Date().toISOString(),
    });
  }
}

// =============================================================================
// MARKETING & SYSTEM TEMPLATES
// =============================================================================
export class MarketingTemplates {

  static couponAlert(payload: { title: string; body: string; couponCode: string; expiryDate: string }): NotificationPayload {
    return buildPayload(`🎟️ ${payload.title}`, `${payload.body}\nCode: ${payload.couponCode} • Expires: ${payload.expiryDate}`, {
      tag: `coupon_${payload.couponCode}`,
      channelId: ANDROID_CHANNELS.MARKETING,
      url: '/menu',
      sound: 'marketing',
      category: 'coupon',
      priority: 'high',
      actions: [{ action: 'use_coupon', title: '🛍️ Order Now' }],
    });
  }

  static announcement(payload: { title: string; body: string; url?: string }): NotificationPayload {
    return buildPayload(`📢 ${payload.title}`, payload.body, {
      tag: `announcement_${Date.now()}`,
      channelId: ANDROID_CHANNELS.MARKETING,
      url: payload.url || '/',
      sound: 'marketing',
      category: 'announcement',
      priority: 'normal',
      actions: [{ action: 'open', title: '📖 Read More' }],
    });
  }

  static rewardEarned(payload: { customerName: string; points: number; message: string }): NotificationPayload {
    return buildPayload(`🏆 ${payload.points} Points Earned!`, payload.message, {
      tag: `reward_${Date.now()}`,
      channelId: ANDROID_CHANNELS.ORDER_COMPLETED,
      url: '/dashboard',
      sound: 'delivered',
      category: 'reward',
      priority: 'high',
    });
  }

  static systemAlert(payload: { title: string; body: string }): NotificationPayload {
    return buildPayload(payload.title, payload.body, {
      tag: `system_${Date.now()}`,
      channelId: ANDROID_CHANNELS.SYSTEM,
      url: '/',
      sound: 'system',
      category: 'system',
      priority: 'high',
    });
  }
}
