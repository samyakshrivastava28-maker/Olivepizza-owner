import express from 'express';
import multer from 'multer';
import { verifyToken, requireRole } from '../middleware/auth.middleware.js';
import { PagePackageService, FALLBACK_STANDARD_SCHEMA } from '../services/storage/PagePackageService.js';
import { PageSchema, BuiltInPageSchema, CustomStaticPackageSchema } from '../types/PageSchema.js';
import { ActionRegistry } from '../utils/ActionRegistry.js';

import { PREDEFINED_TEMPLATES, getTemplateById } from '../utils/HomePageTemplates.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB limit

// ============================================================================
// PUBLIC ROUTE: Customer Home Page fetches the live pointer configuration here
// ============================================================================
router.get('/live', async (req, res) => {
  try {
    const config = await PagePackageService.getLiveManifest();
    res.json({ success: true, config });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// ADMIN ROUTES: Require owner, admin, or developer role
// ============================================================================
router.use(verifyToken);
router.use(requireRole(['owner', 'admin', 'developer']));

router.get('/collection', async (req, res) => {
  try {
    // Return predefined templates collection
    res.json({ success: true, collection: PREDEFINED_TEMPLATES });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/switch', async (req, res) => {
  try {
    const { pageId, schema } = req.body;
    if (!pageId && !schema) return res.status(400).json({ success: false, error: 'pageId or schema required' });
    
    // If schema is provided directly from the editor, use it. Otherwise lookup template.
    const targetSchema = schema || getTemplateById(pageId);
    if (!targetSchema) return res.status(404).json({ success: false, error: 'Template or schema not found' });
    
    // Create a fresh publish of this schema, making it live immediately
    const schemaToPublish: PageSchema = {
      ...targetSchema,
      pageId: pageId || targetSchema.pageId,
      versionId: `v${Date.now()}`,
      metadata: {
        ...targetSchema.metadata,
        publishedBy: (req as any).user?.uid || 'owner',
        publishedAt: new Date().toISOString()
      }
    };
    
    const success = await PagePackageService.publishLiveManifest(schemaToPublish);
    if (success) {
      res.json({ success: true, config: schemaToPublish });
    } else {
      res.status(500).json({ success: false, error: 'Failed to switch live pointer' });
    }
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
router.post('/save', async (req, res) => {
  try {
    const schema: PageSchema = req.body.schema;
    if (!schema) {
      return res.status(400).json({ success: false, error: 'Schema is required' });
    }

    schema.metadata = {
      ...schema.metadata,
      publishedBy: (req as any).user.uid,
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

router.post('/publish', async (req, res) => {
  try {
    const schema: PageSchema = req.body.schema;
    
    if (!schema) {
      return res.status(400).json({ success: false, error: 'Schema is required' });
    }

    // Backend Validation of Schema Actions
    if (schema.type === 'BUILT_IN' || schema.type === 'CUSTOM_SCHEMA') {
      for (const section of schema.sections) {
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
      publishedBy: (req as any).user.uid,
      publishedAt: new Date().toISOString()
    };
    
    schema.versionId = `v${Date.now()}`;

    const success = await PagePackageService.publishLiveManifest(schema);
    
    if (success) {
      res.json({ success: true, config: schema });
    } else {
      throw new Error('Failed to publish to R2');
    }
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/rollback', async (req, res) => {
  try {
    const { pageId, versionId } = req.body;
    
    if (!pageId || !versionId) {
      // Restore default fallback
      const success = await PagePackageService.publishLiveManifest(FALLBACK_STANDARD_SCHEMA);
      if (success) {
        return res.json({ success: true, config: FALLBACK_STANDARD_SCHEMA });
      } else {
        throw new Error('Failed to restore default');
      }
    }
    
    const success = await PagePackageService.rollbackManifest(pageId, versionId);
    if (success) {
      const config = await PagePackageService.getLiveManifest();
      res.json({ success: true, config });
    } else {
      throw new Error('Failed to rollback');
    }
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/upload-custom', upload.single('package'), async (req, res) => {
  try {
    const file = req.file;
    const { pageId } = req.body;
    
    if (!file) return res.status(400).json({ success: false, error: 'No package zip provided' });
    if (!pageId) return res.status(400).json({ success: false, error: 'pageId is required' });
    
    const versionId = `v${Date.now()}`;
    
    const r2Url = await PagePackageService.uploadCustomPackage(file.buffer, pageId, versionId);
    
    const schema: CustomStaticPackageSchema = {
      type: 'CUSTOM_STATIC_PACKAGE',
      pageId,
      versionId,
      r2Url,
      entryFile: 'index.html',
      metadata: {
        name: `Custom Package ${pageId}`,
        description: 'Uploaded static custom page',
        publishedBy: (req as any).user.uid,
        publishedAt: new Date().toISOString()
      }
    };
    
    res.json({ success: true, schema });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
