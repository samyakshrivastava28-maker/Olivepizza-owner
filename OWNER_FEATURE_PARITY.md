# Olive Pizza Owner — Feature Parity Matrix

This document tracks feature parity between the existing embedded Owner Panel and the new standalone **Olive Pizza Owner** platform.

| # | Existing Owner Feature | Existing Route in `olive-pizza` | New Owner Page | API Reused | Verified |
|---|---|---|---|---|---|
| 1 | **Realtime Dashboard & KPIs** | `/owner/dashboard` | `/src/pages/Dashboard.tsx` | Firestore `orders` + `/api/heartbeat` | ✅ |
| 2 | **Live Orders Board & Status** | `/owner/orders` | `/src/pages/LiveOrders.tsx` | Firestore `orders` + `/api/orders/:id/status` | ✅ |
| 3 | **Order History & Invoices** | `/owner/order-history` | `/src/pages/OrderHistory.tsx` | Firestore `orders` | ✅ |
| 4 | **Products & Catalog Manager** | `/owner/products` | `/src/pages/Products.tsx` | Firestore `products` + `/api/menu` | ✅ |
| 5 | **Special Categories & Combos** | `/owner/special-categories` | `/src/pages/SpecialCategories.tsx` | Firestore `categories` + `combos` | ✅ |
| 6 | **Coupons & Discount Rules** | `/owner/coupons` | `/src/pages/Coupons.tsx` | Firestore `coupons` + `/api/coupons` | ✅ |
| 7 | **Promotions & Banner Ads** | `/owner/ads` | `/src/pages/Ads.tsx` | Firestore `advertisements` | ✅ |
| 8 | **Cloudinary Media Library** | `/owner/media` | `/src/pages/MediaLibrary.tsx` | `/api/media` + `/api/media-library` | ✅ |
| 9 | **Home Page Manager (SDUI)** | `/owner/home-page-manager` | `/src/pages/HomePageManager.tsx` | `/api/home-page-manager` + Firestore | ✅ |
| 10 | **Delivery Partners & Tracking** | `/owner/partners` | `/src/pages/DeliveryPartners.tsx` | Firestore `delivery_partners` + `/api/delivery` | ✅ |
| 11 | **Financial & Sales Reports** | `/owner/reports` | `/src/pages/Reports.tsx` | Firestore `orders` + `/api/reports` | ✅ |
| 12 | **Customer CRM & Spend Stats** | `/owner/customers` | `/src/pages/Customers.tsx` | Firestore `users` + `/api/users` | ✅ |
| 13 | **Email Center & Campaigns** | `/owner/email` | `/src/pages/EmailCenter.tsx` | `/api/email` + Postgres `email_templates` | ✅ |
| 14 | **Notification Center (FCM)** | `/owner/notifications` | `/src/pages/NotificationCenter.tsx` | `/api/notifications/send-custom` | ✅ |
| 15 | **Notification Diagnostics** | `/owner/notification-diagnostics` | `/src/pages/NotificationDiagnostics.tsx` | `/api/notifications/diagnostics` | ✅ |
| 16 | **Verification & OTP Metrics** | `/owner/verification-metrics` | `/src/pages/VerificationMetrics.tsx` | `/api/phone/metrics` | ✅ |
| 17 | **AI Health & Heartbeat Monitor**| `/owner/ai-monitor` | `/src/pages/AIHealthMonitor.tsx` | `/api/heartbeat` | ✅ |
| 18 | **AI Knowledge Sync (Pinecone)** | `/owner/ai-knowledge` | `/src/pages/AIKnowledge.tsx` | `/api/knowledge` + Pinecone | ✅ |
| 19 | **Security & Audit Logs** | `/owner/security` | `/src/pages/SecurityLogs.tsx` | Firestore `security_logs` | ✅ |
| 20 | **Version Management & PWA** | `/owner/versions` | `/src/pages/VersionManagement.tsx` | Firestore `app_version` + `/api/version` | ✅ |
| 21 | **Festival & Calendar Events** | `/owner/events` | `/src/pages/Events.tsx` | Firestore `events` | ✅ |
| 22 | **Website Analytics & Traffic** | `/owner/analytics` | `/src/pages/Analytics.tsx` | `/api/website-analytics` | ✅ |
| 23 | **Data Manager Hub** | `/owner/data-manager` | `/src/pages/DataManager.tsx` | `/api/data-manager` | ✅ |
| 24 | **Store Hours & Settings** | `/owner/settings` | `/src/pages/Settings.tsx` | Firestore `settings/store` | ✅ |
| 25 | **Owner Auth & Role Gate** | `/login` + `OwnerGuard` | `/src/pages/Login.tsx` + `OwnerGuard.tsx` | Firebase Auth (strict `olivepizzarjn@gmail.com`) | ✅ |
