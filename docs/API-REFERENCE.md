# API Reference

Complete API documentation for the WebSocket API Server.

---

## Table of Contents

1. [Connection](#connection)
2. [Authentication](#authentication)
3. [Message Format](#message-format)
4. [Message Types](#message-types)
5. [Error Handling](#error-handling)
6. [HTTP Endpoints](#http-endpoints)
7. [Code Examples](#code-examples)

---

## Connection

### WebSocket Endpoint

```
ws://host:port/ws
wss://host:port/ws  (production with TLS)
```

### Connection Flow

1. **Establish Connection**
   ```javascript
   const ws = new WebSocket('ws://localhost:8080/ws');
   ```

2. **Receive Welcome Message**
   ```json
   {
     "type": "CONNECTED",
     "payload": {
       "clientId": "uuid-v4-client-id",
       "message": "Welcome to WebSocket API Server",
       "handlers": ["PING", "BROADCAST", "INFERENCE_REQUEST", ...]
     },
     "timestamp": "2024-01-01T00:00:00.000Z"
   }
   ```

3. **Authenticate** (if required)
   ```json
   {
     "type": "PING",
     "auth": {
       "apiKey": "your-api-key"
     }
   }
   ```

4. **Start Messaging**

---

## Authentication

### API Key Authentication

**Format:**
```json
{
  "type": "MESSAGE_TYPE",
  "payload": {},
  "auth": {
    "apiKey": "your-api-key"
  }
}
```

**Configuration:**
Set `API_KEY` in `.env` file.

**Validation:**
Server validates API key on every message requiring authentication.

### JWT Token Authentication

**Format:**
```json
{
  "type": "MESSAGE_TYPE",
  "payload": {},
  "auth": {
    "token": "your-jwt-token"
  }
}
```

**Token Generation:**
Use a separate authentication service to generate JWT tokens:

```javascript
const jwt = require('jsonwebtoken');
const token = jwt.sign(
  { userId: 'user123', role: 'admin' },
  process.env.JWT_SECRET,
  { expiresIn: '24h' }
);
```

**Token Structure:**
- **Header:** Algorithm and token type
- **Payload:** User claims (userId, role, etc.)
- **Signature:** Verification signature

**Validation:**
Server validates JWT signature and expiration on every message.

### No Authentication Mode

For testing or internal networks:

```json
{
  "type": "PING"
}
```

**Note:** PING messages don't require authentication by default.

---

## Message Format

### Client → Server

```typescript
{
  "type": string,        // Required: Message type
  "payload"?: object,    // Optional: Message payload
  "auth"?: {            // Optional: Authentication
    "apiKey"?: string,
    "token"?: string
  }
}
```

### Server → Client

```typescript
{
  "type": string,              // Response type
  "payload"?: object,          // Response payload
  "timestamp": string,         // ISO 8601 timestamp
  "error"?: {                 // Present only for errors
    "code": string,
    "message": string,
    "originalType": string
  }
}
```

---

## Message Types

### 1. PING

**Description:** Test connection and update heartbeat.

**Request:**
```json
{
  "type": "PING"
}
```

**Response:**
```json
{
  "type": "PONG",
  "payload": {
    "timestamp": "2024-01-01T00:00:00.000Z",
    "clientId": "uuid-v4-client-id"
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

**Use Cases:**
- Connection health check
- Keep connection alive
- Measure latency

---

### 2. ECHO

**Description:** Echo back the received payload.

**Request:**
```json
{
  "type": "ECHO",
  "payload": {
    "message": "test"
  }
}
```

**Response:**
```json
{
  "type": "ECHO_RESPONSE",
  "payload": {
    "echo": {
      "message": "test"
    },
    "clientId": "uuid-v4-client-id"
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

---

### 3. BROADCAST

**Description:** Broadcast a message to all clients subscribed to a channel.

**Request:**
```json
{
  "type": "BROADCAST",
  "payload": {
    "channel": "default",
    "message": "Hello, everyone!"
  }
}
```

**Response (to sender):**
```json
{
  "type": "BROADCAST_SENT",
  "payload": {
    "channel": "default",
    "message": "Hello, everyone!"
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

**Broadcast Message (to all subscribed clients):**
```json
{
  "type": "BROADCAST_MESSAGE",
  "payload": {
    "message": "Hello, everyone!",
    "channel": "default",
    "from": "sender-client-id",
    "timestamp": "2024-01-01T00:00:00.000Z"
  }
}
```

**Fields:**
- `channel` (string, optional): Channel name, defaults to "default"
- `message` (string, required): Message to broadcast

---

### 4. SUBSCRIBE

**Description:** Subscribe to a channel to receive broadcast messages.

**Request:**
```json
{
  "type": "SUBSCRIBE",
  "payload": {
    "channel": "my-channel"
  }
}
```

**Response:**
```json
{
  "type": "SUBSCRIBED",
  "payload": {
    "channel": "my-channel"
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

**Notes:**
- Clients are automatically subscribed to "default" channel on connection
- Multiple channel subscriptions are supported

---

### 5. UNSUBSCRIBE

**Description:** Unsubscribe from a channel.

**Request:**
```json
{
  "type": "UNSUBSCRIBE",
  "payload": {
    "channel": "my-channel"
  }
}
```

**Response:**
```json
{
  "type": "UNSUBSCRIBED",
  "payload": {
    "channel": "my-channel"
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

---

### 6. DIRECT_MESSAGE

**Description:** Send a message directly to a specific client.

**Request:**
```json
{
  "type": "DIRECT_MESSAGE",
  "payload": {
    "targetClientId": "uuid-of-target-client",
    "message": "Hello, client!"
  }
}
```

**Response (to sender):**
```json
{
  "type": "DIRECT_MESSAGE_SENT",
  "payload": {
    "targetClientId": "uuid-of-target-client"
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

**Message (to recipient):**
```json
{
  "type": "DIRECT_MESSAGE_RECEIVED",
  "payload": {
    "from": "sender-client-id",
    "message": "Hello, client!",
    "timestamp": "2024-01-01T00:00:00.000Z"
  }
}
```

**Errors:**
- Target client ID required
- Target client not found
- Target client not connected

---

### 7. INFERENCE_REQUEST

**Description:** Request inference from connected inference workers.

**Request:**
```json
{
  "type": "INFERENCE_REQUEST",
  "payload": {
    "input": "What is the capital of France?",
    "options": {
      "temperature": 0.7,
      "maxTokens": 100
    },
    "requestId": "req_12345"
  }
}
```

**Response:**
```json
{
  "type": "INFERENCE_RESPONSE",
  "payload": {
    "result": {
      "output": "The capital of France is Paris.",
      "metadata": {}
    },
    "requestId": "req_12345"
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

**Fields:**
- `input` (string, required): Input for inference
- `options` (object, optional): Inference options
- `requestId` (string, optional): Request correlation ID

**Configuration:**
Requires `INFERENCE_ENABLED=true` in `.env`.

**Errors:**
- Inference service not available
- Inference timeout
- Inference error

---

### 8. GET_STATUS

**Description:** Get server status and statistics.

**Request:**
```json
{
  "type": "GET_STATUS"
}
```

**Response:**
```json
{
  "type": "STATUS",
  "payload": {
    "clientId": "your-client-id",
    "connectedClients": 42,
    "brokerConnected": true,
    "inferenceConnected": true,
    "uptime": 12345.67,
    "memory": {
      "rss": 52428800,
      "heapTotal": 20971520,
      "heapUsed": 15728640,
      "external": 1048576,
      "arrayBuffers": 524288
    }
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

---

### 9. LIST_CLIENTS

**Description:** List all connected clients (requires authentication).

**Request:**
```json
{
  "type": "LIST_CLIENTS"
}
```

**Response:**
```json
{
  "type": "CLIENT_LIST",
  "payload": {
    "clients": [
      {
        "clientId": "uuid-1",
        "authenticated": true,
        "connectedAt": "2024-01-01T00:00:00.000Z",
        "subscriptions": ["default", "channel-1"]
      },
      {
        "clientId": "uuid-2",
        "authenticated": false,
        "connectedAt": "2024-01-01T00:01:00.000Z",
        "subscriptions": ["default"]
      }
    ]
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

---

## Error Handling

### Error Response Format

```json
{
  "type": "ERROR",
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "originalType": "ORIGINAL_MESSAGE_TYPE"
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Error Codes

| Code | Description |
|------|-------------|
| `PARSE_ERROR` | Invalid JSON format |
| `AUTH_REQUIRED` | Authentication required |
| `RATE_LIMIT` | Rate limit exceeded |
| `HANDLER_ERROR` | Error processing message |
| `ERROR` | General error |

### Common Errors

**Invalid JSON:**
```json
{
  "type": "ERROR",
  "error": {
    "code": "PARSE_ERROR",
    "message": "Invalid JSON format"
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

**Authentication Required:**
```json
{
  "type": "ERROR",
  "error": {
    "code": "AUTH_REQUIRED",
    "message": "Authentication required",
    "originalType": "BROADCAST"
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

**Rate Limit Exceeded:**
```json
{
  "type": "ERROR",
  "error": {
    "code": "RATE_LIMIT",
    "message": "Rate limit exceeded",
    "originalType": "PING"
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

**Unknown Message Type:**
```json
{
  "type": "ERROR",
  "error": {
    "code": "HANDLER_ERROR",
    "message": "Unknown message type: INVALID_TYPE",
    "originalType": "INVALID_TYPE"
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

---

## HTTP Endpoints

### GET /health

**Description:** Health check endpoint for load balancers.

**Response:**
```json
{
  "status": "healthy",
  "uptime": 12345.67,
  "clients": 42,
  "broker": true,
  "inference": true,
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

**Status Codes:**
- `200 OK` - Server is healthy

---

### GET /metrics

**Description:** Server metrics and statistics.

**Response:**
```json
{
  "uptime": 12345.67,
  "connectedClients": 42,
  "memory": {
    "rss": "50 MB",
    "heapTotal": "20 MB",
    "heapUsed": "15 MB"
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

**Status Codes:**
- `200 OK` - Metrics retrieved successfully

---

### Static Files

**GET /** - Serves static files from `public/` directory

- `/demo.html` - Demo interface
- `/demo.css` - Demo styles
- `/demo.js` - Demo JavaScript

---

## Code Examples

### JavaScript (Browser)

```javascript
const ws = new WebSocket('ws://localhost:8080/ws');

ws.onopen = () => {
  console.log('Connected');
  
  // Authenticate
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
  
  if (message.type === 'CONNECTED') {
    console.log('Client ID:', message.payload.clientId);
  }
};

ws.onerror = (error) => {
  console.error('WebSocket error:', error);
};

ws.onclose = (event) => {
  console.log('Disconnected:', event.code, event.reason);
};

// Send broadcast
function broadcast(channel, message) {
  ws.send(JSON.stringify({
    type: 'BROADCAST',
    payload: { channel, message }
  }));
}

// Run inference
function inference(input) {
  ws.send(JSON.stringify({
    type: 'INFERENCE_REQUEST',
    payload: { input }
  }));
}
```

### JavaScript (Node.js)

```javascript
const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:8080/ws');

ws.on('open', () => {
  console.log('Connected');
  
  // Authenticate with JWT
  ws.send(JSON.stringify({
    type: 'PING',
    auth: {
      token: 'your-jwt-token'
    }
  }));
});

ws.on('message', (data) => {
  const message = JSON.parse(data);
  console.log('Received:', message);
});

ws.on('error', (error) => {
  console.error('Error:', error);
});

ws.on('close', () => {
  console.log('Disconnected');
});
```

### Python

```python
import websocket
import json

def on_message(ws, message):
    data = json.loads(message)
    print('Received:', data)
    
    if data['type'] == 'CONNECTED':
        print('Client ID:', data['payload']['clientId'])

def on_error(ws, error):
    print('Error:', error)

def on_close(ws, close_status_code, close_msg):
    print('Disconnected')

def on_open(ws):
    print('Connected')
    
    # Authenticate
    ws.send(json.dumps({
        'type': 'PING',
        'auth': {
            'apiKey': 'your-api-key'
        }
    }))

ws = websocket.WebSocketApp(
    'ws://localhost:8080/ws',
    on_open=on_open,
    on_message=on_message,
    on_error=on_error,
    on_close=on_close
)

ws.run_forever()
```

### cURL (HTTP Endpoints)

```bash
# Health check
curl http://localhost:8080/health

# Metrics
curl http://localhost:8080/metrics
```

---

## Rate Limiting

### Configuration

```env
RATE_LIMIT_ENABLED=true
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_WINDOW_MS=60000
```

### Behavior

- Limit applied per client ID
- 100 requests per 60 seconds by default
- Exceeded requests receive error response
- Counter resets after window expires

### Response

```json
{
  "type": "ERROR",
  "error": {
    "code": "RATE_LIMIT",
    "message": "Rate limit exceeded",
    "originalType": "BROADCAST"
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

---

## Best Practices

1. **Authentication:** Always authenticate in production
2. **Error Handling:** Handle all error responses gracefully
3. **Reconnection:** Implement exponential backoff for reconnections
4. **Heartbeat:** Respond to PING messages to maintain connection
5. **Message Size:** Keep messages reasonably sized (< 1 MB)
6. **Rate Limiting:** Respect rate limits, implement backoff
7. **Logging:** Log all errors and important events
8. **Validation:** Validate all incoming data on client side

---

## Support

For questions or issues with the API:
1. Check this documentation
2. Review code examples
3. Check server logs
4. Refer to architecture documentation

---

## Changelog

### Version 1.0.0
- Initial release
- Basic WebSocket operations
- Authentication support
- Broadcast and direct messaging
- Inference bridge
- HTTP endpoints
