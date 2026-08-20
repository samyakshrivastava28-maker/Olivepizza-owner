# 🍕 Olive Pizza Owner — Standalone Business Management Platform

> **Comprehensive System Architecture, Features, Mobile App, and Operational Documentation**  
> **Package ID**: `in.olivepizza.owner` | **Backend API**: `https://olivepizza-owner.onrender.com` | **Web Console**: `https://olivepizza-owner.vercel.app`

---

## 1. Executive Summary

**Olive Pizza Owner** is a dedicated enterprise management platform engineered exclusively for restaurant owners, kitchen staff, and store managers. It operates as both a modern web dashboard and a native Android application powered by Capacitor 8.

The platform provides complete operational control over live orders, product catalogs, combo builders, delivery fleets, marketing automation, AI-driven asset generation, continuous order alarms, and business analytics.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        OLIVE PIZZA OWNER SYSTEM                        │
├────────────────────────────┬───────────────────────────────────────────┤
│ 📱 Native Android App      │ Capacitor 8 Container (in.olivepizza.owner)│
│ 🌐 Web Management Console  │ React 19 + TypeScript + Vite + Tailwind   │
│ ⚡ Dedicated Backend API    │ Express + Node.js on Render               │
│ 🗄️ Database & Storage      │ Cloud Firestore + PostgreSQL + Cloudinary │
│ 🧠 AI Intelligence Layer    │ DeepSeek V4 Flash + Qwen Image + Flux     │
└────────────────────────────┴───────────────────────────────────────────┘
```

---

## 2. Core Feature Modules

### 📊 1. Dashboard & Business Intelligence
- **Real-Time Revenue & Volume**: Live calculation of daily revenue, total active orders, and delivered orders.
- **Interactive Charts**: Revenue trends, peak ordering hours, popular pizza categories, and customer retention visualizations using Chart.js.
- **Quick Action Bar**: Instant shortcuts for pausing store operations, adjusting preparation times, or triggering emergency broadcasts.

### ⏳ 2. Live Orders & Emergency POS Alarms
- **Firestore Real-Time Stream**: Instant synchronization of incoming orders from customer apps without page reloads.
- **Continuous Audio Alarm Loop (`OwnerAlertManager`)**:
  - Automatically triggers a loud POS alarm cycle (60s play / 30s pause) on incoming pending orders.
  - Keeps alarming continuously until an owner or manager accepts or rejects the order.
  - Includes browser/webview audio unlock detection with a 1-tap banner.
- **Emergency Order Overlay (`NewOrderEmergencyOverlay`)**: High-priority modal presenting order items, delivery address, customer phone, and instant 1-tap accept/reject buttons.
- **Order Lifecycle Controls**: State transitions (`pending` ➡️ `accepted` ➡️ `preparing` ➡️ `ready` ➡️ `out_for_delivery` ➡️ `delivered`).

### 🍕 3. Product & Combo Catalog Management
- **Full-Fidelity Product CRUD**: Manage pizzas, sides, beverages, desserts, and special crusts.
- **Flexible Pricing Engines**: Supports fixed pricing, size variants (Regular, Medium, Large), crust add-ons, and promotional offer discounts.
- **Combo Builder (`ComboBuilder.tsx`)**: Construct multi-item bundle deals with dynamic discounts and custom item pickers.
- **AI Description Generator**: Built-in DeepSeek V4 Flash integration that crafts high-converting, mouthwatering menu descriptions in 1 click.
- **AI Image Generation & Cloudinary Sync**: Integrated Qwen Image and Flux models with 1-click Cloudinary upload, folder organization, and direct asset assignment.

### 🛵 4. Delivery Fleet & Live Tracking
- **Live Fleet Map (`UniversalMap3D.tsx` / `OwnerLiveMap.tsx`)**: Real-time GPS tracking of active delivery partners using MapLibre GL and Leaflet.
- **Smart Order Assignment**: Assign orders to available delivery riders based on real-time distance and capacity.
- **Telemetry & History**: Historical route playback, speed logs, delivery completion durations, and distance calculations.

### 📧 5. Email Marketing & Automation Center
- **Campaign Studio (`OwnerEmailCenter.tsx`)**: Compose, preview, test, and schedule marketing email campaigns.
- **AI Template Crafting**: DeepSeek-powered email copywriting for festival offers, discount coupons, and transactional updates.
- **PostgreSQL Queue Worker**: Background email queue worker processing deliveries with automated retry algorithms and idempotency protection.

### 🔔 6. Push Notification & Diagnostics Center
- **Unified Notification Broadcasts**: Send targeted or broadcast FCM push notifications to customers, kitchen staff, or delivery partners.
- **Native Android Notification Channels**: Dedicated notification channels for `olive_orders` (urgent alarms), `olive_marketing`, and `olive_system`.
- **System Diagnostics (`OwnerNotificationDiagnostics.tsx`)**: Live inspection of FCM token registration, background worker health, and network latency.

### 📈 7. Reports & Google Sheets Auto-Sync
- **Automated Monthly & Weekly Reports**: Detailed CSV/PDF export and Google Sheets auto-synchronization for accounting and tax records.
- **Diagnostic Health Panel**: Database health monitors, cache hit rates, memory utilization, and storage capacity metrics.

---

## 3. Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend Framework** | React 19, TypeScript, Vite 6, React Router 7 |
| **Styling & UI** | Tailwind CSS v4, Framer Motion, Lucide React |
| **Data Visualizations** | Chart.js, React-ChartJS-2, MapLibre GL, Leaflet |
| **State Management** | Zustand (Persistent Auth, Theme, and UI state) |
| **Mobile Runtime** | Capacitor 8 (Android Platform) |
| **Backend Runtime** | Node.js (ESM), Express, TypeScript (`tsx`) |
| **Databases** | Google Cloud Firestore (Primary Live DB) & PostgreSQL (Analytics & Queues) |
| **Object Storage** | Cloudinary (Images & Media) & Cloudflare R2 |
| **Authentication** | Firebase Authentication (Native Google OAuth + Email/Password + RBAC) |
| **Push Notifications** | Firebase Cloud Messaging (FCM) + Native Android Background Services |

---

## 4. System Architecture & Workflows

### Order Lifecycle & Alarm Flow
```
Customer Places Order
        ↓
