/**
 * Global Scheduling & Expiry Engine
 * Used by: Ads, Coupons, Combos, Offers, Banners, Special Categories, Featured Products, Homepage Sections
 * Architecture: Firestore & React Runtime Safe
 */

export type RecurringRule =
  | { type: 'permanent' }
  | { type: 'weekdays' } // Mon-Fri
  | { type: 'weekends' } // Sat-Sun
  | { type: 'specific_days'; days: number[] } // 0=Sun, 1=Mon, ..., 6=Sat
  | { type: 'every_month'; dayOfMonth: number }
  | { type: 'every_year'; month: number; day: number };

export interface ScheduledItem {
  isActive?: boolean;
  isArchived?: boolean;
  status?: 'draft' | 'published' | 'archived' | string;
  startDate?: string | any;
  endDate?: string | any;
  expiryDate?: string | any;
  validUntil?: string | any;
  validTo?: string | any;
  expiresAt?: string | any;
  validTill?: string | any;
  expireDate?: string | any;
  expiresOn?: string | any;
  expirationDate?: string | any;
  validFrom?: string | any;
  startsAt?: string | any;
  specificTime?: string; // "HH:MM"
  recurringRule?: RecurringRule;
}

/**
 * Universal Date parser handling Firestore Timestamps, ISO strings, YYYY-MM-DD, and numbers
 */
export function extractDate(raw: any, isEndOfDay = false): Date | null {
  if (!raw) return null;

  // Handle Firestore Timestamp object
  if (typeof raw === 'object' && typeof raw.toDate === 'function') {
    return raw.toDate();
  }
  if (typeof raw === 'object' && raw._seconds !== undefined) {
    return new Date(raw._seconds * 1000);
  }
  if (typeof raw === 'object' && raw.seconds !== undefined) {
    return new Date(raw.seconds * 1000);
  }

  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return null;

    // If date format YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const [year, month, day] = trimmed.split('-').map(Number);
      if (isEndOfDay) {
        return new Date(year, month - 1, day, 23, 59, 59, 999);
      } else {
        return new Date(year, month - 1, day, 0, 0, 0, 0);
      }
    }

    const d = new Date(trimmed);
    return isNaN(d.getTime()) ? null : d;
  }

  if (typeof raw === 'number') {
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
  }

  if (raw instanceof Date) {
    return isNaN(raw.getTime()) ? null : raw;
  }

  return null;
}

/**
 * Extracts the start date from any item supporting multiple field synonyms
 */
export function getItemStartDate(item: ScheduledItem | any): Date | null {
  if (!item) return null;
  const raw = item.startDate || item.validFrom || item.startsAt || item.effectiveFrom;
  return extractDate(raw, false);
}

/**
 * Extracts the expiration date from any item supporting multiple field synonyms
 */
export function getItemExpiryDate(item: ScheduledItem | any): Date | null {
  if (!item) return null;
  const raw =
    item.endDate ||
    item.expiryDate ||
    item.validUntil ||
    item.validTo ||
    item.expiresAt ||
    item.expiresOn ||
    item.validTill ||
    item.expireDate ||
    item.expirationDate;

  return extractDate(raw, true);
}

/**
 * Determines if a scheduled item is currently visible, active, and NOT expired.
 * Applies to: ads, coupons, special_categories, home sections, combos, banners.
 */
export function isCurrentlyScheduled(item: ScheduledItem | any): boolean {
  if (!item) return false;

  // Must be active and not archived
  if (item.isActive === false) return false;
  if (item.isArchived === true) return false;
  if (item.status === 'draft' || item.status === 'archived') return false;

  const now = new Date();

  // Check Start Date
  const start = getItemStartDate(item);
  if (start && now < start) {
    return false;
  }

  // Check Expiry Date
  const end = getItemExpiryDate(item);
  if (end && now > end) {
    return false;
  }

  // Check specific time window (hour-level granularity)
  if (item.specificTime) {
    const [hours, minutes] = item.specificTime.split(':').map(Number);
    const nowHour = now.getHours();
    const nowMinute = now.getMinutes();
    const itemMinutes = hours * 60 + minutes;
    const nowMinutes = nowHour * 60 + nowMinute;
    // Show for up to 1 hour after specific time
    if (nowMinutes < itemMinutes || nowMinutes > itemMinutes + 60) return false;
  }

  // Check recurring rule
  if (item.recurringRule) {
    const rule = item.recurringRule;
    const dayOfWeek = now.getDay(); // 0=Sun, 6=Sat
    const dayOfMonth = now.getDate();
    const month = now.getMonth() + 1; // 1-indexed

    switch (rule.type) {
      case 'permanent':
        break; // Always active
      case 'weekdays':
        if (dayOfWeek === 0 || dayOfWeek === 6) return false;
        break;
      case 'weekends':
        if (dayOfWeek !== 0 && dayOfWeek !== 6) return false;
        break;
      case 'specific_days':
        if (!rule.days.includes(dayOfWeek)) return false;
        break;
      case 'every_month':
        if (dayOfMonth !== rule.dayOfMonth) return false;
        break;
      case 'every_year':
        if (month !== rule.month || dayOfMonth !== rule.day) return false;
        break;
    }
  }

  return true;
}

export const isItemActiveAndValid = isCurrentlyScheduled;

/**
 * Filters an array of scheduled items to only return currently active and unexpired ones.
 * Sorts by priority (higher first) and then by creation date.
 */
export function filterActive<T extends ScheduledItem & { priority?: number; createdAt?: string }>(
  items: T[]
): T[] {
  if (!Array.isArray(items)) return [];
  return items
    .filter(isCurrentlyScheduled)
    .sort((a, b) => {
      const pa = a.priority ?? 0;
      const pb = b.priority ?? 0;
      if (pb !== pa) return pb - pa;
      // Secondary sort: newest first
      const da = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const db = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return db - da;
    });
}

/**
 * Returns a human-readable status label for an item.
 */
export function getScheduleStatus(item: ScheduledItem | any): {
  label: string;
  color: 'green' | 'orange' | 'red' | 'slate';
} {
  if (!item) return { label: 'Inactive', color: 'slate' };
  if (item.status === 'draft') return { label: 'Draft', color: 'slate' };
  if (item.isArchived || item.status === 'archived') return { label: 'Archived', color: 'red' };
  if (item.isActive === false) return { label: 'Inactive', color: 'orange' };

  const now = new Date();
  const start = getItemStartDate(item);
  if (start && now < start) {
    return { label: 'Scheduled', color: 'orange' };
  }

  const end = getItemExpiryDate(item);
  if (end && now > end) {
    return { label: 'Expired', color: 'red' };
  }

  if (isCurrentlyScheduled(item)) return { label: 'Live', color: 'green' };
  return { label: 'Inactive', color: 'slate' };
}

/**
 * Returns milliseconds until an item expires, or null if permanent.
 */
export function msUntilExpiry(item: ScheduledItem | any): number | null {
  const end = getItemExpiryDate(item);
  if (!end) return null;
  const now = Date.now();
  return Math.max(0, end.getTime() - now);
}

/**
 * Format a countdown into { days, hours, minutes, seconds }
 */
export function formatCountdown(ms: number): {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
} {
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return { days, hours, minutes, seconds };
}
