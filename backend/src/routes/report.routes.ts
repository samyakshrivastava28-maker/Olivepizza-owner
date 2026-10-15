import { Router, Response } from 'express';
import { adminDb } from '../config/firebase.js';
import { verifyToken, AuthRequest } from '../middleware/auth.middleware.js';
import { MonthlyReportNotificationService, ReportScope } from '../services/reports/MonthlyReportNotificationService.js';
import { CloudflareReportService } from '../services/reports/CloudflareReportService.js';
import { MonthlyReportGenerator } from '../services/reports/MonthlyReportGenerator.js';
import { CloudflareR2Service } from '../services/storage/CloudflareR2Service.js';
import { GoogleSheetsReportService } from '../services/reports/GoogleSheetsReportService.js';
import { MonthlyPdfReportService } from '../services/reports/MonthlyPdfReportService.js';
import { GoogleSheetsMonthlyReportService } from '../services/reports/GoogleSheetsMonthlyReportService.js';
import { SalesCalculationEngine } from '../services/reports/SalesCalculationEngine.js';
import { pgPool, query } from '../config/postgres.js';
import crypto from 'crypto';
import { redisService, getRedisClient } from '../config/redis.js';

const router = Router();

export const isAuthorizedOwner = (user?: any): boolean => {
  if (!user) return false;
  const role = (user.role || '').toUpperCase();
  const email = (user.email || '').toLowerCase();
  return (
    role === 'OWNER' ||
    role === 'ADMIN' ||
    role === 'PLATFORM_OWNER' ||
    role === 'DEVELOPER' ||
    email === 'olivepizzarjn@gmail.com' ||
    email === 'webhub2811@gmail.com' ||
    email === 'olivepizzamaker@gmail.com'
  );
};

// Middleware: Require Owner or Admin role (supporting canonical roles and authorized master accounts)
const requireOwnerOrAdmin = (req: AuthRequest, res: Response, next: any) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  if (!isAuthorizedOwner(req.user)) {
    return res.status(403).json({ error: 'Forbidden. Owner or Admin access required.' });
  }
  next();
};

function getReportCapabilitySecret(): string {
  const secret = process.env.TRACKING_TOKEN_SECRET || process.env.INTERNAL_RPC_SECRET || process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('CRITICAL SECURITY ERROR: TRACKING_TOKEN_SECRET or INTERNAL_RPC_SECRET must be configured in production.');
    }
    return 'olive-capability-dev-secret-32-chars';
  }
  return secret;
}

export function verifyReportCapabilityToken(token: string): boolean {
  try {
    const raw = Buffer.from(token, 'base64url').toString('utf8');
    const parts = raw.split(':');
    if (parts.length !== 5) return false;
    const [reportId, scope, purpose, expStr, sig] = parts;
    const exp = parseInt(expStr, 10);
    if (isNaN(exp) || Math.floor(Date.now() / 1000) > exp) return false;
    if (scope !== 'reporting' && scope !== 'looker') return false;

    const secret = getReportCapabilitySecret();
    const expectedSig = crypto.createHmac('sha256', secret).update(`${reportId}:${scope}:${purpose}:${expStr}`).digest('hex');
    const sigBuf = Buffer.from(sig, 'utf8');
    const expBuf = Buffer.from(expectedSig, 'utf8');
    if (sigBuf.length !== expBuf.length) return false;
    return crypto.timingSafeEqual(sigBuf, expBuf);
  } catch {
    return false;
  }
}

const requireReportCapabilityOrAdmin = (req: AuthRequest, res: Response, next: any) => {
  const capHeader = (req.headers['x-capability-token'] || req.headers['x-report-token']) as string;
  if (capHeader && typeof capHeader === 'string' && verifyReportCapabilityToken(capHeader.trim())) {
    return next();
  }

  verifyToken(req, res, () => {
    requireOwnerOrAdmin(req, res, next);
  });
};

/**
 * Handles PDF streaming (View inline or Download attachment).
 * STRICT SECURITY: Validates HMAC signed link OR user scope authorization.
 */
