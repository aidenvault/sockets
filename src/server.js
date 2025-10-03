import express from 'express';
import { WebSocketServer } from 'ws';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import config from './config.js';
import { logger, auth, utils, connectionManager, rateLimiter } from './utils.js';
import router from './router.js';
import broker from './broker.js';
import inferenceBridge from './inference-bridge.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * WebSocket API Server
 * Production-ready real-time messaging and inference orchestration server
 */
class WebSocketAPIServer {
  constructor() {
    this.app = express();
    this.server = http.createServer(this.app);
    this.wss = null;
    this.isShuttingDown = false;
  }

  /**
   * Initialize server components
   */
  async initialize() {
    logger.info('Initializing WebSocket API Server...', {
      nodeVersion: process.version,
      environment: config.server.nodeEnv,
      port: config.server.port,
    });

    // Initialize broker connection
    try {
      await broker.connect();
    } catch (error) {
      logger.warn('Failed to connect to broker, continuing without it', {
        error: error.message,
      });
    }

    // Initialize inference bridge
    try {
      await inferenceBridge.initialize();
    } catch (error) {
      logger.warn('Failed to initialize inference bridge', {
        error: error.message,
      });
    }

    // Setup HTTP server
    this.setupHttpServer();

    // Setup WebSocket server
    this.setupWebSocketServer();

    // Setup broker subscriptions
    this.setupBrokerSubscriptions();

    // Setup graceful shutdown
    this.setupGracefulShutdown();

    logger.info('Server initialization complete');
  }

