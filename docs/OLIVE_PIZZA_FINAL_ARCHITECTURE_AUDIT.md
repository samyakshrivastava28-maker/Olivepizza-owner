# Olive Pizza — Final Architecture Defect Fix & Audit Report

**Date**: October 4, 2026  
**Auditor**: Lead System Architecture & Security Engineer  
**Scope**: Entire Olive Pizza Ecosystem (7 Connected Systems)

---

## 1. Executive Summary & Architectural Invariants

A comprehensive, zero-assumption audit and engineering remediation was conducted across all seven repositories:
1. `samyakshrivastava28-maker/Olive-Pizza` (Customer Web & Mobile App)
2. `samyakshrivastava28-maker/Olivepizza-owner` (Owner Dashboard & Canonical API / DB)
3. `samyakshrivastava28-maker/olive-pizza-pos` (Restaurant POS & Offline Billing)
4. `samyakshrivastava28-maker/Olive Pizza restaurant manager` (Kitchen & Branch Management)
5. `samyakshrivastava28-maker/olive-pizza-delivery` (Delivery Partner App)
6. `samyakshrivastava28-maker/olive-pizza-franchise` (Franchise Management)
7. `samyakshrivastava28-maker/Olive-Pizza-AI` (AI Intelligence Service)

### Enforced Architectural Authorities

| Subsystem | Canonical Role | Non-Permitted Roles |
| :--- | :--- | :--- |
| **PostgreSQL** | **Authoritative Relational Truth**: Orders, order items, immutable price snapshots, GST/tax calculation, discounts, coupons, payments, refunds, permanent bill numbers (`permanent_bill_seq`), daily order sequence (`Asia/Kolkata`), financial reporting. | Never bypassed for financial transactions. |
| **Firestore** | **Operational Projection & Realtime UI**: Active order delivery projections, staff and branch metadata, user profile data, real-time push state. | Never authoritative for financial totals, bill numbers, or final transaction prices. |
| **Supabase** | **Live GPS Telemetry**: High-frequency rider live locations (`public.delivery_locations`), active order navigation sessions, short-lived breadcrumbs (`public.navigation_points`). | Never used for orders, payments, products, customers, or pricing. |
| **Redis** | **Distributed Acceleration & Coordination**: Distributed mutex locks, cache stampede protection with TTL jitter, distributed AI nonce replay tracking, rate limiting. | Never an authoritative storage mechanism. Gracefully degrades to database when offline. |

---

## 2. Core Defect Remediations & Technical Implementation

### 2.1. Permanent Bill Number & Daily Order Number Authority
- **Finding**: Previously, `BillingNumberService.ts` used Firestore atomic counters with best-effort sync to PostgreSQL.
- **Remediation**:
  - Implemented `PostgresBillingRepository` allocating numbers directly via PostgreSQL sequence `permanent_bill_seq` and stored procedure `get_next_daily_order_number(CURRENT_DATE AT TIME ZONE 'Asia/Kolkata')`.
  - Refactored `BillingNumberService.allocateNumbers()` to execute within PostgreSQL transactions (`withTransaction`), guaranteeing strict concurrency protection.
- **Sequence Semantics**: PostgreSQL sequences provide atomic, concurrent, monotonically increasing 64-bit integers. Monotonic ordering is guaranteed; however, in compliance with ACID standards, rolled-back transactions or crash recovery may produce legal non-sequential gaps. The system guarantees unique, monotonically increasing invoice numbering.

### 2.2. POS Server-Authoritative Catalog Pricing & Delivery Fees
- **Finding**: `POSService.calculateBill` previously trusted client-supplied `item.price` and `req.deliveryFee`.
- **Remediation**:
  - Implemented in-memory catalog lookup cache in `POSService` with a 60-second TTL to eliminate redundant Firestore queries.
  - Implemented `getCatalogItem()` which resolves items across `products`, `menu_items`, and `combos`.
  - Enforced server-authoritative price resolution for base item prices and size variants (`regular`, `medium`, `large`).
  - Enforced server-authoritative addon pricing by validating requested addon IDs against the catalog item's configured addon list.
  - Calculated delivery fee on the server using branch-configured delivery settings (or standard server-side baseline of ₹40), ignoring client-submitted fee values.
  - Updated `/calculate`, `/orders`, and `/bills/sync-offline` routes in `pos.routes.ts` to supply branch context for authoritative delivery calculation.

### 2.3. Resilient POS Offline Sync with Individual Acknowledgment
- **Finding**: `/bills/sync-offline` processed bills in an unhandled batch where a single failure could abort the request, and the POS client wiped the entire local queue upon HTTP 200 without per-bill acknowledgment.
- **Remediation**:
  - Wrapped each bill in `/bills/sync-offline` in an isolated `try/catch` block.
  - Returned structured per-bill results: `[{ idempotencyKey, orderId, permanentBillNo, status, success, duplicate, error }]`.
  - Updated `OfflineBillingQueueService.ts` on the POS client to filter out and remove **only** successfully confirmed (`SYNCED` or `ALREADY_SYNCED`) bills from `localStorage`.
  - Marked individual confirmed bills as synced in IndexedDB (`PosIndexedDbService.markBillSynced`).
  - Retained failed or unacknowledged bills in the queue for automatic retry on the next sync cycle.

