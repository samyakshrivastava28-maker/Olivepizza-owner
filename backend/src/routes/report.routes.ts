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

const router = Router();

// Middleware: Require Owner or Admin role
const requireOwnerOrAdmin = (req: AuthRequest, res: Response, next: any) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const role = req.user.role;
  if (role !== 'owner' && role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden. Owner or Admin access required.' });
  }
  next();
};

/**
 * GET /api/reports/pdf/:id
 * Streams the PDF report directly (from Cloudflare R2 or local disk storage).
 * STRICT SECURITY: Requires authentication and scope authorization.
 */
router.get('/pdf/:id', verifyToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized: Authentication required.' });
      return;
    }

    const { id } = req.params;
    const download = req.query.download === 'true';

    // 1. Check Firestore metadata & PostgreSQL canonical snapshots
    const docSnap = await adminDb.collection('monthly_reports').doc(id).get();
    let cloudflarePath = `reports/${id}.pdf`;
    let monthName = 'Executive';
    let yearNum = new Date().getFullYear();
    let franchiseId: string | null = null;
    let branchId: string | null = null;
    let scopeLevel: 'GLOBAL' | 'FRANCHISE' | 'RESTAURANT' = 'GLOBAL';

    if (docSnap.exists) {
      const data = docSnap.data()!;
      cloudflarePath = data.cloudflarePath || cloudflarePath;
      monthName = data.month || monthName;
      yearNum = data.year || yearNum;
      franchiseId = data.franchiseId || null;
      branchId = data.branchId || data.restaurantId || null;
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

    // 2. Authoritative Server-Side Scope Authorization Check
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

    // 3. Fetch Buffer
    let buffer = await CloudflareR2Service.getBuffer(cloudflarePath);

    // 3. If buffer not found, generate on the fly from PostgreSQL
    if (!buffer) {
      buffer = await MonthlyPdfReportService.generateMonthlyReportBuffer({
        monthName,
        year: yearNum,
        branchId: 'main_branch',
        branchName: 'Olive Pizza — Rajnandgaon HQ',
        franchiseId: 'fra_primary',
        franchiseName: 'Olive Pizza'
      });
    }

    const filename = `Olive-Pizza-Report-${monthName}-${yearNum}.pdf`;
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
});

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
 * GET /api/reports/monthly
 * Lists monthly reports stored in Cloudflare R2 and Firestore.
 * Scoped by role:
 *  - Owner/Admin: Overall reports & all franchise reports
 *  - Franchise Manager: Only authorized franchise reports
 *  - Restaurant Manager: Only authorized restaurant branch reports
 *  - Customer/Delivery: 403 Forbidden
 */
router.get('/monthly', verifyToken, async (req: AuthRequest, res: Response) => {
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
    const scopedReports = allReports.filter((r: any) => {
      if (isOwner) return true;
      if (isFranchiseManager) {
        return r.franchiseId === user.franchiseId || !r.franchiseId;
      }
      if (isRestaurantManager) {
        return (r.branchId && r.branchId === user.branchId) || (r.restaurantId && r.restaurantId === user.branchId);
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
});

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
    const branchId = user.branchId || req.body.branchId || 'main_branch';
    const franchiseId = user.franchiseId || req.body.franchiseId || 'fra_primary';

    // 1. Generate Multi-Page Monthly PDF Report (100% real PostgreSQL data)
    const pdfBuffer = await MonthlyPdfReportService.generateMonthlyReportBuffer({
      monthName: month,
      year,
      branchId,
      branchName: 'Olive Pizza — Rajnandgaon HQ',
      franchiseId,
      franchiseName: 'Olive Pizza Franchise'
    });

    const reportKey = `${franchiseId}_${branchId}_${year}_${month.toLowerCase()}`;
    let cloudflarePath = `reports/${year}/${reportKey}.pdf`;
    let pdfUrl = `https://reports.olivepizza.in/monthly/${reportKey}.pdf`;

    try {
      const uploadRes = await CloudflareReportService.uploadPdfReport(year, month, pdfBuffer);
      cloudflarePath = uploadRes.cloudflarePath;
      pdfUrl = uploadRes.publicUrl || pdfUrl;
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
      reportUrl: pdfUrl,
      downloadUrl: pdfUrl,
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
 */
router.get('/looker-studio/feed', async (req: AuthRequest, res: Response) => {
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

export default router;

// Looker Studio Config Aliases
router.get('/looker/config', async (req, res) => {
  try {
    const config = await GoogleSheetsReportService.getLookerStudioConfig();
    res.json({ success: true, ...config });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/config', async (req, res) => {
  try {
    const config = await GoogleSheetsReportService.getLookerStudioConfig();
    res.json({ success: true, ...config });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
