# Olive Pizza — Redis Caching & Rate-Limiting Audit

**Document Version:** 1.0  
**Context:** Layerbase Redis Connection, Key TTLs, and Custom PDF Rate-Limiter

---

## 1. Redis Cluster & Connection Architecture

- **Engine:** Layerbase Redis instance configured via `REDIS_URL` in `backend/src/config/redis.ts`.
- **Failure Resilience:** Non-blocking fallback to direct database queries if Redis is temporarily unreachable.
- **Connection Health:** Monitored on server startup with automatic reconnection.

---

## 2. Cached Endpoints & TTL Matrix

| Key / Pattern | Endpoint | TTL | Purpose |
| :--- | :--- | :--- | :--- |
| `cache:menu:master` | `GET /api/menu/master-catalog` | 300s (5m) | Master product catalog, crusts, variants, prices |
| `cache:menu:branch:{branchId}` | `GET /api/menu/branch/:branchId` | 300s (5m) | Branch-specific availability & 86 items |
| `cache:bootstrap:home` | `GET /api/bootstrap/home/bootstrap` | 180s (3m) | Home screen banners, active categories, featured |
| `cache:bootstrap:menu` | `GET /api/bootstrap/menu/bootstrap` | 300s (5m) | Initial menu state for rapid customer cold start |
| `cache:bootstrap:cart` | `GET /api/bootstrap/cart/bootstrap` | 180s (3m) | Delivery fees, packaging, tax configuration |
| `cache:coupons:active` | `GET /api/coupons` | 120s (2m) | Active promo codes and discount rules |
| `cache:restaurant:status:{branchId}` | `GET /api/restaurant/status` | 60s (1m) | Open/closed status, accept orders toggle |
| `cache:config:{appName}` | `GET /api/config/:appName` | 600s (10m) | Client app configuration & feature flags |

---

## 3. Invalidation Events

- **Menu Mutation:** When an item is added, updated, or 86'd in Owner or Restaurant apps, `cache:menu:master` and `cache:menu:branch:{branchId}` are invalidated immediately.
- **Coupon Mutation:** Updating discounts purges `cache:coupons:active`.
- **Branch Status Toggle:** In-memory and Redis keys for `cache:restaurant:status:{branchId}` are cleared on change.

---

## 4. Restaurant Custom Report Rate-Limiter

- **Key:** `ratelimit:pdf:custom:branch:{branchId}`
- **TTL:** 3600s (1 hour rolling window)
- **Rules:**
  - **Owner (`role === 'OWNER'`):** Unlimited downloads; bypasses rate-limiter completely.
  - **Restaurant Manager:** Maximum 2 custom PDFs per branch per hour.
  - **Enforcement:** If limit exceeded, endpoint returns HTTP 429 `{ error: "Hourly custom PDF limit reached (2 PDFs/hr). Next PDF download available in XX minutes." }`.
  - **Quota Endpoint:** `GET /api/reports/quota?branchId=...` returns `{ remaining: number, limit: 2, resetInSeconds: number }` to display live quota badges in the Restaurant Manager UI.
