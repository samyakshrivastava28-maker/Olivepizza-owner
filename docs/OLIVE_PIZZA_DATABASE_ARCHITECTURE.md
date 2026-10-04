# OLIVE PIZZA — DATABASE ARCHITECTURE & PERMANENT SOURCE OF TRUTH

**Classification**: Architectural Authority Document  
**Status**: Certified & Implemented  
**Date**: October 4, 2026  

---

## 1. Core Principle: PostgreSQL is the Permanent Business Source of Truth

In the Olive Pizza ecosystem, **PostgreSQL is the single, authoritative, and permanent source of truth for all business and financial transactions**.

```text
PostgreSQL = "What actually happened in the business?"
Firestore  = "What should the applications see right now?"
Redis      = "What can be cached or coordinated with microsecond latency?"
Supabase   = "Where is the delivery rider right at this exact second?"
```

If Firestore, Redis, or Supabase were completely reset or lost, the complete financial history, audit logs, order books, and business state are **100% recoverable from PostgreSQL**.

---

## 2. Authoritative PostgreSQL Entities

The following business records permanently reside in PostgreSQL:
* **Orders & Order Items**: Final prices, quantities, chosen variants, custom addons, and final bill numbers.
* **Financial Ledgers**: Taxes (5% GST: 2.5% CGST + 2.5% SGST), discounts, delivery charges, packaging fees, and gross/net bill amounts.
* **Permanent Bill Numbers**: Sequential, gap-free, non-reusable bill numbers generated via PostgreSQL sequence `bill_number_seq` and `BillingNumberService`.
* **Payments & Transactions**: Provider order IDs, payment intent IDs, captured amounts, transaction fees, timestamps, and refund receipts.
* **Catalog & Pricing**: Products, categories, product variants, addons, combos, base prices, and availability flags.
* **Organizational Structure**: Franchises, restaurant branches, geofenced serviceable delivery zones, and store hours.
* **Users & RBAC Claims**: User profiles, roles (`owner`, `franchise_owner`, `restaurant_manager`, `kitchen_staff`, `delivery_partner`, `customer`), and branch assignments.
* **Accounting & Compliance**: DPDP privacy consents, data correction requests, and monthly accounting source ledgers.

---

## 3. Strict Absence of Live GPS Telemetry in PostgreSQL

High-frequency GPS telemetry (1 coordinate every 1–2 seconds per rider) creates severe write amplification, bloated write-ahead logs (WAL), and connection starvation in relational databases.

**PostgreSQL does NOT store live rider GPS coordinates or breadcrumbs.**
* `active_deliveries` has been permanently dropped (`DROP TABLE IF EXISTS active_deliveries CASCADE;`).
* `delivery_locations` has been permanently dropped (`DROP TABLE IF EXISTS delivery_locations CASCADE;`).
* `location_history` has been permanently dropped (`DROP TABLE IF EXISTS location_history CASCADE;`).
* All live GPS ingestion and streaming hot paths are delegated strictly to **Supabase Realtime**.

---

## 4. Hosting Neutrality: Render PostgreSQL → VPS PostgreSQL Migration Strategy

The database architecture is designed with **zero dependency on any cloud provider-specific proprietary features**.

### Current Deployment
* **Render PostgreSQL** (Testing, Staging, Initial Production)
* Connected via standard `DATABASE_URL` / `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`.
* SSL mode: `verify-full` / `require` with connection pooling via `pg.Pool` (max 20 connections per instance).

### Target Deployment: VPS PostgreSQL (Self-Hosted Linux / Docker / Bare Metal)
When migrating to VPS PostgreSQL:
1. **Zero Code Changes**: The backend database connector (`src/config/postgres.ts`) relies purely on standard PostgreSQL connection parameters. No Render-specific SDKs or extensions are used.
2. **Schema Migration**:
   ```bash
   # Export current schema and data from Render
   pg_dump --clean --if-exists --no-owner --no-privileges -d "$RENDER_DATABASE_URL" -f olive_pizza_backup.sql
   
   # Import directly to VPS PostgreSQL
   psql -d "$VPS_DATABASE_URL" -f olive_pizza_backup.sql
   ```
3. **Environment Switch**: Update `DATABASE_URL` in the environment configuration:
   ```env
   DATABASE_URL=postgresql://olive_admin:<secret_password>@vps.olivepizza.in:5432/olive_pizza_prod?sslmode=prefer
   ```
4. **Connection Pool Sizing**:
   On VPS with PgBouncer:
   ```ini
   [databases]
   olive_pizza_prod = host=127.0.0.1 port=5432 dbname=olive_pizza_prod
   
   [pgbouncer]
   pool_mode = transaction
   max_client_conn = 1000
   default_pool_size = 25
   ```
5. **Zero Downtime Cutover**:
   - Set current instance to Read-Only mode.
   - Run final delta sync via `pg_dump --data-only`.
   - Update backend connection strings and restart instances.

---

## 5. Fail-Closed Enforcement

If PostgreSQL is unreachable or an insert fails:
* **The transaction fails closed**.
* Online checkout throws HTTP 500 / 503 and rolls back.
* Payment gateway intents are **never generated without an atomically committed PostgreSQL record**.
* POS terminals operate in resilient offline mode, buffering bills locally with idempotency keys until PostgreSQL reconnects.
