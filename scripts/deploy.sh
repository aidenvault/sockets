#!/bin/bash

################################################################################
# WebSocket API Server - Deployment Script
# 
# This script deploys the WebSocket API Server using PM2 or systemd.
#
# Usage: ./deploy.sh [pm2|systemd]
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
LOG_DIR="/var/log/$APP_NAME"
DEPLOYMENT_METHOD="${1:-pm2}"

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

# Print banner
print_banner() {
    echo ""
    echo "╔════════════════════════════════════════════════════════════╗"
    echo "║        WebSocket API Server - Deployment Script           ║"
    echo "║        Deploying to Production Environment                ║"
    echo "╚════════════════════════════════════════════════════════════╝"
    echo ""
    log_info "Deployment method: $DEPLOYMENT_METHOD"
    log_info "Application directory: $APP_DIR"
    echo ""
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed"
        exit 1
    fi
    
    NODE_VERSION=$(node -v | sed 's/v//' | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        log_error "Node.js version must be >= 18 (current: $(node -v))"
        exit 1
    fi
    
    log_success "Node.js: $(node -v)"
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        log_error "npm is not installed"
        exit 1
    fi
    
    log_success "npm: $(npm -v)"
    
    # Check deployment method requirements
    if [ "$DEPLOYMENT_METHOD" == "pm2" ]; then
        if ! command -v pm2 &> /dev/null; then
            log_error "PM2 is not installed. Run: npm install -g pm2"
            exit 1
        fi
        log_success "PM2: $(pm2 -v)"
    fi
}

# Check environment file
check_env_file() {
    log_info "Checking environment configuration..."
    
    if [ ! -f "$APP_DIR/.env" ]; then
        log_warning ".env file not found"
        
        if [ -f "$APP_DIR/.env.example" ]; then
            log_info "Copying .env.example to .env"
            cp "$APP_DIR/.env.example" "$APP_DIR/.env"
            log_warning "Please edit .env file with your configuration"
            log_warning "Press Enter to continue after editing .env..."
            read
        else
            log_error ".env.example not found"
            exit 1
        fi
    fi
    
    log_success "Environment file found"
}

# Install dependencies
install_dependencies() {
    log_info "Installing dependencies..."
    
    cd "$APP_DIR"
    
    # Remove node_modules for clean install
    if [ "$2" == "--clean" ]; then
        log_info "Removing existing node_modules..."
        rm -rf node_modules package-lock.json
    fi
    
    npm install --production
    
    log_success "Dependencies installed"
}

# Create logs directory
create_logs_directory() {
    log_info "Setting up logs directory..."
    
    if [ ! -d "$LOG_DIR" ]; then
        sudo mkdir -p "$LOG_DIR"
        sudo chown $USER:$USER "$LOG_DIR"
        log_success "Logs directory created: $LOG_DIR"
    else
        log_success "Logs directory exists: $LOG_DIR"
    fi
    
    # Create logs symlink in app directory
    if [ ! -L "$APP_DIR/logs" ]; then
        ln -s "$LOG_DIR" "$APP_DIR/logs"
        log_success "Created logs symlink"
    fi
}

# Deploy with PM2
deploy_pm2() {
    log_info "Deploying with PM2..."
    
    cd "$APP_DIR"
    
    # Create PM2 ecosystem file
    cat > ecosystem.config.cjs <<EOF
module.exports = {
  apps: [{
    name: '$APP_NAME',
    script: './src/server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production'
    },
    error_file: '$LOG_DIR/error.log',
    out_file: '$LOG_DIR/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    autorestart: true,
    max_memory_restart: '1G',
    watch: false,
    ignore_watch: ['node_modules', 'logs'],
    max_restarts: 10,
    min_uptime: '10s'
  }]
};
EOF
    
    log_success "PM2 ecosystem file created"
    
    # Stop existing instance
    if pm2 describe "$APP_NAME" &> /dev/null; then
        log_info "Stopping existing instance..."
        pm2 stop "$APP_NAME"
        pm2 delete "$APP_NAME"
    fi
    
    # Start with PM2
    log_info "Starting application with PM2..."
    pm2 start ecosystem.config.cjs
    
    # Save PM2 configuration
    pm2 save
    
    # Setup PM2 startup script
    log_info "Configuring PM2 startup..."
    STARTUP_CMD=$(pm2 startup | grep sudo)
    if [ -n "$STARTUP_CMD" ]; then
        eval $STARTUP_CMD
    fi
    
    log_success "Application deployed with PM2"
    
    # Show status
    pm2 list
    echo ""
    pm2 logs "$APP_NAME" --lines 20 --nostream
}

