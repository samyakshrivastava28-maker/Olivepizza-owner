/**
 * PineconeService.ts — Production Vector Database Engine
 *
 * Full-fledged Pinecone Vector Database Integration replacing Qdrant.
 * Handles vector initialization, upserts, semantic search queries, deletion, and index stats.
 *
 * REST API based — Zero native binary or Docker dependency required.
 */

import dotenv from 'dotenv';
dotenv.config();

export const CANONICAL_EMBEDDING_DIM = 1024;
export const PINECONE_INDEX_NAME = process.env.PINECONE_INDEX_NAME || 'olive-pizza';

export interface VectorPoint {
  id: string;
  values: number[];
  metadata: {
    documentId: string;
    type: string;
    category?: string;
    title?: string;
    content: string;
    source?: string;
    updatedAt: number;
    [key: string]: any;
  };
}

export interface PineconeSearchResult {
  id: string;
  score: number;
  metadata: VectorPoint['metadata'];
}

export class PineconeService {
  private apiKey: string;
  private indexHost: string;

  constructor() {
    this.apiKey = process.env.PINECONE_API_KEY || '';
    this.indexHost = process.env.PINECONE_INDEX_HOST || '';
  }

  private getHeaders(): Record<string, string> {
    return {
      'Api-Key': this.apiKey,
      'Content-Type': 'application/json',
      'X-Pinecone-API-Version': '2024-07',
    };
  }

  private getHost(): string {
    if (this.indexHost) {
      return this.indexHost.startsWith('http') ? this.indexHost : `https://${this.indexHost}`;
    }
    // Fallback default index host
    return `https://${PINECONE_INDEX_NAME}-index.pinecone.io`;
  }

  /**
   * Universal fetch wrapper for Pinecone API calls
   */
  private async fetchPinecone(path: string, options: RequestInit = {}): Promise<any> {
    if (!this.apiKey) {
      throw new Error('PINECONE_API_KEY is not configured in .env');
    }

    const baseUrl = this.getHost();
    const url = path.startsWith('http') ? path : `${baseUrl}${path}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        ...this.getHeaders(),
        ...(options.headers || {}),
      },
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Pinecone API Error (${response.status}): ${errText}`);
    }

    return response.json();
  }

  /**
   * Upsert vector points to Pinecone index
   */
  public async upsertPoints(points: VectorPoint[]): Promise<boolean> {
    if (!points || points.length === 0) return true;

    try {
      console.log(`[Pinecone] Upserting ${points.length} vectors to index ${PINECONE_INDEX_NAME}...`);
      await this.fetchPinecone('/vectors/upsert', {
        method: 'POST',
        body: JSON.stringify({
          vectors: points.map(p => ({
            id: p.id,
            values: p.values,
            metadata: p.metadata,
          })),
          namespace: '',
        }),
      });

      console.log(`[Pinecone] ✅ Successfully upserted ${points.length} vector points.`);
      return true;
    } catch (error: any) {
      console.warn(`[Pinecone] Upsert warning: ${error.message}`);
      return false;
    }
  }

  /**
   * Perform top-K semantic search in Pinecone
   */
  public async search(vector: number[], topK: number = 5, filter?: Record<string, any>): Promise<PineconeSearchResult[]> {
    if (!vector || vector.length === 0) return [];

    try {
      const body: any = {
        vector,
        topK,
        includeMetadata: true,
        includeValues: false,
      };

      if (filter) {
        body.filter = filter;
      }

      const res = await this.fetchPinecone('/query', {
        method: 'POST',
        body: JSON.stringify(body),
      });

      const matches = res.matches || [];
      return matches.map((m: any) => ({
        id: m.id,
        score: m.score || 0,
        metadata: m.metadata || { documentId: m.id, type: 'unknown', content: '' },
      }));
    } catch (error: any) {
      console.warn('[Pinecone] Search warning:', error.message);
      return [];
    }
  }

  /**
   * Delete vector points by document ID
   */
  public async deleteDocument(docId: string): Promise<void> {
    try {
      await this.fetchPinecone('/vectors/delete', {
        method: 'POST',
        body: JSON.stringify({
          filter: {
            documentId: { '$eq': docId }
          }
        }),
      });
      console.log(`[Pinecone] Deleted vectors for documentId: ${docId}`);
    } catch (error: any) {
      console.warn(`[Pinecone] Delete document warning for ${docId}:`, error.message);
    }
  }

  /**
   * Clear all vectors in the index
   */
  public async clearAll(): Promise<void> {
    try {
      await this.fetchPinecone('/vectors/delete', {
        method: 'POST',
        body: JSON.stringify({ deleteAll: true }),
      });
      console.log(`[Pinecone] Cleared all vectors in index.`);
    } catch (error: any) {
      console.warn('[Pinecone] Clear all warning:', error.message);
    }
  }

  /**
   * Get Pinecone index status & stats for Developer Diagnostics
   */
  public async getStatus(): Promise<{
    ok: boolean;
    indexName: string;
    vectorCount?: number;
    dimension?: number;
    error?: string;
  }> {
    try {
      const stats = await this.fetchPinecone('/describe_index_stats', { method: 'POST', body: '{}' });
      return {
        ok: true,
        indexName: PINECONE_INDEX_NAME,
        vectorCount: stats.totalRecordCount || stats.totalVectorCount || 0,
        dimension: stats.dimension || CANONICAL_EMBEDDING_DIM,
      };
    } catch (error: any) {
      return {
        ok: false,
        indexName: PINECONE_INDEX_NAME,
        error: error.message,
      };
    }
  }
}

export const pineconeService = new PineconeService();
