import React, { Component, ReactNode, ErrorInfo } from 'react';
import { RefreshCcw, AlertTriangle } from 'lucide-react';
import { PizzaLoader } from './ui/PizzaLoader';

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
    this.setState({ errorInfo });

    const msg = error.message?.toLowerCase() || '';
    const isTransient =
      msg.includes('loading chunk') ||
      msg.includes('failed to fetch') ||
      msg.includes('dynamically imported module') ||
      msg.includes('loading css chunk');

    if (isTransient && this.state.retryCount < MAX_AUTO_RETRIES) {
      setTimeout(() => {
        this.setState((prev) => ({
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
      if (this.state.retryCount < MAX_AUTO_RETRIES) {
        return <PizzaLoader text="Recovering page module..." />;
      }

      return (
        <div className="flex flex-col items-center justify-center p-8 text-center w-full min-h-[50vh]">
          <div className="w-14 h-14 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center justify-center mb-4 text-amber-400">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <h2 className="text-base font-extrabold text-white mb-1 uppercase tracking-wider">
            Unable to Load This Module
          </h2>
          <p className="text-slate-400 mb-5 text-xs max-w-md">
            This section encountered an unexpected error. You can retry loading or return to Analytics.
          </p>

          <div className="w-full max-w-md text-left bg-[#0E1524] p-4 rounded-xl border border-slate-800 overflow-auto max-h-36 mb-6">
            <div className="text-amber-400 font-mono text-xs font-bold break-words">
              {this.state.error?.message || 'Component render error'}
            </div>
          </div>

          <button
            onClick={() => this.setState({ hasError: false, error: null, retryCount: 0 })}
            className="flex items-center gap-2 bg-orange-600 hover:bg-orange-500 text-white font-bold py-2.5 px-6 rounded-xl transition-all shadow-lg shadow-orange-600/20 text-xs uppercase tracking-wider"
          >
            <RefreshCcw className="w-4 h-4" /> Retry Module
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
