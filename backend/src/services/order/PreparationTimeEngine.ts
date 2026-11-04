/**
 * PreparationTimeEngine — Authoritative Preparation & Ready-Time Engine
 * 
 * Incorporates:
 * 1. Three distinct, non-overlapping duration metrics:
 *    - Metric A: Kitchen preparation duration (ready_at - preparation_started_at)
 *    - Metric B: Acceptance-to-ready duration (ready_at - accepted_at)
 *    - Metric C: Total order fulfilment duration (delivered_at - created_at)
 * 2. Transparent historical estimation layer:
 *    - Quantile aggregation (p50 median, p90 bound)
 *    - Strict minimum sample threshold (>= 5 records required, else explicitly UNAVAILABLE)
 *    - Non-destructive: Never overwrites original business records with estimated timestamps
 *    - Out-of-order and negative duration filtering
 *    - Cohort support: Branch, order type, and time-of-day
 * 3. Deterministic item preparation baseline with concurrency and workload modeling
 */

import { query } from '../../lib/db.js';

export type MetricType = 'KITCHEN_PREPARATION' | 'ACCEPTANCE_TO_READY' | 'TOTAL_FULFILMENT';

export interface DurationMetricReport {
  metric_type: MetricType;
  value_minutes: number | null;
  p50_minutes?: number | null;
  p90_minutes?: number | null;
  source: 'ACTUAL' | 'ESTIMATED' | 'UNAVAILABLE';
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
  sample_count: number;
  methodology?: string;
}

export interface PrepTimeConfig {
  baseMinutesByCategory: Record<string, number>;
  additionalItemIncrementMinutes: number;
  comboAdjustmentMinutes: number;
  peakHourBufferMinutes: number;
  defaultBaseMinutes: number;
  minAllowedMinutes: number;
  maxAllowedMinutes: number;
}

export interface PreparationEstimateResult {
  estimatedMinutes: number;
  p50Minutes: number;
  p90Minutes: number;
  modelVersion: string;
  confidenceScore: number;
  breakdown: {
    baseCategoryMinutes: number;
    concurrencyBufferMinutes: number;
    workloadBufferMinutes: number;
    peakBufferMinutes: number;
  };
}

export const DEFAULT_PREP_CONFIG: PrepTimeConfig = {
  baseMinutesByCategory: {
    pizza: 12,
    combos: 15,
    pasta: 10,
    beverages: 2,
    sides: 6,
    desserts: 4,
  },
  additionalItemIncrementMinutes: 2,
  comboAdjustmentMinutes: 3,
  peakHourBufferMinutes: 4,
  defaultBaseMinutes: 12,
  minAllowedMinutes: 5,
  maxAllowedMinutes: 90,
};

export class PreparationTimeEngine {
  private static config: PrepTimeConfig = DEFAULT_PREP_CONFIG;
  private static historicalStatsCache = new Map<string, { report: DurationMetricReport; cachedAt: number }>();

  public static setConfig(customConfig: Partial<PrepTimeConfig>) {
    this.config = { ...this.config, ...customConfig };
  }

