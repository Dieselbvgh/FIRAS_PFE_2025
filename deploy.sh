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

# Stop any running Node processes
echo "🛑 Stopping any existing processes..."
pkill -f "node server.js" || true
sleep 3

# Start/Restart with PM2
echo "🔄 Starting application with PM2..."
PORT=3000 pm2 start server.js --name "devsecops-dashboard" --update-env || PORT=3000 pm2 start server.js --name "devsecops-dashboard"

# Wait for restart
echo "⏳ Waiting for application to start..."
sleep 10

# Check if application is running
echo "🔍 Checking application status..."
if curl -f http://localhost:3000/health > /dev/null 2>&1; then
    echo "✅ Deployment completed successfully at $(date)"
    
    # Register REAL deployment with the server
    curl -X POST http://localhost:3000/api/deployment/ci-cd \
        -H "Content-Type: application/json" \
        -d "{\"status\":\"deployed\",\"commit\":\"$COMMIT_HASH\",\"version\":\"$VERSION\"}" \
        || echo "⚠️ Could not register deployment"
    
    echo "🌐 Application is running at: http://localhost:3000"
    echo "📊 PM2 Status:"
    pm2 status
else
    echo "❌ Deployment failed - application not responding"
    echo "🔄 Attempting manual start..."
    PORT=3000 node server.js &
    sleep 5
    
    if curl -f http://localhost:3000/health > /dev/null 2>&1; then
        echo "✅ Manual start successful"
        # Register deployment
        curl -X POST http://localhost:3000/api/deployment/ci-cd \
            -H "Content-Type: application/json" \
            -d "{\"status\":\"deployed\",\"commit\":\"$COMMIT_HASH\",\"version\":\"$VERSION\"}" \
            || echo "⚠️ Could not register deployment"
    else
        echo "💥 Manual start also failed"
        echo "📋 Check server status:"
        ps aux | grep node
        exit 1
    fi
fi
