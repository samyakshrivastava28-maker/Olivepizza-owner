import { useSystemHealth } from '../../hooks/useSystemHealth';
import { Activity, Database, Users, HardDrive, Clock, Server, AlertTriangle, Loader, WifiOff } from 'lucide-react';

export const SystemHealthPanel = () => {
  const { data, status } = useSystemHealth();

  const formatUptime = (seconds: number) => {
    if (!seconds) return 'N/A';
    const d = Math.floor(seconds / (3600*24));
    const h = Math.floor(seconds % (3600*24) / 3600);
    const m = Math.floor(seconds % 3600 / 60);
    return `${d}d ${h}h ${m}m`;
  };

  const renderStatusBadge = () => {
    switch (status) {
      case 'healthy':
        return <span className="flex items-center gap-1 text-sm font-medium text-emerald-400 bg-emerald-400/10 px-3 py-1 rounded-full"><Activity className="w-4 h-4"/>All Systems Healthy</span>;
      case 'warning':
        return <span className="flex items-center gap-1 text-sm font-medium text-amber-400 bg-amber-400/10 px-3 py-1 rounded-full"><AlertTriangle className="w-4 h-4"/>Partial Degradation</span>;
      case 'critical':
        return <span className="flex items-center gap-1 text-sm font-medium text-red-400 bg-red-400/10 px-3 py-1 rounded-full"><AlertTriangle className="w-4 h-4 animate-pulse"/>Critical Issues</span>;
      case 'initializing':
        return <span className="flex items-center gap-1 text-sm font-medium text-slate-400 bg-slate-800 px-3 py-1 rounded-full"><Loader className="w-4 h-4 animate-spin"/>Initializing...</span>;
      case 'unavailable':
        return <span className="flex items-center gap-1 text-sm font-medium text-red-400 bg-red-400/10 px-3 py-1 rounded-full"><WifiOff className="w-4 h-4"/>Backend Offline</span>;
      case 'connecting':
        return <span className="flex items-center gap-1 text-sm font-medium text-blue-400 bg-blue-400/10 px-3 py-1 rounded-full"><Loader className="w-4 h-4 animate-spin"/>Connecting...</span>;
      case 'retrying':
        return <span className="flex items-center gap-1 text-sm font-medium text-amber-400 bg-amber-400/10 px-3 py-1 rounded-full"><Loader className="w-4 h-4 animate-spin"/>Reconnecting...</span>;
    }
  };

  return (
    <div className="bg-slate-900/50 backdrop-blur-md rounded-2xl p-6 border border-slate-800 transition-all duration-300 h-full flex flex-col">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2">
          <Server className="w-5 h-5 text-emerald-400" />
          <h2 className="text-lg font-bold text-white">Metrics Overview</h2>
        </div>
        {renderStatusBadge()}
      </div>

      {['initializing', 'connecting', 'retrying'].includes(status) && !data ? (
        <div className="w-full flex-1 bg-slate-800/50 rounded-xl animate-pulse min-h-[120px]" />
      ) : data ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 flex-1">
          <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700 flex flex-col justify-center">
            <div className="flex items-center gap-2 text-slate-400 text-sm mb-2">
              <Clock className="w-4 h-4" />
              Uptime
            </div>
            <div className="text-xl font-bold text-white">{formatUptime(data.system.uptime)}</div>
          </div>
          
          <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700 flex flex-col justify-center">
            <div className="flex items-center gap-2 text-slate-400 text-sm mb-2">
              <Database className="w-4 h-4" />
              Active DB Connections
            </div>
            <div className="text-xl font-bold text-white">{data.services.database.activeConnections}</div>
          </div>
          
          <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700 flex flex-col justify-center">
            <div className="flex items-center gap-2 text-slate-400 text-sm mb-2">
              <Server className="w-4 h-4" />
              Memory Usage
            </div>
            <div className="text-xl font-bold text-white">{Math.round(data.system.memory.heapUsed / 1024 / 1024)} MB</div>
          </div>

          <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700 flex flex-col justify-center">
            <div className="flex items-center gap-2 text-slate-400 text-sm mb-2">
              <Activity className="w-4 h-4" />
              CPU Load
            </div>
            <div className="text-xl font-bold text-emerald-400">{data.system.cpuLoad[0].toFixed(2)}</div>
          </div>
        </div>
      ) : (
        <div className="w-full flex-1 flex items-center justify-center text-slate-500 bg-slate-800/30 rounded-xl border border-slate-800 border-dashed min-h-[120px]">
          No metrics available. Waiting for connection...
        </div>
      )}
    </div>
  );
};
