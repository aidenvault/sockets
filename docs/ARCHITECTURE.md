# Architecture Guide

This document provides an in-depth overview of the WebSocket API Server architecture, design decisions, and scaling strategies.

---

## 📐 System Architecture

### High-Level Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     External Clients                        │
│  (Web Browsers, Mobile Apps, Other VMs, Services)          │
└─────────────────────┬───────────────────────────────────────┘
                      │ WebSocket / HTTP
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                WebSocket API Server (VM)                    │
│  ┌───────────┐  ┌────────────┐  ┌──────────────────────┐  │
│  │  Express  │  │  WebSocket │  │  Message Router      │  │
│  │  Server   │  │  Server    │  │  (Handler Registry)  │  │
│  └─────┬─────┘  └──────┬─────┘  └──────────┬───────────┘  │
│        │               │                    │               │
│        │               ▼                    ▼               │
│        │      ┌─────────────────┐  ┌─────────────────┐    │
│        │      │  Auth Manager   │  │  Rate Limiter   │    │
│        │      │  (JWT/API Key)  │  │  (In-Memory)    │    │
│        │      └─────────────────┘  └─────────────────┘    │
│        │                                                    │
│        ▼                                                    │
│  ┌──────────────────────────────────────────────────────┐ │
│  │             Client Connection Manager                │ │
│  │  (Heartbeat, Subscriptions, State Management)        │ │
│  └──────────────────────────────────────────────────────┘ │
└─────────────────────┬───────────────────────────────────────┘
                      │
        ┌─────────────┴─────────────┐
        │                           │
        ▼                           ▼
┌──────────────────┐      ┌──────────────────┐
│   Broker Layer   │      │ Inference Bridge │
│  (Redis/NATS)    │      │  (REST/gRPC/WS)  │
│                  │      │                  │
│  • Pub/Sub       │      │  • Load Balance  │
│  • Clustering    │      │  • Retry Logic   │
│  • Distributed   │      │  • Failover      │
│    Messaging     │      └──────────────────┘
└──────────────────┘                │
                                    ▼
                          ┌──────────────────┐
                          │  Inference VMs   │
                          │  (AI/ML Models)  │
                          └──────────────────┘
