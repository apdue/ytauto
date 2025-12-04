# 504 Timeout Error Fix

## ❌ Error
```
Error publishing: Request failed with status code 504
ERROR component ytauto exited with code: 128
```

## Problem
1. **Instance size too small:** `apps-s-1vcpu-0.5gb` (0.5GB RAM) - video processing के लिए insufficient
2. **FFmpeg preset slow:** `-preset medium` - processing slow है
3. **Process killed:** Resource limits के कारण process terminate हो रहा है

## ✅ Solutions

### Solution 1: Increase Instance Size (Required)

**App Spec में update करें:**

```yaml
instance_size_slug: apps-s-2vcpu-2gb
```

**Available sizes:**
- `apps-s-1vcpu-0.5gb` - Too small ❌
- `apps-s-1vcpu-1gb` - Minimum for video processing ✅
- `apps-s-2vcpu-2gb` - Recommended ✅
- `apps-s-2vcpu-4gb` - Better for large videos ✅

### Solution 2: Optimize FFmpeg Preset (Already Updated)

Code में change किया गया है:
- `-preset medium` → `-preset ultrafast` (faster processing)
- `-crf 23` → `-crf 28` (slightly lower quality, faster encoding)

---

## Updated App Spec

DigitalOcean Dashboard में **App Spec** → **Edit** में यह update करें:

```yaml
services:
  - dockerfile_path: Dockerfile
    envs:
      # ... (same as before)
    http_port: 8080
    instance_count: 1
    instance_size_slug: apps-s-2vcpu-2gb  # ← Changed from apps-s-1vcpu-0.5gb
    name: ytauto
    source_dir: /
```

---

## Step-by-Step Fix

### Step 1: Update App Spec
1. **DigitalOcean Dashboard** → अपना app
2. **Settings** → **App Spec** → **Edit**
3. `instance_size_slug: apps-s-2vcpu-2gb` update करें
4. **Save** करें

### Step 2: Code Update (Already Done)
- FFmpeg preset `ultrafast` हो गया है
- Code GitHub पर push होगा

### Step 3: Wait for Rebuild
- App automatically rebuild होगा
- 3-5 minutes wait करें

---

## Why These Changes?

### Instance Size:
- **0.5GB RAM:** Video processing के लिए insufficient
- **2GB RAM:** Minimum recommended for video processing
- **4GB RAM:** Better for large/long videos

### FFmpeg Preset:
- **medium:** Slow, high quality (5-10x slower)
- **ultrafast:** Fast, acceptable quality (recommended for App Platform)
- **fast:** Balance between speed and quality

### CRF:
- **23:** High quality, slower
- **28:** Good quality, faster (acceptable for most use cases)

---

## Cost Impact

**Instance Size Pricing (approximate):**
- `apps-s-1vcpu-0.5gb`: ~$5/month
- `apps-s-1vcpu-1gb`: ~$12/month
- `apps-s-2vcpu-2gb`: ~$24/month
- `apps-s-2vcpu-4gb`: ~$48/month

**Recommendation:** Start with `apps-s-2vcpu-2gb` for video processing.

---

## Verification

### After Update:
1. **Build Logs** check करें - build successful?
2. **Runtime Logs** check करें - server running?
3. **Video generation** try करें
4. **No timeout errors?**
5. **Video successfully generated?**

---

## Alternative: Use DigitalOcean Droplet

अगर App Platform में issues continue:
- **DigitalOcean Droplet (VPS)** use करें
- Full control over resources
- No timeout limits
- Better for heavy video processing
- Cost: ~$6-12/month for basic Droplet

---

## Quick Action

1. **Settings** → **App Spec** → **Edit**
2. `instance_size_slug: apps-s-2vcpu-2gb` update करें
3. **Save**
4. Wait 3-5 minutes
5. Test video generation

**Code update भी push होगा - FFmpeg preset optimize हो गया है!** ✅

