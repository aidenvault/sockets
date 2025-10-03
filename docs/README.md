# WebSocket API Server

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-green.svg)
![License](https://img.shields.io/badge/license-MIT-blue.svg)

A **production-ready, feature-rich WebSocket API server** built with Node.js for real-time messaging, streaming, and inference orchestration. Designed to run on a dedicated VM and allow any external platform to connect for seamless real-time communication.

---

## 🌟 Features

### Core Functionality
- **WebSocket Server**: High-performance WebSocket server using the `ws` library
- **Authentication**: JWT-based authentication with token verification
- **Message Routing**: Flexible message routing system with extensible handlers
- **Pub/Sub Integration**: Redis and NATS support for horizontal scaling
- **Inference Bridge**: Connect to external inference VMs/services
- **Room/Channel System**: Subscribe to rooms for targeted messaging
- **Direct Messaging**: Send messages to specific clients
- **Broadcasting**: Broadcast messages to all connected clients

### Production Features
- **Rate Limiting**: Prevent abuse with configurable rate limits
- **Connection Management**: Track and manage active connections
- **Graceful Shutdown**: Clean shutdown with connection cleanup
- **Comprehensive Logging**: Winston-based logging system
- **Health Checks**: HTTP endpoints for monitoring
- **Error Handling**: Robust error handling and recovery
- **CORS Support**: Configurable CORS for cross-origin requests

### Scaling & Deployment
- **Horizontal Scaling**: Redis/NATS pub/sub for multi-instance deployment
- **PM2 Support**: Process management with PM2
- **Systemd Integration**: Run as a system service
- **Environment Configuration**: Full environment variable support
- **Docker Ready**: Easy containerization

---

## 📋 Prerequisites

- **Node.js**: Version 18.0.0 or higher
- **npm**: Version 8.0.0 or higher
- **Redis** (optional): For pub/sub scaling
- **NATS** (optional): Alternative to Redis for pub/sub

---

## 🚀 Quick Start

### 1. Clone and Install

```bash
# Clone the repository
git clone <repository-url>
cd websocket-api-server

# Install dependencies
npm install
```

### 2. Configure Environment

```bash
# Copy example environment file
cp .env.example .env

# Edit .env with your configuration
nano .env
```

### 3. Run the Server

```bash
# Development mode (with auto-reload)
npm run dev

# Production mode
npm start
```

### 4. Access Demo Interface

Open your browser and navigate to:
```
http://localhost:8080/demo/demo.html
```

---

## 🔧 Configuration

All configuration is managed through environment variables. See `.env.example` for all available options.

### Essential Configuration

```bash
# Server
NODE_ENV=production
PORT=8080
HOST=0.0.0.0

# Authentication
JWT_SECRET=your-super-secret-jwt-key-change-this
API_KEY=your-api-key-for-service-auth

# Redis (for scaling)
REDIS_ENABLED=true
REDIS_HOST=localhost
REDIS_PORT=6379
```

### Optional Configuration

- **NATS**: Alternative message broker
- **Inference**: Configure inference VM endpoints
- **Logging**: Customize log levels and output
- **Security**: Rate limiting and connection limits
- **Clustering**: Enable multi-core support

---

## 📡 API Usage

### WebSocket Connection

Connect to the WebSocket server:

```javascript
const ws = new WebSocket('ws://localhost:8080/ws?token=YOUR_JWT_TOKEN');

ws.onopen = () => {
  console.log('Connected');
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  console.log('Received:', message);
};
```

### Sending Messages

All messages follow a standard format:

```javascript
{
  "type": "MESSAGE_TYPE",
  "payload": {
    // Message-specific data
  },
  "requestId": "optional-request-id"
}
```

### Example: Ping

```javascript
ws.send(JSON.stringify({
  type: 'PING'
}));
```

### Example: Broadcast

```javascript
ws.send(JSON.stringify({
  type: 'BROADCAST',
  payload: {
    message: 'Hello, everyone!'
  }
}));
```

### Example: Inference Request

```javascript
ws.send(JSON.stringify({
  type: 'INFERENCE_REQUEST',
  payload: {
    input: 'What is the capital of France?',
    model: 'default'
  },
  requestId: 'req_12345'
}));
```

For complete API documentation, see [API-REFERENCE.md](./API-REFERENCE.md).

---

## 🏗️ Architecture

The server is built with a modular architecture:

- **server.js**: Main entry point and WebSocket server
- **router.js**: Message routing and handlers
- **broker.js**: Pub/sub integration (Redis/NATS)
- **inference-bridge.js**: Inference VM connector
- **config.js**: Configuration management
- **utils.js**: Utilities (logging, auth, helpers)

For detailed architecture information, see [ARCHITECTURE.md](./ARCHITECTURE.md).

---

## 🚢 Deployment

### Manual Deployment

```bash
# On your VM, clone the repository
git clone <repository-url>
cd websocket-api-server

# Run setup script
chmod +x scripts/setup.sh
./scripts/setup.sh

# Run deployment script
chmod +x scripts/deploy.sh
./scripts/deploy.sh
```

### PM2 Deployment

```bash
# Install PM2 globally
npm install -g pm2

# Start with PM2
pm2 start src/server.js --name websocket-api

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
```

### Docker Deployment

```bash
# Build image
docker build -t websocket-api-server .

# Run container
docker run -d \
  -p 8080:8080 \
  --env-file .env \
  --name websocket-api \
  websocket-api-server
```

### Systemd Service

```bash
# Copy service file
sudo cp scripts/websocket-api.service /etc/systemd/system/

# Edit service file with correct paths
sudo nano /etc/systemd/system/websocket-api.service

# Enable and start service
sudo systemctl enable websocket-api
sudo systemctl start websocket-api

# Check status
sudo systemctl status websocket-api
```

---

## 📊 Monitoring

### Health Check

```bash
curl http://localhost:8080/health
```

### Stats Endpoint

```bash
curl http://localhost:8080/api/stats
```

### Logs

```bash
# View logs (if logging to file)
tail -f logs/combined.log
tail -f logs/error.log

# PM2 logs
pm2 logs websocket-api

# Systemd logs
sudo journalctl -u websocket-api -f
```

---

## 🔐 Security

### Authentication

The server supports JWT-based authentication:

1. Generate a token using the `/api/auth/token` endpoint
2. Include the token in WebSocket connection: `ws://server/ws?token=YOUR_TOKEN`
3. Or pass via Authorization header: `Authorization: Bearer YOUR_TOKEN`

### Production Security Checklist

- [ ] Change `JWT_SECRET` to a strong random value
- [ ] Change `API_KEY` to a secure value
- [ ] Enable authentication (`NODE_ENV=production`)
- [ ] Configure rate limiting
- [ ] Set up firewall rules
- [ ] Use TLS/SSL for WebSocket connections
- [ ] Restrict CORS origins
- [ ] Regular security updates

---

## 🧪 Testing

### Using the Demo Interface

1. Open `http://localhost:8080/demo/demo.html`
2. Click "Connect"
3. Use quick actions or send custom messages
4. Monitor the message log

### Using curl (HTTP endpoints)

```bash
# Health check
curl http://localhost:8080/health

# Get stats
curl http://localhost:8080/api/stats

# Generate token
curl -X POST http://localhost:8080/api/auth/token \
  -H "Content-Type: application/json" \
  -d '{"userId": "test-user", "apiKey": "your-api-key"}'
```

### Using wscat (WebSocket testing)

```bash
# Install wscat
npm install -g wscat

# Connect to server
wscat -c ws://localhost:8080/ws

# Send messages
> {"type": "PING"}
> {"type": "GET_STATS"}
```

---

## 🔌 Integrating with Inference VMs

The server includes an inference bridge for connecting to external inference VMs.

### Configure Inference Endpoint

```bash
# In .env
INFERENCE_ENABLED=true
INFERENCE_ENDPOINT=http://your-inference-vm:5000/inference
INFERENCE_TIMEOUT=30000
```

### Add Multiple Endpoints

```javascript
import inferenceBridge from './src/inference-bridge.js';

// Add custom endpoint
inferenceBridge.addEndpoint('gpt-4', 'http://gpt4-vm:5000/inference');
inferenceBridge.addEndpoint('llama', 'http://llama-vm:5000/inference');
```

### Use in Messages

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

## 🛠️ Extending the Server

### Adding Custom Message Handlers

```javascript
// In src/router.js
router.register('CUSTOM_TYPE', async (clientId, payload, ws, requestId) => {
  // Your custom logic here
  router.sendResponse(ws, 'CUSTOM_RESPONSE', { result: 'success' }, requestId);
});
```

### Adding Custom Middleware

```javascript
// In src/server.js
this.app.use((req, res, next) => {
  // Your middleware logic
  next();
});
```

---

## 📚 Additional Resources

- [Architecture Documentation](./ARCHITECTURE.md)
- [API Reference](./API-REFERENCE.md)
- [Deployment Scripts](../scripts/)

---

## 🐛 Troubleshooting

### Server won't start

- Check if port 8080 is already in use: `lsof -i :8080`
- Verify Node.js version: `node --version` (should be ≥18)
- Check environment variables in `.env`

### WebSocket connection fails

- Verify server is running: `curl http://localhost:8080/health`
- Check authentication token (if in production mode)
- Verify firewall rules allow WebSocket connections
- Check browser console for errors

### Redis connection fails

- Ensure Redis is running: `redis-cli ping`
- Verify Redis host and port in `.env`
- Check Redis authentication settings

### High memory usage

- Check number of active connections
- Review log file sizes
- Consider enabling clustering
- Monitor for memory leaks

---

## 📝 License

MIT License - see LICENSE file for details

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

---

## 📞 Support

For issues and questions:
- Open an issue on GitHub
- Check existing documentation
- Review logs for error messages

---

**Built with ❤️ for real-time communication**
