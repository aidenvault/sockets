require('dotenv').config();

const config = {
  // Server settings
  server: {
    nodeEnv: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT, 10) || 8080,
    wsPort: parseInt(process.env.WS_PORT, 10) || 8081,
    host: process.env.HOST || '0.0.0.0',
  },

  // Authentication
  auth: {
    jwtSecret: process.env.JWT_SECRET || 'default-secret-change-in-production',
    apiKey: process.env.API_KEY || 'default-api-key',
  },

  // Redis configuration
  redis: {
    enabled: process.env.REDIS_ENABLED === 'true',
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
    password: process.env.REDIS_PASSWORD || '',
    db: parseInt(process.env.REDIS_DB, 10) || 0,
  },

  // NATS configuration
  nats: {
    enabled: process.env.NATS_ENABLED === 'true',
    url: process.env.NATS_URL || 'nats://localhost:4222',
  },

  // Inference configuration
  inference: {
    enabled: process.env.INFERENCE_ENABLED === 'true',
    mode: process.env.INFERENCE_MODE || 'rest', // rest, grpc, websocket
    rest: {
      url: process.env.INFERENCE_REST_URL || 'http://localhost:5000/inference',
    },
    grpc: {
      host: process.env.INFERENCE_GRPC_HOST || 'localhost',
      port: parseInt(process.env.INFERENCE_GRPC_PORT, 10) || 50051,
    },
    websocket: {
      url: process.env.INFERENCE_WS_URL || 'ws://localhost:5001',
    },
    timeout: parseInt(process.env.INFERENCE_TIMEOUT, 10) || 30000,
    retryAttempts: parseInt(process.env.INFERENCE_RETRY_ATTEMPTS, 10) || 3,
    retryDelay: parseInt(process.env.INFERENCE_RETRY_DELAY, 10) || 1000,
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE || './logs/app.log',
  },

  // Clustering
  clustering: {
    enabled: process.env.CLUSTER_ENABLED === 'true',
    workers: parseInt(process.env.CLUSTER_WORKERS, 10) || 4,
  },

  // Rate limiting
  rateLimit: {
    enabled: process.env.RATE_LIMIT_ENABLED === 'true',
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100,
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 60000,
  },

  // Heartbeat
  heartbeat: {
    interval: parseInt(process.env.HEARTBEAT_INTERVAL, 10) || 30000,
    clientTimeout: parseInt(process.env.CLIENT_TIMEOUT, 10) || 60000,
  },
};

// Validation
if (config.server.nodeEnv === 'production') {
  if (config.auth.jwtSecret === 'default-secret-change-in-production') {
    console.warn('⚠️  WARNING: Using default JWT secret in production!');
  }
  if (config.auth.apiKey === 'default-api-key') {
    console.warn('⚠️  WARNING: Using default API key in production!');
  }
}

module.exports = config;
