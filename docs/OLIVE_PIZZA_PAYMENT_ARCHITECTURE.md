# Olive Pizza — Payment & Financial Architecture

## 1. Core Principles

The payment infrastructure of Olive Pizza enforces strict integrity guarantees:

1. **Server-Computed Totals**: The payment gateway order amount is determined strictly on the backend by summing authoritative item costs, taxes, packaging, and server-calculated delivery fees.
2. **Server-Authoritative Delivery Fees**: Delivery fees are computed by the backend based on store coordinates, delivery coordinates, geospatial polygons, and surge multipliers. Client-supplied `deliveryFee` is strictly discarded.
3. **Cryptographic Webhook Verification**: Every payment gateway webhook is verified using constant-time HMAC-SHA256 signature verification.
4. **Exact Amount Matching**: Webhooks and payment capture callbacks compare the gateway captured amount against the canonical order total down to the lowest currency unit (paise/cents). Any discrepancy flags a security incident and halts processing.
5. **Durable Distributed Idempotency**: Payment events are protected by dual-layer idempotency (Redis short-term distributed locks + PostgreSQL unique transaction indexes).

---

## 2. Payment Initiation & Order Creation Flow

```
[ Client Checkout ]
  POST /api/payments/create-gateway-order
  Payload: { branchId, items, deliveryAddress, couponCode }
        |
        v
[ Backend Financial Engine ]
  1. Authoritative price lookup for all items
  2. Authoritative coupon validation (redemption limit, expiry, minimum subtotal)
  3. Authoritative delivery fee calculation via Haversine / OSRM distance matrix
  4. Authoritative tax computation (CGST 2.5%, SGST 2.5%)
  5. Canonical Total = (Subtotal - Discount) + Taxes + Packaging + DeliveryFee
        |
        v
[ Payment Gateway Order Minting (Razorpay / Cashfree) ]
  - Create gateway order with amount in paise (e.g. 54900 for ₹549.00)
  - Insert tentative record in PostgreSQL: payments table (status: PENDING)
  - Return { gatewayOrderId, canonicalAmount, keyId } to client
```

---

## 3. Webhook Ingestion & Cryptographic Verification

```
[ Gateway Webhook: POST /api/payments/webhook ]
  Raw Body Buffer + Signature Header (X-Razorpay-Signature)
        |
        v
[ Webhook Signature Verification ]
  - Compute expected signature:
    HMAC_SHA256(rawBodyBuffer, process.env.PAYMENT_GATEWAY_WEBHOOK_SECRET)
  - crypto.timingSafeEqual(computedSignature, receivedSignature)
  - If mismatch: Return HTTP 400 Bad Request immediately
        |
        v
[ Redis Distributed Lock: payment:lock:{transactionId} ]
  - Acquire lock to prevent concurrent webhook + redirect race conditions
        |
        v
[ Canonical Verification ]
  1. Load associated order & payment from PostgreSQL (FOR UPDATE)
  2. Verify Amount:
     assert(webhook.payload.amount === postgresPayment.amount_in_paise)
     - If mismatch: log tampering alert, mark payment TAMPERED, reject.
  3. Check Idempotency:
     - If postgresPayment.status === 'PAID': return HTTP 200 OK (already handled)
        |
        v
[ PostgreSQL State Transition ]
  - UPDATE payments SET status = 'PAID', gateway_payment_id = ..., updated_at = NOW()
  - Transition order to 'CONFIRMED' in PostgreSQL
  - Discard/release Redis lock
  - COMMIT Transaction
        |
        v
[ Operational Projection ]
  - syncOrderToFirestore(orderId, confirmedState)
  - Notify Kitchen Display System (KDS)
```

---

## 4. Refund & Reconciliation Controls

- **Automatic Failure Refunds**: If a payment is successfully captured by the gateway but the order fails downstream creation in PostgreSQL (e.g., store abruptly closed or out-of-stock race), the backend immediately issues an automated refund call to the gateway API and logs the event to `financial_refund_logs`.
- **Daily Reconciliation Job**: A scheduled cron job queries the payment gateway settlements API and cross-checks every settled transaction against PostgreSQL `payments` records, highlighting any orphaned or unlinked payments in the Owner Audit Dashboard.
