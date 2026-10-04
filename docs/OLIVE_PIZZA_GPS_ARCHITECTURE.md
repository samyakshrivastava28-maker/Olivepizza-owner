# Olive Pizza — Live GPS & Telemetry Architecture

## 1. Executive Summary & Design Invariants

Live rider GPS telemetry is a mission-critical, high-frequency operational stream. To achieve sub-second live tracking without degrading core backend throughput or burdening transactional storage, Olive Pizza enforces a strict separation:

1. **Supabase Realtime is the Exclusive GPS Transport**: Rider devices stream location coordinates directly to Supabase (`delivery_locations` and `navigation_points`) over persistent WebSockets/HTTPS.
2. **Node/Express Backend Bypassed on Telemetry Hot Path**: The Node backend never proxies, relays, or parses raw coordinate pings. Node handles business control, role authorization, and order assignments only.
3. **Zero Live GPS in PostgreSQL**: No GPS coordinates, pings, or rider locations are ever written to or stored in PostgreSQL. PostgreSQL is reserved purely for permanent business and financial transactions.
4. **Single Shared Frontend Store for Restaurant Management**: A unified Zustand store (`useLiveRiderStore`) in the Restaurant Manager application subscribes once to Supabase Realtime and powers the **Dashboard**, **Live Orders Radar**, and **Delivery Management** views simultaneously without duplicate connections.
5. **Zero Synthetic / Fake Coordinates**: No randomized offsets, `Math.random()`, or fake coordinates are ever generated on the client or server. All tracking reflects authentic device telemetry or explicit offline indicators.

---

## 2. High-Frequency Pipeline: Rider Device -> Supabase

```
+-------------------------------------------------------------------------+
|                              Rider Device                               |
| (Capacitor Geolocation / Web Watcher @ olive-pizza-delivery)           |
+-------------------------------------------------------------------------+
       |                                                    |
       | Active Delivery (1.5s interval)                    | Idle Online (25s interval)
       v                                                    v
+-------------------------------------------------------------------------+
|                  offlineGpsBuffer (Client-Side Buffer)                  |
| - Validates coordinate sanity (-90..90 lat, -180..180 lng)              |
| - If offline: buffers FIFO in localStorage with 100-ping cap            |
| - If online: flushes FIFO and upserts direct to Supabase               |
+-------------------------------------------------------------------------+
       |
       | Direct HTTPS/WebSocket upsert (bypassing Node backend)
       v
+-------------------------------------------------------------------------+
|                       Supabase Realtime Database                        |
|                                                                         |
| Tables:                                                                 |
|   1. delivery_locations (latest state: lat, lng, heading, speed,        |
|      accuracy, online_status, active_order_id, updated_at)              |
|   2. navigation_points (breadcrumb log, retained for 24 hours max)      |
|                                                                         |
| Realtime Publication: supabase_realtime broadcasts row changes         |
+-------------------------------------------------------------------------+
       |
       | Supabase Realtime WebSocket Subscription (single connection)
       v
+-------------------------------------------------------------------------+
|                    Consuming Client Applications                        |
|                                                                         |
| 1. Customer Tracking (Olive-Pizza): subscribes to assigned rider row    |
| 2. Restaurant Manager: useLiveRiderStore (single multi-screen sync)     |
| 3. Owner Dashboard: fleet operational view                              |
+-------------------------------------------------------------------------+
```

---

## 3. Dynamic Telemetry Intervals & Battery Optimization

Telemetry cadence is dynamically controlled by operational state to preserve mobile device battery and data consumption while guaranteeing real-time customer tracking:

| Rider State | Telemetry Interval | Target Table | Destination |
| :--- | :--- | :--- | :--- |
| **Active Order Delivery** (`activeOrderId != null`) | **1.5 seconds** | `delivery_locations` + `navigation_points` | Direct Supabase |
| **Idle & Online** (`isOnline === true`, no order) | **25.0 seconds** | `delivery_locations` only | Direct Supabase |
| **Offline** (`isOnline === false`) | **0 seconds** (telemetry halted, final `online_status: false` sent) | `delivery_locations` | Direct Supabase |

---

## 4. Offline Resilience: `offlineGpsBuffer`

Network connectivity fluctuations during transit are handled by the resilient `offlineGpsBuffer` in `olive-pizza-delivery/src/lib/offlineGpsBuffer.ts`:
- **Local FIFO Queue**: Pings generated during connectivity blackouts are saved to persistent client storage (`localStorage` key: `olive_offline_gps_pings`).
- **Storage Limits**: Buffer is capped at 100 entries to prevent memory exhaustion; oldest non-critical pings drop if limits are exceeded.
- **Auto-Flush on Reconnection**: A `window.addEventListener('online', ...)` handler automatically drains the buffered backlog to Supabase when connectivity returns.

---

## 5. Restaurant Management 3-Screen Unified Architecture

In `Olive Pizza restaurant manager`, three separate pages require live rider visibility:
1. **DashboardPage**: Real-time fleet metrics (Online, Available, On Delivery, Offline) and overview map.
2. **LiveOrdersPage**: Live Fleet Radar map overlay showing which rider is assigned to active kitchen orders.
3. **DeliveryManagementPage**: Operational rider roster, individual rider telemetry, and focus inspection.

### Unified Store Implementation (`useLiveRiderStore`)
- Located at: `src/store/liveRiderStore.ts`.
- Subscribes **once** to Supabase `delivery_locations` on application boot via `supabase.channel('restaurant-live-riders')`.
- Merges high-frequency live GPS telemetry with Firestore rider profile documents (name, phone, vehicle, assigned branch).
- Enforces branch scoping: filters fleet by `activeBranchId`.
- Provides reactive state:
  - `riders`: Normalized map of live riders.
  - `onlineCount`, `availableCount`, `onDeliveryCount`, `offlineCount`: Derived fleet metrics.
  - `selectedRiderId` & `setSelectedRider`: Allows cross-component map centering and focus.
- Components consuming the store (`FleetLiveMap`, `DashboardPage`, `LiveOrdersPage`, `DeliveryManagementPage`) share the exact same state without redundant WebSocket connections.

---

## 6. Zero Live GPS in PostgreSQL (Clean Separation)

PostgreSQL schema and query pipelines have been thoroughly audited and stripped of live GPS storage:
- **Legacy tables dropped**: `location_history`, `active_deliveries`, `navigation_points`, and `delivery_locations` do not exist or receive writes in PostgreSQL.
- **Backend Services**: `DeliveryCapacityService.ts` and `scheduler.ts` communicate directly with `SupabaseGpsService` using server credentials for lifecycle management (e.g. setting online status or assigning active orders).
- **Retention & Purging**: `SupabaseGpsService.pruneStaleNavigationPoints(1440)` automatically prunes breadcrumbs older than 24 hours in Supabase, keeping storage lean.
