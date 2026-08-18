import { Component, ReactNode } from 'react';
import { RefreshCcw } from 'lucide-react';
import type { ErrorInfo } from 'react';
import { logCrash } from '../lib/crashLogger';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  retryCount: number;
}

const MAX_AUTO_RETRIES = 1;

/**
 * RouteErrorBoundary — catches errors in individual route components.
 * Auto-retries once for transient (chunk/network) failures.
 * Never shows a full-page error for non-critical issues.
 */
export class RouteErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    retryCount: 0,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.warn('[RouteErrorBoundary] Route error caught:', error.message, errorInfo.componentStack);
    
    // Log crash to Firestore
    logCrash({
      type: 'RouteErrorBoundary',
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack
    });

    this.setState({ errorInfo });

    // Auto-retry transient chunk loading errors
    const msg = error.message?.toLowerCase() || '';
    const isTransient =
      msg.includes('loading chunk') ||
      msg.includes('failed to fetch') ||
      msg.includes('dynamically imported module') ||
      msg.includes('loading css chunk');

    if (isTransient && this.state.retryCount < MAX_AUTO_RETRIES) {
      setTimeout(() => {
        this.setState(prev => ({
          hasError: false,
          error: null,
          errorInfo: null,
          retryCount: prev.retryCount + 1,
        }));
      }, 800);
    }
  }

  public render() {
    if (this.state.hasError) {
      // During auto-retry, render nothing (seamless)
      if (this.state.retryCount < MAX_AUTO_RETRIES) {
        return null;
      }

      return (
        <div className="flex flex-col items-center justify-center p-8 text-center w-full min-h-[40vh]">
          <div className="w-14 h-14 bg-red-900/20 rounded-full flex items-center justify-center mb-4">
            <RefreshCcw className="w-7 h-7 text-red-500 opacity-80" />
          </div>
          <h2 className="text-lg font-bold text-red-500 mb-2">Section Crashed</h2>
          <p className="text-slate-400 mb-4 text-sm max-w-sm">
            We encountered a critical error while rendering this section.
          </p>
          
          <div className="w-full text-left bg-[#0f172a] p-4 rounded-xl border border-red-500/30 overflow-auto max-h-[300px] mb-6">
            <div className="text-red-400 font-mono text-sm font-bold mb-2 break-words">
              {this.state.error?.toString()}
            </div>
            {this.state.errorInfo && (
              <pre className="text-slate-400 font-mono text-xs whitespace-pre-wrap">
                {this.state.errorInfo.componentStack}
              </pre>
            )}
          </div>
          <button
            onClick={() => {
              if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
                navigator.serviceWorker.getRegistrations().then(regs => regs.forEach(r => r.unregister())).catch(() => {});
              }
              if (typeof window !== 'undefined' && 'caches' in window) {
                caches.keys().then(keys => {
                  Promise.all(keys.map(k => caches.delete(k))).finally(() => {
                    window.location.href = window.location.pathname + '?v=' + new Date().getTime();
                  });
                }).catch(() => (window as any).location.reload());
              } else {
                (window as any).location.reload();
              }
            }}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white font-semibold py-2 px-5 rounded-xl transition-all border border-slate-700 text-sm"
          >
            <RefreshCcw className="w-4 h-4" />
            Hard Reload
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
