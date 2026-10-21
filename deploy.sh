#!/bin/bash
# BuckDuck 1-Click Fast Update & Deployment Script for Hostinger VPS

echo "🚀 Starting BuckDuck deployment on Hostinger VPS..."

# 1. Pull latest code
echo "📥 Pulling latest git updates..."
git pull origin main

# 2. Update Backend
echo "⚙️ Building NestJS backend..."
cd backend
npm install --omit=dev
npx prisma generate
npm run build
cd ..

# 3. Update Frontend
echo "💻 Building Next.js frontend..."
cd frontend
npm install --omit=dev
npm run build
cd ..

# 4. Reload PM2 with zero downtime
echo "🔄 Reloading PM2 processes..."
pm2 reload ecosystem.config.js || pm2 start ecosystem.config.js

echo "✅ BuckDuck successfully updated and running live!"
