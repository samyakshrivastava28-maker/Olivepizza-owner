import express from 'express';
import multer from 'multer';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import { pineconeService } from '../services/ai/PineconeService.js';
import { knowledgeSync } from '../services/ai/KnowledgeSync.js';
import { semanticSearch } from '../services/ai/SemanticSearch.js';
import { knowledgeIndexer } from '../services/ai/KnowledgeIndexer.js';
import { aiProviderStats } from '../services/ai.service.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB

// ── HEALTH & STATUS ──────────────────────────────────────────────
router.get('/health', requireAuth, requireRole(['owner', 'admin']), async (req, res) => {
  try {
    const pineconeStatus = await pineconeService.getStatus();
    res.json({
      success: true,
      pinecone: pineconeStatus,
      providers: aiProviderStats,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── HEALTH & DIAGNOSTICS ─────────────────────────────────────────
router.get('/diagnostics', requireAuth, requireRole(['owner', 'admin']), async (req, res) => {
  try {
    const { adminDb } = await import('../config/firebase.js');
    
    // Count queue size
    const queueSnap = await adminDb.collection('_pinecone_sync_queue_').get();
    let pendingJobs = 0;
    let failedJobs = 0;
    queueSnap.forEach((doc: any) => {
      const data = doc.data();
      if (data.status === 'failed' || data.retryCount > 0) failedJobs++;
      else pendingJobs++;
    });

    // Count metadata vectors synced
    const metaSnap = await adminDb.collection('_pinecone_metadata_').count().get();
    const totalVectors = metaSnap.data().count;

    const pineconeStatus = await pineconeService.getStatus();

    res.json({
      success: true,
      diagnostics: {
        totalVectors,
        queue: {
          pendingJobs,
          failedOrRetryingJobs: failedJobs,
          totalQueueSize: queueSnap.size
        },
        pineconeStatus
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── REBUILD / SYNC ───────────────────────────────────────────────
router.post('/reindex', requireAuth, requireRole(['owner', 'admin']), async (req, res) => {
  try {
    // Clear all existing Pinecone vectors before re-indexing
    await pineconeService.clearAll();

    // Sync all data from Firestore cache into Pinecone
    const result = await knowledgeSync.syncAll();

    if (result.success) {
      res.json({ success: true, message: 'Pinecone successfully re-indexed with Firestore data.', stats: result.stats });
    } else {
      res.status(500).json({ success: false, error: 'Re-indexing failed during Firestore sync.' });
    }
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── SEARCH TESTER ────────────────────────────────────────────────
router.post('/search', requireAuth, requireRole(['owner', 'admin']), async (req, res) => {
  try {
    const { query, topK, category } = req.body;
    if (!query) return res.status(400).json({ success: false, error: 'Query is required' });

    const results = await semanticSearch.search(query, {
      topK: topK || 5,
      category: category || undefined,
      minScore: 0.1, // Show more for testing
    });

    res.json({ success: true, results });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── DOCUMENT UPLOAD ──────────────────────────────────────────────
router.post('/index-file', requireAuth, requireRole(['owner', 'admin']), upload.single('file'), async (req: any, res: any) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    const file = req.file;
    const category = req.body.category || 'Uploaded Document';
    const docId = `upload-${Date.now()}`;

    const success = await knowledgeIndexer.indexFile(file.buffer, file.mimetype, {
      documentId: docId,
      documentType: file.mimetype,
      source: `upload:${file.originalname}`,
      category: category,
      version: Date.now(),
    });

    if (success) {
      res.json({ success: true, message: 'File indexed successfully', documentId: docId });
    } else {
      res.status(500).json({ success: false, error: 'Failed to extract and index file' });
    }
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── DELETE DOCUMENT ──────────────────────────────────────────────
router.delete('/document/:id', requireAuth, requireRole(['owner', 'admin']), async (req, res) => {
  try {
    const { id } = req.params;
    await pineconeService.deleteDocument(id);
    res.json({ success: true, message: `Document ${id} deleted from Pinecone.` });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── DIRECT LIVE RE-INDEXING TRIGGER (Owner Edit/Delete) ──────────
router.post('/upsert-item', requireAuth, requireRole(['owner', 'admin']), async (req, res) => {
  try {
    const { id, name, description, price, category, isVeg, tags } = req.body;
    if (!id || !name) {
      return res.status(400).json({ success: false, error: 'Item id and name are required' });
    }

    const success = await knowledgeIndexer.upsertItemDirectly({ id, name, description, price, category, isVeg, tags });
    res.json({ success, message: `Menu item ${name} (id: ${id}) live re-indexed in Pinecone synchronously.` });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/item/:id', requireAuth, requireRole(['owner', 'admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const success = await knowledgeIndexer.removeItemDirectly(id);
    res.json({ success, message: `Item ${id} synchronously removed from Pinecone.` });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
