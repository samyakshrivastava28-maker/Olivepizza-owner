import { useState, useEffect, useRef } from 'react';
import {
  Mail,
  Send,
  Image as ImageIcon,
  LayoutTemplate,
  BarChart3,
  Search,
  RefreshCcw,
  Sparkles,
  X,
  Download,
  Copy,
  CheckCircle2,
  Zap,
  Layers,
  AlertCircle,
  Clipboard,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchApi } from '../lib/api';
import toast from 'react-hot-toast';
import { db } from '../lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import InlineAIImageGenerator from '../components/owner/InlineAIImageGenerator';
import UnifiedImageSelectorHub from '../components/owner/UnifiedImageSelectorHub';
import AIDeepSeekAssistantChatbox from '../components/owner/AIDeepSeekAssistantChatbox';

interface Campaign {
  id: number;
  name: string;
  target_audience: string;
  status: string;
  sent_count: number;
  open_count: number;
  fail_count: number;
  created_at: string;
}

interface GeneratedImage {
  url: string;
  publicId?: string;
  prompt: string;
  createdAt: Date;
}

const BANNER_PRESETS = [
  {
    label: "🍕 Pizza Festival",
    prompt:
      "Pizza festival celebration banner, multiple pizzas, festive atmosphere, Olive Pizza branding",
  },
  {
    label: "🎁 Buy 1 Get 1",
    prompt:
      "Buy one get one free pizza offer promotional banner, two pizzas side by side, deal offer",
  },
  {
    label: "🇮🇳 Independence Day",
    prompt:
      "Independence Day pizza offer, India flag colors orange white green, patriotic theme",
  },
  {
    label: "🚀 New Product",
    prompt:
      "New product launch announcement, spotlight reveal, premium pizza presentation",
  },
  {
    label: "🌙 Weekend Special",
    prompt:
      "Weekend pizza special offer, cozy evening dinner, family pizza night",
  },
  {
    label: "🎂 Birthday Offer",
    prompt:
      "Birthday celebration pizza offer, candles, confetti, special birthday discount",
  },
];

