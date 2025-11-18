#!/bin/bash
echo "🚀 Starting deployment at $(date)"

cd /home/ubuntu/FIRAS_PFE_2025

# Get current commit hash
COMMIT_HASH=$(git rev-parse --short HEAD)
VERSION=$(node -p "require('./package.json').version")

# Pull latest code
echo "📥 Pulling latest code..."
git pull origin main

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Restart with PM2
echo "🔄 Restarting application with PM2..."
PORT=3000 pm2 reload devsecops-dashboard --update-env

# Wait for restart
echo "⏳ Waiting for application to restart..."
sleep 8

# Check if application is running
echo "🔍 Checking application status..."
if curl -f http://localhost:3000/health > /dev/null 2>&1; then
    echo "✅ Deployment completed successfully at $(date)"
    
    # Register REAL deployment with the server
    curl -X POST http://localhost:3000/api/deployment/ci-cd \
        -H "Content-Type: application/json" \
        -d "{\"status\":\"deployed\",\"commit\":\"$COMMIT_HASH\",\"version\":\"$VERSION\"}" \
        || echo "⚠️ Could not register deployment (server might be starting)"
    
    echo "🌐 Application is running at: http://localhost:3000"
    echo "📊 PM2 Status:"
    pm2 status
else
    echo "❌ Deployment failed - application not responding"
    echo "📋 Check server.log for details:"
    tail -20 server.log
    exit 1
fi
