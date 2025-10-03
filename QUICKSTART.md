# 🚀 Quick Start Guide

This guide will get you up and running with the WebSocket API Server in minutes.

---

## Option 1: Local Development (Fastest)

```bash
# 1. Install dependencies
npm install

# 2. Copy environment file
cp .env.example .env

# 3. Start the server
npm start
```

**Access Points:**
- Demo UI: http://localhost:8080/demo/demo.html
- Health Check: http://localhost:8080/health
- WebSocket: ws://localhost:8080/ws

---

## Option 2: Docker (Recommended for Testing)

```bash
# 1. Build and start with Docker Compose
docker-compose up -d

# 2. View logs
docker-compose logs -f

# 3. Stop
docker-compose down
```

**Access Points:**
- Demo UI: http://localhost:8080/demo/demo.html
- Redis included and auto-configured

---

## Option 3: Production VM Deployment

```bash
# 1. Setup empty VM (installs Node.js, PM2, Redis, etc.)
chmod +x scripts/setup.sh
./scripts/setup.sh

# 2. Configure environment
cp .env.example .env
nano .env  # Edit with your settings

# 3. Deploy with PM2
chmod +x scripts/deploy.sh
./scripts/deploy.sh pm2
```

**Manage Server:**
```bash
pm2 logs websocket-api-server  # View logs
pm2 restart websocket-api-server  # Restart
pm2 stop websocket-api-server  # Stop
```

---

## Testing the Server

### Using the Demo Interface

1. Open http://localhost:8080/demo/demo.html in your browser
2. Click "Connect" button
3. Try the quick actions:
   - **Send Ping** - Test connection
   - **Get Stats** - View server statistics
   - **Broadcast Message** - Send to all clients
   - **Inference Request** - Test AI integration

### Using curl (HTTP Endpoints)

```bash
# Health check
curl http://localhost:8080/health

# Get server statistics
curl http://localhost:8080/api/stats

# Generate authentication token
curl -X POST http://localhost:8080/api/auth/token \
  -H "Content-Type: application/json" \
  -d '{"userId": "test-user", "apiKey": "dev-api-key"}'
```

### Using JavaScript Client

```javascript
// Connect to WebSocket
const ws = new WebSocket('ws://localhost:8080/ws');

ws.onopen = () => {
  console.log('Connected!');
  
  // Send a ping
  ws.send(JSON.stringify({ type: 'PING' }));
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  console.log('Received:', message);
};

// Broadcast a message
ws.send(JSON.stringify({
  type: 'BROADCAST',
  payload: { message: 'Hello, everyone!' }
}));
```

### Using wscat (CLI Tool)

```bash
# Install wscat
npm install -g wscat

# Connect to server
wscat -c ws://localhost:8080/ws

# Send messages (type and press Enter)
> {"type": "PING"}
> {"type": "GET_STATS"}
> {"type": "BROADCAST", "payload": {"message": "Hello"}}
```

---

## Common Message Types

### PING - Test Connection
```json
{"type": "PING"}
```

### BROADCAST - Send to All
```json
{
  "type": "BROADCAST",
  "payload": {"message": "Hello, everyone!"}
}
```

### SUBSCRIBE - Join a Room
```json
{
  "type": "SUBSCRIBE",
  "payload": {"channel": "general"}
}
```

### ROOM_MESSAGE - Send to Room
```json
{
  "type": "ROOM_MESSAGE",
  "payload": {
    "channel": "general",
    "message": "Hello, room!"
  }
}
```

### INFERENCE_REQUEST - AI/ML Request
```json
{
  "type": "INFERENCE_REQUEST",
  "payload": {"input": "What is AI?"},
  "requestId": "req_123"
}
```

---

## Configuration (`.env` file)

Essential settings:

```bash
# Server
NODE_ENV=production
PORT=8080

# Security
JWT_SECRET=your-super-secret-change-this
API_KEY=your-api-key-change-this

# Redis (for scaling)
REDIS_ENABLED=true
REDIS_HOST=localhost
REDIS_PORT=6379

# Inference
INFERENCE_ENABLED=true
INFERENCE_ENDPOINT=http://your-inference-vm:5000/inference
```

---

## Connecting from External VM/Platform

### 1. Get Authentication Token

```bash
curl -X POST http://your-server:8080/api/auth/token \
  -H "Content-Type: application/json" \
  -d '{"userId": "external-service", "apiKey": "your-api-key"}'
```

Response:
```json
{"token": "eyJhbGc..."}
```

### 2. Connect via WebSocket

```javascript
const ws = new WebSocket('ws://your-server:8080/ws?token=YOUR_TOKEN');

ws.onopen = () => {
  console.log('Connected from external VM');
};
```

### 3. Send/Receive Messages

```javascript
// Send
ws.send(JSON.stringify({
  type: 'BROADCAST',
  payload: { message: 'Hello from external VM' }
}));

// Receive
ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  console.log('Received:', message);
};
```

---

## Monitoring

### Health Check
```bash
curl http://localhost:8080/health
```

### Server Statistics
```bash
curl http://localhost:8080/api/stats
```

### View Logs
```bash
# Docker
docker-compose logs -f websocket-server

# PM2
pm2 logs websocket-api-server

# File logs
tail -f logs/combined.log
```

---

## Scaling

### Horizontal Scaling

1. **Enable Redis in `.env`:**
   ```bash
   REDIS_ENABLED=true
   REDIS_HOST=your-redis-server
   ```

2. **Deploy multiple instances:**
   ```bash
   # Instance 1
   PORT=8081 npm start

   # Instance 2
   PORT=8082 npm start
   ```

3. **Setup load balancer (nginx):**
   ```nginx
   upstream websocket_backend {
       ip_hash;
       server localhost:8081;
       server localhost:8082;
   }

   server {
       location /ws {
           proxy_pass http://websocket_backend;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection "upgrade";
       }
   }
   ```

---

## Troubleshooting

### Server won't start
```bash
# Check if port is in use
lsof -i :8080

# Check Node.js version (must be >= 18)
node --version

# Install dependencies
npm install
```

### WebSocket connection fails
```bash
# Verify server is running
curl http://localhost:8080/health

# Check authentication (in production mode)
# Review browser console for errors
# Check firewall rules
```

### Redis connection fails
```bash
# Check Redis is running
redis-cli ping

# Start Redis
sudo systemctl start redis-server  # Linux
brew services start redis  # macOS
```

---

## Next Steps

1. **Review Documentation:**
   - [README.md](README.md) - Overview
   - [docs/API-REFERENCE.md](docs/API-REFERENCE.md) - Complete API
   - [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) - System design

2. **Configure for Production:**
   - Change JWT_SECRET and API_KEY
   - Enable Redis for scaling
   - Setup SSL/TLS certificates
   - Configure firewall rules

3. **Integrate with Your Services:**
   - Connect inference VMs
   - Add custom message handlers
   - Implement your business logic

4. **Deploy:**
   - Use deployment scripts
   - Setup monitoring
   - Configure backups

---

## Support

- 📖 Full Documentation: [docs/README.md](docs/README.md)
- 🏗️ Architecture: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- 📡 API Reference: [docs/API-REFERENCE.md](docs/API-REFERENCE.md)

---

**🎉 You're all set! Start building amazing real-time applications!**
