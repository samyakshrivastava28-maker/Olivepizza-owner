import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { pineconeService } from './PineconeService.js';
import { embeddingService } from './EmbeddingService.js';
import crypto from 'crypto';
import * as pdfParseModule from 'pdf-parse';
const pdfParse = (pdfParseModule as any).default || pdfParseModule;
import mammoth from 'mammoth';

export interface DocumentMetadata {
  documentId: string;
  documentType: string;
  source: string;
  uploadDate?: string;
  lastUpdated?: string;
  language?: string;
  category: string;
  tags?: string[];
  version?: number;
  chunkIndex?: number;
  totalChunks?: number;
}

export class KnowledgeIndexer {
  private splitter: RecursiveCharacterTextSplitter;

  constructor() {
    this.splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 800,
      chunkOverlap: 100,
    });
  }

  public async parsePdf(buffer: Buffer): Promise<string> {
    const data = await pdfParse(buffer);
    return data.text;
  }

  public async parseDocx(buffer: Buffer): Promise<string> {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  public async indexText(text: string, metadata: DocumentMetadata): Promise<boolean> {
    try {
      console.log(`[KnowledgeIndexer] Indexing document ${metadata.documentId} [${metadata.category}]`);

      // 1. Split text into chunks
      const chunks = await this.splitter.createDocuments([text]);

      if (chunks.length === 0) return true;

      // 2. Delete existing vectors for this document to prevent duplicates
      await pineconeService.deleteDocument(metadata.documentId);

      // 3. Batch process embeddings
      const texts = chunks.map((c: any) => c.pageContent);
      const embeddings = await embeddingService.generateEmbeddings(texts);

      // 4. Prepare Pinecone vector points
      const points = embeddings.map((vector, index) => ({
        id: crypto.randomUUID(),
        values: vector,
        metadata: {
          ...metadata,
          chunkIndex: index,
          totalChunks: chunks.length,
          content: texts[index],
        } as any,
      }));

      // 5. Upsert to Pinecone (in batches of 100 to respect limits)
      const batchSize = 100;
      for (let i = 0; i < points.length; i += batchSize) {
        const batch = points.slice(i, i + batchSize);
        await pineconeService.upsertPoints(batch);
      }

      console.log(`[KnowledgeIndexer] ✅ Indexed ${points.length} vectors for document ${metadata.documentId}`);
      return true;
    } catch (error: any) {
      console.error(`[KnowledgeIndexer] Error indexing document ${metadata.documentId}:`, error.message);
      console.error('Stack:', error.stack);
      if (error.cause) console.error('Cause:', error.cause);
      return false;
    }
  }

  public async indexFile(buffer: Buffer, mimetype: string, metadata: DocumentMetadata): Promise<boolean> {
    try {
      let text = '';
      if (mimetype === 'application/pdf') {
        text = await this.parsePdf(buffer);
      } else if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        text = await this.parseDocx(buffer);
      } else if (mimetype === 'text/plain' || mimetype === 'text/markdown') {
        text = buffer.toString('utf-8');
      } else {
        throw new Error(`Unsupported file type: ${mimetype}`);
      }

      return await this.indexText(text, metadata);
    } catch (error: any) {
      console.error(`[KnowledgeIndexer] Error parsing file for ${metadata.documentId}:`, error.message);
      return false;
    }
  }

  /**
   * Synchronously re-indexes a public menu item or policy document directly upon owner edits.
   */
  public async upsertItemDirectly(item: { id: string; name: string; description?: string; price?: number; category?: string; isVeg?: boolean; tags?: string[] }): Promise<boolean> {
    const textContent = `Product: ${item.name}. Category: ${item.category || 'menu'}. Price: ₹${item.price ?? 'N/A'}. ${item.isVeg ? 'Vegetarian.' : ''} Description: ${item.description || ''}.`;
    const metadata: DocumentMetadata = {
      documentId: `prod_${item.id}`,
      documentType: 'menu_item',
      source: 'owner_dashboard_direct',
      category: item.category || 'menu',
      tags: item.tags || ['menu', 'public'],
      lastUpdated: new Date().toISOString()
    };

    console.log(`[KnowledgeIndexer] ⚡ Synchronous direct re-indexing triggered for menu item: ${item.name} (id: ${item.id})`);
    return await this.indexText(textContent, metadata);
  }

  /**
   * Synchronously removes a deleted public item from Pinecone vector index directly upon owner deletion.
   */
  public async removeItemDirectly(itemId: string): Promise<boolean> {
    const documentId = itemId.startsWith('prod_') ? itemId : `prod_${itemId}`;
    console.log(`[KnowledgeIndexer] ⚡ Synchronous direct vector deletion triggered for document: ${documentId}`);
    await pineconeService.deleteDocument(documentId);
    return true;
  }
}

export const knowledgeIndexer = new KnowledgeIndexer();
