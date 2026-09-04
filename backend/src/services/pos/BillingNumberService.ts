/**
 * BillingNumberService.ts — Authoritative PostgreSQL Bill & Order Numbering Engine
 * 
 * CORE ARCHITECTURAL INVARIANTS:
 * 1. PERMANENT BILL NUMBER:
 *    - Starts at #1, continues forever, NEVER resets, NEVER contains date, NEVER reused.
 *    - Generated via PostgreSQL sequence `nextval('permanent_bill_seq')`.
 *    - Guaranteed atomic and safe under concurrent order placement.
 *    - Shared by both physical POS orders and online Olive Pizza customer app orders.
 * 
 * 2. DAILY ORDER NUMBER:
 *    - Resets every calendar day at midnight IST (Asia/Kolkata).
 *    - Starts at #1 each day: e.g. 04 Sep: #1, #2... 05 Sep: #1, #2...
 *    - Generated via PostgreSQL atomic function `get_next_daily_order_number(date)`.
 *    - Independent from the permanent bill number.
 */

import { query, withTransaction } from '../../config/postgres.js';

export interface AllocatedBillNumbers {
  permanentBillNo: number;
  dailyOrderNo: number;
  orderDate: string; // 'YYYY-MM-DD' in Asia/Kolkata
  orderTime: string; // 'HH:mm:ss' in Asia/Kolkata
}

export class BillingNumberService {
  /**
   * Returns current Indian Standard Time (IST) calendar date string 'YYYY-MM-DD'.
   */
  public static getLocalDateString(date: Date = new Date()): string {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(date);
  }

  /**
   * Returns current Indian Standard Time (IST) time string 'HH:mm:ss'.
   */
  public static getLocalTimeString(date: Date = new Date()): string {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).format(date);
  }

  /**
   * Atomically acquires the next Permanent Bill Number and Daily Order Number
   * directly from PostgreSQL sequence and atomic counter.
   */
  public static async allocateNumbers(date: Date = new Date()): Promise<AllocatedBillNumbers> {
    const orderDate = this.getLocalDateString(date);
    const orderTime = this.getLocalTimeString(date);

    return await withTransaction(async (client) => {
      // 1. Nextval on PostgreSQL permanent sequence
      const seqRes = await client.query(`SELECT nextval('permanent_bill_seq') AS bill_no;`);
      const permanentBillNo = parseInt(seqRes.rows[0].bill_no, 10);

      // 2. Atomic daily order counter in IST
      const dailyRes = await client.query(
        `SELECT get_next_daily_order_number($1::date) AS daily_no;`,
        [orderDate]
      );
      const dailyOrderNo = parseInt(dailyRes.rows[0].daily_no, 10);

      return {
        permanentBillNo,
        dailyOrderNo,
        orderDate,
        orderTime
      };
    });
  }

  /**
   * Checks current sequence value without advancing it (for telemetry / health)
   */
  public static async getCurrentSequenceStatus(): Promise<{
    lastPermanentBillNo: number;
    todayDailyCount: number;
    todayDate: string;
  }> {
    const today = this.getLocalDateString();
    const seqRes = await query(`SELECT last_value, is_called FROM permanent_bill_seq;`).catch(() => ({ rows: [] }));
    const dailyRes = await query(
      `SELECT current_number FROM daily_order_counters WHERE counter_date = $1;`,
      [today]
    ).catch(() => ({ rows: [] }));

    const lastVal = seqRes.rows[0] ? (seqRes.rows[0].is_called ? parseInt(seqRes.rows[0].last_value, 10) : 0) : 0;
    const dailyCount = dailyRes.rows[0] ? parseInt(dailyRes.rows[0].current_number, 10) : 0;

    return {
      lastPermanentBillNo: lastVal,
      todayDailyCount: dailyCount,
      todayDate: today
    };
  }
}
