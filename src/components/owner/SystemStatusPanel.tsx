import { useSystemHealth } from '../../hooks/useSystemHealth';
import { Loader2, CheckCircle2, AlertTriangle, XCircle, Activity } from 'lucide-react';

export default function SystemStatusPanel() {
  const { data, status } = useSystemHealth();

  const getStatusIcon = (state: string) => {
    switch (state) {
      case 'healthy':
      case 'operational': return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case 'warning':
      case 'degraded': return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      case 'critical':
      case 'down': return <XCircle className="w-4 h-4 text-red-500" />;
      case 'unavailable': return <XCircle className="w-4 h-4 text-red-500" />;
      case 'connecting':
      case 'retrying': return <Loader2 className="w-4 h-4 text-amber-500 animate-spin" />;
      default: return <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />;
    }
  };

  const getStatusColor = (state: string) => {
    switch (state) {
      case 'healthy':
      case 'operational': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      case 'warning':
      case 'degraded': return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
      case 'critical':
      case 'down':
      case 'unavailable': return 'bg-red-500/10 text-red-500 border-red-500/20';
      case 'connecting':
      case 'retrying': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      default: return 'bg-slate-800 text-slate-400 border-slate-700';
    }
  };

  if (status === 'unavailable') {
    return (
      <div className="glass-card p-6 h-full flex flex-col items-center justify-center text-center gap-4">
        <XCircle className="w-10 h-10 text-red-500" />
        <div>
          <h3 className="text-lg font-bold text-white mb-1">Backend Offline</h3>
          <p className="text-slate-400 text-sm">The backend server isn't responding.<br/>Auto-retrying every 10 seconds...</p>
        </div>
        <button onClick={() => window.location.reload()} className="text-xs text-slate-400 hover:text-white underline transition-colors">Force Refresh</button>
      </div>
    );
  }

  if ((status === 'connecting' || status === 'retrying' || status === 'initializing') && !data) {
    return (
      <div className="glass-card p-6 h-full flex flex-col items-center justify-center text-center">
        <Loader2 className="w-10 h-10 text-emerald-500 mb-4 animate-spin" />
        <h3 className="text-lg font-bold text-white">Connecting to backend...</h3>
        <p className="text-slate-400 text-sm mt-1">Loading system metrics</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="glass-card p-6 h-full flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin mb-4" />
        <h3 className="text-lg font-bold text-white">Loading...</h3>
      </div>
    );
  }


  const StatusRow = ({ label, state, meta }: { label: string, state: string, meta?: string }) => (
    <div className="flex justify-between items-center py-2.5 border-b border-white/5 last:border-0 group">
      <div className="flex items-center gap-2">
        {getStatusIcon(state)}
        <span className="text-sm font-medium text-slate-300 group-hover:text-white transition-colors">{label}</span>
      </div>
      <div className="flex items-center gap-3">
        {meta && <span className="text-xs font-mono text-slate-500">{meta}</span>}
        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${getStatusColor(state)}`}>
          {state}
        </span>
      </div>
    </div>
  );

  return (
    <div className="glass-card p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <Activity className="w-5 h-5 text-emerald-500" />
          Live System Health
        </h3>
        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${getStatusColor(status)} flex items-center gap-1`}>
          <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
          {status}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto hide-scrollbar space-y-6">
        <div>
          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Infrastructure</h4>
          <StatusRow label="Backend API" state={data.services.backend?.status || 'operational'} meta={`v${data.services.backend?.version || '1.0.0'}`} />
          <StatusRow label="Postgres DB" state={data.services.database.status} meta={`${data.services.database.latency}ms`} />
          <StatusRow label="Firebase Core" state={data.services.firebase.status} meta={`${data.services.firebase.latency}ms`} />
          <StatusRow label="Cloudinary CDN" state={data.services.cloudinary.status} meta={`${data.services.cloudinary.latency}ms`} />
        </div>


        <div>
          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Queues & Background</h4>
          <StatusRow label="Notifications" state={data.services.notifications.status} meta={`${data.services.notifications.queued} queued`} />
          <StatusRow label="Email SMTP" state={data.services.email.status} meta={`${data.services.email.queueSize} queued`} />
        </div>

        <div>
          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">AI Providers</h4>
          {data.aiProviders.map(ai => (
            <StatusRow key={ai.name} label={ai.name} state={ai.status} meta={`${ai.latency}ms`} />
          ))}
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-white/10 flex justify-between items-center text-xs text-slate-500">
        <span>Server Load: {data.system.cpuLoad[0].toFixed(2)}</span>
        <span>Mem: {Math.round(data.system.memory.heapUsed / 1024 / 1024)}MB</span>
      </div>
    </div>
  );
}
