/**
 * Unit Tests for Utilities
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// Mock config before importing utils
const mockConfig = {
  auth: {
    jwtSecret: 'test-secret-key-for-testing-purposes-only',
    apiKey: 'test-api-key-123',
    tokenExpiry: '24h',
  },
  security: {
    rateLimitWindowMs: 60000,
    rateLimitMaxRequests: 100,
    maxConnectionsPerIp: 10,
  },
};

jest.unstable_mockModule('../../src/config.js', () => ({
  default: mockConfig,
}));

// Import utils after mocking config
const utilsModule = await import('../../src/utils.js');
const { auth, utils, rateLimiter, connectionManager } = utilsModule;

describe('Authentication', () => {
  describe('generateToken', () => {
    it('should generate valid JWT token', () => {
      const payload = { userId: 'user123', email: 'test@example.com' };
      const token = auth.generateToken(payload);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);
    });

    it('should include payload in token', () => {
      const payload = { userId: 'user123' };
      const token = auth.generateToken(payload);
      const verified = auth.verifyToken(token);

      expect(verified).toBeDefined();
      expect(verified.userId).toBe('user123');
    });

    it('should generate different tokens for different payloads', () => {
      const token1 = auth.generateToken({ userId: 'user1' });
      const token2 = auth.generateToken({ userId: 'user2' });

      expect(token1).not.toBe(token2);
    });
  });

  describe('verifyToken', () => {
    it('should verify valid token', () => {
      const payload = { userId: 'user123' };
      const token = auth.generateToken(payload);
      const verified = auth.verifyToken(token);

      expect(verified).toBeDefined();
      expect(verified.userId).toBe('user123');
      expect(verified.iat).toBeDefined();
      expect(verified.exp).toBeDefined();
    });

    it('should reject invalid token', () => {
      const verified = auth.verifyToken('invalid-token-string');
      expect(verified).toBeNull();
    });

    it('should reject malformed token', () => {
      const verified = auth.verifyToken('not.a.token');
      expect(verified).toBeNull();
    });

    it('should reject empty token', () => {
      const verified = auth.verifyToken('');
      expect(verified).toBeNull();
    });

    it('should handle null token', () => {
      const verified = auth.verifyToken(null);
      expect(verified).toBeNull();
    });
  });

  describe('verifyApiKey', () => {
    it('should verify correct API key', () => {
      const result = auth.verifyApiKey('test-api-key-123');
      expect(result).toBe(true);
    });

    it('should reject incorrect API key', () => {
      const result = auth.verifyApiKey('wrong-key');
      expect(result).toBe(false);
    });

    it('should reject empty API key', () => {
      const result = auth.verifyApiKey('');
      expect(result).toBe(false);
    });

    it('should handle null API key', () => {
      const result = auth.verifyApiKey(null);
      expect(result).toBe(false);
    });
  });
});

describe('Utilities', () => {
  describe('generateId', () => {
    it('should generate UUID v4', () => {
      const id = utils.generateId();
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(id).toMatch(uuidRegex);
    });

    it('should generate unique IDs', () => {
      const id1 = utils.generateId();
      const id2 = utils.generateId();
      const id3 = utils.generateId();

      expect(id1).not.toBe(id2);
      expect(id2).not.toBe(id3);
      expect(id1).not.toBe(id3);
    });

    it('should generate IDs with correct length', () => {
      const id = utils.generateId();
      expect(id.length).toBe(36); // UUID v4 format length
    });
  });

  describe('parseJSON', () => {
    it('should parse valid JSON', () => {
      const result = utils.parseJSON('{"key": "value"}');
      expect(result).toEqual({ key: 'value' });
    });

    it('should parse complex JSON', () => {
      const json = JSON.stringify({ a: 1, b: { c: [1, 2, 3] }, d: true });
      const result = utils.parseJSON(json);
      expect(result).toEqual({ a: 1, b: { c: [1, 2, 3] }, d: true });
    });

    it('should return null for invalid JSON', () => {
      const result = utils.parseJSON('invalid json');
      expect(result).toBeNull();
    });

    it('should return null for empty string', () => {
      const result = utils.parseJSON('');
      expect(result).toBeNull();
    });

    it('should return null for null input', () => {
      const result = utils.parseJSON(null);
      expect(result).toBeNull();
    });

    it('should parse JSON arrays', () => {
      const result = utils.parseJSON('[1, 2, 3]');
      expect(result).toEqual([1, 2, 3]);
    });
  });

  describe('retry', () => {
    it('should succeed on first try', async () => {
      const fn = jest.fn().mockResolvedValue('success');
      const result = await utils.retry(fn, 3, 10);

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure', async () => {
      const fn = jest
        .fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValueOnce('success');

      const result = await utils.retry(fn, 3, 10);

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should throw after max retries', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('fail'));

      await expect(utils.retry(fn, 3, 10)).rejects.toThrow('fail');
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should retry multiple times before success', async () => {
      const fn = jest
        .fn()
        .mockRejectedValueOnce(new Error('fail1'))
        .mockRejectedValueOnce(new Error('fail2'))
        .mockResolvedValueOnce('success');

      const result = await utils.retry(fn, 5, 10);

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should handle zero retries', async () => {
      const fn = jest.fn().mockResolvedValue('success');
      const result = await utils.retry(fn, 0, 10);

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe('sleep', () => {
    it('should sleep for specified duration', async () => {
      const start = Date.now();
      await utils.sleep(100);
      const duration = Date.now() - start;

      expect(duration).toBeGreaterThanOrEqual(95);
      expect(duration).toBeLessThan(200);
    });

    it('should work with zero duration', async () => {
      const start = Date.now();
      await utils.sleep(0);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(50);
    });
  });
});

describe('RateLimiter', () => {
  beforeEach(() => {
    rateLimiter.requests.clear();
  });

  it('should allow requests under limit', () => {
    const result = rateLimiter.checkLimit('client1');
    expect(result).toBe(true);
  });

  it('should enforce rate limits', () => {
    const clientId = 'client-test';
    const maxRequests = 100;

    // Make max requests
    for (let i = 0; i < maxRequests; i++) {
      expect(rateLimiter.checkLimit(clientId)).toBe(true);
    }

    // Next request should be blocked
    expect(rateLimiter.checkLimit(clientId)).toBe(false);
  });

  it('should track different clients separately', () => {
    rateLimiter.checkLimit('client1');
    rateLimiter.checkLimit('client1');
    rateLimiter.checkLimit('client2');

    expect(rateLimiter.requests.size).toBeGreaterThanOrEqual(2);
  });

  it('should cleanup old entries', () => {
    rateLimiter.checkLimit('client1');

    // Mock old timestamp (older than window)
    rateLimiter.requests.set('client1', [Date.now() - 120000]);

    rateLimiter.cleanup();

    expect(rateLimiter.requests.size).toBe(0);
  });

  it('should not cleanup recent entries', () => {
    rateLimiter.checkLimit('client1');
    rateLimiter.checkLimit('client2');

    rateLimiter.cleanup();

    expect(rateLimiter.requests.size).toBeGreaterThanOrEqual(1);
  });

  it('should handle concurrent requests from same client', () => {
    const clientId = 'client-concurrent';

    // Simulate concurrent requests
    const results = [];
    for (let i = 0; i < 10; i++) {
      results.push(rateLimiter.checkLimit(clientId));
    }

    // All should succeed
    expect(results.every((r) => r === true)).toBe(true);
  });
});

describe('ConnectionManager', () => {
  beforeEach(() => {
    connectionManager.connections.clear();
  });

  describe('addConnection', () => {
    it('should add new connection', () => {
      const mockWs = { readyState: 1 };
      const result = connectionManager.addConnection('client1', mockWs, '127.0.0.1', {});

      expect(result).toBe(true);
      expect(connectionManager.connections.size).toBe(1);
    });

    it('should store connection metadata', () => {
      const mockWs = { readyState: 1 };
      const metadata = { userId: 'user123' };

      connectionManager.addConnection('client1', mockWs, '127.0.0.1', metadata);

      const connection = connectionManager.getConnection('client1');
      expect(connection.metadata.userId).toBe('user123');
    });

    it('should reject duplicate client IDs', () => {
      const mockWs1 = { readyState: 1 };
      const mockWs2 = { readyState: 1 };

      connectionManager.addConnection('client1', mockWs1, '127.0.0.1', {});
      const result = connectionManager.addConnection('client1', mockWs2, '127.0.0.1', {});

      expect(result).toBe(false);
      expect(connectionManager.connections.size).toBe(1);
    });

    it('should enforce max connections per IP', () => {
      const maxConnections = 10;

      // Add max connections from same IP
      for (let i = 0; i < maxConnections; i++) {
        const result = connectionManager.addConnection(
          `client${i}`,
          { readyState: 1 },
          '192.168.1.1',
          {}
        );
        expect(result).toBe(true);
      }

      // Next connection from same IP should be rejected
      const result = connectionManager.addConnection(
        'client-extra',
        { readyState: 1 },
        '192.168.1.1',
        {}
      );
      expect(result).toBe(false);
    });

    it('should allow connections from different IPs', () => {
      connectionManager.addConnection('client1', { readyState: 1 }, '192.168.1.1', {});
      connectionManager.addConnection('client2', { readyState: 1 }, '192.168.1.2', {});

      expect(connectionManager.connections.size).toBe(2);
    });
  });

  describe('getConnection', () => {
    it('should return existing connection', () => {
      const mockWs = { readyState: 1 };
      connectionManager.addConnection('client1', mockWs, '127.0.0.1', {});

      const connection = connectionManager.getConnection('client1');
      expect(connection).toBeDefined();
      expect(connection.ws).toBe(mockWs);
    });

    it('should return undefined for non-existent connection', () => {
      const connection = connectionManager.getConnection('non-existent');
      expect(connection).toBeUndefined();
    });
  });

  describe('removeConnection', () => {
    it('should remove existing connection', () => {
      connectionManager.addConnection('client1', { readyState: 1 }, '127.0.0.1', {});

      connectionManager.removeConnection('client1');

      expect(connectionManager.connections.size).toBe(0);
    });

    it('should handle removing non-existent connection', () => {
      expect(() => {
        connectionManager.removeConnection('non-existent');
      }).not.toThrow();
    });

    it('should decrement IP connection count', () => {
      connectionManager.addConnection('client1', { readyState: 1 }, '192.168.1.1', {});
      connectionManager.addConnection('client2', { readyState: 1 }, '192.168.1.1', {});

      connectionManager.removeConnection('client1');

      // Should still be able to add more connections from this IP
      const result = connectionManager.addConnection(
        'client3',
        { readyState: 1 },
        '192.168.1.1',
        {}
      );
      expect(result).toBe(true);
    });
  });

  describe('broadcast', () => {
    it('should send message to all connections', () => {
      const mockWs1 = { readyState: 1, send: jest.fn() };
      const mockWs2 = { readyState: 1, send: jest.fn() };

      connectionManager.addConnection('client1', mockWs1, '127.0.0.1', {});
      connectionManager.addConnection('client2', mockWs2, '127.0.0.2', {});

      const message = { type: 'TEST', payload: {} };
      connectionManager.broadcast(message);

      expect(mockWs1.send).toHaveBeenCalled();
      expect(mockWs2.send).toHaveBeenCalled();
    });

    it('should exclude specific client from broadcast', () => {
      const mockWs1 = { readyState: 1, send: jest.fn() };
      const mockWs2 = { readyState: 1, send: jest.fn() };

      connectionManager.addConnection('client1', mockWs1, '127.0.0.1', {});
      connectionManager.addConnection('client2', mockWs2, '127.0.0.2', {});

      const message = { type: 'TEST', payload: {} };
      connectionManager.broadcast(message, 'client1');

      expect(mockWs1.send).not.toHaveBeenCalled();
      expect(mockWs2.send).toHaveBeenCalled();
    });

    it('should only send to open connections', () => {
      const mockWs1 = { readyState: 1, send: jest.fn() };
      const mockWs2 = { readyState: 3, send: jest.fn() }; // CLOSED

      connectionManager.addConnection('client1', mockWs1, '127.0.0.1', {});
      connectionManager.addConnection('client2', mockWs2, '127.0.0.2', {});

      const message = { type: 'TEST', payload: {} };
      connectionManager.broadcast(message);

      expect(mockWs1.send).toHaveBeenCalled();
      expect(mockWs2.send).not.toHaveBeenCalled();
    });
  });

  describe('getConnectionsByIp', () => {
    it('should return connections for specific IP', () => {
      connectionManager.addConnection('client1', { readyState: 1 }, '192.168.1.1', {});
      connectionManager.addConnection('client2', { readyState: 1 }, '192.168.1.1', {});
      connectionManager.addConnection('client3', { readyState: 1 }, '192.168.1.2', {});

      const connections = connectionManager.getConnectionsByIp('192.168.1.1');
      expect(connections.length).toBe(2);
    });

    it('should return empty array for IP with no connections', () => {
      const connections = connectionManager.getConnectionsByIp('192.168.1.100');
      expect(connections).toEqual([]);
    });
  });
});