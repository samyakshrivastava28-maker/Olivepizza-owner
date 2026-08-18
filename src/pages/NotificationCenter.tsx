import React, { useState } from 'react';
import { fetchApi } from '../lib/api';
import { soundPlayer } from '../lib/audio';
import { Bell, Send, Volume2, Radio, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function NotificationCenter() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState<'all' | 'customers' | 'delivery' | 'owner'>('customers');
  const [sending, setSending] = useState(false);

  const handleSendNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    try {
      const res = await fetchApi('/api/notifications/send-custom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          body: body.trim(),
          audience,
          data: { url: '/menu' },
        }),
      });

      if (!res.ok) throw new Error('Failed to broadcast push notification');

      const data = await res.json();
      toast.success(`Push notification sent to ${data.sentCount || 'selected'} devices.`);
      setTitle('');
      setBody('');
    } catch (err: any) {
      toast.error('Send failed: ' + err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl sm:text-2xl font-black text-white">Notification Center</h2>
        <p className="text-xs text-slate-400">Broadcast Firebase Cloud Messaging (FCM) push alerts and test audio alarms.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Push Broadcaster Form */}
        <div className="lg:col-span-7 bg-[#131B2B] border border-slate-800 rounded-2xl p-6">
          <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <Bell className="w-4 h-4 text-orange-400" />
            Send Custom Push Notification
          </h3>

          <form onSubmit={handleSendNotification} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-300 uppercase block mb-1">Target Audience</label>
              <select
                value={audience}
                onChange={(e) => setAudience(e.target.value as any)}
                className="w-full p-2.5 bg-[#0E1524] border border-slate-800 rounded-xl text-xs text-white focus:border-orange-500 focus:outline-none"
              >
                <option value="customers">All Registered Customers</option>
                <option value="delivery">Active Delivery Fleet</option>
                <option value="owner">Restaurant Owner & Staff Devices</option>
                <option value="all">Everyone (Global Broadcast)</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300 uppercase block mb-1">Notification Title</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="🔥 Weekend Pizza Craving? Flat 20% OFF!"
                className="w-full p-2.5 bg-[#0E1524] border border-slate-800 rounded-xl text-xs text-white focus:border-orange-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300 uppercase block mb-1">Notification Body</label>
              <textarea
                required
                rows={3}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Order your favourite handcrafted pizza now. Fast 30 min delivery to your door!"
                className="w-full p-2.5 bg-[#0E1524] border border-slate-800 rounded-xl text-xs text-white focus:border-orange-500 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={sending}
              className="px-6 py-2.5 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-xl text-xs flex items-center gap-2 transition-all shadow-lg shadow-orange-600/20 disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              {sending ? 'Broadcasting...' : 'Broadcast Push Notification'}
            </button>
          </form>
        </div>

        {/* Right: Audio Sound Alerts Tester */}
        <div className="lg:col-span-5 bg-[#131B2B] border border-slate-800 rounded-2xl p-6 space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-emerald-400" />
            Audio Alert Sound Tester
          </h3>
          <p className="text-xs text-slate-400">
            Verify that your device speakers can play emergency order chimes and status beeps without delay.
          </p>

          <div className="space-y-3 pt-2">
            <button
              onClick={() => {
                soundPlayer.playNewOrderAlarm();
                toast.success('Playing: New Order Emergency Chime');
              }}
              className="w-full p-3 bg-[#0E1524] hover:bg-slate-800 border border-slate-800 rounded-xl text-xs font-bold text-left flex items-center justify-between text-white transition-colors"
            >
              <span>🚨 Incoming Order Alarm</span>
              <Volume2 className="w-4 h-4 text-orange-400" />
            </button>

            <button
              onClick={() => {
                soundPlayer.playStatusUpdate();
                toast.success('Playing: Order Status Beep');
              }}
              className="w-full p-3 bg-[#0E1524] hover:bg-slate-800 border border-slate-800 rounded-xl text-xs font-bold text-left flex items-center justify-between text-white transition-colors"
            >
              <span>🔔 Status Advancement Beep</span>
              <Volume2 className="w-4 h-4 text-blue-400" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
