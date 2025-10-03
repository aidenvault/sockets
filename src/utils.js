const winston = require('winston');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const config = require('./config');
const fs = require('fs');
const path = require('path');

// Ensure logs directory exists
const logsDir = path.dirname(config.logging.file);
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Logger setup
const logger = winston.createLogger({
  level: config.logging.level,
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { service: 'websocket-api-server' },
  transports: [
    new winston.transports.File({ filename: config.logging.file }),
    new winston.transports.File({ 
      filename: path.join(logsDir, 'error.log'), 
      level: 'error' 
    }),
  ],
});

// Console transport for non-production
if (config.server.nodeEnv !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    ),
  }));
}

/**
 * Generate a unique client ID
 */
function generateClientId() {
  return uuidv4();
}

/**
 * Verify JWT token
 */
function verifyToken(token) {
  try {
    return jwt.verify(token, config.auth.jwtSecret);
  } catch (error) {
    logger.error('Token verification failed', { error: error.message });
    return null;
  }
}

/**
 * Generate JWT token
 */
function generateToken(payload, expiresIn = '24h') {
  return jwt.sign(payload, config.auth.jwtSecret, { expiresIn });
}

/**
 * Verify API key
 */
function verifyApiKey(apiKey) {
  return apiKey === config.auth.apiKey;
}

/**
 * Parse WebSocket message
 */
function parseMessage(data) {
  try {
    return JSON.parse(data);
  } catch (error) {
    logger.error('Failed to parse message', { data, error: error.message });
    return null;
  }
}

/**
 * Create error response
 */
function createErrorResponse(type, message, code = 'ERROR') {
  return JSON.stringify({
    type: 'ERROR',
    error: {
      code,
      message,
      originalType: type,
    },
    timestamp: new Date().toISOString(),
  });
}

/**
 * Create success response
 */
function createSuccessResponse(type, payload = {}) {
  return JSON.stringify({
    type,
    payload,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Retry with exponential backoff
 */
async function retryWithBackoff(fn, maxAttempts, delay) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      logger.warn(`Attempt ${attempt} failed`, { error: error.message });
      
      if (attempt < maxAttempts) {
        const backoffDelay = delay * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, backoffDelay));
      }
    }
  }
  
  throw lastError;
}

/**
 * Rate limiter (in-memory)
 */
class RateLimiter {
  constructor(maxRequests, windowMs) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.clients = new Map();
  }

  isAllowed(clientId) {
    const now = Date.now();
    const clientData = this.clients.get(clientId) || { count: 0, resetTime: now + this.windowMs };

    // Reset if window has passed
    if (now > clientData.resetTime) {
      clientData.count = 0;
      clientData.resetTime = now + this.windowMs;
    }

    // Check if limit exceeded
    if (clientData.count >= this.maxRequests) {
      return false;
    }

    clientData.count++;
    this.clients.set(clientId, clientData);
    return true;
  }

  reset(clientId) {
    this.clients.delete(clientId);
  }

  cleanup() {
    const now = Date.now();
    for (const [clientId, data] of this.clients.entries()) {
      if (now > data.resetTime) {
        this.clients.delete(clientId);
      }
    }
  }
}

/**
 * Heartbeat manager
 */
class HeartbeatManager {
  constructor(interval, timeout) {
    this.interval = interval;
    this.timeout = timeout;
    this.clients = new Map();
    this.timer = null;
  }

  start() {
    this.timer = setInterval(() => {
      this.checkClients();
    }, this.interval);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  register(clientId, ws) {
    this.clients.set(clientId, {
      ws,
      lastPing: Date.now(),
    });
  }

  unregister(clientId) {
    this.clients.delete(clientId);
  }

  updatePing(clientId) {
    const client = this.clients.get(clientId);
    if (client) {
      client.lastPing = Date.now();
    }
  }

  checkClients() {
    const now = Date.now();
    
    for (const [clientId, client] of this.clients.entries()) {
      const timeSinceLastPing = now - client.lastPing;
      
      if (timeSinceLastPing > this.timeout) {
        logger.warn('Client timeout', { clientId, timeSinceLastPing });
        client.ws.close(1000, 'Timeout');
        this.unregister(clientId);
      } else {
        // Send ping
        try {
          client.ws.send(createSuccessResponse('PING', { timestamp: now }));
        } catch (error) {
          logger.error('Failed to send ping', { clientId, error: error.message });
        }
      }
    }
  }
}

module.exports = {
  logger,
  generateClientId,
  verifyToken,
  generateToken,
  verifyApiKey,
  parseMessage,
  createErrorResponse,
  createSuccessResponse,
  retryWithBackoff,
  RateLimiter,
  HeartbeatManager,
};
