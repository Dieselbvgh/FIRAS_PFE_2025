FROM node:18-alpine

WORKDIR /app

# Copy package files first
COPY package*.json ./
RUN npm ci --only=production

# Copy app code
COPY . .

# Create directories as ROOT and set permissions
RUN mkdir -p data logs && \
    chmod 755 data logs

# Expose port 3000
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Run as root to avoid permission issues
CMD ["node", "server.js"]
