import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { motion } from 'framer-motion';
import { RefreshCw, AlertTriangle, Database, Cloud, HardDrive, Layers, Mail, Bell, Server } from 'lucide-react';
import { Line } from 'react-chartjs-2';
import 'chart.js/auto';

const formatBytes = (bytes: number | string | undefined, decimals = 2) => {
  if (bytes === undefined || bytes === null || bytes === 'Not available from provider') {
    return 'Not available from provider';
  }
  const num = typeof bytes === 'number' ? bytes : parseInt(bytes, 10);
  if (isNaN(num) || num <= 0) return 'Not available from provider';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const i = Math.floor(Math.log(num) / Math.log(k));
  return `${parseFloat((num / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
};

const getProviderInfo = (providerId: string) => {
  switch (providerId) {
    case 'firestore':     return { label: 'Firestore',      color: '#FF7A00', icon: Database };
    case 'supabase':      return { label: 'PostgreSQL',      color: '#6B8E23', icon: Database };
    case 'cloudinary':    return { label: 'Cloudinary',      color: '#FFC107', icon: Cloud };
    case 'google-drive':  return { label: 'Google Drive',    color: '#4285F4', icon: HardDrive };
    case 'qdrant':        return { label: 'Pinecone (AI)',    color: '#E91E63', icon: Layers };
    case 'email':         return { label: 'Email Queue',     color: '#9C27B0', icon: Mail };
    case 'notifications': return { label: 'Notifications',   color: '#00BCD4', icon: Bell };
    case 'app-storage':   return { label: 'App Storage',     color: '#FF5722', icon: Server };
    case 'logs':          return { label: 'Logs',             color: '#607D8B', icon: Server };
    default:              return { label: 'Provider',        color: '#ffffff', icon: Server };
  }
};

export default function ProviderDetail() {
  const { provider } = useParams<{ provider: string }>();
  const [data, setData] = useState<any>(null);
  const [history, setHistory] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchProviderData = async (force = false) => {
    try {
      if (force) setIsRefreshing(true);
      const res = await fetch(`/api/data-manager/${provider}${force ? '?force=true' : ''}`);
      if (!res.ok) throw new Error(`Failed to fetch ${provider} data`);
      const json = await res.json();
      setData(json);

      const histRes = await fetch(`/api/data-manager/history?provider=${provider}`);
      if (histRes.ok) {
        const histJson = await histRes.json();
        setHistory(histJson);
      }
      
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (provider) {
      setLoading(true);
      fetchProviderData();
    }
  }, [provider]);

  if (loading) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
        <div className="h-12 bg-white/5 rounded-2xl w-1/3 animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1,2,3].map(i => <div key={i} className="h-32 bg-white/5 rounded-2xl animate-pulse" />)}
        </div>
        <div className="h-64 bg-white/5 rounded-2xl animate-pulse" />
      </motion.div>
    );
  }

  if (error || !provider) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-lg mx-auto mt-12 p-6 rounded-2xl border border-red-500/30 text-center"
        style={{ background: 'rgba(239,68,68,0.05)' }}
      >
        <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">Failed to load {provider}</h2>
        <p className="text-red-400 text-sm font-mono break-all mb-1">{error}</p>
        <button
          onClick={() => fetchProviderData(true)}
          className="mt-4 flex items-center gap-2 mx-auto px-4 py-2 rounded-xl font-bold text-sm text-white bg-red-500/20 border border-red-500/30 hover:bg-red-500/30 transition-all"
        >
          <RefreshCw className="w-4 h-4" /> Retry
        </button>
      </motion.div>
    );
  }

  const info = getProviderInfo(provider);

  const renderSpecifics = () => {
    if (provider === 'firestore' && data.collections) {
      return (
        <div className="mt-8 space-y-4">
          <h3 className="text-xl font-medium">Collections</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.collections.map((col: any) => (
              <div key={col.name} className="bg-white/5 border border-white/10 rounded-xl p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-semibold text-[#FFC107]">{col.name}</span>
                  <span className="text-sm text-gray-400">{col.count} docs</span>
                </div>
                <div className="text-2xl font-bold">{formatBytes(col.sizeBytes)}</div>
              </div>
            ))}
          </div>
        </div>
      );
    }
    
    if (provider === 'supabase' && data.tables) {
      return (
        <div className="mt-8 space-y-4">
          <h3 className="text-xl font-medium">Top Tables</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.tables.slice(0, 10).map((table: any) => (
              <div key={table.name} className="bg-white/5 border border-white/10 rounded-xl p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-semibold text-[#6B8E23]">{table.name}</span>
                  <span className="text-sm text-gray-400">{table.rowCount} rows</span>
                </div>
                <div className="text-2xl font-bold">{formatBytes(table.totalSizeBytes)}</div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (provider === 'email') {
      return (
        <div className="mt-8 space-y-4">
          <h3 className="text-xl font-medium">Queue Status</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
              <span className="text-gray-400">Pending Emails</span>
              <div className="text-3xl font-bold text-[#FFC107]">{data.pending}</div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
              <span className="text-gray-400">Failed Emails</span>
              <div className="text-3xl font-bold text-red-500">{data.failed}</div>
            </div>
          </div>
        </div>
      );
    }

    if (provider === 'qdrant') {
      return (
        <div className="mt-8 space-y-4">
          <h3 className="text-xl font-medium">Vector Index</h3>
          <div className="grid grid-cols-1 gap-4">
            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
              <span className="text-gray-400">Total Vectors</span>
              <div className="text-3xl font-bold text-[#E91E63]">{data.vectorCount}</div>
            </div>
          </div>
        </div>
      );
    }

    return null;
  };

  const chartData = {
    labels: history?.recent?.map((h: any) => new Date(h.timestamp).toLocaleTimeString()) || [],
    datasets: [
      {
        label: 'Storage Used',
        data: history?.recent?.map((h: any) => h.used_bytes) || [],
        borderColor: info.color,
        backgroundColor: `${info.color}20`,
        fill: true,
        tension: 0.4,
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: any) => formatBytes(ctx.raw)
        }
      }
    },
    scales: {
      x: { display: false },
      y: {
        ticks: {
          callback: (value: any) => formatBytes(value)
        }
      }
    }
  };

  const percentage = data.capacityBytes ? (data.totalUsedBytes / data.capacityBytes) * 100 : 0;

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-8 pb-12"
    >
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <div className="p-3 rounded-2xl" style={{ backgroundColor: `${info.color}20`, color: info.color }}>
            <info.icon className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
              {info.label}
            </h1>
            <p className="text-gray-400 mt-1">Status: <span className={data.status === 'Healthy' ? 'text-green-400' : 'text-red-400'}>{data.status}</span></p>
          </div>
        </div>
        <button 
          onClick={() => fetchProviderData(true)}
          disabled={isRefreshing}
          className="flex items-center space-x-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Usage Card */}
        <div className="bg-[#161616]/60 backdrop-blur-md border border-white/10 rounded-3xl p-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 blur-[50px] rounded-full" style={{ backgroundColor: `${info.color}20` }} />
          <h3 className="text-lg font-medium text-gray-300 mb-2">Total Storage Used</h3>
          <div className="text-5xl font-bold mb-4">{formatBytes(data.totalUsedBytes)}</div>
          
          {data.capacityBytes && (
            <div className="space-y-2 mt-8">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Capacity limit</span>
                <span className="font-medium">{formatBytes(data.capacityBytes)}</span>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, percentage)}%` }}
                  className="h-full rounded-full"
                  style={{ backgroundColor: info.color }}
                />
              </div>
              <div className="text-right text-xs text-gray-500">{percentage.toFixed(2)}% used</div>
            </div>
          )}
        </div>

        {/* Chart Card */}
        <div className="bg-[#161616]/60 backdrop-blur-md border border-white/10 rounded-3xl p-8 h-64">
          <h3 className="text-lg font-medium text-gray-300 mb-4">Usage History</h3>
          {history?.recent?.length > 0 ? (
            <div className="w-full h-40">
              <Line data={chartData} options={chartOptions} />
            </div>
          ) : (
            <div className="flex h-40 items-center justify-center text-gray-500">
              No historical data yet
            </div>
          )}
        </div>
      </div>

      {renderSpecifics()}
    </motion.div>
  );
}
