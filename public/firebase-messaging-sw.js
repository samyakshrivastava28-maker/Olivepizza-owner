/**
 * Olive Pizza — Enterprise Firebase Messaging Service Worker
 *
 * Features:
 * - Live Order Cards: FCM tag-based in-place notification updates (no duplicate cards)
 * - Quick Actions: Direct API calls from notification buttons without opening the app
 * - Offline Action Queue: Actions queued via IndexedDB if offline, synced when reconnected
 * - Multi-tab Sync: BroadcastChannel notifies all open tabs of state changes
 * - Acknowledgement: Reports delivered/opened/action events back to the server
 * - Custom Sounds: Per-category audio via a hidden <audio> element in open windows
 * - Auto Recovery: On SW restart, re-registers Background Sync tasks
 */

importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyAqkcY-WQrW3WoZWRrv8oo7MTAI_nVrLw4",
  authDomain: "olive-pizza-08.firebaseapp.com",
  projectId: "olive-pizza-08",
  storageBucket: "olive-pizza-08.firebasestorage.app",
  messagingSenderId: "1017239455106",
  appId: "1:1017239455106:web:ea5dd73d10722020007b9b"
});

const messaging = firebase.messaging();

// ─── Constants ────────────────────────────────────────────────────────────────
const API_BASE = self.location.origin + '/api';  // adjust if backend is on separate domain
const BROADCAST = new BroadcastChannel('olive_pizza_notifications');
const OFFLINE_QUEUE_KEY = 'olive_offline_action_queue';
const ICON = 'https://res.cloudinary.com/dxmlvkff1/image/upload/v1782376898/olive-pizza/brand/logo.png';
const BADGE = 'https://res.cloudinary.com/dxmlvkff1/image/upload/v1782376898/olive-pizza/brand/badge_mono.png';

// ─── IndexedDB helpers (offline queue) & Safe Mode ─────────────────────────────────
function openDB() {
  return new Promise((resolve, reject) => {
    try {
      const req = indexedDB.open('olive_sw', 2);
      req.onupgradeneeded = e => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('offlineActions')) {
          db.createObjectStore('offlineActions', { keyPath: 'id', autoIncrement: true });
        }
        if (!db.objectStoreNames.contains('authTokens')) {
          db.createObjectStore('authTokens', { keyPath: 'uid' });
        }
      };
      req.onsuccess = e => resolve(e.target.result);
      req.onerror = e => {
        console.error('[SW] IndexedDB corrupted, triggering Safe Mode rebuild.', e.target.error);
        indexedDB.deleteDatabase('olive_sw'); // Safe Mode: clear corrupted DB
        reject(e.target.error);
      };
    } catch (err) {
      console.error('[SW] Critical IDB failure in Safe Mode:', err);
      reject(err);
    }
  });
}

// Global SW Error Catcher to prevent infinite reload loops
self.addEventListener('error', (event) => {
  console.error('[SW Safe Mode] Caught unhandled worker error:', event.message);
  // We do NOT unregister the SW here automatically to prevent rapid reload loops.
  // We just let it gracefully degrade.
});

self.addEventListener('unhandledrejection', (event) => {
  console.error('[SW Safe Mode] Caught unhandled rejection:', event.reason);
});

async function saveOfflineAction(action) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('offlineActions', 'readwrite');
    tx.objectStore('offlineActions').add({ ...action, createdAt: Date.now() });
    tx.oncomplete = () => resolve();
    tx.onerror = e => reject(e.target.error);
  });
}

async function getAndClearOfflineActions() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('offlineActions', 'readwrite');
    const store = tx.objectStore('offlineActions');
    const req = store.getAll();
    req.onsuccess = () => {
      const items = req.result;
      store.clear();
      resolve(items);
    };
    req.onerror = e => reject(e.target.error);
  });
}

async function getCachedAuthToken() {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction('authTokens', 'readonly');
    const req = tx.objectStore('authTokens').getAll();
    req.onsuccess = () => resolve(req.result[0]?.token || null);
    req.onerror = () => resolve(null);
  });
}

