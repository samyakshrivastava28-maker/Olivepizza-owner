import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, MessageSquare, Check, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import toast from 'react-hot-toast';

export interface AIDeepSeekAssistantChatboxProps {
  mode: 'product-description' | 'combo-description' | 'email-template' | 'notification';
  contextData?: {
    name?: string;
    category?: string;
    items?: string[];
    selectedProducts?: string[];
    audience?: string;
  };
  onApplyOutput: (output: {
    description?: string;
    html?: string;
    subject?: string;
    title?: string;
    body?: string;
  }) => void;
}

interface ChatMsg {
  role: 'user' | 'assistant';
  content: string;
  appliedData?: any;
}

export default function AIDeepSeekAssistantChatbox({
  mode,
  contextData = {},
  onApplyOutput,
}: AIDeepSeekAssistantChatboxProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  const modeTitle =
    mode === 'product-description'
      ? 'Product Description Assistant'
      : mode === 'combo-description'
      ? 'Combo Description Assistant'
      : mode === 'email-template'
      ? 'Email Campaign Assistant'
      : 'Push Notification Assistant';

  const quickPrompts =
    mode === 'product-description'
      ? ['✨ Generate description', '🌶️ Make it extra spicy & hot', '🧀 Highlight 100% mozzarella cheese']
      : mode === 'combo-description'
      ? ['✨ Generate combo description', '💰 Emphasize maximum savings', '🎉 Perfect for party & family']
      : mode === 'email-template'
      ? ['✨ Create full email HTML', '🎉 Add festive holiday offer', '🚀 Add 20% discount coupon']
      : ['✨ Generate push notification', '🔥 High urgency emoji copy', '🕒 Limited time 30-min deal'];

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSendMessage = async (customText?: string) => {
    const textToSend = customText || inputMessage;
    if (!textToSend.trim() || isLoading) return;

    const userMsg: ChatMsg = { role: 'user', content: textToSend };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInputMessage('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/ai/interactive-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          message: textToSend,
          history: updatedMessages.slice(-6),
          contextData,
        }),
      });

      const data = await res.json();
      if (data.success) {
        const appliedData = {
          description: data.description,
          html: data.html,
          subject: data.subject,
          title: data.title,
          body: data.body,
        };

        const assistantMsg: ChatMsg = {
          role: 'assistant',
          content: data.chatReply || 'Here is your generated content!',
          appliedData,
        };

        setMessages((prev) => [...prev, assistantMsg]);

        // Auto-populate main message input box!
        onApplyOutput(appliedData);
        toast.success(`✨ Main form field auto-filled via ${data.model || 'DeepSeek V4 Flash'}!`);
      } else {
        toast.error(data.error || 'AI generation failed');
      }
    } catch (err: any) {
      toast.error('Assistant error: ' + err.message);
    }
    setIsLoading(false);
  };

  return (
    <div className="w-full bg-[#0B0F17] rounded-2xl border border-purple-500/30 overflow-hidden shadow-xl my-3">
      {/* Header */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="p-3.5 bg-gradient-to-r from-purple-950/80 via-dark-900 to-slate-900 flex items-center justify-between cursor-pointer border-b border-purple-500/20"
      >
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-purple-500/20 text-purple-300 flex items-center justify-center">
            <Sparkles className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <h5 className="text-xs font-black text-white flex items-center gap-1.5">
              <span>{modeTitle}</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 font-bold">
                DeepSeek V4 Flash
              </span>
            </h5>
            <p className="text-[10px] text-slate-400">
              Ask questions or refine copy here — main output auto-populates main form box!
            </p>
          </div>
        </div>
        <button type="button" className="text-slate-400 hover:text-white">
          {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* Expanded Chat Body */}
      {isOpen && (
        <div className="p-3 space-y-3">
          {/* Quick Prompt Chips */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {quickPrompts.map((chip, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSendMessage(chip)}
                disabled={isLoading}
                className="px-2.5 py-1 bg-purple-950/50 hover:bg-purple-900/70 text-purple-300 text-[11px] font-bold rounded-lg border border-purple-500/30 transition-all cursor-pointer"
              >
                {chip}
              </button>
            ))}
          </div>

          {/* Messages Container */}
          <div className="max-h-56 overflow-y-auto space-y-2.5 custom-scrollbar p-2 bg-black/40 rounded-xl border border-white/5 text-xs">
            {messages.length === 0 ? (
              <div className="text-center text-slate-500 py-6 text-xs">
                <MessageSquare className="w-6 h-6 mx-auto mb-2 text-purple-400/50" />
                Ask any question or click a chip above! DeepSeek V4 Flash will answer here and fill your main form box automatically.
              </div>
            ) : (
              messages.map((msg, index) => (
                <div
                  key={index}
                  className={`flex flex-col gap-1 ${
                    msg.role === 'user' ? 'items-end' : 'items-start'
                  }`}
                >
                  <div
                    className={`p-3 rounded-2xl max-w-[85%] leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-purple-600 text-white rounded-br-none font-medium shadow'
                        : 'bg-slate-900 text-slate-200 border border-white/10 rounded-bl-none shadow'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>

                  {msg.role === 'assistant' && msg.appliedData && (
                    <button
                      type="button"
                      onClick={() => {
                        onApplyOutput(msg.appliedData);
                        toast.success('✨ Applied to main form box!');
                      }}
                      className="text-[10px] text-purple-300 font-bold hover:underline flex items-center gap-1 mt-0.5 ml-1"
                    >
                      <Check className="w-3 h-3 text-emerald-400" /> Apply to main box
                    </button>
                  )}
                </div>
              ))
            )}

            {isLoading && (
              <div className="flex items-center gap-2 text-purple-400 font-bold text-xs p-2 animate-pulse">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" /> DeepSeek V4 Flash is thinking & writing...
              </div>
            )}
            <div ref={chatBottomRef} />
          </div>

          {/* Input Bar */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder={`Ask DeepSeek V4 Flash a question or refine copy...`}
              className="flex-1 bg-black/80 border border-white/15 rounded-xl px-3.5 py-2.5 text-white text-xs outline-none focus:border-purple-400 placeholder:text-slate-500"
            />
            <button
              type="button"
              onClick={() => handleSendMessage()}
              disabled={isLoading || !inputMessage.trim()}
              className="px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow disabled:opacity-50 flex items-center gap-1 cursor-pointer"
            >
              <span>Send</span>
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
