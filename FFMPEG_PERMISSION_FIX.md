# FFmpeg Permission Error Fix

## ❌ Error
```
E: List directory /var/lib/apt/lists/partial is missing. - Acquire (13: Permission denied)
```

## Problem
DigitalOcean App Platform में `apt-get` directly use नहीं हो सकता (permission issue)।

## ✅ Solution: Use Dockerfile (Already Available)

Dockerfile already GitHub पर push हो गया है जिसमें FFmpeg install है।

### Step 1: DigitalOcean Dashboard में Dockerfile Enable करें

1. **DigitalOcean Dashboard** → अपना app select करें
2. **Settings** → **App-Level Settings**
3. **Build Type:** `Dockerfile` select करें
4. **Dockerfile Path:** `Dockerfile` (default)
5. **Save** करें
6. App automatically rebuild होगा

**Note:** `.do/app.yaml` में `dockerfile_path: Dockerfile` already set है, लेकिन Dashboard में manually enable करना पड़ सकता है।

---

## ✅ Alternative: Heroku Buildpack (If Dockerfile Doesn't Work)

### Step 1: Remove Build Command
1. **Settings** → **App-Level Settings**
2. **Build Command** field को **empty** करें या remove करें
3. **Save** करें

### Step 2: Add Heroku Buildpack
1. **Settings** → **Buildpacks**
2. **Add Buildpack** button click करें
3. यह URL paste करें:
   ```
   https://github.com/jonathanong/heroku-buildpack-ffmpeg-latest
   ```
4. **Save** करें

### Step 3: Set Build Command
1. **Settings** → **App-Level Settings**
2. **Build Command** field में यह paste करें:
   ```bash
   npm install && cd frontend && npm install && npm run build && cd ..
   ```
   (FFmpeg buildpack automatically install करेगा)
3. **Save** करें
4. App rebuild होगा

---

## Recommended: Dockerfile Approach

**सबसे reliable method:**

1. **Settings** → **Build Type** → **Dockerfile**
2. **Dockerfile Path:** `Dockerfile`
3. **Save**
4. Wait for rebuild (3-5 minutes)
5. FFmpeg automatically available होगा ✅

**Dockerfile में FFmpeg already configured है!**

---

## Verification

### Build Logs में Check करें:

1. DigitalOcean → **Build Logs**
2. देखें:
   - Dockerfile build हो रहा है?
   - `ffmpeg -version` output?
   - Build successful?

### Runtime में Check करें:

1. Video generation try करें
2. Error नहीं आना चाहिए
3. FFmpeg successfully work करना चाहिए

---

## Why Dockerfile is Better

✅ **No Permission Issues:**
- Dockerfile में `apt-get` root permissions के साथ run होता है
- No permission denied errors

✅ **Consistent:**
- Same environment every time
- FFmpeg guaranteed available

✅ **Already Configured:**
- Dockerfile already push हो गया है
- Just enable करना है

---

## Quick Action

**अभी करें:**
1. DigitalOcean Dashboard → Settings
2. **Build Type:** `Dockerfile` select करें
3. **Dockerfile Path:** `Dockerfile`
4. **Save**
5. Wait 3-5 minutes
6. Test video generation

**यह 100% work करेगा!** 🚀

