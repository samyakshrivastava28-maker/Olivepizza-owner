import React, { useState } from 'react';
import { fetchApi } from '../lib/api';
import { Mail, Send, CheckCircle2, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function EmailCenter() {
  const [recipient, setRecipient] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    try {
      const res = await fetchApi('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: recipient.trim(),
          subject: subject.trim(),
          text: message.trim(),
          html: `<div style="font-family: sans-serif; padding: 20px; background: #0B0F17; color: #fff;">
                  <h2 style="color: #F97316;">Olive Pizza</h2>
                  <p>${message.replace(/\n/g, '<br/>')}</p>
                </div>`,
        }),
      });

      if (!res.ok) throw new Error('Email server rejected transmission.');

      toast.success('Email dispatched via Olive Pizza SMTP queue.');
      setRecipient('');
      setSubject('');
      setMessage('');
    } catch (err: any) {
      toast.error('Send failed: ' + err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl sm:text-2xl font-black text-white">Email Center</h2>
        <p className="text-xs text-slate-400">Send customer receipts, promotional announcements, and transactional notices.</p>
      </div>

      <div className="bg-[#131B2B] border border-slate-800 rounded-2xl p-6 max-w-2xl">
        <form onSubmit={handleSendEmail} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-300 uppercase block mb-1">Recipient Email</label>
            <input
              type="email"
              required
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="customer@example.com"
              className="w-full p-2.5 bg-[#0E1524] border border-slate-800 rounded-xl text-xs text-white focus:border-orange-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-300 uppercase block mb-1">Email Subject</label>
            <input
              type="text"
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Your Fresh Pizza Order Update"
              className="w-full p-2.5 bg-[#0E1524] border border-slate-800 rounded-xl text-xs text-white focus:border-orange-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-300 uppercase block mb-1">Message Content</label>
            <textarea
              required
              rows={5}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Write your email announcement or order update here..."
              className="w-full p-2.5 bg-[#0E1524] border border-slate-800 rounded-xl text-xs text-white focus:border-orange-500 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={sending}
            className="px-6 py-2.5 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-xl text-xs flex items-center gap-2 transition-all shadow-lg shadow-orange-600/20 disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            {sending ? 'Dispatching...' : 'Send Email Message'}
          </button>
        </form>
      </div>
    </div>
  );
}
