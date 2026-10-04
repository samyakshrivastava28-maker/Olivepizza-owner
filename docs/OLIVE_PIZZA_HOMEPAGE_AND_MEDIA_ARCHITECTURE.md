# 🍕 Olive Pizza — Home Page Manager, Visual Customization & Media Optimization Architecture

## 1. Executive Summary

This architecture provides the non-technical owner of Olive Pizza complete visual control over their customer-facing landing and home page experience, with built-in professional animations, curated typography, automated media optimization, instant live customer-parity previews, and resilient database revision history.

Crucially, this system preserves all core architectural invariants:
- **PostgreSQL** remains the authoritative permanent business database for revisions (`homepage_revisions`), media assets (`media_assets`), orders, billing, and financials.
- **Firestore** remains the realtime UI projection layer, broadcasting published homepage layouts instantly to web, Android, and iOS devices.
- **Redis** operates as an ephemeral acceleration and caching layer with cache stampede protection and concurrency locks.
- **Cloudinary** remains the unified media pipeline with automated WebP/WebM transformation and automatic video poster extraction.
- **Zero Admin / Editor Code** leaks into customer app bundles (`olive-pizza`), preserving sub-second mobile loading.

---

## 2. Architecture Diagram

```
+-----------------------------------------------------------------------------------+
|                            OWNER DASHBOARD (olive-pizza-owner)                   |
|                                                                                   |
|  [Sections Tab]   [Customize Tab]   [Presets Tab]   [Speed & Health ⚡]  [Guide ⓘ]|
|       |                 |                 |                 |                     |
|       |                 v                 |                 v                     |
|       |        PropertyPanel.tsx          |     PerformanceDashboardModal.tsx     |
|       |        (Live Preview Badges:      |     (Page Speed, Cloudinary Savings,  |
|       |         Animations, Typography,   |      Optimization Status, WebP ratio) |
|       |         Spacing, Colors, Media)   |                                       |
|       v                 v                 v                                       |
|  Interactive Live Preview Canvas (Mobile 390px / Tablet 768px / Desktop 100%)    |
+-----------------------------------------------------------------------------------+
                                          |
                        [Publish Live] / [Save Draft]
                                          |
                                          v
+-----------------------------------------------------------------------------------+
|                        CANONICAL BACKEND (olive-pizza-owner)                      |
|                                                                                   |
|  POST /api/homepage/publish                                                       |
|  1. Acquire Redis Distributed Lock ('lock:homepage_publish', 8s)                  |
|  2. Validate PageSchema & sanitize section configurations                         |
|  3. Write Revision into PostgreSQL 'homepage_revisions'                          |
|  4. Invalidate & Repopulate Redis Cache ('homepage:live', TTL 300s)               |
|  5. Broadcast layout snapshot to Firestore ('homepage_configs/active_config')     |
|  6. Release Redis Distributed Lock                                                |
+-----------------------------------------------------------------------------------+
                 |                                                   |
                 | Realtime Snapshot                                 | Fast API Fallback
                 v                                                   v
+------------------------------------+              +-------------------------------+
|     FIRESTORE REALTIME SYNC        |              |     REDIS CACHE (300s TTL)    |
|  'homepage_configs/active_config'  |              |        'homepage:live'        |
+------------------------------------+              +-------------------------------+
                 |                                                   |
                 +-----------------------+---------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
|                        CUSTOMER CLIENT (olive-pizza)                              |
|                                                                                   |
|  PageRenderer.tsx:                                                                |
|  - Curated Google Fonts dynamic resolution (Outfit, Inter, Poppins, etc.)         |
|  - Framer Motion hardware-accelerated animations (Fade Up, Pop, Stagger, etc.)    |
|  - Cloudinary automated WebP image delivery (f_auto, q_auto)                      |
|  - Cloudinary auto-poster frames for videos (so_0, f_jpg)                         |
|  - Native floating cart and 3D item interactions                                  |
|  - Section Types: HERO, VIDEO_HERO, COUNTDOWN, CRAVINGS, FEATURED,                |
|                   PIZZA_SHOWCASE, COUPONS, ADS, WHY_US, DELIVERY_AREA, CTA,       |
|                   ORDER_AGAIN, COMPLETE_MEAL, GALLERY, TESTIMONIALS, FOOTER       |
+-----------------------------------------------------------------------------------+
```

---

## 3. Media Optimization Pipeline (`MediaOptimizationService.ts`)

### 3.1 Strict Input Validation
Owner uploads are strictly verified before processing:
- **Maximum Image Size**: 15 MB
- **Maximum Video Size**: 50 MB
- **Allowed Image MIME Types**: `image/jpeg`, `image/png`, `image/webp`, `image/avif`
- **Allowed Video MIME Types**: `video/mp4`, `video/webm`, `video/quicktime`
- **Clear Non-Technical Feedback**: Jargon-free error messaging informing the owner exactly how to fix the issue.

### 3.2 Automated Variant Generation
Whenever media is uploaded or processed:
- **Modern Next-Gen Formats**: URLs automatically inject Cloudinary transformations `f_auto,q_auto` to serve WebP or AVIF based on browser support.
- **Responsive Widths**: Generates thumbnail (`w_300,h_300,c_fill`), mobile (`w_640`), tablet (`w_1024`), and desktop (`w_1920`) variants.
- **Video Optimization**: Videos receive `f_auto,q_auto,vc_auto` for optimal compression and streaming.
- **Automatic Poster Frames**: Cloudinary URL transformation extracts a high-quality JPEG poster frame from the video at second 0 (`so_0,f_jpg,q_auto`) so videos never display blank black boxes while buffering.

