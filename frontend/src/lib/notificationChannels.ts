/**
 * Android Notification Channel Configuration
 *
 * Defines all 7 channels with correct importance, sound, vibration, and LED settings.
 * Channels are created once at app startup on Android.
 *
 * SOUND FILE REPLACEMENT:
 *   All 7 sound files are in: android/app/src/main/res/raw/
 *   To use your branded audio:
 *   1. Place your .mp3 or .ogg file in that directory (e.g. order_alert.mp3)
 *   2. Keep the exact same filename — no code changes needed.
 *   3. Uninstall and reinstall the app (Android caches channel sounds at creation time)
 *
 * IMPORTANT: On Android, each channel is bound to exactly one sound (set at channel creation).
 * Changing a sound after channel creation requires the user to manually reset it in Settings.
 * Therefore, we use separate channels for separate sounds.
 *
 * ANDROID CHANNELS:
 *   olive_order_new          — Owner: New Orders    (MAX importance, order_alert sound)
 *   olive_order_status       — Updates              (HIGH importance, soft_pop sound)
 *   olive_order_completed    — Delivered/Cancelled  (HIGH importance, success_ding sound)
 *   olive_delivery_assignment— Delivery assignments (MAX importance, delivery_chime sound)
 *   olive_delivery_updates   — Navigation/progress  (HIGH importance, default)
 *   olive_marketing          — Promotions           (DEFAULT importance, soft_pop)
 *   olive_system             — Alerts               (HIGH importance, system_alert)
 */

import type { Channel } from '@capacitor/push-notifications';

// Importance levels (Android)
const IMPORTANCE_MAX     = 5; // Heads-up notification, makes sound, interrupts, wakes screen
const IMPORTANCE_HIGH    = 4; // Makes sound, does not interrupt
const IMPORTANCE_DEFAULT = 3; // Makes sound
const IMPORTANCE_LOW     = 2; // No sound

// Visibility
const VISIBILITY_PUBLIC  =  1; // Shown on lock screen in full
const VISIBILITY_PRIVATE =  0; // Hidden on lock screen (default for sensitive data)

export const NOTIFICATION_CHANNELS: Channel[] = [
  // ─── Owner: New Order arrives — MAXIMUM importance, wakes device ─────────
  {
    id: 'olive_order_new',
    name: 'New Orders',
    description: 'Critical alerts for new incoming orders. Wakes the device.',
    importance: IMPORTANCE_MAX,
    visibility: VISIBILITY_PUBLIC,
    vibration: true,
    sound: 'order_alert', // maps to android/app/src/main/res/raw/order_alert.mp3
  },

  // ─── Order Status Updates (preparing, ready, etc.) — HIGH importance ────
  {
    id: 'olive_order_status',
    name: 'Order Status Updates',
    description: 'Order progress notifications (preparing, packed, etc.)',
    importance: IMPORTANCE_HIGH,
    visibility: VISIBILITY_PUBLIC,
    vibration: true,
    sound: 'soft_pop', // maps to android/app/src/main/res/raw/soft_pop.mp3
  },

  // ─── Delivered or Cancelled — HIGH importance ────────────────────────────
  {
    id: 'olive_order_completed',
    name: 'Order Completed / Cancelled',
    description: 'Notifications when an order is delivered or cancelled',
    importance: IMPORTANCE_HIGH,
    visibility: VISIBILITY_PUBLIC,
    vibration: true,
    sound: 'success_ding', // maps to android/app/src/main/res/raw/success_ding.mp3
  },

  // ─── Delivery partner: new assignment — MAXIMUM importance ───────────────
  {
    id: 'olive_delivery_assignment',
    name: 'Delivery Assignments',
    description: 'Critical new delivery assignment alerts. Wakes the device.',
    importance: IMPORTANCE_MAX,
    visibility: VISIBILITY_PUBLIC,
    vibration: true,
    sound: 'delivery_chime', // maps to android/app/src/main/res/raw/delivery_chime.mp3
  },

  // ─── Delivery partner: navigation / progress — HIGH importance ──────────
  {
    id: 'olive_delivery_updates',
    name: 'Delivery Updates',
    description: 'Delivery navigation and progress updates',
    importance: IMPORTANCE_HIGH,
    visibility: VISIBILITY_PUBLIC,
    vibration: false,
    // No custom sound — uses system default for navigation-style updates
  },

  // ─── Marketing: promotions, coupons — DEFAULT importance ─────────────────
  {
    id: 'olive_marketing',
    name: 'Promotions & Offers',
    description: 'Promotional notifications, coupons, and announcements',
    importance: IMPORTANCE_DEFAULT,
    visibility: VISIBILITY_PRIVATE,
    vibration: false,
    sound: 'soft_pop', // maps to android/app/src/main/res/raw/soft_pop.mp3
  },

  // ─── System alerts — HIGH importance ─────────────────────────────────────
  {
    id: 'olive_system',
    name: 'System Alerts',
    description: 'Critical system alerts and account updates',
    importance: IMPORTANCE_HIGH,
    visibility: VISIBILITY_PUBLIC,
    vibration: true,
    sound: 'system_alert', // maps to android/app/src/main/res/raw/system_alert.mp3
  },
];

/**
 * Action types for native notification action buttons.
 * Each type corresponds to an FCM clickAction value.
 */
export const NOTIFICATION_ACTION_TYPES = [
  {
    id: 'owner_order_actions',
    actions: [
      { id: 'accept',     title: 'Accept',     foreground: true  },
      { id: 'reject',     title: 'Reject',     destructive: true },
      { id: 'view',       title: 'View Order', foreground: true  },
    ],
  },
  {
    id: 'customer_order_actions',
    actions: [
      { id: 'track',    title: 'Track Order',  foreground: true },
      { id: 'rate',     title: 'Rate Order',   foreground: true },
      { id: 'reorder',  title: 'Reorder',      foreground: true },
    ],
  },
  {
    id: 'delivery_actions',
    actions: [
      { id: 'accept_delivery', title: 'Accept',   foreground: true  },
      { id: 'navigate',        title: 'Navigate', foreground: true  },
      { id: 'reject_delivery', title: 'Reject',   destructive: true },
    ],
  },
];
