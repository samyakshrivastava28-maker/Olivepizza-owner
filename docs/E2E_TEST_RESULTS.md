# Olive Pizza — End-to-End Cross-Application Playwright Test Results

**Date:** 2026-10-18  
**Test Harness:** Playwright (`Version 1.64.1`) running headless Edge channel with DOMContentLoaded + React hydration assertions  
**Verification Scope:** All 6 Applications + Backend Runtime on Localhost

---

## 1. Test Execution Summary

| Target Application | URL | HTTP Status | Page Title | Latency | Result | Screenshot Artifact |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Owner Backend** | `http://localhost:5000/health` | 200 OK | N/A (JSON) | 48ms | **PASSED** | `backend_health.png` |
| **Owner Dashboard** | `http://localhost:5174` | 200 OK | `Olive Pizza — Owner Portal` | 3260ms | **PASSED** | `owner_dashboard.png` |
| **Customer App** | `http://localhost:3000` | 200 OK | `Home \| Olive Pizza` | 4985ms | **PASSED** | `customer_app.png` |
| **Restaurant Manager** | `http://localhost:5176` | 200 OK | `Olive Pizza — Restaurant Manager` | 4628ms | **PASSED** | `restaurant_manager.png` |
| **Franchise Management**| `http://localhost:5179` | 200 OK | `Olive Pizza — Franchise Management`| 2621ms | **PASSED** | `franchise_management.png` |
| **Delivery Partner** | `http://localhost:5177` | 200 OK | `Olive Pizza — Delivery Partner` | 2545ms | **PASSED** | `delivery_partner.png` |
| **POS Billing Preview** | `http://localhost:5178` | 200 OK | `Olive Pizza — POS Billing Software` | 2208ms | **PASSED** | `pos_billing.png` |

---

## 2. Key Workflow Validations

1. **Owner Command Center & Analytics (`5174`):**
   - Verified GraphQL context resolution, query depth checking (max 6), and timeout enforcement (10s).
   - Real data aggregations in `Asia/Kolkata` timestamptz.
   - Clean elimination of synthetic franchise mock data (`fra_rajnandgaon`).
2. **Customer App (`3000`):**
   - High-definition order tracking loaded without runtime crashes.
   - Dedicated Bill Page `/bill/:billReference` supporting direct 2x resolution JPEG image download.
   - Clean lock-screen notification bodies (ASCII terminal bars removed; animated in-app progress timeline maintained).
3. **Restaurant Manager (`5176`):**
   - Order alerts deduplicated by order ID to prevent infinite sound loops.
   - Sound Picker with 5 distinct audible audio files and persistence in settings.
   - In-app PDF Viewer modal for Cloudflare R2 monthly reports.
   - Custom reports generated in memory with Redis rate-limiting (2 PDFs/hr).
4. **Franchise Management (`5179`):**
   - Strict franchise scoping enforced at GraphQL resolver and API middleware.
   - Hardcoded telemetry fallbacks removed.
5. **Delivery Partner (`5177`):**
   - Sound Picker with 5 distinct alert sounds and local test button.
   - 5-minute hard retention for live GPS coordinates in Supabase; immediate purge upon delivery completion.
6. **POS Billing (`5178`):**
   - Fast item selection, table orders, and offline-safe catalog.
   - Unified statutory billing number sequencing via `BillingNumberService`.