  /**
   * Calculates all 3 distinct lifecycle metrics for an individual order.
   * Keeps ACTUAL measurements strictly separated from ESTIMATED/UNAVAILABLE.
   */
  public static calculateOrderMetrics(order: {
    created_at?: Date | string | null;
    accepted_at?: Date | string | null;
    preparation_started_at?: Date | string | null;
    ready_at?: Date | string | null;
    delivered_at?: Date | string | null;
    updated_at?: Date | string | null;
  }): {
    kitchenPreparation: DurationMetricReport;
    acceptanceToReady: DurationMetricReport;
    totalFulfilment: DurationMetricReport;
  } {
    const parseTime = (val: any): number | null => {
      if (!val) return null;
      const ms = typeof val === 'string' ? new Date(val).getTime() : (val instanceof Date ? val.getTime() : null);
      return (ms && !isNaN(ms)) ? ms : null;
    };

    const createdMs = parseTime(order.created_at);
    const acceptedMs = parseTime(order.accepted_at);
    const prepStartedMs = parseTime(order.preparation_started_at);
    const readyMs = parseTime(order.ready_at);
    const deliveredMs = parseTime(order.delivered_at);

    // Metric A: Kitchen Preparation Duration (ready_at - preparation_started_at)
    let kitchenPrep: DurationMetricReport;
    if (readyMs !== null && prepStartedMs !== null) {
      if (readyMs <= prepStartedMs) {
        kitchenPrep = {
          metric_type: 'KITCHEN_PREPARATION',
          value_minutes: null,
          source: 'UNAVAILABLE',
          confidence: 'NONE',
          sample_count: 0,
          methodology: 'Corrupted record: ready_at is prior to or equal to preparation_started_at (negative duration)'
        };
      } else {
        const diffMins = (readyMs - prepStartedMs) / 60000;
        if (diffMins < 1 || diffMins > 180) {
          kitchenPrep = {
            metric_type: 'KITCHEN_PREPARATION',
            value_minutes: null,
            source: 'UNAVAILABLE',
            confidence: 'NONE',
            sample_count: 0,
            methodology: `Outlier rejected: duration ${diffMins.toFixed(1)} mins outside reasonable range (1-180m)`
          };
        } else {
          kitchenPrep = {
            metric_type: 'KITCHEN_PREPARATION',
            value_minutes: Math.round(diffMins * 10) / 10,
            source: 'ACTUAL',
            confidence: 'HIGH',
            sample_count: 1,
            methodology: 'Genuine actual duration calculated from ready_at - preparation_started_at'
          };
        }
      }
    } else {
      kitchenPrep = {
        metric_type: 'KITCHEN_PREPARATION',
        value_minutes: null,
        source: 'UNAVAILABLE',
        confidence: 'NONE',
        sample_count: 0,
        methodology: 'Missing preparation_started_at or ready_at timestamp'
      };
    }

    // Metric B: Acceptance-to-Ready Duration (ready_at - accepted_at)
    let acceptanceToReady: DurationMetricReport;
    if (readyMs !== null && acceptedMs !== null) {
      if (readyMs <= acceptedMs) {
        acceptanceToReady = {
          metric_type: 'ACCEPTANCE_TO_READY',
          value_minutes: null,
          source: 'UNAVAILABLE',
          confidence: 'NONE',
          sample_count: 0,
          methodology: 'Corrupted record: ready_at is prior to or equal to accepted_at'
        };
      } else {
        const diffMins = (readyMs - acceptedMs) / 60000;
        acceptanceToReady = {
          metric_type: 'ACCEPTANCE_TO_READY',
          value_minutes: Math.round(diffMins * 10) / 10,
          source: 'ACTUAL',
          confidence: 'HIGH',
          sample_count: 1,
          methodology: 'Genuine actual duration calculated from ready_at - accepted_at'
        };
      }
    } else {
      acceptanceToReady = {
        metric_type: 'ACCEPTANCE_TO_READY',
        value_minutes: null,
        source: 'UNAVAILABLE',
        confidence: 'NONE',
        sample_count: 0,
        methodology: 'Missing accepted_at or ready_at timestamp'
      };
    }

    // Metric C: Total Fulfilment Duration (delivered_at - created_at)
    let totalFulfilment: DurationMetricReport;
    if (deliveredMs !== null && createdMs !== null) {
      if (deliveredMs <= createdMs) {
        totalFulfilment = {
          metric_type: 'TOTAL_FULFILMENT',
          value_minutes: null,
          source: 'UNAVAILABLE',
          confidence: 'NONE',
          sample_count: 0,
          methodology: 'Corrupted record: delivered_at is prior to or equal to created_at'
        };
      } else {
        const diffMins = (deliveredMs - createdMs) / 60000;
        totalFulfilment = {
          metric_type: 'TOTAL_FULFILMENT',
          value_minutes: Math.round(diffMins * 10) / 10,
          source: 'ACTUAL',
          confidence: 'HIGH',
          sample_count: 1,
          methodology: 'Genuine actual duration calculated from delivered_at - created_at'
        };
      }
    } else {
      totalFulfilment = {
        metric_type: 'TOTAL_FULFILMENT',
        value_minutes: null,
        source: 'UNAVAILABLE',
        confidence: 'NONE',
        sample_count: 0,
        methodology: 'Missing created_at or delivered_at timestamp'
      };
    }

    return { kitchenPreparation: kitchenPrep, acceptanceToReady, totalFulfilment };
  }

