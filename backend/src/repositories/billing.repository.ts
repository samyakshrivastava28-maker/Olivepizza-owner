import { adminDb } from '../config/firebase.js';

export interface PermanentBillRecord {
  permanentBillNumber: number;
  billFormattedNumber: string;
  orderId: string;
  source: 'ONLINE' | 'POS';
  franchiseId: string;
  branchId: string;
  terminalId?: string;
  totalAmount: number;
  paymentMethod: string;
  paymentStatus: string;
  createdAt: string;
}

export interface IBillingRepository {
  allocateNextBillNumbers(date?: Date): Promise<{
    permanentBillNo: number;
    dailyOrderNo: number;
    orderDate: string;
    orderTime: string;
  }>;
  saveBill(record: PermanentBillRecord): Promise<void>;
  findByPermanentNumber(billNumber: number): Promise<PermanentBillRecord | null>;
  findByOrderId(orderId: string): Promise<PermanentBillRecord | null>;
  getCurrentSequenceStatus(): Promise<{
    lastPermanentBillNo: number;
    todayDailyCount: number;
    todayDate: string;
  }>;
}

export class FirestoreBillingRepository implements IBillingRepository {
  private static RESTAURANT_TIMEZONE = 'Asia/Kolkata';

  private getLocalDateString(date: Date = new Date()): string {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: FirestoreBillingRepository.RESTAURANT_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(date);
  }

  private getLocalTimeString(date: Date = new Date()): string {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: FirestoreBillingRepository.RESTAURANT_TIMEZONE,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).format(date);
  }

  /**
   * Atomically allocates the next Permanent Bill Number and Daily Order Number
   * using a Firestore atomic transaction against counter documents.
   * Guaranteed concurrency-safe with zero duplicate sequence numbers.
   */
  async allocateNextBillNumbers(date: Date = new Date()): Promise<{
    permanentBillNo: number;
    dailyOrderNo: number;
    orderDate: string;
    orderTime: string;
  }> {
    const orderDate = this.getLocalDateString(date);
    const orderTime = this.getLocalTimeString(date);

    const permCounterRef = adminDb.collection('counters').doc('permanent_billing');
    const dailyCounterRef = adminDb.collection('counters').doc('dailyOrders');

    const result = await adminDb.runTransaction(async (t) => {
      // 1. Permanent Bill Number (monotonic, never resets)
      const permSnap = await t.get(permCounterRef);
      const permData = permSnap.exists ? permSnap.data()! : { currentCount: 0 };
      const nextPermNo = (permData.currentCount as number) + 1;
      t.set(permCounterRef, {
        currentCount: nextPermNo,
        lastAllocatedAt: new Date().toISOString()
      }, { merge: true });

      // 2. Daily Order Number (resets daily at midnight IST)
      const dailySnap = await t.get(dailyCounterRef);
      const dailyData = dailySnap.exists ? dailySnap.data()! : { date: orderDate, count: 0 };
      const nextDailyNo = dailyData.date === orderDate ? (dailyData.count as number) + 1 : 1;
      t.set(dailyCounterRef, {
        date: orderDate,
        count: nextDailyNo,
        lastAllocatedAt: new Date().toISOString()
      }, { merge: true });

      return {
        permanentBillNo: nextPermNo,
        dailyOrderNo: nextDailyNo
      };
    });

    return {
      permanentBillNo: result.permanentBillNo,
      dailyOrderNo: result.dailyOrderNo,
      orderDate,
      orderTime
    };
  }

  async saveBill(record: PermanentBillRecord): Promise<void> {
    const billDocRef = adminDb.collection('bills').doc(`bill_${record.permanentBillNumber}`);
    await billDocRef.set({
      ...record,
      updatedAt: new Date().toISOString()
    });
  }

  async findByPermanentNumber(billNumber: number): Promise<PermanentBillRecord | null> {
    const doc = await adminDb.collection('bills').doc(`bill_${billNumber}`).get();
    if (!doc.exists) return null;
    return doc.data() as PermanentBillRecord;
  }

  async findByOrderId(orderId: string): Promise<PermanentBillRecord | null> {
    const snap = await adminDb.collection('bills').where('orderId', '==', orderId).limit(1).get();
    if (snap.empty) return null;
    return snap.docs[0].data() as PermanentBillRecord;
  }

  async getCurrentSequenceStatus(): Promise<{
    lastPermanentBillNo: number;
    todayDailyCount: number;
    todayDate: string;
  }> {
    const today = this.getLocalDateString();
    const permSnap = await adminDb.collection('counters').doc('permanent_billing').get();
    const dailySnap = await adminDb.collection('counters').doc('dailyOrders').get();

    const permData = permSnap.exists ? permSnap.data()! : { currentCount: 0 };
    const dailyData = dailySnap.exists ? dailySnap.data()! : { date: today, count: 0 };

    return {
      lastPermanentBillNo: permData.currentCount || 0,
      todayDailyCount: dailyData.date === today ? (dailyData.count || 0) : 0,
      todayDate: today
    };
  }
}

