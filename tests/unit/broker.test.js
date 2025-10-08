/**
 * Unit Tests for MessageBroker
 */
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

// Mock Redis client
const mockRedisClient = {
  connect: jest.fn().mockResolvedValue(undefined),
  disconnect: jest.fn().mockResolvedValue(undefined),
  publish: jest.fn().mockResolvedValue(1),
  subscribe: jest.fn().mockResolvedValue(undefined),
  unsubscribe: jest.fn().mockResolvedValue(undefined),
  on: jest.fn(),
  isOpen: true,
};

const mockRedisSubscriber = {
  connect: jest.fn().mockResolvedValue(undefined),
  disconnect: jest.fn().mockResolvedValue(undefined),
  subscribe: jest.fn().mockResolvedValue(undefined),
  unsubscribe: jest.fn().mockResolvedValue(undefined),
  on: jest.fn(),
  isOpen: true,
};

// Mock NATS client
const mockNatsConnect = jest.fn().mockResolvedValue({
  publish: jest.fn(),
  subscribe: jest.fn().mockReturnValue({
    unsubscribe: jest.fn(),
    [Symbol.asyncIterator]: async function* () {
      // Mock async iterator
    },
  }),
  close: jest.fn().mockResolvedValue(undefined),
});

// Mock config
const mockConfig = {
  redis: {
    enabled: false,
    host: 'localhost',
    port: 6379,
    password: undefined,
    db: 0,
  },
  nats: {
    enabled: false,
    url: 'nats://localhost:4222',
  },
};

// Mock logger
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
};

// Mock modules
jest.unstable_mockModule('redis', () => ({
  createClient: jest.fn(() => mockRedisClient),
}));

jest.unstable_mockModule('nats', () => ({
  connect: mockNatsConnect,
}));

jest.unstable_mockModule('../../src/config.js', () => ({
  default: mockConfig,
}));

jest.unstable_mockModule('../../src/utils.js', () => ({
  logger: mockLogger,
}));

// Import broker after mocking dependencies
const { default: MessageBroker } = await import('../../src/broker.js');

