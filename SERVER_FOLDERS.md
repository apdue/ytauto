# Server पर Folder Paths कैसे काम करते हैं

## Important: Server vs Local Paths

जब आप app को AWS या DigitalOcean server पर deploy करते हैं, तो:

### ❌ Local Mac Paths काम नहीं करेंगे:
```
/Users/sandeepola/Disk D/Rhymes/25 Nov/videos  ❌ (Mac path - server पर नहीं है)
```

### ✅ Server Paths use करें:
```
/var/www/autovideo2/data/uploads/4/clips  ✅ (Server path)
```

## दो तरीके Files Add करने के:

### Method 1: Upload Button (Recommended) ⭐

**सबसे आसान तरीका:**

1. "📁 Upload Clips" button click करें
2. Files select करें
3. Files automatically server पर save हो जाएंगी
4. Folder path automatically set हो जाएगा

**Uploaded files server पर कहाँ save होती हैं:**
```
/var/www/autovideo2/data/uploads/{projectId}/{createVideoId}/clips/
/var/www/autovideo2/data/uploads/{projectId}/{createVideoId}/audio/
/var/www/autovideo2/data/uploads/{projectId}/{createVideoId}/thumbnails/
```

**Example:**
- Project ID: 4
- Create Video ID: 10
- Clips folder: `/var/www/autovideo2/data/uploads/4/10/clips/`

### Method 2: Server Folder Path (Advanced)

अगर आपके पास server पर पहले से files हैं:

1. Server पर SSH करें
2. Files को server पर upload करें (SCP/FTP से)
3. Folder path enter करें

**Example Server Paths:**

```bash
# Clips folder
/var/www/autovideo2/data/uploads/4/10/clips/

# Audio folder  
/var/www/autovideo2/data/uploads/4/10/audio/

# Thumbnails folder
/var/www/autovideo2/data/uploads/4/10/thumbnails/
```

## Server पर Files Upload करने के तरीके:

### Option 1: SCP (Mac से Server)
```bash
# Mac terminal में:
scp -r /Users/sandeepola/Disk\ D/Rhymes/25\ Nov/videos/* root@your-server-ip:/var/www/autovideo2/data/uploads/4/10/clips/
```

### Option 2: FTP/SFTP Client
- FileZilla या Cyberduck use करें
- Server connect करें
- Files drag & drop करें

### Option 3: Git/Repository
- Files को Git repository में add करें
- Server पर pull करें

## Best Practice:

**✅ Recommended Workflow:**

1. **Upload Button use करें** - सबसे आसान
   - Browser से directly files upload करें
   - No server path needed
   - Automatic folder management

2. **Folder Path तभी use करें जब:**
   - Files पहले से server पर हैं
   - Bulk files upload करनी हैं
   - External storage use कर रहे हैं

## Server पर Folder Structure:

```
/var/www/autovideo2/
├── data/
│   ├── uploads/
│   │   ├── {projectId}/
│   │   │   ├── {createVideoId}/
│   │   │   │   ├── clips/      ← Video clips यहाँ
│   │   │   │   ├── audio/      ← Audio files यहाँ
│   │   │   │   └── thumbnails/ ← Thumbnails यहाँ
│   │   │   └── temp/           ← Temporary uploads
│   └── output/                 ← Generated videos
└── frontend/
    └── build/                  ← React build
```

## Summary:

- **Upload Button** = Easy, automatic, recommended ✅
- **Folder Path** = Advanced, server path needed, for existing files

**Tip:** हमेशा Upload Button use करें - यह सबसे आसान और reliable है!

