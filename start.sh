#!/bin/sh
# Create directories with proper permissions
mkdir -p /app/data /app/logs
chmod -R 755 /app/data /app/logs

# Start the application
exec node server.js
