/**
 * EmbeddingService — Multi-Provider Embedding Generator (Phase 2 Router)
 *
 * Provider priority chain:
 *  1. Primary: NVIDIA (nv-embedcode-7b-v1, nv-embed-v1, nemotron-3-embed-1b, llama-nemotron-embed-vl-1b-v2)
 *  2. Fallback: OpenRouter (nvidia/nemotron-3-embed-1b, nvidia/llama-nemotron-embed-vl-1b-v2)
 *  3. Emergency: Google Gemini (gemini-embedding-2, gemini-embedding-001)
 *
 * All vectors are normalized to a single canonical dimension (1024) so that
 * Pinecone always receives a consistent vector size regardless of provider.
 */

import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY || '';
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

export const CANONICAL_EMBEDDING_DIM = 1024;

const NVIDIA_EMBED_URL = 'https://integrate.api.nvidia.com/v1/embeddings';
const NVIDIA_EMBED_MODELS = [
  'nvidia/nv-embedcode-7b-v1',
  'nvidia/nv-embed-v1',
  'nvidia/nemotron-3-embed-1b',
  'nvidia/llama-nemotron-embed-vl-1b-v2',
];

const OPENROUTER_EMBED_URL = 'https://openrouter.ai/api/v1/embeddings';
const OPENROUTER_EMBED_MODELS = [
  'nvidia/nemotron-3-embed-1b',
  'nvidia/llama-nemotron-embed-vl-1b-v2',
];

const GEMINI_EMBED_MODELS = [
  'gemini-embedding-2',
  'gemini-embedding-001',
];
const GEMINI_EMBED_URL = (key: string, model: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:batchEmbedContents?key=${key}`;

export interface EmbeddingResult {
  embeddings: number[][];
  modelUsed: string;
  provider: string;
  latencyMs: number;
}

export class EmbeddingService {
  public dimension: number = CANONICAL_EMBEDDING_DIM;

  constructor() {
    const providers: string[] = [];
    if (NVIDIA_API_KEY) providers.push('NVIDIA Embedding API');
    if (OPENROUTER_API_KEY) providers.push('OpenRouter Embedding API');
    if (GEMINI_API_KEY) providers.push('Google Gemini Embeddings');

    console.log(`[EmbeddingService] Multi-provider chain: ${providers.join(' → ')} (canonical dim: ${CANONICAL_EMBEDDING_DIM})`);
  }

  public async generateEmbedding(text: string): Promise<number[]> {
    const res = await this.generateEmbeddingsDetailed([text]);
    return res.embeddings[0];
  }

  public async generateEmbeddings(texts: string[]): Promise<number[][]> {
    const res = await this.generateEmbeddingsDetailed(texts);
    return res.embeddings;
  }

  public async generateEmbeddingsDetailed(texts: string[]): Promise<EmbeddingResult> {
    if (texts.length === 0) {
      return { embeddings: [], modelUsed: 'none', provider: 'none', latencyMs: 0 };
    }

    const startTime = Date.now();
    let embeddings: number[][] | null = null;
    let modelUsed = '';
    let provider = '';
    let lastError: any = null;

    // 1. Primary: NVIDIA Models Chain
    if (NVIDIA_API_KEY) {
      for (const modelName of NVIDIA_EMBED_MODELS) {
        try {
          embeddings = await this.embedWithNvidiaModel(texts, modelName);
          modelUsed = modelName;
          provider = 'nvidia';
          console.log(`[EmbeddingService] ✅ Generated embedding via NVIDIA model: ${modelName}`);
          break;
        } catch (err: any) {
          lastError = err;
          console.warn(`[EmbeddingService] NVIDIA embedding with model ${modelName} failed:`, err.message);
        }
      }
    }

    // 2. Fallback: OpenRouter Models Chain
    if (!embeddings && OPENROUTER_API_KEY) {
      for (const modelName of OPENROUTER_EMBED_MODELS) {
        try {
          embeddings = await this.embedWithOpenRouter(texts, modelName);
          modelUsed = modelName;
          provider = 'openrouter';
          console.log(`[EmbeddingService] ✅ Generated embedding via OpenRouter model: ${modelName}`);
          break;
        } catch (err: any) {
          lastError = err;
          console.warn(`[EmbeddingService] OpenRouter embedding with model ${modelName} failed:`, err.message);
        }
      }
    }

    // 3. Emergency: Google Gemini Models Chain
    if (!embeddings && GEMINI_API_KEY) {
      for (const modelName of GEMINI_EMBED_MODELS) {
        try {
          embeddings = await this.embedWithGemini(texts, modelName);
          modelUsed = modelName;
          provider = 'gemini';
          console.log(`[EmbeddingService] ✅ Generated emergency embedding via Gemini model: ${modelName}`);
          break;
        } catch (err: any) {
          lastError = err;
          console.warn(`[EmbeddingService] Gemini embedding with model ${modelName} failed:`, err.message);
        }
      }
    }

    if (!embeddings) {
      throw new Error(
        `[EmbeddingService] All embedding providers failed. Last error: ${lastError?.message || 'No provider available'}.`
      );
    }

    const latencyMs = Date.now() - startTime;
    const normalized = embeddings.map(vec => this.normalizeToSize(vec, CANONICAL_EMBEDDING_DIM));

    return {
      embeddings: normalized,
      modelUsed,
      provider,
      latencyMs,
    };
  }

  private async embedWithNvidiaModel(texts: string[], modelName: string): Promise<number[][]> {
    const response = await fetch(NVIDIA_EMBED_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NVIDIA_API_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        model: modelName,
        input: texts,
        input_type: 'query',
        truncate: 'END',
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`NVIDIA Embedding API error (${modelName}): ${response.status} - ${err}`);
    }

    const data: any = await response.json();
    if (!data.data || !Array.isArray(data.data)) {
      throw new Error(`Invalid NVIDIA embedding response for ${modelName}`);
    }

    data.data.sort((a: any, b: any) => (a.index ?? 0) - (b.index ?? 0));
    return data.data.map((item: any) => item.embedding as number[]);
  }

  private async embedWithOpenRouter(texts: string[], modelName: string): Promise<number[][]> {
    const response = await fetch(OPENROUTER_EMBED_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelName,
        input: texts,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenRouter Embedding API error (${modelName}): ${response.status} - ${err}`);
    }

    const data: any = await response.json();
    if (!data.data || !Array.isArray(data.data)) {
      throw new Error(`Invalid OpenRouter embedding response for ${modelName}`);
    }

    data.data.sort((a: any, b: any) => (a.index ?? 0) - (b.index ?? 0));
    return data.data.map((item: any) => item.embedding as number[]);
  }

  private async embedWithGemini(texts: string[], modelName: string): Promise<number[][]> {
    const requests = texts.map(text => ({
      model: `models/${modelName}`,
      content: { parts: [{ text }] },
    }));

    const response = await fetch(GEMINI_EMBED_URL(GEMINI_API_KEY, modelName), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Gemini Embedding API error: ${response.status} - ${err}`);
    }

    const data: any = await response.json();
    if (!data.embeddings || !Array.isArray(data.embeddings)) {
      throw new Error('Invalid Gemini batch embedding response');
    }

    return data.embeddings.map((e: any) => e.values as number[]);
  }

  private normalizeToSize(vec: number[], size: number): number[] {
    if (vec.length === size) return vec;
    if (vec.length > size) return vec.slice(0, size);
    return [...vec, ...new Array(size - vec.length).fill(0)];
  }
}

export const embeddingService = new EmbeddingService();
