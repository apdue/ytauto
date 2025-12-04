# Quick Deployment Guide (Hindi)

## सबसे अच्छा Server Option:

### 1. **DigitalOcean** (सबसे आसान) - ₹500-1000/month
   - Website: https://www.digitalocean.com/
   - Ubuntu 22.04 LTS droplet बनाएं
   - $6/month plan (1GB RAM) काफी है

### 2. **Vultr** - ₹500/month
   - Website: https://www.vultr.com/
   - Similar to DigitalOcean

### 3. **Railway** (Free tier available)
   - Website: https://railway.app/
   - Easy deployment, free tier available

## Step-by-Step Deployment:

### Step 1: Server खरीदें
- DigitalOcean/Vultr पर account बनाएं
- Ubuntu 22.04 droplet/server create करें
- IP address note करें

### Step 2: Server पर connect करें
```bash
ssh root@your-server-ip
```

### Step 3: Server setup करें
```bash
# System update
apt update && apt upgrade -y

# Node.js install
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# FFmpeg install
apt install -y ffmpeg

# PM2 install
npm install -g pm2

# Nginx install (reverse proxy के लिए)
apt install -y nginx
```

### Step 4: Code upload करें

**Option A: Git से (अगर Git repository है)**
```bash
cd /var/www
git clone your-repo-url autovideo2
cd autovideo2
```

**Option B: SCP से (Mac से)**
```bash
# Mac terminal में:
scp -r /Users/sandeepola/Disk\ D/Cursor/autovideo2/autovideo2 root@your-server-ip:/var/www/autovideo2
```

### Step 5: Dependencies install करें
```bash
cd /var/www/autovideo2
npm install
cd frontend
npm install
npm run build
cd ..
```

### Step 6: Environment variables setup करें
```bash
nano .env
```

इसमें add करें:
```env
PORT=5001
NODE_ENV=production

GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
REDIRECT_URI=https://yourdomain.com/api/youtube/auth-callback
```

### Step 7: App start करें
```bash
# PM2 से start करें
pm2 start ecosystem.config.js
pm2 save
pm2 startup  # Auto-start enable करने के लिए
```

### Step 8: Nginx setup करें
```bash
nano /etc/nginx/sites-available/autovideo2
```

इसमें add करें:
```nginx
server {
    listen 80;
    server_name yourdomain.com;

    client_max_body_size 500M;

    location / {
        proxy_pass http://localhost:5001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

Enable करें:
```bash
ln -s /etc/nginx/sites-available/autovideo2 /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx
```

### Step 9: SSL certificate (HTTPS) - Optional
```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d yourdomain.com
```

## Important Notes:

1. **Google OAuth Redirect URI update करें:**
   - Google Cloud Console में जाएं
   - OAuth client edit करें
   - Redirect URI: `https://yourdomain.com/api/youtube/auth-callback` add करें

2. **Firewall setup:**
```bash
ufw allow 22/tcp   # SSH
ufw allow 80/tcp   # HTTP
ufw allow 443/tcp  # HTTPS
ufw enable
```

3. **Useful Commands:**
```bash
pm2 status              # App status check
pm2 logs autovideo2     # Logs देखें
pm2 restart autovideo2  # Restart करें
```

## Troubleshooting:

- **App start नहीं हो रहा:** `pm2 logs autovideo2` से logs check करें
- **Port issue:** `lsof -i :5001` से check करें
- **Permission issue:** `chmod -R 755 /var/www/autovideo2`

## Update करने के लिए:

```bash
cd /var/www/autovideo2
git pull  # या नए files upload करें
npm install
cd frontend && npm run build && cd ..
pm2 restart autovideo2
```

