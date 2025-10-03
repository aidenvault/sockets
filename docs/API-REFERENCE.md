# API Reference

Complete reference for the WebSocket API Server protocol, message types, and HTTP endpoints.

---

## Table of Contents

1. [WebSocket Protocol](#websocket-protocol)
2. [Message Format](#message-format)
3. [Authentication](#authentication)
4. [Message Types](#message-types)
5. [HTTP Endpoints](#http-endpoints)
6. [Error Handling](#error-handling)
7. [Examples](#examples)

---

## WebSocket Protocol

### Connection

**Endpoint:** `ws://host:port/ws` or `wss://host:port/ws` (secure)

**Connection URL Formats:**

```javascript
// Without authentication (dev mode only)
ws://localhost:8080/ws

// With JWT token (query parameter)
ws://localhost:8080/ws?token=YOUR_JWT_TOKEN

// With authorization header (in upgrade request)
Authorization: Bearer YOUR_JWT_TOKEN
```

### Connection Lifecycle

```
1. Client initiates WebSocket connection
2. Server validates authentication (if enabled)
3. Server checks rate limits and connection limits
4. Server sends CONNECTED message with clientId
5. Client can now send/receive messages
6. Either party can close connection
7. Server cleans up connection resources
```

---

## Message Format

All messages follow a standard JSON structure:

### Request Format

```json
{
  "type": "MESSAGE_TYPE",
  "payload": {
    // Message-specific data
  },
  "requestId": "optional-unique-identifier"
}
```

### Response Format

```json
{
  "type": "RESPONSE_TYPE",
  "payload": {
    // Response data
  },
  "requestId": "original-request-id",
  "timestamp": 1234567890123
}
```

### Field Descriptions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | Yes | Message type identifier (uppercase) |
| `payload` | object | No | Message-specific data |
| `requestId` | string | No | Unique identifier for request tracking |
| `timestamp` | number | No | Unix timestamp (milliseconds) - added by server |

---

## Authentication

### Obtaining a JWT Token

**HTTP Endpoint:** `POST /api/auth/token`

**Request:**
```json
{
  "userId": "user-identifier",
  "apiKey": "your-api-key"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Example:**
```bash
curl -X POST http://localhost:8080/api/auth/token \
  -H "Content-Type: application/json" \
  -d '{"userId": "user123", "apiKey": "your-api-key"}'
```

### Using the Token

**Option 1: Query Parameter**
```javascript
const ws = new WebSocket('ws://localhost:8080/ws?token=YOUR_TOKEN');
```

**Option 2: Authorization Header**
```javascript
const ws = new WebSocket('ws://localhost:8080/ws', {
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN'
  }
});
```

---

## Message Types

### Connection Messages

#### CONNECTED (Server → Client)

Sent immediately after successful connection.

**Response:**
```json
{
  "type": "CONNECTED",
  "payload": {
    "clientId": "unique-client-identifier",
    "timestamp": 1234567890123,
    "serverVersion": "1.0.0"
  }
}
```

#### PING (Client → Server)

Check connection health.

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
    "timestamp": 1234567890123
  }
}
```

#### PONG (Client → Server)

Response to server-initiated PING.

**Request:**
```json
{
  "type": "PONG"
}
```

---

### Messaging

#### BROADCAST (Client → Server)

Send message to all connected clients.

**Request:**
```json
{
  "type": "BROADCAST",
  "payload": {
    "message": "Hello, everyone!"
  },
  "requestId": "req_123"
}
```

**Response (to sender):**
```json
{
  "type": "BROADCAST_SENT",
  "payload": {
    "recipients": 42
  },
  "requestId": "req_123"
}
```

**Broadcast (to all others):**
```json
{
  "type": "BROADCAST",
  "payload": {
    "from": "sender-client-id",
    "message": "Hello, everyone!",
    "timestamp": 1234567890123
  }
}
```

#### DIRECT_MESSAGE (Client → Server)

Send message to specific client.

**Request:**
```json
{
  "type": "DIRECT_MESSAGE",
  "payload": {
    "targetClientId": "recipient-client-id",
    "message": "Hello, specific person!"
  },
  "requestId": "req_124"
}
```

**Response (to sender):**
```json
{
  "type": "DIRECT_MESSAGE_SENT",
  "payload": {
    "targetClientId": "recipient-client-id"
  },
  "requestId": "req_124"
}
```

**Message (to recipient):**
```json
{
  "type": "DIRECT_MESSAGE",
  "payload": {
    "from": "sender-client-id",
    "message": "Hello, specific person!",
    "timestamp": 1234567890123
  }
}
```

#### ROOM_MESSAGE (Client → Server)

Send message to all clients in a room/channel.

**Request:**
```json
{
  "type": "ROOM_MESSAGE",
  "payload": {
    "channel": "general",
    "message": "Hello, room!"
  },
  "requestId": "req_125"
}
```

**Response (to sender):**
```json
{
  "type": "ROOM_MESSAGE_SENT",
  "payload": {
    "channel": "general"
  },
  "requestId": "req_125"
}
```

**Message (to room members):**
```json
{
  "type": "ROOM_MESSAGE",
  "payload": {
    "from": "sender-client-id",
    "channel": "general",
    "message": "Hello, room!",
    "timestamp": 1234567890123
  }
}
```

---

### Room/Channel Management

#### SUBSCRIBE (Client → Server)

Join a room/channel.

**Request:**
```json
{
  "type": "SUBSCRIBE",
  "payload": {
    "channel": "general"
  },
  "requestId": "req_126"
}
```

**Response:**
```json
{
  "type": "SUBSCRIBED",
  "payload": {
    "channel": "general"
  },
  "requestId": "req_126"
}
```

**Broadcast (to existing members):**
```json
{
  "type": "USER_JOINED",
  "payload": {
    "clientId": "new-client-id",
    "channel": "general"
  }
}
```

#### UNSUBSCRIBE (Client → Server)

Leave a room/channel.

**Request:**
```json
{
  "type": "UNSUBSCRIBE",
  "payload": {
    "channel": "general"
  },
  "requestId": "req_127"
}
```

**Response:**
```json
{
  "type": "UNSUBSCRIBED",
  "payload": {
    "channel": "general"
  },
  "requestId": "req_127"
}
```

**Broadcast (to remaining members):**
```json
{
  "type": "USER_LEFT",
  "payload": {
    "clientId": "departing-client-id",
    "channel": "general"
  }
}
```

---

### Inference

#### INFERENCE_REQUEST (Client → Server)

Request inference from connected inference VM.

**Request:**
```json
{
  "type": "INFERENCE_REQUEST",
  "payload": {
    "input": "What is the capital of France?",
    "model": "default",
    "endpoint": "default"
  },
  "requestId": "req_128"
}
```

**Response (success):**
```json
{
  "type": "INFERENCE_RESPONSE",
  "payload": {
    "output": "The capital of France is Paris.",
    "model": "default",
    "processingTime": 1234
  },
  "requestId": "req_128"
}
```

**Response (error):**
```json
{
  "type": "ERROR",
  "payload": {
    "error": "Inference failed: timeout"
  },
  "requestId": "req_128"
}
```

#### INFERENCE_STREAM (Client → Server)

Request streaming inference (for long-running tasks).

**Request:**
```json
{
  "type": "INFERENCE_STREAM",
  "payload": {
    "input": "Generate a story...",
    "model": "gpt-4"
  },
  "requestId": "req_129"
}
```

**Response (chunks):**
```json
{
  "type": "INFERENCE_CHUNK",
  "payload": {
    "chunk": "Once upon a time...",
    "index": 0
  },
  "requestId": "req_129"
}
```

**Response (end):**
```json
{
  "type": "INFERENCE_STREAM_END",
  "payload": {},
  "requestId": "req_129"
}
```

#### INFERENCE_CANCEL (Client → Server)

Cancel a pending inference request.

**Request:**
```json
{
  "type": "INFERENCE_CANCEL",
  "payload": {
    "inferenceRequestId": "req_128"
  },
  "requestId": "req_130"
}
```

**Response:**
```json
{
  "type": "INFERENCE_CANCELLED",
  "payload": {
    "inferenceRequestId": "req_128"
  },
  "requestId": "req_130"
}
```

---

### System Messages

#### GET_STATS (Client → Server)

Get server statistics.

**Request:**
```json
{
  "type": "GET_STATS",
  "requestId": "req_131"
}
```

**Response:**
```json
{
  "type": "STATS",
  "payload": {
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
      "heapUsed": 87654321,
      "external": 1234567
    }
  },
  "requestId": "req_131"
}
```

#### GET_CONNECTIONS (Client → Server)

Get list of active connections (admin only).

**Request:**
```json
{
  "type": "GET_CONNECTIONS",
  "requestId": "req_132"
}
```

**Response:**
```json
{
  "type": "CONNECTIONS",
  "payload": {
    "connections": [
      {
        "clientId": "client-1",
        "ip": "192.168.1.100",
        "connectedAt": 1234567890123,
        "metadata": {
          "authPayload": { "userId": "user123" },
          "channels": ["general", "tech"]
        }
      }
    ]
  },
  "requestId": "req_132"
}
```

---

### Error Messages

#### ERROR (Server → Client)

Generic error response.

**Response:**
```json
{
  "type": "ERROR",
  "payload": {
    "error": "Error message description"
  },
  "requestId": "original-request-id",
  "timestamp": 1234567890123
}
```

---

## HTTP Endpoints

### Health Check

**Endpoint:** `GET /health`

**Description:** Check server health status.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": 1234567890123,
  "uptime": 3600,
  "connections": 42,
  "broker": {
    "connected": true,
    "type": "redis"
  }
}
```

**Status Codes:**
- `200 OK`: Server is healthy
- `503 Service Unavailable`: Server is unhealthy

---

### Generate Authentication Token

**Endpoint:** `POST /api/auth/token`

**Description:** Generate JWT token for WebSocket authentication.

**Request:**
```json
{
  "userId": "user-identifier",
  "apiKey": "your-api-key"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Status Codes:**
- `200 OK`: Token generated successfully
- `401 Unauthorized`: Invalid API key
- `400 Bad Request`: Missing required fields

---

### Server Statistics

**Endpoint:** `GET /api/stats`

**Description:** Get comprehensive server statistics.

**Response:**
```json
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
    "heapUsed": 87654321,
    "external": 1234567
  }
}
```

**Status Codes:**
- `200 OK`: Statistics retrieved successfully

---

### Demo Interface

**Endpoint:** `GET /demo/demo.html`

**Description:** Visual demo interface for testing WebSocket APIs.

---

## Error Handling

### Common Error Types

| Error | Description | Solution |
|-------|-------------|----------|
| `Invalid JSON` | Message is not valid JSON | Check JSON syntax |
| `Message type is required` | Missing `type` field | Add `type` field |
| `Unknown message type` | Invalid message type | Use valid message type |
| `Not connected to server` | Client not connected | Establish connection first |
| `Authentication required` | Missing or invalid token | Provide valid JWT token |
| `Rate limit exceeded` | Too many requests | Wait before retrying |
| `Max connections exceeded` | Too many connections from IP | Close unused connections |
| `Channel is required` | Missing channel parameter | Provide channel name |
| `Target client not found` | Invalid targetClientId | Use valid client ID |
| `Inference failed` | Inference request failed | Check inference VM status |

### Error Response Format

```json
{
  "type": "ERROR",
  "payload": {
    "error": "Detailed error message",
    "code": "ERROR_CODE"
  },
  "requestId": "original-request-id",
  "timestamp": 1234567890123
}
```

### WebSocket Close Codes

| Code | Reason | Description |
|------|--------|-------------|
| 1000 | Normal Closure | Connection closed normally |
| 1001 | Going Away | Server shutting down |
| 1008 | Policy Violation | Authentication failed, rate limit, etc. |
| 1011 | Internal Error | Server encountered an error |

---

## Examples

### Example 1: Complete Connection Flow

```javascript
// 1. Get authentication token
const tokenResponse = await fetch('http://localhost:8080/api/auth/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: 'user123',
    apiKey: 'your-api-key'
  })
});
const { token } = await tokenResponse.json();

// 2. Connect to WebSocket
const ws = new WebSocket(`ws://localhost:8080/ws?token=${token}`);

// 3. Handle connection
ws.onopen = () => {
  console.log('Connected');
};

// 4. Handle messages
ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  
  if (message.type === 'CONNECTED') {
    console.log('Client ID:', message.payload.clientId);
  }
};

// 5. Send messages
ws.send(JSON.stringify({
  type: 'PING'
}));
```

### Example 2: Broadcasting Messages

```javascript
// Send broadcast
ws.send(JSON.stringify({
  type: 'BROADCAST',
  payload: {
    message: 'Hello, everyone!'
  },
  requestId: 'req_001'
}));

// Handle responses
ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  
  if (message.type === 'BROADCAST_SENT') {
    console.log('Broadcast sent to', message.payload.recipients, 'clients');
  }
  
  if (message.type === 'BROADCAST' && message.payload.from !== myClientId) {
    console.log('Received broadcast:', message.payload.message);
  }
};
```

### Example 3: Room/Channel Communication

```javascript
// Join a channel
ws.send(JSON.stringify({
  type: 'SUBSCRIBE',
  payload: {
    channel: 'general'
  },
  requestId: 'req_002'
}));

// Send message to channel
ws.send(JSON.stringify({
  type: 'ROOM_MESSAGE',
  payload: {
    channel: 'general',
    message: 'Hello, general channel!'
  },
  requestId: 'req_003'
}));

// Leave channel
ws.send(JSON.stringify({
  type: 'UNSUBSCRIBE',
  payload: {
    channel: 'general'
  },
  requestId: 'req_004'
}));
```

### Example 4: Inference Request

```javascript
// Send inference request
ws.send(JSON.stringify({
  type: 'INFERENCE_REQUEST',
  payload: {
    input: 'What is machine learning?',
    model: 'gpt-4'
  },
  requestId: 'req_005'
}));

// Handle response
ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  
  if (message.type === 'INFERENCE_RESPONSE' && message.requestId === 'req_005') {
    console.log('Inference result:', message.payload.output);
  }
  
  if (message.type === 'ERROR' && message.requestId === 'req_005') {
    console.error('Inference failed:', message.payload.error);
  }
};
```

### Example 5: Streaming Inference

```javascript
// Request streaming inference
ws.send(JSON.stringify({
  type: 'INFERENCE_STREAM',
  payload: {
    input: 'Write a short story',
    model: 'gpt-4'
  },
  requestId: 'req_006'
}));

// Handle streaming chunks
let fullResponse = '';

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  
  if (message.type === 'INFERENCE_CHUNK' && message.requestId === 'req_006') {
    fullResponse += message.payload.chunk;
    console.log('Chunk received:', message.payload.chunk);
  }
  
  if (message.type === 'INFERENCE_STREAM_END' && message.requestId === 'req_006') {
    console.log('Stream complete. Full response:', fullResponse);
  }
};
```

---

## Rate Limits

Default rate limits (configurable via environment variables):

- **Connection Rate**: 10 connections per IP per minute
- **Message Rate**: 100 messages per client per minute
- **Inference Rate**: 10 inference requests per client per minute

Rate limit exceeded responses:

**WebSocket Close:**
```
Code: 1008
Reason: "Rate limit exceeded"
```

**HTTP Response:**
```
Status: 429 Too Many Requests
Body: { "error": "Rate limit exceeded" }
```

---

## Best Practices

1. **Always include requestId** for tracking and correlation
2. **Handle ERROR messages** gracefully
3. **Implement reconnection logic** with exponential backoff
4. **Send periodic PINGs** to keep connection alive
5. **Clean up resources** on disconnect
6. **Validate message format** before sending
7. **Use HTTPS/WSS** in production
8. **Store tokens securely** (not in localStorage for sensitive apps)
9. **Implement timeout handling** for requests
10. **Log errors** for debugging

---

## Support

For questions or issues with the API:
- Check server logs
- Review this documentation
- Open an issue on GitHub
- Check server health endpoint

---

**Last Updated:** 2025-10-03
**API Version:** 1.0.0
