import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Copy, Check } from 'lucide-react';

export class DevErrorBoundary extends React.Component<{ children: React.ReactNode; pageTitle?: string }, { hasError: boolean; error?: Error }> {
  constructor(props: { children: React.ReactNode; pageTitle?: string }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, info: any) {
    console.error(`[DevOps ${this.props.pageTitle || 'Page'} Error]`, error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 rounded-2xl bg-red-500/10 border border-red-500/30 text-center space-y-3 my-6">
          <AlertTriangle className="w-8 h-8 text-red-400 mx-auto" />
          <h3 className="text-white font-bold text-base">Unable to display {this.props.pageTitle || 'this section'}</h3>
          <p className="text-xs text-red-300 font-mono max-w-lg mx-auto">{this.state.error?.message || 'Unexpected rendering error'}</p>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold cursor-pointer transition-all"
          >
            Retry Section
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export function StatCard({
  icon: Icon,
  label,
  value,
  color = 'text-primary-400',
  sub
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  color?: string;
  sub?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-slate-900/60 border border-white/[0.08] rounded-2xl p-5 flex items-start gap-4"
    >
      <div className={`p-2.5 rounded-xl bg-white/5 ${color} shrink-0`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-slate-400 text-xs font-medium uppercase tracking-wider">{label}</p>
        <p className="text-white text-xl font-bold mt-0.5 truncate">{value}</p>
        {sub && <p className="text-slate-500 text-xs mt-0.5 truncate">{sub}</p>}
      </div>
    </motion.div>
  );
}

export function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    queued: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
    sending: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    sent: 'bg-green-500/15 text-green-400 border-green-500/30',
    failed: 'bg-red-500/15 text-red-400 border-red-500/30',
    pending: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
    delivered: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    success: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    active: 'bg-green-500/15 text-green-400 border-green-500/30',
    HEALTHY: 'bg-green-500/15 text-green-400 border-green-500/30',
    DEGRADED: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    UNREACHABLE: 'bg-red-500/15 text-red-400 border-red-500/30',
  };
  const cls = map[status] || 'bg-slate-500/15 text-slate-400 border-slate-500/30';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${cls}`}>
      {status}
    </span>
  );
}

export function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="text-slate-500 hover:text-slate-300 transition-colors p-1"
      title="Copy to clipboard"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

export function SectionTitle({
  icon: Icon,
  title,
  subtitle
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2">
        <Icon className="w-5 h-5 text-primary-400" />
        <h2 className="text-white font-bold text-base">{title}</h2>
      </div>
      {subtitle && <p className="text-slate-400 text-xs mt-1">{subtitle}</p>}
    </div>
  );
}
