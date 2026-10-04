# OLIVE PIZZA — REDIS ARCHITECTURE & DISTRIBUTED COORDINATION

**Classification**: Architectural Authority Document  
**Status**: Certified & Implemented  
**Date**: October 4, 2026  

---

## 1. Role: Ultra-Fast Cache & Distributed Coordination Layer

Redis is the high-performance temporary memory and distributed synchronization layer. It is NOT the permanent database.

### Primary Responsibilities:
1. **Catalog & Pricing Cache**: Sub-millisecond reads for product listings, variant prices, and menu configurations.
2. **Distributed Locks**: Redlock mutexes for checkout sessions, webhook handlers, and bill creation.
3. **Idempotency Keys**: Request deduplication with SHA-256 payload fingerprinting and 24-hour TTL.
4. **Rate Limiting**: Distributed sliding-window limiters protecting authentication, payment creation, and SMS dispatch.
5. **Replay Protection**: Cryptographic token nonces ensuring gateway webhooks cannot be processed twice.
6. **Cache Stampede Protection**: Distributed mutex locks ensuring only one concurrent request queries PostgreSQL during a cache miss.

---

## 2. Product & Price Cache Invalidation Pipeline

When an owner or restaurant manager updates a product price (e.g. ₹299 → ₹349):

```text
1. Owner updates price in Owner Dashboard
                 │
                 ▼
2. Backend writes new price to PostgreSQL products table (Authoritative)
                 │
                 ▼
3. Backend immediately evicts / updates Redis key:
   DEL catalog:branch:<branchId>:products
   DEL product:item:<productId>
                 │
                 ▼
4. Backend updates Firestore operational projection for instant customer UI reactive refresh
                 │
                 ▼
5. Applications fetch updated price on next query;
   First query repopulates Redis from authoritative PostgreSQL
```

> **NEVER TRUST CLIENT-SUPPLIED PRICE**: Even if a stale client submits an order with the old ₹299 price, the backend calculates totals using the authoritative catalog price (₹349) resolved from Redis/PostgreSQL. The client-supplied `item.price` is strictly ignored.

---

## 3. Distributed Cache Stampede Protection

When hundreds of concurrent requests arrive simultaneously after a cache eviction or cold start:

```text
1000 Concurrent Requests arrive for Menu
                 │
                 ▼
Check Redis Cache: MISS
                 │
                 ▼
Acquire Distributed Lock in Redis:
SET lock:catalog:branch:main_branch <uuid> NX PX 5000
                 │
   ┌─────────────┴─────────────┐
   ▼                           ▼
[Lock ACQUIRED (1 Request)]  [Lock BUSY (999 Requests)]
   │                           │
   ▼                           ▼
Query PostgreSQL              Wait 50ms & poll Redis cache
   │                           │
Populate Redis with TTL       Cache populated!
   │                           │
Release Lock                   Return cached result
   │                           │
   └─────────────┬─────────────┘
                 ▼
All 1000 requests served, exactly 1 PostgreSQL query executed!
```

* Multi-server safe: Works seamlessly across any number of clustered backend instances.
* Bounded timeout: If the lock holder fails, the lock automatically expires in 5000ms.

---

## 4. Distributed Request Idempotency

* **Endpoint**: `/api/payments/create-intent`
* **Mechanism**: The incoming request computes a SHA-256 hash of its semantic payload:
  `sha256(userId + items + deliveryAddress + paymentMethod + couponCode + branchId)`
* **Redis Key**: `idempotency:pay_intent:<key>` with 24-hour TTL.
* **Exact Duplicate**: Returns cached intent with `idempotentReplay: true`.
* **Mismatched Payload with Same Key**: Rejects with HTTP 409 Conflict.

---

## 5. Fail-Closed Behavior

If Redis is temporarily unavailable:
* Critical locks (payments, webhook settlement) **fail closed** to prevent double-charging or ledger collisions.
* Catalog reads fall back to direct PostgreSQL queries with connection pool bounding.