### 2.4. Elimination of Direct Client Firestore Order Writes
- **Finding**:
  - `olive-pizza-owner/src/pages/LiveOrders.tsx` directly called `updateDoc(doc(db, 'orders', orderId))` for status updates, rider assignments, and cancellations.
  - `olive-pizza/frontend/src/pages/OrderTracking.tsx` directly called `updateDoc` for order ratings and delivery partner performance metrics.
- **Remediation**:
  - Refactored `LiveOrders.tsx` to route all status changes to `POST /api/orders/:id/status`, manual rider assignment to `POST /api/orders/:id/assign-rider`, and cancellations to `POST /api/orders/:id/status` via `fetchApi`.
  - Updated `order.routes.ts` authorization to permit `owner`, `admin`, and authorized master accounts (`webhub2811@gmail.com`, `olivepizzarjn@gmail.com`) to execute operational mutations and dispatch riders.
  - Updated `OrderTracking.tsx` to submit ratings via `POST /api/orders/:id/rating`.
  - Added atomic server-side Firestore transaction in `POST /:id/rating` to increment delivery partner metrics (`ratingSum`, `ratingCount`, `averageRating`) safely on the backend.
  - Removed all direct `updateDoc` calls to the `orders` collection across both customer and owner frontends.

### 2.5. Elimination of Duplicate Live GPS Writes & Unified Supabase Telemetry
- **Finding**: Delivery routes duplicated rider coordinates into both Supabase `public.delivery_locations` and Firestore `active_deliveries`.
- **Remediation**:
  - Removed duplicate writes to Firestore `active_deliveries` from `delivery.routes.ts`, `riderDelivery.routes.ts`, and `tracking.routes.ts`.
  - Added `getLatestLocationByOrder(orderId)` to `SupabaseGpsService.ts`.
  - Updated `GET /api/delivery/orders/:id/track` to read directly from authoritative Supabase telemetry via `SupabaseGpsService.getLatestLocationByOrder()`.

### 2.6. Cache Stampede Protection (Mutex + TTL Jitter + Polling Backoff)
- **Finding**: High-volume cache entries (menu, store status, franchise metadata) lacked protection against simultaneous database spikes upon TTL expiry (thundering herd problem).
- **Remediation**:
  - Implemented `fetchWithStampedeProtection<T>` in `RedisService.ts`.
  - Utilizes distributed mutex lock (`lock:stampede:${cacheKey}`) to ensure only a single worker refreshes the cache on miss.
  - Injected random TTL jitter (e.g. base TTL + random 0–30s) to prevent concurrent bulk expirations.
  - Implemented exponential backoff polling for concurrent request threads waiting for the lock holder to repopulate the cache.
  - Integrated `fetchWithStampedeProtection` into `getMenu`, `getStoreStatus`, and `getFranchiseMetadata`.

### 2.7. Multi-Server Distributed AI Replay Protection
- **Finding**: AI Gateway HMAC verification checked a 2-minute timestamp window but lacked atomic nonce tracking, exposing it to distributed replay attacks within the validity window.
- **Remediation**:
  - Added distributed nonce locking via Redis in `requireAISignature` (`aiIntegration.routes.ts`).
  - Atomically locks `ai:nonce:${nonce}` with a 180-second TTL using Redis `NX` (Set if Not Exists).
  - Rejects replayed requests with `401 AI_GATEWAY_UNAUTHORIZED: Replay attack detected or duplicate request`.

---

## 3. Verification & Build Audit

All modified code was built and verified using production toolchains:

1. **`olive-pizza-owner/backend`**:
   - `npm run build` (`tsc`) executed successfully with exit code 0.
2. **`olive-pizza-owner` (Frontend)**:
   - `npm run build` (`vite build`) executed successfully with exit code 0 (all modules transformed, assets bundled).
3. **`olive-pizza` (Customer App)**:
   - `npm run build` (`vite build`) executed successfully with exit code 0 (3092 modules transformed).
4. **`olive-pizza-pos` (POS App)**:
   - `npm run build` (`tsc && vite build`) executed successfully with exit code 0 (1672 modules transformed).
5. **Operational Verification**:
   - Full regression search confirmed zero remaining direct writes to `orders` collection across customer and owner frontends.
   - Confirmed zero active operational reads/writes to legacy `active_deliveries` collection in backend routes.

---

## 4. Conclusion & Ongoing Maintenance

The Olive Pizza ecosystem enforces clean separation of concerns:
- **Financial & Relational Truth**: PostgreSQL.
- **Live GPS Realtime**: Supabase.
- **Operational UI State**: Firestore.
- **Distributed Caching & Coordination**: Redis.

Future feature development must maintain these boundaries and route all business mutations through the canonical backend API.
