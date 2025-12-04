#!/bin/bash

echo "🚀 Auto Video Create - Setup Script"
echo "===================================="
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js v16 or higher."
    echo "   Download from: https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 16 ]; then
    echo "❌ Node.js version 16 or higher is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js $(node -v) detected"

# Check if FFmpeg is installed
if ! command -v ffmpeg &> /dev/null; then
    echo "❌ FFmpeg is not installed."
    echo "   Install with: brew install ffmpeg"
    exit 1
fi

echo "✅ FFmpeg $(ffmpeg -version | head -n1) detected"

# Install backend dependencies
echo ""
echo "📦 Installing backend dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install backend dependencies"
    exit 1
fi

# Install frontend dependencies
echo ""
echo "📦 Installing frontend dependencies..."
cd frontend
npm install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install frontend dependencies"
    exit 1
fi

cd ..

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo ""
    echo "📝 Creating .env file..."
    cp .env.example .env
    echo "⚠️  Please edit .env and add your Google OAuth credentials"
    echo "   Get them from: https://console.cloud.google.com/apis/credentials"
else
    echo "✅ .env file already exists"
fi

# Create data directory
mkdir -p data/output

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env and add your Google OAuth credentials"
echo "2. Make sure REDIRECT_URI is set to: http://localhost:5000/api/youtube/auth-callback"
echo "3. Run 'npm start' to start the backend server"
echo "4. In another terminal, run 'cd frontend && npm start' to start the frontend"
echo ""
echo "For detailed instructions, see README.md"

