# Olive Pizza — System Baseline Audit (Phase 1)

**Audit Date:** 2026-10-18  
**Environment:** Local Development, Remote Verification & Production Architecture  
**Author:** Antigravity Engineering

---

## 1. Application & Repository Topology

The Olive Pizza delivery platform consists of six client/operational applications and a unified backend runtime:

| Project Name | Local Path | Remote Repository | Active Branch | Deployed / Tested Port | Framework & Stack |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Owner Backend** | `olive-pizza-owner/backend` | `samyakshrivastava28-maker/Olivepizza-owner` | `fix/graphql-auth-dashboard-metrics-ci-remediation` | `5000` | Node.js, Express, TypeScript, GraphQL, PostgreSQL, Firestore, Redis |
| **Owner Frontend** | `olive-pizza-owner/frontend` | `samyakshrivastava28-maker/Olivepizza-owner` | `fix/graphql-auth-dashboard-metrics-ci-remediation` | `5174` | React 18, Vite, Tailwind CSS, Lucide Icons, Chart.js / Recharts |
| **Customer App** | `olive-pizza` | `samyakshrivastava28-maker/Olive-Pizza` | `fix/testlab-android-ios-signing-remediation` | `3000` | React 18, Vite, Tailwind CSS, Capacitor (Android/iOS) |
| **Restaurant Manager** | `Olive Pizza restaurant manager` | `samyakshrivastava28-maker/olive-pizza-restaurant` | `feat/rider-work-schedules-background-notifications-20261016` | `5176` | React 18, Vite, Tailwind CSS, Capacitor, Web Audio |
| **Franchise Management** | `olive-pizza-franchise` | `samyakshrivastava28-maker/olive-pizza-franchise` | `fix/auth-and-authorization-remediation` | `5179` | React 18, Vite, Tailwind CSS, Recharts |
| **Delivery Partner** | `olive-pizza-delivery` | `samyakshrivastava28-maker/olive-pizza-delivery` | `feat/rider-work-schedules-background-notifications-20261016` | `5177` | React 18, Vite, Tailwind CSS, Capacitor, Web Audio, Supabase GPS |
| **POS Billing** | `olive-pizza-pos` | `samyakshrivastava28-maker/olive-pizza-pos` | `fix/auth-and-authorization-remediation` | `5178` | React 18, Vite, Tailwind CSS, Thermal Print, IndexedDB / Offline Cache |

---

## 2. Live Runtime Status on Localhost

All 6 applications and the unified backend dev server are active and verified on localhost:
- **Backend Health:** `http://localhost:5000/health` → HTTP 200 `{ status: "ok" }`
- **Owner Dashboard:** `http://localhost:5174` → HTTP 200
- **Customer Web App:** `http://localhost:3000` → HTTP 200
- **Restaurant Manager:** `http://localhost:5176` → HTTP 200
- **Franchise Management:** `http://localhost:5179` → HTTP 200
- **Delivery Partner App:** `http://localhost:5177` → HTTP 200
- **POS Preview:** `http://localhost:5178` → HTTP 200

---

## 3. Package & Application Identifiers

Android Application Identifiers (`applicationId` in `android/app/build.gradle` & `appId` in `capacitor.config.*`) have been audited to eliminate package collision:

1. **Customer App:** `com.olivepizza.customer`
2. **Restaurant Manager:** `com.olivepizza.manager`
3. **Franchise App:** `com.olivepizza.franchise`
4. **Delivery Partner:** `com.olivepizza.delivery`
5. **POS App:** `com.olivepizza.pos`

All apps share the canonical signing certificate fingerprint (SHA-1: `4C:6B:4A:1E:7D:43:96:6D:74:82:17:5F:08:D8:87:E5:3B:C4:B5:7E`) matching the OAuth client certificates in `google-services.json`.

---

## 4. Key Verification Metrics

1. **Owner Command Center & Analytics:**
   - GraphQL queries (`commandCenterSummary`, `topFranchises`, `criticalIncidents`, `franchisesList`, `franchiseWorkspace`) enforce strict Owner authorization.
   - AST Depth checking is locked at maximum depth 6 with 10-second query timeouts.
   - Orders are aggregated via SQL CTEs using `Asia/Kolkata` timestamptz.
   - Synthetic dummy data (e.g. `fra_rajnandgaon`) is completely eliminated.
2. **PostgreSQL & Firestore Order Archival:**
   - Active orders reside in Firestore as operational source of truth (`lifecycle: 'ACTIVE'`).
   - Terminal orders (`delivered` / `cancelled`) are verified across canonical PostgreSQL tables (`canonical_orders`, `canonical_order_items`, `canonical_bills`, `payments`) before setting `lifecycle: 'COMPLETED'`.
   - Starvation bug in archival reconciliation sweep is resolved by targeting unfinalized states rather than a blind `limit(25)` on terminal status.
3. **Report Generation & Cloudflare R2:**
   - Only official monthly closure reports are stored in Cloudflare R2 (`reports/monthly/...`).
   - Custom reports are dynamically streamed in-memory with Redis rate-limiting (2 PDFs/hr for Restaurant Managers; unlimited for Owner).
