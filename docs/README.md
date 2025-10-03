# WebSocket API Server

A production-ready, feature-rich **standalone Node.js WebSocket API server** for real-time messaging, streaming, and inference orchestration. Designed to run on its own dedicated VM and allow any external platform to connect for real-time communication.

---

## 🚀 Features

### Core Capabilities
- **WebSocket Server** - Full-featured WebSocket server with JSON message protocol
- **Authentication** - JWT and API key authentication support
- **Message Routing** - Flexible message routing with extensible handlers
- **Pub/Sub Integration** - Redis and NATS support for distributed messaging
- **Inference Bridge** - REST, gRPC, and WebSocket inference worker integration
- **Broadcasting** - Channel-based broadcasting with subscription management
- **Direct Messaging** - Peer-to-peer messaging between clients
- **Rate Limiting** - Built-in rate limiting to prevent abuse
- **Heartbeat System** - Automatic client health monitoring
- **Clustering** - Multi-process support for scalability

### Production Features
- Comprehensive error handling and logging
- Automatic reconnection with exponential backoff
- Graceful shutdown handling
- Health check and metrics endpoints
- PM2 and systemd support
- Environment-based configuration

---

## 📋 Prerequisites

- **Node.js** 18.0.0 or higher
- **Redis** (optional, for pub/sub and clustering)
- **NATS** (optional, alternative to Redis)

---

## 🛠️ Installation

### 1. Clone or Download Repository

```bash
cd /path/to/websocket-api-server
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` to configure your server:

```env
# Server Configuration
NODE_ENV=production
PORT=8080
HOST=0.0.0.0

# Authentication
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
API_KEY=your-api-key-for-basic-auth

# Redis Configuration
REDIS_ENABLED=true
REDIS_HOST=localhost
REDIS_PORT=6379

# Inference Configuration
INFERENCE_ENABLED=true
INFERENCE_MODE=rest
INFERENCE_REST_URL=http://localhost:5000/inference
```

---

## 🚀 Running the Server

### Development Mode

```bash
npm run dev
```

### Production Mode

```bash
npm start
```

### Using PM2 (Recommended for Production)

```bash
npm run pm2:start
```

View logs:
```bash
npm run pm2:logs
```

Stop server:
```bash
npm run pm2:stop
```

---

## 🌐 Accessing the Server

### WebSocket Connection

```javascript
const ws = new WebSocket('ws://your-server:8080/ws');
```

### Demo Interface

Open in browser:
```
http://your-server:8080/demo.html
```

### Health Check

```bash
curl http://your-server:8080/health
```

### Metrics

```bash
curl http://your-server:8080/metrics
```

---

## 📡 Message Protocol

All messages are JSON format with the following structure:

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

### Server → Client

