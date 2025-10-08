/**
 * Integration Tests for WebSocket Flows
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import WebSocket from 'ws';
import { sleep } from '../helpers.js';

// Start server for integration tests
const TEST_PORT = 8081;
const TEST_HOST = `ws://localhost:${TEST_PORT}`;

// Set test environment variables
process.env.NODE_ENV = 'development';
process.env.PORT = TEST_PORT;
process.env.REDIS_ENABLED = 'false';
process.env.NATS_ENABLED = 'false';
process.env.INFERENCE_ENABLED = 'false';

// Dynamic import of server
let WebSocketAPIServer;
let serverInstance;
let server;

beforeAll(async () => {
  // Import server class
  const serverModule = await import('../../src/server.js');
  WebSocketAPIServer = serverModule.default;

  // Create and start server
  server = new WebSocketAPIServer();
  serverInstance = await server.start();

  // Wait for server to be ready
  await sleep(1000);
}, 10000);

afterAll(async () => {
  if (serverInstance) {
    await new Promise((resolve) => {
      serverInstance.close(() => {
        resolve();
      });
    });
  }
}, 10000);

describe('WebSocket Connection Flow', () => {
  it('should accept WebSocket connection', async () => {
    const ws = new WebSocket(`${TEST_HOST}/ws`);

    const connected = await new Promise((resolve) => {
      ws.on('open', () => {
        expect(ws.readyState).toBe(WebSocket.OPEN);
        resolve(true);
      });

      ws.on('error', (error) => {
        resolve(false);
      });

      setTimeout(() => resolve(false), 5000);
    });

    expect(connected).toBe(true);
    ws.close();
  });

  it('should receive CONNECTED message on connection', async () => {
    const ws = new WebSocket(`${TEST_HOST}/ws`);

    const message = await new Promise((resolve) => {
      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'CONNECTED') {
          resolve(msg);
        }
      });

      setTimeout(() => resolve(null), 5000);
    });

    expect(message).not.toBeNull();
    expect(message.type).toBe('CONNECTED');
    expect(message.payload.clientId).toBeDefined();
    expect(message.payload.serverVersion).toBe('1.0.0');

    ws.close();
  });

  it('should handle multiple concurrent connections', async () => {
    const connections = [];

    for (let i = 0; i < 5; i++) {
      connections.push(new WebSocket(`${TEST_HOST}/ws`));
    }

    const allConnected = await Promise.all(
      connections.map(
        (ws) =>
          new Promise((resolve) => {
            ws.on('open', () => resolve(true));
            ws.on('error', () => resolve(false));
            setTimeout(() => resolve(false), 5000);
          })
      )
    );

    expect(allConnected.every((c) => c === true)).toBe(true);

    // Clean up
    connections.forEach((ws) => ws.close());
  });
});

describe('PING/PONG Flow', () => {
  let ws;

  beforeEach(async () => {
    ws = new WebSocket(`${TEST_HOST}/ws`);
    await new Promise((resolve) => ws.on('open', resolve));
    // Clear CONNECTED message
    await new Promise((resolve) => {
      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'CONNECTED') resolve();
      });
    });
  });

  afterAll(() => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.close();
    }
  });

  it('should respond to PING with PONG', async () => {
    ws.send(JSON.stringify({ type: 'PING' }));

    const response = await new Promise((resolve) => {
      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'PONG') {
          resolve(msg);
        }
      });

      setTimeout(() => resolve(null), 5000);
    });

    expect(response).not.toBeNull();
    expect(response.type).toBe('PONG');
    expect(response.payload.timestamp).toBeDefined();
  });

  it('should include requestId in PONG response', async () => {
    const requestId = 'test-req-123';
    ws.send(JSON.stringify({ type: 'PING', requestId }));

    const response = await new Promise((resolve) => {
      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'PONG') {
          resolve(msg);
        }
      });

      setTimeout(() => resolve(null), 5000);
    });

    expect(response.requestId).toBe(requestId);
  });
});

describe('Message Broadcast Flow', () => {
  let ws1, ws2;

  beforeEach(async () => {
    ws1 = new WebSocket(`${TEST_HOST}/ws`);
    ws2 = new WebSocket(`${TEST_HOST}/ws`);

    await Promise.all([
      new Promise((resolve) => ws1.on('open', resolve)),
      new Promise((resolve) => ws2.on('open', resolve)),
    ]);

    // Clear CONNECTED messages
    await Promise.all([
      new Promise((resolve) =>
        ws1.once('message', () => {
          resolve();
        })
      ),
      new Promise((resolve) =>
        ws2.once('message', () => {
          resolve();
        })
      ),
    ]);

    await sleep(100);
  });

  afterAll(() => {
    if (ws1 && ws1.readyState === WebSocket.OPEN) ws1.close();
    if (ws2 && ws2.readyState === WebSocket.OPEN) ws2.close();
  });

  it('should broadcast message to other clients', async () => {
    const testMessage = 'Hello from client 1';

    // Setup listener on ws2
    const received = new Promise((resolve) => {
      ws2.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'BROADCAST') {
          resolve(msg);
        }
      });

      setTimeout(() => resolve(null), 5000);
    });

    // Send broadcast from ws1
    ws1.send(
      JSON.stringify({
        type: 'BROADCAST',
        payload: { message: testMessage },
      })
    );

    const message = await received;

    expect(message).not.toBeNull();
    expect(message.type).toBe('BROADCAST');
    expect(message.payload.message).toBe(testMessage);
  });

  it('should not send broadcast back to sender', async () => {
    let receivedOnSender = false;

    ws1.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'BROADCAST') {
        receivedOnSender = true;
      }
    });

    ws1.send(
      JSON.stringify({
        type: 'BROADCAST',
        payload: { message: 'Test' },
      })
    );

    await sleep(500);

    expect(receivedOnSender).toBe(false);
  });
});

describe('Channel/Room Flow', () => {
  let ws1, ws2, ws3;

  beforeEach(async () => {
    ws1 = new WebSocket(`${TEST_HOST}/ws`);
    ws2 = new WebSocket(`${TEST_HOST}/ws`);
    ws3 = new WebSocket(`${TEST_HOST}/ws`);

    await Promise.all([
      new Promise((resolve) => ws1.on('open', resolve)),
      new Promise((resolve) => ws2.on('open', resolve)),
      new Promise((resolve) => ws3.on('open', resolve)),
    ]);

    // Clear CONNECTED messages
    await Promise.all([
      new Promise((resolve) => ws1.once('message', resolve)),
      new Promise((resolve) => ws2.once('message', resolve)),
      new Promise((resolve) => ws3.once('message', resolve)),
    ]);

    await sleep(100);
  });

  afterAll(() => {
    [ws1, ws2, ws3].forEach((ws) => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    });
  });

  it('should subscribe to channel', async () => {
    const response = await new Promise((resolve) => {
      ws1.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'SUBSCRIBED') {
          resolve(msg);
        }
      });

      ws1.send(
        JSON.stringify({
          type: 'SUBSCRIBE',
          payload: { channel: 'test-channel' },
          requestId: 'sub-123',
        })
      );

      setTimeout(() => resolve(null), 5000);
    });

    expect(response).not.toBeNull();
    expect(response.type).toBe('SUBSCRIBED');
    expect(response.payload.channel).toBe('test-channel');
  });

  it('should send room message only to channel subscribers', async () => {
    const channel = 'test-room';

    // Subscribe ws1 and ws2 to channel
    await Promise.all([
      new Promise((resolve) => {
        ws1.once('message', (data) => {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'SUBSCRIBED') resolve();
        });
        ws1.send(JSON.stringify({ type: 'SUBSCRIBE', payload: { channel } }));
      }),
      new Promise((resolve) => {
        ws2.once('message', (data) => {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'SUBSCRIBED') resolve();
        });
        ws2.send(JSON.stringify({ type: 'SUBSCRIBE', payload: { channel } }));
      }),
    ]);

    await sleep(100);

    // Setup listeners
    const received = {
      ws1: false,
      ws2: false,
      ws3: false,
    };

    ws1.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'ROOM_MESSAGE') received.ws1 = true;
    });

    ws2.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'ROOM_MESSAGE') received.ws2 = true;
    });

    ws3.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'ROOM_MESSAGE') received.ws3 = true;
    });

    // Send room message from ws1
    ws1.send(
      JSON.stringify({
        type: 'ROOM_MESSAGE',
        payload: { channel, message: 'Room message' },
      })
    );

    await sleep(500);

    expect(received.ws1).toBe(false); // Sender shouldn't receive
    expect(received.ws2).toBe(true); // Subscribed should receive
    expect(received.ws3).toBe(false); // Not subscribed shouldn't receive
  });
});

describe('Error Handling Flow', () => {
  let ws;

  beforeEach(async () => {
    ws = new WebSocket(`${TEST_HOST}/ws`);
    await new Promise((resolve) => ws.on('open', resolve));
    // Clear CONNECTED message
    await new Promise((resolve) => ws.once('message', resolve));
    await sleep(100);
  });

  afterAll(() => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.close();
    }
  });

  it('should handle invalid JSON gracefully', async () => {
    const response = await new Promise((resolve) => {
      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'ERROR') {
          resolve(msg);
        }
      });

      ws.send('invalid json');

      setTimeout(() => resolve(null), 5000);
    });

    expect(response).not.toBeNull();
    expect(response.type).toBe('ERROR');
    expect(response.payload.error).toContain('Invalid JSON');
  });

  it('should handle unknown message type', async () => {
    const response = await new Promise((resolve) => {
      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'ERROR') {
          resolve(msg);
        }
      });

      ws.send(JSON.stringify({ type: 'UNKNOWN_TYPE' }));

      setTimeout(() => resolve(null), 5000);
    });

    expect(response).not.toBeNull();
    expect(response.type).toBe('ERROR');
    expect(response.payload.error).toContain('Unknown message type');
  });

  it('should validate required fields', async () => {
    const response = await new Promise((resolve) => {
      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'ERROR') {
          resolve(msg);
        }
      });

      ws.send(
        JSON.stringify({
          type: 'BROADCAST',
          payload: {}, // Missing required 'message' field
        })
      );

      setTimeout(() => resolve(null), 5000);
    });

    expect(response).not.toBeNull();
    expect(response.type).toBe('ERROR');
    expect(response.payload.error).toContain('message');
  });
});