export class InMemoryBillingRepository implements IBillingRepository {
  private static RESTAURANT_TIMEZONE = 'Asia/Kolkata';
  private permanentCount = 0;
  private dailyOrders: { date: string; count: number } = { date: '', count: 0 };
  private bills = new Map<number, PermanentBillRecord>();
  private lockPromise: Promise<void> = Promise.resolve();

  private getLocalDateString(date: Date = new Date()): string {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: InMemoryBillingRepository.RESTAURANT_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(date);
  }

  private getLocalTimeString(date: Date = new Date()): string {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: InMemoryBillingRepository.RESTAURANT_TIMEZONE,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).format(date);
  }

  private async acquireLock(): Promise<() => void> {
    let releaseLock: () => void = () => {};
    const nextLock = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });
    const currentLock = this.lockPromise;
    this.lockPromise = currentLock.then(() => nextLock);
    await currentLock;
    return releaseLock;
  }

  async allocateNextBillNumbers(date: Date = new Date()): Promise<{
    permanentBillNo: number;
    dailyOrderNo: number;
    orderDate: string;
    orderTime: string;
  }> {
    const release = await this.acquireLock();
    try {
      const orderDate = this.getLocalDateString(date);
      const orderTime = this.getLocalTimeString(date);

      this.permanentCount += 1;
      const permanentBillNo = this.permanentCount;

      if (this.dailyOrders.date === orderDate) {
        this.dailyOrders.count += 1;
      } else {
        this.dailyOrders = { date: orderDate, count: 1 };
      }
      const dailyOrderNo = this.dailyOrders.count;

      return {
        permanentBillNo,
        dailyOrderNo,
        orderDate,
        orderTime
      };
    } finally {
      release();
    }
  }

  async saveBill(record: PermanentBillRecord): Promise<void> {
    const release = await this.acquireLock();
    try {
      this.bills.set(record.permanentBillNumber, { ...record });
    } finally {
      release();
    }
  }

  async findByPermanentNumber(billNumber: number): Promise<PermanentBillRecord | null> {
    return this.bills.get(billNumber) || null;
  }

  async findByOrderId(orderId: string): Promise<PermanentBillRecord | null> {
    for (const bill of this.bills.values()) {
      if (bill.orderId === orderId) return bill;
    }
    return null;
  }

  async getCurrentSequenceStatus(): Promise<{
    lastPermanentBillNo: number;
    todayDailyCount: number;
    todayDate: string;
  }> {
    const today = this.getLocalDateString();
    return {
      lastPermanentBillNo: this.permanentCount,
      todayDailyCount: this.dailyOrders.date === today ? this.dailyOrders.count : 0,
      todayDate: today
    };
  }
}

export const billingRepository: IBillingRepository = new FirestoreBillingRepository();

