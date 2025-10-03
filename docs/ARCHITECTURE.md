# Architecture Documentation

## Overview

The WebSocket API Server is designed as a **production-ready, horizontally scalable real-time communication hub** that can orchestrate messaging, streaming, and inference across multiple VMs and platforms.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client Layer                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │ Browser  │  │  Mobile  │  │  Desktop │  │   IoT    │       │
│  │   App    │  │   App    │  │   App    │  │  Device  │       │
│  └─────┬────┘  └─────┬────┘  └─────┬────┘  └─────┬────┘       │
│        │             │             │             │              │
│        └─────────────┴─────────────┴─────────────┘              │
│                          │                                       │
│                     WebSocket                                    │
│                          │                                       │
└──────────────────────────┼───────────────────────────────────────┘
                           │
┌──────────────────────────┼───────────────────────────────────────┐
│                  WebSocket API Server (VM)                       │
│  ┌────────────────────────┴────────────────────────┐            │
│  │                                                  │            │
│  │  ┌──────────┐      ┌──────────┐     ┌────────┐ │            │
│  │  │  server  │──────│  router  │─────│  auth  │ │            │
│  │  └──────────┘      └──────────┘     └────────┘ │            │
│  │                                                  │            │
│  │  ┌──────────┐      ┌──────────┐     ┌────────┐ │            │
│  │  │  broker  │──────│inference │─────│ utils  │ │            │
│  │  └──────────┘      │  bridge  │     └────────┘ │            │
│  │                    └──────────┘                 │            │
│  └──────────────────────┬────────────────────────┬─┘            │
│                         │                        │              │
└─────────────────────────┼────────────────────────┼──────────────┘
                          │                        │
              ┌───────────┴──────────┐   ┌─────────┴─────────┐
              │                      │   │                   │
┌─────────────┴──────────┐ ┌─────────┴───┴────┐ ┌───────────┴─────┐
│    Message Broker       │ │  Inference VMs   │ │  Other Services │
│  ┌────────┐ ┌────────┐ │ │  ┌────┐  ┌────┐ │ │  ┌────────────┐ │
│  │ Redis  │ │  NATS  │ │ │  │GPT │  │Llama│ │ │  │  Storage   │ │
│  └────────┘ └────────┘ │ │  └────┘  └────┘ │ │  │  Analytics │ │
└────────────────────────┘ └──────────────────┘ └────────────────┘
```

---

## Component Architecture

### 1. Server Layer (`server.js`)

**Responsibilities:**
- WebSocket server initialization and management
- HTTP server for health checks and APIs
- Connection lifecycle management
- Authentication and authorization
- Graceful shutdown handling

**Key Features:**
- Built on `ws` library for performance
- Express.js for HTTP endpoints
- Connection tracking and limits
- Rate limiting per IP
- CORS configuration

**Flow:**
```
Client Connection → Authentication → Rate Limit Check → 
Connection Added → Message Handler Setup → Ready
```

### 2. Router Layer (`router.js`)

**Responsibilities:**
- Route incoming messages to appropriate handlers
- Message type validation
- Request/response management
- Error handling

**Message Flow:**
```
Incoming Message → Parse JSON → Validate Type → 
Find Handler → Execute Handler → Send Response
```

**Built-in Handlers:**
- `PING/PONG`: Connection health checks
- `BROADCAST`: Send to all clients
- `DIRECT_MESSAGE`: Send to specific client
- `ROOM_MESSAGE`: Send to channel members
- `SUBSCRIBE/UNSUBSCRIBE`: Room management
- `INFERENCE_REQUEST`: Process inference
- `GET_STATS`: Server statistics
- `GET_CONNECTIONS`: Active connections

**Extensibility:**
```javascript
router.register('CUSTOM_TYPE', async (clientId, payload, ws, requestId) => {
  // Custom handler logic
});
```

### 3. Broker Layer (`broker.js`)

**Responsibilities:**
- Pub/sub message distribution
- Multi-instance coordination
- Horizontal scaling support
- Message persistence (optional)

**Supported Brokers:**
- **Redis**: High-performance, widely adopted
- **NATS**: Lightweight, cloud-native
- **Memory**: In-memory mode for single instance

**Architecture:**
```
Instance A → Publish → Redis/NATS → Subscribe → Instance B
                                  → Subscribe → Instance C