// ─── Background Message Handler ────────────────────────────────────────────────
messaging.onBackgroundMessage(async (payload) => {
  const data = payload.data || {};
  if (data.action === 'STOP_ALERT') {
    BROADCAST.postMessage({ type: 'STOP_ALERT', orderId: data.orderId });
    return;
  }

  console.log('[SW] Background message:', data.tag || 'no-tag');

  const tag = data.tag || `notification_${Date.now()}`;
  const notifTitle = payload.notification?.title || data.title || 'Olive Pizza';
  const notifBody = payload.notification?.body || data.body || '';
  const stage = data.stage || '';
  const orderId = data.orderId;
  const queueId = data.queueId;
  const sound = data.sound || 'default';
  const url = data.url || '/';
  const category = data.category || 'general';
  const priority = data.priority || 'normal';

  // ── Acknowledge delivery ─────────────────────────────────────────────────
  if (queueId) {
    fetch(`${API_BASE}/notifications/track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ queueId, stage: 'delivered', orderId })
    }).catch(() => {});
  }

  // ── Build actions based on stage/role ────────────────────────────────────
  const actions = buildActions(stage, data.role);

  // ── Parse Data Strings ───────────────────────────────────────────────────
  let parsedActions = actions;
  if (data.actions) {
    try { parsedActions = JSON.parse(data.actions); } catch (e) {}
  }
  let requireInteraction = priority === 'critical' || stage === 'new_order' || stage === 'delivery_assigned';
  if (data.requireInteraction === 'true') requireInteraction = true;
  let vibratePattern = priority === 'critical' ? [300, 200, 300, 200, 300] : [200, 100, 200];
  if (data.vibrate) {
    try { vibratePattern = JSON.parse(data.vibrate); } catch (e) {}
  }

  // ── Notification options ─────────────────────────────────────────────────
  const options = {
    body: notifBody,
    icon: ICON,
    badge: BADGE,
    tag,                // Live Card — replaces existing notification with same tag
    renotify: true,     // Re-alert user (sound + vibration) even on update
    requireInteraction,
    silent: false,
    vibrate: vibratePattern,
    actions: parsedActions,
    data: {
      url,
      orderId,
      queueId,
      stage,
      sound,
      category,
      role: data.role,
    },
    // Timestamp so OS can show "X minutes ago"
    timestamp: Date.now(),
  };

  // If it's a continuous alert, broadcast it so open tabs can play sound
  if (data.alert === 'continuous') {
    BROADCAST.postMessage({ type: 'START_ALERT', orderId, sound: data.sound });
  }

  // ── Data-only silent update (GPS/countdown) — update existing notification ─
  if (!payload.notification && data.updatedBody && !data.title) {
    // Silent background update — update existing notification in-place
    const existingNotifications = await self.registration.getNotifications({ tag });
    if (existingNotifications.length > 0) {
      const existing = existingNotifications[0];
      // Rebuild with fresh ETA/body from data
      const updatedBody = data.updatedBody || existing.body;
      self.registration.showNotification(existing.title, {
        ...options,
        body: updatedBody,
        silent: true,    // No sound for background GPS updates
        renotify: false,
      });
    }
    // Broadcast to open tabs for live map/countdown
    BROADCAST.postMessage({ type: 'GPS_UPDATE', data });
    return;
  }

  await self.registration.showNotification(notifTitle, options);

  // ── Broadcast to all open tabs to update UI ──────────────────────────────
  BROADCAST.postMessage({
    type: 'NEW_NOTIFICATION',
    title: notifTitle,
    body: notifBody,
    tag,
    orderId,
    stage,
    sound,
    category,
    data,
  });
});

// ─── Action Builders ──────────────────────────────────────────────────────────
function buildActions(stage, role) {
  const MAX_ACTIONS = 2; // Web Push spec limits to 2 actions on most browsers

  const actionMap = {
    new_order: [{ action: 'accept', title: '✅ Accept' }, { action: 'stop_alert', title: '🔕 Stop Alert' }],
    accepted: [{ action: 'start_cooking', title: '🔥 Start Cooking' }],
    preparing: [{ action: 'ready', title: '🟢 Mark Ready' }],
    ready: [{ action: 'assign_delivery', title: '🚴 Assign Partner' }],
    delivery_assigned: role === 'delivery'
      ? [{ action: 'accept_delivery', title: '✅ Accept' }, { action: 'stop_alert', title: '🔕 Stop Alert' }]
      : [],
    navigate_restaurant: [{ action: 'arrived_restaurant', title: '📍 Arrived' }],
    arrived_restaurant: [{ action: 'picked_up', title: '📦 Picked Up' }],
    out_for_delivery: [{ action: 'arrived_customer', title: '📍 Arrived' }],
    arrived_customer: [{ action: 'delivered', title: '✅ Delivered' }],
    out_for_delivery_customer: [{ action: 'track', title: '📍 Track' }, { action: 'call_partner', title: '📞 Call' }],
    delivered_customer: [{ action: 'rate', title: '⭐ Rate' }, { action: 'reorder', title: '🔄 Reorder' }],
  };

  return (actionMap[stage] || []).slice(0, MAX_ACTIONS);
}

// ─── Notification Click Handler ───────────────────────────────────────────────
self.addEventListener('notificationclick', event => {
  const action = event.action;
  const notifData = event.notification.data || {};
  const { orderId, queueId, url, stage, role } = notifData;

  event.notification.close();

  // Track click
  if (queueId) {
    fetch(`${API_BASE}/notifications/track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ queueId, stage: 'opened', orderId })
    }).catch(() => {});
  }

  // Determine target URL for "open app" actions
  const openActions = new Set(['open', 'track', 'dashboard', '']);
  if (!action || openActions.has(action)) {
    event.waitUntil(openWindow(url || '/'));
    return;
  }

  // Navigate actions — just open Maps or the app
  if (action === 'navigate' || action === 'navigate_customer') {
    event.waitUntil(openWindow(`https://maps.google.com/maps?q=${encodeURIComponent(notifData.deliveryAddress || '')}`));
    return;
  }

  if (action === 'call_customer' || action === 'call_partner') {
    event.waitUntil(openWindow(`tel:${notifData.phone || ''}`));
    return;
  }

  // Rate or Reorder
  if (action === 'rate') { event.waitUntil(openWindow(`/dashboard?rate=${orderId}`)); return; }
  if (action === 'reorder') { event.waitUntil(openWindow(`/menu?reorder=${orderId}`)); return; }

  // Quick Action API call (background, no window open)
  event.waitUntil(performQuickAction(action, orderId, stage, queueId));
});

