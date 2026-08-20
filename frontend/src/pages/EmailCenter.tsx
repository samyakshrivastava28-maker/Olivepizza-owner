import React, { useState, useEffect } from 'react';
import {
  Mail,
  Send,
  Sparkles,
  Eye,
  FileText,
  Image as ImageIcon,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Copy,
  FolderOpen,
  LayoutTemplate,
  X,
} from 'lucide-react';
import { fetchApi } from '../lib/api';
import toast from 'react-hot-toast';

export default function EmailCenter() {
  const [activeTab, setActiveTab] = useState<'studio' | 'reports' | 'ai'>('studio');
  const [subject, setSubject] = useState('🍕 Hot Weekend Pizza Deals Just For You!');
  const [recipients, setRecipients] = useState('all');
  const [htmlContent, setHtmlContent] = useState(`
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #0E1524; color: #ffffff; padding: 30px; border-radius: 16px;">
  <div style="text-align: center; margin-bottom: 20px;">
    <h1 style="color: #F97316; margin: 0; font-size: 28px;">OLIVE PIZZA</h1>
    <p style="color: #94A3B8; font-size: 14px; margin-top: 4px;">Wood-Fired Gourmet Perfection</p>
  </div>
  <div style="background-color: #131B2B; padding: 24px; border-radius: 12px; border: 1px solid #334155; margin-bottom: 20px;">
    <h2 style="color: #ffffff; font-size: 20px; margin-top: 0;">Special Weekend Pizza Treat!</h2>
    <p style="color: #CBD5E1; font-size: 14px; line-height: 1.6;">
      Get ready for the crunchiest crust and cheesiest toppings in town. Order your favorite artisanal pizzas today and enjoy instant delivery right to your door.
    </p>
    <div style="text-align: center; margin: 25px 0;">
      <a href="https://olivepizza.in/menu" style="background-color: #EA580C; color: #ffffff; text-decoration: none; padding: 14px 28px; font-weight: bold; border-radius: 10px; display: inline-block; font-size: 15px;">
        Order Now with 20% Off
      </a>
    </div>
  </div>
  <p style="color: #64748B; font-size: 12px; text-align: center; margin: 0;">
    Olive Pizza — Dongargaon Rd, Rajnandgaon, CG. You are receiving this because you signed up on our app.
  </p>
</div>
  `.trim());

  // Media Library Picker state
  const [showMediaModal, setShowMediaModal] = useState(false);
  const [mediaList, setMediaList] = useState<any[]>([]);

  // AI Generator state
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiType, setAiType] = useState('promo');
  const [generatingAI, setGeneratingAI] = useState(false);

  // Email Reports state
  const [reports, setReports] = useState<any[]>([]);
  const [sending, setSending] = useState(false);

  // Load Media List for picker
  const loadMedia = () => {
    fetchApi('/api/media/list')
      .then((r) => r.json())
      .then((d) => setMediaList(d.media || d || []))
      .catch(() => {});
  };

  useEffect(() => {
    fetchApi('/api/email/analytics')
      .then((r) => r.json())
      .then((d) => setReports(d.campaigns || d.history || []))
      .catch(() => {});
  }, []);

  const handleSendCampaign = async (isTest: boolean = false) => {
    setSending(true);
    const toastId = toast.loading(isTest ? 'Sending test email...' : 'Dispatching email campaign to subscribers...');
    try {
      const res = await fetchApi(isTest ? '/api/email/test' : '/api/email/send-campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject,
          htmlContent,
          recipients: isTest ? 'test' : recipients,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success !== false) {
        toast.success(isTest ? 'Test email delivered!' : 'Campaign dispatched successfully!', { id: toastId });
      } else {
        throw new Error(data.error || 'Email service rejected request');
      }
    } catch (e: any) {
      toast.error('Email dispatch error: ' + e.message, { id: toastId });
    } finally {
      setSending(false);
    }
  };

  // AI Email Generation via DeepSeek V4 Flash
  const handleGenerateAI = async () => {
    if (!aiPrompt.trim()) {
      toast.error('Please enter campaign instructions.');
      return;
    }

    setGeneratingAI(true);
    const toastId = toast.loading('DeepSeek V4 Flash is drafting HTML email template...');
    try {
      const res = await fetchApi('/api/ai/generate-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: aiPrompt,
          type: aiType,
        }),
      });

      const data = await res.json();
      if (data.html || data.template) {
        setHtmlContent(data.html || data.template);
        if (data.subject) setSubject(data.subject);
        setActiveTab('studio');
        toast.success('AI Email Template generated and loaded into studio!', { id: toastId });
      } else {
        toast.success('Generated email template!', { id: toastId });
        setActiveTab('studio');
      }
    } catch (e: any) {
      toast.error('AI generation queued: ' + e.message, { id: toastId });
    } finally {
      setGeneratingAI(false);
    }
  };

  const insertImageTag = (url: string) => {
    const imgHtml = `<div style="text-align: center; margin: 15px 0;"><img src="${url}" alt="Pizza Banner" style="max-width: 100%; height: auto; border-radius: 8px;" /></div>\n`;
    setHtmlContent((prev) => prev + '\n' + imgHtml);
    setShowMediaModal(false);
    toast.success('Inserted image tag into template!');
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#0E1524] p-5 rounded-2xl border border-slate-800 shadow-lg">
        <div>
          <h1 className="text-xl font-extrabold text-white tracking-tight">Email Marketing Center</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Craft beautiful responsive emails, launch subscriber campaigns, and monitor open rates.
          </p>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center gap-1.5 bg-[#0B0F17] p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveTab('studio')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'studio'
                ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            Campaign Studio
          </button>
          <button
            onClick={() => setActiveTab('reports')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'reports'
                ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            Email Reports
          </button>
          <button
            onClick={() => setActiveTab('ai')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'ai'
                ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" /> AI Template Generator
          </button>
        </div>
      </div>

      {/* TAB 1: CAMPAIGN STUDIO (Editor + Live Preview) */}
      {activeTab === 'studio' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Editor Column */}
          <div className="bg-[#0E1524] border border-slate-800 rounded-2xl p-6 shadow-md space-y-4 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
                  <Mail className="w-4 h-4 text-orange-400" /> Email Campaign Editor
                </h2>
                <button
                  onClick={() => {
                    loadMedia();
                    setShowMediaModal(true);
                  }}
                  className="px-3 py-1.5 bg-[#0B0F17] hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
                >
                  <FolderOpen className="w-3.5 h-3.5 text-orange-400" /> Media Library
                </button>
              </div>

              {/* Subject */}
              <div>
                <label className="text-xs font-bold text-slate-300 uppercase block mb-1.5">Subject Line</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#0B0F17] border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none"
                />
              </div>

              {/* Audience */}
              <div>
                <label className="text-xs font-bold text-slate-300 uppercase block mb-1.5">Recipient Audience</label>
                <select
                  value={recipients}
                  onChange={(e) => setRecipients(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#0B0F17] border border-slate-800 rounded-xl text-xs text-slate-300 focus:border-orange-500 focus:outline-none"
                >
                  <option value="all">All Registered Customers</option>
                  <option value="active">Active Past 30 Days Users</option>
                  <option value="vip">VIP & Frequent Pizza Buyers</option>
                </select>
              </div>

              {/* HTML Editor */}
              <div>
                <label className="text-xs font-bold text-slate-300 uppercase block mb-1.5">HTML Content</label>
                <textarea
                  rows={14}
                  value={htmlContent}
                  onChange={(e) => setHtmlContent(e.target.value)}
                  className="w-full p-3.5 bg-[#0B0F17] border border-slate-800 rounded-xl text-xs font-mono text-slate-200 focus:border-orange-500 focus:outline-none leading-relaxed"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3 pt-2 border-t border-slate-800">
              <button
                type="button"
                disabled={sending}
                onClick={() => handleSendCampaign(true)}
                className="px-4 py-2.5 bg-[#0B0F17] hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-bold rounded-xl transition-all disabled:opacity-50"
              >
                Send Test Email
              </button>
              <button
                type="button"
                disabled={sending || !subject.trim() || !htmlContent.trim()}
                onClick={() => handleSendCampaign(false)}
                className="flex-1 py-2.5 bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-orange-600/20 disabled:opacity-50"
              >
                <Send className="w-4 h-4" /> {sending ? 'Dispatching...' : 'Send Campaign Now'}
              </button>
            </div>
          </div>

          {/* Live Preview Column */}
          <div className="bg-[#0E1524] border border-slate-800 rounded-2xl p-6 shadow-md space-y-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                  <Eye className="w-3.5 h-3.5 text-orange-400" /> Live Rendered Email Preview
                </h3>
                <span className="text-[10px] text-slate-500">600px Max Container</span>
              </div>

              <div className="mt-4 p-4 bg-[#0B0F17] border border-slate-800 rounded-2xl overflow-y-auto max-h-[620px]">
                <div dangerouslySetInnerHTML={{ __html: htmlContent }} />
              </div>
            </div>

            <div className="text-[11px] text-slate-500 p-3 bg-[#0B0F17] rounded-xl border border-slate-800">
              ✉️ Emails are delivered with responsive HTML layouts designed for Gmail, Apple Mail, and Outlook.
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: EMAIL REPORTS */}
      {activeTab === 'reports' && (
        <div className="bg-[#0E1524] border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
          <div className="p-5 border-b border-slate-800 flex justify-between items-center">
            <h3 className="text-sm font-extrabold text-white">Email Campaign Audit Log</h3>
            <span className="text-xs text-slate-400">{reports.length} campaigns dispatched</span>
          </div>

          <div className="divide-y divide-slate-800 text-xs">
            {reports.length === 0 ? (
              <div className="p-8 text-center text-slate-500">No campaigns recorded yet.</div>
            ) : (
              reports.map((rep, i) => (
                <div key={i} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-800/30 transition-colors">
                  <div>
                    <div className="font-bold text-white text-sm">{rep.subject || 'Special Pizza Offer'}</div>
                    <div className="text-slate-500 text-[11px] mt-0.5">
                      Recipients: {rep.recipients || 'All Customers'} • Dispatched: {new Date(rep.createdAt || Date.now()).toLocaleString()}
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold">
                    Delivered
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 3: AI TEMPLATE GENERATOR */}
      {activeTab === 'ai' && (
        <div className="bg-[#0E1524] border border-slate-800 rounded-2xl p-6 shadow-md max-w-2xl mx-auto space-y-4">
          <div className="flex items-center gap-2 text-sm font-extrabold text-white uppercase tracking-wider">
            <Sparkles className="w-4 h-4 text-orange-400" /> DeepSeek V4 Flash Email Template Generator
          </div>
          <p className="text-xs text-slate-400">
            Tell the AI what email promotion or announcement you want to send, and it will generate an entire responsive HTML email template for you.
          </p>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">Email Category</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'promo', label: 'Discount Offer' },
                  { id: 'new_menu', label: 'New Pizza Launch' },
                  { id: 'festival', label: 'Festival Special' },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setAiType(t.id)}
                    className={`py-2 text-xs font-bold rounded-xl border transition-all ${
                      aiType === t.id
                        ? 'bg-orange-500 text-white border-orange-500'
                        : 'bg-[#0B0F17] text-slate-400 border-slate-800 hover:text-white'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">Campaign Concept</label>
              <textarea
                rows={4}
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="e.g. Buy 1 Get 1 Free on all Large Pizzas this Sunday. Highlight our artisanal wood-fired oven and fast 30-minute delivery."
                className="w-full p-3 bg-[#0B0F17] border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none"
              />
            </div>

            <button
              type="button"
              disabled={generatingAI || !aiPrompt.trim()}
              onClick={handleGenerateAI}
              className="w-full py-3 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" /> {generatingAI ? 'AI Crafting HTML Template...' : 'Generate Full Email Template'}
            </button>
          </div>
        </div>
      )}

      {/* Media Picker Modal */}
      {showMediaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-[#0E1524] border border-slate-800 w-full max-w-3xl rounded-3xl p-6 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-extrabold text-white">Select Image from Cloudinary Media Library</h3>
              <button onClick={() => setShowMediaModal(false)} className="p-1.5 text-slate-400 hover:text-white rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            {mediaList.length === 0 ? (
              <div className="text-center py-10 text-slate-500 text-xs">No media files found. Upload assets in the Media tab.</div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {mediaList.map((m: any, idx: number) => {
                  const url = m.url || m.mediaUrl || m.secure_url;
                  return (
                    <div
                      key={idx}
                      onClick={() => insertImageTag(url)}
                      className="group cursor-pointer bg-[#0B0F17] border border-slate-800 hover:border-orange-500 rounded-xl overflow-hidden p-1.5 transition-all text-center space-y-1.5"
                    >
                      <div className="aspect-square rounded-lg overflow-hidden bg-slate-900">
                        <img src={url} alt="Media" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                      </div>
                      <div className="text-[10px] text-slate-400 truncate">{m.name || m.publicId || 'Media Asset'}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