```

**Use Cases:**
- Broadcasting across multiple server instances
- Distributing inference requests
- Synchronizing state changes
- Cross-instance notifications

### 4. Inference Bridge (`inference-bridge.js`)

**Responsibilities:**
- Connect to external inference VMs
- Request/response lifecycle management
- Retry logic and error handling
- Streaming support for long-running tasks

**Communication Patterns:**

**Request/Response:**
```
Client → WebSocket → Server → HTTP/REST → Inference VM
Client ← WebSocket ← Server ← HTTP/REST ← Inference VM
```

**Streaming:**
```
Client → WebSocket → Server → HTTP Stream → Inference VM
Client ← WebSocket ← Server ← Chunk 1 ← Inference VM
Client ← WebSocket ← Server ← Chunk 2 ← Inference VM
Client ← WebSocket ← Server ← End ← Inference VM
```

**Distributed via Broker:**
```
Client → WS → Server A → Broker → Worker B → Inference VM
Client ← WS ← Server A ← Broker ← Worker B ← Inference VM
```

**Features:**
- Multiple endpoint support
- Timeout management
- Automatic retries
- Request cancellation
- Load balancing (via broker)

### 5. Utilities Layer (`utils.js`)

**Components:**

**Logger (Winston):**
- Structured logging
- Multiple transports (console, file)
- Log levels (debug, info, warn, error)
- Timestamp and metadata

**Authentication:**
- JWT token generation/verification
- API key validation
- Token extraction from requests
- Configurable expiry

**Rate Limiter:**
- Time-window based limiting
- Per-IP tracking
- Automatic cleanup
- Configurable limits

**Connection Manager:**
- Track active connections
- Per-IP connection limits
- Metadata storage
- Broadcasting utilities

### 6. Configuration Layer (`config.js`)

**Responsibilities:**
- Environment variable management
- Default values
- Type validation
- Centralized configuration

**Categories:**
- Server settings
- Authentication
- Redis/NATS
- Inference bridge
- Logging
- Security
- Clustering

---

## Scaling Strategies

### Vertical Scaling

**Single Instance Optimization:**
- Use clustering mode (Node.js cluster module)
- Increase worker processes
- Optimize memory usage
- Enable compression

**Configuration:**
```bash
CLUSTER_ENABLED=true
CLUSTER_WORKERS=4  # CPU cores
```

### Horizontal Scaling

**Multiple Server Instances:**

```
Load Balancer (nginx/HAProxy)
    │
    ├── Instance 1 ─┐
    ├── Instance 2 ─┼─ Redis/NATS Broker
    └── Instance 3 ─┘
