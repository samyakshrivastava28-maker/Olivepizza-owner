import React, { Component, ErrorInfo, ReactNode } from 'react';
import { useLoadingStore } from '../lib/loadingStore';
import { Link } from 'react-router';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    // Clear any loading states that might be stuck
    useLoadingStore.getState().clearAll();
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-dark-950 flex flex-col items-center justify-center p-4 text-center z-50 relative">
          <div className="bg-dark-900 border border-dark-800 p-8 rounded-3xl max-w-lg w-full shadow-2xl relative overflow-hidden">
            <div className="text-5xl mb-6 animate-pulse">⏳</div>
            <h1 className="text-2xl font-black text-white mb-2">Just a moment...</h1>
            <p className="text-slate-400 mb-8">
              We're trying to restore your session. If this takes too long, you can manually reload the page.
            </p>
            
            <div className="flex flex-col gap-3">
              <button
                onClick={() => {
                  this.setState({ hasError: false });
                  window.location.reload();
                }}
                className="w-full bg-primary-600 text-white font-bold py-3 rounded-xl hover:bg-primary-500 transition-colors"
              >
                Reload Page
              </button>
              <button
                onClick={() => {
                  this.setState({ hasError: false });
                  window.location.href = "/";
                }}
                className="w-full bg-dark-800 text-white font-bold py-3 rounded-xl hover:bg-dark-700 transition-colors border border-dark-700"
              >
                Return to Homepage
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
