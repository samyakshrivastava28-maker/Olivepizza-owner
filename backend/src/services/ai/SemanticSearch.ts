import { pineconeService, PINECONE_INDEX_NAME } from './PineconeService.js';
import { embeddingService } from './EmbeddingService.js';

export interface SearchOptions {
  topK?: number;
  minScore?: number;
  category?: string;
  tags?: string[];
}

export interface SearchResult {
  content: string;
  score: number;
  metadata: any;
}

export interface DetailedSearchResult {
  results: SearchResult[];
  telemetry: {
    embeddingLatencyMs: number;
    embeddingModelUsed: string;
    embeddingProvider: string;
    qdrantLatencyMs: number; // Retained field name for backwards telemetry compatibility
    collectionName: string;
    totalHitsReturned: number;
    matchedChunksCount: number;
    topSimilarityScore: number;
    zeroChunkReason?: string;
  };
}

export class SemanticSearch {

  public async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    const detailed = await this.searchDetailed(query, options);
    return detailed.results;
  }

  public async searchDetailed(query: string, options: SearchOptions = {}): Promise<DetailedSearchResult> {
    const topK = options.topK || 8;
    const minScore = options.minScore || 0.45; // Cosine similarity threshold

    let embedRes;
    let pineconeSearchRes: any[] = [];
    let searchLatencyMs = 0;
    let zeroChunkReason: string | undefined = undefined;

    // 1. Generate query embedding with timing & provider details
    try {
      embedRes = await embeddingService.generateEmbeddingsDetailed([query]);
    } catch (err: any) {
      console.error('[SemanticSearch] Embedding generation failed:', err.message);
      return {
        results: [],
        telemetry: {
          embeddingLatencyMs: 0,
          embeddingModelUsed: 'none',
          embeddingProvider: 'none',
          qdrantLatencyMs: 0,
          collectionName: PINECONE_INDEX_NAME,
          totalHitsReturned: 0,
          matchedChunksCount: 0,
          topSimilarityScore: 0,
          zeroChunkReason: `Embedding generation failed: ${err.message}`,
        }
      };
    }

    const queryVector = embedRes.embeddings[0];

    // 2. Build Pinecone filter
    let pineconeFilter: Record<string, any> | undefined = undefined;
    if (options.category) {
      pineconeFilter = { category: { '$eq': options.category } };
    }

    // 3. Search Pinecone Vector DB
    const searchStart = Date.now();
    try {
      pineconeSearchRes = await pineconeService.search(queryVector, topK, pineconeFilter);
      searchLatencyMs = Date.now() - searchStart;
    } catch (err: any) {
      searchLatencyMs = Date.now() - searchStart;
      console.error('[SemanticSearch] Pinecone search failed:', err.message);
      zeroChunkReason = `Pinecone connection error: ${err.message}`;
    }

    // 4. Filter and map results
    const matched = pineconeSearchRes.filter((hit: any) => hit.score >= minScore);
    const results: SearchResult[] = matched.map((hit: any) => ({
      content: hit.metadata?.content || hit.metadata?.text || '',
      score: hit.score,
      metadata: hit.metadata || {},
    }));

    const topScore = results.length > 0 ? results[0].score : 0;

    if (results.length === 0 && !zeroChunkReason) {
      if (pineconeSearchRes.length === 0) {
        zeroChunkReason = 'No vector matches found in Pinecone database.';
      } else {
        zeroChunkReason = `All ${pineconeSearchRes.length} hits were below minScore threshold (${minScore}). Top score was ${pineconeSearchRes[0]?.score?.toFixed(3)}.`;
      }
    }

    return {
      results,
      telemetry: {
        embeddingLatencyMs: embedRes.latencyMs,
        embeddingModelUsed: embedRes.modelUsed,
        embeddingProvider: embedRes.provider,
        qdrantLatencyMs: searchLatencyMs,
        collectionName: PINECONE_INDEX_NAME,
        totalHitsReturned: pineconeSearchRes.length,
        matchedChunksCount: results.length,
        topSimilarityScore: topScore,
        zeroChunkReason,
      }
    };
  }
}

export const semanticSearch = new SemanticSearch();