describe('MessageBroker', () => {
  let broker;

  beforeEach(() => {
    // Reset config to memory mode for each test
    mockConfig.redis.enabled = false;
    mockConfig.nats.enabled = false;

    // Create a new broker instance
    broker = new MessageBroker();

    jest.clearAllMocks();
  });

  afterEach(async () => {
    if (broker.connected) {
      await broker.disconnect();
    }
  });

  describe('Memory Mode', () => {
    beforeEach(async () => {
      mockConfig.redis.enabled = false;
      mockConfig.nats.enabled = false;
      await broker.connect();
    });

    it('should connect in memory mode', () => {
      expect(broker.isConnected()).toBe(true);
      expect(broker.getType()).toBe('memory');
    });

    it('should publish and receive messages', async () => {
      const receivedMessages = [];

      await broker.subscribe('test-channel', (msg) => {
        receivedMessages.push(msg);
      });

      await broker.publish('test-channel', { data: 'test' });

      expect(receivedMessages).toHaveLength(1);
      expect(receivedMessages[0]).toEqual({ data: 'test' });
    });

    it('should support multiple subscribers', async () => {
      const received1 = [];
      const received2 = [];

      await broker.subscribe('test', (msg) => received1.push(msg));
      await broker.subscribe('test', (msg) => received2.push(msg));

      await broker.publish('test', { data: 'test' });

      expect(received1).toHaveLength(1);
      expect(received2).toHaveLength(1);
    });

    it('should support multiple channels', async () => {
      const channel1Messages = [];
      const channel2Messages = [];

      await broker.subscribe('channel1', (msg) => channel1Messages.push(msg));
      await broker.subscribe('channel2', (msg) => channel2Messages.push(msg));

      await broker.publish('channel1', { data: 'msg1' });
      await broker.publish('channel2', { data: 'msg2' });

      expect(channel1Messages).toHaveLength(1);
      expect(channel1Messages[0]).toEqual({ data: 'msg1' });
      expect(channel2Messages).toHaveLength(1);
      expect(channel2Messages[0]).toEqual({ data: 'msg2' });
    });

    it('should unsubscribe from channels', async () => {
      const received = [];

      await broker.subscribe('test', (msg) => received.push(msg));
      await broker.publish('test', { data: '1' });

      await broker.unsubscribe('test');
      await broker.publish('test', { data: '2' });

      expect(received).toHaveLength(1);
      expect(received[0]).toEqual({ data: '1' });
    });

    it('should handle complex message objects', async () => {
      const received = [];
      const complexMessage = {
        type: 'TEST',
        payload: { nested: { data: [1, 2, 3] } },
        timestamp: Date.now(),
      };

      await broker.subscribe('test', (msg) => received.push(msg));
      await broker.publish('test', complexMessage);

      expect(received[0]).toEqual(complexMessage);
    });

    it('should handle publish when not subscribed', async () => {
      await expect(broker.publish('test', { data: 'test' })).resolves.not.toThrow();
    });

    it('should disconnect cleanly', async () => {
      await expect(broker.disconnect()).resolves.not.toThrow();
      expect(broker.isConnected()).toBe(false);
    });
  });

  describe('Redis Mode', () => {
    beforeEach(() => {
      mockConfig.redis.enabled = true;
      mockConfig.nats.enabled = false;
    });

    it('should attempt to connect to Redis', async () => {
      await broker.connect();

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Redis'),
        expect.any(Object)
      );
    });

    it('should handle Redis connection failure', async () => {
      mockRedisClient.connect.mockRejectedValueOnce(new Error('Connection failed'));

      await expect(broker.connect()).rejects.toThrow();
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should set type to redis when connected', async () => {
      await broker.connect();
      expect(broker.getType()).toBe('redis');
    });

    it('should disconnect from Redis', async () => {
      await broker.connect();
      await broker.disconnect();

      expect(mockRedisClient.disconnect).toHaveBeenCalled();
      expect(broker.isConnected()).toBe(false);
    });
  });

  describe('NATS Mode', () => {
    beforeEach(() => {
      mockConfig.redis.enabled = false;
      mockConfig.nats.enabled = true;
    });

    it('should attempt to connect to NATS', async () => {
      await broker.connect();

      expect(mockNatsConnect).toHaveBeenCalledWith({
        servers: mockConfig.nats.url,
      });
    });

    it('should handle NATS connection failure', async () => {
      mockNatsConnect.mockRejectedValueOnce(new Error('NATS connection failed'));

      await expect(broker.connect()).rejects.toThrow();
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should set type to nats when connected', async () => {
      await broker.connect();
      expect(broker.getType()).toBe('nats');
    });
  });

  describe('Connection Management', () => {
    it('should return connection status', () => {
      expect(broker.isConnected()).toBe(false);
    });

    it('should update connection status after connect', async () => {
      await broker.connect();
      expect(broker.isConnected()).toBe(true);
    });

    it('should update connection status after disconnect', async () => {
      await broker.connect();
      await broker.disconnect();
      expect(broker.isConnected()).toBe(false);
    });

    it('should handle disconnect when not connected', async () => {
      await expect(broker.disconnect()).resolves.not.toThrow();
    });

    it('should handle multiple connect calls', async () => {
      await broker.connect();
      await expect(broker.connect()).resolves.not.toThrow();
    });

    it('should handle multiple disconnect calls', async () => {
      await broker.connect();
      await broker.disconnect();
      await expect(broker.disconnect()).resolves.not.toThrow();
    });
  });

  describe('Publish', () => {
    beforeEach(async () => {
      await broker.connect();
    });

    it('should handle publish when not connected', async () => {
      await broker.disconnect();
      await expect(broker.publish('test', { data: 'test' })).resolves.not.toThrow();
    });

    it('should serialize message to JSON', async () => {
      const received = [];
      await broker.subscribe('test', (msg) => received.push(msg));

      const message = { type: 'TEST', value: 123 };
      await broker.publish('test', message);

      expect(received[0]).toEqual(message);
    });

    it('should handle publish errors gracefully', async () => {
      // This should not throw even if there are no subscribers
      await expect(broker.publish('nonexistent', { data: 'test' })).resolves.not.toThrow();
    });
  });

  describe('Subscribe', () => {
    beforeEach(async () => {
      await broker.connect();
    });

    it('should register callback for channel', async () => {
      const callback = jest.fn();
      await broker.subscribe('test', callback);

      await broker.publish('test', { data: 'test' });

      expect(callback).toHaveBeenCalledWith({ data: 'test' });
    });

    it('should support multiple callbacks per channel', async () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();

      await broker.subscribe('test', callback1);
      await broker.subscribe('test', callback2);

      await broker.publish('test', { data: 'test' });

      expect(callback1).toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
    });

    it('should handle subscribe errors', async () => {
      await expect(broker.subscribe('test', jest.fn())).resolves.not.toThrow();
    });
  });

  describe('Unsubscribe', () => {
    beforeEach(async () => {
      await broker.connect();
    });

    it('should remove all callbacks for channel', async () => {
      const received = [];
      await broker.subscribe('test', (msg) => received.push(msg));

      await broker.publish('test', { data: '1' });
      await broker.unsubscribe('test');
      await broker.publish('test', { data: '2' });

      expect(received).toHaveLength(1);
    });

    it('should handle unsubscribe from non-existent channel', async () => {
      await expect(broker.unsubscribe('nonexistent')).resolves.not.toThrow();
    });

    it('should handle unsubscribe when not subscribed', async () => {
      await expect(broker.unsubscribe('test')).resolves.not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should handle callback errors', async () => {
      await broker.connect();

      const errorCallback = jest.fn(() => {
        throw new Error('Callback error');
      });

      await broker.subscribe('test', errorCallback);

      // Should not throw even if callback throws
      await expect(broker.publish('test', { data: 'test' })).resolves.not.toThrow();
    });

    it('should handle malformed messages gracefully', async () => {
      await broker.connect();

      const received = [];
      await broker.subscribe('test', (msg) => received.push(msg));

      // Test with various message types
      await broker.publish('test', null);
      await broker.publish('test', undefined);
      await broker.publish('test', 'string');
      await broker.publish('test', 123);

      // Should handle all gracefully
      expect(received.length).toBeGreaterThan(0);
    });
  });

  describe('Type Management', () => {
    it('should return correct type for memory mode', async () => {
      mockConfig.redis.enabled = false;
      mockConfig.nats.enabled = false;
      await broker.connect();

      expect(broker.getType()).toBe('memory');
    });

    it('should return correct type for redis mode', async () => {
      mockConfig.redis.enabled = true;
      mockConfig.nats.enabled = false;
      await broker.connect();

      expect(broker.getType()).toBe('redis');
    });

    it('should return correct type for nats mode', async () => {
      mockConfig.redis.enabled = false;
      mockConfig.nats.enabled = true;
      await broker.connect();

      expect(broker.getType()).toBe('nats');
    });

    it('should return memory type when not connected', () => {
      expect(broker.getType()).toBe('memory');
    });
  });
});