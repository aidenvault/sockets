#!/bin/bash

################################################################################
# WebSocket API Server - Setup Script
# 
# This script sets up a fresh VM for running the WebSocket API server.
# It installs dependencies, configures the environment, and prepares the
# server for deployment.
#
# Usage: sudo ./setup.sh
################################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   log_error "This script must be run as root (use sudo)"
   exit 1
fi

log_info "Starting WebSocket API Server setup..."

################################################################################
# 1. System Update
################################################################################

log_info "Updating system packages..."
apt-get update -y
apt-get upgrade -y
log_success "System packages updated"

################################################################################
# 2. Install Node.js
################################################################################

log_info "Installing Node.js 18.x..."

# Remove old versions if present
apt-get remove -y nodejs npm || true

# Install Node.js 18.x from NodeSource
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs

# Verify installation
NODE_VERSION=$(node --version)
NPM_VERSION=$(npm --version)

log_success "Node.js installed: $NODE_VERSION"
log_success "npm installed: $NPM_VERSION"

################################################################################
# 3. Install Redis (Optional)
################################################################################

read -p "$(echo -e ${YELLOW}Do you want to install Redis for pub/sub? [y/N]:${NC} )" -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    log_info "Installing Redis..."
    apt-get install -y redis-server
    
    # Configure Redis
    sed -i 's/^supervised no/supervised systemd/' /etc/redis/redis.conf
    
    # Start and enable Redis
    systemctl enable redis-server
    systemctl start redis-server
    
    log_success "Redis installed and started"
else
    log_warning "Skipping Redis installation"
fi

################################################################################
# 4. Install PM2 (Process Manager)
################################################################################

log_info "Installing PM2 globally..."
npm install -g pm2

# Setup PM2 startup script
pm2 startup systemd -u $SUDO_USER --hp /home/$SUDO_USER

log_success "PM2 installed"

################################################################################
# 5. Create Application Directory
################################################################################

APP_DIR="/opt/websocket-api-server"

log_info "Creating application directory at $APP_DIR..."

mkdir -p $APP_DIR
mkdir -p $APP_DIR/logs

# Set ownership to the user who ran sudo
chown -R $SUDO_USER:$SUDO_USER $APP_DIR

log_success "Application directory created"

################################################################################
# 6. Configure Firewall
################################################################################

log_info "Configuring firewall..."

# Install ufw if not present
apt-get install -y ufw

# Allow SSH
ufw allow 22/tcp

# Allow HTTP
ufw allow 80/tcp

# Allow HTTPS
ufw allow 443/tcp

# Allow WebSocket server port (default 8080)
ufw allow 8080/tcp

# Enable firewall (non-interactive)
echo "y" | ufw enable

log_success "Firewall configured"

################################################################################
# 7. Install Additional Dependencies
################################################################################

log_info "Installing additional system dependencies..."

apt-get install -y \
    git \
    curl \
    wget \
    build-essential \
    python3 \
    certbot \
    nginx

log_success "Additional dependencies installed"

################################################################################
# 8. Configure Nginx (Optional)
################################################################################

read -p "$(echo -e ${YELLOW}Do you want to configure Nginx as reverse proxy? [y/N]:${NC} )" -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    log_info "Configuring Nginx..."
    
    # Create Nginx configuration
    cat > /etc/nginx/sites-available/websocket-api <<EOF
upstream websocket_backend {
    server localhost:8080;
}

server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://websocket_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 86400;
    }
}
EOF

    # Enable the site
    ln -sf /etc/nginx/sites-available/websocket-api /etc/nginx/sites-enabled/
    
    # Remove default site
    rm -f /etc/nginx/sites-enabled/default
    
    # Test Nginx configuration
    nginx -t
    
    # Restart Nginx
    systemctl restart nginx
    systemctl enable nginx
    
    log_success "Nginx configured as reverse proxy"
else
    log_warning "Skipping Nginx configuration"
fi

################################################################################
# 9. System Optimizations
################################################################################

log_info "Applying system optimizations for WebSocket..."

# Increase file descriptor limits
cat >> /etc/security/limits.conf <<EOF
* soft nofile 65536
* hard nofile 65536
EOF

# Increase network limits
cat >> /etc/sysctl.conf <<EOF
# WebSocket optimizations
net.core.somaxconn = 65536
net.ipv4.tcp_max_syn_backlog = 65536
net.core.netdev_max_backlog = 65536
net.ipv4.ip_local_port_range = 1024 65535
net.ipv4.tcp_tw_reuse = 1
EOF

# Apply sysctl settings
sysctl -p

log_success "System optimizations applied"

################################################################################
# 10. Create Environment File Template
################################################################################

log_info "Creating environment file template..."

cat > $APP_DIR/.env.example <<EOF
# Server Configuration
NODE_ENV=production
PORT=8080
HOST=0.0.0.0

# Authentication (CHANGE THESE IN PRODUCTION!)
JWT_SECRET=$(openssl rand -base64 32)
API_KEY=$(openssl rand -hex 16)

# Redis Configuration
REDIS_ENABLED=true
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# Inference Configuration
INFERENCE_ENABLED=false
INFERENCE_MODE=rest
INFERENCE_REST_URL=http://localhost:5000/inference

# Logging
LOG_LEVEL=info
LOG_FILE=$APP_DIR/logs/app.log

# Rate Limiting
RATE_LIMIT_ENABLED=true
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_WINDOW_MS=60000

# Heartbeat
HEARTBEAT_INTERVAL=30000
CLIENT_TIMEOUT=60000
EOF

chown $SUDO_USER:$SUDO_USER $APP_DIR/.env.example

log_success "Environment file template created"

################################################################################
# 11. Setup Logrotate
################################################################################

log_info "Configuring log rotation..."

cat > /etc/logrotate.d/websocket-api-server <<EOF
$APP_DIR/logs/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 $SUDO_USER $SUDO_USER
    sharedscripts
    postrotate
        pm2 reloadLogs
    endscript
}
EOF

log_success "Log rotation configured"

################################################################################
# Setup Complete
################################################################################

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                  Setup Complete!                               ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""
log_info "Next steps:"
echo "  1. Copy your application code to: $APP_DIR"
echo "  2. Copy .env.example to .env and configure: cp $APP_DIR/.env.example $APP_DIR/.env"
echo "  3. Install npm dependencies: cd $APP_DIR && npm install"
echo "  4. Start the server: ./scripts/deploy.sh"
echo ""
log_warning "Important: Update JWT_SECRET and API_KEY in .env file!"
echo ""

exit 0