  /**
   * Aggregates robust historical metrics across canonical_orders with cohort filtering.
   * If sample size is insufficient (< minSamples, default 5), explicitly returns UNAVAILABLE.
   */
  public static async getHistoricalMetricStats(
    metricType: MetricType,
    options?: {
      branchId?: string;
      orderType?: string;
      timeOfDay?: 'lunch' | 'dinner' | 'late_night' | 'all';
      minSamples?: number;
    }
  ): Promise<DurationMetricReport> {
    const { branchId, orderType, timeOfDay, minSamples = 5 } = options || {};
    const cacheKey = `${metricType}_${branchId || 'all'}_${orderType || 'all'}_${timeOfDay || 'all'}`;
    const now = Date.now();
    const cached = this.historicalStatsCache.get(cacheKey);
    if (cached && (now - cached.cachedAt < 5 * 60 * 1000)) {
      return cached.report;
    }

    let durationExpr: string;
    let whereConditions: string[] = [];
    const params: any[] = [];

    switch (metricType) {
      case 'KITCHEN_PREPARATION':
        durationExpr = `EXTRACT(EPOCH FROM (ready_at - preparation_started_at)) / 60.0`;
        whereConditions.push(`ready_at IS NOT NULL`);
        whereConditions.push(`preparation_started_at IS NOT NULL`);
        whereConditions.push(`ready_at > preparation_started_at`);
        whereConditions.push(`EXTRACT(EPOCH FROM (ready_at - preparation_started_at)) BETWEEN 180 AND 5400`); // 3m to 90m
        break;

      case 'ACCEPTANCE_TO_READY':
        durationExpr = `EXTRACT(EPOCH FROM (ready_at - accepted_at)) / 60.0`;
        whereConditions.push(`ready_at IS NOT NULL`);
        whereConditions.push(`accepted_at IS NOT NULL`);
        whereConditions.push(`ready_at > accepted_at`);
        whereConditions.push(`EXTRACT(EPOCH FROM (ready_at - accepted_at)) BETWEEN 180 AND 7200`); // 3m to 120m
        break;

      case 'TOTAL_FULFILMENT':
      default:
        durationExpr = `EXTRACT(EPOCH FROM (delivered_at - created_at)) / 60.0`;
        whereConditions.push(`delivered_at IS NOT NULL`);
        whereConditions.push(`created_at IS NOT NULL`);
        whereConditions.push(`delivered_at > created_at`);
        whereConditions.push(`EXTRACT(EPOCH FROM (delivered_at - created_at)) BETWEEN 300 AND 14400`); // 5m to 240m
        break;
    }

    whereConditions.push(`order_status IN ('READY', 'DELIVERED', 'COMPLETED')`);

    if (branchId) {
      params.push(branchId);
      whereConditions.push(`branch_id = $${params.length}`);
    }

    if (orderType) {
      params.push(orderType.toLowerCase());
      whereConditions.push(`LOWER(order_type) = $${params.length}`);
    }

    if (timeOfDay && timeOfDay !== 'all') {
      if (timeOfDay === 'lunch') {
        whereConditions.push(`EXTRACT(HOUR FROM created_at AT TIME ZONE 'UTC') BETWEEN 11 AND 15`);
      } else if (timeOfDay === 'dinner') {
        whereConditions.push(`EXTRACT(HOUR FROM created_at AT TIME ZONE 'UTC') BETWEEN 18 AND 22`);
      } else if (timeOfDay === 'late_night') {
        whereConditions.push(`(EXTRACT(HOUR FROM created_at AT TIME ZONE 'UTC') >= 23 OR EXTRACT(HOUR FROM created_at AT TIME ZONE 'UTC') < 5)`);
      }
    }

    const sql = `
      SELECT ${durationExpr} as duration_minutes
      FROM canonical_orders
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY duration_minutes ASC
      LIMIT 200;
    `;

    try {
      const res = await query(sql, params).catch(() => ({ rows: [] }));
      const rows = res.rows || [];
      const durations = rows.map((r: any) => Number(r.duration_minutes)).filter((d: number) => !isNaN(d) && d > 0);

      if (durations.length < minSamples) {
        const report: DurationMetricReport = {
          metric_type: metricType,
          value_minutes: null,
          p50_minutes: null,
          p90_minutes: null,
          source: 'UNAVAILABLE',
          confidence: 'NONE',
          sample_count: durations.length,
          methodology: `Insufficient genuine samples (${durations.length} found, minimum ${minSamples} required). Refusing to manufacture ungrounded estimates.`
        };
        this.historicalStatsCache.set(cacheKey, { report, cachedAt: now });
        return report;
      }

      durations.sort((a: number, b: number) => a - b);
      const p50Idx = Math.floor(durations.length * 0.5);
      const p90Idx = Math.floor(durations.length * 0.9);
      const p50 = Math.round(durations[p50Idx] * 10) / 10;
      const p90 = Math.round(durations[p90Idx] * 10) / 10;

      let confidence: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
      if (durations.length >= 30) confidence = 'HIGH';
      else if (durations.length >= 10) confidence = 'MEDIUM';

      const report: DurationMetricReport = {
        metric_type: metricType,
        value_minutes: p50,
        p50_minutes: p50,
        p90_minutes: p90,
        source: 'ESTIMATED',
        confidence,
        sample_count: durations.length,
        methodology: `Transparent historical quantile estimation (p50 median) computed across ${durations.length} canonical order records.`
      };

      this.historicalStatsCache.set(cacheKey, { report, cachedAt: now });
      return report;
    } catch (err: any) {
      console.warn(`[PreparationTimeEngine] Historical aggregation error for ${metricType}:`, err.message);
      return {
        metric_type: metricType,
        value_minutes: null,
        p50_minutes: null,
        p90_minutes: null,
        source: 'UNAVAILABLE',
        confidence: 'NONE',
        sample_count: 0,
        methodology: `Query execution error: ${err.message}`
      };
    }
  }

