/**
 * PreparationTimeEngine — Authoritative Preparation & Ready-Time Engine
 */

export interface PrepTimeConfig {
  baseMinutesByCategory: Record<string, number>;
  additionalItemIncrementMinutes: number;
  comboAdjustmentMinutes: number;
  peakHourBufferMinutes: number;
  defaultBaseMinutes: number;
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
};

export class PreparationTimeEngine {
  private static config: PrepTimeConfig = DEFAULT_PREP_CONFIG;

  public static setConfig(customConfig: Partial<PrepTimeConfig>) {
    this.config = { ...this.config, ...customConfig };
  }

  public static calculateEstimatedPreparationMinutes(items: Array<{ category?: string; quantity?: number; isCombo?: boolean }>): number {
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

    const now = new Date();
    const currentHour = now.getHours();
    const isPeakHour = (currentHour >= 19 && currentHour <= 22) || (currentHour >= 13 && currentHour <= 14);
    const peakBuffer = isPeakHour ? this.config.peakHourBufferMinutes : 0;

    const totalMinutes = maxBaseMinutes + additionalItemBuffer + comboBuffer + quantityBuffer + peakBuffer;
    return Math.min(45, Math.max(8, totalMinutes));
  }

  public static computeExpectedReadyAt(preparingAt: Date | string, prepMinutes: number): string {
    const startMs = typeof preparingAt === 'string' ? new Date(preparingAt).getTime() : preparingAt.getTime();
    const readyMs = startMs + prepMinutes * 60 * 1000;
    return new Date(readyMs).toISOString();
  }
}