```

---

## 🧩 Component Architecture

### 1. Server Layer (`server.js`)

**Responsibilities:**
- Initialize and orchestrate all components
- Manage WebSocket connections
- Handle graceful shutdown
- Coordinate between Express and WebSocket servers

**Key Features:**
- Express server for HTTP endpoints (health, metrics)
- WebSocket server for real-time communication
- Client connection tracking
- Event-driven architecture

**Connection Flow:**
1. Client connects via WebSocket
2. Server generates unique client ID
3. Welcome message sent with available handlers
4. Client added to connection pool
5. Heartbeat monitoring initiated

### 2. Configuration Layer (`config.js`)

**Responsibilities:**
- Load environment variables
- Validate configuration
- Provide typed configuration access
- Default value management

**Design Patterns:**
- Singleton pattern for configuration access
- Fail-fast validation for production
- Hierarchical configuration structure

### 3. Message Router (`router.js`)

**Responsibilities:**
- Route incoming messages to handlers
- Extensible handler registry
- Message validation
- Error handling and response formatting

**Handler Pattern:**
```javascript
async handler(ws, payload, clientId, clients) {
  // Process message
  // Return response
}
```

**Built-in Handlers:**
- `PING` / `PONG` - Connection testing
- `BROADCAST` - Channel-based messaging
- `DIRECT_MESSAGE` - P2P messaging
- `SUBSCRIBE` / `UNSUBSCRIBE` - Channel management
- `INFERENCE_REQUEST` - AI/ML inference
- `GET_STATUS` - Server status
- `LIST_CLIENTS` - Client enumeration

**Extensibility:**
- Register custom handlers at runtime
- Override default handlers
- Chain handlers with middleware pattern

### 4. Broker Layer (`broker.js`)

**Responsibilities:**
- Abstract pub/sub operations
- Support multiple broker implementations
- Handle broker reconnection
- Distribute messages across server instances

**Supported Brokers:**

#### Redis
- Mature, battle-tested
- Rich feature set
- Excellent performance
- Wide adoption

#### NATS
- Cloud-native messaging
- Lightweight and fast
- Built-in clustering
- Modern architecture

**Design Pattern:**
- Abstract base class `Broker`
- Concrete implementations for Redis/NATS
- Factory pattern for broker creation
- Strategy pattern for broker selection

**Message Flow:**
```
Client A → Server Instance 1 → Redis Pub/Sub → Server Instance 2 → Client B
```

### 5. Inference Bridge (`inference-bridge.js`)

**Responsibilities:**
- Connect to inference workers
- Support multiple protocols
- Implement retry logic
- Handle timeouts and failures

**Supported Modes:**

#### REST
- HTTP/HTTPS requests
- JSON payload
- Retry with exponential backoff
- Timeout handling

#### WebSocket
- Persistent connection
- Bidirectional streaming
- Auto-reconnection
- Request/response correlation

#### gRPC (Stub)
- High-performance RPC
- Protocol buffers
- Streaming support
- Type safety

**Resilience Features:**
- Automatic retry (configurable attempts)
- Exponential backoff
- Connection pooling
- Circuit breaker pattern (recommended for production)

### 6. Utilities Layer (`utils.js`)

**Responsibilities:**
- Logging (Winston)
- Authentication (JWT, API key)
- Rate limiting
- Heartbeat management
- Helper functions

**Key Components:**

#### Logger
- Structured logging with Winston
- Multiple transports (file, console)
- Log levels (error, warn, info, debug)
- Contextual logging with metadata

#### Rate Limiter
- In-memory token bucket algorithm
- Per-client rate limiting
- Configurable limits and windows
- Automatic cleanup

#### Heartbeat Manager
- Periodic ping messages
- Client timeout detection
- Automatic disconnection
- Connection health monitoring

---

## 🔄 Message Lifecycle

### 1. Connection Establishment

```
1. Client initiates WebSocket connection
2. Server accepts connection
3. Server generates unique client ID
4. Server sends CONNECTED message
5. Client authenticates (optional)
6. Server validates credentials
7. Connection ready for messaging
```

### 2. Message Processing

```
1. Client sends JSON message
2. Server parses message
3. Rate limit check
4. Authentication check
5. Route to handler
6. Handler processes message
7. Handler returns response
8. Server sends response to client
9. Log transaction
```

### 3. Broadcasting

```
1. Client sends BROADCAST message
2. Server validates payload
3. If broker enabled:
   - Publish to broker channel
   - Broker distributes to all server instances
   - Each instance sends to subscribed clients
4. If no broker:
   - Server sends to local subscribed clients
5. Confirm broadcast to sender
```

### 4. Inference Request

```
1. Client sends INFERENCE_REQUEST
2. Server validates inference bridge
3. Forward to inference bridge
4. Bridge attempts inference with retries
5. Receive inference result
6. Send INFERENCE_RESPONSE to client
7. Log inference metrics
```

---

## 📈 Scaling Strategies

### Vertical Scaling

**Single Server Instance:**
- Increase CPU cores
- Add more RAM
- Upgrade network bandwidth
- Optimize Node.js heap size

**Recommended for:**
- < 10,000 concurrent connections
- Single region deployment
- Development/staging environments

### Horizontal Scaling

**Multiple Server Instances:**

#### With Load Balancer

```
┌──────────────┐
│ Load Balancer│ (HAProxy, NGINX, AWS ALB)
└───────┬──────┘
        │
    ┌───┴───┬───────┬───────┐
    ▼       ▼       ▼       ▼
┌────────┐┌────────┐┌────────┐┌────────┐
│Server 1││Server 2││Server 3││Server 4│
└────┬───┘└────┬───┘└────┬───┘└────┬───┘
     │         │         │         │
     └─────────┴────┬────┴─────────┘
                    ▼
              ┌──────────┐
              │  Redis   │ (Shared State)
              └──────────┘
