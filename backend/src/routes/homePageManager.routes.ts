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

// ============================================================================
// PUBLIC ROUTE: Customer Home Page fetches the live pointer configuration here
// ============================================================================
router.get('/live', async (req, res) => {
  try {
    // 1. Try Firestore settings/homepage first for 0-latency cached pointer
    try {
      const snap = await adminDb.collection('settings').doc('homepage').get();
      if (snap.exists && snap.data()?.config) {
        return res.json({ success: true, config: snap.data()!.config, source: 'firestore' });
      }
    } catch (fsErr) {
      console.warn('[HomePageManager] Firestore live read fallback:', fsErr);
    }

    // 2. R2 Fallback
    const config = await PagePackageService.getLiveManifest();
    res.json({ success: true, config, source: 'r2' });
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

// Publish directly from Editor
router.post('/publish', async (req: AuthRequest, res) => {
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

    res.json({ success: true, config: schema });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Rollback to previous version or default
router.post('/rollback', async (req, res) => {
  try {
    const { pageId, versionId } = req.body;
    
    if (!pageId || !versionId) {
      // Restore default fallback
      await PagePackageService.publishLiveManifest(FALLBACK_STANDARD_SCHEMA);
      await adminDb.collection('settings').doc('homepage').set({
        config: FALLBACK_STANDARD_SCHEMA,
        activePageId: 'default',
        activeTemplateName: 'Default Home (Fallback)',
        updatedAt: new Date().toISOString()
      }, { merge: true }).catch(() => {});

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
      res.json({ success: true, config });
    } else {
      throw new Error('Failed to rollback');
    }
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
