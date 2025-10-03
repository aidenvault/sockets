# Quick Start Guide

Get the WebSocket API Server running in 5 minutes! ⚡

---

## 📦 Prerequisites

- **Node.js 18+** installed ([Download](https://nodejs.org/))
- **Terminal/Command Line** access

---

## 🚀 Installation (3 Steps)

### Step 1: Install Dependencies

```bash
npm install
```

### Step 2: Create Configuration

```bash
cp .env.example .env
```

### Step 3: Start Server

```bash
npm start
```

**That's it!** 🎉

---

## ✅ Verify It Works

### Open Demo Interface

Navigate to: **http://localhost:8080/demo.html**

### Or Test with curl

```bash
curl http://localhost:8080/health
```

Expected response:
```json
{
  "status": "healthy",
  "uptime": 1.234,
  "clients": 0,
  ...
}
```

---

## 🧪 Try It Out

### 1. Connect via Demo Interface

1. Open http://localhost:8080/demo.html
2. Click **"Connect"** button
3. See "Connected" status ✅

### 2. Send a Ping

1. Click **"Send Ping"** button
2. Watch for "PONG" response in the log

### 3. Broadcast a Message

1. Type a message in "Broadcast Message" box
2. Click **"Broadcast"** button
3. Open another browser tab to see the message received

---

## 🔐 Add Authentication (Optional but Recommended)

### Edit `.env` file:

```env
JWT_SECRET=my-secret-key-123
API_KEY=my-api-key-456
```

### Use in Demo Interface:

1. Select "API Key" from Authentication Type
2. Enter: `my-api-key-456`
3. Connect

---

## 🐳 Docker Quick Start (Alternative)

### Build Image

```bash
docker build -t websocket-server .
```

### Run Container

```bash
docker run -p 8080:8080 \
  -e JWT_SECRET=my-secret \
  -e API_KEY=my-key \
  websocket-server
```

---

## 🔌 Connect from Code

### JavaScript

```javascript
const ws = new WebSocket('ws://localhost:8080/ws');

ws.onopen = () => {
  console.log('Connected!');
  ws.send(JSON.stringify({ type: 'PING' }));
};

ws.onmessage = (event) => {
  console.log('Received:', JSON.parse(event.data));
};
```

### Python

```python
import websocket
import json

ws = websocket.WebSocket()
ws.connect("ws://localhost:8080/ws")
ws.send(json.dumps({"type": "PING"}))
print(ws.recv())
```

### cURL (HTTP Endpoints)

```bash
# Health check
curl http://localhost:8080/health

# Metrics
curl http://localhost:8080/metrics
```

---

## 📊 Common Operations

### Send Broadcast

```javascript
ws.send(JSON.stringify({
  type: 'BROADCAST',
  payload: {
    channel: 'general',
    message: 'Hello, everyone!'
  },
  auth: {
    apiKey: 'your-api-key'
  }
}));
```

### Get Server Status

```javascript
ws.send(JSON.stringify({
  type: 'GET_STATUS',
  auth: {
    apiKey: 'your-api-key'
  }
}));
```

### Run Inference (if configured)

```javascript
ws.send(JSON.stringify({
  type: 'INFERENCE_REQUEST',
  payload: {
    input: 'What is the capital of France?'
  },
  auth: {
    apiKey: 'your-api-key'
  }
}));
```

---

## 🔧 Configuration

### Enable Redis (for scaling)

1. Install Redis:
   ```bash
   # macOS
   brew install redis
   brew services start redis
   
   # Ubuntu
   sudo apt install redis-server
   sudo systemctl start redis-server
   ```

2. Update `.env`:
   ```env
   REDIS_ENABLED=true
   REDIS_HOST=localhost
   REDIS_PORT=6379
   ```

3. Restart server

### Enable Inference

1. Update `.env`:
   ```env
   INFERENCE_ENABLED=true
   INFERENCE_MODE=rest
   INFERENCE_REST_URL=http://your-inference-server:5000/inference
   ```

2. Restart server

---

## 🐛 Troubleshooting

### Port Already in Use

Change port in `.env`:
```env
PORT=8081
```

### Cannot Connect

Check firewall:
```bash
# Allow port 8080
sudo ufw allow 8080/tcp
```

### Dependencies Won't Install

Clear cache and retry:
```bash
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

---

## 📚 What's Next?

### Learn More

- **[Full Documentation](docs/README.md)** - Comprehensive guide
- **[API Reference](docs/API-REFERENCE.md)** - All message types
- **[Architecture](docs/ARCHITECTURE.md)** - System design

### Production Deployment

- **[Setup Script](scripts/setup.sh)** - Automated VM setup
- **[Deploy Script](scripts/deploy.sh)** - Production deployment
- **[Security Guide](SECURITY.md)** - Security best practices

### Advanced Features

- Enable clustering for multiple cores
- Add Redis for distributed messaging
- Configure inference workers
- Set up reverse proxy (Nginx)
- Enable rate limiting
- Configure monitoring

---

## 💡 Tips

### Development Mode

Auto-reload on file changes:
```bash
npm run dev
```

### View Logs

```bash
tail -f logs/app.log
```

### Production with PM2

```bash
# Install PM2
npm install -g pm2

# Start server
pm2 start src/server.js --name websocket-server

# View logs
pm2 logs websocket-server

# Monitor
pm2 monit
```

---

## ❓ Need Help?

- Check [Documentation](docs/)
- Review [Examples](docs/API-REFERENCE.md#code-examples)
- Read [Architecture Guide](docs/ARCHITECTURE.md)
- Open an issue on GitHub

---

## 🎉 You're All Set!

Your WebSocket API Server is running and ready for:
- Real-time messaging
- Broadcasting
- Inference orchestration
- Multi-client communication

**Happy coding!** 🚀