  /**
   * Fetches historical preparation statistics for branch backwards-compatibility
   */
  public static async getHistoricalBranchStats(branchId?: string): Promise<{ p50: number; p90: number; sampleCount: number }> {
    let report = await this.getHistoricalMetricStats('KITCHEN_PREPARATION', { branchId });
    if (report.source === 'UNAVAILABLE' || !report.value_minutes) {
      report = await this.getHistoricalMetricStats('ACCEPTANCE_TO_READY', { branchId });
    }

    if (report.source === 'ESTIMATED' && report.value_minutes !== null) {
      return {
        p50: Math.round(report.p50_minutes || report.value_minutes),
        p90: Math.round(report.p90_minutes || (report.value_minutes + 10)),
        sampleCount: report.sample_count
      };
    }

    return { p50: 15, p90: 25, sampleCount: 0 };
  }

  /**
   * Validates restaurant-adjusted preparation time within authoritative bounds
   */
  public static validateConfirmedPrepMinutes(minutes: number): { valid: boolean; normalizedMinutes: number; error?: string } {
    if (typeof minutes !== 'number' || isNaN(minutes)) {
      return { valid: false, normalizedMinutes: this.config.defaultBaseMinutes, error: 'Preparation minutes must be a valid number.' };
    }
    if (minutes < this.config.minAllowedMinutes) {
      return { valid: false, normalizedMinutes: this.config.minAllowedMinutes, error: `Preparation time cannot be less than ${this.config.minAllowedMinutes} minutes.` };
    }
    if (minutes > this.config.maxAllowedMinutes) {
      return { valid: false, normalizedMinutes: this.config.maxAllowedMinutes, error: `Preparation time cannot exceed ${this.config.maxAllowedMinutes} minutes.` };
    }
    return { valid: true, normalizedMinutes: Math.round(minutes) };
  }

