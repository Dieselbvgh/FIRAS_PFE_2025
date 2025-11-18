#!/bin/bash
echo "🚀 Deploying Firas PFE 2025 Dashboard..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Create necessary directories
mkdir -p data logs

# Check if trivy is installed
if ! command -v trivy &> /dev/null; then
    echo "⚠️  Trivy is not installed. Docker scanning will not work."
    echo "   Install with: curl -sfL https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh | sh -s -- -b /usr/local/bin"
fi

# Check if grype is installed
if ! command -v grype &> /dev/null; then
    echo "⚠️  Grype is not installed. Docker scanning will not work."
    echo "   Install with: curl -sSfL https://raw.githubusercontent.com/anchore/grype/main/install.sh | sh -s -- -b /usr/local/bin"
fi

# Check if docker is installed
if ! command -v docker &> /dev/null; then
    echo "⚠️  Docker is not installed. Auto-fix features will not work."
fi

echo "✅ Setup complete!"
echo "🎯 To start the dashboard:"
echo "   npm start"
echo "   Then open: http://localhost:5001"
echo ""
echo "🔧 Configuration:"
echo "   Edit .env to enable real fixes: ENABLE_REAL_FIX=true"
echo "   (Requires sudo for some operations)"