  /**
   * Setup HTTP server and routes
   */
  setupHttpServer() {
    // Middleware
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));

    // CORS
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', config.security.corsOrigin);
      res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
      
      if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
      }
      next();
    });

    // Serve static demo files
    this.app.use('/demo', express.static(path.join(__dirname, '../public')));

    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: Date.now(),
        uptime: process.uptime(),
        connections: connectionManager.connections.size,
        broker: {
          connected: broker.isConnected(),
          type: broker.getType(),
        },
      });
    });

    // API endpoint to generate auth token
    this.app.post('/api/auth/token', (req, res) => {
      const { userId, apiKey } = req.body;

      if (!apiKey || !auth.verifyApiKey(apiKey)) {
        return res.status(401).json({ error: 'Invalid API key' });
      }

      const token = auth.generateToken({ userId: userId || utils.generateId() });
      res.json({ token });
    });

    // Stats endpoint
    this.app.get('/api/stats', (req, res) => {
      res.json({
        connections: connectionManager.connections.size,
        inference: inferenceBridge.getStats(),
        broker: {
          connected: broker.isConnected(),
          type: broker.getType(),
        },
        uptime: process.uptime(),
        memory: process.memoryUsage(),
      });
    });

    // Serve demo page as default
    this.app.get('/', (req, res) => {
      res.redirect('/demo/demo.html');
    });

    logger.info('HTTP server routes configured');
  }

  /**
   * Setup WebSocket server
   */
  setupWebSocketServer() {
    this.wss = new WebSocketServer({
      server: this.server,
      path: '/ws',
    });

    // Handle WebSocket connections
    this.wss.on('connection', (ws, request) => {
      this.handleConnection(ws, request);
    });

    this.wss.on('error', (error) => {
      logger.error('WebSocket server error', { error: error.message });
    });

    logger.info('WebSocket server configured');
  }

  /**
   * Handle new WebSocket connection
   * @param {Object} ws - WebSocket connection
   * @param {Object} request - HTTP upgrade request
   */
  async handleConnection(ws, request) {
    const clientIp = utils.getClientIp(request);
    const clientId = utils.generateId();

    logger.info('New connection attempt', { clientId, ip: clientIp });

    // Rate limiting
    if (!rateLimiter.checkLimit(clientIp)) {
      logger.warn('Rate limit exceeded', { ip: clientIp });
      ws.close(1008, 'Rate limit exceeded');
      return;
    }

    // Authentication
    const token = auth.extractToken(request);
    let authPayload = null;

    if (token) {
      authPayload = auth.verifyToken(token);
      if (!authPayload) {
        logger.warn('Invalid token', { clientId, ip: clientIp });
        ws.close(1008, 'Invalid token');
        return;
      }
    } else if (config.server.nodeEnv === 'production') {
      // In production, require authentication
      logger.warn('No token provided', { clientId, ip: clientIp });
      ws.close(1008, 'Authentication required');
      return;
    }

    // Add connection
    const added = connectionManager.addConnection(clientId, ws, clientIp, {
      authPayload,
      connectedAt: Date.now(),
      channels: new Set(),
    });

    if (!added) {
      logger.warn('Connection rejected (max connections reached)', { ip: clientIp });
      ws.close(1008, 'Max connections per IP exceeded');
      return;
    }

    // Send connection acknowledgment
    ws.send(JSON.stringify({
      type: 'CONNECTED',
      payload: {
        clientId,
        timestamp: Date.now(),
        serverVersion: '1.0.0',
      },
    }));

    // Setup message handler
    ws.on('message', async (data) => {
      try {
        const message = utils.parseJSON(data.toString());
        if (!message) {
          ws.send(JSON.stringify({
            type: 'ERROR',
            payload: { error: 'Invalid JSON' },
          }));
          return;
        }

        await router.route(clientId, message, ws);
      } catch (error) {
        logger.error('Message handling error', {
          clientId,
          error: error.message,
        });
        ws.send(JSON.stringify({
          type: 'ERROR',
          payload: { error: 'Internal server error' },
        }));
      }
    });

    // Setup error handler
    ws.on('error', (error) => {
      logger.error('WebSocket error', { clientId, error: error.message });
    });

    // Setup close handler
    ws.on('close', (code, reason) => {
      logger.info('Connection closed', {
        clientId,
        code,
        reason: reason.toString(),
      });
      connectionManager.removeConnection(clientId);
    });

    // Send periodic ping
    const pingInterval = setInterval(() => {
      if (ws.readyState === 1) {
        ws.send(JSON.stringify({ type: 'PING' }));
      } else {
        clearInterval(pingInterval);
      }
    }, 30000);

    logger.info('Connection established', {
      clientId,
      ip: clientIp,
      authenticated: !!authPayload,
    });
  }

  /**
   * Setup broker subscriptions for multi-instance scaling
   */
  setupBrokerSubscriptions() {
    if (!broker.isConnected()) {
      return;
    }

    // Subscribe to broadcast channel
    broker.subscribe('broadcast', (message) => {
      connectionManager.broadcast({
        type: 'BROADCAST',
        payload: message,
      });
    });

    logger.info('Broker subscriptions configured');
  }

  /**
   * Setup graceful shutdown handlers
   */
  setupGracefulShutdown() {
    const shutdown = async (signal) => {
      if (this.isShuttingDown) {
        return;
      }

      this.isShuttingDown = true;
      logger.info(`Received ${signal}, starting graceful shutdown...`);

      // Close WebSocket server (stop accepting new connections)
      this.wss.close(() => {
        logger.info('WebSocket server closed');
      });

      // Close existing connections
      for (const [clientId, { ws }] of connectionManager.connections.entries()) {
        ws.close(1001, 'Server shutting down');
      }

      // Disconnect from broker
      await broker.disconnect();

      // Cancel pending inference requests
      inferenceBridge.cancelAllRequests();

      // Close HTTP server
      this.server.close(() => {
        logger.info('HTTP server closed');
        process.exit(0);
      });

      // Force exit after 10 seconds
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception', { error: error.message, stack: error.stack });
      shutdown('uncaughtException');
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled rejection', { reason, promise });
    });

    logger.info('Graceful shutdown handlers configured');
  }

  /**
   * Start the server
   */
  async start() {
    await this.initialize();

    this.server.listen(config.server.port, config.server.host, () => {
      logger.info('Server started', {
        host: config.server.host,
        port: config.server.port,
        wsPath: '/ws',
        demoUrl: `http://localhost:${config.server.port}/demo/demo.html`,
      });
      
      console.log('\n' + '='.repeat(60));
      console.log('🚀 WebSocket API Server is running!');
      console.log('='.repeat(60));
      console.log(`📡 WebSocket endpoint: ws://localhost:${config.server.port}/ws`);
      console.log(`🌐 Demo interface: http://localhost:${config.server.port}/demo/demo.html`);
      console.log(`❤️  Health check: http://localhost:${config.server.port}/health`);
      console.log(`📊 Stats endpoint: http://localhost:${config.server.port}/api/stats`);
      console.log('='.repeat(60) + '\n');
    });
  }
}

// Start server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new WebSocketAPIServer();
  server.start().catch((error) => {
    logger.error('Failed to start server', { error: error.message, stack: error.stack });
    process.exit(1);
  });
}

export default WebSocketAPIServer;
