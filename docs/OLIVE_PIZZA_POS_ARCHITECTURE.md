# Olive Pizza — POS Architecture & Offline Sync Protocol

## 1. System Overview

The Olive Pizza Point of Sale (POS) system operates in restaurant branches to facilitate in-store ordering, billing, and Kitchen Order Ticket (KOT) printing. It is designed for zero-downtime operation during network outages while upholding strict financial integrity.

### Fundamental Guarantees:
1. **Server-Authoritative Pricing in Online Mode**: The POS sends product IDs, variant IDs, and quantities. The backend calculates bill amounts based on the authoritative branch catalog.
2. **Offline Mode with Resilient Queue**: When internet connectivity drops, the POS utilizes an IndexedDB offline queue and local catalog cache.
3. **Atomic Per-Bill Synchronization**: Synced offline bills are processed individually by the backend with idempotent per-bill acknowledgements.
4. **Permanent Sequential Bill Numbers**: Permanent legal tax invoice numbers are minted exclusively by PostgreSQL sequences upon backend ingestion.

---

## 2. Online Billing Workflow

```
[ POS Terminal ]
  User selects items -> Terminal gathers:
  { branchId, items: [{ productId, variantId, quantity, addonIds }], customerPhone, paymentMethod }
        |
        v
[ POST /api/pos/bills ]
        |
        v
[ Backend POSService.calculateBill() ]
  1. Retrieve authoritative price from PostgreSQL / Redis catalog:
     - product.price, variant.price_delta, addon.price
  2. Compute authoritative subtotal, CGST, SGST, roundoff.
  3. Reject any request attempting to override tax rates or item base prices.
        |
        v
[ PostgreSQL Transaction ]
  - nextval('pos_bill_seq') for permanent bill_number
  - INSERT INTO pos_bills & pos_bill_items
  - Record payment transaction
  - COMMIT
        |
        v
[ Firestore Projection & KOT Dispatch ]
  - Project active bill to /active_pos_orders for KDS visibility
  - Return canonical finalized bill to POS terminal
```

---

## 3. Offline Mode & Synchronization Protocol

During network disconnections:
1. **Catalog Snapshot**: The POS maintains a local IndexedDB cache of the product catalog updated upon login.
2. **Local Queue**: Unsynced bills are stamped with an immutable UUID (`offlineBillId`), timestamp, and operator ID, then persisted in the `pos_offline_bills` IndexedDB store.
3. **Receipt Generation**: The customer receipt clearly indicates "OFFLINE DRAFT — PENDING RECONCILIATION" with a local sequence reference.

### Resilient Sync Queue Flow:
```
[ POS Network Listener ]
  Detects 'online' event -> Trigger Sync Routine
        |
        v
[ Drain Offline Queue (One Bill at a Time) ]
  For each bill in IndexedDB:
    POST /api/pos/bills/sync-offline
    Payload: { offlineBillId, branchId, items, paymentDetails, createdAt }
          |
          v
  [ Backend Verification ]
    - Checks Redis idempotency key: pos:sync:{offlineBillId}
    - If already processed: return existing bill_number & mark acknowledged
    - If new:
        - Resolves catalog prices
        - Begins PostgreSQL transaction
        - Mints official permanent bill_number
        - Inserts into pos_bills
        - Commits transaction
          |
          v
  [ Response: { success: true, officialBillNumber, offlineBillId } ]
          |
          v
[ Client Acknowledgement ]
  - Upon receiving HTTP 200 with matching offlineBillId:
    DELETE FROM pos_offline_bills WHERE id = offlineBillId
  - If network fails mid-sync: bill remains in queue and will safely retry (idempotent).
```

---

## 4. Financial Audit & Safeguards

- **No Overwriting Past Bills**: Synced offline bills do not backdate sequence numbers. PostgreSQL mints sequential numbers in the order of successful synchronization, recording both `client_created_at` and `synced_at`.
- **Price Discrepancy Reconciliation**: If a product price changed during the offline window, the backend reconciles using the price active at `client_created_at` or flags the discrepancy in the branch audit log for manager review.
- **Fail-Closed Protection**: If PostgreSQL is unavailable during sync, the endpoint returns HTTP 503, and the client retains the queue intact without data loss.
