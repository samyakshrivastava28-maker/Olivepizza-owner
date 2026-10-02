# 🍕 Olive Pizza — Canonical Database Source-of-Truth & Architecture Matrix

> **Final Cross-Repository Architecture Cleanup Standard**  
> Enforced across `Olive-Pizza`, `Olivepizza-owner`, `olive-pizza-franchise`, `olive-pizza-restaurant`, `olive-pizza-delivery`, and `olive-pizza-pos`.

---

## 1. High-Level Architecture Topology

```text
                             [ CLIENT APPLICATIONS ]
   Customer App     Owner Console     Franchise App     Restaurant KDS     Delivery Rider     POS Terminal
   (Web/Capacitor)   (React Admin)      (Franchise)       (Kitchen)       (Capacitor Rider)   (Billing App)
         │                 │                 │                │                  │                 │
         └─────────────────┴─────────────────┼────────────────┴──────────────────┴─────────────────┘
                                             │  (Strict Token Auth & Role Scope)
                                             ▼
                          [ CANONICAL NODE.JS / EXPRESS BACKEND ]
                          (backend in samyakshrivastava28-maker/Olivepizza-owner)
                                             │
      ┌──────────────────────┬───────────────┴──────────────┬──────────────────────┐
      ▼                      ▼                              ▼                      ▼
[ FIREBASE AUTH & FIRESTORE ] [ MAIN / VPS POSTGRESQL ]   [ REDIS CACHE & LOCKS ] [ CLOUDINARY MEDIA ]
 • Users & RBAC claims        • Billing & Pos Transactions  • Fast short-term cache  • Product & Combo images
 • Products, Combos, Menu     • Invoices & Tax Audit Records• Distributed mutex     • Category banners
 • Realtime Orders & States   • Payment Webhooks & Logs    • Rate limiting buckets  • User avatars
 • Coupons & Promotions       • Ephemeral Rider Breadcrumbs • Invalidation pub/sub
 • App Settings & Versions    • (Render = Testing/Staging)
 • Telemetry & Security Logs

                                      │
                                      ▼
                        [ SUPABASE POSTGRESQL & REALTIME ]
                     ── STRICTLY DELIVERY RIDER LIVE GPS ONLY ──
           • Public Table: `delivery_locations` (latest rider latitude & longitude)
           • Public Table: `navigation_points` (5-minute rolling breadcrumb trajectory)
           • Supabase Realtime Channels: Live 3D rider tracking in Customer & Owner Apps
           • FORBIDDEN: Products, Orders, Users, Coupons, Pricing, Settings, General Auth.
```

---

## 2. Mandatory Database Source-of-Truth Matrix

| Data Domain | Authoritative Source | Testing / Staging | Future Production Target | Read Path | Write Path | Cache / Realtime Strategy |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Authentication & RBAC** | **Firebase Auth** | Firebase Emulator / Staging Project | Firebase Auth (Custom Tokens / Claims) | Client SDK / Firebase Admin SDK | Client Auth flow & Admin SDK | Token claims cached client-side; validated server-side on each request |
| **Customer Profiles** | **Firestore** (`users`) | Firestore Staging | Firestore / Main PostgreSQL | `GET /api/users/profile` (Firestore) | `PUT /api/users/profile` (Firestore) | Redis profile cache (5m TTL), invalidated on update |
| **Menu, Products, Combos**| **Firestore** (`products`, `menu_items`, `combos`) | Firestore Staging | Firestore (Synced to PostgreSQL catalog) | `GET /api/products`, `GET /api/combos` | Owner/Manager Backoffice API | In-memory / Redis cache; client reads public collections with offline persistence |
| **Active & Historical Orders**| **Firestore** (`orders`) & **PostgreSQL** (`canonical_orders`) | Dual-Write / Sync | Dual-Write / Sync | `GET /api/orders` | `POST /api/orders` (Atomic Firestore + Pos PG) | Firestore `onSnapshot` for live status changes; Redis locks on order creation |
| **POS Billing & Invoicing**| **PostgreSQL** (`canonical_orders`, `billing_invoices`) | Render PostgreSQL | VPS PostgreSQL | `GET /api/pos/orders` (PG Query) | `POST /api/pos/orders` (ACID Transaction) | Redis sequence cache for daily invoice numbers (`dailyOrderNumber`) |
| **Coupons & Discounts** | **Firestore** (`coupons`) | Firestore Staging | Firestore | `GET /api/coupons` | Admin Backoffice / `POST /api/orders` (Atomic Tx) | Atomic Firestore Transaction (`usageCount < usageLimit`); no race conditions |
| **App Settings & Versions** | **Firestore** (`settings/app_update`, `app_versions`)| Firestore Staging | Firestore | `GET /api/version/settings` | `POST /api/version/publish` (Admin only) | In-memory 30s TTL cache in `versionCheck` middleware |
| **Rider Live GPS Tracking** | **Supabase PostgreSQL** (`delivery_locations`)| Supabase Dedicated Project | Supabase Dedicated Project | Supabase Realtime / `GET /api/location/rider` | Capacitor GPS Watcher / Heartbeat via Backend | Supabase Realtime WebSockets (`supabase_realtime` publication, 5m prune) |
| **Telemetry & Error Logs** | **Firestore** (`client_errors`, `activity_logs`) | Firestore Staging | Firestore | Developer Console | Client SDK (Bounded <12 keys payload) | Ingested with strict schema and size constraints; read by developers |
| **Media & Static Assets** | **Cloudinary** | Cloudinary Staging Folder | Cloudinary CDN | CDN URLs (`res.cloudinary.com`) | Server upload endpoint (`POST /api/upload`) | Global Cloudinary CDN edge caching |

---

## 3. Strict Supabase GPS Isolation Rules

1. **Dedicated Scope**: Supabase PostgreSQL is strictly isolated to high-velocity telemetry (`delivery_locations` and `navigation_points`).
2. **Zero Business Dependencies**: No business logic (orders, payments, users, pricing, app updates) queries Supabase.
3. **Data Lifecycle & Pruning**: Coordinates in `navigation_points` older than 5 minutes are periodically pruned to keep the table lightweight and prevent unlimited storage expansion.
4. **Security & Key Management**: `SUPABASE_SERVICE_ROLE_KEY` is strictly held on the server. Customer and Rider frontend applications use `VITE_SUPABASE_ANON_KEY` exclusively for subscribing to `delivery_locations` real-time channels filtered by `delivery_partner_id` or `order_id`.

---

## 4. Render PostgreSQL Staging & Future VPS Portability

1. **Environment-Driven Configuration**: PostgreSQL connection is entirely dynamic via `DATABASE_ENV`:
   - `DATABASE_ENV=render-test`: Uses `RENDER_POSTGRES_URL` (e.g. Render Managed Postgres).
   - `DATABASE_ENV=production` or `DATABASE_ENV=vps`: Uses `DATABASE_URL` or `VPS_POSTGRES_URL`.
2. **Zero Provider Lock-In**: All migrations in `backend/src/migrations/` use ANSI-standard SQL compatible with PostgreSQL 14 through 18+.
3. **Seamless Migration**: Migrating from Render to a self-hosted VPS PostgreSQL requires only setting `VPS_POSTGRES_URL` and running `npm run migrate` without modifying any application code.