```

**Configuration:**
- Enable Redis/NATS broker
- Sticky sessions on load balancer
- Shared Redis for pub/sub
- Health check endpoints

**Benefits:**
- Handle millions of connections
- Geographic distribution
- High availability
- Rolling deployments

#### With Clustering (Node.js)

```env
CLUSTER_ENABLED=true
CLUSTER_WORKERS=4
```

**Benefits:**
- Utilize all CPU cores
- Automatic worker restart on failure
- Built-in load balancing
- Process isolation

**Considerations:**
- Workers don't share memory
- Requires Redis/NATS for inter-process communication
- PM2 provides better clustering features

### Database Scaling

**For persistent data (if added):**
- Read replicas
- Sharding by client ID
- Caching layer (Redis)
- Time-series database for metrics

---

## 🛡️ Security Architecture

### Authentication Layers

1. **API Key Authentication**
   - Simple key-based auth
   - Suitable for server-to-server
   - No expiration by default

2. **JWT Authentication**
   - Token-based with expiration
   - Stateless validation
   - Suitable for user sessions
   - Can embed user claims

### Network Security

**Recommendations:**
- Use WSS (WebSocket Secure) in production
- TLS 1.2+ for encryption
- Certificate pinning for mobile apps
- Firewall rules (allow only necessary ports)

### Rate Limiting

**Default Configuration:**
- 100 requests per minute per client
- Configurable limits
- In-memory tracking
- Automatic cleanup

**Production Recommendations:**
- Redis-based rate limiting for distributed systems
- Different limits for authenticated vs. anonymous
- Gradual backoff for repeated violations

### Input Validation

**Current Implementation:**
- JSON schema validation
- Message type validation
- Payload sanitization
- Error handling

**Recommended Additions:**
- JSON schema validation library (Joi, Yup)
- Content length limits
- Regex-based input validation
- XSS prevention

---

## 🔍 Monitoring & Observability

### Logging Strategy

**Log Levels:**
- `error` - Critical errors requiring attention
- `warn` - Warning conditions
- `info` - Informational messages (default)
- `debug` - Detailed debugging information

**Log Aggregation:**
- Winston transports (file, console)
- Recommended: ELK Stack, Datadog, CloudWatch
- Structured JSON logging
- Correlation IDs for request tracing

### Metrics Collection

**Key Metrics:**
- Connected clients count
- Messages per second
- Inference latency
- Error rate
- Memory usage
- CPU utilization

**Recommended Tools:**
- Prometheus + Grafana
- StatsD + Graphite
- Custom metrics endpoint (`/metrics`)

### Health Checks

**Endpoints:**
- `/health` - Simple health check
- `/metrics` - Detailed metrics

**Load Balancer Integration:**
- Configure health check interval
- Set unhealthy threshold
- Automatic traffic routing

---

## 🚀 Performance Optimization

### Connection Management

**Best Practices:**
- Limit max connections per server
- Implement connection pooling
- Use sticky sessions
- Graceful degradation under load

### Message Processing

**Optimizations:**
- Async/await for I/O operations
- Message batching
- Compression (ws compression)
- Binary protocols for large payloads

### Memory Management

**Strategies:**
- Monitor heap usage
- Implement max clients limit
- Clean up disconnected clients
- Regular garbage collection

### Network Optimization

**Techniques:**
- Enable compression
- Minimize message size
- Batch updates
- CDN for static assets

---

## 🔧 Deployment Patterns

### Container Deployment (Docker)

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
EXPOSE 8080
CMD ["node", "src/server.js"]
```

### Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: websocket-server
spec:
  replicas: 3
  selector:
    matchLabels:
      app: websocket-server
  template:
    spec:
      containers:
      - name: websocket-server
        image: websocket-server:latest
        ports:
        - containerPort: 8080
```

### PM2 Deployment

```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'websocket-api-server',
    script: './src/server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production'
    }
  }]
};
```

---

## 🔄 Disaster Recovery

### Backup Strategy

**State Management:**
- Stateless server design (preferred)
- Redis persistence for critical data
- Regular Redis snapshots
- Configuration backups

### Failover

**Automatic Failover:**
- Multi-region deployment
- Health check monitoring
- Automatic traffic routing
- DNS failover

**Manual Failover:**
- Documented procedures
- Tested regularly
- Clear communication plan

---

## 📚 Future Enhancements

### Planned Features

1. **Message Persistence**
   - Store messages in database
   - Replay missed messages
   - Message history API

2. **Advanced Authentication**
   - OAuth 2.0 support
   - Multi-factor authentication
   - Role-based access control

3. **Enhanced Monitoring**
   - Real-time dashboards
   - Alerting system
   - Performance profiling

4. **Protocol Extensions**
   - Protocol buffers support
   - Binary message support
   - Custom protocol adapters

5. **AI/ML Integration**
   - Model registry
   - A/B testing support
   - Model versioning
   - Inference caching

---

## 🤝 Contributing

For architectural changes or major features:
1. Discuss in architecture review
2. Document design decisions
3. Update this document
4. Include tests and benchmarks

---

## 📞 Contact

For architecture questions or design discussions, please refer to the main repository documentation.
