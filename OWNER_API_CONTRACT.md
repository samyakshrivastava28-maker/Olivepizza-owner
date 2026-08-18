# Olive Pizza Owner — API Contract Documentation

All protected API requests are authenticated by passing the user's Firebase ID Token in the header:
`Authorization: Bearer <FIREBASE_ID_TOKEN>`

---

## 1. Authentication & Identity
- **Provider**: Firebase Authentication (Google OAuth + Email/Password)
- **Authorized Accounts**: `olivepizzarjn@gmail.com`, `webhub2811@gmail.com`
- **Role Verification**: Verified on backend by `verifyToken` & `requireRole(['owner', 'admin'])`.

---

## 2. Orders API
### `GET /api/orders`
- **Description**: Fetch list of orders.
- **Query Params**: `status`, `limit`, `dateFrom`, `dateTo`
- **Response**: Array of `Order` objects.

### `PATCH /api/orders/:id/status`
- **Description**: Advance or update order status.
- **Request Body**: `{ "status": "preparing" | "out_for_delivery" | "delivered" | "cancelled", "cancelReason"?: string }`
- **Response**: `{ "success": true, "order": Order }`

### `POST /api/orders/:id/assign`
- **Description**: Assign active order to a delivery partner.
- **Request Body**: `{ "partnerId": string }`
- **Response**: `{ "success": true }`

---

## 3. Menu & Catalog API
### `GET /api/menu`
- **Description**: Get full products, categories, combos catalog.
- **Response**: `{ "products": Product[], "categories": Category[] }`

### `POST /api/admin/products` / `PUT /api/admin/products/:id` / `DELETE /api/admin/products/:id`
- **Description**: Create, update, or remove menu products.
- **Request Body**: `Partial<Product>`
- **Response**: `{ "success": true, "product": Product }`

---

## 4. Media & Cloudinary API
### `GET /api/media-library`
- **Description**: List uploaded assets stored in Cloudinary.
- **Response**: `{ "resources": MediaItem[] }`

### `POST /api/media/upload`
- **Description**: Upload images or videos directly to Cloudinary storage.
- **Request Body**: `FormData` (`file`)
- **Response**: `{ "url": string, "public_id": string, "format": string, "bytes": number }`

---

## 5. Home Page Manager (SDUI) API
### `GET /api/home-page-manager/config`
- **Description**: Fetch active and draft SDUI home page configurations.
- **Response**: `{ "config": SDUIConfig, "versions": SDUIHistory[] }`

### `POST /api/home-page-manager/publish`
- **Description**: Publish approved SDUI draft layout to live customer site.
- **Request Body**: `{ "config": SDUIConfig }`
- **Response**: `{ "success": true, "version": number }`

### `POST /api/home-page-manager/rollback`
- **Description**: Roll back SDUI layout to previous version snapshot.
- **Request Body**: `{ "versionId": string }`
- **Response**: `{ "success": true }`

---

## 6. Reports & Analytics API
### `GET /api/reports/sales`
- **Description**: Financial sales summary and product breakdowns.
- **Query Params**: `startDate`, `endDate`, `period`
- **Response**: `{ "revenue": number, "ordersCount": number, "breakdown": [] }`

### `GET /api/website-analytics/summary`
- **Description**: Realtime website visitor metrics and section engagement.
- **Response**: `{ "totalVisits": number, "activeSessions": number, "conversions": number }`

---

## 7. Notifications & Health Monitoring
### `POST /api/notifications/send-custom`
- **Description**: Broadcast targeted custom FCM push notification.
- **Request Body**: `{ "title": string, "body": string, "audience": "all" | "customers" | "owners", "data"?: object }`
- **Response**: `{ "success": true, "sentCount": number }`

### `GET /api/heartbeat`
- **Description**: Check backend and AI subsystem vitality and response latencies.
- **Response**: `{ "status": "ok", "uptime": number, "aiConnected": boolean, "postgresConnected": boolean }`
