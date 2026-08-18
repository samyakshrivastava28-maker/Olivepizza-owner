/**
 * Enterprise Owner Notification Center
 *
 * Features:
 * - Real-time live order activity feed (Firestore onSnapshot)
 * - Notification inbox from Postgres API (never-lost entries)
 * - Notification analytics dashboard (sent/delivered/opened/failed)
 * - Manual push notification sender to segments
 * - DND preferences toggle
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { db, auth } from '../../lib/firebase';
import { collection, query, orderBy, limit, onSnapshot, where } from 'firebase/firestore';
import { Bell, CheckCircle, PackageOpen, AlertTriangle, X, Send, BarChart2, Inbox, Settings, RefreshCw, Users, Zap, ChevronDown } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { fetchApi } from '../../lib/config';

type Tab = 'inbox' | 'analytics' | 'send' | 'settings';

interface InboxItem {
  id: string;
  title: string;
  body: string;
  category: string;
  is_read: boolean;
  created_at: string;
  order_id?: string;
  url?: string;
}

interface Analytics {
  period_date: string;
  category: string;
  sent_count: number;
  delivered_count: number;
  opened_count: number;
  failed_count: number;
}

async function getAuthHeader(): Promise<Record<string, string>> {
  const token = await auth.currentUser?.getIdToken();
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

export default function OwnerNotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('inbox');
  const [unreadCount, setUnreadCount] = useState(0);
  const [liveOrders, setLiveOrders] = useState<any[]>([]);
  const [inbox, setInbox] = useState<InboxItem[]>([]);
  const [analytics, setAnalytics] = useState<Analytics[]>([]);
  const [queueStats, setQueueStats] = useState<any[]>([]);
  const [tokenStats, setTokenStats] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Send Form State
  const [sendForm, setSendForm] = useState({ title: '', body: '', audience: 'all', category: 'announcement', url: '' });
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState('');

  // DND State
  const [prefs, setPrefs] = useState({ muteMarketing: false, muteLowPriority: false });

  const dropdownRef = useRef<HTMLDivElement>(null);

  // ─── Live Orders Feed (Firestore) ─────────────────────────────────────────
  useEffect(() => {
    const q = query(
      collection(db, 'orders'),
      where('status', 'not-in', ['delivered', 'completed', 'cancelled']),
      orderBy('status'),
      orderBy('updatedAt', 'desc'),
      limit(15)
    );
    const unsub = onSnapshot(q, snap => {
      const orders = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setLiveOrders(orders);
      setUnreadCount(orders.filter((o: any) => o.status === 'pending').length);
    });
    return () => unsub();
  }, []);

  // ─── Close on outside click ───────────────────────────────────────────────
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // ─── Fetch Inbox ───────────────────────────────────────────────────────────
  const fetchInbox = useCallback(async () => {
    try {
      const headers = await getAuthHeader();
      const res = await fetchApi('/api/notifications/inbox', { headers });
      if (res.ok) {
        const data = await res.json();
        setInbox(data.items || []);
      }
    } catch {}
  }, []);

  // ─── Fetch Analytics ───────────────────────────────────────────────────────
  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const headers = await getAuthHeader();
      const res = await fetchApi('/api/notifications/analytics', { headers });
      if (res.ok) {
        const data = await res.json();
        setAnalytics(data.analytics || []);
        setQueueStats(data.queue || []);
        setTokenStats(data.tokens || []);
      }
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  // ─── Fetch Preferences ───────────────────────────────────────────────────
  const fetchPrefs = useCallback(async () => {
    try {
      const headers = await getAuthHeader();
      const res = await fetchApi('/api/notifications/preferences', { headers });
      if (res.ok) {
        const data = await res.json();
        if (data.preferences) {
          setPrefs({
            muteMarketing: data.preferences.mute_marketing,
            muteLowPriority: data.preferences.mute_low_priority,
          });
        }
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchInbox();
      if (activeTab === 'analytics') fetchAnalytics();
      if (activeTab === 'settings') fetchPrefs();
    }
  }, [isOpen, activeTab, fetchInbox, fetchAnalytics, fetchPrefs]);

  // ─── Mark Read ─────────────────────────────────────────────────────────────
  const markRead = async (id: string) => {
    const headers = await getAuthHeader();
    await fetchApi(`/api/notifications/inbox/${id}`, {
      method: 'PATCH', headers, body: JSON.stringify({ isRead: true }),
    });
    setInbox(prev => prev.map(i => i.id === id ? { ...i, is_read: true } : i));
  };

  // ─── Send Notification ─────────────────────────────────────────────────────
  const handleSend = async () => {
    if (!sendForm.title || !sendForm.body) { setSendResult('Title and body are required'); return; }
    setSending(true);
    setSendResult('');
    try {
      const headers = await getAuthHeader();
      const res = await fetchApi('/api/notifications/send-custom', {
        method: 'POST', headers, body: JSON.stringify(sendForm),
      });
      const data = await res.json();
      setSendResult(res.ok ? `✅ ${data.message}` : `❌ ${data.error}`);
      if (res.ok) setSendForm(f => ({ ...f, title: '', body: '' }));
    } catch {
      setSendResult('❌ Network error');
    } finally {
      setSending(false);
    }
  };

  // ─── Save Preferences ─────────────────────────────────────────────────────
  const savePrefs = async () => {
    const headers = await getAuthHeader();
    await fetchApi('/api/notifications/preferences', {
      method: 'POST', headers, body: JSON.stringify(prefs),
    });
    setSendResult('✅ Preferences saved');
  };

  // ─── Status Helpers ───────────────────────────────────────────────────────
  const statusConfig: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
    pending: { icon: <Bell className="w-4 h-4" />, label: 'New Order', color: '#f97316' },
    accepted: { icon: <CheckCircle className="w-4 h-4" />, label: 'Accepted', color: '#22c55e' },
    preparing: { icon: <span className="text-xs">🔥</span>, label: 'Preparing', color: '#f59e0b' },
    ready: { icon: <span className="text-xs">🟢</span>, label: 'Ready', color: '#10b981' },
    partner_assigned: { icon: <PackageOpen className="w-4 h-4" />, label: 'Assigned', color: '#3b82f6' },
    out_for_delivery: { icon: <span className="text-xs">🛵</span>, label: 'Out for Delivery', color: '#8b5cf6' },
    delivered: { icon: <CheckCircle className="w-4 h-4" />, label: 'Delivered', color: '#10b981' },
    cancelled: { icon: <AlertTriangle className="w-4 h-4" />, label: 'Cancelled', color: '#ef4444' },
  };

  const tabs: { key: Tab; icon: React.ReactNode; label: string }[] = [
    { key: 'inbox', icon: <Inbox className="w-4 h-4" />, label: 'Inbox' },
    { key: 'analytics', icon: <BarChart2 className="w-4 h-4" />, label: 'Analytics' },
    { key: 'send', icon: <Send className="w-4 h-4" />, label: 'Send' },
    { key: 'settings', icon: <Settings className="w-4 h-4" />, label: 'DND' },
  ];

  const totalSent = analytics.reduce((s, a) => s + (a.sent_count || 0), 0);
  const totalDelivered = analytics.reduce((s, a) => s + (a.delivered_count || 0), 0);
  const totalOpened = analytics.reduce((s, a) => s + (a.opened_count || 0), 0);
  const totalFailed = analytics.reduce((s, a) => s + (a.failed_count || 0), 0);
  const successRate = totalSent > 0 ? Math.round((totalDelivered / totalSent) * 100) : 0;
  const activeTokens = tokenStats.find((t: any) => t.is_active)?.count || 0;
  const invalidTokens = tokenStats.find((t: any) => !t.is_active)?.count || 0;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-slate-300 hover:text-white transition-all bg-white/5 rounded-full hover:bg-white/10"
        style={{ border: '1px solid rgba(255,255,255,0.07)' }}
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <motion.span
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="absolute -top-0.5 -right-0.5 w-4 h-4 text-white text-[10px] font-black rounded-full border-2 border-[#0a0a0a] flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #f97316, #ef4444)' }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </motion.span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            className="absolute right-0 mt-3 w-80 md:w-96 rounded-2xl overflow-hidden z-[200] shadow-2xl"
            style={{
              background: 'rgba(10,10,10,0.97)',
              backdropFilter: 'blur(24px)',
              border: '1px solid rgba(255,255,255,0.08)',
              boxShadow: '0 25px 80px rgba(0,0,0,0.7)',
            }}
          >
            {/* Header */}
            <div
              className="p-4 flex items-center justify-between"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
            >
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                <h3 className="text-white font-black text-sm">Notification Center</h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-500">{liveOrders.length} active orders</span>
                <button onClick={() => setIsOpen(false)} className="text-slate-500 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Tab Bar */}
            <div
              className="flex"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
            >
              {tabs.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className="flex-1 flex flex-col items-center gap-1 py-2.5 text-[10px] font-bold transition-all"
                  style={{
                    color: activeTab === tab.key ? '#f97316' : 'rgba(100,116,139,0.8)',
                    borderBottom: activeTab === tab.key ? '2px solid #f97316' : '2px solid transparent',
                  }}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="max-h-[420px] overflow-y-auto" style={{ scrollbarWidth: 'none' }}>

              {/* INBOX TAB */}
              {activeTab === 'inbox' && (
                <div>
                  {/* Live Orders */}
                  {liveOrders.length > 0 && (
                    <div>
                      <div className="px-4 pt-3 pb-1">
                        <p className="text-[10px] font-black tracking-widest uppercase text-orange-500">Live Orders</p>
                      </div>
                      {liveOrders.map(order => {
                        const cfg = statusConfig[order.status] || statusConfig.pending;
                        return (
                          <div
                            key={order.id}
                            className="px-4 py-3 flex items-center gap-3 hover:bg-white/3 transition-colors cursor-pointer"
                            style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                            onClick={() => window.location.href = `/owner/orders/${order.id}`}
                          >
                            <div
                              className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                              style={{ background: `${cfg.color}15`, color: cfg.color, border: `1px solid ${cfg.color}30` }}
                            >
                              {cfg.icon}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-slate-200 font-bold text-xs truncate">
                                {order.dailyOrderNumber || `#${order.id.slice(-6).toUpperCase()}`} — {cfg.label}
                              </p>
                              <p className="text-slate-500 text-[10px]">₹{order.totalAmount || order.total_amount || '?'}</p>
                            </div>
                            <span className="text-[10px] text-slate-600">
                              {order.updatedAt ? new Date(order.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Notification Inbox */}
                  <div className="px-4 pt-3 pb-1">
                    <p className="text-[10px] font-black tracking-widest uppercase text-slate-500">Notification Inbox</p>
                  </div>
                  {inbox.length === 0 ? (
                    <div className="p-6 text-center text-slate-600 text-xs">No notifications</div>
                  ) : (
                    inbox.map(item => (
                      <div
                        key={item.id}
                        className="px-4 py-3 flex items-start gap-3 hover:bg-white/3 transition-colors cursor-pointer"
                        style={{
                          borderBottom: '1px solid rgba(255,255,255,0.04)',
                          background: item.is_read ? 'transparent' : 'rgba(249,115,22,0.04)',
                        }}
                        onClick={() => markRead(item.id)}
                      >
                        {!item.is_read && <div className="w-1.5 h-1.5 rounded-full bg-orange-500 flex-shrink-0 mt-1.5" />}
                        <div className="flex-1 min-w-0">
                          <p className="text-slate-200 font-bold text-xs leading-snug">{item.title}</p>
                          <p className="text-slate-500 text-[10px] mt-0.5 line-clamp-2">{item.body}</p>
                        </div>
                        <span className="text-[10px] text-slate-600 flex-shrink-0">
                          {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* ANALYTICS TAB */}
              {activeTab === 'analytics' && (
                <div className="p-4 space-y-4">
                  {loading ? (
                    <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" /></div>
                  ) : (
                    <>
                      {/* Summary Stats */}
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { label: 'Sent (7d)', value: totalSent, color: '#3b82f6' },
                          { label: 'Delivered', value: totalDelivered, color: '#22c55e' },
                          { label: 'Opened', value: totalOpened, color: '#f97316' },
                          { label: 'Failed', value: totalFailed, color: '#ef4444' },
                        ].map(stat => (
                          <div key={stat.label} className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                            <p className="text-[10px] text-slate-500 font-semibold">{stat.label}</p>
                            <p className="text-xl font-black" style={{ color: stat.color }}>{stat.value.toLocaleString()}</p>
                          </div>
                        ))}
                      </div>

                      {/* Success Rate Bar */}
                      <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <div className="flex justify-between items-center mb-2">
                          <p className="text-[10px] text-slate-400 font-semibold">Success Rate</p>
                          <p className="text-sm font-black text-green-400">{successRate}%</p>
                        </div>
                        <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${successRate}%` }}
                            transition={{ duration: 1, ease: 'easeOut' }}
                            className="h-full rounded-full"
                            style={{ background: 'linear-gradient(90deg, #22c55e, #10b981)' }}
                          />
                        </div>
                      </div>

                      {/* Token Stats */}
                      <div className="rounded-xl p-3 space-y-1.5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Device Tokens</p>
                        <div className="flex justify-between">
                          <span className="text-[11px] text-slate-400">Active</span>
                          <span className="text-[11px] font-bold text-green-400">{activeTokens}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[11px] text-slate-400">Invalid/Deactivated</span>
                          <span className="text-[11px] font-bold text-red-400">{invalidTokens}</span>
                        </div>
                      </div>

                      {/* Queue Stats */}
                      <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-2">Queue Status</p>
                        {queueStats.map((s: any) => (
                          <div key={s.status} className="flex justify-between py-0.5">
                            <span className="text-[11px] text-slate-400 capitalize">{s.status}</span>
                            <span className="text-[11px] font-bold text-slate-300">{s.count}</span>
                          </div>
                        ))}
                      </div>

                      <button
                        onClick={fetchAnalytics}
                        className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white border border-white/10 hover:bg-white/5"
                      >
                        <RefreshCw className="w-3 h-3" /> Refresh
                      </button>
                    </>
                  )}
                </div>
              )}

              {/* SEND TAB */}
              {activeTab === 'send' && (
                <div className="p-4 space-y-3">
                  <p className="text-xs text-slate-400">Send a push notification to a segment of your users.</p>

                  <input
                    className="w-full rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-600 outline-none"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
                    placeholder="Title *"
                    value={sendForm.title}
                    onChange={e => setSendForm(f => ({ ...f, title: e.target.value }))}
                  />
                  <textarea
                    className="w-full rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-600 outline-none resize-none"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
                    placeholder="Body message *"
                    rows={3}
                    value={sendForm.body}
                    onChange={e => setSendForm(f => ({ ...f, body: e.target.value }))}
                  />

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-[10px] text-slate-500 mb-1">Audience</p>
                      <select
                        className="w-full rounded-xl px-3 py-2 text-xs text-white outline-none"
                        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
                        value={sendForm.audience}
                        onChange={e => setSendForm(f => ({ ...f, audience: e.target.value }))}
                      >
                        <option value="all">All Users</option>
                        <option value="customers">Customers</option>
                        <option value="delivery">Delivery</option>
                      </select>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500 mb-1">Category</p>
                      <select
                        className="w-full rounded-xl px-3 py-2 text-xs text-white outline-none"
                        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
                        value={sendForm.category}
                        onChange={e => setSendForm(f => ({ ...f, category: e.target.value }))}
                      >
                        <option value="announcement">Announcement</option>
                        <option value="coupon">Coupon / Offer</option>
                        <option value="marketing">Marketing</option>
                        <option value="alert">System Alert</option>
                      </select>
                    </div>
                  </div>

                  <input
                    className="w-full rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 outline-none"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
                    placeholder="Deep link URL (optional)"
                    value={sendForm.url}
                    onChange={e => setSendForm(f => ({ ...f, url: e.target.value }))}
                  />

                  {sendResult && (
                    <p className={`text-xs font-bold ${sendResult.startsWith('✅') ? 'text-green-400' : 'text-red-400'}`}>{sendResult}</p>
                  )}

                  <button
                    onClick={handleSend}
                    disabled={sending}
                    className="w-full py-2.5 rounded-xl text-white text-sm font-black flex items-center justify-center gap-2 transition-all"
                    style={{ background: sending ? 'rgba(249,115,22,0.4)' : 'linear-gradient(135deg, #f97316, #ea580c)', boxShadow: '0 4px 16px rgba(249,115,22,0.3)' }}
                  >
                    {sending ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Sending...</> : <><Send className="w-4 h-4" /> Send Notification</>}
                  </button>
                </div>
              )}

              {/* DND SETTINGS TAB */}
              {activeTab === 'settings' && (
                <div className="p-4 space-y-4">
                  <p className="text-xs text-slate-400">Configure Do Not Disturb preferences.</p>

                  {[
                    { key: 'muteMarketing', label: 'Mute Marketing & Announcements', desc: 'Hides non-essential push messages' },
                    { key: 'muteLowPriority', label: 'Mute Low Priority Notifications', desc: 'Only receive high and critical alerts' },
                  ].map(pref => (
                    <div key={pref.key} className="flex items-start gap-3 rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div className="flex-1">
                        <p className="text-white text-xs font-bold">{pref.label}</p>
                        <p className="text-slate-500 text-[10px] mt-0.5">{pref.desc}</p>
                      </div>
                      <button
                        onClick={() => setPrefs(p => ({ ...p, [pref.key]: !p[pref.key as keyof typeof p] }))}
                        className="w-10 h-5 rounded-full flex-shrink-0 transition-all relative"
                        style={{ background: prefs[pref.key as keyof typeof prefs] ? '#f97316' : 'rgba(100,116,139,0.3)' }}
                      >
                        <span
                          className="absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all shadow"
                          style={{ left: prefs[pref.key as keyof typeof prefs] ? '22px' : '2px' }}
                        />
                      </button>
                    </div>
                  ))}

                  <div className="rounded-xl p-3 text-xs text-orange-400 font-bold" style={{ background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.15)' }}>
                    ⚡ Critical alerts (New Orders, Emergency) always break through DND.
                  </div>

                  <button
                    onClick={savePrefs}
                    className="w-full py-2.5 rounded-xl text-white text-sm font-black"
                    style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)', boxShadow: '0 4px 16px rgba(249,115,22,0.3)' }}
                  >
                    Save Preferences
                  </button>
                </div>
              )}
            </div>

            {/* Footer */}
            <div
              className="p-3 flex items-center justify-between"
              style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
            >
              <a
                href="/owner/orders"
                className="text-[10px] font-black uppercase tracking-widest text-orange-500 hover:text-orange-400"
              >
                All Orders ↗
              </a>
              <p className="text-[10px] text-slate-600">Live updates enabled</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
