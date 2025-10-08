import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Application Configuration
 * Centralized configuration management from environment variables
 */
const config = {
  // Server settings
  server: {
    nodeEnv: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '8080', 10),
    wsPort: parseInt(process.env.WS_PORT || '8080', 10),
    host: process.env.HOST || '0.0.0.0',
  },

  // Authentication
  auth: {
    jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
    apiKey: process.env.API_KEY || 'dev-api-key',
    tokenExpiry: '24h',
  },

  // Redis Pub/Sub
  redis: {
    enabled: process.env.REDIS_ENABLED === 'true',
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB || '0', 10),
  },

  // NATS Pub/Sub
  nats: {
    enabled: process.env.NATS_ENABLED === 'true',
    url: process.env.NATS_URL || 'nats://localhost:4222',
  },

  // Inference Bridge
  inference: {
    enabled: process.env.INFERENCE_ENABLED === 'true',
    endpoint: process.env.INFERENCE_ENDPOINT || 'http://localhost:5000/inference',
    timeout: parseInt(process.env.INFERENCE_TIMEOUT || '30000', 10),
    retries: parseInt(process.env.INFERENCE_RETRIES || '3', 10),
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    toFile: process.env.LOG_TO_FILE === 'true',
  },

  // Security
  security: {
    corsOrigin: process.env.CORS_ORIGIN || '*',
    maxConnectionsPerIp: parseInt(process.env.MAX_CONNECTIONS_PER_IP || '10', 10),
    rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
    rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
    maxMessageSize: parseInt(process.env.MAX_MESSAGE_SIZE || '102400', 10), // 100KB default
  },

  // Clustering
  cluster: {
    enabled: process.env.CLUSTER_ENABLED === 'true',
    workers: parseInt(process.env.CLUSTER_WORKERS || '4', 10),
  },
};

/**
 * Validate production configuration
 * Ensures secure defaults are not used in production
 */
function validateProductionConfig() {
  if (config.server.nodeEnv !== 'production') {
    return; // Only validate in production
  }

  const errors = [];

  // Validate JWT_SECRET
  if (!process.env.JWT_SECRET) {
    errors.push('JWT_SECRET environment variable must be set in production');
  } else if (config.auth.jwtSecret.length < 32) {
    errors.push('JWT_SECRET must be at least 32 characters in production');
  } else if (config.auth.jwtSecret.includes('dev') || config.auth.jwtSecret.includes('secret-change')) {
    errors.push('JWT_SECRET cannot use default development value in production');
  }

  // Validate API_KEY
  if (!process.env.API_KEY) {
    errors.push('API_KEY environment variable must be set in production');
  } else if (config.auth.apiKey.length < 16) {
    errors.push('API_KEY must be at least 16 characters in production');
  } else if (config.auth.apiKey.includes('dev') || config.auth.apiKey === 'dev-api-key') {
    errors.push('API_KEY cannot use default development value in production');
  }

  // Validate port configuration
  if (config.server.port < 1 || config.server.port > 65535) {
    errors.push(`PORT must be between 1 and 65535 (got ${config.server.port})`);
  }

  // Validate CORS in production
  if (config.security.corsOrigin === '*') {
    console.warn('⚠️  WARNING: CORS_ORIGIN is set to "*" in production. Consider restricting to specific origins.');
  }

  // Report errors
  if (errors.length > 0) {
    console.error('\n❌ Production configuration validation failed:\n');
    errors.forEach((error) => console.error(`   - ${error}`));
    console.error('\nPlease fix these issues before deploying to production.\n');
    process.exit(1);
  }

  console.log('✅ Production configuration validated successfully');
}

// Run validation
validateProductionConfig();

export default config;
