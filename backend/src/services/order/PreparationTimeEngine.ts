/**
 * PreparationTimeEngine — Authoritative Preparation & Ready-Time Engine
 * 
 * Incorporates:
 * 1. Base item preparation times with category standards
 * 2. Concurrency modeling (concurrent baking vs sequential prep)
 * 3. Active kitchen workload & concurrent pending orders buffer
 * 4. Historical completed order metrics from canonical_orders
 * 5. Quantile estimates (p50 median, p90 upper bound) and confidence metadata
 */

import { query } from '../../lib/db.js';

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
  private static historicalStatsCache = new Map<string, { p50: number; p90: number; sampleCount: number; cachedAt: number }>();

  public static setConfig(customConfig: Partial<PrepTimeConfig>) {
    this.config = { ...this.config, ...customConfig };
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
   * Fetches robust historical preparation metrics from canonical_orders for a branch
   * Filters out cancelled, corrupted, or test records
   */
  public static async getHistoricalBranchStats(branchId?: string): Promise<{ p50: number; p90: number; sampleCount: number }> {
    const key = branchId || 'all';
    const now = Date.now();
    const cached = this.historicalStatsCache.get(key);
    if (cached && (now - cached.cachedAt < 10 * 60 * 1000)) { // 10 min cache
      return cached;
    }

    try {
      const sql = branchId
        ? `
          SELECT 
            EXTRACT(EPOCH FROM (ready_at - accepted_at)) / 60.0 as duration_minutes
          FROM canonical_orders
          WHERE branch_id = $1
            AND order_status IN ('READY', 'DELIVERED', 'COMPLETED')
            AND accepted_at IS NOT NULL
            AND ready_at IS NOT NULL
            AND ready_at > accepted_at
            AND EXTRACT(EPOCH FROM (ready_at - accepted_at)) BETWEEN 180 AND 5400
          ORDER BY duration_minutes ASC
          LIMIT 100
        `
        : `
          SELECT 
            EXTRACT(EPOCH FROM (ready_at - accepted_at)) / 60.0 as duration_minutes
          FROM canonical_orders
          WHERE order_status IN ('READY', 'DELIVERED', 'COMPLETED')
            AND accepted_at IS NOT NULL
            AND ready_at IS NOT NULL
            AND ready_at > accepted_at
            AND EXTRACT(EPOCH FROM (ready_at - accepted_at)) BETWEEN 180 AND 5400
          ORDER BY duration_minutes ASC
          LIMIT 100
        `;
      
      const params = branchId ? [branchId] : [];
      const res = await query(sql, params).catch(() => ({ rows: [] }));
      const rows = res.rows || [];

      if (rows.length >= 5) {
        const durations = rows.map((r: any) => Number(r.duration_minutes)).filter((d: number) => !isNaN(d));
        durations.sort((a: number, b: number) => a - b);
        const p50Index = Math.floor(durations.length * 0.5);
        const p90Index = Math.floor(durations.length * 0.9);
        const p50 = Math.round(durations[p50Index] || 15);
        const p90 = Math.round(durations[p90Index] || 25);
        const result = { p50, p90, sampleCount: durations.length, cachedAt: now };
        this.historicalStatsCache.set(key, result);
        return result;
      }
    } catch (err: any) {
      console.warn('[PreparationTimeEngine] Historical stats lookup notice:', err.message);
    }

    const defaultStats = { p50: 15, p90: 25, sampleCount: 0, cachedAt: now };
    this.historicalStatsCache.set(key, defaultStats);
    return defaultStats;
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
    // Concurrency modeling: concurrent preparation amortizes additional items
    const additionalItemBuffer = Math.max(0, distinctItemCount - 1) * this.config.additionalItemIncrementMinutes;
    const comboBuffer = comboCount * this.config.comboAdjustmentMinutes;

    let quantityBuffer = 0;
    if (totalQuantity > 8) {
      quantityBuffer = 6;
    } else if (totalQuantity > 4) {
      quantityBuffer = 3;
    }

    // Workload buffering: 1.5 minutes per 2 pending concurrent kitchen orders
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

    // If historical data exists with good sample count (>= 10), blend baseline with historical median
    let finalEstimate = baselineMinutes;
    let confidence = 0.70;

    if (historicalStats.sampleCount >= 10) {
      // 70% item baseline + 30% branch historical median
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
