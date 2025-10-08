/**
 * Test Helpers
 * Utility functions and mocks for tests
 */

/**
 * Create a mock WebSocket connection
 */
export function createMockWebSocket() {
  const messages = [];

  return {
    send: jest.fn((data) => {
      messages.push(JSON.parse(data));
    }),
    close: jest.fn(),
    readyState: 1, // OPEN
    messages,
    getLastMessage: () => messages[messages.length - 1],
    clearMessages: () => messages.splice(0, messages.length),
  };
}

/**
 * Create a mock connection manager
 */
export function createMockConnectionManager() {
  const connections = new Map();

  return {
    connections,
    addConnection: jest.fn((clientId, ws, ip, metadata) => {
      connections.set(clientId, { ws, ip, metadata });
      return true;
    }),
    getConnection: jest.fn((clientId) => {
      return connections.get(clientId);
    }),
    removeConnection: jest.fn((clientId) => {
      connections.delete(clientId);
    }),
    broadcast: jest.fn(),
    getConnectionsByIp: jest.fn(() => []),
  };
}

/**
 * Create a mock broker
 */
export function createMockBroker() {
  return {
    connect: jest.fn().mockResolvedValue(true),
    disconnect: jest.fn().mockResolvedValue(true),
    publish: jest.fn().mockResolvedValue(true),
    subscribe: jest.fn().mockResolvedValue(true),
    unsubscribe: jest.fn().mockResolvedValue(true),
    isConnected: jest.fn().mockReturnValue(true),
    getType: jest.fn().mockReturnValue('memory'),
  };
}

/**
 * Create a mock inference bridge
 */
export function createMockInferenceBridge() {
  return {
    initialize: jest.fn().mockResolvedValue(true),
    processInferenceRequest: jest.fn().mockResolvedValue({
      output: 'test output',
      model: 'test-model',
    }),
    streamInferenceRequest: jest.fn(),
    cancelInferenceRequest: jest.fn(),
  };
}

/**
 * Wait for a condition to be true
 */
export async function waitFor(condition, timeout = 5000, interval = 100) {
  const start = Date.now();

  while (Date.now() - start < timeout) {
    if (await condition()) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  throw new Error(`Timeout waiting for condition after ${timeout}ms`);
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default {
  createMockWebSocket,
  createMockConnectionManager,
  createMockBroker,
  createMockInferenceBridge,
  waitFor,
  sleep,
};