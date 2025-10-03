# WebSocket API Server

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

A **production-ready, standalone Node.js WebSocket API server** designed for real-time messaging, streaming, and inference orchestration. Built to run on its own dedicated VM and allow any external platform to connect for real-time communication.

---

## ✨ Features

### 🚀 Core Capabilities
- ✅ **Full-featured WebSocket Server** with JSON message protocol
- 🔐 **JWT & API Key Authentication** 
- 📡 **Message Routing System** with extensible handlers
- 🔄 **Pub/Sub Integration** (Redis & NATS support)
- 🤖 **Inference Bridge** for REST, gRPC, and WebSocket AI/ML workers
- 📢 **Channel-based Broadcasting** with subscription management
- 💬 **Direct Messaging** between clients
- ⚡ **Rate Limiting** to prevent abuse
- 💓 **Heartbeat System** for connection health monitoring
- 🔧 **Clustering Support** for horizontal scaling

### 🏭 Production Ready
- ✅ Comprehensive error handling and logging
- ✅ Automatic reconnection with exponential backoff
- ✅ Graceful shutdown handling
- ✅ Health check and metrics endpoints
- ✅ PM2 and systemd support
- ✅ Environment-based configuration
- ✅ Beautiful demo interface included

---

## 📂 Repository Structure

```
/
├── /src
│   ├── server.js              # Main server orchestration
│   ├── config.js              # Configuration management
│   ├── router.js              # Message routing logic
│   ├── broker.js              # Pub/Sub broker (Redis/NATS)
│   ├── inference-bridge.js    # Inference worker integration
│   └── utils.js               # Utilities (auth, logging, rate limiting)
│
├── /public
│   ├── demo.html              # Interactive demo interface
│   ├── demo.css               # Demo styling
│   └── demo.js                # Demo client logic
│
├── /docs
│   ├── README.md              # Comprehensive setup guide
│   ├── ARCHITECTURE.md        # System architecture & design
│   └── API-REFERENCE.md       # Complete API documentation
│
├── /scripts
│   ├── setup.sh               # VM setup script
│   └── deploy.sh              # Deployment script
│
├── .env.example               # Environment configuration template
├── package.json               # Node.js dependencies
├── .gitignore                 # Git ignore rules
└── README.md                  # This file
```

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18.0.0 or higher
- **Redis** (optional, for pub/sub)
- **NATS** (optional, alternative to Redis)

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and update the following (at minimum):

```env
JWT_SECRET=your-secure-secret-key
API_KEY=your-api-key
```

### 3. Start the Server

**Development:**
```bash
npm run dev
```

**Production:**
```bash
npm start
```

**With PM2 (recommended for production):**
```bash
npm run pm2:start
```

### 4. Test the Server

Open your browser and navigate to:
```
http://localhost:8080/demo.html
```

Or test with curl:
```bash
curl http://localhost:8080/health
```

---

## 🌐 Connection

### WebSocket Endpoint

```javascript
const ws = new WebSocket('ws://localhost:8080/ws');

ws.onopen = () => {
  console.log('Connected');
  ws.send(JSON.stringify({ type: 'PING' }));
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  console.log('Received:', message);
};
```

### Demo Interface

The included demo interface provides a full-featured client:
- Connection management
- Authentication testing
- Broadcasting and messaging
- Inference requests
- Real-time activity logs

Access at: `http://localhost:8080/demo.html`

---

## 📡 Message Protocol

All messages use JSON format:

### Client → Server

```json
{
  "type": "MESSAGE_TYPE",
  "payload": { },
  "auth": {
    "apiKey": "your-api-key"
  }
}
```

### Available Message Types

| Type | Description |
|------|-------------|
| `PING` | Test connection |
| `BROADCAST` | Send message to channel |
| `DIRECT_MESSAGE` | Send to specific client |
| `INFERENCE_REQUEST` | Run AI/ML inference |
| `SUBSCRIBE` | Subscribe to channel |
| `UNSUBSCRIBE` | Unsubscribe from channel |
| `GET_STATUS` | Get server status |
| `LIST_CLIENTS` | List connected clients |

See [API Reference](docs/API-REFERENCE.md) for complete documentation.

---

## 🔧 Configuration

### Key Environment Variables

```env
# Server
PORT=8080
HOST=0.0.0.0
NODE_ENV=production

# Authentication
JWT_SECRET=your-secret
API_KEY=your-api-key

# Redis (for scaling)
REDIS_ENABLED=true
REDIS_HOST=localhost
REDIS_PORT=6379

# Inference
INFERENCE_ENABLED=true
INFERENCE_MODE=rest
INFERENCE_REST_URL=http://inference-vm:5000/inference

# Rate Limiting
RATE_LIMIT_ENABLED=true
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_WINDOW_MS=60000
```

See [`.env.example`](.env.example) for all options.

---

## 🚀 Production Deployment

### Automated VM Setup

