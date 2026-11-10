/**
 * olivePizzaAISDK.ts — Official Frontend Client SDK for Olive Pizza AI Platform
 * 
 * Provides unified helper methods to launch or interact with the official Olive Pizza AI Platform:
 * Platform URL: https://olive-pizza-ai-frontend.vercel.app/
 */

export const OLIVE_PIZZA_AI_PLATFORM_URL =
  import.meta.env.VITE_OLIVE_AI_FRONTEND_URL ||
  import.meta.env.VITE_OLIVE_PIZZA_AI_URL ||
  'https://olive-pizza-ai-frontend.vercel.app';

export class OlivePizzaAIClient {
  /**
   * Get full URL for opening Olive Pizza AI Platform
   */
  static getPlatformUrl(params?: Record<string, string>): string {
    const url = new URL(OLIVE_PIZZA_AI_PLATFORM_URL);
    if (params) {
      Object.entries(params).forEach(([key, val]) => {
        if (val) url.searchParams.append(key, val);
      });
    }
    return url.toString();
  }

  /**
   * Open Olive Pizza AI Platform in a new browser tab or window
   */
  static openPlatform(role: 'customer' | 'owner' | 'developer' = 'customer', userId?: string): void {
    const targetUrl = this.getPlatformUrl({ role, userId: userId || '' });
    window.open(targetUrl, '_blank', 'noopener,noreferrer');
  }

  /**
   * Call backend proxy API for AI prompt enhancement (Product, Combo, Email, Ad, SDUI)
   */
  static async enhancePrompt(prompt: string, targetType: string = 'general'): Promise<string> {
    try {
      const res = await fetch('/api/ai/enhance-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, targetType }),
      });
      if (!res.ok) return prompt;
      const data = await res.json();
      return data.enhancedPrompt || data.prompt || prompt;
    } catch {
      return prompt;
    }
  }

  /**
   * Call backend proxy API for Product Description Generation
   */
  static async generateProductDescription(name: string, category?: string): Promise<{ description: string; highlights: string[] }> {
    try {
      const res = await fetch('/api/ai/generate-product-description', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, category }),
      });
      if (!res.ok) throw new Error('API Error');
      return await res.json();
    } catch {
      return {
        description: `Delicious ${name} handcrafted with fresh ingredients and authentic Olive Pizza style.`,
        highlights: ['Fresh Ingredients', 'Handcrafted', 'Hot & Fresh'],
      };
    }
  }

  /**
   * Call backend proxy API for Product/Combo Image Generation
   */
  static async generateProductImage(prompt: string, name?: string): Promise<{ imageUrl: string }> {
    const res = await fetch('/api/ai/generate-product-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, name }),
    });
    if (!res.ok) throw new Error('Image generation failed');
    return await res.json();
  }
}
