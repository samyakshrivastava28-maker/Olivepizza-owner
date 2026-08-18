interface QueuedEvent {
  eventType: string;
  sectionId?: string;
  sectionType?: string;
  sessionId: string;
  userId?: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

let eventQueue: QueuedEvent[] = [];
let flushTimer: NodeJS.Timeout | null = null;

function getSessionId(): string {
  if (typeof window === 'undefined') return 'server';
  let sid = window.sessionStorage.getItem('olive_session_id');
  if (!sid) {
    sid = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    window.sessionStorage.setItem('olive_session_id', sid);
  }
  return sid;
}

async function flushQueue() {
  if (eventQueue.length === 0) return;
  const toSend = [...eventQueue];
  eventQueue = [];

  const backendUrl = import.meta.env.VITE_BACKEND_URL || '';
  const endpoint = `${backendUrl}/api/website-analytics/batch`;

  try {
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      const blob = new Blob([JSON.stringify({ events: toSend })], { type: 'application/json' });
      navigator.sendBeacon(endpoint, blob);
    } else {
      await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events: toSend }),
        keepalive: true,
      });
    }
  } catch (e) {
    console.warn('[AnalyticsTracker] Flush failed:', e);
  }
}

export function trackSDUIEvent(
  eventType: 'section_view' | 'section_click' | 'section_scroll_50' | 'section_scroll_100' | 'cta_click' | 'product_click' | 'web_vital',
  sectionId?: string,
  sectionType?: string,
  metadata?: Record<string, any>
) {
  const ev: QueuedEvent = {
    eventType,
    sectionId,
    sectionType,
    sessionId: getSessionId(),
    metadata,
    createdAt: new Date().toISOString(),
  };

  eventQueue.push(ev);

  if (eventQueue.length >= 10) {
    flushQueue();
  } else if (!flushTimer) {
    flushTimer = setTimeout(() => {
      flushTimer = null;
      flushQueue();
    }, 5000);
  }
}

// Flush on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushQueue();
  });
  window.addEventListener('pagehide', flushQueue);
}
