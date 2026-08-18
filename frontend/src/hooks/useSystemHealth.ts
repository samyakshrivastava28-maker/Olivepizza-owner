import { useState, useEffect, useRef, useCallback } from 'react';
import { fetchApi } from '../lib/config';

export type SystemStatus = 'healthy' | 'warning' | 'critical' | 'initializing' | 'unavailable' | 'connecting' | 'retrying';

export interface HealthData {
  timestamp: string;
  system: { uptime: number; memory: any; cpuLoad: number[]; platform: string; nodeVersion: string };
  services: {
    backend?: { status: string; version?: string };
    database: { status: string; latency: number; activeConnections: number };
    cloudinary: { status: string; latency: number };
    firebase: { status: string; latency: number };
    email: { status: string; queueSize: number };
    notifications: { status: string; activeTokens: number; queued: number };
  };
  aiProviders: Array<{ name: string; status: string; latency: number }>;
  environment?: { vars: Record<string,string>; missing: string[]; allConfigured: boolean };
}

const STATUS_ENDPOINT = '/api/health/status';
const DIAGNOSTICS_ENDPOINT = '/api/health/diagnostics';
const STREAM_ENDPOINT = '/api/health/stream';

export const useSystemHealth = () => {
  const [data, setData] = useState<HealthData | null>(null);
  const [status, setStatus] = useState<SystemStatus>('initializing');
  const eventSourceRef = useRef<EventSource | null>(null);
  const pollerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMounted = useRef(true);
  const retryCount = useRef(0);
  const sseFailCount = useRef(0);

  const processData = useCallback((parsed: any) => {
    if (!isMounted.current) return;
    setData(parsed);
    const services = Object.values(parsed.services) as any[];
    const isDown = services.some(s => s.status === 'down' || s.status === 'error');
    const isDegraded = services.some(s => s.status === 'degraded' || s.status === 'checking');
    if (isDown) setStatus('critical');
    else if (isDegraded) setStatus('warning');
    else setStatus('healthy');
  }, []);

  // Direct HTTP polling — no auth required
  const pollDiagnostics = useCallback(async () => {
    try {
      const res = await fetchApi(DIAGNOSTICS_ENDPOINT, { signal: AbortSignal.timeout(15000) });
      if (res.ok) {
        const json = await res.json();
        if (json.success && isMounted.current) {
          processData(json);
          retryCount.current = 0;
        }
      } else if (isMounted.current) {
        setStatus('warning');
      }
    } catch {
      if (isMounted.current) {
        retryCount.current++;
        if (retryCount.current > 5) setStatus('unavailable');
        else setStatus('retrying');
      }
    }
  }, [processData]);

  // Try SSE first, fall back to polling
  const startSSE = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    if (!isMounted.current) return;

    try {
      const sse = new EventSource(STREAM_ENDPOINT);
      eventSourceRef.current = sse;

      sse.onopen = () => {
        if (!isMounted.current) { sse.close(); return; }
        sseFailCount.current = 0;
      };

      sse.onmessage = (event) => {
        if (!isMounted.current) return;
        try {
          const parsed = JSON.parse(event.data);
          if (parsed.status === 'connected') return;
          processData(parsed);
        } catch {}
      };

      sse.onerror = () => {
        if (!isMounted.current) return;
        sse.close();
        eventSourceRef.current = null;
        sseFailCount.current++;

        // After 2 SSE failures, switch to polling permanently
        if (sseFailCount.current >= 2) {
          startPolling();
        } else {
          setTimeout(startSSE, 3000);
        }
      };
    } catch {
      // SSE not supported or failed immediately
      startPolling();
    }
  }, [processData]);

  const startPolling = useCallback(() => {
    if (pollerRef.current) return; // Already polling
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    // Immediate poll then every 5s
    pollDiagnostics();
    pollerRef.current = setInterval(pollDiagnostics, 5000);
  }, [pollDiagnostics]);

  useEffect(() => {
    isMounted.current = true;
    setStatus('connecting');

    // Check if backend is reachable (with cold-start tolerance for cloud hosting like Render)
    const init = async () => {
      try {
        const res = await fetchApi(STATUS_ENDPOINT, { signal: AbortSignal.timeout(25000) });
        if (res.ok && isMounted.current) {
          // Backend is up — start diagnostics polling and SSE
          startSSE();
          pollDiagnostics();
          pollerRef.current = setInterval(pollDiagnostics, 8000);
        } else {
          if (isMounted.current) setStatus('retrying');
        }
      } catch {
        if (isMounted.current) {
          setStatus('retrying');
          // Auto-retry aggressively every 4s to catch server wake up
          retryTimerRef.current = setInterval(async () => {
            try {
              const r = await fetchApi(STATUS_ENDPOINT, { signal: AbortSignal.timeout(15000) });
              if (r.ok && isMounted.current) {
                if (retryTimerRef.current) {
                  clearInterval(retryTimerRef.current);
                  retryTimerRef.current = null;
                }
                setStatus('connecting');
                startSSE();
                pollDiagnostics();
                pollerRef.current = setInterval(pollDiagnostics, 8000);
              }
            } catch {}
          }, 4000);
        }
      }
    };

    init();

    return () => {
      isMounted.current = false;
      if (eventSourceRef.current) { eventSourceRef.current.close(); eventSourceRef.current = null; }
      if (pollerRef.current) { clearInterval(pollerRef.current); pollerRef.current = null; }
      if (retryTimerRef.current) { clearInterval(retryTimerRef.current); retryTimerRef.current = null; }
    };
  }, []);

  return { data, status };
};
