# OLIVE PIZZA — FIRESTORE REALTIME & OPERATIONAL LAYER ARCHITECTURE

**Classification**: Architectural Authority Document  
**Status**: Certified & Implemented  
**Date**: October 4, 2026  

---

## 1. Role: Realtime Operational Projection Layer

Firestore serves as the **realtime UI update and operational projection engine**. It is NOT the permanent financial or business authority.

### Key Distinction:
* **PostgreSQL**: Records what actually happened (permanent audit ledger).
* **Firestore**: Displays what the applications should see right now (instant reactive state).

If Firestore documents were deleted or corrupted, all operational projections can be re-projected directly from PostgreSQL records.

---

## 2. The Canonical Order Model

```text
1. Customer / POS places order
          │
          ▼
2. Node.js Backend validates request
   (Resolves authoritative catalog prices, calculates 5% GST, applies coupon rules)
          │
          ▼
3. PostgreSQL creates canonical permanent order
   (Stores order, order_items, bill_number, payment record in an ACID transaction)
          │
          ▼
4. Backend writes Realtime Operational Projection to Firestore
   (`orders` collection receives projection with current status e.g. "pending")
          │
          ▼
5. Applications react to Firestore Projection
   (Kitchen Display System, Restaurant Manager, Customer Tracking, POS Terminal)
          │
          ▼
6. Order progresses through OrderStateMachine
   (pending → accepted → preparing → ready → out_for_delivery → delivered)
          │
          ▼
7. Order is Delivered / Cancelled
   (PostgreSQL retains full permanent ledger; Firestore projection is pruned or marked historical)
```

> **CRITICAL RULE**: Orders NEVER start as "Firestore only" and wait until completion to reach PostgreSQL. This prevents catastrophic data loss if a client crashes or network drops.

---

## 3. Zero Direct Client Mutations Rule

Arbitrary frontend clients are **strictly forbidden** from directly modifying critical business documents in Firestore.

### Enforced Prohibitions:
* No frontend app calls `updateDoc(doc(db, 'orders', ...))`
* No frontend app calls `setDoc(doc(db, 'orders', ...))`
* No frontend app calls `deleteDoc(doc(db, 'orders', ...))`

### Verification:
Codebase-wide audit across all 6 frontend applications confirmed **zero instances** of client-side direct writes to the `orders` collection:
* `Olive-Pizza` (Customer App): Verified 0 direct writes.
* `Olive Pizza restaurant manager` (Restaurant App): Verified 0 direct writes.
* `olive-pizza-delivery` (Rider App): Verified 0 direct writes.
* `olive-pizza-pos` (POS Terminal): Verified 0 direct writes.
* `olive-pizza-franchise` (Franchise App): Verified 0 direct writes.
* `olive-pizza-owner/frontend` (Owner App): Verified 0 direct writes.

All order status transitions (e.g. accepting, dispatching, delivering, cancelling) route exclusively through the backend endpoint:
```typescript
POST /api/orders/:id/status
POST /api/delivery/orders/:id/assign-partner
POST /api/orders/create
```
which in turn executes `OrderStateMachine.transition()` on the server.

---

## 4. Firestore Operational Cleanup & Lifecycle

Temporary operational collections are pruned once their workflow is complete:
1. **Active Order Projections**: Orders in terminal states (`delivered`, `cancelled`, `rejected`) older than 24 hours are removed from the active operational queue or marked as archived.
2. **Notification Queues**: Temporary notification and push message tokens in `notification_queue` are purged after acknowledgement.
3. **Owner Alerts**: Transient radius and stock alerts in `owner_alerts` are acknowledged and auto-expired after 7 days.

**Inviolable Guarantee**: Business history in PostgreSQL is **never deleted** when cleaning Firestore space.
