# Docker Setup for DigitalOcean App Platform

## Dockerfile Created ✅

Dockerfile में FFmpeg और सभी dependencies install हो रहे हैं।

---

## What's in Dockerfile?

1. **Ubuntu 22.04** base image
2. **FFmpeg** installation
3. **Node.js 18.x** installation
4. **Backend dependencies** install
5. **Frontend dependencies** install
6. **Frontend build**
7. **Server start**

---

## DigitalOcean App Platform Setup

### Option 1: Use Dockerfile (Recommended)

DigitalOcean App Platform automatically detect करेगा Dockerfile:

1. **GitHub पर push करें:**
   ```bash
   git add Dockerfile .dockerignore
   git commit -m "Add Dockerfile with FFmpeg"
   git push origin main
   ```

2. **DigitalOcean Dashboard:**
   - App Platform automatically Dockerfile detect करेगा
   - Build automatically start होगा
   - FFmpeg available होगा

### Option 2: Manual Configuration

अगर automatic detection नहीं हो, तो:

1. **DigitalOcean Dashboard** → अपना app
2. **Settings** → **App-Level Settings**
3. **Build Type:** `Dockerfile` select करें
4. **Dockerfile Path:** `Dockerfile` (default)
5. **Save** करें

---

## Build Process

Dockerfile build करते समय:

1. ✅ Ubuntu 22.04 base image download
2. ✅ FFmpeg install
3. ✅ Node.js 18.x install
4. ✅ Backend dependencies install
5. ✅ Frontend dependencies install
6. ✅ Frontend build
7. ✅ Server start

**Total build time:** ~5-10 minutes (first time)

---

## Environment Variables

DigitalOcean Dashboard में ये environment variables set करें:

```
NODE_ENV=production
PORT=5001
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
REDIRECT_URI=https://shark-app-emu4p.ondigitalocean.app/api/youtube/auth-callback
```

---

## Verification

### Build Logs में Check करें:

1. DigitalOcean → **Build Logs**
2. देखें:
   - `ffmpeg -version` output
   - `node --version` output
   - Frontend build successful
   - No errors

### Runtime में Check करें:

1. Video generation try करें
2. Error नहीं आना चाहिए
3. FFmpeg successfully work करना चाहिए

---

## .dockerignore

`.dockerignore` file create की है जो:
- `node_modules` exclude करता है
- `data/uploads` और `data/output` exclude करता है
- Large files exclude करता है

**Build faster होगा और image size कम होगा!**

---

## Troubleshooting

### Build Fails?

**Check:**
- Dockerfile syntax correct है?
- All paths correct हैं?
- GitHub में Dockerfile push हुआ है?

### FFmpeg Not Found?

**Check:**
- Build logs में `ffmpeg -version` output दिख रहा है?
- Dockerfile में FFmpeg install step successful था?

### Frontend Build Fails?

**Check:**
- Frontend dependencies install हुए?
- Build command correct है?

---

## Advantages of Dockerfile Approach

✅ **Consistent Environment:**
- Same environment everywhere
- No dependency issues

✅ **FFmpeg Included:**
- FFmpeg automatically available
- No manual installation needed

✅ **Better Control:**
- Full control over build process
- Custom configurations possible

✅ **Reproducible:**
- Same build every time
- Easy to debug

---

## Next Steps

1. ✅ Dockerfile और .dockerignore GitHub पर push करें
2. ✅ DigitalOcean app automatically rebuild होगा
3. ✅ FFmpeg available होगा
4. ✅ Video generation work करेगा

**Ready to push!** 🚀

