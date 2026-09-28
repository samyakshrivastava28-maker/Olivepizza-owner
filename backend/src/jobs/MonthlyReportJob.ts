/**
 * MonthlyReportJob.ts
 *
 * Automated Month-End Scheduled Worker for Olive Pizza.
 * Runs on the 1st of every month at 00:05 AM IST.
 *
 * Workflow:
 * 1. PostgreSQL -> calculate monthly report from immutable financial records.
 * 2. Finalize report & generate authoritative PDF buffer.
 * 3. Store PDF securely in Cloudflare R2.
 * 4. Sync enterprise Google Sheets workbook.
 * 5. Determine report scope (Global, Franchise, Restaurant).
 * 6. Resolve authorized recipients using MonthlyReportNotificationService.
 * 7. Send tailored, leak-proof notifications strictly to authorized users.
 * 8. Queue email to verified owner recipient.
 *
 * ZERO BROADCAST: Never broadcasts to customer or delivery users.
 */

import cron from 'node-cron';
import { MonthlyPdfReportService } from '../services/reports/MonthlyPdfReportService.js';
import { CloudflareReportService } from '../services/reports/CloudflareReportService.js';
import { GoogleSheetsMonthlyReportService } from '../services/reports/GoogleSheetsMonthlyReportService.js';
import { SalesCalculationEngine } from '../services/reports/SalesCalculationEngine.js';
import { MonthlyReportNotificationService, ReportScope } from '../services/reports/MonthlyReportNotificationService.js';
import { query } from '../config/postgres.js';
import { adminDb } from '../config/firebase.js';
import { sendEmailDirect } from '../services/email.service.js';
import crypto from 'crypto';

export class MonthlyReportJob {
  public static init() {
    // Schedule: 1st of every month at 00:05 AM (Asia/Kolkata)
    cron.schedule('5 0 1 * *', async () => {
      console.log('⏰ [MonthlyReportJob] Automated 1st-of-month 00:05 AM report job triggered.');
      try {
        await MonthlyReportJob.runMonthEndPipeline();
        console.log('✅ [MonthlyReportJob] Month-end report pipeline completed successfully.');
      } catch (err: any) {
        console.error('❌ [MonthlyReportJob] Month-end report pipeline failed:', err.message);
      }
    }, {
      timezone: 'Asia/Kolkata'
    });

    console.log('⏰ [MonthlyReportJob] Scheduled to run automatically on the 1st of every month at 00:05 AM IST.');
  }

