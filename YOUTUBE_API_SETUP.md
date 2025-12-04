# 🔧 YouTube API Setup Guide

## "Insufficient Permission" Error Fix

### Problem
Getting "Insufficient Permission" error when authorizing YouTube.

### Solution Applied
✅ Updated OAuth scopes to include:
- `youtube.upload` - For uploading videos
- `youtube` - For reading channel info and managing videos  
- `youtubepartner` - For advanced YouTube features

### ⚠️ IMPORTANT: Enable YouTube Data API v3

You MUST enable the YouTube Data API v3 in Google Cloud Console:

1. **Go to Google Cloud Console:**
   https://console.cloud.google.com/apis/library

2. **Search for "YouTube Data API v3"**

3. **Click on it and press "Enable"**

4. **Verify it's enabled:**
   - Go to: https://console.cloud.google.com/apis/dashboard
   - Check that "YouTube Data API v3" is listed and enabled

### OAuth Consent Screen Setup

1. **Go to OAuth Consent Screen:**
   https://console.cloud.google.com/apis/credentials/consent

2. **Make sure:**
   - User Type: External (for testing) or Internal (for workspace)
   - App name, support email filled
   - Scopes include:
     - `.../auth/youtube.upload`
     - `.../auth/youtube`
     - `.../auth/youtubepartner`

3. **Add Test Users (if External):**
   - Add your Google account email as a test user
   - This allows you to authorize during testing

### Current Configuration

**OAuth Scopes Requested:**
- `https://www.googleapis.com/auth/youtube.upload`
- `https://www.googleapis.com/auth/youtube`
- `https://www.googleapis.com/auth/youtubepartner`

**Redirect URI:**
- `http://localhost:5001/api/youtube/auth-callback`

### Test Steps

1. **Enable YouTube Data API v3** (most important!)
2. **Update OAuth Consent Screen** with required scopes
3. **Add test user** (if using External app type)
4. **Try authorization again** from the app

### Common Issues

1. **"Insufficient Permission"**
   - ✅ Enable YouTube Data API v3
   - ✅ Add scopes to OAuth Consent Screen
   - ✅ Add yourself as test user

2. **"Access blocked"**
   - App is in testing mode
   - Add your email as test user

3. **"Redirect URI mismatch"**
   - Verify redirect URI in Google Console matches exactly:
   - `http://localhost:5001/api/youtube/auth-callback`

### After Setup

1. Open http://localhost:3000
2. Go to project settings
3. Click "Link YouTube Account"
4. Authorize with all requested permissions
5. Should work without "Insufficient Permission" error

