#!/bin/bash

# Deployment script for autovideo2
# Run this on your server after uploading code

echo "🚀 Starting deployment..."

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "Please run as root or with sudo"
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install
cd frontend
npm install
cd ..

# Build frontend
echo "🏗️  Building frontend..."
cd frontend
npm run build
cd ..

# Create required directories
echo "📁 Creating directories..."
mkdir -p data/uploads
mkdir -p data/output
mkdir -p logs
chmod -R 755 data

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    echo "📥 Installing PM2..."
    npm install -g pm2
fi

# Stop existing app if running
echo "🛑 Stopping existing app..."
pm2 stop autovideo2 2>/dev/null || true
pm2 delete autovideo2 2>/dev/null || true

# Start app with PM2
echo "▶️  Starting app..."
pm2 start ecosystem.config.js
pm2 save

echo "✅ Deployment complete!"
echo "📊 Check status: pm2 status"
echo "📝 View logs: pm2 logs autovideo2"

