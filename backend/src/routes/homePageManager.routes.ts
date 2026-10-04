import express from 'express';
import multer from 'multer';
import { verifyToken, requireRole, AuthRequest } from '../middleware/auth.middleware.js';
import { PagePackageService, FALLBACK_STANDARD_SCHEMA } from '../services/storage/PagePackageService.js';
import { PageSchema, BuiltInPageSchema, CustomStaticPackageSchema } from '../types/PageSchema.js';
import { ActionRegistry } from '../utils/ActionRegistry.js';
import { PREDEFINED_TEMPLATES, getTemplateById } from '../utils/HomePageTemplates.js';
import { adminDb } from '../config/firebase.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB limit

import { redisService } from '../services/redis/RedisService.js';

// ============================================================================
// PUBLIC ROUTE: Customer Home Page fetches the live pointer configuration here
// ============================================================================
router.get('/live', async (req, res) => {
  try {
    // 1. Try Redis cache first (sub-millisecond acceleration)
    try {
      const cached = await redisService.get<any>('homepage:live');
      if (cached) {
        return res.json({ success: true, config: cached, source: 'redis_cache' });
      }
    } catch (redisErr) {
      console.warn('[HomePageManager] Redis cache read notice:', redisErr);
    }

    // 2. Try Firestore settings/homepage for 0-latency cached pointer
    let config: any = null;
    try {
      const snap = await adminDb.collection('settings').doc('homepage').get();
      if (snap.exists && snap.data()?.config) {
        config = snap.data()!.config;
      }
    } catch (fsErr) {
      console.warn('[HomePageManager] Firestore live read fallback:', fsErr);
    }

    // 3. R2 Fallback
    if (!config) {
      config = await PagePackageService.getLiveManifest();
    }

    // Populate Redis cache asynchronously (300s TTL)
    if (config) {
      redisService.set('homepage:live', config, 300).catch(() => {});
    }

    res.json({ success: true, config, source: config ? 'authoritative' : 'fallback' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message, config: FALLBACK_STANDARD_SCHEMA });
  }
});

// ============================================================================
// ADMIN ROUTES: Require owner, admin, or developer role
// ============================================================================
router.use(verifyToken);
router.use(requireRole(['owner', 'admin', 'developer']));

