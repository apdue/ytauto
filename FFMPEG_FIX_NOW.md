# FFmpeg Error Fix - Immediate Solution

## ❌ Current Error
```
Error publishing: Cannot find ffprobe
```

## ✅ Quick Fix - DigitalOcean Dashboard में

### Option 1: Build Command में FFmpeg Install (Fastest)

1. **DigitalOcean Dashboard** → अपना app select करें
2. **Settings** → **App-Level Settings**
3. **Build Command** field में यह paste करें:

```bash
apt-get update && apt-get install -y ffmpeg && npm install && cd frontend && npm install && npm run build && cd ..
```

4. **Save** करें
5. App automatically rebuild होगा

---

### Option 2: Dockerfile Mode Enable करें

अगर Dockerfile use करना है:

1. **DigitalOcean Dashboard** → अपना app
2. **Settings** → **App-Level Settings**
3. **Build Type:** `Dockerfile` select करें
4. **Dockerfile Path:** `Dockerfile` (default)
5. **Save** करें
6. App rebuild होगा

---

## Verification

### Build Logs Check करें:

1. DigitalOcean → **Build Logs**
2. देखें:
   - `Setting up ffmpeg` message?
   - `ffmpeg -version` output?
   - Build successful?

### Runtime Check:

1. **Runtime Logs** में देखें
2. Video generation try करें
3. Error नहीं आना चाहिए

---

## If Build Command Doesn't Work

### Use Heroku Buildpack:

1. **Settings** → **Buildpacks**
2. **Add Buildpack** button click करें
3. यह URL paste करें:
   ```
   https://github.com/jonathanong/heroku-buildpack-ffmpeg-latest
   ```
4. **Save** करें
5. App rebuild होगा

---

## Alternative: Update .do/app.yaml

`.do/app.yaml` file में build command update करें:

```yaml
build_command: apt-get update && apt-get install -y ffmpeg && npm install && cd frontend && npm install && npm run build && cd ..
```

फिर GitHub पर push करें:
```bash
git add .do/app.yaml
git commit -m "Add FFmpeg to build command"
git push origin main
```

---

## Recommended: Dashboard में Direct Update

**Fastest way:**
1. DigitalOcean Dashboard → Settings → Build Command
2. Paste: `apt-get update && apt-get install -y ffmpeg && npm install && cd frontend && npm install && npm run build && cd ..`
3. Save
4. Wait for rebuild (2-3 minutes)
5. Test video generation

**यह सबसे fast और reliable method है!** ✅