// ─── Quick Action — Authenticated API Call ────────────────────────────────────
async function performQuickAction(action, orderId, stage, queueId) {
  const token = await getCachedAuthToken();

  const body = JSON.stringify({ orderId, action, currentStage: stage });
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  };

  // Try to send the action
  try {
    const response = await fetch(`${API_BASE}/notifications/action`, {
      method: 'POST',
      headers,
      body,
    });

    if (response.ok) {
      const result = await response.json();
      // Acknowledge action
      if (queueId) {
        fetch(`${API_BASE}/notifications/track`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ queueId, stage: 'action_performed', orderId })
        }).catch(() => {});
      }
      
      // If the action was stop_alert, we can just broadcast that too
      if (action === 'stop_alert') {
        BROADCAST.postMessage({ type: 'STOP_ALERT', orderId });
      } else {
        // Broadcast success to open tabs
        BROADCAST.postMessage({ type: 'ACTION_SUCCESS', action, orderId, newStatus: result.newStatus });
      }
    } else if (response.status === 401) {
      // Auth expired — save to offline queue and show a window for re-auth
      await saveOfflineAction({ action, orderId, stage, queueId, savedAt: Date.now() });
      openWindow(`/login?redirect=/order/${orderId}`);
    } else {
      throw new Error(`Action failed: ${response.status}`);
    }
  } catch (err) {
    // Offline — queue the action for sync when back online
    console.warn('[SW] Quick action failed, queuing for Background Sync:', err.message);
    await saveOfflineAction({ action, orderId, stage, queueId, savedAt: Date.now() });

    // Register background sync task
    try {
      await self.registration.sync.register('olive_action_sync');
    } catch (syncErr) {
      console.warn('[SW] Background Sync not supported:', syncErr.message);
    }
  }
}

// ─── Background Sync Handler (auto-retry when back online) ──────────────────
self.addEventListener('sync', event => {
  if (event.tag === 'olive_action_sync') {
    event.waitUntil(flushOfflineActions());
  }
});

async function flushOfflineActions() {
  const actions = await getAndClearOfflineActions();
  if (actions.length === 0) return;

  const token = await getCachedAuthToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  };

  console.log(`[SW] Syncing ${actions.length} offline actions`);

  for (const item of actions) {
    try {
      const response = await fetch(`${API_BASE}/notifications/action`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          orderId: item.orderId,
          action: item.action,
          currentStage: item.stage,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        BROADCAST.postMessage({ type: 'SYNC_ACTION_SUCCESS', ...item, newStatus: result.newStatus });
        console.log(`[SW] Synced offline action: ${item.action} for order ${item.orderId}`);
      } else {
        // If still failing, re-save for next sync
        await saveOfflineAction(item);
      }
    } catch (err) {
      // Still offline — re-save
      await saveOfflineAction(item);
    }
  }
}

// ─── Push Event (for Apple/Safari raw Web Push fallback) ───────────────────────
// We ONLY process this if the payload is missing standard FCM structure 
// to prevent duplicate notifications with firebase-messaging-compat.
self.addEventListener('push', event => {
  if (!event.data) return;
  
  try {
    const data = event.data.json();
    
    // Check if it's already handled by FCM wrapper (has fcmOptions or similar)
    if (data.fcmOptions || (data.data && data.data['fcm_options'])) {
       // Let firebase-messaging-compat handle it
       return;
    }

    if (data.notification || data.title) {
      const title = data.notification?.title || data.title || 'Olive Pizza';
      const options = {
        body: data.notification?.body || data.body || '',
        icon: data.notification?.icon || ICON,
        badge: data.notification?.badge || BADGE,
        data: data.data || {},
        vibrate: [200, 100, 200]
      };
      event.waitUntil(self.registration.showNotification(title, options));
    } else {
      // Data-only message
      BROADCAST.postMessage({ type: 'DATA_PUSH', data });
    }
  } catch (err) {
    console.error('[SW] Raw push event error:', err);
  }
});

// ─── Window Focus Helper ──────────────────────────────────────────────────────
async function openWindow(url) {
  const allClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });
  for (const client of allClients) {
    if (new URL(client.url).origin === self.location.origin) {
      client.focus();
      client.navigate(url);
      return;
    }
  }
  return clients.openWindow(url);
}

// ─── Message from App (store auth token for Quick Actions) ────────────────────
self.addEventListener('message', async event => {
  if (event.data?.type === 'STORE_AUTH_TOKEN') {
    const db = await openDB();
    const tx = db.transaction('authTokens', 'readwrite');
    tx.objectStore('authTokens').put({ uid: event.data.uid, token: event.data.token });
  }

  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ─── Install & Activate ─────────────────────────────────────────────────────────
self.addEventListener('install', event => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(clients.claim());
});
