# 🛡️ DevSecOps Dashboard - Firas Aouadni PFE 2025

A comprehensive Docker security testing and auto-hardening dashboard.

## Features

- 🔍 **Vulnerability Scanning** - Trivy & Grype integration
- 🖥️ **Host Monitoring** - VAN (Vulnerability Assessment Network)
- 🔧 **Auto-Hardening** - Automatic Docker image security fixes
- 🚨 **Alert System** - Real-time security alerts with mitigation
- 💬 **Chat Assistant** - AI-powered security assistance

## Quick Start

### Local Development
\`\`\`bash
npm install
npm start
\`\`\`

### Docker
\`\`\`bash
docker-compose up -d
\`\`\`

## API Endpoints

- \`GET /health\` - Health check
- \`GET /api/overview\` - System overview
- \`POST /api/scan/docker\` - Scan Docker image
- \`POST /api/devsecops/fix-image\` - Auto-harden image
- \`GET /api/alerts\` - Security alerts
- \`POST /api/chat\` - Chat assistant

## CI/CD Pipeline

This project includes GitHub Actions for:
- ✅ Automated testing
- 🔍 Security scanning
- 🐳 Docker image building
- 🚀 Automated deployment
# Runner service is now working correctly!