Firestore /orders Collection
        ↓ (Realtime onSnapshot)
Owner App Receives Document Event
        ↓
OwnerAlertManager Detects "pending" Status
        ↓
Plays Continuous POS Loop + Displays NewOrderEmergencyOverlay
        ↓
Owner Clicks "Accept Order"
        ↓
Backend Updates Order Status to "accepted"
        ↓
Alarm Silences Automatically & Kitchen Notified
```

### API & Request Routing Flow
```
Owner UI Action (Web or Native APK)
        ↓
fetchApi() / getApiUrl()
        ↓
Resolves Target URL:
  • Local Dev: http://localhost:5175
  • Native APK / Web Production: https://olivepizza-owner.onrender.com
        ↓
Injects Authorization: Bearer <Firebase_ID_Token>
        ↓
Render Backend API (Express)
        ↓
Validates Owner Authorization & Executes Business Logic
```

---

## 5. Security & Access Control (RBAC)

The Owner platform enforces strict, multi-layer security to safeguard business data and store controls:

1. **Email Whitelist & Role Enforcement**:
   - Access is strictly restricted to authorized administrator emails:
     - `olivepizzarjn@gmail.com`
     - `webhub2811@gmail.com`
   - Accounts without verified owner or admin claims are immediately redirected to `/login` by `OwnerGuard`.
2. **Firestore Security Rules**:
   - `firestore.rules` enforces that only authorized owner accounts can write to business collections (`/orders`, `/products`, `/categories`, `/combos`, `/ads`, `/settings`).
3. **Backend Middleware**:
   - Express rate limiters (`expensiveLimiter`, `adminLimiter`, `authLimiter`) protect against abuse.
   - Helmet security headers and strict CORS origin validation.

---

## 6. Repository Structure

```
olive-pizza-owner/
├── android/                             # Android Native Capacitor Project
│   ├── app/
│   │   ├── google-services.json         # Firebase Android Configuration
│   │   ├── build.gradle                 # Native Dependencies & Firebase BoM 34.17.0
│   │   └── src/main/java/in/olivepizza/owner/
│   │       ├── MainActivity.java        # Core Native Webview & Channel Setup
│   │       ├── AlarmActivity.java       # Full-Screen Continuous Audio Ring Activity
│   │       ├── DeliveryPlugin.java      # Fleet GPS Telemetry Bridge
│   │       ├── NotificationActionReceiver.java # Background Notification Actions
│   │       └── OliveMessagingService.java      # Firebase Cloud Messaging Handler
├── backend/                             # Express Backend Service
│   ├── server.ts                        # HTTP Server & Zero-Delay Port Binding
│   ├── src/
│   │   ├── app.ts                       # Express App, Middleware & Route Mounts
│   │   ├── config/                      # Environment Validation & URLs
│   │   ├── routes/                      # API Endpoints (ai, orders, menu, delivery, etc.)
│   │   └── services/                    # Business Logic, AI Integrations & Workers
├── frontend/                            # React 19 Frontend Dashboard
│   ├── index.html
│   ├── vite.config.ts                   # Vite Config, Bundle Chunking & Proxy
│   └── src/
│       ├── App.tsx                      # Root Routing & Protected OwnerGuard
│       ├── components/
│       │   ├── layout/OwnerLayout.tsx   # Global Shell, Mobile Nav & Alarm Manager
│       │   ├── owner/                   # Specialized Owner Widgets & Modals
│       │   └── map/UniversalMap3D.tsx   # Fleet Tracking Map
│       ├── lib/
│       │   ├── api.ts                   # Unified Authenticated Fetch Helper
│       │   ├── config.ts                # App Constants & Resilient URL Resolvers
│       │   ├── firebase.ts              # Firebase Client SDK Initialization
│       │   └── cloudinary.ts            # Image Upload & Management Helpers
│       └── pages/                       # Full-Fidelity Management Pages
│           ├── Login.tsx                # Native & Web Authentication
│           ├── OwnerDashboard.tsx       # Live Metrics & Revenue Overview
│           ├── OwnerOrders.tsx          # Real-time Order Grid & Action Controls
│           ├── OwnerProducts.tsx        # Menu Catalog & AI Image Generator
│           ├── OwnerEmailCenter.tsx     # Marketing Campaign Studio
│           └── OwnerReports.tsx         # Financial & Inventory Analytics
├── .github/workflows/
│   └── build-android.yml                # Automated GitHub Actions APK CI/CD
├── capacitor.config.json                # Capacitor Native Settings & Auth Providers
├── firestore.rules                      # Cloud Firestore Security Rules
└── render.yaml                          # Render Cloud Service Definition
```

---

## 7. Deployment & Operations

### 🌐 Web Service Deployment (Render)
- **Service Name**: `olivepizza-owner`
- **Build Command**: `npm install`
- **Start Command**: `npm start` *(or `npx tsx backend/server.ts`)*
- **Health Check Path**: `/api/heartbeat`
- **Port**: `10000` (automatically managed by Render)

### 📱 Android APK Generation (GitHub Actions)
- Any push to `main` triggers `.github/workflows/build-android.yml`.
- Builds the React web bundle (`npm run build`), syncs assets with Capacitor (`npx cap sync android`), and compiles the release APK via Gradle (`./gradlew assembleRelease`).
- Download the resulting artifact from the **Actions** tab on GitHub:  
  👉 [https://github.com/samyakshrivastava28-maker/Olivepizza-owner/actions](https://github.com/samyakshrivastava28-maker/Olivepizza-owner/actions)

---

## 8. Local Development Quickstart

```bash
# 1. Start the Owner Web Dashboard (Port 5174)
cd frontend
npm install --legacy-peer-deps
npm run dev

# 2. Start the Owner Backend Server (Port 5175)
cd ..
npm run dev:backend

# 3. Synchronize Web Assets with Android Native Container
npm run build
npx cap sync android
```
