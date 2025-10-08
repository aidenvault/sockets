/**
 * Unit Tests for MessageRouter
 */
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { createMockWebSocket } from '../helpers.js';

// Mock dependencies before importing router
const mockLogger = {
  info: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
};

const mockBroker = {
  isConnected: jest.fn(() => true),
  publish: jest.fn(() => Promise.resolve()),
};

const mockInferenceBridge = {
  processInferenceRequest: jest.fn(() => Promise.resolve({ output: 'test output' })),
};

const mockConnectionManager = {
  connections: new Map(),
  getConnection: jest.fn((clientId) => ({
    ws: createMockWebSocket(),
    ip: '127.0.0.1',
    metadata: { channels: new Set() },
  })),
  broadcast: jest.fn(),
  getConnectionsByIp: jest.fn(() => []),
};

const mockUtils = {
  generateId: jest.fn(() => 'test-id-123'),
};

// Mock modules
jest.unstable_mockModule('../../src/utils.js', () => ({
  logger: mockLogger,
  connectionManager: mockConnectionManager,
  utils: mockUtils,
}));

jest.unstable_mockModule('../../src/broker.js', () => ({
  default: mockBroker,
}));

jest.unstable_mockModule('../../src/inference-bridge.js', () => ({
  default: mockInferenceBridge,
}));

// Import router after mocking dependencies
const { default: router } = await import('../../src/router.js');

