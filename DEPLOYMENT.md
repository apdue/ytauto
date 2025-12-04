# Server Deployment Guide

## Server Options

### Recommended Servers:
1. **DigitalOcean** (Recommended) - $6-12/month
   - Easy setup, good documentation
   - Ubuntu 22.04 LTS
   
2. **AWS EC2** - Pay as you go
   - More complex but powerful
   
3. **Vultr** - $6/month
   - Similar to DigitalOcean
   
4. **Railway/Render** - Free tier available
   - Easy deployment but limited resources

## Prerequisites

- Ubuntu 20.04/22.04 LTS server
- Node.js 18+ installed
- FFmpeg installed
- Domain name (optional but recommended)
- SSH access to server

## Step 1: Server Setup

### Connect to your server:
```bash
ssh root@your-server-ip
```

### Update system:
```bash
apt update && apt upgrade -y
```

### Install Node.js 18+:
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs
node --version  # Should show v18+
```

### Install FFmpeg:
```bash
apt install -y ffmpeg
ffmpeg -version  # Verify installation
```

### Install PM2 (Process Manager):
```bash
npm install -g pm2
```

### Install Nginx (for reverse proxy):
```bash
apt install -y nginx
```

## Step 2: Upload Code to Server

### Option A: Using Git (Recommended)
```bash
# On server
cd /var/www
git clone your-repository-url autovideo2
cd autovideo2
```

### Option B: Using SCP (from your Mac)
```bash
# From your Mac terminal
scp -r /Users/sandeepola/Disk\ D/Cursor/autovideo2/autovideo2 root@your-server-ip:/var/www/autovideo2
```

## Step 3: Install Dependencies

```bash
cd /var/www/autovideo2
npm install
cd frontend
npm install
cd ..
npm run build  # Build React app
```

## Step 4: Setup Environment Variables

```bash
cd /var/www/autovideo2
nano .env
```

Add these variables:
```env
PORT=5001
NODE_ENV=production

# Google OAuth Credentials
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
REDIRECT_URI=https://yourdomain.com/api/youtube/auth-callback

# Frontend URL (if different domain)
FRONTEND_URL=https://yourdomain.com
```

Save and exit (Ctrl+X, Y, Enter)

## Step 5: Create Required Directories

```bash
mkdir -p /var/www/autovideo2/data/uploads
mkdir -p /var/www/autovideo2/data/output
mkdir -p /var/www/autovideo2/logs
chmod -R 755 /var/www/autovideo2/data
```

## Step 6: Start Application with PM2

```bash
cd /var/www/autovideo2
pm2 start ecosystem.config.js
pm2 save
pm2 startup  # Follow instructions to enable auto-start on reboot
```

## Step 7: Setup Nginx Reverse Proxy

```bash
nano /etc/nginx/sites-available/autovideo2
```

Add this configuration:
```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    # Redirect HTTP to HTTPS (after SSL setup)
    # return 301 https://$server_name$request_uri;

    client_max_body_size 500M;  # For large video uploads

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

Enable site:
```bash
ln -s /etc/nginx/sites-available/autovideo2 /etc/nginx/sites-enabled/
nginx -t  # Test configuration
systemctl restart nginx
```

## Step 8: Setup SSL with Let's Encrypt (Optional but Recommended)

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

## Step 9: Firewall Setup

```bash
ufw allow 22/tcp   # SSH
ufw allow 80/tcp   # HTTP
ufw allow 443/tcp  # HTTPS
ufw enable
```

## Step 10: Update Google OAuth Redirect URI

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project
3. Go to APIs & Services > Credentials
4. Edit your OAuth 2.0 Client
5. Add authorized redirect URI: `https://yourdomain.com/api/youtube/auth-callback`
6. Save

## Useful Commands

### PM2 Commands:
```bash
pm2 status              # Check app status
pm2 logs autovideo2     # View logs
pm2 restart autovideo2  # Restart app
pm2 stop autovideo2     # Stop app
pm2 delete autovideo2   # Remove from PM2
```

### Nginx Commands:
```bash
systemctl status nginx  # Check status
systemctl restart nginx # Restart
nginx -t                # Test config
```

### View Logs:
```bash
pm2 logs autovideo2
tail -f /var/www/autovideo2/logs/out.log
tail -f /var/www/autovideo2/logs/err.log
```

## Troubleshooting

### App not starting:
```bash
pm2 logs autovideo2
cd /var/www/autovideo2
node backend/server.js  # Run directly to see errors
```

### Port already in use:
```bash
lsof -i :5001
kill -9 <PID>
```

### Permission issues:
```bash
chown -R $USER:$USER /var/www/autovideo2
chmod -R 755 /var/www/autovideo2
```

### Database issues:
```bash
ls -la /var/www/autovideo2/data/
chmod 644 /var/www/autovideo2/data/database.db
```

## Backup

### Backup database:
```bash
cp /var/www/autovideo2/data/database.db /var/www/autovideo2/data/database.db.backup
```

### Backup uploads:
```bash
tar -czf uploads-backup.tar.gz /var/www/autovideo2/data/uploads/
```

## Update Application

```bash
cd /var/www/autovideo2
git pull  # If using git
# OR upload new files via SCP

npm install
cd frontend
npm install
npm run build
cd ..
pm2 restart autovideo2
```