export default function OwnerEmailCenter() {
  const [activeTab, setActiveTab] = useState<"analytics" | "compose" | "logs">(
    "analytics",
  );

  // Logs
  const [logs, setLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logSearch, setLogSearch] = useState("");
  const [logType, setLogType] = useState("");

  // Analytics
  const [metrics, setMetrics] = useState({ totalSent: 0, totalFailed: 0 });
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Compose
  const [campaignName, setCampaignName] = useState("");
  const [targetAudience, setTargetAudience] = useState("active");
  const [subject, setSubject] = useState("");
  const [htmlContent, setHtmlContent] = useState("");
  const [isFestival, setIsFestival] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // AI Agent
  const [aiPrompt, setAiPrompt] = useState("");
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [products, setProducts] = useState<{ id: string; name: string }[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);

  // AI Image Generation
  const [imagePrompt, setImagePrompt] = useState("");
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isEnhancingPrompt, setIsEnhancingPrompt] = useState(false);
  const [aiModel, setAiModel] = useState("qwen-image");
  const [isAIStudioOpen, setIsAIStudioOpen] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);

  // Image Library (session-based)
  const [imageLibrary, setImageLibrary] = useState<GeneratedImage[]>([]);
  const [showImageLibrary, setShowImageLibrary] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const imageLibraryRef = useRef<HTMLDivElement>(null);

  // Preview & Test
  const [showPreview, setShowPreview] = useState(false);
  const [previewHtml, setPreviewHtml] = useState("");
  const [isSendingTest, setIsSendingTest] = useState(false);

  useEffect(() => {
    fetchAnalytics();
    fetchProducts();
    if (activeTab === "logs") fetchLogs();
  }, [activeTab]);

  async function fetchLogs() {
    setLogsLoading(true);
    try {
      const queryParams = new URLSearchParams();
      if (logSearch) queryParams.append("search", logSearch);
      if (logType) queryParams.append("type", logType);
      
      const res = await fetch(`/api/email/logs?${queryParams.toString()}`);
      const data = await res.json();
      if (data.success) {
        setLogs(data.logs);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLogsLoading(false);
    }
  }

  async function fetchProducts() {
    try {
      const snap = await getDocs(collection(db, "products"));
      setProducts(
        snap.docs.map((d) => ({
          id: d.id,
          name: d.data().name || d.data().productName,
        })),
      );
    } catch {}
  }

  const handleGenerateAI = async () => {
    if (!aiPrompt) {
      toast.error("Enter a prompt for the AI");
      return;
    }
    setIsGeneratingAI(true);
    toast.loading("AI is crafting your email...", { id: "ai-gen" });
    try {
      const res = await fetchApi("/api/ai/generate-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: aiPrompt,
          selectedProducts,
          audienceType: targetAudience,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");
      setHtmlContent(data.html);
      toast.success(`Generated (${data.usedModel})`, { id: "ai-gen" });
    } catch (e: any) {
      toast.error(e.message, { id: "ai-gen" });
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleEnhancePrompt = async () => {
    if (!imagePrompt) {
      toast.error("Enter a short prompt first to enhance it");
      return;
    }
    setIsEnhancingPrompt(true);
    toast.loading("Enhancing prompt with DeepSeek R1...", { id: "ai-enhance" });
    try {
      const res = await fetchApi("/api/ai/enhance-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: imagePrompt, type: "banner" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Enhancement failed");
      setImagePrompt(data.text);
      toast.success("Prompt enhanced!", { id: "ai-enhance" });
    } catch (e: any) {
      toast.error(e.message, { id: "ai-enhance" });
    } finally {
      setIsEnhancingPrompt(false);
    }
  };

  const handleGenerateImage = async (customPrompt?: string) => {
    const prompt = customPrompt || imagePrompt || aiPrompt;
    if (!prompt) {
      toast.error("Enter a prompt to generate an image");
      return;
    }

    setIsGeneratingImage(true);
    setImageError(null);
    const toastId = "img-gen";
    toast.loading("Generating image via NVIDIA AI...", { id: toastId });

    try {
      const baseImageUrl =
        aiModel === "qwen-image-edit" && imageLibrary.length > 0
          ? imageLibrary[0].url
          : null;
      const res = await fetchApi("/api/ai/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, modelName: aiModel, baseImageUrl }),
      });
      const data = await res.json();

      if (!res.ok || !data.imageUrl) {
        const err =
          data.error || "Image generation failed on all NVIDIA endpoints";
        setImageError(err);
        toast.error(err, { id: toastId, duration: 6000 });
        return;
      }

      const newImg: GeneratedImage = {
        url: data.imageUrl,
        publicId: data.publicId,
        prompt,
        createdAt: new Date(),
      };
      setImageLibrary((prev) => [newImg, ...prev]);

      const imgTag = `\n<!-- AI Generated Banner -->\n<div style="text-align:center;margin:24px 0;">\n  <img src="${data.imageUrl}" alt="${prompt.slice(0, 60)}" width="100%" style="max-width:600px;border-radius:12px;display:block;margin:0 auto;"/>\n</div>\n`;
      setHtmlContent((prev) => prev + imgTag);

      toast.success("Image generated & inserted!", { id: toastId });
    } catch (e: any) {
      const err = e.message || "Network error";
      setImageError(err);
      toast.error(err, { id: toastId, duration: 6000 });
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    setTimeout(() => setCopiedUrl(null), 2000);
    toast.success("URL copied!");
  };

  const handleInsertFromLibrary = (img: GeneratedImage) => {
    const imgTag = `\n<div style="text-align:center;margin:24px 0;">\n  <img src="${img.url}" alt="${img.prompt.slice(0, 60)}" width="100%" style="max-width:600px;border-radius:12px;display:block;margin:0 auto;"/>\n</div>\n`;
    setHtmlContent((prev) => prev + imgTag);
    setShowImageLibrary(false);
    toast.success("Image inserted!");
  };

  const handlePreview = async () => {
    try {
      const res = await fetchApi("/api/email/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ htmlContent }),
      });
      
      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Server returned an invalid response format.");
      }
      
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Failed to generate preview");
      
      setPreviewHtml(data.html);
      setShowPreview(true);
    } catch (e: any) {
      toast.error(e.message || "Could not generate preview");
    }
  };

  const handleTestEmail = async () => {
    setIsSendingTest(true);
    toast.loading("Sending test email...", { id: "test-email" });
    try {
      const res = await fetchApi("/api/email/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          htmlContent,
          subject,
          recipient: "olivepizzarjn@gmail.com",
        }),
      });
      
      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Server returned an invalid response format.");
      }
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      if (data.diagnostics) {
        console.log("Test Email Diagnostics:", data.diagnostics);
        toast.success(
          <div>
            <strong>{data.message || "Test email sent!"}</strong>
            <div className="text-xs mt-1 text-slate-100 opacity-80 break-words">
              {data.diagnostics.response} ({data.diagnostics.durationMs}ms)
            </div>
          </div>, 
          { id: "test-email", duration: 6000 }
        );
      } else {
        toast.success(data.message || "Test email sent!", { id: "test-email" });
      }
    } catch (e: any) {
      toast.error(
        <div>
          <strong>Failed to send test email</strong>
          <div className="text-xs mt-1 text-slate-100 opacity-80 break-words">
            {e.message}
          </div>
        </div>, 
        { id: "test-email", duration: 8000 }
      );
    } finally {
      setIsSendingTest(false);
    }
  };

  const fetchAnalytics = async () => {
    setIsLoading(true);
    try {
      const res = await fetchApi("/api/email/analytics");
      
      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Server returned an invalid response format.");
      }
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch analytics");
      
      setMetrics(data.metrics || { totalSent: 0, totalFailed: 0 });
      setCampaigns(data.campaigns || []);
    } catch (e: any) {
      console.error(e);
      setMetrics({ totalSent: 0, totalFailed: 0 });
      setCampaigns([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendCampaign = async () => {
    if (!campaignName || !subject || !htmlContent) {
      toast.error("Fill in campaign name, subject, and HTML body");
      return;
    }
    setIsSending(true);
    toast.loading("Sending campaign...", { id: "campaign" });
    try {
      const res = await fetchApi("/api/email/send-campaign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignName,
          targetAudience,
          subject,
          htmlContent,
          isFestival,
        }),
      });
      
      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Server returned an invalid response format.");
      }
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send");
      toast.success(data.message || "Campaign queued!", { id: "campaign" });
    } catch (e: any) {
      toast.error(e.message || "Failed to send campaign", { id: "campaign" });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-white">
            Email Marketing Center
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            AI-powered campaigns with NVIDIA image generation
          </p>
        </div>
        <div className="flex gap-2 bg-dark-900 p-1 rounded-2xl border border-dark-800">
          {(["analytics", "compose", "logs"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${activeTab === tab ? "bg-primary-600 text-white shadow-lg" : "text-slate-400 hover:text-white"}`}
            >
              {tab === "analytics" ? (
                <>
                  <BarChart3 className="w-4 h-4 inline mr-1.5" />
                  Analytics
                </>
              ) : tab === "logs" ? (
                <>
                  <Layers className="w-4 h-4 inline mr-1.5" />
                  Logs
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 inline mr-1.5" />
                  Compose
                </>
              )}
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
      {activeTab === "analytics" && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[#1E293B] border border-white/10 rounded-2xl p-6">
              <p className="text-slate-400 text-sm">Emails Sent</p>
              <p className="text-4xl font-black text-white mt-1">
                {metrics.totalSent.toLocaleString()}
              </p>
            </div>
            <div className="bg-[#1E293B] border border-white/10 rounded-2xl p-6">
              <p className="text-slate-400 text-sm">Failed</p>
              <p className="text-4xl font-black text-red-400 mt-1">
                {metrics.totalFailed.toLocaleString()}
              </p>
            </div>
          </div>
          <div className="bg-[#1E293B] border border-white/10 rounded-2xl p-6">
            <h2 className="font-bold text-white mb-4">Recent Campaigns</h2>
            {isLoading ? (
              <p className="text-slate-500 text-sm">Loading...</p>
            ) : campaigns.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-8">
                No campaigns yet.
              </p>
            ) : (
              <div className="space-y-3">
                {campaigns.map((c) => (
                  <div
                    key={c.id}
                    className="flex justify-between items-center py-2 border-b border-dark-800 last:border-0"
                  >
                    <div>
                      <p className="font-semibold text-white text-sm">
                        {c.name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {c.target_audience} ·{" "}
                        {new Date(c.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-xs">
                      <span className="text-green-400 font-bold">
                        {c.sent_count} sent
                      </span>
                      {c.fail_count > 0 && (
                        <span className="text-red-400 font-bold ml-2">
                          {c.fail_count} failed
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* LOGS TAB */}
      {activeTab === "logs" && (
        <motion.div
          key="logs"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="space-y-6"
        >
          <div className="flex justify-between items-center bg-[#1E293B] p-4 rounded-2xl border border-white/10">
            <div className="flex gap-4">
              <input
                type="text"
                placeholder="Search email, subject..."
                value={logSearch}
                onChange={(e) => setLogSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchLogs()}
                className="bg-dark-900 border border-dark-800 rounded-xl px-4 py-2 text-white text-sm w-64 focus:outline-none focus:border-primary-500"
              />
              <select
                value={logType}
                onChange={(e) => setLogType(e.target.value)}
                className="bg-dark-900 border border-dark-800 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:border-primary-500"
              >
                <option value="">All Types</option>
                <option value="transactional">Transactional</option>
                <option value="marketing">Marketing</option>
              </select>
              <button
                onClick={fetchLogs}
                className="bg-primary-600 text-white hover:bg-primary-500 px-4 py-2 rounded-xl text-sm font-bold transition-colors flex items-center gap-2"
              >
                <Search className="w-4 h-4" /> Search
              </button>
            </div>
            <button
              onClick={fetchLogs}
              className="text-slate-400 hover:text-white p-2"
            >
              <RefreshCcw className={`w-5 h-5 ${logsLoading ? "animate-spin" : ""}`} />
            </button>
          </div>

          <div className="bg-[#1E293B] rounded-2xl border border-white/10 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-dark-900/50 text-slate-400 text-sm">
                  <tr>
                    <th className="px-6 py-4 font-medium">Recipient</th>
                    <th className="px-6 py-4 font-medium">Subject</th>
                    <th className="px-6 py-4 font-medium">Type</th>
                    <th className="px-6 py-4 font-medium">Status</th>
                    <th className="px-6 py-4 font-medium">Date</th>
                    <th className="px-6 py-4 font-medium text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-800 text-sm">
                  {logs.map((log: any) => (
                    <tr key={log.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4 text-white font-medium">{log.recipient}</td>
                      <td className="px-6 py-4 text-slate-300 max-w-[200px] truncate" title={log.subject}>{log.subject}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-md text-xs font-bold ${log.type === 'transactional' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'}`}>
                          {log.type}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-md text-xs font-bold ${log.status === 'sent' ? 'bg-green-500/20 text-green-400' : log.status === 'failed' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'}`}>
                          {log.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-400">{new Date(log.created_at).toLocaleString()}</td>
                      <td className="px-6 py-4 text-right">
                        {log.last_error ? (
                          <div className="text-xs text-red-400 truncate max-w-[150px] inline-block" title={log.last_error}>
                            {log.last_error}
                          </div>
                        ) : (
                          <span className="text-slate-500">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {logs.length === 0 && !logsLoading && (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                        No email logs found matching criteria
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      )}

      {activeTab === "compose" && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 xl:grid-cols-3 gap-6"
        >
          {/* LEFT PANEL */}
          <div className="space-y-5">
            <div className="bg-[#1E293B] border border-white/10 rounded-3xl p-6 shadow-xl space-y-4">
              <h2 className="text-lg font-bold text-white">Campaign Setup</h2>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                  Campaign Name
                </label>
                <input
                  type="text"
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  className="w-full bg-dark-900 border border-dark-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary-500"
                  placeholder="e.g. Diwali Mega Sale"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                  Audience
                </label>
                <select
                  value={targetAudience}
                  onChange={(e) => setTargetAudience(e.target.value)}
                  className="w-full bg-dark-900 border border-dark-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary-500"
                >
                  <option value="all">All Customers</option>
                  <option value="active">Active Customers</option>
                  <option value="new">New (Last 30 days)</option>
                  <option value="vip">VIP Customers</option>
                </select>
              </div>
              <div className="flex items-center gap-3 bg-dark-900 border border-dark-800 p-3 rounded-xl">
                <input
                  type="checkbox"
                  id="isFestival"
                  checked={isFestival}
                  onChange={(e) => setIsFestival(e.target.checked)}
                  className="w-5 h-5 accent-primary-500"
                />
                <label
                  htmlFor="isFestival"
                  className="font-bold text-slate-300 text-sm select-none cursor-pointer"
                >
                  Festival Template
                </label>
              </div>
            </div>

            <div className="bg-[#1E293B] border border-white/10 rounded-3xl p-6 shadow-xl">
              <h2 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                <LayoutTemplate className="w-4 h-4 text-primary-500" /> Quick
                Templates
              </h2>
              <div className="space-y-2">
                {[
                  {
                    label: "Festival Greeting",
                    subject: "🎉 Special Festival Offer Inside!",
                    html: "<h2>Happy Festivities!</h2>\n<p>Enjoy 20% off with code FEST20.</p>",
                  },
                  {
                    label: "New Product Launch",
                    subject: "🚀 New Product Alert!",
                    html: "<h2>Introducing Our Latest Pizza!</h2>\n<p>Try it today — 10% off.</p>",
                  },
                  {
                    label: "Weekend Special",
                    subject: "🌙 Weekend Special!",
                    html: "<h2>Weekend Pizza Party!</h2>\n<p>Order 2 large pizzas, get free garlic bread.</p>",
                  },
                ].map((t) => (
                  <button
                    key={t.label}
                    onClick={() => {
                      setSubject(t.subject);
                      setHtmlContent(t.html);
                    }}
                    className="w-full bg-dark-900 hover:bg-dark-800 border border-dark-800 text-left px-4 py-2.5 rounded-xl text-sm font-bold text-slate-300"
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Interactive DeepSeek V4 Flash Email Assistant Chatbox */}
            <AIDeepSeekAssistantChatbox
              mode="email-template"
              contextData={{
                audience: targetAudience,
                selectedProducts: selectedProducts,
              }}
              onApplyOutput={(output) => {
                if (output.html) {
                  setHtmlContent(output.html);
                }
                if (output.subject) {
                  setSubject(output.subject);
                }
              }}
            />
          </div>

          {/* CENTER/RIGHT */}
          <div className="xl:col-span-2 space-y-5">
            {/* Unified Image Selection Hub (5 Tab Modes) */}
            <UnifiedImageSelectorHub
              initialPrompt={imagePrompt || subject || "Olive Pizza Festival Banner"}
              targetType="email"
              defaultAspectRatio="16:9"
              onSelectImage={(cloudinaryUrl, publicId) => {
                setImageLibrary((prev) => [
                  {
                    url: cloudinaryUrl,
                    publicId,
                    prompt: imagePrompt || "AI Email Banner",
                    createdAt: new Date(),
                  },
                  ...prev,
                ]);
                setHtmlContent((prev) => {
                  if (prev.includes("<img")) {
                    return prev.replace(/src="[^"]*"/, `src="${cloudinaryUrl}"`);
                  }
                  return `<div style="text-align:center; margin-bottom:20px;"><img src="${cloudinaryUrl}" alt="Campaign Banner" style="max-width:100%; border-radius:12px;" /></div>\n${prev}`;
                });
                toast.success("Banner inserted into Email!");
              }}
            />

              <AnimatePresence>
                {imageError && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="mt-3 flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-xl p-3"
                  >
                    <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-xs font-bold text-red-400">
                        Image Generation Failed
                      </p>
                      <p className="text-xs text-red-300/80 mt-0.5 break-all">
                        {imageError}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        No placeholder inserted. Please retry or check NVIDIA
                        API key.
                      </p>
                    </div>
                    <button
                      onClick={() => setImageError(null)}
                      className="text-slate-500 hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {showImageLibrary && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-4 overflow-hidden"
                    ref={imageLibraryRef}
                  >
                    <div className="border-t border-dark-800 pt-4">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">
                        Session Image Library
                      </p>
                      {imageLibrary.length === 0 ? (
                        <p className="text-xs text-slate-600 text-center py-6">
                          No images generated yet.
                        </p>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-72 overflow-y-auto custom-scrollbar">
                          {imageLibrary.map((img, i) => (
                            <div
                              key={i}
                              className="relative group rounded-xl overflow-hidden border border-dark-700"
                            >
                              <img
                                src={img.url}
                                alt={img.prompt}
                                className="w-full h-32 object-cover"
                              />
                              <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-2">
                                <p className="text-xs text-white text-center line-clamp-2">
                                  {img.prompt}
                                </p>
                                <div className="flex gap-1.5">
                                  <button
                                    onClick={() => handleInsertFromLibrary(img)}
                                    className="bg-primary-600 text-white text-xs px-2 py-1 rounded-lg font-bold"
                                  >
                                    Insert
                                  </button>
                                  <button
                                    onClick={() => handleCopyUrl(img.url)}
                                    className="bg-dark-800 text-white text-xs px-2 py-1 rounded-lg font-bold flex items-center gap-1"
                                  >
                                    {copiedUrl === img.url ? (
                                      <CheckCircle2 className="w-3 h-3 text-green-400" />
                                    ) : (
                                      <Copy className="w-3 h-3" />
                                    )}
                                  </button>
                                  <a
                                    href={img.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="bg-dark-800 text-white text-xs px-2 py-1 rounded-lg font-bold"
                                  >
                                    <Download className="w-3 h-3" />
                                  </a>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

            {/* HTML Composer */}
            <div className="bg-[#1E293B] border border-white/10 rounded-3xl p-6 shadow-xl flex flex-col min-h-[500px]">
              <div className="mb-4">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                  Subject Line
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full bg-dark-900 border border-dark-800 rounded-xl px-4 py-3 text-white text-lg font-bold focus:outline-none focus:border-primary-500"
                  placeholder="Catchy Subject Line..."
                />
              </div>
              <div className="flex-1 flex flex-col mb-5">
                <label className="flex justify-between items-center text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                  <span>HTML Body</span>
                  <span className="text-primary-500 font-medium normal-case text-xs">
                    Olive Pizza header/footer auto-injected
                  </span>
                </label>
                <textarea
                  value={htmlContent}
                  onChange={(e) => setHtmlContent(e.target.value)}
                  className="w-full flex-1 bg-dark-900 border border-dark-800 rounded-xl p-4 text-slate-300 font-mono text-sm focus:outline-none focus:border-primary-500 resize-none min-h-[300px]"
                  placeholder="<h2>Hello Pizza Lover!</h2>&#10;<p>Write your email here, or use AI to generate it above.</p>"
                />
              </div>
              <div className="flex justify-end gap-3 flex-wrap mt-auto">
                <button
                  onClick={handlePreview}
                  className="px-5 py-2.5 rounded-full font-bold text-sm bg-dark-800 text-slate-300 hover:bg-dark-700 flex items-center gap-2"
                >
                  <Search className="w-4 h-4" /> Live Preview
                </button>
                <button
                  onClick={handleTestEmail}
                  disabled={isSendingTest}
                  className="px-5 py-2.5 rounded-full font-bold text-sm bg-dark-800 text-slate-300 hover:bg-dark-700 flex items-center gap-2 disabled:opacity-50"
                >
                  {isSendingTest ? (
                    <RefreshCcw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Mail className="w-4 h-4" />
                  )}
                  Send Test Email
                </button>
                <button
                  onClick={handleSendCampaign}
                  disabled={isSending}
                  className="px-7 py-2.5 rounded-full font-black text-white bg-primary-600 hover:bg-primary-500 active:scale-95 disabled:opacity-50 flex items-center gap-2"
                >
                  {isSending ? (
                    <RefreshCcw className="w-5 h-5 animate-spin" />
                  ) : (
                    <Send className="w-5 h-5" />
                  )}
                  Schedule Campaign
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
      </AnimatePresence>

      {showPreview && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-4xl mb-3 flex justify-start">
            <button
              onClick={() => setShowPreview(false)}
              className="flex items-center gap-2 bg-primary-600 hover:bg-primary-500 text-white font-black px-5 py-2.5 rounded-xl shadow-2xl hover:scale-105 active:scale-95 transition-all z-[60]"
            >
              ← Back to Template
            </button>
          </div>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden">
            <div className="bg-slate-100 p-3 sm:p-4 border-b flex justify-between items-center text-slate-800">
              <h3 className="font-bold text-lg">Email Preview</h3>
              <div className="flex gap-2 items-center">
                <span className="text-xs text-slate-500 bg-slate-200 px-3 py-1 rounded-full">
                  With Olive Pizza branding
                </span>
                <button
                  onClick={() => setShowPreview(false)}
                  className="flex items-center gap-1 text-slate-500 hover:text-black hover:bg-slate-200 p-1.5 rounded transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <iframe
              title="Email Preview"
              srcDoc={previewHtml}
              className="w-full flex-1 bg-white"
              frameBorder="0"
            />
          </div>
        </div>
      )}

    </div>
  );
}
