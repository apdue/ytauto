# DigitalOcean पर Direct Deploy करें (Mac से)

## 🚀 Quick Start

### Step 1: DigitalOcean Account बनाएं
1. https://www.digitalocean.com/ पर जाएं
2. Account बनाएं (Free $200 credit मिलता है!)
3. Login करें

### Step 2: Droplet (Server) Create करें
1. Dashboard में "Create" → "Droplets" click करें
2. Settings:
   - **Image:** Ubuntu 22.04 (LTS)
   - **Plan:** Basic - $6/month (1GB RAM) - काफी है
   - **Region:** Singapore या closest region
   - **Authentication:** SSH keys (recommended) या Password
3. "Create Droplet" click करें
4. **IP Address** note करें (जैसे: `157.230.123.45`)

### Step 3: SSH Key Setup (अगर password use कर रहे हैं तो skip करें)

**Mac terminal में:**
```bash
# Check if SSH key exists
ls -la ~/.ssh/id_rsa.pub

# अगर नहीं है, तो बनाएं:
ssh-keygen -t rsa -b 4096

# Public key copy करें:
cat ~/.ssh/id_rsa.pub
```

DigitalOcean में:
1. Settings → Security → SSH Keys
2. "Add SSH Key" click करें
3. Public key paste करें
4. Droplet create करते समय इस key को select करें

### Step 4: Deploy Script Run करें

**Mac terminal में project folder में जाएं:**
```bash
cd "/Users/sandeepola/Disk D/Cursor/autovideo2/autovideo2"

# Deploy script run करें:
./deploy-to-digitalocean.sh
```

**Script आपसे पूछेगा:**
1. Server IP address
2. Username (usually `root`)
3. SSH key path (default: `~/.ssh/id_rsa`)
4. First time setup? (y/n)
5. Environment variables (PORT, Google OAuth credentials, etc.)
6. Domain name (optional)
7. Nginx setup? (y/n)

### Step 5: Script Automatically करेगा:
- ✅ Server setup (Node.js, FFmpeg, PM2, Nginx)
- ✅ Code upload
- ✅ Dependencies install
- ✅ Frontend build
- ✅ Environment variables setup
- ✅ PM2 से app start
- ✅ Nginx configuration (optional)

### Step 6: Domain Setup (Optional)

अगर domain है:
1. Domain DNS settings में:
   - Type: A
   - Name: @ (या subdomain)
   - Value: Your server IP
   - TTL: 3600

2. SSL certificate (HTTPS):
```bash
ssh root@your-server-ip
apt install -y certbot python3-certbot-nginx
certbot --nginx -d yourdomain.com
```

## 📋 Manual Steps (अगर script use नहीं करना चाहते)

### Option 1: SCP से Upload
```bash
# Mac terminal में:
scp -r /Users/sandeepola/Disk\ D/Cursor/autovideo2/autovideo2 root@your-server-ip:/var/www/autovideo2
```

### Option 2: Git से (अगर Git repository है)
```bash
# Server पर:
ssh root@your-server-ip
cd /var/www
git clone your-repo-url autovideo2
cd autovideo2
```

## 🔧 Server पर Manual Setup

```bash
# Server पर SSH करें
ssh root@your-server-ip

# System update
apt update && apt upgrade -y

# Node.js install
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# FFmpeg install
apt install -y ffmpeg

# PM2 install
npm install -g pm2

# Dependencies install
cd /var/www/autovideo2
npm install
cd frontend
npm install
npm run build
cd ..

# Environment variables
nano .env
# (Add your variables)

# Start app
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

## ✅ Verify Deployment

```bash
# App status check
ssh root@your-server-ip 'pm2 status'

# Logs देखें
ssh root@your-server-ip 'pm2 logs autovideo2'

# Browser में check करें
# http://your-server-ip:5001
# या
# http://yourdomain.com (अगर domain setup है)
```

## 🆘 Troubleshooting

### Connection Failed
```bash
# Firewall check करें
ssh root@your-server-ip 'ufw status'

# Ports allow करें
ssh root@your-server-ip 'ufw allow 22/tcp && ufw allow 80/tcp && ufw allow 443/tcp'
```

### App Not Starting
```bash
# Logs check करें
ssh root@your-server-ip 'pm2 logs autovideo2 --lines 50'

# Direct run करके errors देखें
ssh root@your-server-ip 'cd /var/www/autovideo2 && node backend/server.js'
```

### Permission Issues
```bash
ssh root@your-server-ip 'chmod -R 755 /var/www/autovideo2'
```

## 📊 Useful Commands

```bash
# App restart
ssh root@your-server-ip 'pm2 restart autovideo2'

# App stop
ssh root@your-server-ip 'pm2 stop autovideo2'

# App logs
ssh root@your-server-ip 'pm2 logs autovideo2'

# Server resources
ssh root@your-server-ip 'htop'  # (अगर installed है)
```

## 💰 Cost Estimate

- **DigitalOcean Droplet:** $6/month (₹500/month)
- **Domain (optional):** $10-15/year (₹800-1200/year)
- **Total:** ~₹500-600/month

## 🎉 Success!

अगर सब कुछ सही है, तो:
- ✅ App server पर running होगा
- ✅ Browser में access कर सकेंगे
- ✅ PM2 auto-restart करेगा
- ✅ Logs available होंगे

**Happy Deploying! 🚀**

