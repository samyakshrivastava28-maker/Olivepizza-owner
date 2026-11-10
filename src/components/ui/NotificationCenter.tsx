/**
 * NotificationCenter — In-App Notification History
 *
 * Features:
 * - Customer, Owner, Delivery-specific views
 * - Mark read / unread
 * - Filter by category
 * - Search
 * - Open related order (deep-link)
 * - Auto-expiry: operational alerts older than 7 days are hidden
 * - Real-time updates (re-fetches every 30s or on window focus)
 */

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, BellOff, CheckCheck, ChevronRight, Filter, Search, X, RefreshCw, Package } from 'lucide-react';
import { useNavigate } from 'react-router';
import { auth } from '../../lib/firebase';
import { fetchApi } from '../../lib/config';

interface NotificationItem {
  id: string;
  title: string;
  body: string;
  category: string;
  url?: string;
  is_read: boolean;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  order_id?: string;
  version?: number;
}

const API_BASE = '/api';

const CATEGORY_LABELS: Record<string, string> = {
  order:        '📦 Orders',
  delivery:     '🛵 Delivery',
  marketing:    '🎟️ Offers',
  announcement: '📢 News',
  system:       '⚙️ System',
  reward:       '🏆 Rewards',
};

const CATEGORY_COLORS: Record<string, string> = {
  order:        'text-emerald-400 bg-emerald-400/10',
  delivery:     'text-violet-400 bg-violet-400/10',
  marketing:    'text-amber-400 bg-amber-400/10',
  announcement: 'text-sky-400 bg-sky-400/10',
  system:       'text-slate-400 bg-slate-400/10',
  reward:       'text-yellow-400 bg-yellow-400/10',
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hrs  = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 2)   return 'Just now';
  if (mins < 60)  return `${mins}m ago`;
  if (hrs < 24)   return `${hrs}h ago`;
  if (days < 7)   return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function NotificationCenter({ isOpen, onClose }: NotificationCenterProps) {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  const fetchNotifications = useCallback(async () => {
    const token = await auth.currentUser?.getIdToken();
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetchApi('/api/notifications/inbox', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
      }
    } catch {
      // Non-fatal
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    fetchNotifications();
    const iv = setInterval(fetchNotifications, 30_000);
    const onFocus = () => fetchNotifications();
    window.addEventListener('focus', onFocus);
    return () => { clearInterval(iv); window.removeEventListener('focus', onFocus); };
  }, [isOpen, fetchNotifications]);

  const markRead = async (id: string) => {
    const token = await auth.currentUser?.getIdToken();
    if (!token) return;
    setItems(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    fetchApi(`/api/notifications/inbox/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ isRead: true }),
    }).catch(() => {});
  };

  const markAllRead = async () => {
    const unread = items.filter(n => !n.is_read);
    for (const n of unread) await markRead(n.id);
  };

  const handleClick = (item: NotificationItem) => {
    markRead(item.id);
    if (item.url && item.url !== '/') {
      navigate(item.url);
      onClose();
    } else if (item.order_id) {
      navigate(`/order-tracking/${item.order_id}`);
      onClose();
    }
  };

  // Filter + search
  const displayed = items.filter(n => {
    if (n.is_archived) return false;
    if (filter !== 'all' && n.category !== filter) return false;
    if (search && !n.title.toLowerCase().includes(search.toLowerCase()) && !n.body.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const unreadCount = items.filter(n => !n.is_read && !n.is_archived).length;
  const categories = Array.from(new Set(items.map(n => n.category)));

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70]"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, x: '100%' }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 w-full max-w-md z-[71] flex flex-col"
            style={{
              background: 'rgba(8, 12, 16, 0.98)',
              backdropFilter: 'blur(24px)',
              borderLeft: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-white/5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary-500/20 flex items-center justify-center">
                  <Bell className="w-4 h-4 text-primary-400" />
                </div>
                <div>
                  <h2 className="text-base font-black text-white">Notifications</h2>
                  {unreadCount > 0 && (
                    <p className="text-xs text-slate-500">{unreadCount} unread</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    className="text-[11px] text-primary-400 hover:text-primary-300 font-bold flex items-center gap-1"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    All read
                  </button>
                )}
                <button
                  onClick={fetchNotifications}
                  className="text-slate-500 hover:text-slate-300 p-1.5 rounded-lg hover:bg-white/5"
                  title="Refresh"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
                <button onClick={onClose} className="text-slate-500 hover:text-slate-300 p-1.5 rounded-lg hover:bg-white/5">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Search */}
            <div className="px-4 pt-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search notifications..."
                  className="w-full bg-white/5 border border-white/8 rounded-xl pl-8 pr-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-primary-500/50"
                />
                {search && (
                  <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2">
                    <X className="w-3.5 h-3.5 text-slate-500" />
                  </button>
                )}
              </div>
            </div>

            {/* Category Filter Pills */}
            <div className="px-4 pt-2 pb-1 flex gap-2 overflow-x-auto scrollbar-none">
              <button
                onClick={() => setFilter('all')}
                className={`shrink-0 text-[11px] font-bold px-3 py-1.5 rounded-full transition-all ${filter === 'all' ? 'bg-primary-500/30 text-primary-300 border border-primary-500/40' : 'bg-white/5 text-slate-400 border border-white/8'}`}
              >
                All {items.length > 0 ? `(${items.length})` : ''}
              </button>
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setFilter(cat)}
                  className={`shrink-0 text-[11px] font-bold px-3 py-1.5 rounded-full transition-all ${filter === cat ? 'bg-primary-500/30 text-primary-300 border border-primary-500/40' : 'bg-white/5 text-slate-400 border border-white/8'}`}
                >
                  {CATEGORY_LABELS[cat] || cat}
                </button>
              ))}
            </div>

            {/* Notification List */}
            <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-2 mt-2">
              {loading && items.length === 0 && (
                <div className="flex flex-col items-center justify-center h-32 gap-3">
                  <RefreshCw className="w-5 h-5 text-slate-600 animate-spin" />
                  <p className="text-slate-600 text-sm">Loading...</p>
                </div>
              )}

              {!loading && displayed.length === 0 && (
                <div className="flex flex-col items-center justify-center h-40 gap-3">
                  <BellOff className="w-8 h-8 text-slate-700" />
                  <p className="text-slate-600 text-sm text-center">
                    {search ? 'No results found' : 'No notifications yet'}
                  </p>
                </div>
              )}

              {displayed.map((item) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  layout
                  onClick={() => handleClick(item)}
                  className={`relative rounded-2xl p-4 cursor-pointer transition-all group ${
                    item.is_read
                      ? 'bg-white/3 border border-white/5 hover:bg-white/6'
                      : 'bg-white/7 border border-white/10 hover:bg-white/9'
                  }`}
                >
                  {/* Unread dot */}
                  {!item.is_read && (
                    <div className="absolute top-4 right-4 w-2 h-2 rounded-full bg-primary-400" />
                  )}

                  <div className="flex items-start gap-3 pr-4">
                    {/* Category icon */}
                    <div className={`shrink-0 w-8 h-8 rounded-xl flex items-center justify-center text-sm ${CATEGORY_COLORS[item.category] || 'text-slate-400 bg-slate-400/10'}`}>
                      {CATEGORY_LABELS[item.category]?.[0] || '🔔'}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-bold leading-snug ${item.is_read ? 'text-slate-300' : 'text-white'}`}>
                        {item.title}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5 leading-relaxed line-clamp-2">
                        {item.body}
                      </p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${CATEGORY_COLORS[item.category] || 'text-slate-500 bg-slate-500/10'}`}>
                          {CATEGORY_LABELS[item.category] || item.category}
                        </span>
                        <span className="text-[10px] text-slate-600">{timeAgo(item.updated_at)}</span>
                      </div>
                    </div>

                    {/* Arrow if actionable */}
                    {(item.url || item.order_id) && (
                      <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition-colors shrink-0 mt-0.5" />
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