  public static async runMonthEndPipeline(targetDate: Date = new Date()) {
    // Calculate for the previous completed month
    const prevMonthDate = new Date(targetDate.getFullYear(), targetDate.getMonth() - 1, 1);
    const monthName = prevMonthDate.toLocaleString('default', { month: 'long' });
    const year = prevMonthDate.getFullYear();

    console.log(`[MonthlyReportJob] Executing month-end processing for: ${monthName} ${year}`);

    // Discover active branches and franchises dynamically from Firestore and PostgreSQL
    const branchSnap = await adminDb.collection('franchises').get().catch(() => ({ docs: [] } as any));
    let targets: { branchId: string; branchName: string; franchiseId: string; franchiseName: string }[] = [];

    if (branchSnap.docs.length > 0) {
      targets = branchSnap.docs
        .filter((d: any) => d.data().isActive !== false)
        .map((d: any) => {
          const data = d.data();
          return {
            branchId: d.id,
            branchName: data.name || `Olive Pizza — ${d.id}`,
            franchiseId: data.franchiseId || d.id,
            franchiseName: data.franchiseName || data.name || 'Olive Pizza Franchise'
          };
        });
    }

    if (targets.length === 0) {
      const pgRes = await query(`
        SELECT DISTINCT franchise_id, branch_id FROM canonical_orders WHERE branch_id IS NOT NULL
      `).catch(() => ({ rows: [] }));
      targets = pgRes.rows.map((r: any) => ({
        branchId: r.branch_id,
        branchName: `Olive Pizza — ${r.branch_id}`,
        franchiseId: r.franchise_id || r.branch_id,
        franchiseName: `Olive Pizza ${r.franchise_id || ''}`
      }));
    }

    if (targets.length === 0) {
      console.warn('[MonthlyReportJob] No active franchises/branches discovered for month-end processing.');
      return;
    }

    console.log(`[MonthlyReportJob] Discovered ${targets.length} targets for month-end pipeline.`);

    for (const target of targets) {
      const { franchiseId, branchId, branchName, franchiseName } = target;
      const reportKey = `${franchiseId}_${branchId}_${year}_${monthName.toLowerCase()}`;
      console.log(`[MonthlyReportJob] Processing report for: ${reportKey}`);

      // 1. Generate PDF from PostgreSQL canonical data
      const pdfBuffer = await MonthlyPdfReportService.generateMonthlyReportBuffer({
        monthName,
        year,
        branchId,
        branchName,
        franchiseId,
        franchiseName
      });

      // 2. Upload to Cloudflare R2
      let cloudflarePath = `reports/${year}/${reportKey}.pdf`;
      let pdfUrl = `https://reports.olivepizza.in/monthly/${reportKey}.pdf`;
      try {
        const uploadRes = await CloudflareReportService.uploadPdfReport(year, monthName, pdfBuffer);
        cloudflarePath = uploadRes.cloudflarePath;
        pdfUrl = uploadRes.publicUrl || pdfUrl;
      } catch (err: any) {
        console.warn(`[MonthlyReportJob] R2 upload notice for ${reportKey}:`, err.message);
      }

      // 3. Sync Google Sheets
      let sheetsUrl = '';
      try {
        const sheetRes = await GoogleSheetsMonthlyReportService.syncMonthlyReport({
          monthName,
          year,
          branchId,
          franchiseId,
          branchName,
          franchiseName
        });
        sheetsUrl = sheetRes.url;
      } catch (sheetErr: any) {
        console.warn(`[MonthlyReportJob] Google Sheets sync notice for ${reportKey}:`, sheetErr.message);
      }

      // 4. Compute deterministic sales summary
      const monthIndex = prevMonthDate.getMonth();
      const startDate = `${year}-${String(monthIndex + 1).padStart(2, '0')}-01`;
      const lastDayNum = new Date(year, monthIndex + 1, 0).getDate();
      const endDate = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(lastDayNum).padStart(2, '0')}`;

      const summary = await SalesCalculationEngine.getSalesSummary({
        branchId,
        franchiseId,
        startDate,
        endDate,
        periodLabel: `${monthName.toUpperCase()} ${year}`
      });

      // 5. Store snapshot in PostgreSQL
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
        snapshotId, franchiseId, branchId, monthName, year,
        JSON.stringify(summary), cloudflarePath, pdfUrl, sheetsUrl
      ]);

      // 6. Update Firestore metadata with explicit scope
      const reportScope: ReportScope = {
        level: 'FRANCHISE',
        franchiseId,
        restaurantId: branchId,
        periodMonth: monthName,
        periodYear: year,
      };

      await adminDb.collection('monthly_reports').doc(reportKey).set({
        id: reportKey,
        month: monthName,
        year,
        accessScope: reportScope.level,
        franchiseId,
        branchId,
        restaurantId: branchId,
        revenue: summary.grossSales,
        orders: summary.totalBills,
        cloudflarePath,
        reportUrl: pdfUrl,
        downloadUrl: pdfUrl,
        sheetsUrl,
        status: 'COMPLETED',
        createdTime: new Date().toISOString()
      }, { merge: true });

      // 7. Scoped Push Notification Routing (NO global broadcast!)
      await MonthlyReportNotificationService.dispatchMonthlyReportNotification(reportScope, {
        reportKey,
        pdfUrl,
        grossSales: summary.grossSales,
        totalOrders: summary.totalBills
      }).catch(err => console.error('[MonthlyReportJob] Notification dispatch notice:', err));

      // 8. Email to Verified Owner
      try {
        const ownerEmail = process.env.OWNER_EMAIL || 'olivepizzarjn@gmail.com';
        await sendEmailDirect(
          ownerEmail,
          `Olive Pizza Monthly Business Report — ${branchName} (${monthName} ${year})`,
          `<h2>🍕 Olive Pizza Executive Monthly Report</h2>
           <p><strong>Branch / Entity:</strong> ${branchName}</p>
           <p><strong>Period:</strong> ${monthName} ${year}</p>
           <p><strong>Total Gross Revenue:</strong> ₹${summary.grossSales.toLocaleString('en-IN')}</p>
           <p><strong>Total Orders:</strong> ${summary.totalBills}</p>
           <p><strong>Net Sales:</strong> ₹${summary.netSales.toLocaleString('en-IN')}</p>
           <p><a href="${pdfUrl}">View Executive PDF Report</a></p>`
        );
      } catch (e: any) {
        console.warn('[MonthlyReportJob] Owner email notice:', e.message);
      }
    }
  }
}

// Auto-initialize cron when imported
MonthlyReportJob.init();
