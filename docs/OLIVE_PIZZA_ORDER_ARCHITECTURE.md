# Olive Pizza — Canonical Order Architecture & State Machine

## 1. Core Principles & Authority

The order processing pipeline in Olive Pizza is built upon strict financial and operational boundaries:

1. **PostgreSQL is Canonical**: Every order must be authoritatively created and committed in PostgreSQL before any operational projections are dispatched. If PostgreSQL fails, the entire transaction rolls back fail-closed.
2. **Server-Authoritative Pricing**: The client submits item identifiers (`productId`, `variantId`, `addonIds`) and quantities. The backend resolves authoritative prices from PostgreSQL/Redis catalog cache. Client-submitted prices, subtotals, and totals are ignored for calculation.
3. **Zero Client Firestore Writes**: All customer, restaurant, delivery, and POS clients are strictly forbidden from executing `updateDoc`, `setDoc`, or `deleteDoc` on the `orders` collection in Firestore. All status mutations must pass through authenticated backend endpoints.
4. **Firestore is an Ephemeral Projection**: Firestore holds operational projections of active orders for low-latency realtime UI updates. Once an order reaches a terminal state (`DELIVERED` or `CANCELLED`), its Firestore projection is purged.

---

## 2. Order Creation Flow (Fail-Closed)

```
[ Client Request ]
  POST /api/orders
  Payload: { branchId, items: [{ productId, variantId, quantity, addonIds }], deliveryAddress, idempotencyKey }
        |
        v
[ Idempotency & Rate Limit Middleware ]
  - Checks Redis for cached response under idempotencyKey
  - Acquires distributed lock
        |
        v
[ CanonicalOrderService.createCanonicalOrder() ]
  1. BEGIN PostgreSQL Transaction (SERIALIZABLE or READ COMMITTED with row locks)
  2. Resolve Items & Pricing from Catalog:
     - Fetch active Product & Variant records from DB
     - Calculate base subtotal, addon costs, discounts, and taxes (GST)
     - Validate delivery zone & compute authoritative delivery fee
  3. Generate Immutable Identifiers:
     - Bill number from PostgreSQL sequence: nextval('bill_number_seq')
     - Daily order sequence: nextval('daily_order_seq_<branchId>_<date>')
  4. INSERT into orders & order_items in PostgreSQL
  5. COMMIT Transaction
        |
        | (Transaction succeeds)
        v
[ Realtime Operational Projection ]
  - Dispatch syncOrderToFirestore(orderId, canonicalOrderData)
  - Write projection document to Firestore /orders/{orderId}
  - Invalidate user active orders cache in Redis
  - Broadcast notification event to Kitchen Display & Restaurant Manager
        |
        v
[ Response to Client: 201 Created with Canonical Data ]
```

---

## 3. Order State Machine

Order state transitions follow an immutable, role-enforced directed acyclic graph (DAG):

```
       +-----------------------+
       |        PLACED         |  <-- Initial state on checkout
       +-----------------------+
                   |
                   | RESTAURANT_MANAGER / SYSTEM (payment confirmed)
                   v
       +-----------------------+
       |       CONFIRMED       |
       +-----------------------+
                   |
                   | KITCHEN / RESTAURANT_MANAGER
                   v
       +-----------------------+
       |       PREPARING       |
       +-----------------------+
                   |
                   | KITCHEN
                   v
       +-----------------------+
       |   READY_FOR_PICKUP    |
       +-----------------------+
                   |
                   | DELIVERY_PARTNER (Rider accepts & picks up)
                   v
       +-----------------------+
       |   OUT_FOR_DELIVERY    |
       +-----------------------+
                   |
                   | DELIVERY_PARTNER (OTP / signature verification)
                   v
       +-----------------------+
       |       DELIVERED       |  <-- Terminal State (Projection Purged)
       +-----------------------+

* Cancellation Transitions:
  - PLACED -> CANCELLED (Customer / System)
  - CONFIRMED -> CANCELLED (Restaurant Manager)
  - PREPARING -> CANCELLED (Restaurant Manager with supervisor override)
```

### Transition Authority Table

| From State | To State | Permitted Roles | Actions Triggered |
| :--- | :--- | :--- | :--- |
| `PLACED` | `CONFIRMED` | `RESTAURANT_MANAGER`, `OWNER`, `SYSTEM` | Notify Kitchen, generate KOT |
| `CONFIRMED` | `PREPARING` | `KITCHEN`, `RESTAURANT_MANAGER` | Update KDS display timer |
| `PREPARING` | `READY_FOR_PICKUP` | `KITCHEN`, `RESTAURANT_MANAGER` | Dispatch rider broadcast, notify customer |
| `READY_FOR_PICKUP` | `OUT_FOR_DELIVERY` | `DELIVERY_PARTNER` | Assign `active_order_id` in Supabase GPS |
| `OUT_FOR_DELIVERY` | `DELIVERED` | `DELIVERY_PARTNER`, `RESTAURANT_MANAGER` | Clear Supabase `active_order_id`, archive PG, purge Firestore projection |
| `ANY_NON_TERMINAL` | `CANCELLED` | `OWNER`, `RESTAURANT_MANAGER`, `SYSTEM` | Initiate refund, clear assignments, purge Firestore projection |

---

## 4. Projection Synchronization & Cleanup Policy

- **Synchronous vs Asynchronous Handling**: The backend updates PostgreSQL first. Following successful commit, `syncOrderToFirestore()` writes the updated state to Firestore.
- **Terminal State Cleanup**: When transitioning to `DELIVERED` or `CANCELLED`:
  1. PostgreSQL records the terminal state, timestamps, and payment reconciliation.
  2. `removeFirestoreOrderProjection(orderId)` schedules a deletion of `/orders/{orderId}` from Firestore.
  3. Realtime UI listeners cleanly detach as the order moves into historical view.
- **Historical Orders**: Completed orders are queried via backend REST API (`GET /api/orders/history`), backed directly by PostgreSQL indexed by `user_id` and `created_at`.