// Predefined official templates collection
router.get('/collection', async (req, res) => {
  try {
    res.json({ success: true, collection: PREDEFINED_TEMPLATES });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get all "Made by Me" custom templates created/customized by owner
router.get('/made-by-me', async (req, res) => {
  try {
    const snap = await adminDb.collection('made_by_me_templates').orderBy('updatedAt', 'desc').get().catch(() => ({ docs: [] }));
    const templates: any[] = [];
    snap.docs.forEach((d: any) => {
      templates.push({ id: d.id, ...d.data() });
    });
    res.json({ success: true, templates });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Save or Update a "Made by Me" template
router.post('/made-by-me', async (req: AuthRequest, res) => {
  try {
    const { schema } = req.body;
    if (!schema || !schema.pageId) {
      return res.status(400).json({ success: false, error: 'Valid page schema with pageId is required' });
    }

    // Protect official predefined template IDs from being overwritten directly
    const isOfficial = PREDEFINED_TEMPLATES.some(t => t.pageId === schema.pageId && schema.isOwnerCustom !== true);
    const finalPageId = isOfficial ? `${schema.pageId}_custom_${Date.now()}` : schema.pageId;

    const templateData = {
      ...schema,
      pageId: finalPageId,
      isMadeByMe: true,
      updatedAt: new Date().toISOString(),
      updatedBy: req.user?.uid || 'owner',
      metadata: {
        ...schema.metadata,
        name: schema.metadata?.name || 'My Custom Home',
        updatedAt: new Date().toISOString(),
        publishedBy: req.user?.uid || 'owner'
      }
    };

    await adminDb.collection('made_by_me_templates').doc(finalPageId).set(templateData, { merge: true });
    
    // Also save draft copy to Cloudflare R2
    PagePackageService.saveDraft(templateData).catch((e: any) => console.warn('[HomePage] R2 draft save notice:', e));

    res.json({ success: true, template: templateData, pageId: finalPageId });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete a "Made by Me" template
router.delete('/made-by-me/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Protect official templates from deletion
    if (PREDEFINED_TEMPLATES.some(t => t.pageId === id)) {
      return res.status(403).json({ success: false, error: 'Cannot delete official prebuilt system templates.' });
    }

    await adminDb.collection('made_by_me_templates').doc(id).delete();
    res.json({ success: true, deletedId: id });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Switch live homepage to a template or schema
router.post('/switch', async (req: AuthRequest, res) => {
  try {
    const { pageId, schema } = req.body;
    if (!pageId && !schema) return res.status(400).json({ success: false, error: 'pageId or schema required' });
    
    let targetSchema = schema;
    if (!targetSchema && pageId) {
      // 1. Check official templates
      targetSchema = getTemplateById(pageId);
      // 2. Check Made by Me templates
      if (!targetSchema) {
        const docSnap = await adminDb.collection('made_by_me_templates').doc(pageId).get();
        if (docSnap.exists) {
          targetSchema = docSnap.data() as PageSchema;
        }
      }
    }

    if (!targetSchema) return res.status(404).json({ success: false, error: 'Template or schema not found' });
    
    const schemaToPublish: PageSchema = {
      ...targetSchema,
      pageId: pageId || targetSchema.pageId,
      versionId: `v${Date.now()}`,
      metadata: {
        ...targetSchema.metadata,
        publishedBy: req.user?.uid || 'owner',
        publishedAt: new Date().toISOString()
      }
    };
    
    // 1. Write to Cloudflare R2
    const r2Success = await PagePackageService.publishLiveManifest(schemaToPublish);
    
    // 2. Write to Firestore for instant real-time sync with customer app
    await adminDb.collection('settings').doc('homepage').set({
      config: schemaToPublish,
      activePageId: schemaToPublish.pageId,
      activeTemplateName: schemaToPublish.metadata?.name || schemaToPublish.pageId,
      updatedAt: new Date().toISOString(),
      updatedBy: req.user?.uid || 'owner'
    }, { merge: true }).catch((fsErr: any) => console.warn('[HomePageManager] Firestore live sync warning:', fsErr));

    // 3. Invalidate Redis cache
    await redisService.del('homepage:live').catch(() => {});
    await redisService.set('homepage:live', schemaToPublish, 300).catch(() => {});

    // 4. Record in PostgreSQL revision history
    try {
      const { pgPool } = await import('../config/postgres.js');
      const client = await pgPool.connect();
      try {
        await client.query(`
          UPDATE homepage_revisions SET is_active = FALSE WHERE is_active = TRUE;
          INSERT INTO homepage_revisions (version_id, page_id, title, schema_json, published_by, is_active)
          VALUES ($1, $2, $3, $4, $5, TRUE);
        `, [
          schemaToPublish.versionId,
          schemaToPublish.pageId,
          schemaToPublish.metadata?.name || schemaToPublish.pageId,
          JSON.stringify(schemaToPublish),
          req.user?.uid || 'owner'
        ]);
      } finally {
        client.release();
      }
    } catch {}

    res.json({ success: true, config: schemaToPublish });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/config', async (req, res) => {
  try {
    const config = await PagePackageService.getLiveManifest();
    res.json({ success: true, config });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get Revision History for Owner Rollback
router.get('/revisions', async (req, res) => {
  try {
    let revisions: any[] = [];
    try {
      const { pgPool } = await import('../config/postgres.js');
      const client = await pgPool.connect();
      try {
        const result = await client.query(
          `SELECT version_id, page_id, title, published_by, is_active, created_at 
           FROM homepage_revisions ORDER BY created_at DESC LIMIT 15`
        );
        revisions = result.rows;
      } finally {
        client.release();
      }
    } catch {}

    if (revisions.length === 0) {
      // Fallback to Firestore revisions
      const snap = await adminDb.collection('homepage_revisions')
        .orderBy('createdAt', 'desc')
        .limit(15)
        .get()
        .catch(() => ({ docs: [] as any[] }));
      revisions = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }

    res.json({ success: true, revisions });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Save a draft without publishing it live
router.post('/save', async (req: AuthRequest, res) => {
  try {
    const schema: PageSchema = req.body.schema;
    if (!schema) {
      return res.status(400).json({ success: false, error: 'Schema is required' });
    }

    schema.metadata = {
      ...schema.metadata,
      publishedBy: req.user?.uid || 'owner',
      publishedAt: new Date().toISOString()
    };
    
    schema.versionId = `v${Date.now()}`;
    const success = await PagePackageService.saveDraft(schema);
    
    if (success) {
      res.json({ success: true, config: schema });
    } else {
      throw new Error('Failed to save draft to R2');
    }
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Publish directly from Editor with concurrency lock and cache invalidation
router.post('/publish', async (req: AuthRequest, res) => {
  let lockAcquired = false;
  try {
    const schema: PageSchema = req.body.schema;
    
    if (!schema) {
      return res.status(400).json({ success: false, error: 'Schema is required' });
    }

    // Backend Validation of Schema Actions
    if (schema.type === 'BUILT_IN' || schema.type === 'CUSTOM_SCHEMA') {
      for (const section of schema.sections || []) {
        if (section.config && section.config.buttonAction) {
          const isValid = ActionRegistry.validate(section.config.buttonAction);
          if (!isValid) {
            return res.status(400).json({ success: false, error: `Invalid action in section ${section.id}: ${section.config.buttonAction}` });
          }
        }
      }
    }

    // Concurrency Lock: prevent two simultaneous publishes from clobbering each other
    lockAcquired = await redisService.acquireLock('lock:homepage_publish', 8);
    if (!lockAcquired && process.env.NODE_ENV !== 'test') {
      return res.status(409).json({ success: false, error: 'Another publish is currently processing. Please wait a moment.' });
    }

    schema.metadata = {
      ...schema.metadata,
      publishedBy: req.user?.uid || 'owner',
      publishedAt: new Date().toISOString()
    };
    
    schema.versionId = `v${Date.now()}`;

    // 1. R2 Publish
    await PagePackageService.publishLiveManifest(schema);
    
    // 2. Firestore Sync
    await adminDb.collection('settings').doc('homepage').set({
      config: schema,
      activePageId: schema.pageId,
      activeTemplateName: schema.metadata?.name || schema.pageId,
      updatedAt: new Date().toISOString(),
      updatedBy: req.user?.uid || 'owner'
    }, { merge: true }).catch(() => {});

    // 3. Invalidate Redis Cache & repopulate
    await redisService.del('homepage:live').catch(() => {});
    await redisService.set('homepage:live', schema, 300).catch(() => {});

    // 4. Save to PostgreSQL homepage_revisions
    try {
      const { pgPool } = await import('../config/postgres.js');
      const client = await pgPool.connect();
      try {
        await client.query(`
          UPDATE homepage_revisions SET is_active = FALSE WHERE is_active = TRUE;
          INSERT INTO homepage_revisions (version_id, page_id, title, schema_json, published_by, is_active)
          VALUES ($1, $2, $3, $4, $5, TRUE);
        `, [
          schema.versionId,
          schema.pageId,
          schema.metadata?.name || schema.pageId,
          JSON.stringify(schema),
          req.user?.uid || 'owner'
        ]);
      } finally {
        client.release();
      }
    } catch {}

    // 5. Also save revision record to Firestore for instant admin dashboard listing
    await adminDb.collection('homepage_revisions').doc(schema.versionId).set({
      version_id: schema.versionId,
      page_id: schema.pageId,
      title: schema.metadata?.name || schema.pageId,
      published_by: req.user?.uid || 'owner',
      createdAt: new Date().toISOString(),
      is_active: true
    }).catch(() => {});

    res.json({ success: true, config: schema });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  } finally {
    if (lockAcquired) {
      await redisService.releaseLock('lock:homepage_publish').catch(() => {});
    }
  }
});

// Rollback to previous version or default
router.post('/rollback', async (req, res) => {
  try {
    const { pageId, versionId } = req.body;
    
    // 1. Invalidate Redis Cache
    await redisService.del('homepage:live').catch(() => {});

    if (!pageId || !versionId) {
      // Restore default fallback
      await PagePackageService.publishLiveManifest(FALLBACK_STANDARD_SCHEMA);
      await adminDb.collection('settings').doc('homepage').set({
        config: FALLBACK_STANDARD_SCHEMA,
        activePageId: 'default',
        activeTemplateName: 'Default Home (Fallback)',
        updatedAt: new Date().toISOString()
      }, { merge: true }).catch(() => {});

      await redisService.set('homepage:live', FALLBACK_STANDARD_SCHEMA, 300).catch(() => {});
      return res.json({ success: true, config: FALLBACK_STANDARD_SCHEMA });
    }
    
    const success = await PagePackageService.rollbackManifest(pageId, versionId);
    if (success) {
      const config = await PagePackageService.getLiveManifest();
      await adminDb.collection('settings').doc('homepage').set({
        config,
        activePageId: pageId,
        updatedAt: new Date().toISOString()
      }, { merge: true }).catch(() => {});

      await redisService.set('homepage:live', config, 300).catch(() => {});
      res.json({ success: true, config });
    } else {
      throw new Error('Failed to rollback');
    }
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