```json
{
  "type": "RESPONSE_TYPE",
  "payload": { },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Available Message Types

#### Basic Operations

**PING** - Test connection
```json
{ "type": "PING" }
```
Response: `PONG`

**GET_STATUS** - Get server status
```json
{ "type": "GET_STATUS" }
```
Response: `STATUS` with server info

**LIST_CLIENTS** - List connected clients
```json
{ "type": "LIST_CLIENTS" }
```
Response: `CLIENT_LIST` with client array

#### Broadcasting

**BROADCAST** - Broadcast message to channel
```json
{
  "type": "BROADCAST",
  "payload": {
    "channel": "default",
    "message": "Hello, world!"
  }
}
```
Response: `BROADCAST_SENT`

**SUBSCRIBE** - Subscribe to channel
```json
{
  "type": "SUBSCRIBE",
  "payload": {
    "channel": "my-channel"
  }
}
```
Response: `SUBSCRIBED`

**UNSUBSCRIBE** - Unsubscribe from channel
```json
{
  "type": "UNSUBSCRIBE",
  "payload": {
    "channel": "my-channel"
  }
}
```
Response: `UNSUBSCRIBED`

#### Direct Messaging

**DIRECT_MESSAGE** - Send message to specific client
```json
{
  "type": "DIRECT_MESSAGE",
  "payload": {
    "targetClientId": "uuid-of-target-client",
    "message": "Hello!"
  }
}
```
Response: `DIRECT_MESSAGE_SENT`

#### Inference

**INFERENCE_REQUEST** - Run inference
```json
{
  "type": "INFERENCE_REQUEST",
  "payload": {
    "input": "Your input text",
    "options": {},
    "requestId": "req_123"
  }
}
```
Response: `INFERENCE_RESPONSE` with result

---

## 🔐 Authentication

### API Key Authentication

```javascript
{
  "type": "PING",
  "auth": {
    "apiKey": "your-api-key"
  }
}
```

### JWT Token Authentication

```javascript
{
  "type": "PING",
  "auth": {
    "token": "your-jwt-token"
  }
}
```

---

## 🔧 Configuration

### Environment Variables

See `.env.example` for all available configuration options.

Key configurations:

- `PORT` - HTTP/WebSocket server port
- `REDIS_ENABLED` - Enable Redis pub/sub
- `NATS_ENABLED` - Enable NATS pub/sub
- `INFERENCE_ENABLED` - Enable inference bridge
- `INFERENCE_MODE` - Inference mode (rest, grpc, websocket)
- `RATE_LIMIT_ENABLED` - Enable rate limiting
- `CLUSTER_ENABLED` - Enable clustering

---

## 📊 Monitoring

### Health Check Endpoint

```bash
curl http://localhost:8080/health
```

Response:
```json
{
  "status": "healthy",
  "uptime": 123.45,
  "clients": 5,
  "broker": true,
  "inference": true,
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Metrics Endpoint

```bash
curl http://localhost:8080/metrics
```

Response:
```json
{
  "uptime": 123.45,
  "connectedClients": 5,
  "memory": {
    "rss": "50 MB",
    "heapTotal": "30 MB",
    "heapUsed": "20 MB"
  },
  "broker": {
    "enabled": true,
    "connected": true
  },
  "inference": {
    "enabled": true,
    "connected": true
  }
}
```

---

## 🧪 Testing

### Using the Demo Interface

1. Open `http://localhost:8080/demo.html` in your browser
2. Click "Connect"
3. Try different operations (ping, broadcast, inference, etc.)
4. View real-time logs in the activity panel

### Using WebSocket Client Libraries

**JavaScript/Node.js:**
```javascript
const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:8080/ws');

ws.on('open', () => {
  ws.send(JSON.stringify({ type: 'PING' }));
});

ws.on('message', (data) => {
  console.log('Received:', JSON.parse(data));
});
```

**Python:**
```python
import websocket
import json

ws = websocket.WebSocket()
ws.connect("ws://localhost:8080/ws")
ws.send(json.dumps({"type": "PING"}))
print(ws.recv())
```

---

## 🔄 Integration with Inference Workers

### REST Mode

Configure inference endpoint in `.env`:
```env
INFERENCE_MODE=rest
INFERENCE_REST_URL=http://your-inference-vm:5000/inference
```

Expected request format:
```json
POST /inference
{
  "input": "text to process",
  "options": {}
}
```

### WebSocket Mode

Configure inference WebSocket in `.env`:
```env
INFERENCE_MODE=websocket
INFERENCE_WS_URL=ws://your-inference-vm:5001
```

### gRPC Mode (Stub)

Configure gRPC endpoint in `.env`:
```env
INFERENCE_MODE=grpc
INFERENCE_GRPC_HOST=your-inference-vm
INFERENCE_GRPC_PORT=50051
```

Note: gRPC implementation requires proto definitions.

---

## 📦 Deployment

See [deployment scripts](../scripts/) for automated setup and deployment.

### Quick Deploy

```bash
chmod +x scripts/setup.sh scripts/deploy.sh
./scripts/setup.sh
./scripts/deploy.sh
```

---

## 🔗 Additional Documentation

- [Architecture Guide](./ARCHITECTURE.md) - System design and scaling strategies
- [API Reference](./API-REFERENCE.md) - Complete API documentation

---

## 📝 License

MIT License - See LICENSE file for details

---

## 🤝 Support

For issues, questions, or contributions, please refer to the documentation or create an issue in the repository.