```

**Requirements:**
1. Enable Redis or NATS
2. Configure pub/sub channels
3. Setup load balancer with sticky sessions
4. Coordinate inference requests

**Load Balancer Configuration (nginx):**
```nginx
upstream websocket_backend {
    ip_hash;  # Sticky sessions
    server instance1:8080;
    server instance2:8080;
    server instance3:8080;
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

### Geographic Distribution

**Multi-Region Setup:**
```
Region A                Region B
  ├── Instance 1          ├── Instance 4
  ├── Instance 2          ├── Instance 5
  └── Instance 3          └── Instance 6
      │                       │
      └───── Global NATS ─────┘
```

**Benefits:**
- Lower latency for regional users
- Fault tolerance
- Disaster recovery

---

## Message Flow Diagrams

### Connection Establishment

```
Client                 Server              Auth System
  │                      │                      │
  ├─ WebSocket Connect ─→│                      │
  │                      ├── Extract Token ────→│
  │                      │                      │
  │                      │←── Verify Token ─────┤
  │                      │                      │
  │                      ├── Rate Limit Check   │
  │                      ├── Connection Limit   │
  │                      │    Check             │
  │                      │                      │
  │←── CONNECTED ────────┤                      │
  │  (with clientId)     │                      │
```

### Broadcast Message

```
Client A           Server A         Broker        Server B         Client B
  │                   │               │               │               │
  ├── BROADCAST ─────→│               │               │               │
  │                   ├── Validate    │               │               │
  │                   ├── Local Send ─┼──────────────→│               │
  │                   │               │               │               │
  │                   ├── Publish ───→│               │               │
  │                   │               ├── Deliver ───→│               │
  │                   │               │               ├── Send ──────→│
  │                   │               │               │               │
  │←── ACK ───────────┤               │               │               │
```

### Inference Request

```
Client          Server          Inference VM
  │               │                   │
  ├─ INFERENCE ──→│                   │
  │   REQUEST     │                   │
  │               ├── Validate        │
  │               ├── Generate ID     │
  │               ├── Store Promise   │
  │               │                   │
  │               ├── HTTP POST ─────→│
  │               │                   ├── Process
  │               │                   │
  │               │←── Response ──────┤
  │               │                   │
  │               ├── Resolve Promise │
  │←── INFERENCE ─┤                   │
  │    RESPONSE   │                   │
```

---

## Security Architecture

### Defense Layers

1. **Network Layer**
   - Firewall rules
   - DDoS protection
   - TLS/SSL termination

2. **Application Layer**
   - Rate limiting
   - Connection limits
   - Authentication
   - Input validation

3. **Transport Layer**
   - WSS (WebSocket Secure)
   - TLS 1.3
   - Certificate pinning

### Authentication Flow

```
Client                           Server
  │                                │
  ├── Request Token ──────────────→│
  │   (with API key)               ├── Verify API Key
  │                                ├── Generate JWT
  │←── JWT Token ──────────────────┤
  │                                │
  ├── WebSocket Connect ───────────→│
  │   (with JWT)                   ├── Verify JWT
  │                                ├── Extract Claims
  │                                ├── Add Connection
  │←── CONNECTED ──────────────────┤
```

### Rate Limiting

**Algorithm: Sliding Window**
```
Window: 60 seconds
Max Requests: 100

Requests: [t1, t2, t3, ..., t100]
Filter: requests where (now - timestamp) < window
Allow: if filtered.length < max
```

---

## Monitoring & Observability

### Metrics to Track

**Connection Metrics:**
- Active connections
- Connections per second
- Connection duration
- Connections per IP

**Message Metrics:**
- Messages per second
- Message types distribution
- Message latency
- Error rate

**Inference Metrics:**
- Pending requests
- Request duration
- Success/failure rate
- Endpoint availability

**System Metrics:**
- CPU usage
- Memory usage
- Network I/O
- Event loop lag

### Health Check Endpoint

```json
GET /health

{
  "status": "healthy",
  "timestamp": 1234567890,
  "uptime": 3600,
  "connections": 42,
  "broker": {
    "connected": true,
    "type": "redis"
  }
}
```

### Stats Endpoint

```json
GET /api/stats

{
  "connections": 42,
  "inference": {
    "pendingRequests": 5,
    "endpoints": ["default", "gpt-4"],
    "enabled": true
  },
  "broker": {
    "connected": true,
    "type": "redis"
  },
  "uptime": 3600,
  "memory": {
    "rss": 123456789,
    "heapTotal": 98765432,
    "heapUsed": 87654321
  }
}
```

---

## Performance Considerations

### WebSocket Optimization

1. **Message Compression**: Enable per-message deflate
2. **Binary Frames**: Use binary for large payloads
3. **Batching**: Batch small messages
4. **Heartbeat**: Regular ping/pong for connection health

### Memory Management

1. **Connection Limits**: Prevent memory exhaustion
2. **Message Buffer**: Limit pending message size
3. **Log Rotation**: Prevent log file growth
4. **Rate Limiting**: Prevent memory spikes

### Network Optimization

1. **Keep-Alive**: Reuse HTTP connections for inference
2. **Connection Pooling**: Pool Redis/NATS connections
3. **DNS Caching**: Cache DNS lookups
4. **Load Balancing**: Distribute connections evenly

---

## Fault Tolerance

### Graceful Degradation

1. **Broker Failure**: Fall back to in-memory mode
2. **Inference Failure**: Return error, don't crash
3. **Authentication Failure**: Reject connection gracefully
4. **Rate Limit**: Reject with proper error code

### Recovery Mechanisms

1. **Automatic Reconnection**: Client-side retry logic
2. **Circuit Breaker**: Stop calling failed services
3. **Health Checks**: Monitor component health
4. **Graceful Shutdown**: Clean connection closure

---

## Future Enhancements

### Potential Features

1. **WebRTC Support**: Peer-to-peer connections
2. **GraphQL Subscriptions**: GraphQL over WebSocket
3. **Message Persistence**: Store and replay messages
4. **Advanced Analytics**: Real-time dashboards
5. **Multi-Tenancy**: Isolated namespaces
6. **Plugin System**: Extensible architecture
7. **Service Mesh**: Integration with Istio/Linkerd
8. **Kubernetes**: Native k8s support

---

## Conclusion

This architecture provides a solid foundation for building scalable, production-ready real-time applications. The modular design allows for easy extension and adaptation to specific use cases while maintaining performance and reliability.
