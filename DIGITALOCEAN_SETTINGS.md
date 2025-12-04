# DigitalOcean App Platform Settings

## ✅ Build Successful! 

Build complete हो गया है। अब आपको DigitalOcean App Platform में settings configure करनी हैं।

## Required Settings:

### 1. Build Command
**Settings** → **App-Level Settings** → **Build Command**
```
npm install && cd frontend && npm install && npm run build && cd ..
```

या leave empty करें (automatic `heroku-postbuild` run होगा)

### 2. Run Command ⚠️ IMPORTANT
**Settings** → **App-Level Settings** → **Run Command**
```
node backend/server.js
```

### 3. HTTP Port
**Settings** → **App-Level Settings** → **HTTP Port**
```
5001
```

### 4. Environment Variables
**Settings** → **App-Level Settings** → **Environment Variables**

Add these variables:

| Key | Value | Scope |
|-----|-------|-------|
| `NODE_ENV` | `production` | RUN_TIME |
| `PORT` | `5001` | RUN_TIME |
| `GOOGLE_CLIENT_ID` | (your client ID) | RUN_TIME |
| `GOOGLE_CLIENT_SECRET` | (your secret) | RUN_TIME |
| `REDIRECT_URI` | `https://your-app.ondigitalocean.app/api/youtube/auth-callback` | RUN_TIME |

**Note:** `REDIRECT_URI` में अपने app का actual URL use करें।

### 5. Health Check (Optional)
**Settings** → **App-Level Settings** → **Health Check**
- **HTTP Path:** `/`
- **Initial Delay:** `30` seconds

## ⚠️ Important Limitations:

### FFmpeg Not Available
DigitalOcean App Platform में **FFmpeg install नहीं हो सकता**। इसका मतलब:
- ❌ Video generation काम नहीं करेगा
- ❌ Video merging काम नहीं करेगा
- ✅ API endpoints काम करेंगे
- ✅ Frontend काम करेगा
- ✅ YouTube OAuth काम करेगा

### Solution: Use Droplet Instead
Video processing के लिए **DigitalOcean Droplet (VPS)** use करें:
- ✅ FFmpeg install कर सकते हैं
- ✅ Full control
- ✅ Better for video processing
- ✅ Cost-effective ($6/month)

**Guide:** `GITHUB_DEPLOY.md` देखें

## After Settings:

1. Settings save करें
2. App automatically redeploy होगा
3. Check logs: **Runtime Logs** tab में
4. Test: `https://your-app.ondigitalocean.app`

## Troubleshooting:

### App not starting:
- Check **Runtime Logs**
- Verify Run Command: `node backend/server.js`
- Check PORT: `5001`

### Build issues:
- Build command verify करें
- Check **Build Logs**

### Environment variables:
- सभी variables add किए हैं?
- `REDIRECT_URI` correct है?

## Next Steps:

1. ✅ Settings configure करें (ऊपर देखें)
2. ⚠️ FFmpeg issue के लिए Droplet use करें
3. 📖 `GITHUB_DEPLOY.md` में Droplet deployment guide है

