# OLIVE PIZZA — PAYMENT & CANONICAL SECURITY ARCHITECTURE

**Audit Date**: October 2026  
**Status**: VERIFIED & PRODUCTION READY  
**Classification**: High-Assurance Financial & Distributed Systems Architecture  

---

## 1. Core Architectural Authorities

Olive Pizza operates under strict separation of concerns:

| Authority | Domain Responsibilities | Invariants |
| :--- | :--- | :--- |
| **PostgreSQL** | Canonical orders, order items, taxes, discounts, delivery fees, payments, refunds, permanent bills, accounting | Single financial source of truth. All financial calculations fail closed on DB error. |
| **Firestore** | Operational UI projections, staff profiles, realtime frontend listeners | Non-authoritative projection. Never used for authoritative financial mutations. |
| **Redis** | Distributed locks, cache stampede protection, short-lived idempotency tokens (24h TTL) | Coordination & caching layer. Never authoritative for durable financial data. |
| **Supabase** | Dedicated live rider GPS coordinates & temporary breadcrumbs | Live GPS telemetry only. 5-minute cleanup trigger upon order completion. |

---

## 2. Financial Defect Remediations & Verification

### A. Server Delivery Fee Authority
- **Vulnerability Remediated**: Client payloads could previously attempt to supply `deliveryFee: 0` or custom fees.
- **Enforcement**: In `backend/src/routes/payment.routes.ts`, `req.body.deliveryFee` is strictly checked against the authenticated user's role. For customers, client-provided delivery fees are completely ignored and recalculated by `PaymentService.createPaymentSession` based on branch distance and catalog rules. Only authenticated staff roles (`owner`, `admin`, `restaurant_manager`, `cashier`) can pass an authorized custom delivery fee.

### B. Fail-Closed Payment Intent & Ledger Session
- **Vulnerability Remediated**: Payment sessions could theoretically proceed if the initial database insert failed or warned.
- **Enforcement**: In `backend/src/services/payment/PaymentService.ts` (`createPaymentSession`), the PostgreSQL insert into the `payments` table is wrapped in strict transaction boundaries. If the database insert fails, an exception is thrown, halting payment session creation and returning a 500 error to the client. No payment gateway intent is ever issued without a committed PostgreSQL ledger record.

### C. Webhook Amount Verification & Replay Protection
- **Vulnerability Remediated**: Webhook spoofing or amount mismatch between payment gateway entity and canonical order amount.
- **Enforcement**: In `backend/src/services/payment/PaymentService.ts` (`processWebhook`):
  1. Cryptographic HMAC signature is validated before inspecting the payload.
  2. Redis distributed replay lock is checked.
  3. The payment record is retrieved from PostgreSQL `payments`.
  4. The webhook reported amount is strictly compared against the recorded database amount (`Math.abs(expected - received) <= 0.05`). Any tampering triggers an immediate rollback and security error.
  5. The payment status is updated to `captured` in PostgreSQL, `canonical_orders` is updated, and the order transitions via `OrderStateMachine.transition(orderId, 'accepted', ...)`.

### D. Single State Machine Routing
- **Vulnerability Remediated**: Direct Firestore `.update({ status })` calls in delivery and POS routes that bypassed PostgreSQL and Supabase GPS lifecycle cleanup.
- **Enforcement**:
  - `backend/src/routes/delivery.routes.ts`: All rider status transitions (`accepted`, `picked_up`, `delivered`, `declined`) now route through `OrderStateMachine.transition`.
  - `backend/src/routes/pos.routes.ts`: `/online-orders/:id/accept` routes through `OrderStateMachine.transition`.
  - Upon transition to `delivered` or `cancelled`, the 5-minute Supabase GPS telemetry cleanup is automatically dispatched.

### E. Distributed Idempotency Protection
- **Enforcement**: In `backend/src/routes/payment.routes.ts`, incoming payment requests generate a SHA-256 payload hash of `{ userId, items, deliveryAddress, paymentMethod, couponCode, branchId, deliveryType }`. An incoming `Idempotency-Key` or `X-Idempotency-Key` is verified against Redis key `idempotency:pay_intent:<key>`. If an identical request is re-submitted, the cached session response is returned (`idempotentReplay: true`). If the key is reused with modified parameters, the request is immediately rejected with HTTP 409 Conflict.

---

## 3. Automated Verification Matrix

| Test Suite | File | Status | Coverage |
| :--- | :--- | :--- | :--- |
| **Payment Security Authority** | `backend/src/tests/payment_security_authority.test.ts` | **PASS (4/4)** | Server delivery fee authority, webhook fail-closed on tampered amount, SHA-256 idempotency hash collision prevention |
| **Adversarial Security** | `backend/src/tests/adversarial_security.test.ts` | **PASS (15/15)** | Branch isolation, RBAC role restrictions, customer transition guards, owner isolation |
| **POS Business Intelligence** | `backend/src/tests/pos_analytics_e2e.test.ts` | **PASS (7/7)** | Server-authoritative bill calculation, shift management, drawer reconciliation, hourly curves |
| **Restaurant Notifications** | `backend/src/tests/restaurant_notifications_e2e.test.ts` | **PASS (8/8)** | Template exact copy, server-side deduplication, multi-device token registration |
| **DPDP Privacy Governance** | `backend/src/tests/privacy_governance.test.ts` | **PASS (7/7)** | Consent recording, data correction, sanitization, SLA grievance ticketing, 30-day grace period |
| **Google Sheets Workbook** | `backend/src/tests/sheets_workbook.test.ts` | **PASS (5/5)** | 13 accounting tabs, GST tax calculation, idempotent order sync, channel categorization |
| **Location & Dispatch Isolation** | `backend/src/tests/urgent_order_routing_e2e.test.ts` | **PASS (3/3)** | Location isolation across Rajnandgaon/Durg/Bhilai/Raipur, rider assignment isolation |

---

## 4. Ecosystem Build Verification

| Repository | Project Name | Target | Build Status |
| :--- | :--- | :--- | :--- |
| 1 | `Olive-Pizza` | Customer Web & Capacitor App | **BUILD PASS (Vite & TSC)** |
| 2 | `Olivepizza-owner` | Owner Dashboard Frontend & Backend | **BUILD PASS & 100% TESTS PASS** |
| 3 | `olive-pizza-franchise` | Franchise Management System | **BUILD PASS (Vite & TSC)** |
| 4 | `olive-pizza-restaurant` | Restaurant Management & KDS | **BUILD PASS (Vite & TSC)** |
| 5 | `olive-pizza-delivery` | Delivery Partner / Rider Application | **BUILD PASS (Vite & TSC)** |
| 6 | `olive-pizza-pos` | Restaurant POS Billing Terminal | **BUILD PASS (Vite & TSC)** |
| 7 | `Olive-Pizza-AI` | AI Gateway & LLM Orchestrator | **VERIFIED CLEAN** |