describe('MessageRouter', () => {
  let mockWs;
  let mockClientId;

  beforeEach(() => {
    mockWs = createMockWebSocket();
    mockClientId = 'test-client-123';
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Handler Registration', () => {
    it('should register a new handler', () => {
      const handler = jest.fn();
      router.register('TEST_TYPE', handler);
      expect(router.handlers.has('TEST_TYPE')).toBe(true);
    });

    it('should allow overriding existing handlers', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();
      router.register('TEST_TYPE', handler1);
      router.register('TEST_TYPE', handler2);
      expect(router.handlers.get('TEST_TYPE')).toBe(handler2);
    });

    it('should have default handlers registered', () => {
      expect(router.handlers.has('PING')).toBe(true);
      expect(router.handlers.has('BROADCAST')).toBe(true);
      expect(router.handlers.has('DIRECT_MESSAGE')).toBe(true);
      expect(router.handlers.has('SUBSCRIBE')).toBe(true);
      expect(router.handlers.has('INFERENCE_REQUEST')).toBe(true);
    });
  });

  describe('Message Routing', () => {
    it('should route valid message to handler', async () => {
      const message = {
        type: 'PING',
        payload: {},
        requestId: 'req-123',
      };

      await router.route(mockClientId, message, mockWs);

      expect(mockWs.send).toHaveBeenCalled();
      const sentMessage = mockWs.getLastMessage();
      expect(sentMessage.type).toBe('PONG');
    });

    it('should send error for missing message type', async () => {
      const message = {
        payload: {},
      };

      await router.route(mockClientId, message, mockWs);

      expect(mockWs.send).toHaveBeenCalled();
      const sentMessage = mockWs.getLastMessage();
      expect(sentMessage.type).toBe('ERROR');
      expect(sentMessage.payload.error).toContain('type field is required');
    });

    it('should send error for unknown message type', async () => {
      const message = {
        type: 'UNKNOWN_TYPE',
        payload: {},
      };

      await router.route(mockClientId, message, mockWs);

      const sentMessage = mockWs.getLastMessage();
      expect(sentMessage.type).toBe('ERROR');
      expect(sentMessage.payload.error).toContain('Unknown message type');
    });

    it('should handle handler errors gracefully', async () => {
      const errorHandler = jest.fn().mockRejectedValue(new Error('Handler error'));
      router.register('ERROR_TYPE', errorHandler);

      const message = {
        type: 'ERROR_TYPE',
        payload: {},
      };

      await router.route(mockClientId, message, mockWs);

      const sentMessage = mockWs.getLastMessage();
      expect(sentMessage.type).toBe('ERROR');
    });
  });

  describe('Message Validation', () => {
    it('should reject message with invalid structure', async () => {
      const message = {
        type: 123, // Should be string
        payload: {},
      };

      await router.route(mockClientId, message, mockWs);

      const sentMessage = mockWs.getLastMessage();
      expect(sentMessage.type).toBe('ERROR');
      expect(sentMessage.payload.error).toContain('Invalid message structure');
    });

    it('should reject BROADCAST with missing message field', async () => {
      const message = {
        type: 'BROADCAST',
        payload: {}, // Missing message field
      };

      await router.route(mockClientId, message, mockWs);

      const sentMessage = mockWs.getLastMessage();
      expect(sentMessage.type).toBe('ERROR');
      expect(sentMessage.payload.error).toContain('message field is required');
    });

    it('should reject DIRECT_MESSAGE with missing targetClientId', async () => {
      const message = {
        type: 'DIRECT_MESSAGE',
        payload: {
          message: 'Hello',
          // Missing targetClientId
        },
      };

      await router.route(mockClientId, message, mockWs);

      const sentMessage = mockWs.getLastMessage();
      expect(sentMessage.type).toBe('ERROR');
      expect(sentMessage.payload.error).toContain('targetClientId is required');
    });

    it('should reject SUBSCRIBE with invalid channel name', async () => {
      const message = {
        type: 'SUBSCRIBE',
        payload: {
          channel: 'invalid channel!', // Contains invalid characters
        },
      };

      await router.route(mockClientId, message, mockWs);

      const sentMessage = mockWs.getLastMessage();
      expect(sentMessage.type).toBe('ERROR');
      expect(sentMessage.payload.error).toContain('channel must contain only alphanumeric');
    });
  });

  describe('PING Handler', () => {
    it('should handle PING request', async () => {
      const message = {
        type: 'PING',
        requestId: 'ping-123',
      };

      await router.route(mockClientId, message, mockWs);

      const sentMessage = mockWs.getLastMessage();
      expect(sentMessage.type).toBe('PONG');
      expect(sentMessage.requestId).toBe('ping-123');
      expect(sentMessage.payload.timestamp).toBeDefined();
    });

    it('should include timestamp in PONG', async () => {
      const before = Date.now();

      const message = {
        type: 'PING',
      };

      await router.route(mockClientId, message, mockWs);

      const sentMessage = mockWs.getLastMessage();
      const after = Date.now();

      expect(sentMessage.payload.timestamp).toBeGreaterThanOrEqual(before);
      expect(sentMessage.payload.timestamp).toBeLessThanOrEqual(after);
    });
  });

  describe('BROADCAST Handler', () => {
    it('should handle valid BROADCAST message', async () => {
      const message = {
        type: 'BROADCAST',
        payload: {
          message: 'Hello everyone!',
        },
        requestId: 'broadcast-123',
      };

      await router.route(mockClientId, message, mockWs);

      expect(mockBroker.publish).toHaveBeenCalledWith(
        'broadcast',
        expect.objectContaining({
          fromClientId: mockClientId,
          message: 'Hello everyone!',
        })
      );
    });

    it('should validate message is not empty', async () => {
      const message = {
        type: 'BROADCAST',
        payload: {
          message: '',
        },
      };

      await router.route(mockClientId, message, mockWs);

      const sentMessage = mockWs.getLastMessage();
      expect(sentMessage.type).toBe('ERROR');
    });

    it('should limit message length', async () => {
      const longMessage = 'a'.repeat(20000);
      const message = {
        type: 'BROADCAST',
        payload: {
          message: longMessage,
        },
      };

      await router.route(mockClientId, message, mockWs);

      const sentMessage = mockWs.getLastMessage();
      expect(sentMessage.type).toBe('ERROR');
      expect(sentMessage.payload.error).toContain('cannot exceed');
    });
  });

  describe('SUBSCRIBE Handler', () => {
    it('should handle SUBSCRIBE to channel', async () => {
      const message = {
        type: 'SUBSCRIBE',
        payload: {
          channel: 'test-channel',
        },
        requestId: 'sub-123',
      };

      await router.route(mockClientId, message, mockWs);

      const sentMessage = mockWs.getLastMessage();
      expect(sentMessage.type).toBe('SUBSCRIBED');
      expect(sentMessage.payload.channel).toBe('test-channel');
      expect(sentMessage.requestId).toBe('sub-123');
    });

    it('should validate channel name format', async () => {
      const message = {
        type: 'SUBSCRIBE',
        payload: {
          channel: 'test channel with spaces',
        },
      };

      await router.route(mockClientId, message, mockWs);

      const sentMessage = mockWs.getLastMessage();
      expect(sentMessage.type).toBe('ERROR');
    });
  });

  describe('INFERENCE_REQUEST Handler', () => {
    it('should handle valid INFERENCE_REQUEST', async () => {
      const message = {
        type: 'INFERENCE_REQUEST',
        payload: {
          input: 'Test input',
        },
        requestId: 'inf-123',
      };

      await router.route(mockClientId, message, mockWs);

      expect(mockInferenceBridge.processInferenceRequest).toHaveBeenCalled();

      // Wait for async completion
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockWs.send).toHaveBeenCalled();
    });

    it('should validate input is not empty', async () => {
      const message = {
        type: 'INFERENCE_REQUEST',
        payload: {
          input: '',
        },
      };

      await router.route(mockClientId, message, mockWs);

      const sentMessage = mockWs.getLastMessage();
      expect(sentMessage.type).toBe('ERROR');
    });
  });

  describe('Response Formatting', () => {
    it('should include timestamp in responses', () => {
      const before = Date.now();

      router.sendResponse(mockWs, 'TEST', { data: 'test' });

      const sentMessage = mockWs.getLastMessage();
      const after = Date.now();

      expect(sentMessage.timestamp).toBeGreaterThanOrEqual(before);
      expect(sentMessage.timestamp).toBeLessThanOrEqual(after);
    });

    it('should include requestId if provided', () => {
      router.sendResponse(mockWs, 'TEST', {}, 'req-123');

      const sentMessage = mockWs.getLastMessage();
      expect(sentMessage.requestId).toBe('req-123');
    });

    it('should not include requestId if not provided', () => {
      router.sendResponse(mockWs, 'TEST', {});

      const sentMessage = mockWs.getLastMessage();
      expect(sentMessage.requestId).toBeUndefined();
    });

    it('should format error responses correctly', () => {
      router.sendError(mockWs, 'req-123', 'Test error message');

      const sentMessage = mockWs.getLastMessage();
      expect(sentMessage.type).toBe('ERROR');
      expect(sentMessage.payload.error).toBe('Test error message');
      expect(sentMessage.requestId).toBe('req-123');
    });
  });

  describe('GET_STATS Handler', () => {
    it('should return server statistics', async () => {
      const message = {
        type: 'GET_STATS',
        requestId: 'stats-123',
      };

      mockConnectionManager.connections = new Map([
        ['client1', {}],
        ['client2', {}],
      ]);

      await router.route(mockClientId, message, mockWs);

      const sentMessage = mockWs.getLastMessage();
      expect(sentMessage.type).toBe('STATS');
      expect(sentMessage.payload.connections).toBe(2);
    });
  });
});