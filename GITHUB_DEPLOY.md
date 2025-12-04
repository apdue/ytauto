# GitHub से DigitalOcean पर Deploy करें

## Step 1: GitHub Repository बनाएं

### Option A: GitHub Website से
1. https://github.com पर login करें
2. "New repository" click करें
3. Repository name: `autovideo2` (या कोई भी name)
4. Description: "Automated YouTube Video Generation System"
5. **Public** या **Private** select करें
6. "Create repository" click करें
7. **Repository URL note करें** (जैसे: `https://github.com/yourusername/autovideo2.git`)

### Option B: GitHub CLI से
```bash
gh repo create autovideo2 --public --source=. --remote=origin --push
```

## Step 2: Code को GitHub पर Push करें

### Mac Terminal में:

```bash
# Project folder में जाएं
cd "/Users/sandeepola/Disk D/Cursor/autovideo2/autovideo2"

# Git initialize करें (अगर नहीं है)
git init

# सभी files add करें
git add .

# First commit
git commit -m "Initial commit: Auto Video Create System"

# GitHub repository add करें
git remote add origin https://github.com/yourusername/autovideo2.git

# Code push करें
git branch -M main
git push -u origin main
```

**Note:** `yourusername` को अपने GitHub username से replace करें।

## Step 3: DigitalOcean Server Setup

### Server पर SSH करें:
```bash
ssh root@your-server-ip
```

### Server पर Install करें:
```bash
# System update
apt update && apt upgrade -y

# Git install
apt install -y git

# Node.js install
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# FFmpeg install
apt install -y ffmpeg

# PM2 install
npm install -g pm2

# Nginx install
apt install -y nginx
```

## Step 4: GitHub से Code Clone करें

### Server पर:
```bash
# App directory बनाएं
mkdir -p /var/www
cd /var/www

# GitHub से clone करें
git clone https://github.com/yourusername/autovideo2.git
cd autovideo2

# Dependencies install करें
npm install
cd frontend
npm install
npm run build
cd ..
```

## Step 5: Environment Variables Setup

```bash
# .env file बनाएं
nano .env
```

इसमें add करें:
```env
PORT=5001
NODE_ENV=production

GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
REDIRECT_URI=https://yourdomain.com/api/youtube/auth-callback

FRONTEND_URL=https://yourdomain.com
```

Save करें (Ctrl+X, Y, Enter)

## Step 6: Required Directories बनाएं

```bash
mkdir -p data/uploads data/output logs
chmod -R 755 data
```

## Step 7: App Start करें

```bash
# PM2 से start करें
pm2 start ecosystem.config.js
pm2 save
pm2 startup  # Auto-start enable करने के लिए instructions follow करें
```

## Step 8: Nginx Setup

```bash
# Nginx config file बनाएं
nano /etc/nginx/sites-available/autovideo2
```

इसमें add करें:
```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    client_max_body_size 500M;

    location / {
        proxy_pass http://localhost:5001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable करें:
```bash
ln -s /etc/nginx/sites-available/autovideo2 /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl restart nginx
```

## Step 9: SSL Certificate (HTTPS) - Optional

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

## Step 10: Update करने के लिए

जब भी code update करना हो:

```bash
# Server पर SSH करें
ssh root@your-server-ip

# Code update करें
cd /var/www/autovideo2
git pull origin main

# Dependencies update (अगर package.json change हुआ है)
npm install
cd frontend
npm install
npm run build
cd ..

# App restart करें
pm2 restart autovideo2
```

## Automated Deployment Script

Server पर एक script बनाएं जो automatically update करे:

```bash
# Server पर
nano /var/www/autovideo2/update.sh
```

Script content:
```bash
#!/bin/bash
cd /var/www/autovideo2
git pull origin main
npm install
cd frontend
npm install
npm run build
cd ..
pm2 restart autovideo2
echo "✅ Update complete!"
```

Executable बनाएं:
```bash
chmod +x /var/www/autovideo2/update.sh
```

Use करें:
```bash
/var/www/autovideo2/update.sh
```

## GitHub Webhook (Advanced - Optional)

Automatic deployment के लिए GitHub webhook setup कर सकते हैं। यह advanced है, manual update भी काफी है।

## Troubleshooting

### Git Permission Issues
```bash
# SSH key add करें server पर
ssh-keygen -t rsa -b 4096
cat ~/.ssh/id_rsa.pub
# इस key को GitHub में add करें: Settings → SSH Keys
```

### Private Repository Access
```bash
# Personal Access Token use करें
git clone https://your-token@github.com/yourusername/autovideo2.git
```

### Update नहीं हो रहा
```bash
# Force pull
cd /var/www/autovideo2
git fetch origin
git reset --hard origin/main
npm install
cd frontend && npm run build && cd ..
pm2 restart autovideo2
```

## Summary

1. ✅ GitHub repository बनाएं
2. ✅ Code push करें
3. ✅ Server setup करें
4. ✅ GitHub से clone करें
5. ✅ Environment variables setup करें
6. ✅ App start करें
7. ✅ Nginx configure करें
8. ✅ Update करने के लिए: `git pull` + `pm2 restart`

**Happy Deploying! 🚀**

