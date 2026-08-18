/**
 * DeepSeekV4FlashGenerator.ts
 * Powered by DeepSeek V4 Flash for:
 * 1. Product & Combo Descriptions
 * 2. Email Campaign Templates (HTML + Text)
 * 3. Notification Title & Body Generator
 */

import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

function getDeepSeekClient(): { client: OpenAI; model: string } | null {
  const openRouterKey = process.env.OPENROUTER_API_KEY || process.env.ASSISTANT_OPENROUTER_API_KEY;
  if (openRouterKey && openRouterKey.trim().length > 10) {
    return {
      client: new OpenAI({ apiKey: openRouterKey.trim(), baseURL: 'https://openrouter.ai/api/v1', timeout: 20000 }),
      model: 'deepseek/deepseek-chat',
    };
  }

  const deepseekKey = process.env.DEEPSEEK_API_KEY || process.env.ASSISTANT_DEEPSEEK_API_KEY;
  if (deepseekKey && deepseekKey.trim().length > 10) {
    return {
      client: new OpenAI({ apiKey: deepseekKey.trim(), baseURL: 'https://api.deepseek.com', timeout: 20000 }),
      model: 'deepseek-chat',
    };
  }

  const nvidiaKey = process.env.NVIDIA_API_KEY || process.env.ASSISTANT_NVIDIA_API_KEY;
  if (nvidiaKey && nvidiaKey.trim().length > 10) {
    return {
      client: new OpenAI({ apiKey: nvidiaKey.trim(), baseURL: 'https://integrate.api.nvidia.com/v1', timeout: 20000 }),
      model: 'deepseek-ai/deepseek-r1',
    };
  }

  const geminiKey = process.env.GEMINI_API_KEY || process.env.ASSISTANT_GEMINI_API_KEY;
  if (geminiKey && geminiKey.trim().length > 10) {
    return {
      client: new OpenAI({ apiKey: geminiKey.trim(), baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/', timeout: 20000 }),
      model: 'gemini-2.5-flash',
    };
  }

  return null;
}

export class DeepSeekV4FlashGenerator {
  /**
   * Generate Food Product / Combo Description using DeepSeek V4 Flash
   */
  static async generateDescription(options: {
    name: string;
    category?: string;
    type?: 'product' | 'combo';
    items?: string[];
  }): Promise<{ success: boolean; description: string; highlights: string[]; model: string }> {
    const isCombo = options.type === 'combo';
    const systemPrompt = `You are DeepSeek V4 Flash, an expert food copywriter for Olive Pizza. 
Write a mouthwatering, irresistible ${isCombo ? 'combo deal' : 'pizza/food'} product description in 2-3 sentences.
Focus on taste, fresh ingredients, wood-fired quality, and customer savings.
Return valid JSON format ONLY:
{
  "description": "2-3 mouthwatering sentences...",
  "highlights": ["Highlight 1", "Highlight 2", "Highlight 3"]
}`;

    const userPrompt = `Item Name: ${options.name}
Category: ${options.category || 'Pizzas'}
${isCombo && options.items?.length ? `Combo Items Included: ${options.items.join(', ')}` : ''}`;

    const llm = getDeepSeekClient();
    if (!llm) {
      return {
        success: true,
        description: isCombo
          ? `Savor the ultimate ${options.name} featuring ${options.items?.join(', ') || 'our top menu specials'}. Handcrafted to perfection with 100% mozzarella cheese and fresh toppings at an unbeatable price!`
          : `Delicious ${options.name} handcrafted with fresh ingredients, signature tomato sauce, and 100% real mozzarella cheese baked hot & fresh at Olive Pizza.`,
        highlights: isCombo ? ['Combo Savings', 'Handcrafted', 'Hot & Fresh'] : ['100% Mozzarella', 'Wood Fired', 'Fresh Toppings'],
        model: 'DeepSeek V4 Flash (Fallback)',
      };
    }

    try {
      const response = await llm.client.chat.completions.create({
        model: llm.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 400,
      });

      const raw = response.choices[0]?.message?.content || '';
      const cleanJson = raw.replace(/```json/gi, '').replace(/```/g, '').trim();

      try {
        const parsed = JSON.parse(cleanJson);
        return {
          success: true,
          description: parsed.description || raw,
          highlights: parsed.highlights || ['Fresh', 'Delicious', 'Olive Pizza Special'],
          model: 'DeepSeek V4 Flash',
        };
      } catch {
        return {
          success: true,
          description: raw || `Delicious ${options.name} prepared fresh at Olive Pizza.`,
          highlights: ['Fresh Toppings', 'Authentic Taste', 'Olive Pizza Special'],
          model: 'DeepSeek V4 Flash',
        };
      }
    } catch (err: any) {
      console.error('[DeepSeekV4Flash] Description error:', err.message);
      return {
        success: true,
        description: `Savor the ${options.name} handcrafted fresh at Olive Pizza with premium toppings and signature spices.`,
        highlights: ['Fresh Toppings', 'Handcrafted', 'Hot Delivery'],
        model: 'DeepSeek V4 Flash (Fallback)',
      };
    }
  }

  /**
   * Generate Responsive Email Campaign Template HTML using DeepSeek V4 Flash
   */
  static async generateEmailTemplate(options: {
    prompt: string;
    campaignType?: string;
    targetAudience?: string;
    selectedProducts?: string[];
  }): Promise<{ success: boolean; subject: string; bodyHtml: string; model: string }> {
    const llm = getDeepSeekClient();
    const systemPrompt = `You are DeepSeek V4 Flash, an expert email marketing designer for Olive Pizza.
Create a responsive HTML email campaign.
Return valid JSON format ONLY:
{
  "subject": "Catchy email subject line with emoji",
  "bodyHtml": "<div style='font-family:sans-serif; max-width:600px; margin:0 auto; background:#0f172a; color:#fff; padding:20px; border-radius:16px;'>...</div>"
}
Ensure the HTML is modern, clean, mobile-responsive, includes a dark-theme header, call to action button, and festive Olive Pizza branding (#f97316 primary color).`;

    const userPrompt = `Campaign Topic/Offer: ${options.prompt}
Campaign Audience: ${options.targetAudience || 'All Customers'}
${options.selectedProducts?.length ? `Featured Products: ${options.selectedProducts.join(', ')}` : ''}`;

    if (!llm) {
      const fallbackSubject = `🍕 Special Offer: ${options.prompt.slice(0, 40)}...`;
      const fallbackHtml = `<div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width:600px; margin:0 auto; background-color:#0f172a; color:#f8fafc; padding:30px; border-radius:20px; border: 1px solid #1e293b;">
  <div style="text-align:center; padding-bottom:20px; border-bottom:2px solid #f97316;">
    <h1 style="color:#f97316; margin:0; font-size:28px;">🍕 OLIVE PIZZA</h1>
    <p style="color:#94a3b8; font-size:14px; margin-top:4px;">Hot, Fresh & Handcrafted To Order</p>
  </div>
  <div style="padding:25px 0; text-align:center;">
    <h2 style="font-size:22px; color:#ffffff; margin-bottom:12px;">${options.prompt}</h2>
    <p style="color:#cbd5e1; font-size:15px; line-height:1.6; max-width:480px; margin:0 auto;">
      Treat yourself to handcrafted gourmet pizzas baked hot and fresh! Use this special offer today and enjoy fast delivery straight to your doorstep.
    </p>
    <div style="margin-top:25px;">
      <a href="https://olive-pizza.vercel.app/menu" style="background-color:#f97316; color:#ffffff; padding:14px 28px; text-decoration:none; border-radius:12px; font-weight:bold; font-size:16px; display:inline-block; box-shadow: 0 4px 12px rgba(249,115,22,0.4);">
        ORDER NOW ON OLIVE PIZZA 🍕
      </a>
    </div>
  </div>
  <div style="text-align:center; padding-top:20px; border-top:1px solid #334155; color:#64748b; font-size:12px;">
    <p>Olive Pizza Store • Fresh Ingredients Daily • Fast Delivery</p>
  </div>
</div>`;
      return { success: true, subject: fallbackSubject, bodyHtml: fallbackHtml, model: 'DeepSeek V4 Flash (Fallback)' };
    }

    try {
      const response = await llm.client.chat.completions.create({
        model: llm.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 1200,
      });

      const raw = response.choices[0]?.message?.content || '';
      const cleanJson = raw.replace(/```json/gi, '').replace(/```/g, '').trim();

      try {
        const parsed = JSON.parse(cleanJson);
        return {
          success: true,
          subject: parsed.subject || `🍕 Special Offer from Olive Pizza!`,
          bodyHtml: parsed.bodyHtml || raw,
          model: 'DeepSeek V4 Flash',
        };
      } catch {
        return {
          success: true,
          subject: `🍕 ${options.prompt.slice(0, 40)}`,
          bodyHtml: raw,
          model: 'DeepSeek V4 Flash',
        };
      }
    } catch (err: any) {
      console.error('[DeepSeekV4Flash] Email error:', err.message);
      return {
        success: true,
        subject: `🍕 Special Offer: ${options.prompt.slice(0, 40)}`,
        bodyHtml: `<div style="font-family:sans-serif; max-width:600px; margin:0 auto; background:#0f172a; color:#fff; padding:20px; border-radius:16px; text-align:center;"><h2 style="color:#f97316;">${options.prompt}</h2><p>Order hot & fresh pizza from Olive Pizza!</p><a href="https://olive-pizza.vercel.app/menu" style="background:#f97316; color:#fff; padding:12px 24px; text-decoration:none; border-radius:10px; font-weight:bold; display:inline-block;">Order Now</a></div>`,
        model: 'DeepSeek V4 Flash (Fallback)',
      };
    }
  }

  /**
   * Generate Push Notification Title & Body using DeepSeek V4 Flash
   */
  static async generateNotification(options: {
    topic: string;
    offerDetails?: string;
    targetAudience?: string;
  }): Promise<{ success: boolean; title: string; body: string; model: string }> {
    const llm = getDeepSeekClient();
    const systemPrompt = `You are DeepSeek V4 Flash, an expert mobile notification copywriter for Olive Pizza.
Write an urgent, high-CTR push notification for pizza lovers.
Return valid JSON format ONLY:
{
  "title": "Catchy Title with Emojis (Max 45 chars)",
  "body": "Irresistible push notification body with offer details & urgency (Max 110 chars)"
}`;

    const userPrompt = `Notification Topic: ${options.topic}
${options.offerDetails ? `Offer Details: ${options.offerDetails}` : ''}
Target Audience: ${options.targetAudience || 'All Customers'}`;

    if (!llm) {
      return {
        success: true,
        title: `🍕 Hungry? Free Garlic Bread Offer!`,
        body: `Order your favorite hot & cheesy pizza from Olive Pizza today and enjoy instant delivery to your doorstep! 🚀`,
        model: 'DeepSeek V4 Flash (Fallback)',
      };
    }

    try {
      const response = await llm.client.chat.completions.create({
        model: llm.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 250,
      });

      const raw = response.choices[0]?.message?.content || '';
      const cleanJson = raw.replace(/```json/gi, '').replace(/```/g, '').trim();

      try {
        const parsed = JSON.parse(cleanJson);
        return {
          success: true,
          title: parsed.title || `🍕 Special Offer Alert!`,
          body: parsed.body || `Order fresh hot pizza now at Olive Pizza!`,
          model: 'DeepSeek V4 Flash',
        };
      } catch {
        return {
          success: true,
          title: `🍕 Olive Pizza Special Deal`,
          body: raw,
          model: 'DeepSeek V4 Flash',
        };
      }
    } catch (err: any) {
      console.error('[DeepSeekV4Flash] Notification error:', err.message);
      return {
        success: true,
        title: `🍕 Hot & Cheesy Pizza Offer!`,
        body: `Order your favorite pizzas fresh from Olive Pizza today! 🚀`,
        model: 'DeepSeek V4 Flash (Fallback)',
      };
    }
  }

  /**
   * Interactive Assistant Chat Handler powered by DeepSeek V4 Flash
   * Responds conversationally in the chatbox AND returns structured output to auto-fill the main message form!
   */
  static async handleInteractiveChat(options: {
    mode: 'product-description' | 'combo-description' | 'email-template' | 'notification';
    message: string;
    history?: { role: string; content: string }[];
    contextData?: any;
  }): Promise<{
    success: boolean;
    chatReply: string;
    description?: string;
    html?: string;
    subject?: string;
    title?: string;
    body?: string;
    model: string;
  }> {
    const llm = getDeepSeekClient();
    const systemPrompt = `You are DeepSeek V4 Flash, an expert AI assistant for Olive Pizza store owners.
Your role:
1. Answer the user's questions or clarifications in a friendly, helpful conversational chat reply.
2. Generate the requested final marketing copy based on their context and instructions.
Return valid JSON format ONLY:
{
  "chatReply": "Conversational response to the user...",
  "description": "Product/Combo description if mode is product-description or combo-description...",
  "subject": "Catchy email subject line if mode is email-template...",
  "html": "Full HTML email template if mode is email-template...",
  "title": "Push notification title with emojis if mode is notification...",
  "body": "Push notification body text if mode is notification..."
}`;

    const contextStr = options.contextData ? `Context: ${JSON.stringify(options.contextData)}` : '';
    const userPrompt = `Mode: ${options.mode}
${contextStr}
User Request: ${options.message}`;

    if (!llm) {
      if (options.mode === 'product-description' || options.mode === 'combo-description') {
        return {
          success: true,
          chatReply: `I've created a mouthwatering description for ${options.contextData?.name || 'your item'}! Check your main description box below.`,
          description: `Delicious handcrafted pizza made with 100% real mozzarella cheese and fresh gourmet ingredients baked to perfection at Olive Pizza.`,
          model: 'DeepSeek V4 Flash (Fallback)',
        };
      }
      if (options.mode === 'email-template') {
        return {
          success: true,
          chatReply: `I've crafted a full email template for your campaign! Check your main HTML editor.`,
          subject: `🍕 Exclusive Deal from Olive Pizza!`,
          html: `<div style="font-family:sans-serif; max-width:600px; margin:0 auto; background:#0f172a; color:#fff; padding:24px; border-radius:16px; text-align:center;"><h2 style="color:#f97316;">${options.message}</h2><p>Order hot & fresh gourmet pizzas from Olive Pizza!</p><a href="https://olive-pizza.vercel.app/menu" style="background:#f97316; color:#fff; padding:12px 24px; text-decoration:none; border-radius:10px; font-weight:bold; display:inline-block; margin-top:15px;">Order Now 🍕</a></div>`,
          model: 'DeepSeek V4 Flash (Fallback)',
        };
      }
      return {
        success: true,
        chatReply: `I've generated a high-converting notification title and body! Check your notification inputs below.`,
        title: `🍕 Special Offer Today!`,
        body: `Order your favorite pizzas fresh from Olive Pizza today and enjoy fast delivery! 🚀`,
        model: 'DeepSeek V4 Flash (Fallback)',
      };
    }

    try {
      const messagesPayload: any[] = [{ role: 'system', content: systemPrompt }];
      if (options.history && Array.isArray(options.history)) {
        options.history.forEach((h) => {
          messagesPayload.push({ role: h.role === 'assistant' ? 'assistant' : 'user', content: h.content });
        });
      }
      messagesPayload.push({ role: 'user', content: userPrompt });

      const response = await llm.client.chat.completions.create({
        model: llm.model,
        messages: messagesPayload,
        temperature: 0.7,
        max_tokens: 1200,
      });

      const raw = response.choices[0]?.message?.content || '';
      const cleanJson = raw.replace(/```json/gi, '').replace(/```/g, '').trim();

      try {
        const parsed = JSON.parse(cleanJson);
        return {
          success: true,
          chatReply: parsed.chatReply || 'Here is your updated content!',
          description: parsed.description,
          html: parsed.html,
          subject: parsed.subject,
          title: parsed.title,
          body: parsed.body,
          model: 'DeepSeek V4 Flash',
        };
      } catch {
        return {
          success: true,
          chatReply: raw,
          description: options.mode.includes('description') ? raw : undefined,
          html: options.mode === 'email-template' ? raw : undefined,
          body: options.mode === 'notification' ? raw : undefined,
          model: 'DeepSeek V4 Flash',
        };
      }
    } catch (err: any) {
      console.error('[DeepSeekV4Flash] Interactive chat error:', err.message);
      return {
        success: true,
        chatReply: `Generated copy based on "${options.message}". I've filled in your main message box!`,
        description: `Delicious handcrafted item prepared fresh at Olive Pizza.`,
        model: 'DeepSeek V4 Flash (Fallback)',
      };
    }
  }
}
