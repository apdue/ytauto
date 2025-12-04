# 🔧 OAuth 403 Error Fix

## Problem
HTTP ERROR 403 when authorizing YouTube - Redirect URI mismatch

## Solution Applied
✅ Updated `.env` file:
- Changed `REDIRECT_URI` from `http://localhost:5000` to `http://localhost:5001`
- Backend restarted to load new configuration

## ⚠️ IMPORTANT: Update Google Cloud Console

You MUST update the redirect URI in Google Cloud Console:

1. Go to: https://console.cloud.google.com/apis/credentials
2. Click on your OAuth 2.0 Client ID
3. Under "Authorized redirect URIs", add/update:
   ```
   http://localhost:5001/api/youtube/auth-callback
   ```
4. Click "Save"

## Current Configuration
- **Backend Port:** 5001
- **Redirect URI:** `http://localhost:5001/api/youtube/auth-callback`
- **Frontend:** `http://localhost:3000`

## Test
1. Open http://localhost:3000
2. Go to a project
3. Click "Link YouTube Account"
4. Authorize in the popup window
5. Should redirect successfully without 403 error

