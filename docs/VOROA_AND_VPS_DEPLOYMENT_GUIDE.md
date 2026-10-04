# 🚀 Olive Pizza Backend — Voroa & VPS Production Deployment Guide

This guide provides step-by-step instructions for deploying the **Olive Pizza Canonical Backend** to:
1. **Voroa Cloud (`getvoroa.com`)** — Modern India-first managed PaaS with auto-deploy from GitHub.
2. **Self-Hosted Linux VPS** — Ubuntu 22.04/24.04 or Debian 12 using Docker Compose or PM2.

---

## 1. Deploying to Voroa (`getvoroa.com`)

Voroa connects directly to your GitHub repository and automatically deploys whenever you push to your production branch.

### Option A: Standard Node.js Web Service (Recommended)

1. **Create Web Service in Voroa**:
   - Log into your Voroa dashboard.
   - Click **New Service** → **Web Service**.
   - Select your GitHub repository: `samyakshrivastava28-maker/Olivepizza-owner`.

2. **Configure Service Settings**:
   | Field | Value | Notes |
   | :--- | :--- | :--- |
   | **Root Directory** | `backend` | Tells Voroa to build from the backend folder |
   | **Environment** | `Node.js 20` | Native Node runtime |
   | **Build Command** | `npm run build` | Compiles and validates TypeScript types |
   | **Start Command** | `npm start` | Runs `tsx server.ts` |
   | **Port** | `5000` | Internal port exposed by Express |
   | **Health Check Path** | `/health/live` | Voroa uses this to verify deployment health |

3. **Provision Databases (PostgreSQL & Redis)**:
   - You can provision **Voroa Managed PostgreSQL** directly in Voroa and link it to the service, or point `DATABASE_URL` to your existing Render or VPS PostgreSQL database.
   - You can provision **Voroa Managed Redis** in Voroa, or point `REDIS_URL` to your existing Redis instance.

4. **Add Environment Variables**:
   In the Voroa **Environment Variables** tab, add your credentials (see section 3 below).

5. **Attach Custom Domain**:
   - In Voroa Settings, add your API domain (e.g. `api.olivepizza.in`).
   - Add the CNAME record in your DNS provider (Cloudflare / Hostinger) pointing to Voroa.
   - Voroa automatically provisions and renews SSL certificates.

---

### Option B: Docker Container Deployment on Voroa

If you prefer deploying via container:
1. In Voroa, select **Deploy with Dockerfile**.
2. **Dockerfile Path**: `backend/Dockerfile` (or root context).
3. **Port**: `5000`.
4. **Healthcheck**: `/health/live`.
5. Enter Environment Variables and deploy.

---

## 2. Deploying to a Linux VPS (Ubuntu / Debian)

### Prerequisites on VPS
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Git, Curl, and Node.js 20 (if using PM2)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y git curl build-essential nginx certbot python3-certbot-nginx nodejs
```

---

### Method A: Docker Compose (Easiest & Complete)

The repository includes a production-ready `docker-compose.yml` orchestrating the backend, PostgreSQL, Redis, and Nginx with SSL.

1. **Clone repository onto VPS**:
   ```bash
   cd /var/www
   git clone https://github.com/samyakshrivastava28-maker/Olivepizza-owner.git
   cd Olivepizza-owner
   ```

2. **Configure Environment**:
   ```bash
   cp backend/.env.example backend/.env
   nano backend/.env
   ```

3. **Start all services**:
   ```bash
   docker compose up -d --build
   ```

4. **Verify Health**:
   ```bash
   curl http://127.0.0.1:5000/health/live
   # Returns: {"status":"healthy","service":"olive-pizza-owner-backend",...}
   ```

---

### Method B: PM2 Native Node Process (Highest Performance)

1. **Install PM2 globally**:
   ```bash
   sudo npm install -g pm2
   ```

2. **Setup Backend**:
   ```bash
   cd /var/www/Olivepizza-owner/backend
   npm ci --omit=dev
   npm run build
   ```

3. **Start with PM2 using bundled configuration**:
   ```bash
   pm2 start ecosystem.config.cjs
   pm2 save
   pm2 startup
   ```

4. **Automated Zero-Downtime Updates**:
   Whenever you pull new code:
   ```bash
   chmod +x scripts/deploy-vps.sh
   ./scripts/deploy-vps.sh pm2
   ```

---

### Method C: Systemd Linux Service

If you prefer standard Linux systemd:
```bash
sudo cp backend/olive-pizza-backend.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now olive-pizza-backend
sudo systemctl status olive-pizza-backend
```

---

## 3. Nginx Reverse Proxy & Free Let's Encrypt SSL on VPS

If running natively with PM2 / Systemd:

1. **Configure Nginx Site**:
   ```bash
   sudo nano /etc/nginx/sites-available/olive-pizza-api
   ```

   Paste the configuration:
   ```nginx
   server {
       listen 80;
       server_name api.olivepizza.in;

       # Max body size for 50MB video and image uploads
       client_max_body_size 60M;

       location / {
           proxy_pass http://127.0.0.1:5000;
           proxy_http_version 1.1;

           # WebSocket support
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection "upgrade";

           # Standard headers
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;

           # Timeouts
           proxy_connect_timeout 60s;
           proxy_send_timeout 60s;
           proxy_read_timeout 60s;
       }
   }
   ```

2. **Enable site & test**:
   ```bash
   sudo ln -s /etc/nginx/sites-available/olive-pizza-api /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl restart nginx
   ```

3. **Provision Free Automated SSL Certificate**:
   ```bash
   sudo certbot --nginx -d api.olivepizza.in
   ```

---

## 4. Key Environment Variables Checklist

Ensure these variables are set in your Voroa dashboard or VPS `.env`:

```env
PORT=5000
NODE_ENV=production
ALLOWED_ORIGINS=https://olivepizza.in,https://admin.olivepizza.in

# PostgreSQL (Business Data Source of Truth)
DATABASE_URL=postgresql://...

# Redis (Cache & Distributed Lock)
REDIS_URL=redis://...

# Firebase Admin
FIREBASE_PROJECT_ID=olive-pizza-rjn
FIREBASE_SERVICE_ACCOUNT_BASE64=...

# Supabase (GPS Telemetry)
SUPABASE_URL=https://...
SUPABASE_SERVICE_ROLE_KEY=...

# Cloudinary (Media Pipeline)
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...

# Notifications
FAST2SMS_API_KEY=...
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...
```
