# DigitalOcean App Platform Deployment Fix

## Problem
Build failing because `react-scripts` not found - frontend dependencies not installed during build.

## Solution

### Option 1: Use Custom Build Command (Recommended)

DigitalOcean App Platform में:

1. **Settings** → **App-Level Settings** → **Build Command**
2. Set build command:
```bash
npm install && cd frontend && npm install && npm run build && cd ..
```

3. **Run Command:**
```bash
node backend/server.js
```

4. **HTTP Port:** `5001`

### Option 2: Update package.json (Already Done)

`package.json` में `heroku-postbuild` script add किया गया है जो automatically frontend build करेगा।

### Option 3: Manual Build Script

Create `build.sh`:
```bash
#!/bin/bash
npm install
cd frontend
npm install
npm run build
cd ..
```

## Environment Variables Setup

DigitalOcean App Platform में add करें:

1. Go to **Settings** → **App-Level Settings** → **Environment Variables**
2. Add these:
   - `NODE_ENV` = `production`
   - `PORT` = `5001`
   - `GOOGLE_CLIENT_ID` = (your client ID)
   - `GOOGLE_CLIENT_SECRET` = (your secret)
   - `REDIRECT_URI` = `https://your-app.ondigitalocean.app/api/youtube/auth-callback`

## Important Notes

1. **FFmpeg:** DigitalOcean App Platform में FFmpeg install नहीं होता automatically
   - आपको custom buildpack use करना होगा या
   - Droplet (VPS) use करना बेहतर है App Platform की जगह

2. **File Storage:** App Platform में persistent storage limited है
   - Uploaded files और generated videos के लिए Spaces (Object Storage) use करें

3. **Better Option:** DigitalOcean Droplet (VPS) use करें App Platform की जगह
   - Full control
   - FFmpeg install कर सकते हैं
   - Better for video processing

## Recommended: Use Droplet Instead

App Platform video processing के लिए ideal नहीं है। Droplet (VPS) use करें:

1. Create Droplet (Ubuntu 22.04)
2. GitHub से clone करें
3. Manual setup करें (GITHUB_DEPLOY.md देखें)

## Quick Fix for App Platform

अगर App Platform use करना है:

1. **Build Command:**
```bash
npm install && cd frontend && npm install && npm run build && cd ..
```

2. **Run Command:**
```bash
node backend/server.js
```

3. **Port:** `5001`

4. Environment variables add करें

5. **FFmpeg issue:** App Platform में FFmpeg नहीं है, इसलिए video generation काम नहीं करेगा

**Recommendation:** Droplet use करें App Platform की जगह!

