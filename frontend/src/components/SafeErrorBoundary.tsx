import { Component, ErrorInfo, ReactNode } from 'react';
import { RefreshCcw } from 'lucide-react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
}

export class SafeErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(_error: Error): Partial<State> {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[SafeErrorBoundary] Caught error:", error.message, errorInfo);
  }

  private handleReload = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[100dvh] w-full flex items-center justify-center bg-[#0B0F14] text-slate-200 p-6 z-[9999] relative">
          <div className="max-w-md w-full bg-[#131922] border border-amber-500/20 rounded-3xl p-8 shadow-2xl flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center mb-6">
              <RefreshCcw className="w-8 h-8 text-amber-500" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">
              Unable to start Olive Pizza
            </h1>
            <p className="text-slate-400 mb-6 text-sm leading-relaxed">
              Please check your connection and try again.
            </p>
            <button
              onClick={this.handleReload}
              className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold py-3.5 px-6 rounded-xl transition-all shadow-md active:scale-[0.98]"
            >
              Retry
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
export default SafeErrorBoundary;
