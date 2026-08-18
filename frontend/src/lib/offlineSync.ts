import { get, set } from 'idb-keyval';
import toast from 'react-hot-toast';

interface OfflineAction {
  id: string;
  url: string;
  method: string;
  body: any;
  timestamp: number;
}

const QUEUE_KEY = 'offline-action-queue';

export const queueOfflineAction = async (url: string, method: string, body: any) => {
  if (navigator.onLine) {
    // If online, execute immediately
    return fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  }

  // If offline, queue it
  try {
    const queue: OfflineAction[] = await get(QUEUE_KEY) || [];
    queue.push({
      id: Math.random().toString(36).substring(7),
      url,
      method,
      body,
      timestamp: Date.now()
    });
    await set(QUEUE_KEY, queue);
    toast.success('You are offline. Action saved and will sync automatically when back online.', { duration: 4000 });
  } catch (e) {
    console.error('Failed to queue offline action:', e);
  }
};

export const syncOfflineQueue = async () => {
  const queue: OfflineAction[] = await get(QUEUE_KEY) || [];
  if (queue.length === 0) return;

  toast.loading(`Syncing ${queue.length} offline actions...`, { id: 'offline-sync' });

  const failedActions: OfflineAction[] = [];
  
  for (const action of queue) {
    try {
      await fetch(action.url, {
        method: action.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action.body)
      });
    } catch (e) {
      console.error('Failed to sync action:', action, e);
      failedActions.push(action); // Keep if still failing
    }
  }

  await set(QUEUE_KEY, failedActions);

  if (failedActions.length === 0) {
    toast.success('All offline actions synced successfully!', { id: 'offline-sync' });
  } else {
    toast.error(`${failedActions.length} actions failed to sync.`, { id: 'offline-sync' });
  }
};

// Listen for network reconnect
if (typeof window !== 'undefined') {
  window.addEventListener('online', syncOfflineQueue);
}
