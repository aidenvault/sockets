# Getting Started with WebSocket API Server

Welcome! This guide will help you get the WebSocket API Server up and running in minutes.

---

## 📋 What You'll Need

- **Node.js 18 or higher** ([Download](https://nodejs.org/))
- **Terminal/Command Line** access
- **5 minutes** of your time

Optional:
- **Redis** (for scaling across multiple servers)
- **Docker** (for containerized deployment)

---

## 🚀 Quick Start (3 Steps)

### Step 1: Install Dependencies

```bash
npm install
```

This installs all required packages (~30 dependencies).

### Step 2: Configure Environment

```bash
cp .env.example .env
```

**Important:** Edit `.env` and change these for production:
```env
JWT_SECRET=your-secure-secret-here
API_KEY=your-api-key-here
```

Generate secure values:
```bash
# Generate JWT secret
openssl rand -base64 32

# Generate API key
openssl rand -hex 32
```

### Step 3: Start the Server

```bash
npm start
```

You should see:
```
╔════════════════════════════════════════════════════════════╗
║  WebSocket API Server                                      ║
╠════════════════════════════════════════════════════════════╣
║  HTTP:       http://0.0.0.0:8080                          ║
║  WebSocket:  ws://0.0.0.0:8080/ws                         ║
║  Demo:       http://0.0.0.0:8080/demo.html                ║
╠════════════════════════════════════════════════════════════╣
║  Broker:     ✗ Disabled                                    ║
║  Inference:  ✗ Disabled                                    ║
╚════════════════════════════════════════════════════════════╝
```

**🎉 That's it! Your server is running.**

---

## ✅ Verify Installation

### Test 1: Open Demo Interface

Navigate to: **http://localhost:8080/demo.html**

1. Click **"Connect"**
2. You should see "Connected" status
3. Try **"Send Ping"** - you should get a PONG response

### Test 2: Health Check

```bash
curl http://localhost:8080/health
```

Expected response:
```json
{
  "status": "healthy",
  "uptime": 5.234,
  "clients": 0,
  "broker": false,
  "inference": false,
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Test 3: Run Test Script

```bash
./scripts/test-connection.sh
```

This runs automated tests to verify everything works.

---

## 🎮 Try It Out

### Connect from JavaScript

```javascript
const ws = new WebSocket('ws://localhost:8080/ws');

ws.onopen = () => {
  console.log('Connected!');
  
  // Send ping
  ws.send(JSON.stringify({
    type: 'PING',
    auth: {
      apiKey: 'your-api-key'
    }
  }));
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  console.log('Received:', message);
};
```

### Connect from Python

```python
import websocket
import json

ws = websocket.WebSocket()
ws.connect("ws://localhost:8080/ws")

# Send ping
ws.send(json.dumps({
    "type": "PING",
    "auth": {
        "apiKey": "your-api-key"
    }
}))

# Receive response
print(json.loads(ws.recv()))
```

---

## 🔧 Common Configuration

### Enable Redis (for scaling)

1. **Install Redis:**
   ```bash
   # macOS
   brew install redis && brew services start redis
   
   # Ubuntu/Debian
   sudo apt install redis-server && sudo systemctl start redis
   
   # Docker
   docker run -d -p 6379:6379 redis:alpine
   ```

2. **Update `.env`:**
   ```env
   REDIS_ENABLED=true
   REDIS_HOST=localhost
   REDIS_PORT=6379
   ```

3. **Restart server**

### Enable Inference Workers

1. **Update `.env`:**
   ```env
   INFERENCE_ENABLED=true
   INFERENCE_MODE=rest
   INFERENCE_REST_URL=http://your-inference-server:5000/inference
   ```

2. **Restart server**

### Enable Rate Limiting

Already enabled by default! Configure in `.env`:
```env
RATE_LIMIT_ENABLED=true
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_WINDOW_MS=60000
```

---

## 🐳 Docker Quick Start

### Using Docker Compose (Includes Redis)

```bash
# Start server + Redis
docker-compose up -d

# View logs
docker-compose logs -f websocket-server

# Stop
docker-compose down
```

### Using Docker Only

```bash
# Build
docker build -t websocket-server .

# Run
docker run -p 8080:8080 \
  -e JWT_SECRET=my-secret \
  -e API_KEY=my-key \
  websocket-server
```

---

## 🖥️ Production Deployment

### Automated VM Setup

For a fresh Ubuntu/Debian VM:

```bash
# 1. Make scripts executable
chmod +x scripts/*.sh

# 2. Run setup (installs Node.js, Redis, PM2, Nginx)
sudo ./scripts/setup.sh

# 3. Copy your code to /opt/websocket-api-server

# 4. Deploy
./scripts/deploy.sh
```

### Manual PM2 Deployment

```bash
# Install PM2 globally
npm install -g pm2

# Start server
pm2 start src/server.js --name websocket-server

# Save configuration
pm2 save

# Setup auto-start on boot
pm2 startup
```

---

## 📚 Next Steps

### Learn the API

Read the [API Reference](docs/API-REFERENCE.md) to learn about all message types:
- `PING` / `PONG`
- `BROADCAST`
- `DIRECT_MESSAGE`
- `INFERENCE_REQUEST`
- `SUBSCRIBE` / `UNSUBSCRIBE`
- And more...

### Understand Architecture

Read [ARCHITECTURE.md](docs/ARCHITECTURE.md) to learn:
- How the system works
- Scaling strategies
- Performance optimization
- Security best practices

### Integrate with Your App

See code examples in:
- [API Reference](docs/API-REFERENCE.md#code-examples)
- [Main README](README.md#connection)

---

## 🐛 Troubleshooting

### Port Already in Use

**Error:** `EADDRINUSE: address already in use :::8080`

**Solution:** Change port in `.env`:
```env
PORT=8081
```

### Dependencies Won't Install

**Error:** `npm ERR! ...`

**Solution:**
```bash
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

### Can't Connect from Another Machine

**Solution:** Check firewall:
```bash
sudo ufw allow 8080/tcp
```

And ensure HOST is set correctly in `.env`:
```env
HOST=0.0.0.0  # Listen on all interfaces
```

### Authentication Errors

**Error:** `AUTH_REQUIRED`

**Solution:** Make sure you're sending auth with each message:
```javascript
{
  "type": "PING",
  "auth": {
    "apiKey": "your-api-key"
  }
}
```

### Redis Connection Errors

**Error:** `Redis connection failed`

**Solution:**
1. Check if Redis is running: `redis-cli ping`
2. Verify Redis host/port in `.env`
3. Or disable Redis: `REDIS_ENABLED=false`

---

## 🆘 Need Help?

### Documentation
- **[README.md](README.md)** - Project overview
- **[QUICKSTART.md](QUICKSTART.md)** - 5-minute guide
- **[docs/README.md](docs/README.md)** - Comprehensive guide
- **[API-REFERENCE.md](docs/API-REFERENCE.md)** - Complete API
- **[ARCHITECTURE.md](docs/ARCHITECTURE.md)** - System design

### Support
1. Check the documentation
2. Review [API examples](docs/API-REFERENCE.md#code-examples)
3. Read [troubleshooting](#troubleshooting)
4. Open an issue on GitHub

---

## 📊 Available Commands

```bash
# Development
npm run dev          # Start with auto-reload

# Production
npm start            # Start server
npm run pm2:start    # Start with PM2
npm run pm2:stop     # Stop PM2
npm run pm2:restart  # Restart PM2
npm run pm2:logs     # View PM2 logs

# Testing
./scripts/test-connection.sh   # Test server
```

---

## 🎯 What You Can Build

This server is perfect for:

- ✅ **Chat Applications** - Real-time messaging
- ✅ **Live Dashboards** - Real-time data updates
- ✅ **Collaborative Tools** - Multi-user editing
- ✅ **AI/ML Services** - Inference orchestration
- ✅ **IoT Systems** - Device communication
- ✅ **Gaming Backends** - Real-time game state
- ✅ **Notification Systems** - Push notifications
- ✅ **Live Streaming** - Stream controls

---

## ✨ Key Features

- ✅ WebSocket + HTTP server
- ✅ JWT & API key auth
- ✅ Redis/NATS pub/sub
- ✅ Inference worker integration
- ✅ Rate limiting
- ✅ Heartbeat monitoring
- ✅ Clustering support
- ✅ Beautiful demo UI
- ✅ Production-ready
- ✅ Fully documented

---

## 🎉 You're Ready!

Your WebSocket API Server is now running. Start building your real-time application!

**Pro Tips:**
- Open the demo interface to explore features
- Read the API reference for all capabilities
- Check the architecture guide for scaling strategies
- Review security best practices before going to production

**Happy coding!** 🚀

---

*For detailed information, see [README.md](README.md) or [docs/](docs/)*
