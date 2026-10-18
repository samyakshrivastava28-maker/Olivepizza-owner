# Olive Pizza — API Contract & Cross-Application Communications Audit

**Document Version:** 1.0  
**Context:** Verification of REST, GraphQL, gRPC, and Realtime Interfaces

---

## 1. Authentication & Authorization Contracts

- **Bearer Token Contract:**
  All authenticated requests pass `Authorization: Bearer <FirebaseIdToken>`.
  Backend resolves UID via `adminAuth.verifyIdToken(token, true)` with revocation check.
- **Read-Only Scope Resolution:**
  User roles and permissions are resolved in read-only mode from Firestore (`users` collection).
  Auto-healing writes during authentication have been removed to eliminate race conditions and security regressions.
- **App Access Grants:**
  Independent boolean grants in `user.applicationAccess`:
  - `app_restaurant_management` → Restaurant Management App
  - `app_franchise_management` → Franchise Management App
  - `app_delivery` → Delivery Partner App
  - `app_pos` → POS Billing App

---

## 2. GraphQL Schema Contract

- **Query Depth Limiting:** Max AST depth is set to 6. Queries exceeding depth 6 fail validation.
- **Execution Timeout:** Enforced at 10,000ms.
- **Actor Context:**
  Extracted strictly on `/graphql` requests with UID and verified role (`OWNER`, `FRANCHISE_MANAGER`, `RESTAURANT_MANAGER`, etc.).
  Owner-only resolvers (`commandCenterSummary`, `topFranchises`, `criticalIncidents`, `franchisesList`) throw `FORBIDDEN` if caller lacks `OWNER` claim.
  Franchise resolvers (`franchiseWorkspace`) enforce `franchiseId === actor.franchiseId` for non-owners.

---

## 3. Order Transition Contract

State transitions follow a strict finite-state machine:
```
PENDING → ACCEPTED → PREPARING → READY → OUT_FOR_DELIVERY → DELIVERED
   ↓          ↓           ↓
REJECTED  CANCELLED   CANCELLED
```
- Only authoritative backend endpoints can transition order state.
- Transition updates Firestore operational document and enqueues/writes PostgreSQL synchronization.
- Status update triggers realtime listener in Customer App (`OrderTracking.tsx`) and sends push notification.

---

## 4. Live GPS Telemetry Contract

- **Transport:** Supabase Realtime / PostgreSQL `navigation_points`.
- **Retention Rule:** 5-minute hard expiry for active navigation coordinates.
- **Delivered Cleanup:** Upon transition to `DELIVERED`, coordinates are immediately purged by `SupabaseGpsService.cleanupDeliveredGps()`.