```bash
# 1. Make scripts executable
chmod +x scripts/setup.sh scripts/deploy.sh

# 2. Run setup (installs Node.js, Redis, PM2, etc.)
sudo ./scripts/setup.sh

# 3. Deploy application
./scripts/deploy.sh
```

### Manual Deployment

```bash
# Install dependencies
npm ci --production

# Start with PM2
pm2 start src/server.js --name websocket-api-server

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
```

### Docker Deployment

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
EXPOSE 8080
CMD ["node", "src/server.js"]
```

---

## 📊 Monitoring

### Health Check

```bash
curl http://localhost:8080/health
```

Response:
```json
{
  "status": "healthy",
  "uptime": 123.45,
  "clients": 42,
  "broker": true,
  "inference": true,
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Metrics

```bash
curl http://localhost:8080/metrics
```

### PM2 Monitoring

```bash
pm2 logs websocket-api-server  # View logs
pm2 status                      # View status
pm2 monit                       # Real-time monitoring
```

---

## 🧪 Testing

### Using the Demo Interface

1. Open `http://localhost:8080/demo.html`
2. Configure server URL and authentication
3. Click "Connect"
4. Try different operations
5. View real-time logs

### Using Code

**JavaScript:**
```javascript
const ws = new WebSocket('ws://localhost:8080/ws');

ws.onopen = () => {
  ws.send(JSON.stringify({
    type: 'BROADCAST',
    payload: {
      channel: 'test',
      message: 'Hello, World!'
    },
    auth: {
      apiKey: 'your-api-key'
    }
  }));
};
```

**Python:**
```python
import websocket
import json

ws = websocket.WebSocket()
ws.connect("ws://localhost:8080/ws")

ws.send(json.dumps({
    "type": "PING",
    "auth": {"apiKey": "your-api-key"}
}))

print(ws.recv())
```

---

## 🔄 Integration with Inference Workers

### REST Mode

Configure in `.env`:
```env
INFERENCE_MODE=rest
INFERENCE_REST_URL=http://inference-vm:5000/inference
```

Expected API format:
```bash
POST /inference
Content-Type: application/json

{
  "input": "text to process",
  "options": {}
}
```

### WebSocket Mode

```env
INFERENCE_MODE=websocket
INFERENCE_WS_URL=ws://inference-vm:5001
```

### gRPC Mode (Stub)

```env
INFERENCE_MODE=grpc
INFERENCE_GRPC_HOST=inference-vm
INFERENCE_GRPC_PORT=50051
```

---

## 📈 Scaling

### Single Server (Vertical Scaling)

Enable clustering to use all CPU cores:
```env
CLUSTER_ENABLED=true
CLUSTER_WORKERS=max
```

### Multiple Servers (Horizontal Scaling)

1. Enable Redis for pub/sub:
```env
REDIS_ENABLED=true
REDIS_HOST=redis-server
```

2. Deploy multiple instances behind a load balancer
3. Configure sticky sessions on load balancer
4. Messages are distributed via Redis pub/sub

See [Architecture Guide](docs/ARCHITECTURE.md) for detailed scaling strategies.

---

## 📚 Documentation

- **[Setup & Usage Guide](docs/README.md)** - Detailed installation and usage
- **[Architecture Guide](docs/ARCHITECTURE.md)** - System design and scaling
- **[API Reference](docs/API-REFERENCE.md)** - Complete API documentation

---

## 🛠️ Tech Stack

- **Node.js** - Runtime environment
- **ws** - WebSocket implementation
- **Express** - HTTP server
- **Redis/NATS** - Pub/sub messaging
- **Winston** - Logging
- **JWT** - Authentication
- **PM2** - Process management

---

## 📝 Use Cases

- **Real-time Chat Applications** - Multi-channel messaging
- **Live Dashboards** - Real-time data streaming
- **Collaborative Tools** - Multi-user collaboration
- **AI/ML Inference** - Distributed inference orchestration
- **IoT Communication** - Device-to-device messaging
- **Gaming** - Real-time game state synchronization
- **Notifications** - Push notification delivery
- **Live Streaming** - Stream metadata and control

---

## 🤝 Contributing

Contributions are welcome! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Update documentation
6. Submit a pull request

---

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

---

## 🙏 Support

For questions, issues, or feature requests:

1. Check the [documentation](docs/)
2. Review [API Reference](docs/API-REFERENCE.md)
3. Check [Architecture Guide](docs/ARCHITECTURE.md)
4. Open an issue on GitHub

---

## 🎯 Roadmap

- [ ] Message persistence and replay
- [ ] Advanced authentication (OAuth 2.0)
- [ ] Role-based access control
- [ ] Real-time analytics dashboard
- [ ] Protocol buffers support
- [ ] Multi-region deployment guide
- [ ] Kubernetes deployment examples
- [ ] Performance benchmarks

---

Made with ❤️ for real-time communication

