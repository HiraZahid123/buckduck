# BuckDuck | StoreFront USA — Production Marketplace Platform

Universal fullstack marketplace for multi-vendor Saturday grocery deliveries, built with **Next.js** (App Router frontend) and **NestJS** (Modular backend), backed by **PostgreSQL on Neon DB**.

---

## 🏗️ Architecture & Stack

| Layer | Technology | Details |
|---|---|---|
| **Frontend** | Next.js 14 (React 18, TypeScript) | Server & Client Components, App Router, BuckDuck CSS Design System, PWA ready |
| **Backend** | NestJS (Node.js, TypeScript) | Modular Monolith, JWT Auth, RBAC Guards, Swagger Docs, CORS configured |
| **Database** | PostgreSQL on **Neon DB** | 9 relational models, introspected and managed via **Prisma ORM** |
| **Hosting & Ops** | Hostinger KVM VPS / PM2 / Docker | Zero-downtime reloads, PM2 ecosystem, Docker Compose, Nginx reverse proxy |

---

## ⚡ Quick Start (Local Development)

### 1. Install & Build
Both backend and frontend dependencies are configured. To run both concurrently:

```bash
# In the root project directory:
npm run dev
```

* **Frontend:** [http://localhost:3000](http://localhost:3000)
* **Backend API:** [http://localhost:4000/api](http://localhost:4000/api)
* **Interactive Swagger Docs:** [http://localhost:4000/api/docs](http://localhost:4000/api/docs)

---

## 🔑 Demo Accounts (Pre-Seeded in Neon DB)

The system includes a **1-Click Demo Switcher** directly in the top navigation bar. You can test each role instantly:

| Role | Email | Password | Access / Portal |
|---|---|---|---|
| 🛒 **Customer** | `customer@buckduck.com` | `demo1234` | Browse, Cart, Checkout, Order Tracking |
| 🏪 **Merchant** | `merchant@buckduck.com` | `demo1234` | Kitchen Kanban, Audio Chime, Ready Bag Dialog, Payouts |
| 🚗 **Driver** | `driver@buckduck.com` | `demo1234` | Saturday Job Board, 1-Tap Google Maps Route, Photo Proof |
| ⚙️ **Admin** | `admin@buckduck.com` | `demo1234` | Live Dispatch, Order Overrides, Store Approvals, Finance |

---

## 🌐 Deploying to Hostinger VPS (Fast Client Updates)

### Option A: Direct PM2 Deployment (Recommended for Speed)
Hostinger KVM VPS allows running Node.js apps directly with PM2:

1. **Connect to your Hostinger VPS via SSH**:
   ```bash
   ssh root@your-vps-ip
   ```
2. **Clone the repository**:
   ```bash
   git clone <your-repo-url> /var/www/buckduck
   cd /var/www/buckduck
   ```
3. **Build and start via PM2**:
   ```bash
   npm run build
   npm run start
   ```
   *(This launches both `buckduck-backend` on port 4000 and `buckduck-frontend` on port 3000 using `ecosystem.config.js`).*

4. **Setup Nginx**:
   Copy [`nginx.conf`](file:///d:/buck-duck/nginx.conf) to `/etc/nginx/sites-available/buckduck`:
   ```bash
   sudo cp nginx.conf /etc/nginx/sites-available/buckduck
   sudo ln -s /etc/nginx/sites-available/buckduck /etc/nginx/sites-enabled/
   sudo nginx -t && sudo systemctl reload nginx
   ```

5. **Future Fast Updates**:
   Whenever you push new features or fixes for the client, simply execute on the server:
   ```bash
   ./deploy.sh
   ```
   This automatically pulls code, builds, and reloads PM2 with zero downtime!

---

### Option B: Docker Compose Deployment
If you prefer containerized hosting on Hostinger:

```bash
docker compose up -d --build
```
Both the Next.js frontend and NestJS backend will start up inside optimized Alpine Linux containers and communicate seamlessly.

---

## 🗄️ Neon DB Configuration
The database connection is set up in `backend/.env` and `ecosystem.config.js`:
```env
DATABASE_URL="postgresql://neondb_owner:npg_uwgqFW46ryYb@ep-damp-term-b4kxob0n-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require"
```
The live tables (`users`, `stores`, `products`, `delivery_windows`, `orders`, `order_items`, `checkouts`, `order_events`, `settings`) are connected and verified.