async function handleStreamPdf(req: AuthRequest, res: Response, forceDownload?: boolean): Promise<void> {
  try {
    const { id } = req.params;
    const download = forceDownload ?? (req.query.download === 'true');

    // 1. Signature Check (HMAC deep links from owner emails)
    const sig = req.query.sig as string;
    let isSignedLink = false;
    if (sig) {
      try {
        const trackingSecret = getReportCapabilitySecret();
        const expectedSig = crypto.createHmac('sha256', trackingSecret).update(id).digest('hex');
        const sigBuf = Buffer.from(sig, 'utf8');
        const expBuf = Buffer.from(expectedSig, 'utf8');
        if (sigBuf.length === expBuf.length && crypto.timingSafeEqual(sigBuf, expBuf)) {
          isSignedLink = true;
        }
      } catch {}
    }

    if (!isSignedLink) {
      // Must authenticate via token
      let user = req.user;
      if (!user) {
        const authHeader = req.headers.authorization;
        const token = authHeader?.startsWith('Bearer ') ? authHeader.split('Bearer ')[1].trim() : undefined;
        if (token) {
          try {
            const { adminAuth } = await import('../config/firebase.js');
            const decoded: any = await adminAuth.verifyIdToken(token);
            user = {
              uid: decoded.uid,
              email: decoded.email,
              role: decoded.role || 'customer'
            };
          } catch (_) {}
        }
      }

      if (!user) {
        res.status(401).json({ error: 'Unauthorized: Authentication required.' });
        return;
      }
      req.user = user;
    }

    // 2. Check Firestore metadata & PostgreSQL canonical snapshots
    const docSnap = await adminDb.collection('monthly_reports').doc(id).get();
    let cloudflarePath = `reports/${id}.pdf`;
    let monthName = 'September';
    let yearNum = new Date().getFullYear();
    let franchiseId: string | null = null;
    let branchId: string | null = null;
    let branchName = 'Olive Pizza';
    let franchiseName = 'Olive Pizza';
    let scopeLevel: 'GLOBAL' | 'FRANCHISE' | 'RESTAURANT' = 'GLOBAL';

    if (docSnap.exists) {
      const data = docSnap.data()!;
      cloudflarePath = data.cloudflarePath || cloudflarePath;
      monthName = data.month || monthName;
      yearNum = data.year || yearNum;
      franchiseId = data.franchiseId || null;
      branchId = data.branchId || data.restaurantId || null;
      branchName = data.branchName || branchName;
      franchiseName = data.franchiseName || franchiseName;
      scopeLevel = data.accessScope || (branchId ? 'RESTAURANT' : franchiseId ? 'FRANCHISE' : 'GLOBAL');
    } else {
      const pgSnap = await query(
        `SELECT franchise_id, branch_id, report_month, report_year, pdf_cloudflare_path
         FROM canonical_report_snapshots
         WHERE id::text = $1 OR pdf_cloudflare_path LIKE $2 LIMIT 1`,
        [id, `%${id}%`]
      ).catch(() => ({ rows: [] }));

      if (pgSnap.rows.length > 0) {
        const row = pgSnap.rows[0];
        franchiseId = row.franchise_id;
        branchId = row.branch_id;
        monthName = row.report_month;
        yearNum = row.report_year;
        cloudflarePath = row.pdf_cloudflare_path || cloudflarePath;
        scopeLevel = branchId ? 'RESTAURANT' : franchiseId ? 'FRANCHISE' : 'GLOBAL';
      }
    }

    // 3. Authoritative Scope Authorization Check (if not signed link)
    if (!isSignedLink && req.user) {
      const scope: ReportScope = {
        level: scopeLevel,
        franchiseId,
        restaurantId: branchId,
        periodMonth: monthName,
        periodYear: yearNum
      };

      const authResult = MonthlyReportNotificationService.isUserAuthorizedForReport(req.user, scope);
      if (!authResult.authorized) {
        res.status(403).json({ error: authResult.reason || 'Forbidden: Access to this internal report is restricted.' });
        return;
      }
    }

    // 4. Fetch Buffer from Cloudflare R2 / local mock
    let buffer = await CloudflareR2Service.getBuffer(cloudflarePath);

    // 5. If buffer not found, generate on the fly from PostgreSQL
    if (!buffer) {
      buffer = await MonthlyPdfReportService.generateMonthlyReportBuffer({
        monthName,
        year: yearNum,
        branchId: branchId || 'main_branch',
        branchName: branchName || 'Olive Pizza — Rajnandgaon HQ',
        franchiseId: franchiseId || 'fra_rajnandgaon',
        franchiseName: franchiseName || 'Olive Pizza Rajnandgaon'
      });
    }

    const filename = `Olive-Pizza-Report-${branchId || 'HQ'}-${monthName}-${yearNum}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    if (download) {
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    } else {
      res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    }

    res.send(buffer);
  } catch (err: any) {
    console.error(`[Report PDF Route Error]:`, err.message);
    res.status(500).json({ error: 'Failed to retrieve report PDF' });
  }
}

// PDF Streaming Endpoints
router.get('/pdf/:id', (req: AuthRequest, res: Response) => handleStreamPdf(req, res));
router.get('/monthly/:id/view', (req: AuthRequest, res: Response) => handleStreamPdf(req, res, false));
router.get('/monthly/:id/download', (req: AuthRequest, res: Response) => handleStreamPdf(req, res, true));

/**
 * POST /api/reports/google-sheet/set-id
 * Sets or updates the Google Spreadsheet ID in Firestore settings.
 */
router.post('/google-sheet/set-id', verifyToken, requireOwnerOrAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { spreadsheetId } = req.body;
    if (!spreadsheetId) return res.status(400).json({ error: 'spreadsheetId is required' });

    await adminDb.collection('settings').doc('google_sheets').set({
      spreadsheetId: spreadsheetId.trim(),
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    res.json({ success: true, spreadsheetId: spreadsheetId.trim() });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/reports/google-sheet/sync
 * Syncs recent orders into Google Sheets.
 */
router.post('/google-sheet/sync', verifyToken, requireOwnerOrAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    const spreadsheetId = await GoogleSheetsReportService.getSpreadsheetId();
    if (!spreadsheetId) {
      return res.status(400).json({ error: 'Google Sheet ID not configured. Please set Spreadsheet ID first.' });
    }

    const ordersSnap = await adminDb.collection('orders').orderBy('createdAt', 'desc').limit(100).get();
    let syncedCount = 0;

    for (const doc of ordersSnap.docs) {
      const o = doc.data();
      await GoogleSheetsReportService.syncOrderToMonthlySheet({
        id: doc.id,
        ...o
      });
      syncedCount++;
    }

    res.json({ success: true, syncedCount, spreadsheetId });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/reports/monthly & GET /api/reports/list
 * Lists monthly reports stored in Cloudflare R2 and Firestore.
 * Scoped by role:
 *  - Owner/Admin: Overall reports & all franchise reports
 *  - Franchise Manager: Only authorized franchise reports
 *  - Restaurant Manager: Only authorized restaurant branch reports
 *  - Customer/Delivery: 403 Forbidden
 */
async function handleListMonthlyReports(req: AuthRequest, res: Response): Promise<void> {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Unauthorized: Authentication required.' });
      return;
    }

    const callerRole = (user.role || 'customer').toLowerCase();
    const isOwner = [
      'owner', 'admin', 'developer', 'platform_owner'
    ].includes(callerRole) ||
      user.email === 'olivepizzarjn@gmail.com' ||
      user.email === 'webhub2811@gmail.com' ||
      user.email === 'olivepizzamaker@gmail.com';

    const isFranchiseManager = ['franchise_owner', 'franchise_manager'].includes(callerRole);
    const isRestaurantManager = ['restaurant_manager', 'manager', 'kitchen_manager'].includes(callerRole);

    if (!isOwner && !isFranchiseManager && !isRestaurantManager) {
      res.status(403).json({ error: 'Forbidden: Access to internal business reports is restricted.' });
      return;
    }

    const allReports = await CloudflareReportService.listMonthlyReports();
    
    // Filter reports according to authoritative caller scope
    const filterBranchId = (req.query.branchId as string) || (req.query.restaurantId as string);
    const scopedReports = allReports.filter((r: any) => {
      if (isOwner) {
        if (filterBranchId && filterBranchId !== 'all') {
          return r.branchId === filterBranchId || r.restaurantId === filterBranchId;
        }
        return true;
      }
      if (isFranchiseManager) {
        const matchesFranchise = r.franchiseId === user.franchiseId || !r.franchiseId;
        if (filterBranchId && filterBranchId !== 'all') {
          return matchesFranchise && (r.branchId === filterBranchId || r.restaurantId === filterBranchId);
        }
        return matchesFranchise;
      }
      if (isRestaurantManager) {
        const effectiveBranchId = user.branchId || filterBranchId;
        return (r.branchId && r.branchId === effectiveBranchId) || (r.restaurantId && r.restaurantId === effectiveBranchId);
      }
      return false;
    });

    const spreadsheetId = await GoogleSheetsReportService.getSpreadsheetId();
    const currentSheetTitle = GoogleSheetsReportService.getMonthSheetTitle();

    res.json({
      success: true,
      reports: scopedReports,
      liveSheet: isOwner ? {
        spreadsheetId,
        currentSheetTitle,
        url: spreadsheetId ? `https://docs.google.com/spreadsheets/d/${spreadsheetId}` : null,
      } : null,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

router.get('/monthly', verifyToken, handleListMonthlyReports);
router.get('/list', verifyToken, handleListMonthlyReports);

/**
 * Redis Rate-Limiter for Custom PDF Reports
 * Key: ratelimit:pdf:custom:branch:{branchId}
 * TTL: 3600s (1 hour)
 * Owner: Unlimited access (bypasses check)
 * Restaurant Manager: Max 2 custom PDFs per hour.
 */
async function getBranchCustomReportQuota(branchId: string, isOwner: boolean): Promise<{
  remaining: number;
  limit: number;
  resetInSeconds: number;
  minutesLeft: number;
  allowed: boolean;
}> {
  if (isOwner) {
    return {
      remaining: 999,
      limit: 2,
      resetInSeconds: 0,
      minutesLeft: 0,
      allowed: true
    };
  }

  const client = getRedisClient();
  const redisKey = `ratelimit:pdf:custom:branch:${branchId}`;

  if (!client || !redisService.isAvailable()) {
    return {
      remaining: 2,
      limit: 2,
      resetInSeconds: 3600,
      minutesLeft: 60,
      allowed: true
    };
  }

  try {
    const rawVal = await client.get(redisKey);
    const count = rawVal ? parseInt(rawVal, 10) : 0;
    const ttl = await client.ttl(redisKey);
    const resetInSeconds = ttl > 0 ? ttl : 0;
    const minutesLeft = Math.max(1, Math.ceil(resetInSeconds / 60));
    const remaining = Math.max(0, 2 - count);

    return {
      remaining,
      limit: 2,
      resetInSeconds,
      minutesLeft,
      allowed: count < 2
    };
  } catch (err) {
    console.warn('[ReportRoutes] Redis quota check error:', err);
    return {
      remaining: 2,
      limit: 2,
      resetInSeconds: 0,
      minutesLeft: 0,
      allowed: true
    };
  }
}

async function consumeBranchCustomReportQuota(branchId: string, isOwner: boolean): Promise<void> {
  if (isOwner) return;

  const client = getRedisClient();
  if (!client || !redisService.isAvailable()) return;

  const redisKey = `ratelimit:pdf:custom:branch:${branchId}`;
  try {
    const current = await client.incr(redisKey);
    if (current === 1) {
      await client.expire(redisKey, 3600);
    }
  } catch (err) {
    console.warn('[ReportRoutes] Redis quota increment error:', err);
  }
}

/**
 * GET /api/reports/quota?branchId=...
 * Returns remaining custom report quota for the restaurant branch.
 * Owner accounts have unlimited access.
 * Restaurant Managers have max 2 custom reports per 1 hour window.
 */
router.get('/quota', verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const isOwner = isAuthorizedOwner(user);
    const branchId = (req.query.branchId as string) || user.branchId || (user as any).restaurantId || 'main_branch';

    const quota = await getBranchCustomReportQuota(branchId, isOwner);

    res.json({
      remaining: quota.remaining,
      limit: 2,
      resetInSeconds: quota.resetInSeconds
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

function normalizePeriod(raw?: string): 'today' | 'yesterday' | 'last_day' | 'last_2_days' | 'this_week' | 'last_week' | 'this_month' | 'ongoing_month' | 'ongoing_month_live' | 'last_month' | 'this_year' | 'last_year' | 'all_time' | 'custom' {
  if (!raw) return 'ongoing_month_live';
  const clean = raw.toLowerCase().trim().replace(/[\s-]+/g, '_');
  if (clean.includes('ongoing') || clean.includes('live')) return 'ongoing_month_live';
  if (clean.includes('last_2') || clean.includes('2_day')) return 'last_2_days';
  if (clean.includes('this_week')) return 'this_week';
  if (clean.includes('last_week')) return 'last_week';
  if (clean.includes('yesterday') || clean.includes('last_day')) return 'last_day';
  if (clean.includes('today')) return 'today';
  if (clean.includes('this_month')) return 'this_month';
  if (clean.includes('last_month')) return 'last_month';
  if (clean.includes('this_year')) return 'this_year';
  if (clean.includes('last_year')) return 'last_year';
  if (clean.includes('all_time')) return 'all_time';
  if (clean.includes('custom')) return 'custom';
  return 'ongoing_month_live';
}

/**
 * Handler for Custom PDF Reports:
 * - CUSTOM REPORTS RULE: Custom reports (Ongoing month live, last 2 days, this week, last day, all time, custom date ranges)
 *   must NEVER be saved in Cloudflare R2!
 * - Compiled directly in memory (Buffer) and streamed over HTTP.
 * - RATE LIMITER: Uses Redis key `ratelimit:pdf:custom:branch:{branchId}` with 3600s TTL.
 *   Restaurant managers max 2 custom PDFs/hr (429 if exceeded). Owners have unlimited access.
 */
async function handleCustomReportPdf(req: AuthRequest, res: Response): Promise<void> {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Unauthorized: Authentication required.' });
      return;
    }

    const callerRole = (user.role || '').toLowerCase();
    const isOwner = isAuthorizedOwner(user);
    const isFranchiseManager = ['franchise_owner', 'franchise_manager'].includes(callerRole);
    const isRestaurantManager = ['restaurant_manager', 'manager', 'kitchen_manager'].includes(callerRole);

    if (!isOwner && !isFranchiseManager && !isRestaurantManager) {
      res.status(403).json({ error: 'Forbidden: Access to custom business reports is restricted.' });
      return;
    }

    // Resolve branch and franchise
    const branchId = (req.query.branchId as string) || req.body?.branchId || user.branchId || (user as any).restaurantId || 'main_branch';
    const franchiseId = (req.query.franchiseId as string) || req.body?.franchiseId || user.franchiseId || 'fra_primary';
    const channel = ((req.query.channel as string) || req.body?.channel || 'ALL') as 'ALL' | 'ONLINE' | 'POS';
    const download = (req.query.download === 'true') || req.body?.download === true;

    // Rate Limiter check for Restaurant Managers
    const quota = await getBranchCustomReportQuota(branchId, isOwner);
    if (!quota.allowed) {
      res.status(429).json({
        error: `Hourly custom PDF limit reached (2 PDFs/hr). Next PDF download available in ${quota.minutesLeft} minutes.`
      });
      return;
    }

    // Resolve date range & period
    const rawPeriod = (req.query.period as string) || req.body?.period || (req.query.timeRange as string) || req.body?.timeRange || 'ongoing_month_live';
    const normalizedPeriod = normalizePeriod(rawPeriod);
    const customStart = (req.query.startDate as string) || req.body?.startDate;
    const customEnd = (req.query.endDate as string) || req.body?.endDate;

    const { dateRange, periodLabel } = SalesCalculationEngine.resolveDateRange(normalizedPeriod, customStart, customEnd);

    // Fetch branch & franchise metadata
    let branchName = 'Olive Pizza Branch';
    let franchiseName = 'Olive Pizza Franchise';
    let gstin = '22AAAAO1234A1Z5';
    let fssai = '10522016000123';

    try {
      const bDoc = await adminDb.collection('franchises').doc(branchId).get();
      if (bDoc.exists) {
        const data = bDoc.data()!;
        branchName = data.name || data.branchName || branchName;
        franchiseName = data.franchiseName || franchiseName;
        gstin = data.gstin || gstin;
        fssai = data.fssai || fssai;
      }
    } catch (_) {}

    // In-memory compilation only — NEVER SAVE IN CLOUDFLARE R2!
    const pdfBuffer = await MonthlyPdfReportService.generateMonthlyReportBuffer({
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
      periodLabel,
      branchId,
      branchName,
      franchiseId,
      franchiseName,
      gstin,
      fssai,
      channel,
      isCustomReport: true
    });

    // Increment branch usage count in Redis (if non-owner)
    await consumeBranchCustomReportQuota(branchId, isOwner);

    // Stream directly over HTTP
    const filename = `Olive-Pizza-Report-${branchId}-${dateRange.startDate}-to-${dateRange.endDate}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdfBuffer);
  } catch (err: any) {
    console.error('[Custom Report Generation Error]:', err);
    res.status(500).json({ error: err.message || 'Failed to generate custom report PDF' });
  }
}

// Custom Report Streaming Endpoints (Never stored in Cloudflare R2)
router.get('/custom/pdf', verifyToken, handleCustomReportPdf);
router.post('/custom/pdf', verifyToken, handleCustomReportPdf);
router.get('/custom-pdf', verifyToken, handleCustomReportPdf);
router.post('/custom-pdf', verifyToken, handleCustomReportPdf);
router.get('/custom', verifyToken, handleCustomReportPdf);
router.post('/custom', verifyToken, handleCustomReportPdf);
router.post('/generate-custom', verifyToken, handleCustomReportPdf);
router.get('/generate-custom', verifyToken, handleCustomReportPdf);

/**
 * POST /api/reports/generate-monthly
 * Triggers monthly PDF generation, Cloudflare R2 upload, and owner email notification.
 */
router.post('/generate-monthly', verifyToken, requireOwnerOrAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const now = new Date();
    const month = req.body.month || now.toLocaleString('default', { month: 'long' });
    const year = Number(req.body.year) || now.getFullYear();
    let branchId = user.branchId || req.body.branchId;
    let franchiseId = user.franchiseId || req.body.franchiseId;
    let branchName = 'Olive Pizza Branch';
    let franchiseName = 'Olive Pizza Franchise';

    if (!branchId || !franchiseId) {
      const bSnap = await adminDb.collection('franchises').limit(1).get().catch(() => ({ empty: true, docs: [] } as any));
      if (!bSnap.empty) {
        const firstBranch = bSnap.docs[0];
        branchId = branchId || firstBranch.id;
        franchiseId = franchiseId || firstBranch.data().franchiseId || firstBranch.id;
      }
    }

    if (!branchId || !franchiseId) {
      res.status(400).json({ error: 'Valid branchId and franchiseId are required to generate monthly report' });
      return;
    }

    try {
      const bDoc = await adminDb.collection('franchises').doc(branchId).get();
      if (bDoc.exists) {
        const data = bDoc.data()!;
        branchName = data.name || branchName;
        franchiseName = data.franchiseName || franchiseName;
      }
    } catch (_) {}

    // 1. Generate Multi-Page Monthly PDF Report (100% real PostgreSQL data)
    const pdfBuffer = await MonthlyPdfReportService.generateMonthlyReportBuffer({
      monthName: month,
      year,
      branchId,
      branchName,
      franchiseId,
      franchiseName
    });

    const monthNum = String(new Date(`${month} 1, ${year}`).getMonth() + 1).padStart(2, '0');
    const reportKey = `${franchiseId}_${branchId}_${year}_${monthNum}`;
    let cloudflarePath = `reports/${year}/olive-pizza/${franchiseId}/${branchId}/monthly/${year}-${monthNum}.pdf`;
    let pdfUrl = `/api/reports/monthly/${reportKey}/download`;
    let viewUrl = `/api/reports/monthly/${reportKey}/view`;
    let downloadUrl = `/api/reports/monthly/${reportKey}/download`;

    try {
      const uploadRes = await CloudflareReportService.uploadPdfReport(year, month, pdfBuffer, franchiseId, branchId);
      cloudflarePath = uploadRes.cloudflarePath;
      const urls = await CloudflareReportService.getReportUrls(cloudflarePath, reportKey);
      pdfUrl = uploadRes.publicUrl || urls.downloadUrl;
      viewUrl = urls.viewUrl;
      downloadUrl = urls.downloadUrl;
    } catch (err: any) {
      console.warn('[MonthlyReport] Cloudflare upload notice:', err.message);
    }

    // 2. Synchronize Rebuilt Enterprise Google Sheets (6 tabs, Olive Pizza brand theme)
    let sheetsUrl = '';
    try {
      const sheetRes = await GoogleSheetsMonthlyReportService.syncMonthlyReport({
        monthName: month,
        year,
        branchId,
        franchiseId,
        branchName: 'Olive Pizza — Rajnandgaon HQ',
        franchiseName: 'Olive Pizza Franchise'
      });
      sheetsUrl = sheetRes.url;
    } catch (sheetErr: any) {
      console.warn('[MonthlyReport] Google Sheets sync notice:', sheetErr.message);
    }

    // 3. Compute summary snapshot for persistent history
    const monthIndex = new Date(`${month} 1, ${year}`).getMonth();
    const startDate = `${year}-${String(monthIndex + 1).padStart(2, '0')}-01`;
    const lastDayNum = new Date(year, monthIndex + 1, 0).getDate();
    const endDate = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(lastDayNum).padStart(2, '0')}`;

    const summary = await SalesCalculationEngine.getSalesSummary({
      branchId,
      franchiseId,
      startDate,
      endDate,
      periodLabel: `${month.toUpperCase()} ${year}`
    });

    // 4. Save canonical report snapshot in PostgreSQL
    const snapshotId = crypto.randomUUID();
    await query(`
      INSERT INTO canonical_report_snapshots (
        id, franchise_id, branch_id, report_month, report_year,
        summary_json, pdf_cloudflare_path, pdf_url, sheets_url, status
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6::jsonb, $7, $8, $9, 'COMPLETED'
      )
      ON CONFLICT (franchise_id, branch_id, report_month, report_year)
      DO UPDATE SET
        summary_json = EXCLUDED.summary_json,
        pdf_cloudflare_path = EXCLUDED.pdf_cloudflare_path,
        pdf_url = EXCLUDED.pdf_url,
        sheets_url = EXCLUDED.sheets_url,
        status = 'COMPLETED',
        created_at = CURRENT_TIMESTAMP;
    `, [
      snapshotId, franchiseId, branchId, month, year,
      JSON.stringify(summary), cloudflarePath, pdfUrl, sheetsUrl
    ]);

    // 5. Update Firestore metadata for backward compatibility
    await adminDb.collection('monthly_reports').doc(reportKey).set({
      id: reportKey,
      month,
      year,
      revenue: summary.grossSales,
      orders: summary.totalBills,
      cloudflarePath,
      reportUrl: viewUrl,
      viewUrl,
      downloadUrl,
      period: `${month} ${year}`,
      branchName,
      franchiseName,
      averageOrderValue: summary.averageOrderValue,
      sheetsUrl,
      status: 'COMPLETED',
      createdTime: new Date().toISOString()
    }, { merge: true });

    const reportScopeLevel: 'GLOBAL' | 'FRANCHISE' | 'RESTAURANT' = (!franchiseId || franchiseId === 'global') ? 'GLOBAL' : (branchId ? 'RESTAURANT' : 'FRANCHISE');
    const reportScope: ReportScope = {
      level: reportScopeLevel,
      franchiseId: reportScopeLevel === 'GLOBAL' ? null : franchiseId,
      restaurantId: reportScopeLevel === 'RESTAURANT' ? branchId : null,
      periodMonth: month,
      periodYear: year,
    };

    // Save scope in Firestore metadata
    await adminDb.collection('monthly_reports').doc(reportKey).set({
      accessScope: reportScope.level,
      franchiseId: reportScope.franchiseId,
      branchId: reportScope.restaurantId,
      restaurantId: reportScope.restaurantId,
      createdBy: user.uid
    }, { merge: true });

    // 6. Dispatch Authoritative Scoped Monthly Report Notification
    await MonthlyReportNotificationService.dispatchMonthlyReportNotification(reportScope, {
      reportKey,
      pdfUrl,
      grossSales: summary.grossSales,
      totalOrders: summary.totalBills
    }).catch(err => console.error('[MonthlyReport] Notification dispatch notice:', err));

    res.json({
      success: true,
      report: {
        id: reportKey,
        month,
        year,
        grossSales: summary.grossSales,
        netSales: summary.netSales,
        totalBills: summary.totalBills,
        pdfUrl,
        sheetsUrl,
        summary
      }
    });
  } catch (err: any) {
    console.error('[Monthly Report Generation Error]:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/reports/monthly/:id
 * Deletes a monthly report from Cloudflare R2 and Firestore.
 */
router.delete('/monthly/:id', verifyToken, requireOwnerOrAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { cloudflarePath } = req.body;
    const success = await CloudflareReportService.deleteReport(id, cloudflarePath);
    res.json({ success });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/reports/diagnostics
 * Provides production diagnostics for PDF Generation, Cloudflare R2, Google Sheets, and Email.
 */
router.get('/diagnostics', verifyToken, requireOwnerOrAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    const isR2Configured = CloudflareR2Service.isConfigured();
    const spreadsheetId = await GoogleSheetsReportService.getSpreadsheetId();

    const emailQueueStats = await pgPool.query(`
      SELECT status, COUNT(*) as count
      FROM email_queue
      GROUP BY status
    `).catch(() => ({ rows: [] }));

    const reportsSnap = await adminDb.collection('monthly_reports').get().catch(() => ({ size: 0 }));

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      pdfGenerator: { status: 'healthy', format: 'jsPDF + Cloudflare R2 PDF Engine' },
      cloudflareR2: {
        status: isR2Configured ? 'healthy' : 'unconfigured',
        bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME || 'olive-pizza-r2',
      },
      googleSheets: {
        status: spreadsheetId ? 'active' : 'unconfigured',
        spreadsheetId,
      },
      emailQueue: {
        statusBreakdown: emailQueueStats.rows,
        smtpHost: process.env.SMTP_HOST || 'smtp.gmail.com',
        recipient: process.env.OWNER_EMAIL || 'olivepizzarjn@gmail.com',
      },
      reportsSummary: {
        totalGenerated: reportsSnap.size,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});


/**
 * GET /api/reports/looker-studio/config
 * Returns Looker Studio embed URL, spreadsheet metadata, and live sync state.
 */
router.get('/looker-studio/config', verifyToken, requireOwnerOrAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    const config = await GoogleSheetsReportService.getLookerStudioConfig();
    res.json({ success: true, ...config });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/reports/looker-studio/set-embed-url
 * Updates Looker Studio embed URL in Firestore settings.
 */
router.post('/looker-studio/set-embed-url', verifyToken, requireOwnerOrAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { embedUrl } = req.body;
    if (!embedUrl) return res.status(400).json({ error: 'embedUrl is required' });

    await GoogleSheetsReportService.setLookerStudioEmbedUrl(embedUrl);
    res.json({ success: true, embedUrl });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/reports/looker-studio/feed
 * Provides continuous standardized time-series reporting feed for Looker Studio / BI ingestion.
 * Protected by capability token or Owner/Admin authorization.
 */
router.get('/looker-studio/feed', requireReportCapabilityOrAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { franchiseId, limit } = req.query;
    const feed = await GoogleSheetsReportService.getLookerStudioFeed({
      franchiseId: franchiseId as string,
      limit: limit ? Number(limit) : 500,
    });
    res.json({
      success: true,
      count: feed.length,
      timestamp: new Date().toISOString(),
      data: feed,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Looker Studio Config Aliases - Protected by capability token or Owner/Admin
router.get('/looker/config', requireReportCapabilityOrAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    const config = await GoogleSheetsReportService.getLookerStudioConfig();
    res.json({ success: true, ...config });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/config', requireReportCapabilityOrAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    const config = await GoogleSheetsReportService.getLookerStudioConfig();
    res.json({ success: true, ...config });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

