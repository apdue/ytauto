#!/bin/bash

# DigitalOcean Direct Deployment Script
# यह script आपको Mac से directly DigitalOcean server पर deploy करने में help करेगा

echo "🚀 DigitalOcean Deployment Script"
echo "=================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if required tools are installed
check_requirements() {
    echo "📋 Checking requirements..."
    
    if ! command -v ssh &> /dev/null; then
        echo -e "${RED}❌ SSH not found. Please install OpenSSH${NC}"
        exit 1
    fi
    
    if ! command -v scp &> /dev/null; then
        echo -e "${RED}❌ SCP not found. Please install OpenSSH${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ All requirements met${NC}"
}

# Get server details
get_server_info() {
    echo ""
    echo "📝 Enter your DigitalOcean server details:"
    read -p "Server IP address: " SERVER_IP
    read -p "Username (usually 'root'): " SERVER_USER
    SERVER_USER=${SERVER_USER:-root}
    read -p "SSH key path (press Enter for default ~/.ssh/id_rsa): " SSH_KEY
    SSH_KEY=${SSH_KEY:-~/.ssh/id_rsa}
    
    echo ""
    echo "Server: ${SERVER_USER}@${SERVER_IP}"
    echo "SSH Key: ${SSH_KEY}"
    read -p "Is this correct? (y/n): " CONFIRM
    
    if [ "$CONFIRM" != "y" ]; then
        echo "Deployment cancelled."
        exit 0
    fi
}

# Test SSH connection
test_connection() {
    echo ""
    echo "🔌 Testing SSH connection..."
    ssh -i "$SSH_KEY" -o ConnectTimeout=5 "${SERVER_USER}@${SERVER_IP}" "echo 'Connection successful'" 2>/dev/null
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Connection successful!${NC}"
    else
        echo -e "${RED}❌ Connection failed!${NC}"
        echo "Please check:"
        echo "1. Server IP is correct"
        echo "2. SSH key is correct"
        echo "3. Server is running"
        echo "4. Firewall allows SSH (port 22)"
        exit 1
    fi
}

# Setup server (first time only)
setup_server() {
    echo ""
    read -p "Is this first time setup? (y/n): " FIRST_TIME
    
    if [ "$FIRST_TIME" = "y" ]; then
        echo "🔧 Setting up server..."
        
        ssh -i "$SSH_KEY" "${SERVER_USER}@${SERVER_IP}" << 'ENDSSH'
            # Update system
            apt update && apt upgrade -y
            
            # Install Node.js 18
            curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
            apt install -y nodejs
            
            # Install FFmpeg
            apt install -y ffmpeg
            
            # Install PM2
            npm install -g pm2
            
            # Install Nginx
            apt install -y nginx
            
            # Create app directory
            mkdir -p /var/www/autovideo2
            chmod -R 755 /var/www/autovideo2
            
            echo "✅ Server setup complete!"
ENDSSH
        
        echo -e "${GREEN}✅ Server setup complete!${NC}"
    fi
}

# Upload code
upload_code() {
    echo ""
    echo "📤 Uploading code to server..."
    
    # Create a temporary directory for upload
    TEMP_DIR=$(mktemp -d)
    PROJECT_NAME="autovideo2"
    
    # Copy project files (excluding node_modules, .git, etc.)
    echo "📦 Preparing files..."
    rsync -avz --progress \
        --exclude 'node_modules' \
        --exclude 'frontend/node_modules' \
        --exclude '.git' \
        --exclude 'data/uploads' \
        --exclude 'data/output' \
        --exclude 'data/database.db' \
        --exclude '.env' \
        --exclude 'logs' \
        -e "ssh -i $SSH_KEY" \
        ./ "${SERVER_USER}@${SERVER_IP}:/var/www/${PROJECT_NAME}/"
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Code uploaded successfully!${NC}"
    else
        echo -e "${RED}❌ Upload failed!${NC}"
        exit 1
    fi
}

# Install dependencies and build
install_and_build() {
    echo ""
    echo "📦 Installing dependencies and building..."
    
    ssh -i "$SSH_KEY" "${SERVER_USER}@${SERVER_IP}" << ENDSSH
        cd /var/www/autovideo2
        
        # Install backend dependencies
        echo "Installing backend dependencies..."
        npm install
        
        # Install frontend dependencies
        echo "Installing frontend dependencies..."
        cd frontend
        npm install
        
        # Build frontend
        echo "Building frontend..."
        npm run build
        
        cd ..
        
        # Create required directories
        mkdir -p data/uploads data/output logs
        chmod -R 755 data
        
        echo "✅ Dependencies installed and frontend built!"
ENDSSH
    
    echo -e "${GREEN}✅ Build complete!${NC}"
}

