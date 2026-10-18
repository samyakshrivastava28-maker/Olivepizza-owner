# Olive Pizza — Requirements Ledger & UI Invariants

**Document Version:** 1.0  
**Context:** Preservation of Existing Architecture, Workspaces, and Operational Controls

---

## 1. Core Architectural Invariants

1. **Owner Command Center as Central Control:**
   - The Owner app serves as the central control plane for the entire business.
   - High-priority landing page: **Command Center** (`/`).
   - Must preserve all existing Owner navigation pages:
     - Analytics / Dashboard (`/analytics`)
     - Franchise Management (`/franchises`)
     - Home Page Manager & SDUI (`/homepage-manager`)
     - Menu Management (`/menu`)
     - Reports (`/reports`)
     - Notifications (`/notifications`)
     - Email Management (`/email`)
     - Ads & Offers (`/marketing`)
     - Media Management (`/media`)
     - Order Management (`/orders`)
     - Settings (`/settings`)
2. **Franchise Workspaces:**
   - Every franchise operates in a dedicated, isolated workspace.
   - Cross-franchise access is strictly blocked at both GraphQL and REST authorization layers.
   - Data displayed must reflect only the authorized franchise's assigned branches.
3. **Operational Applications:**
   - **Restaurant Management:** Dedicated kitchen and live fulfillment workspace. Branch-isolated.
   - **Franchise Management:** Multi-branch oversight, staff management, and financial summaries for authorized franchise managers.
   - **Delivery Partner:** Rider shift status, live assigned order navigation, and proof-of-delivery.
   - **POS:** Table billing, offline-safe item catalog, thermal receipt generation, and day-end shift closure.
4. **Customer Experience:**
   - High-definition live order tracking with status updates.
   - Dedicated Bill Page (`/bill/:billReference`) with 2x resolution JPEG export.
   - Side profile navigation with account settings, notification preferences, and OS permission status.
5. **Sound Alert Standard:**
   - 5 distinct audible alert sounds for Restaurant Manager and Delivery Partner apps.
   - Sound selection persisted in client settings; audio test preview available.
   - Order alerts deduplicated by unique order ID to avoid repeating sirens.
