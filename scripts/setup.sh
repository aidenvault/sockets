#!/bin/bash

################################################################################
# WebSocket API Server - VM Setup Script
# 
# This script provisions an empty VM with all necessary dependencies
# to run the WebSocket API Server.
#
# Usage: ./setup.sh
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

# Print banner
print_banner() {
    echo ""
    echo "╔════════════════════════════════════════════════════════════╗"
    echo "║        WebSocket API Server - Setup Script                ║"
    echo "║        Provisioning VM for Production Deployment          ║"
    echo "╚════════════════════════════════════════════════════════════╝"
    echo ""
}

# Check if running as root
check_root() {
    if [[ $EUID -eq 0 ]]; then
        log_warning "This script should not be run as root directly"
        log_warning "It will use sudo when needed"
        exit 1
    fi
}

# Detect OS
detect_os() {
    log_info "Detecting operating system..."
    
    if [[ -f /etc/os-release ]]; then
        . /etc/os-release
        OS=$ID
        VER=$VERSION_ID
        log_success "Detected OS: $OS $VER"
    else
        log_error "Cannot detect OS. /etc/os-release not found"
        exit 1
    fi
}

# Update system packages
update_system() {
    log_info "Updating system packages..."
    
    if [[ "$OS" == "ubuntu" ]] || [[ "$OS" == "debian" ]]; then
        sudo apt-get update -y
        sudo apt-get upgrade -y
        log_success "System packages updated"
    elif [[ "$OS" == "centos" ]] || [[ "$OS" == "rhel" ]] || [[ "$OS" == "fedora" ]]; then
        sudo yum update -y
        log_success "System packages updated"
    else
        log_warning "Unknown OS. Skipping system update"
    fi
}

# Install Node.js
install_nodejs() {
    log_info "Checking Node.js installation..."
    
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node -v)
        log_success "Node.js already installed: $NODE_VERSION"
        
        # Check if version is >= 18
        MAJOR_VERSION=$(echo $NODE_VERSION | cut -d'.' -f1 | sed 's/v//')
        if [ "$MAJOR_VERSION" -lt 18 ]; then
            log_warning "Node.js version is less than 18. Upgrading..."
        else
            return 0
        fi
    fi
    
    log_info "Installing Node.js 18.x..."
    
    if [[ "$OS" == "ubuntu" ]] || [[ "$OS" == "debian" ]]; then
        # Install NodeSource repository
        curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
        sudo apt-get install -y nodejs
    elif [[ "$OS" == "centos" ]] || [[ "$OS" == "rhel" ]] || [[ "$OS" == "fedora" ]]; then
        curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
        sudo yum install -y nodejs
    fi
    
    log_success "Node.js installed: $(node -v)"
    log_success "npm installed: $(npm -v)"
}

# Install PM2 process manager
install_pm2() {
    log_info "Checking PM2 installation..."
    
    if command -v pm2 &> /dev/null; then
        log_success "PM2 already installed: $(pm2 -v)"
        return 0
    fi
    
    log_info "Installing PM2..."
    sudo npm install -g pm2
    
    log_success "PM2 installed: $(pm2 -v)"
}

# Install Redis (optional)
install_redis() {
    log_info "Installing Redis (optional message broker)..."
    
    read -p "Do you want to install Redis? (y/n) " -n 1 -r
    echo
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Skipping Redis installation"
        return 0
    fi
    
    if command -v redis-server &> /dev/null; then
        log_success "Redis already installed"
        return 0
    fi
    
    if [[ "$OS" == "ubuntu" ]] || [[ "$OS" == "debian" ]]; then
        sudo apt-get install -y redis-server
        sudo systemctl enable redis-server
        sudo systemctl start redis-server
    elif [[ "$OS" == "centos" ]] || [[ "$OS" == "rhel" ]] || [[ "$OS" == "fedora" ]]; then
        sudo yum install -y redis
        sudo systemctl enable redis
        sudo systemctl start redis
    fi
    
    log_success "Redis installed and started"
}

# Install NATS (optional)
install_nats() {
    log_info "Installing NATS (optional message broker)..."
    
    read -p "Do you want to install NATS? (y/n) " -n 1 -r
    echo
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Skipping NATS installation"
        return 0
    fi
    
    if command -v nats-server &> /dev/null; then
        log_success "NATS already installed"
        return 0
    fi
    
    log_info "Downloading NATS server..."
    NATS_VERSION="2.10.7"
    wget https://github.com/nats-io/nats-server/releases/download/v${NATS_VERSION}/nats-server-v${NATS_VERSION}-linux-amd64.tar.gz
    tar -xzf nats-server-v${NATS_VERSION}-linux-amd64.tar.gz
    sudo mv nats-server-v${NATS_VERSION}-linux-amd64/nats-server /usr/local/bin/
    rm -rf nats-server-v${NATS_VERSION}-linux-amd64*
    
    log_success "NATS installed"
}