  /**
   * Pure baseline estimation based on product configuration and item count
   */
  public static calculateEstimatedPreparationMinutes(
    items: Array<{ category?: string; quantity?: number; isCombo?: boolean }>,
    workloadPendingOrders: number = 0,
    options?: { isPeakHour?: boolean }
  ): number {
    if (!items || items.length === 0) return this.config.defaultBaseMinutes;

    let maxBaseMinutes = 0;
    let totalQuantity = 0;
    let comboCount = 0;

    for (const item of items) {
      const cat = (item.category || 'pizza').toLowerCase();
      const catBase = this.config.baseMinutesByCategory[cat] ?? this.config.defaultBaseMinutes;
      if (catBase > maxBaseMinutes) {
        maxBaseMinutes = catBase;
      }
      totalQuantity += Number(item.quantity || 1);
      if (item.isCombo || cat === 'combos') {
        comboCount += Number(item.quantity || 1);
      }
    }

    if (maxBaseMinutes === 0) maxBaseMinutes = this.config.defaultBaseMinutes;

    const distinctItemCount = items.length;
    const additionalItemBuffer = Math.max(0, distinctItemCount - 1) * this.config.additionalItemIncrementMinutes;
    const comboBuffer = comboCount * this.config.comboAdjustmentMinutes;

    let quantityBuffer = 0;
    if (totalQuantity > 8) {
      quantityBuffer = 6;
    } else if (totalQuantity > 4) {
      quantityBuffer = 3;
    }

    const workloadBuffer = Math.min(15, Math.floor(workloadPendingOrders / 2) * 2);

    const now = new Date();
    const currentHour = now.getHours();
    const isPeakHour = options?.isPeakHour !== undefined 
      ? options.isPeakHour 
      : ((currentHour >= 19 && currentHour <= 22) || (currentHour >= 13 && currentHour <= 14));
    const peakBuffer = isPeakHour ? this.config.peakHourBufferMinutes : 0;

    const totalMinutes = maxBaseMinutes + additionalItemBuffer + comboBuffer + quantityBuffer + workloadBuffer + peakBuffer;
    return Math.min(this.config.maxAllowedMinutes, Math.max(this.config.minAllowedMinutes, totalMinutes));
  }

  /**
   * Comprehensive intelligent prediction returning quantile bounds and confidence score
   */
  public static async calculateIntelligentEstimate(params: {
    items: Array<{ category?: string; quantity?: number; isCombo?: boolean }>;
    branchId?: string;
    workloadPendingOrders?: number;
  }): Promise<PreparationEstimateResult> {
    const { items, branchId, workloadPendingOrders = 0 } = params;
    const baselineMinutes = this.calculateEstimatedPreparationMinutes(items, workloadPendingOrders);
    const historicalStats = await this.getHistoricalBranchStats(branchId);

    let finalEstimate = baselineMinutes;
    let confidence = 0.70;

    if (historicalStats.sampleCount >= 10) {
      finalEstimate = Math.round(baselineMinutes * 0.7 + historicalStats.p50 * 0.3);
      confidence = Math.min(0.95, 0.70 + (historicalStats.sampleCount / 100) * 0.25);
    }

    const p50 = Math.max(this.config.minAllowedMinutes, finalEstimate);
    const p90 = Math.min(this.config.maxAllowedMinutes, Math.max(p50 + 5, historicalStats.p90));

    return {
      estimatedMinutes: p50,
      p50Minutes: p50,
      p90Minutes: p90,
      modelVersion: historicalStats.sampleCount >= 10 ? 'v1.2-historical-hybrid' : 'v1.0-deterministic-baseline',
      confidenceScore: Number(confidence.toFixed(2)),
      breakdown: {
        baseCategoryMinutes: items.length > 0 ? (this.config.baseMinutesByCategory[(items[0].category || 'pizza').toLowerCase()] || 12) : 12,
        concurrencyBufferMinutes: Math.max(0, items.length - 1) * this.config.additionalItemIncrementMinutes,
        workloadBufferMinutes: Math.min(15, Math.floor(workloadPendingOrders / 2) * 2),
        peakBufferMinutes: 0,
      }
    };
  }

  public static computeExpectedReadyAt(preparingAt: Date | string, prepMinutes: number): string {
    const startMs = typeof preparingAt === 'string' ? new Date(preparingAt).getTime() : preparingAt.getTime();
    const readyMs = startMs + prepMinutes * 60 * 1000;
    return new Date(readyMs).toISOString();
  }
}
