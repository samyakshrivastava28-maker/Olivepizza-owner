# 🍕 Olive Pizza Owner & Canonical Central Backend

[![Node.js](https://img.shields.io/badge/Node.js-20%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Express](https://img.shields.io/badge/Express-4.21-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![React](https://img.shields.io/badge/React-19.0-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Firebase Admin](https://img.shields.io/badge/Firebase_Admin-13.10-FFCA28?logo=firebase&logoColor=black)](https://firebase.google.com/)
[![WebSocket](https://img.shields.io/badge/WebSocket-Ring_Buffer-010101?logo=socket.io&logoColor=white)](https://github.com/websockets/ws)
[![License](https://img.shields.io/badge/License-Proprietary-red.svg)]()

> This repository houses the **Canonical Central Backend** (Port 5000) serving the entire Olive Pizza ecosystem, along with the **Owner Platform Console** (Port 5174) for global platform administration.

---

## 🏗️ Architecture & Component Overview

```
olive-pizza-owner/
├── backend/                  # Canonical Central Backend (Port 5000)
│   ├── src/
│   │   ├── routes/           # REST API routes (orders, auth, franchises, sdui, etc.)
│   │   ├── services/         # State machines, notifications, WebSockets, R2, Sheets
│   │   │   ├── notification/ # NotificationRouter & NotificationTemplates (Full Info)
│   │   │   ├── websocket/    # WebSocketServer with 200-event Monotonic Ring Buffer
│   │   │   ├── scoping/      # FranchiseScopeService (Multi-tenant RBAC)
│   │   │   └── sdui/         # Server-Driven UI engine with Google Stitch
│   │   └── tests/            # Automated test suites
│   └── server.ts             # Main backend entry point
└── frontend/                 # Owner Web & Mobile Console (Port 5174)
    ├── src/
    │   ├── pages/            # Franchises, Products, Analytics, SDUI Manager
    │   └── components/       # Provisioning wizard, Stitch UI designer, Audio alarms
    └── vite.config.ts        # Vite configuration
```

---

## ⚙️ 1. Canonical Central Backend (`backend/` — Port 5000)

The single authoritative business engine for all six client apps (Customer, Owner, Franchise, Restaurant Manager, Delivery, POS).

### Key Systems & Responsibilities:
1. **Multi-Tenancy & Scoping (`FranchiseScopeService.ts`)**:
   - Resolves effective user scope (`GLOBAL_OWNER`, `FRANCHISE_OWNER`, `BRANCH_MANAGER`, `CASHIER`, `RIDER`).
   - Regular staff are strictly bound to their assigned branch.
   - Global Owners (`olivepizzarjn@gmail.com`, `webhub2811@gmail.com`) maintain platform-wide access.
2. **Order State Machine (`OrderStateMachine.ts`)**:
   - 16 certified lifecycle transitions (`pending` ➔ `accepted` ➔ `preparing` ➔ `ready` ➔ `out_for_delivery` ➔ `delivered`).
   - Concurrency locking with `order_locks` and immutable audit logs in `order_audit_logs`.
3. **Critical Full-Information Alert Dispatcher (`NotificationTemplates.ts`)**:
   - Compiles un-truncated order line items with sizes, crusts, add-ons, and pricing.
   - Complete financial breakdown (Subtotal, Packaging, Delivery, Taxes, Grand Total).
   - High-visibility payment collection badge (`⚠️ CASH TO COLLECT: ₹XXX` vs `✅ ONLINE PAYMENT: PAID IN FULL`).
   - High-urgency FCM channels (`olive_order_alarm_v3`, `olive_delivery_alarm_v3`) with action buttons (`ACCEPT`, `REJECT`, `VIEW`, `OPEN_LOCATION`).
   - Serializes full order payload into `data.fullOrderJson`.
4. **WebSocket Server with Monotonic Ring Buffer (`WebSocketServer.ts`)**:
   - Bidirectional real-time event streaming on `/ws`.
   - In-memory 200-event rolling ring buffer per branch (`${franchiseId}:${branchId}`).
   - Monotonic sequence numbers with reconnection sync (`sync_request` / `sync_response`) for zero-loss Wi-Fi reconnects.
5. **Dual Persistence & Background Workers**:
   - Sub-100ms Firestore commits for all POS bills and orders.
   - Non-blocking sync to Google Sheets monthly franchise workbooks with offline retry.
   - Automated `DataRetentionJob` enforcing 5-minute raw GPS telemetry retention.
6. **Perpetual Transactional Billing (#1, #2, #3...) (`billing.repository.ts`)**:
   - Perpetual monotonic billing counter starting at `#1`, never resets, never contains dates, never reused.
   - Handled via atomic Firestore transactions on `counters/permanent_billing` (concurrency-tested for 100 simultaneous allocations with 0 duplicate sequences).
   - Calendar daily order counter on `counters/dailyOrders` resets automatically at midnight IST.
   - Strict separation of `source: 'ONLINE' | 'POS'` on billing and order records.
7. **In-Memory Domain Event Bus (`AppEventBus.ts`)**:
   - Typed in-memory event bus managing 12 canonical domain events (`order.created`, `order.accepted`, `order.preparing`, `order.ready`, `order.partner_assigned`, `order.picked_up`, `order.out_for_delivery`, `order.delivered`, `order.rejected`, `order.cancelled`, `payment.received`, `bill.generated`).
   - Completely eliminates Kafka/microservice overhead while keeping domain events decoupled from notification, email, and analytics listeners.
8. **Redis In-Memory Acceleration & Resilient Fallback (`RedisService.ts`)**:
   - Ephemeral cache powered by `ioredis` for store menus (300s TTL), store status (60s TTL), and franchise metadata (600s TTL).
   - Distributed locking utility (`acquireLock`, `releaseLock`) preventing concurrent race conditions.
   - Guaranteed graceful degradation: transparently falls back to Firestore if Redis is offline or disconnected.
9. **Idempotency Engine (`idempotency.middleware.ts`)**:
   - Protects order placement and billing endpoints against rapid double-clicks.
   - In-memory fast-path prevents duplicate in-flight processing (returns `409 Conflict`), with 24-hour Firestore response caching (`X-Idempotent-Replay: true`).
10. **Digital Personal Data Protection (DPDP) Act 2023 Compliance (`PrivacyService.ts`)**:
    - Data Fiduciary transparency notices, tamper-resistant consent logs, profile correction, sanitized data exports (passwords/tokens/claims stripped), grievance SLA tickets (`GRV-...`), and account erasure with statutory 30-day cooling period.
    - PII protection: raw customer phone numbers scrubbed from push notification FCM `data` payloads.

---

## 🖥️ 2. Owner Platform Console (`frontend/` — Port 5174)

The executive command center for platform directors and administrators.

### Key Features:
- **7-Step Multi-Tenancy Provisioning Wizard (`/franchises`)**:
  - Atomic setup of franchises, owner accounts, branches, branch managers, GPS boundaries, and POS terminal hardware tokens.
- **Context-Switching Launchers**:
  - 1-click single-sign-on delegation to Franchise Suite (Port 5175) or Restaurant KDS (Port 5176) using secure temporary context session tokens (`POST /api/auth/context-session`).
- **SDUI Visual Designer (`/home-manager`)**:
  - Visual layout editor for the Customer app homepage.
  - Integration with **Google Stitch** visual design engine and **DeepSeek V4 Flash** prompt enhancement.
  - Full preview-before-publish safety, version rollback, and Firestore deployment.
- **Product Catalog & AI Studio (`/products`)**:
  - AI prompt enhancement and image generation models (Qwen Image, FLUX.1-dev, SD 3.5 Large).
- **Continuous Emergency Audio Alarm**:
  - High-priority looping audio alarm alerting operators of orders awaiting confirmation.

---

## ⚡ Quick Start & Development

### 1. Prerequisites
- Node.js `v20+` or `v22+`
- Firebase Service Account Key
- PostgreSQL database instance

### 2. Running the Canonical Backend
```bash
cd backend

# Install dependencies
npm install

# Run TypeScript build
npm run build

# Start backend in development mode with hot reload
npm run dev
# Or start production server
npm start
```
*Backend runs on `http://localhost:5000` (WebSocket on `ws://localhost:5000/ws`).*

### 3. Running the Owner Frontend
```bash
cd frontend

# Install dependencies
npm install

# Start Vite dev server on port 5174
npm run dev
```
*Frontend runs on `http://localhost:5174`.*

---

## 🧪 Automated Testing

Run the complete automated backend test suite (33 tests across all domain suites):
```bash
cd backend

# Run all automated test suites
npm test

# Or run specific test suites
node --import tsx src/tests/concurrent_billing.test.ts
node --import tsx src/tests/privacy_governance.test.ts
node --import tsx src/tests/order_flow_security_audit.test.ts
node --import tsx src/tests/pos_analytics_e2e.test.ts
node --import tsx src/tests/urgent_order_routing_e2e.test.ts
node --import tsx src/tests/sheets_workbook.test.ts
```

---

## 🛡️ Security & Strict Access Rules

- **Authorized Internal Accounts**:
  - `olivepizzarjn@gmail.com`
  - `webhub2811@gmail.com`
- All sensitive API keys, Firebase Admin credentials, Cloudflare R2 secrets, and database passwords reside strictly on the server.
- Zero client secrets exposed to frontend applications.

---

## 📄 License

Proprietary Software — All rights reserved by **Olive Pizza**, Rajnandgaon, Chhattisgarh, India.