# Install Git
install_git() {
    log_info "Checking Git installation..."
    
    if command -v git &> /dev/null; then
        log_success "Git already installed: $(git --version)"
        return 0
    fi
    
    log_info "Installing Git..."
    
    if [[ "$OS" == "ubuntu" ]] || [[ "$OS" == "debian" ]]; then
        sudo apt-get install -y git
    elif [[ "$OS" == "centos" ]] || [[ "$OS" == "rhel" ]] || [[ "$OS" == "fedora" ]]; then
        sudo yum install -y git
    fi
    
    log_success "Git installed: $(git --version)"
}

# Install build essentials
install_build_tools() {
    log_info "Installing build tools..."
    
    if [[ "$OS" == "ubuntu" ]] || [[ "$OS" == "debian" ]]; then
        sudo apt-get install -y build-essential
    elif [[ "$OS" == "centos" ]] || [[ "$OS" == "rhel" ]] || [[ "$OS" == "fedora" ]]; then
        sudo yum groupinstall -y "Development Tools"
    fi
    
    log_success "Build tools installed"
}

# Configure firewall
configure_firewall() {
    log_info "Configuring firewall..."
    
    read -p "Do you want to configure firewall rules? (y/n) " -n 1 -r
    echo
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Skipping firewall configuration"
        return 0
    fi
    
    if command -v ufw &> /dev/null; then
        sudo ufw allow 8080/tcp comment 'WebSocket API Server'
        sudo ufw allow 22/tcp comment 'SSH'
        log_success "UFW firewall rules added"
    elif command -v firewall-cmd &> /dev/null; then
        sudo firewall-cmd --permanent --add-port=8080/tcp
        sudo firewall-cmd --permanent --add-port=22/tcp
        sudo firewall-cmd --reload
        log_success "firewalld rules added"
    else
        log_warning "No firewall detected. Skipping"
    fi
}

# Create application directory
create_app_directory() {
    log_info "Creating application directory..."
    
    APP_DIR="/opt/websocket-api-server"
    
    if [ -d "$APP_DIR" ]; then
        log_warning "Directory $APP_DIR already exists"
        return 0
    fi
    
    sudo mkdir -p $APP_DIR
    sudo chown $USER:$USER $APP_DIR
    
    log_success "Application directory created: $APP_DIR"
}

# Create logs directory
create_logs_directory() {
    log_info "Creating logs directory..."
    
    LOGS_DIR="/var/log/websocket-api-server"
    
    sudo mkdir -p $LOGS_DIR
    sudo chown $USER:$USER $LOGS_DIR
    
    log_success "Logs directory created: $LOGS_DIR"
}

# Setup log rotation
setup_log_rotation() {
    log_info "Setting up log rotation..."
    
    sudo tee /etc/logrotate.d/websocket-api-server > /dev/null <<EOF
/var/log/websocket-api-server/*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    create 0644 $USER $USER
    sharedscripts
    postrotate
        pm2 reloadLogs
    endscript
}
EOF
    
    log_success "Log rotation configured"
}

# Print summary
print_summary() {
    echo ""
    echo "╔════════════════════════════════════════════════════════════╗"
    echo "║                   Setup Complete!                          ║"
    echo "╚════════════════════════════════════════════════════════════╝"
    echo ""
    log_success "VM provisioning complete!"
    echo ""
    echo "Next steps:"
    echo "  1. Clone the repository to /opt/websocket-api-server"
    echo "  2. Copy .env.example to .env and configure"
    echo "  3. Run: npm install"
    echo "  4. Run: ./scripts/deploy.sh"
    echo ""
    echo "Installed components:"
    echo "  - Node.js: $(node -v)"
    echo "  - npm: $(npm -v)"
    echo "  - PM2: $(pm2 -v)"
    if command -v redis-server &> /dev/null; then
        echo "  - Redis: $(redis-server --version | head -n1)"
    fi
    if command -v nats-server &> /dev/null; then
        echo "  - NATS: $(nats-server --version)"
    fi
    echo ""
}

################################################################################
# Main execution
################################################################################

main() {
    print_banner
    check_root
    detect_os
    update_system
    install_build_tools
    install_git
    install_nodejs
    install_pm2
    install_redis
    install_nats
    configure_firewall
    create_app_directory
    create_logs_directory
    setup_log_rotation
    print_summary
}

main "$@"
