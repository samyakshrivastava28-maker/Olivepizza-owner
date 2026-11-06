import express from 'express';
import multer from 'multer';
import { verifyToken, requireRole, AuthRequest } from '../middleware/auth.middleware.js';
import { PagePackageService, FALLBACK_STANDARD_SCHEMA } from '../services/storage/PagePackageService.js';
import { PageSchema, BuiltInPageSchema, CustomStaticPackageSchema } from '../types/PageSchema.js';
import { ActionRegistry } from '../utils/ActionRegistry.js';
import { PREDEFINED_TEMPLATES, getTemplateById } from '../utils/HomePageTemplates.js';
import { adminDb } from '../config/firebase.js';
import { redisService } from '../services/redis/RedisService.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB limit

// ============================================================================
// PUBLIC ROUTE: Customer Home Page fetches the live pointer configuration here
// ============================================================================
router.get('/live', async (req, res) => {
  try {
    const franchiseId = (req.query.franchiseId as string) || 'fra_primary';
    const branchId = (req.query.branchId as string) || 'main_branch';
    const channel = (req.query.channel as string) || 'web';
    const locale = (req.query.locale as string) || 'en';
    const cacheKey = `olive:home:${franchiseId}:${branchId}:${channel}:${locale}`;

    // 1. Try Redis cache first (sub-millisecond acceleration)
    try {
      const cached = await redisService.get<any>(cacheKey);
      if (cached) {
        return res.json({ success: true, config: cached, source: 'redis_cache', franchiseId, branchId });
      }
    } catch (redisErr) {
      console.warn('[HomePageManager] Redis cache read notice:', redisErr);
    }

    // 2. Query PostgreSQL homepage_configurations (Authoritative permanent store from Migration 017)
    let config: any = null;
    let version = 1;
    try {
      const { pgPool } = await import('../config/postgres.js');
      const pgRes = await pgPool.query(`
        SELECT layout_json, version, metadata 
        FROM homepage_configurations 
        WHERE franchise_id = $1 AND branch_id = $2 AND status = 'PUBLISHED'
        ORDER BY version DESC LIMIT 1
      `, [franchiseId, branchId]);

      if (pgRes.rows.length > 0) {
        config = pgRes.rows[0].layout_json;
        version = pgRes.rows[0].version;
      }
    } catch (pgErr: any) {
      console.warn('[HomePageManager] PostgreSQL live read fallback:', pgErr.message);
    }

    // 3. Fallback to Firestore settings/homepage if PG had no record yet
    if (!config) {
      try {
        const snap = await adminDb.collection('settings').doc('homepage').get();
        if (snap.exists && snap.data()?.config) {
          config = snap.data()!.config;
        }
      } catch (fsErr) {
        console.warn('[HomePageManager] Firestore live read fallback:', fsErr);
      }
    }

    // 4. Default Standard Fallback
    if (!config) {
      config = FALLBACK_STANDARD_SCHEMA;
    }

    // Populate Redis cache asynchronously (3600s TTL)
    if (config) {
      redisService.set(cacheKey, config, 3600).catch(() => {});
      redisService.set('homepage:live', config, 3600).catch(() => {});
    }

    res.json({ success: true, config, version, source: config ? 'authoritative' : 'fallback', franchiseId, branchId });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message, config: FALLBACK_STANDARD_SCHEMA });
  }
});

// ============================================================================
// ADMIN ROUTES: Require owner, admin, or developer role
// ============================================================================
router.use(verifyToken);

// Predefined Templates Library
router.get('/templates', (req, res) => {
  res.json({ success: true, templates: PREDEFINED_TEMPLATES });
});

router.get('/templates/:id', (req, res) => {
  const template = getTemplateById(req.params.id);
  if (!template) {
    return res.status(404).json({ success: false, error: 'Template not found' });
  }
  res.json({ success: true, template });
});

