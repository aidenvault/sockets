import winston from 'winston';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import config from './config.js';

/**
 * Logger Configuration
 * Winston-based logging system with multiple transports
 */
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...metadata }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(metadata).length > 0) {
      msg += ` ${JSON.stringify(metadata)}`;
    }
    return msg;
  })
);

const transports = [
  new winston.transports.Console({
    format: consoleFormat,
  }),
];

if (config.logging.toFile) {
  transports.push(
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format: logFormat,
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
      format: logFormat,
    })
  );
}

export const logger = winston.createLogger({
  level: config.logging.level,
  format: logFormat,
  transports,
});

/**
 * Authentication Utilities
 */
export const auth = {
  /**
   * Generate JWT token
   * @param {Object} payload - Data to encode in token
   * @returns {string} JWT token
   */
  generateToken(payload) {
    return jwt.sign(payload, config.auth.jwtSecret, {
      expiresIn: config.auth.tokenExpiry,
    });
  },

  /**
   * Verify JWT token
   * @param {string} token - JWT token to verify
   * @returns {Object|null} Decoded payload or null if invalid
   */
  verifyToken(token) {
    try {
      return jwt.verify(token, config.auth.jwtSecret);
    } catch (error) {
      logger.warn('Token verification failed', { error: error.message });
      return null;
    }
  },

  /**
   * Verify API key
   * @param {string} apiKey - API key to verify
   * @returns {boolean} True if valid
   */
  verifyApiKey(apiKey) {
    return apiKey === config.auth.apiKey;
  },

  /**
   * Extract token from WebSocket upgrade request
   * @param {Object} request - HTTP upgrade request
   * @returns {string|null} Token or null
   */
  extractToken(request) {
    // Check query parameter
    const url = new URL(request.url, 'ws://localhost');
    const tokenFromQuery = url.searchParams.get('token');
    if (tokenFromQuery) return tokenFromQuery;

    // Check authorization header
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    return null;
  },
};

/**
 * Rate Limiting Utilities
 */
class RateLimiter {
  constructor() {
    this.requests = new Map();
  }

  /**
   * Check if request should be rate limited
   * @param {string} identifier - Client identifier (IP, user ID, etc.)
   * @returns {boolean} True if request should be allowed
   */
  checkLimit(identifier) {
    const now = Date.now();
    const windowStart = now - config.security.rateLimitWindowMs;

    if (!this.requests.has(identifier)) {
      this.requests.set(identifier, [now]);
      return true;
    }

    const timestamps = this.requests.get(identifier).filter(ts => ts > windowStart);
    
    if (timestamps.length >= config.security.rateLimitMaxRequests) {
      return false;
    }

    timestamps.push(now);
    this.requests.set(identifier, timestamps);
    return true;
  }

  /**
   * Clean up old entries
   */
  cleanup() {
    const now = Date.now();
    const windowStart = now - config.security.rateLimitWindowMs;

    for (const [identifier, timestamps] of this.requests.entries()) {
      const filtered = timestamps.filter(ts => ts > windowStart);
      if (filtered.length === 0) {
        this.requests.delete(identifier);
      } else {
        this.requests.set(identifier, filtered);
      }
    }
  }
}

export const rateLimiter = new RateLimiter();

// Cleanup rate limiter every minute
setInterval(() => rateLimiter.cleanup(), 60000);

/**
 * Connection Management Utilities
 */
export const connectionManager = {
  connections: new Map(),
  connectionsByIp: new Map(),

  /**
   * Add a new connection
   * @param {string} clientId - Unique client identifier
   * @param {Object} ws - WebSocket connection
   * @param {string} ip - Client IP address
   * @param {Object} metadata - Additional metadata
   * @returns {boolean} True if connection added successfully
   */
  addConnection(clientId, ws, ip, metadata = {}) {
    // Check max connections per IP
    const ipConnections = this.connectionsByIp.get(ip) || [];
    if (ipConnections.length >= config.security.maxConnectionsPerIp) {
      logger.warn('Max connections per IP exceeded', { ip, count: ipConnections.length });
      return false;
    }

    this.connections.set(clientId, {
      ws,
      ip,
      connectedAt: Date.now(),
      metadata,
    });

    ipConnections.push(clientId);
    this.connectionsByIp.set(ip, ipConnections);

    logger.info('Connection added', { clientId, ip, totalConnections: this.connections.size });
    return true;
  },

  /**
   * Remove a connection
   * @param {string} clientId - Client identifier
   */
  removeConnection(clientId) {
    const connection = this.connections.get(clientId);
    if (!connection) return;

    const { ip } = connection;
    this.connections.delete(clientId);

    const ipConnections = this.connectionsByIp.get(ip) || [];
    const filtered = ipConnections.filter(id => id !== clientId);
    if (filtered.length === 0) {
      this.connectionsByIp.delete(ip);
    } else {
      this.connectionsByIp.set(ip, filtered);
    }

    logger.info('Connection removed', { clientId, ip, totalConnections: this.connections.size });
  },

  /**
   * Get connection info
   * @param {string} clientId - Client identifier
   * @returns {Object|null} Connection info or null
   */
  getConnection(clientId) {
    return this.connections.get(clientId) || null;
  },

  /**
   * Get all connections
   * @returns {Array} Array of connection objects
   */
  getAllConnections() {
    return Array.from(this.connections.entries()).map(([clientId, conn]) => ({
      clientId,
      ...conn,
      ws: undefined, // Don't expose WebSocket object
    }));
  },

  /**
   * Broadcast message to all connections
   * @param {Object} message - Message to broadcast
   * @param {string} excludeClientId - Optional client ID to exclude
   */
  broadcast(message, excludeClientId = null) {
    const messageStr = JSON.stringify(message);
    let sent = 0;

    for (const [clientId, { ws }] of this.connections.entries()) {
      if (clientId !== excludeClientId && ws.readyState === 1) {
        try {
          ws.send(messageStr);
          sent++;
        } catch (error) {
          logger.error('Broadcast failed', { clientId, error: error.message });
        }
      }
    }

    logger.debug('Broadcast sent', { recipients: sent, excludedClient: excludeClientId });
  },
};

/**
 * Utility Functions
 */
export const utils = {
  /**
   * Generate unique ID
   * @returns {string} UUID v4
   */
  generateId() {
    return uuidv4();
  },

  /**
   * Safe JSON parse
   * @param {string} str - String to parse
   * @returns {Object|null} Parsed object or null
   */
  parseJSON(str) {
    try {
      return JSON.parse(str);
    } catch (error) {
      logger.warn('JSON parse failed', { error: error.message });
      return null;
    }
  },

  /**
   * Get client IP from request
   * @param {Object} request - HTTP request
   * @returns {string} IP address
   */
  getClientIp(request) {
    return (
      request.headers['x-forwarded-for']?.split(',')[0] ||
      request.headers['x-real-ip'] ||
      request.socket.remoteAddress ||
      'unknown'
    );
  },

  /**
   * Sleep utility
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise}
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  /**
   * Retry utility
   * @param {Function} fn - Async function to retry
   * @param {number} retries - Number of retries
   * @param {number} delay - Delay between retries in ms
   * @returns {Promise} Result of function
   */
  async retry(fn, retries = 3, delay = 1000) {
    let lastError;
    for (let i = 0; i < retries; i++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        logger.warn(`Retry attempt ${i + 1}/${retries} failed`, { error: error.message });
        if (i < retries - 1) {
          await this.sleep(delay * (i + 1)); // Exponential backoff
        }
      }
    }
    throw lastError;
  },
};
