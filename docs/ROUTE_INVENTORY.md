# Olive Pizza — Route Inventory across All Applications

**Document Version:** 1.0  
**Context:** Comprehensive route map across Frontend Apps and Unified Backend

---

## 1. Owner Dashboard Routes (`http://localhost:5174`)

- `/` — Command Center (Realtime system overview, critical incidents, revenue CTEs)
- `/analytics` — Detailed Business Analytics, sales trends, channel breakdown
- `/franchises` — Franchise Management & Workspaces
- `/franchises/:franchiseId` — Dedicated Franchise Workspace
- `/homepage-manager` — SDUI visual editor & home screen configuration
- `/menu` — Master menu catalog, category hierarchy, variants, add-ons
- `/orders` — Master live order fulfillment & historical search
- `/reports` — Statutory & custom reports, in-app PDF preview modal
- `/notifications` — Push notification center & campaign broadcasts
- `/email` — Automated & transactional email dispatch
- `/marketing` — Ads, banners, promotional coupons
- `/media` — Media library & Cloudinary asset manager
- `/settings` — System parameters, maintenance mode, role authorizations

---

## 2. Customer Application Routes (`http://localhost:3000`)

- `/` — Customer Home / Dynamic SDUI Feed
- `/menu` — Category browsing, pizza customization, combos
- `/cart` — Cart management, coupon application
- `/checkout` — Address selection, payment method selection, order placement
- `/orders` — Customer order history
- `/order-tracking/:orderId` — High-definition realtime order timeline & rider map
- `/bill/:billReference` — Dedicated HTML bill page with 2x JPEG image download
- `/profile` — Side navigation & customer profile
- `/settings` — Notification preferences, OS permissions diagnostics, app preferences

---

## 3. Restaurant Management Routes (`http://localhost:5176`)

- `/` — Live Kitchen & Fulfillment Dashboard
- `/orders` — Active kitchen orders, status transitions (Accept, Prepare, Ready)
- `/menu` — Branch 86/item availability toggles
- `/reports` — Monthly PDF archive & custom reports with Redis quota indicator
- `/settings` — Sound picker (5 distinct sounds), audio test, branch preferences

---

## 4. Franchise Management Routes (`http://localhost:5179`)

- `/` — Franchise Executive Dashboard
- `/branches` — Assigned branch oversight & performance
- `/staff` — Staff role assignments within franchise
- `/finance` — Franchise revenue, payout calculations, tax summaries
- `/settings` — Franchise operational configuration

---

## 5. Delivery Partner Routes (`http://localhost:5177`)

- `/` — Delivery Home / Shift Toggle (Online / Offline)
- `/assigned-orders` — Active delivery assignments
- `/navigation/:orderId` — Turn-by-turn routing with 5-minute Supabase GPS retention
- `/earnings` — Daily / weekly delivery payouts and completed trips
- `/settings` — Alert sound picker (5 distinct sounds), volume, audio test

---

## 6. POS Billing Routes (`http://localhost:5178`)

- `/` — POS Terminal / Quick Bill Matrix
- `/tables` — Table management and dine-in orders
- `/catalog` — Offline-cached menu item selection
- `/history` — Today's bills, reprint receipt, shift closure report
- `/settings` — Thermal printer configuration, terminal identifier

---

## 7. Unified Backend REST & GraphQL Endpoints (`http://localhost:5000`)

- `POST /graphql` — Protected GraphQL endpoint with AST depth checking (max 6)
- `GET /health` — Health check endpoint (`{ status: "ok" }`)
- `GET /api/bootstrap/*` — Cached application bootstrap endpoints (home, menu, cart)
- `GET /api/menu/master-catalog` — Master catalog with Layerbase Redis caching (TTL 300s)
- `GET /api/menu/branch/:branchId` — Branch-specific menu with 86 status
- `GET /api/orders/live` — Active live orders for restaurant kitchen
- `GET /api/orders/bill/:billReference` — Secure bill lookup by reference/orderId
- `POST /api/orders/transition` — Validated order status transition engine
- `GET /api/reports/monthly` — Cloudflare R2 monthly PDF retrieval
- `POST /api/reports/custom` — Dynamic in-memory PDF generation with Redis rate-limiting
- `GET /api/reports/quota` — Hourly PDF quota status for restaurant manager
- `POST /api/auth/*` — Firebase token validation & read-only RBAC resolution
