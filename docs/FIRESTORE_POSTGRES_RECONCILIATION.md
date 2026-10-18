# Olive Pizza — Firestore & PostgreSQL Data Integrity & Reconciliation

**Document Version:** 1.0  
**Context:** Dual-Database Architecture, Order Archival, and Starvation Prevention

---

## 1. Architectural Roles

- **Firestore (Operational Realtime Source):**
  - Authoritative source for all **ACTIVE** orders (`status` in `['pending', 'accepted', 'preparing', 'ready', 'picked_up', 'out_for_delivery']`).
  - Powers realtime listeners in Customer App, Kitchen Display, Delivery App, and Owner live dashboard.
  - Documents remain in Firestore with `lifecycle: 'ACTIVE'` throughout live fulfillment.
- **PostgreSQL (Canonical Permanent Ledger):**
  - Immutable historical source of truth for statutory accounting, GST reports, CA audit, and lifetime analytics.
  - Tables: `canonical_orders`, `canonical_order_items`, `canonical_bills`, `payments`, `order_audit_logs`.
  - Permanent sequential bill numbers (`permanent_bill_no`) allocated atomically via `BillingNumberService`.

---

## 2. Order Terminal Archival & Verification Pipeline

When an order reaches a terminal state (`delivered` or `cancelled`):
1. **Lifecycle Transition:** Mark `lifecycle: 'FINALIZING'` in Firestore.
2. **PostgreSQL Synchronization:** Sync canonical order, line items, and statutory bill row into PostgreSQL inside an atomic transaction.
3. **Strict Verification Check:**
   `verifyPostgresPersistence()` verifies:
   - Order row exists in `canonical_orders` with matching terminal status.
   - Bill row exists in `canonical_bills` with matching total amount.
   - Permanent bill number is a valid positive integer.
   - Line items count in `canonical_order_items` >= 1.
   - Payment status is consistent between order and bill.
4. **Finalization:**
   - Audit log recorded in `order_audit_logs`.
   - Firestore document updated to `lifecycle: 'COMPLETED'` with `permanentBillNo`.
   - Terminal order remains preserved as operational reference.

---

## 3. Archival Worker Starvation Resolution

### Previous Flaw
`reconcileArchivalWorker()` previously queried:
`adminDb.collection('orders').where('status', 'in', ['delivered', 'cancelled']).limit(25).get();`
Because documents retain `status: 'delivered'` in Firestore with `lifecycle: 'COMPLETED'`, every sweep repeatedly returned the first 25 completed orders. This caused worker starvation where newly delivered orders were never processed.

### Implemented Fix
1. **Target Unfinalized Orders:**
   The primary sweep query filters explicitly on unfinalized lifecycles:
   `.where('status', 'in', ['delivered', 'cancelled']).where('lifecycle', 'in', ['ACTIVE', 'PENDING']).limit(50)`
2. **Retry Failed Transitions:**
   A secondary query sweeps orders stuck in transitional states:
   `.where('lifecycle', 'in', ['FINALIZING', 'ARCHIVE_SYNC_FAILED', 'ARCHIVE_VERIFICATION_FAILED']).limit(50)`
3. **Short-Circuit Completed Records:**
   `finalizeAndArchiveTerminalOrder()` immediately returns `{ success: true, alreadyArchived: true }` if `orderData.lifecycle === 'COMPLETED'`, preventing redundant database writes and audit log spam.
