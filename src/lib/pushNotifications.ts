// This file provides the architecture for future FCM integration.
// Currently it uses the native Notification API to demonstrate permissions.

export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) {
    console.warn('This browser does not support desktop notifications');
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  return false;
}

export function subscribeToTopic(topic: 'new_orders' | 'delivery_updates' | 'promotions') {
  console.log(`[Push API] Stub: Subscribed to topic -> ${topic}`);
  // Future FCM implementation:
  // const messaging = getMessaging();
  // getToken(messaging, { vapidKey: 'YOUR_VAPID_KEY' }).then(token => {
  //   // Send token to backend to subscribe to topic
  // });
}

export function simulateLocalNotification(title: string, body: string, url: string = '/') {
  if (typeof window === 'undefined' || !('Notification' in window) || window.Notification.permission !== 'granted') return;
  
  if (navigator.serviceWorker.controller) {
    navigator.serviceWorker.ready.then(registration => {
      registration.showNotification(title, {
        body,
        icon: '/icons/icon-192x192.webp',
        data: url
      });
    });
  } else {
    new window.Notification(title, { body, icon: '/icons/icon-192x192.webp' });
  }
}