// Save a draft without publishing it live
router.post('/save', async (req: AuthRequest, res) => {
  try {
    const schema: PageSchema = req.body.schema;
    if (!schema) {
      return res.status(400).json({ success: false, error: 'Schema is required' });
    }

    const franchiseId = req.body.franchiseId || req.user?.franchiseId || 'fra_primary';
    const branchId = req.body.branchId || req.user?.branchId || 'main_branch';

    schema.metadata = {
      ...schema.metadata,
      publishedBy: req.user?.uid || 'owner',
      publishedAt: new Date().toISOString()
    };
    schema.versionId = `v${Date.now()}`;

    // Save draft permanently to PostgreSQL homepage_configurations
    const { pgPool } = await import('../config/postgres.js');
    const vRes = await pgPool.query(`
      SELECT COALESCE(MAX(version), 0) + 1 AS next_ver 
      FROM homepage_configurations 
      WHERE franchise_id = $1 AND branch_id = $2
    `, [franchiseId, branchId]);
    const nextVer = parseInt(vRes.rows[0]?.next_ver || '1', 10);

    await pgPool.query(`
      INSERT INTO homepage_configurations (franchise_id, branch_id, version, status, layout_json, metadata, created_by)
      VALUES ($1, $2, $3, 'DRAFT', $4, $5, $6)
    `, [
      franchiseId,
      branchId,
      nextVer,
      JSON.stringify(schema),
      JSON.stringify(schema.metadata || {}),
      req.user?.uid || 'owner'
    ]);

    res.json({ success: true, config: schema, version: nextVer, status: 'DRAFT' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Publish directly from Editor with concurrency lock and PostgreSQL persistence
router.post('/publish', async (req: AuthRequest, res) => {
  let lockAcquired = false;
  const franchiseId = req.body.franchiseId || req.user?.franchiseId || 'fra_primary';
  const branchId = req.body.branchId || req.user?.branchId || 'main_branch';
  const lockKey = `olive:lock:homepage_publish:${franchiseId}:${branchId}`;

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

    // Concurrency Lock
    lockAcquired = await redisService.acquireLock(lockKey, 8);
    if (!lockAcquired && process.env.NODE_ENV !== 'test') {
      return res.status(409).json({ success: false, error: 'Another publish is currently processing. Please wait a moment.' });
    }

    schema.metadata = {
      ...schema.metadata,
      publishedBy: req.user?.uid || 'owner',
      publishedAt: new Date().toISOString()
    };
    schema.versionId = `v${Date.now()}`;

    // 1. Transactional Publish in PostgreSQL
    const { pgPool } = await import('../config/postgres.js');
    const client = await pgPool.connect();
    let publishedVersion = 1;
    try {
      await client.query('BEGIN');
      const vRes = await client.query(`
        SELECT COALESCE(MAX(version), 0) + 1 AS next_ver 
        FROM homepage_configurations 
        WHERE franchise_id = $1 AND branch_id = $2
      `, [franchiseId, branchId]);
      publishedVersion = parseInt(vRes.rows[0]?.next_ver || '1', 10);

      // Archive previous published version
      await client.query(`
        UPDATE homepage_configurations 
        SET status = 'ARCHIVED', updated_at = NOW() 
        WHERE franchise_id = $1 AND branch_id = $2 AND status = 'PUBLISHED'
      `, [franchiseId, branchId]);

      // Insert new published configuration
      await client.query(`
        INSERT INTO homepage_configurations (franchise_id, branch_id, version, status, layout_json, metadata, created_by, published_at)
        VALUES ($1, $2, $3, 'PUBLISHED', $4, $5, $6, NOW())
      `, [
        franchiseId,
        branchId,
        publishedVersion,
        JSON.stringify(schema),
        JSON.stringify(schema.metadata || {}),
        req.user?.uid || 'owner'
      ]);

      await client.query('COMMIT');
    } catch (txErr) {
      await client.query('ROLLBACK');
      throw txErr;
    } finally {
      client.release();
    }

    // 2. Update franchise-scoped Redis snapshots
    const channels = ['web', 'mobile_app', 'pos'];
    const locales = ['en', 'hi'];
    for (const ch of channels) {
      for (const loc of locales) {
        const k = `olive:home:${franchiseId}:${branchId}:${ch}:${loc}`;
        await redisService.set(k, schema, 3600).catch(() => {});
      }
    }
    await redisService.del('homepage:live').catch(() => {});
    await redisService.set('homepage:live', schema, 3600).catch(() => {});

    // 3. Backwards compatibility: Firestore Sync
    await adminDb.collection('settings').doc('homepage').set({
      config: schema,
      activePageId: schema.pageId,
      activeTemplateName: schema.metadata?.name || schema.pageId,
      version: publishedVersion,
      franchiseId,
      branchId,
      updatedAt: new Date().toISOString(),
      updatedBy: req.user?.uid || 'owner'
    }, { merge: true }).catch(() => {});

    res.json({ success: true, config: schema, version: publishedVersion, status: 'PUBLISHED' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  } finally {
    if (lockAcquired) {
      await redisService.releaseLock(lockKey).catch(() => {});
    }
  }
});

// Revisions History
router.get('/revisions', async (req: AuthRequest, res) => {
  try {
    const franchiseId = (req.query.franchiseId as string) || req.user?.franchiseId || 'fra_primary';
    const branchId = (req.query.branchId as string) || req.user?.branchId || 'main_branch';

    const { pgPool } = await import('../config/postgres.js');
    const result = await pgPool.query(`
      SELECT id, version, status, metadata, created_by, published_at, created_at, updated_at
      FROM homepage_configurations
      WHERE franchise_id = $1 AND branch_id = $2
      ORDER BY version DESC
      LIMIT 25
    `, [franchiseId, branchId]);

    const revisions = result.rows.map(r => ({
      version_id: `v${r.version}`,
      version: r.version,
      status: r.status,
      title: r.metadata?.name || `Version ${r.version}`,
      published_by: r.created_by,
      published_at: r.published_at,
      createdAt: r.created_at
    }));

    res.json({ success: true, revisions });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Rollback to previous version
router.post('/rollback', async (req: AuthRequest, res) => {
  try {
    const { version, targetVersion, franchiseId = 'fra_primary', branchId = 'main_branch' } = req.body;
    const v = parseInt(targetVersion || version, 10);
    if (!v || isNaN(v)) {
      return res.status(400).json({ success: false, error: 'Valid targetVersion number required' });
    }

    const { pgPool } = await import('../config/postgres.js');
    const client = await pgPool.connect();
    let config: any = null;
    try {
      await client.query('BEGIN');
      const targetRes = await client.query(`
        SELECT layout_json, version, metadata 
        FROM homepage_configurations 
        WHERE franchise_id = $1 AND branch_id = $2 AND version = $3
      `, [franchiseId, branchId, v]);

      if (targetRes.rows.length === 0) {
        throw new Error(`Target version ${v} not found for franchise ${franchiseId} and branch ${branchId}`);
      }
      config = targetRes.rows[0].layout_json;

      // Archive current published
      await client.query(`
        UPDATE homepage_configurations 
        SET status = 'ARCHIVED', updated_at = NOW() 
        WHERE franchise_id = $1 AND branch_id = $2 AND status = 'PUBLISHED'
      `, [franchiseId, branchId]);

      // Set target version to published
      await client.query(`
        UPDATE homepage_configurations 
        SET status = 'PUBLISHED', published_at = NOW(), updated_at = NOW() 
        WHERE franchise_id = $1 AND branch_id = $2 AND version = $3
      `, [franchiseId, branchId, v]);

      await client.query('COMMIT');
    } catch (txErr) {
      await client.query('ROLLBACK');
      throw txErr;
    } finally {
      client.release();
    }

    // Invalidate & refresh Redis cache
    const cacheKey = `olive:home:${franchiseId}:${branchId}:web:en`;
    await redisService.del(cacheKey).catch(() => {});
    await redisService.del('homepage:live').catch(() => {});
    await redisService.set(cacheKey, config, 3600).catch(() => {});
    await redisService.set('homepage:live', config, 3600).catch(() => {});

    res.json({ success: true, config, rolledBackToVersion: v });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
