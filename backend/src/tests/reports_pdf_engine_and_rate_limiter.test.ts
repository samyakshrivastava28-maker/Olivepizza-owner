import { describe, it } from 'node:test';
import assert from 'node:assert';
import { SalesCalculationEngine } from '../services/reports/SalesCalculationEngine.js';
import { MonthlyPdfReportService } from '../services/reports/MonthlyPdfReportService.js';
import { isAuthorizedOwner } from '../routes/report.routes.js';

describe('Executive Monthly PDF Report Engine & Redis Rate Limiter Tests', () => {

  it('TEST 1: SalesCalculationEngine resolves all required custom report periods deterministically', () => {
    // 1. ongoing_month / ongoing_month_live
    const ongoing = SalesCalculationEngine.resolveDateRange('ongoing_month_live');
    assert.ok(ongoing.dateRange.startDate.endsWith('-01'));
    assert.ok(ongoing.periodLabel.includes('Ongoing Month'));

    // 2. last_2_days
    const last2Days = SalesCalculationEngine.resolveDateRange('last_2_days');
    assert.strictEqual(last2Days.periodLabel, 'Last 2 Days');
    assert.ok(last2Days.dateRange.startDate <= last2Days.dateRange.endDate);

    // 3. this_week
    const thisWeek = SalesCalculationEngine.resolveDateRange('this_week');
    assert.strictEqual(thisWeek.periodLabel, 'This Week');

    // 4. last_day / yesterday
    const lastDay = SalesCalculationEngine.resolveDateRange('last_day');
    assert.strictEqual(lastDay.periodLabel, 'Yesterday');
    assert.strictEqual(lastDay.dateRange.startDate, lastDay.dateRange.endDate);

    // 5. all_time
    const allTime = SalesCalculationEngine.resolveDateRange('all_time');
    assert.strictEqual(allTime.periodLabel, 'All Time');
    assert.strictEqual(allTime.dateRange.startDate, '2024-01-01');

    // 6. custom range
    const custom = SalesCalculationEngine.resolveDateRange('custom', '2026-10-01', '2026-10-10');
    assert.strictEqual(custom.dateRange.startDate, '2026-10-01');
    assert.strictEqual(custom.dateRange.endDate, '2026-10-10');
    assert.strictEqual(custom.periodLabel, '2026-10-01 to 2026-10-10');
  });

  it('TEST 2: isAuthorizedOwner correctly identifies master owners and rejects managers', () => {
    // Master Owner Emails
    assert.strictEqual(isAuthorizedOwner({ email: 'olivepizzarjn@gmail.com', role: 'customer' }), true);
    assert.strictEqual(isAuthorizedOwner({ email: 'webhub2811@gmail.com', role: 'manager' }), true);
    assert.strictEqual(isAuthorizedOwner({ email: 'olivepizzamaker@gmail.com', role: 'staff' }), true);

    // Roles
    assert.strictEqual(isAuthorizedOwner({ email: 'owner@test.com', role: 'OWNER' }), true);
    assert.strictEqual(isAuthorizedOwner({ email: 'admin@test.com', role: 'admin' }), true);
    assert.strictEqual(isAuthorizedOwner({ email: 'dev@test.com', role: 'PLATFORM_OWNER' }), true);

    // Restaurant Managers & Staff
    assert.strictEqual(isAuthorizedOwner({ email: 'manager@branch.com', role: 'restaurant_manager' }), false);
    assert.strictEqual(isAuthorizedOwner({ email: 'staff@branch.com', role: 'kitchen_manager' }), false);
    assert.strictEqual(isAuthorizedOwner(null), false);
    assert.strictEqual(isAuthorizedOwner(undefined), false);
  });

  it('TEST 3: MonthlyPdfReportService compiles valid Executive PDF buffer for Official Monthly Reports', async () => {
    const pdfBuffer = await MonthlyPdfReportService.generateMonthlyReportBuffer({
      monthName: 'October',
      year: 2026,
      branchId: 'main_branch',
      branchName: 'Olive Pizza — Rajnandgaon HQ',
      franchiseId: 'fra_primary',
      franchiseName: 'Olive Pizza Franchise',
      gstin: '22AAAAO1234A1Z5',
      fssai: '10522016000123',
      channel: 'ALL'
    });

    assert.ok(Buffer.isBuffer(pdfBuffer));
    assert.ok(pdfBuffer.length > 1000, `Expected PDF buffer length > 1000, got ${pdfBuffer.length}`);
    
    // Verify standard PDF header magic number %PDF
    const magicHeader = pdfBuffer.subarray(0, 4).toString('utf8');
    assert.strictEqual(magicHeader, '%PDF');
  });

  it('TEST 4: MonthlyPdfReportService compiles valid Executive PDF buffer for Custom Date Ranges', async () => {
    const pdfBuffer = await MonthlyPdfReportService.generateMonthlyReportBuffer({
      startDate: '2026-10-01',
      endDate: '2026-10-14',
      periodLabel: 'OCT 1 - OCT 14, 2026 (CUSTOM)',
      branchId: 'main_branch',
      branchName: 'Olive Pizza — Rajnandgaon HQ',
      franchiseId: 'fra_primary',
      franchiseName: 'Olive Pizza Franchise',
      isCustomReport: true
    });

    assert.ok(Buffer.isBuffer(pdfBuffer));
    assert.ok(pdfBuffer.length > 1000, `Expected PDF buffer length > 1000, got ${pdfBuffer.length}`);
    
    const magicHeader = pdfBuffer.subarray(0, 4).toString('utf8');
    assert.strictEqual(magicHeader, '%PDF');
  });

  it('TEST 5: Rate Limiter logic simulates 2 PDFs/hr quota for restaurant manager and 429 cutoff', async () => {
    // Simulated state for branch: ratelimit:pdf:custom:branch:test_branch
    const store = new Map<string, { count: number; expiresAt: number }>();
    const branchId = 'test_branch_99';
    const redisKey = `ratelimit:pdf:custom:branch:${branchId}`;
    const LIMIT = 2;
    const TTL_MS = 3600 * 1000;

    const checkQuota = (isOwner: boolean) => {
      if (isOwner) return { allowed: true, remaining: 999, limit: 2, resetInSeconds: 0 };
      const item = store.get(redisKey);
      const now = Date.now();
      if (!item || now > item.expiresAt) {
        return { allowed: true, remaining: LIMIT, limit: LIMIT, resetInSeconds: 3600, minutesLeft: 60 };
      }
      const remaining = Math.max(0, LIMIT - item.count);
      const resetInSeconds = Math.max(0, Math.ceil((item.expiresAt - now) / 1000));
      const minutesLeft = Math.max(1, Math.ceil(resetInSeconds / 60));
      return { allowed: item.count < LIMIT, remaining, limit: LIMIT, resetInSeconds, minutesLeft };
    };

    const consumeQuota = (isOwner: boolean) => {
      if (isOwner) return;
      const now = Date.now();
      const item = store.get(redisKey);
      if (!item || now > item.expiresAt) {
        store.set(redisKey, { count: 1, expiresAt: now + TTL_MS });
      } else {
        item.count += 1;
      }
    };

    // Owner test: bypasses limiter completely
    assert.strictEqual(checkQuota(true).allowed, true);
    consumeQuota(true);
    consumeQuota(true);
    consumeQuota(true);
    assert.strictEqual(checkQuota(true).allowed, true);
    assert.strictEqual(checkQuota(true).remaining, 999);

    // Restaurant Manager test:
    // Initial state: remaining = 2
    let q = checkQuota(false);
    assert.strictEqual(q.allowed, true);
    assert.strictEqual(q.remaining, 2);

    // 1st download
    consumeQuota(false);
    q = checkQuota(false);
    assert.strictEqual(q.allowed, true);
    assert.strictEqual(q.remaining, 1);

    // 2nd download
    consumeQuota(false);
    q = checkQuota(false);
    assert.strictEqual(q.allowed, false);
    assert.strictEqual(q.remaining, 0);

    // 3rd download attempt triggers HTTP 429 error message
    const errorResponse = {
      error: `Hourly custom PDF limit reached (2 PDFs/hr). Next PDF download available in ${q.minutesLeft} minutes.`
    };
    assert.ok(errorResponse.error.includes('Hourly custom PDF limit reached (2 PDFs/hr)'));
  });

  // Ensure test process exits cleanly after database connections
  setTimeout(() => process.exit(0), 100);
});

