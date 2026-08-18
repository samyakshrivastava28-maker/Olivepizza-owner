import { useState, useEffect, useMemo } from 'react';
import { GlassCard } from '../components/ui/glass/GlassSystem';
import { Bell, Clock, RefreshCw, CheckCircle, XCircle, Trash2, Eye } from 'lucide-react';
import { collection, query, orderBy, onSnapshot, where, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';
import AIDeepSeekAssistantChatbox from '../components/owner/AIDeepSeekAssistantChatbox';
import { fetchApi } from '../lib/config';

interface NotificationLog {
  id: string;
  userId: string;
  type: string;
  category: string;
  title: string;
  body: string;
  status: string;
  stage: string;
  error?: string;
  tokensFound: number;
  timestamp: string;
  updatedAt: string;
}

export default function OwnerNotificationCenter() {
  const [filter, setFilter] = useState<string>('all');
  const [notifications, setNotifications] = useState<NotificationLog[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  
  useEffect(() => {
    // Only fetch today and yesterday for efficiency as per requirements
    const now = new Date();
    const startOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).toISOString();
    
    const q = query(
      collection(db, 'notification_history'),
      limit(200)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as NotificationLog));
      logs.sort((a, b) => {
        const aTime = new Date(a.timestamp || a.updatedAt || 0).getTime();
        const bTime = new Date(b.timestamp || b.updatedAt || 0).getTime();
        return bTime - aTime;
      });
      setNotifications(logs);
    }, (error) => {
      console.error("Error fetching notifications:", error);
    });

    return () => unsub();
  }, []);

  const stats = useMemo(() => {
    let sent = 0, delivered = 0, failed = 0, opened = 0;
    notifications.forEach(n => {
      if (['sent', 'delivered', 'opened', 'clicked'].includes(n.status)) sent++;
      if (['delivered', 'opened', 'clicked'].includes(n.status)) delivered++;
      if (n.status === 'failed') failed++;
      if (['opened', 'clicked'].includes(n.status)) opened++;
    });
    return { sent, delivered, failed, opened };
  }, [notifications]);

  const filtered = notifications.filter(n => {
    if (filter === 'all') return true;
    if (filter === 'pending') return n.status === 'pending';
    if (filter === 'failed') return n.status === 'failed';
    if (filter === 'delivered') return n.status === 'delivered';
    if (filter === 'opened') return n.status === 'opened' || n.status === 'clicked';
    return true;
  });

  const [selectedAudience, setSelectedAudience] = useState<string>('all');

  const handleSendBroadcast = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const title = (form.elements.namedItem('title') as HTMLInputElement).value;
    const body = (form.elements.namedItem('body') as HTMLTextAreaElement).value;
    const audience = (form.elements.namedItem('audience') as HTMLSelectElement).value;
    const targetUser = (form.elements.namedItem('targetUser') as HTMLInputElement)?.value;

    if (!title || !body) return toast.error('Title and body required');
    if (audience === 'specific' && !targetUser) return toast.error('Target UID or Email is required');
    
    setIsSending(true);
    try {
      const { getCurrentAuthToken } = await import('../lib/firebase');
      const token = await getCurrentAuthToken();
      const res = await fetchApi('/api/notifications/send-custom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ title, body, audience, targetUser, category: 'broadcast' })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message);
        form.reset();
        setSelectedAudience('all');
      } else {
        toast.error(`Failed: ${data.error}`);
      }
    } catch (err: any) {
      toast.error(`Error: ${err.message}`);
    } finally {
      setIsSending(false);
    }
  };

  const handleRetryFailed = async () => {
    try {
      const { getCurrentAuthToken } = await import('../lib/firebase');
      const token = await getCurrentAuthToken();
      const res = await fetchApi('/api/notifications/retry-failed', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) toast.success(data.message);
      else toast.error(data.error);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleClearHistory = async (range: 'today' | 'yesterday') => {
    if (!confirm(`Are you sure you want to permanently delete ${range}'s notification history?`)) return;
    setIsClearing(true);
    try {
      const { getCurrentAuthToken } = await import('../lib/firebase');
      const token = await getCurrentAuthToken();
      const res = await fetchApi('/api/notifications/clear-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ timeRange: range })
      });
      if (res.ok) toast.success(`Cleared ${range}'s history.`);
      else toast.error('Failed to clear history');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setIsClearing(false);
    }
  };

  const handleDeleteLog = async (id: string) => {
    if (!confirm('Delete this notification log?')) return;
    try {
      const { getCurrentAuthToken } = await import('../lib/firebase');
      const token = await getCurrentAuthToken();
      await fetchApi(`/api/notifications/log/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      toast.success('Log deleted');
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const [titleInput, setTitleInput] = useState('');
  const [bodyInput, setBodyInput] = useState('');
  const [aiTopicInput, setAiTopicInput] = useState('');
  const [isGeneratingAiNotif, setIsGeneratingAiNotif] = useState(false);

  const handleGenerateAINotification = async () => {
    if (!aiTopicInput.trim()) {
      toast.error('Please enter a notification topic or offer first!');
      return;
    }
    setIsGeneratingAiNotif(true);
    const toastId = toast.loading('Generating notification with DeepSeek V4 Flash...');
    try {
      const res = await fetchApi('/api/ai/generate-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: aiTopicInput.trim(),
          offerDetails: aiTopicInput.trim(),
          targetAudience: selectedAudience,
        }),
      });
      const data = await res.json();
      if (data.success && data.title && data.body) {
        setTitleInput(data.title);
        setBodyInput(data.body);
        toast.success(`✨ Title & Body generated via ${data.model || 'DeepSeek V4 Flash'}!`, { id: toastId });
      } else {
        toast.error(data.error || 'Failed to generate notification', { id: toastId });
      }
    } catch (err: any) {
      toast.error('Generation error: ' + err.message, { id: toastId });
    }
    setIsGeneratingAiNotif(false);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-black text-white">Notification Center</h1>
          <p className="text-slate-400">View real-time notification delivery status and send broadcasts.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => handleClearHistory('yesterday')} disabled={isClearing} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm font-bold transition-colors">Clear Yesterday</button>
          <button onClick={() => handleClearHistory('today')} disabled={isClearing} className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-sm font-bold transition-colors">Clear Today</button>
        </div>
      </div>

      {/* Live Counters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <GlassCard className="p-4 flex flex-col items-center justify-center text-center">
          <Bell className="w-8 h-8 text-blue-400 mb-2" />
          <div className="text-2xl font-black text-white">{stats.sent}</div>
          <div className="text-xs text-slate-400 uppercase tracking-wider font-bold">Sent (Total)</div>
        </GlassCard>
        <GlassCard className="p-4 flex flex-col items-center justify-center text-center">
          <CheckCircle className="w-8 h-8 text-green-400 mb-2" />
          <div className="text-2xl font-black text-green-400">{stats.delivered}</div>
          <div className="text-xs text-slate-400 uppercase tracking-wider font-bold">Delivered</div>
        </GlassCard>
        <GlassCard className="p-4 flex flex-col items-center justify-center text-center">
          <Eye className="w-8 h-8 text-purple-400 mb-2" />
          <div className="text-2xl font-black text-purple-400">{stats.opened}</div>
          <div className="text-xs text-slate-400 uppercase tracking-wider font-bold">Opened</div>
        </GlassCard>
        <GlassCard className="p-4 flex flex-col items-center justify-center text-center border-b-4 border-red-500 relative">
          <XCircle className="w-8 h-8 text-red-400 mb-2" />
          <div className="text-2xl font-black text-red-400">{stats.failed}</div>
          <div className="text-xs text-slate-400 uppercase tracking-wider font-bold">Failed</div>
          {stats.failed > 0 && (
            <button onClick={handleRetryFailed} className="absolute top-2 right-2 p-1.5 bg-red-500/20 hover:bg-red-500 text-red-400 hover:text-white rounded-md transition-colors" title="Retry All Failed">
              <RefreshCw className="w-4 h-4" />
            </button>
          )}
        </GlassCard>
      </div>

      {/* Compose Push Notification */}
      <GlassCard className="p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">Send Custom Notification</h2>
          <span className="text-xs px-2.5 py-1 rounded-full bg-purple-500/20 text-purple-300 font-bold border border-purple-500/30">
            Powered by DeepSeek V4 Flash
          </span>
        </div>

        {/* Interactive DeepSeek V4 Flash Notification Assistant Chatbox */}
        <AIDeepSeekAssistantChatbox
          mode="notification"
          contextData={{
            audience: selectedAudience,
          }}
          onApplyOutput={(output) => {
            if (output.title) {
              setTitleInput(output.title);
            }
            if (output.body) {
              setBodyInput(output.body);
            }
          }}
        />

        <form onSubmit={handleSendBroadcast} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-400 mb-1">Notification Title</label>
              <input
                name="title"
                required
                value={titleInput}
                onChange={(e) => setTitleInput(e.target.value)}
                placeholder="e.g. 🍕 50% Off Pizza Today!"
                className="w-full bg-dark-900 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-400 mb-1">Target Audience</label>
              <select
                name="audience"
                value={selectedAudience}
                onChange={(e) => setSelectedAudience(e.target.value)}
                className="w-full bg-dark-900 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary-500"
              >
                <option value="all">All Users</option>
                <option value="customers">Only Customers</option>
                <option value="delivery">Only Delivery Partners</option>
                <option value="owners">Only Owners / Admins</option>
                <option value="specific">Specific User (by UID or Email)</option>
              </select>
            </div>
          </div>

          {selectedAudience === 'specific' && (
            <div>
              <label className="block text-sm font-bold text-slate-400 mb-1">Target User (UID or Email)</label>
              <input name="targetUser" required placeholder="e.g. customer@gmail.com or UID..." className="w-full bg-dark-900 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary-500" />
            </div>
          )}

          <div>
            <label className="block text-sm font-bold text-slate-400 mb-1">Message Body</label>
            <textarea
              name="body"
              required
              value={bodyInput}
              onChange={(e) => setBodyInput(e.target.value)}
              placeholder="Enter the push notification text here..."
              className="w-full bg-dark-900 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary-500 min-h-[100px]"
            ></textarea>
          </div>
          <div className="flex justify-end gap-3">
            <button type="submit" disabled={isSending} className="px-6 py-3 bg-primary-600 hover:bg-primary-500 text-white font-bold rounded-xl transition-colors disabled:opacity-50">
              {isSending ? 'Queuing...' : 'Send Now'}
            </button>
          </div>
        </form>
      </GlassCard>

      {/* Live Activity Feed */}
      <GlassCard className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            Live Activity Feed
          </h2>
          <div className="flex gap-2">
            {['all', 'pending', 'delivered', 'opened', 'failed'].map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-colors ${filter === f ? 'bg-primary-500 text-white' : 'bg-white/5 text-slate-300 hover:bg-white/10'}`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
          {filtered.length === 0 && (
             <div className="text-center py-10 text-slate-500">No notifications found.</div>
          )}
          {filtered.map(n => (
            <div key={n.id} className="flex items-center justify-between p-4 rounded-xl bg-slate-800/50 border border-white/5 group hover:bg-slate-800 transition-colors">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-full ${n.status === 'pending' ? 'bg-amber-500/20 text-amber-400' : (n.status === 'delivered' || n.status === 'opened' || n.status === 'clicked') ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                  <Bell className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-md">{n.title} <span className="text-xs font-normal text-slate-500">to {n.userId.substring(0, 8)}...</span></h3>
                  <div className="text-xs text-slate-400 flex items-center gap-2 mt-1">
                    <Clock className="w-3 h-3" /> {formatDistanceToNow(new Date(n.timestamp), { addSuffix: true })} 
                    <span className="text-slate-600">|</span> 
                    <span className="font-mono text-primary-400">{n.stage}</span>
                    {n.error && <span className="text-red-400 truncate max-w-[200px]">({n.error})</span>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${n.status === 'pending' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/20' : (n.status === 'delivered' || n.status === 'opened' || n.status === 'clicked') ? 'bg-green-500/20 text-green-400 border border-green-500/20' : 'bg-red-500/20 text-red-400 border border-red-500/20'}`}>
                  {n.status}
                </span>
                <button onClick={() => handleDeleteLog(n.id)} className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 bg-white/5 hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-all" title="Delete Log">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}
