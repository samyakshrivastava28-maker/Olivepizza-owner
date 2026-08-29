import React, { Component, ErrorInfo, ReactNode } from 'react';
import { RefreshCcw, Home, AlertCircle } from 'lucide-react';
import { PizzaLoader } from './ui/PizzaLoader';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  retryCount: number;
}

const MAX_AUTO_RETRIES = 2;

export class GlobalErrorBoundary extends Component<Props, State> {
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
    console.error("[GlobalErrorBoundary] React exception caught:", error.message, errorInfo.componentStack);

    this.setState({ errorInfo });
    
    // Auto-retry transient dynamic chunk loading or network failures
    const msg = error.message?.toLowerCase() || '';
    const isTransient =
      msg.includes('loading chunk') ||
      msg.includes('loading css chunk') ||
      msg.includes('failed to fetch') ||
      msg.includes('dynamically imported module') ||
      msg.includes('importing a module script failed');

    if (isTransient && this.state.retryCount < MAX_AUTO_RETRIES) {
      console.log(`[GlobalErrorBoundary] Auto-recovering transient failure (${this.state.retryCount + 1}/${MAX_AUTO_RETRIES})...`);
      setTimeout(() => {
        this.setState((prev) => ({
          hasError: false,
          error: null,
          errorInfo: null,
          retryCount: prev.retryCount + 1,
        }));
      }, 1000);
    }
  }

  private handleReload = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  private handleGoHome = () => {
    this.setState({ hasError: false, error: null, errorInfo: null, retryCount: 0 });
    if (typeof window !== 'undefined') {
      window.location.href = "/analytics";
    }
  };

  public render() {
    if (this.state.hasError) {
      // During auto-retry, render PizzaLoader so screen is NEVER black
      if (this.state.retryCount < MAX_AUTO_RETRIES) {
        return <PizzaLoader text="Recovering application view..." />;
      }

      return (
        <div className="min-h-screen w-full flex items-center justify-center bg-[#0B0F17] text-slate-100 p-6 z-[9999] relative">
          <div className="max-w-xl w-full bg-[#0E1524] border border-red-500/30 rounded-3xl p-8 shadow-2xl flex flex-col items-center text-center space-y-5">
            <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center justify-center text-red-400">
              <AlertCircle className="w-8 h-8" />
            </div>

            <div>
              <h1 className="text-xl font-black text-white uppercase tracking-wider">
                Module Rendering Interrupted
              </h1>
              <p className="text-xs text-slate-400 mt-1 max-w-sm">
                A transient rendering error occurred. You can retry loading this section or return to Analytics.
              </p>
            </div>

            <div className="w-full text-left bg-[#0B0F17] p-4 rounded-xl border border-slate-800 overflow-auto max-h-48">
              <div className="text-red-400 font-mono text-xs font-bold break-words">
                {this.state.error?.toString()}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row w-full gap-3">
              <button
                onClick={() => this.setState({ hasError: false, error: null, retryCount: 0 })}
                className="flex-1 py-3 px-4 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg shadow-orange-600/30"
              >
                <RefreshCcw className="w-4 h-4" /> Try Again
              </button>
              <button
                onClick={this.handleGoHome}
                className="flex-1 py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 border border-slate-700"
              >
                <Home className="w-4 h-4" /> Dashboard
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
