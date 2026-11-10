import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';
import { logCrash } from '../../lib/crashLogger';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class SafeErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("SafeErrorBoundary caught an error:", error, errorInfo);
    
    // Log crash to Firestore
    logCrash({
      type: 'SafeErrorBoundary',
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack
    });

    this.setState({ errorInfo });
    const msg = error.message.toLowerCase();
    const isChunkError = error.name === 'ChunkLoadError' || 
                         msg.includes('dynamically imported module') ||
                         msg.includes('failed to fetch') ||
                         msg.includes('importing a module script failed');
                         
    if (isChunkError) {
      // Let the user see the error UI and click the button to nuke caches.
      // Auto-reloading here can cause an infinite loop in some WebViews if cache isn't cleared synchronously.
      console.warn("Caught chunk load error. Waiting for manual refresh to clear caches.");
    }
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) {
      this.props.onReset();
    } else {
      // Nuke all PWA caches and service workers before reloading to fix ChunkLoadErrors
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(regs => {
          for (const reg of regs) reg.unregister();
        }).catch(() => {});
      }
      if (typeof window !== 'undefined' && 'caches' in window) {
        caches.keys().then(keys => {
          Promise.all(keys.map(k => caches.delete(k))).finally(() => {
            window.location.href = window.location.pathname + '?v=' + new Date().getTime();
          });
        }).catch(() => {
          window.location.reload();
        });
      } else {
        (window as any).location.reload();
      }
    }
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
          <div className="bg-red-500/10 p-4 rounded-full mb-4">
            <AlertTriangle className="w-12 h-12 text-red-500" />
          </div>
          <h2 className="text-2xl font-bold text-red-500 mb-2">Component Crashed</h2>
          <p className="text-slate-400 max-w-md mb-6">
            We encountered a critical error while loading this part of the application. 
          </p>

          <div className="w-full text-left bg-[#0f172a] p-4 rounded-xl border border-red-500/30 overflow-auto max-h-[300px] mb-8 w-full max-w-2xl">
            <div className="text-red-400 font-mono text-sm font-bold mb-2 break-words">
              {this.state.error?.toString()}
            </div>
            {(this.state.error as any)?.code && (
              <div className="text-orange-400 font-mono text-xs font-bold mb-2">
                Firebase/API Code: {(this.state.error as any)?.code}
              </div>
            )}
            <pre className="text-slate-400 font-mono text-xs whitespace-pre-wrap mb-4 border-b border-slate-700 pb-2">
              {this.state.error?.stack}
            </pre>
            {this.state.errorInfo && (
              <pre className="text-slate-500 font-mono text-[10px] whitespace-pre-wrap mt-2">
                {this.state.errorInfo.componentStack}
              </pre>
            )}
          </div>

          <button
            onClick={this.handleReset}
            className="flex items-center justify-center w-full max-w-xs gap-2 px-6 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold transition-all shadow-md active:scale-95"
          >
            <RefreshCcw className="w-5 h-5" />
            Hard Reload Section
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
