# 👑 Olive Pizza Owner Portal (v2.2.0)

[![React](https://img.shields.io/badge/React-19.0-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-6.0-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4.0-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Capacitor](https://img.shields.io/badge/Capacitor-8.0-119EFF?logo=capacitor&logoColor=white)](https://capacitorjs.com/)
[![Electron](https://img.shields.io/badge/Electron-Desktop-47848F?logo=electron&logoColor=white)](https://electronjs.org/)

Administrative command center for the **Olive Pizza** franchise owner. Provides real-time financial surveillance, multi-branch operations, visual SDUI homepage designing with Google Stitch, menu synchronization, AI generation vault, and automated monthly reporting.

---

## 🌟 Feature Capabilities

- **Server-Driven UI (SDUI) Designer**:
  - Visual layout composer with live preview before publishing.
  - Integration with **Google Stitch** visual design engine and NVIDIA NIM DeepSeek V4 prompt enhancer.
  - Multi-version history, rollbacks, and instant real-time publishing to customer devices via Firestore.
- **Menu & Price Control**:
  - Global menu updates, franchise-specific price overrides, recipe management, and Cloudinary asset management.
- **AI Media & Template Studio**:
  - Image generation powered by FLUX.1-schnell, SD 3.5 Large, and Qwen Image.
  - Email and SMS campaign creator with customizable responsive templates.
- **Financial & Delivery Surveillance**:
  - Live revenue analytics, branch P&L, GST reconciliation, and real-time fleet radar tracking.
- **Administrative Access**:
  - Authorized accounts: `webhub2811@gmail.com` (Super Admin), `olivepizzarjn@gmail.com` (Owner).

---

## 📦 Latest Release Downloads (v2.2.0)

Staged in `C:\Users\RYZEN\Downloads\OlivePizza_Release_Binaries`:
- **Android APK**: `OlivePizza_Owner_v2.2.0_Release.apk` (26.56 MB)

---

## 🚀 Local Development

```bash
# Install dependencies
npm install

# Run owner dashboard on port 5174
npm run dev
# Open http://localhost:5174

# Production Build
npm run build
```

---

## 🌐 Render Deployment

Deployable to [Render](https://render.com) via `render.yaml`.
- Health check endpoint: `/api/heartbeat`
- Connects to authoritative backend (`olive-pizza-backend`)
