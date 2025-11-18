# Deployment Guide

## Manual Deployment
1. \`npm install\`
2. \`npm start\`

## Docker Deployment
\`\`\`bash
docker-compose up -d
\`\`\`

## Production Deployment with CI/CD
1. Set GitHub Secrets:
   - \`SERVER_HOST\`: Your server IP
   - \`SERVER_USER\`: SSH username  
   - \`SERVER_SSH_KEY\`: SSH private key
2. Push to main branch triggers auto-deployment
