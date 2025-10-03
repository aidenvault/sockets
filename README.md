# WebSocket API Server

[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

> **Production-ready WebSocket API server for real-time messaging, streaming, and inference orchestration**

A standalone Node.js WebSocket server designed to run on its own dedicated VM, enabling any external platform or service to connect for seamless real-time communication and AI inference orchestration.

---

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Copy environment configuration
cp .env.example .env

# Edit .env with your settings
nano .env

# Start the server
npm start
```

Open your browser and navigate to: `http://localhost:8080/demo/demo.html`

---

## ✨ Features

### Core Capabilities
- ✅ **High-Performance WebSocket Server** - Built on the `ws` library
- ✅ **JWT Authentication** - Secure token-based authentication
- ✅ **Real-Time Messaging** - Broadcast, direct messages, and room-based chat
- ✅ **Inference Bridge** - Connect to external AI/ML inference VMs
- ✅ **Pub/Sub Scaling** - Redis and NATS support for horizontal scaling
- ✅ **Rate Limiting** - Prevent abuse with configurable limits
- ✅ **Connection Management** - Track and manage active connections
- ✅ **Graceful Shutdown** - Clean connection cleanup on shutdown

### Production-Ready
- 🔒 **Security** - Authentication, rate limiting, CORS support
- 📊 **Monitoring** - Health checks, stats endpoints, comprehensive logging
- 🚀 **Deployment** - PM2 and systemd support with automated scripts
- 📈 **Scalable** - Horizontal scaling with Redis/NATS broker
- 🛡️ **Resilient** - Error handling, retries, automatic recovery
- 📝 **Well Documented** - Complete API reference and architecture docs

### Developer Experience
- 🎨 **Beautiful Demo UI** - Interactive web interface for testing
- 📚 **Comprehensive Docs** - API reference, architecture, deployment guides
- 🔧 **Extensible** - Easy to add custom message handlers
- 🐳 **Docker Ready** - Easy containerization

---

## 📂 Repository Structure

```
/workspace
  ├── /src                          # Core server code
  │     ├── server.js               # Main WebSocket server
  │     ├── config.js               # Configuration management
  │     ├── router.js               # Message routing & handlers
  │     ├── broker.js               # Pub/Sub (Redis/NATS)
  │     ├── inference-bridge.js     # Inference VM connector
  │     └── utils.js                # Utilities (logging, auth)
  │
  ├── /public                       # Demo interface
  │     ├── demo.html               # Demo web page
  │     ├── demo.css                # Demo styling
  │     └── demo.js                 # Client-side WebSocket logic
  │
  ├── /docs                         # Documentation
  │     ├── README.md               # Main documentation
  │     ├── ARCHITECTURE.md         # System architecture
  │     └── API-REFERENCE.md        # Complete API reference
  │
  ├── /scripts                      # Deployment scripts
  │     ├── setup.sh                # VM provisioning script
  │     └── deploy.sh               # Deployment script
  │
  ├── .env.example                  # Environment template
  ├── package.json                  # Dependencies
  ├── .gitignore                    # Git ignore rules
  └── README.md                     # This file
```

---

## 📋 Prerequisites

- **Node.js** >= 18.0.0
- **npm** >= 8.0.0
- **Redis** (optional, for scaling)
- **NATS** (optional, alternative to Redis)

---

## 🔧 Installation

### Local Development

```bash
# Clone the repository
git clone <repository-url>
cd websocket-api-server

# Install dependencies
npm install

# Configure environment
cp .env.example .env
nano .env

# Start development server (with auto-reload)
npm run dev

# Or start production mode
npm start
```

### Production Deployment

```bash
# 1. Setup empty VM
chmod +x scripts/setup.sh
./scripts/setup.sh

# 2. Deploy with PM2 (recommended)
chmod +x scripts/deploy.sh
./scripts/deploy.sh pm2

# Or deploy with systemd
./scripts/deploy.sh systemd
```

---

## 🌐 Endpoints

### WebSocket
- **ws://localhost:8080/ws** - WebSocket endpoint

### HTTP
- **http://localhost:8080/** - Redirects to demo
- **http://localhost:8080/demo/demo.html** - Demo interface
- **http://localhost:8080/health** - Health check
- **http://localhost:8080/api/stats** - Server statistics
- **http://localhost:8080/api/auth/token** - Generate JWT token

---

## 💻 Usage Examples

### JavaScript Client

```javascript
// Connect to WebSocket
const ws = new WebSocket('ws://localhost:8080/ws?token=YOUR_TOKEN');

ws.onopen = () => {
  console.log('Connected!');
  
  // Send a ping
  ws.send(JSON.stringify({ type: 'PING' }));
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  console.log('Received:', message);
};

// Broadcast message
ws.send(JSON.stringify({
  type: 'BROADCAST',
  payload: { message: 'Hello, everyone!' }
}));

// Inference request
ws.send(JSON.stringify({
  type: 'INFERENCE_REQUEST',
  payload: { input: 'What is AI?' },
  requestId: 'req_123'
}));
```

### Python Client

```python
import websocket
import json

ws = websocket.WebSocket()
ws.connect("ws://localhost:8080/ws?token=YOUR_TOKEN")

# Send ping
ws.send(json.dumps({"type": "PING"}))

# Receive response
response = json.loads(ws.recv())
print(response)
```

---

## 🔌 Connecting Inference VMs

### Configure Endpoint

```bash
# In .env
INFERENCE_ENABLED=true
INFERENCE_ENDPOINT=http://your-inference-vm:5000/inference
```

### Add Custom Endpoints

```javascript
import inferenceBridge from './src/inference-bridge.js';

// Add multiple inference endpoints
inferenceBridge.addEndpoint('gpt-4', 'http://gpt4-vm:5000/inference');
inferenceBridge.addEndpoint('llama', 'http://llama-vm:5000/inference');
```

### Send Inference Request

```javascript
ws.send(JSON.stringify({
  type: 'INFERENCE_REQUEST',
  payload: {
    input: 'Your prompt here',
    model: 'gpt-4'
  },
  requestId: 'req_123'
}));
```

---

## 📊 Monitoring

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
# PM2
pm2 logs websocket-api-server

# Systemd
sudo journalctl -u websocket-api-server -f

# File logs
tail -f logs/combined.log
```

---

## 🔐 Security

### Production Checklist

- [ ] Change `JWT_SECRET` in `.env`
- [ ] Change `API_KEY` in `.env`
- [ ] Set `NODE_ENV=production`
- [ ] Configure rate limiting
- [ ] Setup firewall rules
- [ ] Use WSS (secure WebSocket)
- [ ] Restrict CORS origins
- [ ] Enable authentication

### Generate Authentication Token

```bash
curl -X POST http://localhost:8080/api/auth/token \
  -H "Content-Type: application/json" \
  -d '{"userId": "user123", "apiKey": "your-api-key"}'
```

---

## 📈 Scaling

### Horizontal Scaling with Redis

```bash
# Install Redis
sudo apt-get install redis-server

# Enable in .env
REDIS_ENABLED=true
REDIS_HOST=localhost
REDIS_PORT=6379

# Deploy multiple instances behind load balancer
```

### Clustering Mode

```bash
# Enable in .env
CLUSTER_ENABLED=true
CLUSTER_WORKERS=4
```

---

## 🧪 Testing

### Using Demo Interface

1. Open `http://localhost:8080/demo/demo.html`
2. Click "Connect"
3. Try quick actions or send custom messages
4. Monitor the message log

### Using wscat

```bash
# Install wscat
npm install -g wscat

# Connect
wscat -c ws://localhost:8080/ws

# Send messages
> {"type": "PING"}
> {"type": "GET_STATS"}
```

---

## 📚 Documentation

- **[docs/README.md](docs/README.md)** - Comprehensive documentation
- **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** - System architecture
- **[docs/API-REFERENCE.md](docs/API-REFERENCE.md)** - Complete API reference

---

## 🛠️ Development

### Project Structure

- `src/server.js` - WebSocket server and HTTP endpoints
- `src/router.js` - Message routing and handlers
- `src/broker.js` - Pub/sub integration
- `src/inference-bridge.js` - Inference VM connector
- `src/config.js` - Configuration management
- `src/utils.js` - Logging, auth, utilities

### Adding Custom Handlers

```javascript
// In src/router.js
router.register('CUSTOM_TYPE', async (clientId, payload, ws, requestId) => {
  // Your custom logic
  router.sendResponse(ws, 'CUSTOM_RESPONSE', { result: 'ok' }, requestId);
});
```

---

## 🐛 Troubleshooting

### Server won't start
```bash
# Check port availability
lsof -i :8080

# Check Node.js version
node --version  # Should be >= 18

# Check environment variables
cat .env
```

### WebSocket connection fails
```bash
# Verify server is running
curl http://localhost:8080/health

# Check authentication token
# Check firewall rules
# Review browser console for errors
```

### Redis connection fails
```bash
# Check Redis is running
redis-cli ping

# Verify Redis configuration in .env
```

---

## 📝 License

MIT License - See LICENSE file for details

---

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

---

## 📞 Support

- 📖 Check [documentation](docs/README.md)
- 🐛 Open an [issue](https://github.com/your-repo/issues)
- 💬 Review logs for error messages

---

## 🌟 Features Roadmap

- [ ] WebRTC support for peer-to-peer connections
- [ ] GraphQL subscriptions over WebSocket
- [ ] Message persistence and replay
- [ ] Advanced analytics dashboard
- [ ] Multi-tenancy support
- [ ] Plugin system for extensibility

---

**Built with ❤️ for real-time communication and AI orchestration**

---

## Quick Links

- 🚀 [Quick Start](#-quick-start)
- 📚 [Documentation](docs/README.md)
- 🏗️ [Architecture](docs/ARCHITECTURE.md)
- 📡 [API Reference](docs/API-REFERENCE.md)
- 🔧 [Configuration](#-installation)
- 🚢 [Deployment](#-production-deployment)
