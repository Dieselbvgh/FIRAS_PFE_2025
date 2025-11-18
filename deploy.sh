#!/bin/bash
echo "🚀 Starting deployment at $(date)"

cd /home/ubuntu/FIRAS_PFE_2025

# Pull latest code
echo "📥 Pulling latest code..."
git pull origin main

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Restart with PM2 (this is the proper way - no killing needed)
echo "🔄 Restarting application with PM2..."
PORT=3000 pm2 reload devsecops-dashboard --update-env

# Wait for restart
echo "⏳ Waiting for application to restart..."
sleep 8

# Check if application is running
echo "🔍 Checking application status..."
if curl -f http://localhost:3000/health > /dev/null 2>&1; then
    echo "✅ Deployment completed successfully at $(date)"
    echo "🌐 Application is running at: http://localhost:3000"
    echo "📊 PM2 Status:"
    pm2 status
else
    echo "❌ Deployment failed - application not responding"
    echo "📋 PM2 logs:"
    pm2 logs --lines 10
    exit 1
fi