# Deploy with systemd
deploy_systemd() {
    log_info "Deploying with systemd..."
    
    # Create systemd service file
    SERVICE_FILE="/etc/systemd/system/$APP_NAME.service"
    
    sudo tee "$SERVICE_FILE" > /dev/null <<EOF
[Unit]
Description=WebSocket API Server
Documentation=https://github.com/your-repo/websocket-api-server
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$APP_DIR
Environment=NODE_ENV=production
EnvironmentFile=$APP_DIR/.env
ExecStart=$(which node) $APP_DIR/src/server.js
Restart=on-failure
RestartSec=10
StandardOutput=append:$LOG_DIR/out.log
StandardError=append:$LOG_DIR/error.log

# Security
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=$LOG_DIR

[Install]
WantedBy=multi-user.target
EOF
    
    log_success "Systemd service file created: $SERVICE_FILE"
    
    # Reload systemd
    sudo systemctl daemon-reload
    
    # Stop existing service
    if sudo systemctl is-active --quiet "$APP_NAME"; then
        log_info "Stopping existing service..."
        sudo systemctl stop "$APP_NAME"
    fi
    
    # Enable and start service
    log_info "Enabling and starting service..."
    sudo systemctl enable "$APP_NAME"
    sudo systemctl start "$APP_NAME"
    
    # Wait for service to start
    sleep 2
    
    # Check status
    if sudo systemctl is-active --quiet "$APP_NAME"; then
        log_success "Service started successfully"
    else
        log_error "Service failed to start"
        sudo systemctl status "$APP_NAME"
        exit 1
    fi
    
    log_success "Application deployed with systemd"
    
    # Show status
    sudo systemctl status "$APP_NAME" --no-pager
}

# Test deployment
test_deployment() {
    log_info "Testing deployment..."
    
    # Wait for server to start
    sleep 3
    
    # Test health endpoint
    if command -v curl &> /dev/null; then
        log_info "Testing health endpoint..."
        
        RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/health || echo "000")
        
        if [ "$RESPONSE" == "200" ]; then
            log_success "Health check passed"
        else
            log_warning "Health check returned status: $RESPONSE"
        fi
    else
        log_warning "curl not installed, skipping health check"
    fi
}

# Print deployment info
print_deployment_info() {
    echo ""
    echo "╔════════════════════════════════════════════════════════════╗"
    echo "║                 Deployment Complete!                       ║"
    echo "╚════════════════════════════════════════════════════════════╝"
    echo ""
    log_success "WebSocket API Server deployed successfully!"
    echo ""
    echo "Access points:"
    echo "  - WebSocket: ws://$(hostname -I | awk '{print $1}'):8080/ws"
    echo "  - Demo: http://$(hostname -I | awk '{print $1}'):8080/demo/demo.html"
    echo "  - Health: http://$(hostname -I | awk '{print $1}'):8080/health"
    echo ""
    
    if [ "$DEPLOYMENT_METHOD" == "pm2" ]; then
        echo "PM2 commands:"
        echo "  - View logs: pm2 logs $APP_NAME"
        echo "  - Restart: pm2 restart $APP_NAME"
        echo "  - Stop: pm2 stop $APP_NAME"
        echo "  - Status: pm2 status"
        echo "  - Monitor: pm2 monit"
    else
        echo "Systemd commands:"
        echo "  - View logs: sudo journalctl -u $APP_NAME -f"
        echo "  - Restart: sudo systemctl restart $APP_NAME"
        echo "  - Stop: sudo systemctl stop $APP_NAME"
        echo "  - Status: sudo systemctl status $APP_NAME"
    fi
    
    echo ""
    echo "Log files: $LOG_DIR"
    echo ""
}

# Rollback function
rollback() {
    log_error "Deployment failed! Rolling back..."
    
    if [ "$DEPLOYMENT_METHOD" == "pm2" ]; then
        pm2 stop "$APP_NAME" || true
        pm2 delete "$APP_NAME" || true
    else
        sudo systemctl stop "$APP_NAME" || true
        sudo systemctl disable "$APP_NAME" || true
    fi
    
    exit 1
}

################################################################################
# Main execution
################################################################################

main() {
    # Set error trap
    trap rollback ERR
    
    print_banner
    check_prerequisites
    check_env_file
    create_logs_directory
    install_dependencies "$@"
    
    case "$DEPLOYMENT_METHOD" in
        pm2)
            deploy_pm2
            ;;
        systemd)
            deploy_systemd
            ;;
        *)
            log_error "Invalid deployment method: $DEPLOYMENT_METHOD"
            echo "Usage: $0 [pm2|systemd]"
            exit 1
            ;;
    esac
    
    test_deployment
    print_deployment_info
}

main "$@"
