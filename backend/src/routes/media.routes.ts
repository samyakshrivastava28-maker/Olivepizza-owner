import { Router, Request, Response } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import cloudinary from '../config/cloudinary.js';

const router = Router();
const verifyAdminOrOwner = [requireAuth, requireRole(['owner', 'admin', 'developer', 'delivery_partner', 'delivery'])];

const ALLOWED_FOLDERS = [
  'olive-pizza/ads',
  'olive-pizza/menu',
  'olive-pizza/ai-generated',
  'olive-pizza/ai-product-images',
  'olive-pizza/avatars',
  'olive-pizza/promotions',
  'olive-pizza/media',
  'olive-pizza/special-categories',
  'olive-pizza/delivery-proofs',
  'olive-pizza/general'
];

router.get('/test', async (req: Request, res: Response) => {
  try {
    const config = cloudinary.config();
    res.json({
      success: true,
      cloudinaryConnected: !!config.cloud_name && !!config.api_key && !!config.api_secret,
      cloudName: config.cloud_name
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/sign-upload', verifyAdminOrOwner, (req: Request, res: Response) => {
  try {
    const timestamp = Math.round((new Date).getTime() / 1000);
    const requestedFolder = req.query.folder as string | undefined;
    let folder = 'olive-pizza/media';

    if (requestedFolder && typeof requestedFolder === 'string') {
      const sanitized = requestedFolder.replace(/[^a-zA-Z0-9_\-\/]/g, '');
      if (sanitized.startsWith('olive-pizza/') || ALLOWED_FOLDERS.includes(sanitized)) {
        folder = sanitized;
      }
    }
    
    const paramsToSign: any = { timestamp, folder };

    const signature = cloudinary.utils.api_sign_request(
      paramsToSign, 
      cloudinary.config().api_secret as string
    );

    res.json({
      success: true,
      timestamp,
      signature,
      cloudName: cloudinary.config().cloud_name,
      apiKey: cloudinary.config().api_key,
      folder
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/ai-images', verifyAdminOrOwner, async (req: Request, res: Response) => {
  try {
    const imagesMap = new Map<string, any>();

    // 1. Try Cloudinary Search API
    try {
      const searchRes = await cloudinary.search
        .expression('folder:olive-pizza*')
        .sort_by('created_at', 'desc')
        .max_results(500)
        .execute();
      if (searchRes && searchRes.resources) {
        searchRes.resources.forEach((img: any) => {
          if (img.secure_url) {
            imagesMap.set(img.secure_url, {
              public_id: img.public_id,
              secure_url: img.secure_url,
              format: img.format || 'jpg',
              created_at: img.created_at,
            });
          }
        });
      }
    } catch (e: any) {
      console.warn('[MediaRoutes] Cloudinary search failed, trying Admin API fallback:', e.message);
    }

    // 2. Try Cloudinary Admin Resources API fallback
    if (imagesMap.size === 0) {
      try {
        const apiRes = await cloudinary.api.resources({
          type: 'upload',
          prefix: 'olive-pizza',
          max_results: 500,
        });
        if (apiRes && apiRes.resources) {
          apiRes.resources.forEach((img: any) => {
            if (img.secure_url) {
              imagesMap.set(img.secure_url, {
                public_id: img.public_id,
                secure_url: img.secure_url,
                format: img.format || 'jpg',
                created_at: img.created_at,
              });
            }
          });
        }
      } catch (apiErr: any) {
        console.warn('[MediaRoutes] Cloudinary resources API fallback failed:', apiErr.message);
      }
    }

    // 3. Fallback/Supplement from Firestore media_library and products
    try {
      const { adminDb } = await import('../config/firebase.js');
      if (adminDb) {
        const mediaDocs = await adminDb.collection('media_library').get();
        mediaDocs.forEach((doc) => {
          const data = doc.data();
          if (data.mediaUrl && !imagesMap.has(data.mediaUrl)) {
            imagesMap.set(data.mediaUrl, {
              public_id: data.cloudinaryPublicId || doc.id,
              secure_url: data.mediaUrl,
              format: data.format || 'jpg',
              created_at: data.uploadedAt || new Date().toISOString(),
            });
          }
        });

        const prodDocs = await adminDb.collection('products').get();
        prodDocs.forEach((doc) => {
          const data = doc.data();
          const pUrl = data.imageUrl || data.image;
          if (pUrl && typeof pUrl === 'string' && pUrl.startsWith('http') && !imagesMap.has(pUrl)) {
            imagesMap.set(pUrl, {
              public_id: data.cloudinaryPublicId || doc.id,
              secure_url: pUrl,
              format: 'jpg',
              created_at: data.createdAt || new Date().toISOString(),
            });
          }
        });
      }
    } catch (dbErr: any) {
      console.warn('[MediaRoutes] Firestore media query warning:', dbErr.message);
    }

    const imagesList = Array.from(imagesMap.values());
    res.json({ success: true, images: imagesList });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/:publicId(*)', verifyAdminOrOwner, async (req: Request, res: Response) => {
  try {
    const { publicId } = req.params;
    if (!publicId) {
      return res.status(400).json({ error: 'Missing publicId' });
    }

    const result = await cloudinary.uploader.destroy(publicId, { invalidate: true });
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint to fetch Cloudinary usage stats
router.get('/usage', verifyAdminOrOwner, async (req: Request, res: Response) => {
  try {
    // Usage API requires provisioned access, but we can try to fetch it
    const usage = await cloudinary.api.usage();
    res.json(usage);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
