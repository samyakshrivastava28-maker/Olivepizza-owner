# 🍕 Olive Pizza Owner — Standalone Management Platform

A standalone, production-focused restaurant management web application and Android app built for **Olive Pizza**.

---

## 🌟 Overview

- **Purpose**: Unified control center for orders, menu, delivery fleet, financial reports, SDUI layout management, and operational diagnostics.
- **Architecture**: Lightweight React 19 + TypeScript client connecting directly to the central Olive Pizza Backend, Firestore, Firebase Auth, FCM, and Cloudinary.
- **Platforms**:
  1. **Owner Web App**: Responsive desktop and tablet dashboard with dense operational tables and charts.
  2. **Owner Android App**: Native Capacitor container with full-screen emergency order alerts and background push notifications.

---

## 🚀 Quick Start

### 1. Prerequisites
- Node.js `v20+` or `v22+`
- Main Olive Pizza Backend running on `http://localhost:3000` (or configured production backend)

### 2. Installation
```bash
# Clone or enter the project directory
cd olive-pizza-owner

# Install dependencies
npm install
```

### 3. Environment Variables
Copy `.env.example` to `.env` and verify your settings:
```bash
cp .env.example .env
```

### 4. Running Locally
```bash
# Starts development server on http://localhost:5174
npm run dev
```

### 5. Building for Production
```bash
npm run build
```

### 6. Android App (Capacitor)
```bash
# Sync web build to Android project
npx cap sync android

# Open Android Studio
npx cap open android
```

---

## 🛡️ Security & Strict Access Rules

- **Allowed Owner Accounts**:
  - `olivepizzarjn@gmail.com`
  - `webhub2811@gmail.com`
- Any unapproved account attempting to sign in is blocked at the authentication gate with:
  *"Owner access is not available for this account."*
- Every protected backend request automatically attaches `Authorization: Bearer <Firebase_ID_Token>`.

---

## 📂 Feature Parity & API Specs

- See [`OWNER_FEATURE_PARITY.md`](./OWNER_FEATURE_PARITY.md) for full feature mappings.
- See [`OWNER_API_CONTRACT.md`](./OWNER_API_CONTRACT.md) for endpoint contracts.