# Setup environment variables
setup_env() {
    echo ""
    echo "⚙️  Setting up environment variables..."
    echo ""
    echo "Please enter your environment variables:"
    read -p "PORT (default 5001): " PORT
    PORT=${PORT:-5001}
    read -p "GOOGLE_CLIENT_ID: " GOOGLE_CLIENT_ID
    read -p "GOOGLE_CLIENT_SECRET: " GOOGLE_CLIENT_SECRET
    read -p "Domain name (e.g., yourdomain.com): " DOMAIN
    read -p "REDIRECT_URI (default: https://${DOMAIN}/api/youtube/auth-callback): " REDIRECT_URI
    REDIRECT_URI=${REDIRECT_URI:-https://${DOMAIN}/api/youtube/auth-callback}
    
    # Create .env file content
    ENV_CONTENT="PORT=${PORT}
NODE_ENV=production

# Google OAuth Credentials
GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}
GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET}
REDIRECT_URI=${REDIRECT_URI}

# Frontend URL
FRONTEND_URL=https://${DOMAIN}"
    
    # Upload .env file
    echo "$ENV_CONTENT" | ssh -i "$SSH_KEY" "${SERVER_USER}@${SERVER_IP}" "cat > /var/www/autovideo2/.env"
    
    echo -e "${GREEN}✅ Environment variables set!${NC}"
}

# Start application with PM2
start_app() {
    echo ""
    echo "🚀 Starting application..."
    
    ssh -i "$SSH_KEY" "${SERVER_USER}@${SERVER_IP}" << 'ENDSSH'
        cd /var/www/autovideo2
        
        # Stop existing app if running
        pm2 stop autovideo2 2>/dev/null || true
        pm2 delete autovideo2 2>/dev/null || true
        
        # Start app
        pm2 start ecosystem.config.js
        pm2 save
        pm2 startup
        
        echo "✅ Application started!"
ENDSSH
    
    echo -e "${GREEN}✅ Application started with PM2!${NC}"
}

# Setup Nginx
setup_nginx() {
    echo ""
    read -p "Setup Nginx reverse proxy? (y/n): " SETUP_NGINX
    
    if [ "$SETUP_NGINX" = "y" ]; then
        read -p "Domain name: " DOMAIN
        
        echo "📝 Creating Nginx configuration..."
        
        NGINX_CONFIG="server {
    listen 80;
    server_name ${DOMAIN} www.${DOMAIN};

    client_max_body_size 500M;

    location / {
        proxy_pass http://localhost:5001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}"
        
        echo "$NGINX_CONFIG" | ssh -i "$SSH_KEY" "${SERVER_USER}@${SERVER_IP}" "cat > /etc/nginx/sites-available/autovideo2"
        
        ssh -i "$SSH_KEY" "${SERVER_USER}@${SERVER_IP}" << ENDSSH
            ln -sf /etc/nginx/sites-available/autovideo2 /etc/nginx/sites-enabled/
            rm -f /etc/nginx/sites-enabled/default
            nginx -t
            systemctl restart nginx
            echo "✅ Nginx configured!"
ENDSSH
        
        echo -e "${GREEN}✅ Nginx configured!${NC}"
        echo ""
        echo "🌐 Your app should be accessible at: http://${DOMAIN}"
        echo ""
        echo "📝 Next steps:"
        echo "1. Point your domain DNS to server IP: ${SERVER_IP}"
        echo "2. Setup SSL with: ssh ${SERVER_USER}@${SERVER_IP} 'certbot --nginx -d ${DOMAIN}'"
    fi
}

# Main deployment flow
main() {
    echo "=================================="
    echo "DigitalOcean Direct Deployment"
    echo "=================================="
    echo ""
    
    check_requirements
    get_server_info
    test_connection
    setup_server
    upload_code
    install_and_build
    setup_env
    start_app
    setup_nginx
    
    echo ""
    echo -e "${GREEN}=================================="
    echo "✅ Deployment Complete!"
    echo "==================================${NC}"
    echo ""
    echo "📊 Check app status:"
    echo "   ssh ${SERVER_USER}@${SERVER_IP} 'pm2 status'"
    echo ""
    echo "📝 View logs:"
    echo "   ssh ${SERVER_USER}@${SERVER_IP} 'pm2 logs autovideo2'"
    echo ""
    echo "🔄 Restart app:"
    echo "   ssh ${SERVER_USER}@${SERVER_IP} 'pm2 restart autovideo2'"
    echo ""
}

# Run main function
main

