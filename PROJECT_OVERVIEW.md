# 🍕 Olive Pizza Owner & Central Platform — Project Overview

> **Canonical Backend Location**: `C:\Users\RYZEN\Downloads\olive-pizza-owner\backend`  
> **Owner Frontend Location**: `C:\Users\RYZEN\Downloads\olive-pizza-owner\frontend`  
> **Production API**: `https://api.olivepizza.in` | **Development API**: `http://localhost:5175`

---

## 1. Executive Summary

`olive-pizza-owner` is the core platform repository of the Olive Pizza ecosystem. It houses both:
1. **The Central Olive Pizza Backend**: The single canonical business API serving Customer, Owner, Franchise, Restaurant Management, Delivery, and POS applications.
2. **The Owner Web Platform**: The executive web console for business owners and platform administrators.

```
                         OLIVE PIZZA OWNER
                 ┌───────────────────────────────┐
                 │ OWNER FRONTEND  (port 5174)   │
                 │                               │
                 │ CENTRAL OLIVE PIZZA BACKEND   │
                 │         (port 5175)           │
                 └───────────────┬───────────────┘
                                 │
                          api.olivepizza.in
                                 │
      ┌──────────┬───────────────┼──────────────┬────────────┐
      │          │               │              │            │
      ▼          ▼               ▼              ▼            ▼
  Customer   Franchise       Manager        Delivery       POS
  :3000       :5179           :5176          :5177         :5178
```

---

## 2. Directory Architecture

```
olive-pizza-owner/
├── frontend/                                  # Owner Platform Frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── layout/                        # OwnerLayout, Header, MobileNav
│   │   │   ├── owner/                         # OwnerAlertManager, NewOrderEmergencyOverlay
│   │   │   └── homeManager/                   # SDUI Component Editor, Variant Manager
│   │   ├── pages/                             # Analytics, Orders, Menu, Reports, Home Manager
│   │   ├── types/                             # models.ts, auth.ts
│   │   ├── lib/                               # Firebase client, Zustand store
│   │   └── index.css
│   ├── package.json                           # Frontend build scripts
│   └── vite.config.ts                         # Port 5174, proxies to backend on :5175
│
└── backend/                                   # Central Canonical Backend
    ├── src/
    │   ├── app.ts                             # Express router mounting all platform routes
    │   ├── server.ts                          # HTTP + WebSocket Server on port 5175
    │   ├── config/                            # Firebase Admin, PostgreSQL, Cloudinary, Security
    │   ├── middleware/                        # auth.middleware.ts (Token verification, RBAC)
    │   ├── routes/
    │   │   ├── order.routes.ts                # Online and POS orders
    │   │   ├── kitchen.routes.ts              # Kitchen raw materials & supplies inventory
    │   │   ├── pos.routes.ts                  # In-store billing, terminal validation
    │   │   ├── delivery.routes.ts             # Dispatch, GPS tracking, geofence
    │   │   ├── notification.routes.ts         # Central FCM notifications & push logs
    │   │   ├── menu.routes.ts                 # Menu catalog, products, combos
    │   │   ├── franchise.routes.ts            # Franchise hierarchy & branch scoping
    │   │   ├── appConfig.routes.ts            # Remote configuration per app
    │   │   └── health.routes.ts               # /health, /ready, /heartbeat
    │   └── services/
    │       ├── kitchen/                       # KitchenInventoryService.ts
    │       ├── notification/                  # NotificationEngine.ts
    │       ├── pos/                           # POSService.ts, ESCPOSFormatter.ts
    │       ├── payment/                       # Cashfree, PhonePe, Razorpay, Reconciliation
    │       ├── reports/                       # SheetsSyncWorker.ts, CloudflareReportService.ts
    │       └── ai/                            # ModelRegistry.ts, AIImageService.ts
    ├── tests/                                 # Central automated test suite
    ├── .env.example                           # Documented environment template
    └── package.json                           # Backend server scripts
```

---

## 3. Key Core Modules & Capabilities

### 1. Emergency Order POS Alarms
* `OwnerAlertManager` listens to Firestore real-time order changes.
* Plays continuous repeating sound alarms on new pending orders until acknowledged.
* `NewOrderEmergencyOverlay` displays high-priority popups with customer details and 1-tap accept/reject.

### 2. SDUI Home Page Manager (`/home-manager`)
* Allows platform owners to visually modify, organize, and publish live homepage layouts.
* Integrates design systems, section reordering, banner promos, and template variants.
* Instant publish updates the live Firestore config without rebuilding client apps.

### 3. Kitchen Inventory Management (`/api/kitchen`)
* Backs the Restaurant Management app's Kitchen module.
* Authoritative backend stock calculations (`IN_STOCK`, `LOW_STOCK`, `OUT_OF_STOCK`).
* Deduplicated push notifications dispatched to branch managers and franchise owners.
* Full audit trail logging stock changes with timestamps and operator IDs.

### 4. POS Terminal & Direct Billing Engine (`/api/pos`)
* Authorizes registered POS terminals bound to specific branches.
* Handles Dine-In, Takeaway, and Restaurant Delivery bills.
* Formats ESC/POS raw bytes for direct thermal receipt printers.
* Automatically syncs transactions to franchise Google Sheets.

### 5. Multi-Tenant Franchise Scoping
* Validates user roles: `platform_owner`, `franchise_owner`, `restaurant_manager`, `delivery_partner`, `cashier`, `customer`.
* Enforces strict boundary checks so franchises and branches only access their own data.

---

## 4. Build & Typecheck Verification

Both Owner projects compile with **0 errors**:

```powershell
# Backend Typecheck
cd C:\Users\RYZEN\Downloads\olive-pizza-owner\backend
npx tsc --noEmit

# Frontend Build
cd C:\Users\RYZEN\Downloads\olive-pizza-owner\frontend
npm run build
```