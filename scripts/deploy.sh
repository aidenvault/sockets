#!/bin/bash

################################################################################
# WebSocket API Server - Deployment Script
#
# This script deploys the WebSocket API server using PM2.
# It handles installation, updates, and restarts.
#
# Usage: ./deploy.sh
################################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
APP_NAME="websocket-api-server"
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NODE_ENV="${NODE_ENV:-production}"

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

################################################################################
# Pre-deployment Checks
################################################################################

log_info "Starting deployment for $APP_NAME..."
log_info "Application directory: $APP_DIR"
log_info "Environment: $NODE_ENV"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    log_error "Node.js is not installed. Please run setup.sh first."
    exit 1
fi

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    log_error "PM2 is not installed. Please run setup.sh first."
    exit 1
fi

# Check if .env file exists
if [ ! -f "$APP_DIR/.env" ]; then
    log_warning ".env file not found"
    
    if [ -f "$APP_DIR/.env.example" ]; then
        log_info "Creating .env from .env.example..."
        cp "$APP_DIR/.env.example" "$APP_DIR/.env"
        log_warning "Please review and update $APP_DIR/.env before continuing"
        
        read -p "$(echo -e ${YELLOW}Continue with deployment? [y/N]:${NC} )" -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "Deployment cancelled"
            exit 0
        fi
    else
        log_error ".env.example not found. Cannot create .env file."
        exit 1
    fi
fi

log_success "Pre-deployment checks passed"

################################################################################
# Install Dependencies
################################################################################

log_info "Installing npm dependencies..."
cd "$APP_DIR"

if [ "$NODE_ENV" = "production" ]; then
    npm ci --production
else
    npm install
fi

log_success "Dependencies installed"

################################################################################
# Create Required Directories
################################################################################

log_info "Creating required directories..."
mkdir -p "$APP_DIR/logs"
log_success "Directories created"

################################################################################
# PM2 Ecosystem Configuration
################################################################################

log_info "Creating PM2 ecosystem configuration..."

cat > "$APP_DIR/ecosystem.config.js" <<EOF
module.exports = {
  apps: [{
    name: '$APP_NAME',
    script: './src/server.js',
    instances: process.env.CLUSTER_ENABLED === 'true' 
      ? (process.env.CLUSTER_WORKERS || 'max') 
      : 1,
    exec_mode: process.env.CLUSTER_ENABLED === 'true' ? 'cluster' : 'fork',
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
    },
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_file: './logs/pm2-combined.log',
    time: true,
    merge_logs: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
  }]
};
EOF

log_success "PM2 ecosystem configuration created"

################################################################################
# Deploy Application
################################################################################

log_info "Checking if application is already running..."

if pm2 list | grep -q "$APP_NAME"; then
    log_info "Application is running. Performing graceful restart..."
    pm2 reload ecosystem.config.js --update-env
    log_success "Application reloaded"
else
    log_info "Starting application for the first time..."
    pm2 start ecosystem.config.js
    log_success "Application started"
fi

################################################################################
# Save PM2 Configuration
################################################################################

log_info "Saving PM2 configuration..."
pm2 save
log_success "PM2 configuration saved"

################################################################################
# Display Status
################################################################################

log_info "Current application status:"
pm2 show "$APP_NAME"

################################################################################
# Health Check
################################################################################

log_info "Performing health check..."

# Wait a few seconds for the server to start
sleep 5

# Source .env to get PORT
if [ -f "$APP_DIR/.env" ]; then
    export $(cat "$APP_DIR/.env" | grep -v '^#' | xargs)
fi

PORT=${PORT:-8080}
HOST=${HOST:-localhost}

# Try to connect to health endpoint
if curl -f -s "http://$HOST:$PORT/health" > /dev/null; then
    log_success "Health check passed"
    
    # Display health info
    log_info "Server is running at:"
    echo "  • HTTP: http://$HOST:$PORT"
    echo "  • WebSocket: ws://$HOST:$PORT/ws"
    echo "  • Demo: http://$HOST:$PORT/demo.html"
    echo "  • Health: http://$HOST:$PORT/health"
    echo "  • Metrics: http://$HOST:$PORT/metrics"
else
    log_warning "Health check failed. Server may still be starting..."
    log_info "Check logs with: pm2 logs $APP_NAME"
fi

################################################################################
# Deployment Complete
################################################################################

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║               Deployment Complete!                             ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

log_info "Useful commands:"
echo "  • View logs:     pm2 logs $APP_NAME"
echo "  • View status:   pm2 status"
echo "  • Restart:       pm2 restart $APP_NAME"
echo "  • Stop:          pm2 stop $APP_NAME"
echo "  • Monitor:       pm2 monit"
echo ""

exit 0
