import { adminDb } from '../../config/firebase.js';
import crypto from 'crypto';
import { embeddingService } from './EmbeddingService.js';
import { pineconeService } from './PineconeService.js';
import { embeddingCache } from './embeddingCache.js';

export interface SyncJob {
  docId: string;
  docType: 'products' | 'coupons' | 'categories' | 'combos' | 'settings' | 'faqs' | 'policies' | 'store_pages';
  data: any; // Raw document data to embed
  status: 'pending' | 'failed';
  retryCount: number;
  nextRetryAt: number;
  createdAt: number;
}

const MAX_RETRIES = 5;
const RETRY_BACKOFF_MS = [60000, 300000, 900000, 1800000, 3600000]; // 1m, 5m, 15m, 30m, 1h

export class PineconeSyncWorker {
  private isProcessing = false;
  private intervalId: NodeJS.Timeout | null = null;

  start() {
    if (this.intervalId) return;
    console.log('[PineconeSyncWorker] Starting background sync worker...');
    // Poll every 10 seconds for jobs
    this.intervalId = setInterval(() => this.processQueue(), 10000);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Enqueue a synchronization job to Firestore (Durable Queue)
   */
  async enqueue(docType: SyncJob['docType'], docId: string, data: any) {
    if (!docId) return;
    try {
      // Don't stringify functions or circular refs, clean raw data
      const cleanData = JSON.parse(JSON.stringify(data));
      
      const job: SyncJob = {
        docId,
        docType,
        data: cleanData,
        status: 'pending',
        retryCount: 0,
        nextRetryAt: Date.now(),
        createdAt: Date.now(),
      };

      await adminDb.collection('_pinecone_sync_queue_').doc(`${docType}_${docId}`).set(job);
      console.log(`[PineconeSyncWorker] Enqueued ${docType}:${docId}`);
    } catch (err: any) {
      console.error(`[PineconeSyncWorker] Failed to enqueue ${docType}:${docId}`, err.message);
    }
  }

  /**
   * Enqueue a deletion job
   */
  async enqueueDelete(docType: SyncJob['docType'], docId: string) {
    if (!docId) return;
    try {
      const job: SyncJob = {
        docId,
        docType,
        data: { _isDelete: true }, // special flag for deletion
        status: 'pending',
        retryCount: 0,
        nextRetryAt: Date.now(),
        createdAt: Date.now(),
      };

      await adminDb.collection('_pinecone_sync_queue_').doc(`delete_${docType}_${docId}`).set(job);
      console.log(`[PineconeSyncWorker] Enqueued DELETE ${docType}:${docId}`);
    } catch (err: any) {
      console.error(`[PineconeSyncWorker] Failed to enqueue delete ${docType}:${docId}`, err.message);
    }
  }

  public async syncNow(docType: SyncJob['docType'], docId: string, data: any): Promise<void> {
    try {
      const job: SyncJob = {
        docId, docType, data: JSON.parse(JSON.stringify(data)),
        status: 'pending', retryCount: 0, nextRetryAt: Date.now(), createdAt: Date.now()
      };
      // We pass a dummy jobId since we aren't pulling from Firestore queue
      await this.processJob(`direct_sync_${docId}`, job, false);
    } catch (err: any) {
      console.error(`[PineconeSyncWorker] syncNow failed for ${docType}:${docId}:`, err.message);
    }
  }

  private backoffUntil: number = 0;

  private async processQueue() {
    if (this.isProcessing) return;
    if (Date.now() < this.backoffUntil) return;
    this.isProcessing = true;

    try {
      const now = Date.now();
      const snapshot = await adminDb.collection('_pinecone_sync_queue_')
        .where('status', '==', 'pending')
        .limit(25)
        .get();

      if (snapshot.empty) {
        this.isProcessing = false;
        return;
      }

      const eligibleDocs = snapshot.docs.filter((doc) => {
        const job = doc.data() as SyncJob;
        return !job.nextRetryAt || job.nextRetryAt <= now;
      }).slice(0, 10);

      for (const doc of eligibleDocs) {
        const job = doc.data() as SyncJob;
        await this.processJob(doc.id, job);
      }
    } catch (err: any) {
      if (err.message?.includes('RESOURCE_EXHAUSTED') || err.message?.includes('Quota exceeded')) {
        this.backoffUntil = Date.now() + 120000; // 2-min backoff
        console.warn('[PineconeSyncWorker] Firestore read quota reached. Backing off sync worker for 2 minutes.');
      } else {
        console.error('[PineconeSyncWorker] Error processing queue:', err.message);
      }
    } finally {
      this.isProcessing = false;
    }
  }

  private async processJob(jobId: string, job: SyncJob, isFromQueue = true) {
    try {
      // 1. Is this a delete operation?
      if (job.data && job.data._isDelete) {
        await pineconeService.deleteDocument(job.docId);
        embeddingCache.invalidate(job.docType as any);
        await adminDb.collection('_pinecone_metadata_').doc(`${job.docType}_${job.docId}`).delete();
        if (isFromQueue) await adminDb.collection('_pinecone_sync_queue_').doc(jobId).delete();
        console.log(`[PineconeSyncWorker] Successfully processed DELETE for ${job.docType}:${job.docId}`);
        return;
      }

      // 2. Generate Checksum of data to prevent duplicate embedding
      const dataString = JSON.stringify(job.data);
      const checksum = crypto.createHash('sha256').update(dataString).digest('hex');

      const metaRef = adminDb.collection('_pinecone_metadata_').doc(`${job.docType}_${job.docId}`);
      const metaSnap = await metaRef.get();
      
      let currentVersion = 1;
      if (metaSnap.exists) {
        const meta = metaSnap.data();
        if (meta?.checksum === checksum) {
          // No changes, skip embedding to save tokens/time
          console.log(`[PineconeSyncWorker] Skipped ${job.docType}:${job.docId} - Checksum matches.`);
          if (isFromQueue) await adminDb.collection('_pinecone_sync_queue_').doc(jobId).delete();
          return;
        }
        currentVersion = (meta?.version || 0) + 1;
      }

      // 3. Format text to embed
      const textToEmbed = this.formatTextToEmbed(job.docType, job.docId, job.data);

      // 4. Generate Embedding via NVIDIA
      const vector = await embeddingService.generateEmbedding(textToEmbed);
      if (!vector || vector.length === 0) {
        throw new Error('Failed to generate embedding vector from provider');
      }

      // 5. Upsert vector to Pinecone using stable vector ID (Requirement 14)
      const pointId = `${job.docType}:${job.docId}`;
      await pineconeService.upsertPoints([{
        id: pointId,
        values: vector,
        metadata: {
          documentId: job.docId,
          docType: job.docType,
          content: textToEmbed,
          updatedAt: Date.now(),
          version: currentVersion,
          checksum: checksum,
          type: job.docType,
          // Standardized metadata mapping
          productId: job.docType === 'products' ? job.docId : undefined,
          category: job.data.category || '',
          availability: job.data.isAvailable !== false ? 'true' : 'false',
          price: job.data.price || job.data.basePrice || 0,
          sourceCollection: job.docType,
          lastSync: Date.now()
        } as any
      }]);

      // 7. Update Metadata in Firestore
      await metaRef.set({
        documentId: job.docId,
        docType: job.docType,
        checksum,
        version: currentVersion,
        lastSync: Date.now(),
        updatedAt: Date.now()
      });

      // 8. Clear in-memory LRU cache
      embeddingCache.invalidate(job.docType as any);

      // 9. Mark Job as Done (Remove from queue)
      if (isFromQueue) await adminDb.collection('_pinecone_sync_queue_').doc(jobId).delete();
      console.log(`[PineconeSyncWorker] ✅ Successfully synced ${job.docType}:${job.docId} (v${currentVersion})`);

    } catch (err: any) {
      console.error(`[PineconeSyncWorker] ❌ Error syncing ${job.docType}:${job.docId}:`, err.message);
      
      if (!isFromQueue) return; // Do not retry direct syncs using the queue

      // Exponential Backoff Retry Logic
      const newRetryCount = job.retryCount + 1;
      if (newRetryCount > MAX_RETRIES) {
        console.error(`[PineconeSyncWorker] 🛑 Max retries reached for ${job.docType}:${job.docId}. Failing job.`);
        await adminDb.collection('_pinecone_sync_queue_').doc(jobId).update({
          status: 'failed',
          retryCount: newRetryCount,
          failedReason: err.message
        });
      } else {
        const backoffMs = RETRY_BACKOFF_MS[newRetryCount - 1] || RETRY_BACKOFF_MS[RETRY_BACKOFF_MS.length - 1];
        const nextRetryAt = Date.now() + backoffMs;
        console.log(`[PineconeSyncWorker] Scheduling retry ${newRetryCount}/${MAX_RETRIES} for ${job.docType}:${job.docId} in ${backoffMs / 1000}s`);
        await adminDb.collection('_pinecone_sync_queue_').doc(jobId).update({
          retryCount: newRetryCount,
          nextRetryAt,
          lastError: err.message
        });
      }
    }
  }

  public formatTextToEmbed(docType: string, docId: string, data: any): string {
    if (docType === 'products') {
      return `Product: ${data.name || data.productName} | Category: ${data.category} | Price: ₹${data.basePrice || data.price} | Description: ${data.description || ''} | Veg: ${data.isVegetarian || data.isVeg ? 'Yes' : 'No'}`;
    } else if (docType === 'coupons') {
      return `Coupon Code: ${data.code} | Discount: ${data.discountValue} ${data.discountType} | Min Order: ₹${data.minOrder || 0} | Description: ${data.description || ''}`;
    } else if (docType === 'categories') {
      return `Category: ${data.name} | Description: ${data.description || ''}`;
    } else if (docType === 'settings') {
      return `Store Info: ${data.restaurantName || 'Olive Pizza'} | Address: ${data.address || ''} | Phone: ${data.phone || ''} | Hours: ${data.openingTime || ''} - ${data.closingTime || ''} | Delivery Radius: ${data.deliveryRadius || 0}km`;
    } else if (docType === 'faqs') {
      return `FAQ: Q: ${data.question} | A: ${data.answer} | Category: ${data.category || ''}`;
    } else if (docType === 'policies') {
      return `Policy: ${data.title} | Content: ${data.content}`;
    } else if (docType === 'store_pages') {
       return `Page/Flow: ${data.title || docId} | Content: ${data.content}`;
    } else {
      return `Document: ${data.name || data.title || docId} | Price: ₹${data.price || 0} | Description: ${data.description || data.content || ''}`;
    }
  }
}

export const syncWorker = new PineconeSyncWorker();
