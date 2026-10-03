# 🍕 Olive Pizza Owner & Canonical Central Backend

[![Node.js](https://img.shields.io/badge/Node.js-20%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Express](https://img.shields.io/badge/Express-4.21-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Live_GPS-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com/)
[![Redis](https://img.shields.io/badge/Redis-Cache%20%26%20Locks-DC382D?logo=redis&logoColor=white)](https://redis.io/)
[![React](https://img.shields.io/badge/React-19.0-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Firebase Admin](https://img.shields.io/badge/Firebase_Admin-13.10-FFCA28?logo=firebase&logoColor=black)](https://firebase.google.com/)
[![WebSocket](https://img.shields.io/badge/WebSocket-Ring_Buffer-010101?logo=socket.io&logoColor=white)](https://github.com/websockets/ws)
[![License](https://img.shields.io/badge/License-Proprietary-red.svg)]()

> This repository houses the **Canonical Central Backend** (Port 5000) serving the entire Olive Pizza ecosystem, along with the **Owner Platform Console** (Port 5174) for global platform administration.

---

## 🏗️ Architecture & Component Overview

```text
olive-pizza-owner/
├── backend/                  # Canonical Central Backend (Port 5000)
│   ├── src/
│   │   ├── config/           # Database pools (PostgreSQL, Supabase, Redis, Firebase Admin)
│   │   ├── routes/           # REST API routes (orders, auth, pos, franchises, sdui, etc.)
│   │   ├── services/         # State machines, canonical billing, Supabase GPS, R2, Sheets
│   │   │   ├── delivery/     # RiderDispatchEngine & DeliveryDataLifecycleService
│   │   │   ├── gps/          # SupabaseGpsService (High-frequency live GPS writes)
│   │   │   ├── notification/ # NotificationRouter & NotificationTemplates
│   │   │   ├── order/        # OrderStateMachine & OrderProjectionService
│   │   │   ├── pos/          # CanonicalOrderService (PostgreSQL orders & line items)
│   │   │   ├── reports/      # SalesCalculationEngine, MonthlyPdfReportService, R2 storage
│   │   │   ├── scoping/      # FranchiseScopeService (Multi-tenant RBAC)
│   │   │   ├── sdui/         # Server-Driven UI engine with Google Stitch
│   │   │   └── websocket/    # WebSocketServer with 200-event Monotonic Ring Buffer
│   │   ├── jobs/             # Scheduled jobs (MonthlyReportJob at 00:05 AM IST, Sheets sync)
│   │   └── tests/            # Automated test suites
│   └── server.ts             # Main backend entry point
└── frontend/                 # Owner Web & Mobile Console (Port 5174)
    ├── src/
    │   ├── pages/            # Franchises, Products, Analytics, SDUI Manager
    │   └── components/       # Provisioning wizard, Stitch UI designer, Audio alarms
    └── vite.config.ts        # Vite configuration
```

---

## 🏛️ Final Database & Operational Architecture

```text
                              OLIVE PIZZA
                                   │
                                   ▼
                        Node.js / Express API
                                   │
          ┌────────────────────────┼────────────────────────┐
          │                        │                        │
          ▼                        ▼                        ▼
       Firestore            Main PostgreSQL               Redis
          │                        │                        │
          │                        │                        ├─ Cache (menus, store status)
          │                        │                        ├─ Distributed locks (checkout)
          │                        │                        └─ Rate limiting
          │                        ├─ Canonical Orders
          │                        ├─ Order Items
          │                        ├─ Financial Bills
          │                        ├─ Monotonic Billing Sequences
          │                        └─ Accounting Reports
          ▼
   Realtime Projections
   Profile Snapshots
   Order State Sync


                          RIDER LIVE GPS
                                │
                                ▼
                       Supabase PostgreSQL
                                │
                    ┌───────────┼───────────┐
                    ▼           ▼           ▼
             Latest Location Realtime    Navigation
```

---

## ⚙️ 1. Canonical Central Backend (`backend/` — Port 5000)

The single authoritative business engine for all connected client applications (**Customer**, **Owner**, **Franchise**, **Restaurant Manager**, **Delivery Partner**, **POS**, and **Olive Pizza AI**).

### Key Systems & Authoritative Responsibilities:

1. **Main PostgreSQL Source of Truth (`CanonicalOrderService.ts`)**:
   - Atomic transactions committing orders to `canonical_orders`, `canonical_order_items`, and `canonical_bills`.
   - Continuous permanent bill numbering via PostgreSQL sequences (`#1, #2, #3...`).
   - Slices channels authoritatively: `ONLINE` vs `POS` (Dine-In, Takeaway, Counter Delivery).
   - Offline POS bills automatically commit to PostgreSQL upon network reconnection.

2. **Supabase Live GPS Telemetry (`SupabaseGpsService.ts`)**:
   - Supabase PostgreSQL is strictly dedicated to live rider GPS coordinates (`public.delivery_locations`).
   - High-frequency GPS updates (1–2s during active order delivery) write directly to Supabase via server-authoritative API.
   - Low-frequency operational breadcrumbs (25s) when rider is idle online.
   - Real-time Supabase channels stream live coordinates to customer and management radar maps.

3. **Cryptographically Signed Context Sessions (`auth.routes.ts`)**:
   - `POST /api/auth/context-session`: Generates tamper-proof HMAC-SHA256 signed session tokens (`payloadB64.signature`) for platform owner context switching.
   - `POST /api/auth/verify-context-session`: Timing-safe signature comparison and expiration verification for standalone management consoles.

4. **Automated Month-End Accounting Pipeline (`MonthlyReportJob.ts`)**:
   - Automated cron worker running on the **1st of every month at 00:05 AM IST** (`Asia/Kolkata`).
   - Strictly idempotent execution using Firestore `monthly_cycles` cycle locks (`{year}-{monthNum}`).
   - Generates multi-page PDF reports from PostgreSQL canonical records via `SalesCalculationEngine`.
   - Stores archives securely in Cloudflare R2: `reports/{year}/olive-pizza/{franchiseId}/{branchId}/monthly/{year}-{monthNum}.pdf`.
   - Syncs structured Google Sheets monthly workbooks and dispatches single consolidated owner notifications.

5. **Multi-Tenancy & Scoping (`FranchiseScopeService.ts`)**:
   - Resolves effective user scope (`GLOBAL_OWNER`, `FRANCHISE_OWNER`, `BRANCH_MANAGER`, `CASHIER`, `RIDER`).
   - Regular staff are strictly bound to their assigned branch.
   - Global Owners (`olivepizzarjn@gmail.com`, `webhub2811@gmail.com`) maintain platform-wide access.

6. **Order State Machine (`OrderStateMachine.ts`)**:
   - 16 certified lifecycle transitions (`pending` ➔ `accepted` ➔ `preparing` ➔ `ready` ➔ `out_for_delivery` ➔ `delivered`).
   - Concurrency locking with `order_locks` and immutable audit logs in `order_audit_logs`.

7. **Critical Full-Information Alert Dispatcher (`NotificationTemplates.ts`)**:
   - Compiles un-truncated order line items with sizes, crusts, add-ons, and pricing.
   - Complete financial breakdown (Subtotal, Packaging, Delivery, Taxes, Grand Total).
   - High-visibility payment collection badges (`⚠️ CASH TO COLLECT: ₹XXX` vs `✅ ONLINE PAYMENT: PAID IN FULL`).
   - High-urgency FCM channels (`olive_order_alarm_v3`, `olive_delivery_alarm_v3`).

8. **WebSocket Server with Monotonic Ring Buffer (`WebSocketServer.ts`)**:
   - Bidirectional real-time event streaming on `/ws`.
   - In-memory 200-event rolling ring buffer per branch (`${franchiseId}:${branchId}`).
   - Monotonic sequence numbers with reconnection sync (`sync_request` / `sync_response`) for zero-loss Wi-Fi reconnects.

9. **Redis In-Memory Acceleration & Resilient Fallback (`RedisService.ts`)**:
   - Ephemeral cache for store menus, store status, and franchise metadata.
   - Distributed locking utility (`acquireLock`, `releaseLock`) preventing concurrent race conditions during checkout and settlement.
   - Graceful degradation with fail-closed protection for financial operations.

10. **Digital Personal Data Protection (DPDP) Act 2023 Compliance (`PrivacyService.ts`)**:
    - Data Fiduciary transparency notices, tamper-resistant consent logs, profile correction, sanitized data exports, grievance SLA tickets (`GRV-...`), and account erasure with statutory 30-day cooling period.
    - PII protection: raw customer phone numbers scrubbed from push notification FCM payloads.

---

## 🖥️ 2. Owner Platform Console (`frontend/` — Port 5174)

The executive command center for platform directors and administrators.

### Key Features:
- **7-Step Multi-Tenancy Provisioning Wizard (`/franchises`)**:
  - Atomic setup of franchises, owner accounts, branches, branch managers, GPS boundaries, and POS terminal hardware tokens.
- **Context-Switching Launchers**:
  - 1-click single-sign-on delegation to Franchise Suite (Port 5175) or Restaurant KDS (Port 5176) using HMAC-signed context tokens.
- **SDUI Visual Designer (`/home-manager`)**:
  - Visual layout editor for the Customer app homepage.
  - Integration with **Google Stitch** visual design engine and **DeepSeek V4 Flash** prompt enhancement.
  - Full preview-before-publish safety, version rollback, and Firestore deployment.
- **Product Catalog & AI Studio (`/products`)**:
  - AI prompt enhancement and image generation models (Qwen Image, FLUX.1-dev, SD 3.5 Large).
- **Continuous Emergency Audio Alarm**:
  - Web Audio synthetic siren and looping MP3 alerts ensuring critical unacknowledged orders are never missed.

---

## ⚡ Getting Started

### 1. Prerequisites
- Node.js `v20+` or `v22+`
- PostgreSQL 16
- Redis instance (local or Upstash/managed)
- Supabase Project (configured with `public.delivery_locations` schema)
- Firebase Project with Admin SDK service account credentials

### 2. Backend Setup
```bash
cd backend
npm install
npm run build
npm start
```

### 3. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

---

## 🧪 Testing & Verification

```bash
# Run TypeScript compilation check
npm run typecheck

# Run automated backend test suites
npm test
```

---

## 📜 License

Proprietary © Olive Pizza. All rights reserved.