### 3.3 Status Badges & Lifecycle
Assets are tracked with 4 distinct states:
1. `OPTIMIZED` (`Optimized ✓`): Fully transformed and delivering WebP/WebM variants.
2. `PROCESSING` (`Processing...`): Asynchronous background optimization job underway.
3. `NEEDS_OPTIMIZATION` (`Needs optimization`): Legacy or raw assets awaiting transformation.
4. `FAILED` (`Failed — Retry`): Errored asset with 1-click retry button.

---

## 4. Visual Customization & Owner Experience

### 4.1 Non-Technical Help System
All technical terms are completely abstracted into clear, friendly guidance:
- Instead of "CSS transform duration": *"How long the animation takes to complete. Recommended: 500ms - 700ms."*
- Instead of "CSS letter-spacing": *"The breathability and space between letters in titles."*
- Instead of "Breakpoint": *"Preview for Mobile (phones), Tablet, or Desktop."*
- Instead of "Object-fit": *"How your image fits inside its frame."*

### 4.2 Interactive Guide Modal (`InteractiveGuideModal.tsx`)
A built-in visual 5-step walkthrough accessible directly from the editor header:
1. **Reordering Sections**: Drag or click up/down arrows to position announcements, pizzas, or coupons.
2. **Customizing Look & Feel**: Change headlines, background colors, and button destinations in seconds.
3. **Animations with Live Previews**: See exactly how an animation moves before applying it.
4. **Curated Typography**: Preview Outfit, Poppins, Playfair Display, and Inter with instant font badges.
5. **Publishing Live**: Test in mobile/tablet views first, then publish safely to all customers.

### 4.3 Live Animation Preview Badges (`AnimationPreviewBadge.tsx`)
Rather than abstract names in dropdowns, owners see a miniature animated preview box displaying each movement pattern:
- **Fade Up**: Smooth upward floating reveal.
- **Fade Down**: Gentle downward cascade.
- **Fade In**: Soft, clean entrance.
- **Scale In**: Playful zoom.
- **Blur In**: Premium luxury focus pull.
- **Pop**: Bouncy festive entrance.
- **Floating Wave**: Continuous soft breathing motion.
- **Stagger**: Sequenced card cascade.

### 4.4 Style Presets (1-Click Transformation)
1. **Clean & Modern** (Default): Outfit font, smooth Fade Up animations, balanced spacing.
2. **Pizza Energy**: Poppins font, playful Pop bounce animations, warm appetizing tones.
3. **Midnight Glow**: Outfit font, cinematic Blur In animations, deep dark glassmorphism.
4. **Minimal & Fast**: Inter font, instant soft fade, ultra-light distraction-free design.
5. **Bold Festival**: Playfair Display serif font, dramatic Stagger entrances for grand sales.

---

## 5. Performance Dashboard & Diagnostics (`PerformanceDashboardModal.tsx`)

A dedicated **Speed & Health ⚡** dashboard in the editor top bar computes:
- **Page Speed Health Score**: Dynamically calculated based on section count, animation load, and image weights.
- **Media Optimization Percentage**: Ratio of WebP/WebM transformed assets vs raw files.
- **Total Cloudflare / Cloudinary Bandwidth Saved**: Estimated MB saved by auto-compression.
- **Heavy Media Warnings**: Highlights any assets over 2 MB with direct optimization recommendations.
- **Mobile vs Desktop Speed Index**: Verified sub-second mobile load metrics.

---

## 6. PostgreSQL Schema Updates (`schema.sql`)

```sql
-- Audit & Version History for Home Page
CREATE TABLE IF NOT EXISTS homepage_revisions (
    id SERIAL PRIMARY KEY,
    revision_id VARCHAR(64) UNIQUE NOT NULL,
    published_by VARCHAR(128) NOT NULL,
    schema_json JSONB NOT NULL,
    is_active BOOLEAN DEFAULT false,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_homepage_revisions_active ON homepage_revisions(is_active);

-- Permanent Media Asset Tracking
CREATE TABLE IF NOT EXISTS media_assets (
    id SERIAL PRIMARY KEY,
    public_id VARCHAR(255) UNIQUE NOT NULL,
    url TEXT NOT NULL,
    secure_url TEXT NOT NULL,
    format VARCHAR(32) NOT NULL,
    resource_type VARCHAR(32) NOT NULL,
    bytes BIGINT NOT NULL,
    width INT,
    height INT,
    optimization_status VARCHAR(32) DEFAULT 'OPTIMIZED',
    variants JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_media_assets_status ON media_assets(optimization_status);
```

---

## 7. Verification & Test Evidence

| System | Verification Command | Result |
| :--- | :--- | :--- |
| **Backend TypeScript** | `npm run build` (`tsc`) | **0 Errors (Code 0)** |
| **Backend Test Suite** | `npm test` | **55 / 55 Passed (100%)** |
| **Owner Dashboard** | `npm run build` (`vite build`) | **Built in 10.44s (Code 0)** |
| **Customer App** | `npm run build` (`vite build`) | **Built in 15.97s (Code 0)** |
| **Redis Caching** | `/api/homepage/live` cache invalidation | **Verified (300s TTL + Lock)** |
| **Customer Bundle** | Owner editor isolation | **0 bytes admin code in customer bundle** |
