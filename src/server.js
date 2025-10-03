const WebSocket = require('ws');
const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const config = require('./config');
const {
  logger,
  generateClientId,
  verifyToken,
  verifyApiKey,
  parseMessage,
  createErrorResponse,
  createSuccessResponse,
  RateLimiter,
  HeartbeatManager,
} = require('./utils');
const { createBroker } = require('./broker');
const { createInferenceBridge } = require('./inference-bridge');
const MessageRouter = require('./router');

/**
 * WebSocket API Server
 */
class WebSocketAPIServer {
  constructor() {
    this.app = express();
    this.server = http.createServer(this.app);
    this.wss = null;
    this.clients = new Map();
    this.broker = null;
    this.inferenceBridge = null;
    this.router = null;
    this.rateLimiter = null;
    this.heartbeatManager = null;
  }

  /**
   * Initialize the server
   */
  async initialize() {
    try {
      // Setup Express middleware
      this.setupExpress();

      // Initialize broker
      this.broker = createBroker();
      if (this.broker) {
        await this.broker.connect();
        await this.setupBrokerSubscriptions();
      }

      // Initialize inference bridge
      this.inferenceBridge = createInferenceBridge();
      if (this.inferenceBridge) {
        await this.inferenceBridge.connect();
      }

      // Initialize router
      this.router = new MessageRouter(this.broker, this.inferenceBridge);

      // Initialize rate limiter
      if (config.rateLimit.enabled) {
        this.rateLimiter = new RateLimiter(
          config.rateLimit.maxRequests,
          config.rateLimit.windowMs
        );
        
        // Cleanup rate limiter every minute
        setInterval(() => {
          this.rateLimiter.cleanup();
        }, 60000);
      }

      // Initialize heartbeat manager
      this.heartbeatManager = new HeartbeatManager(
        config.heartbeat.interval,
        config.heartbeat.clientTimeout
      );
      this.heartbeatManager.start();

      // Setup WebSocket server
      this.setupWebSocket();

      logger.info('Server initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize server', { error: error.message });
      throw error;
    }
  }

  /**
   * Setup Express middleware and routes
   */
  setupExpress() {
    this.app.use(cors());
    this.app.use(express.json());
    this.app.use(express.static(path.join(__dirname, '../public')));

    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        uptime: process.uptime(),
        clients: this.clients.size,
        broker: this.broker ? this.broker.connected : false,
        inference: this.inferenceBridge ? this.inferenceBridge.connected : false,
        timestamp: new Date().toISOString(),
      });
    });

    // Metrics endpoint
    this.app.get('/metrics', (req, res) => {
      const memUsage = process.memoryUsage();
      res.json({
        uptime: process.uptime(),
        connectedClients: this.clients.size,
        memory: {
          rss: `${Math.round(memUsage.rss / 1024 / 1024)} MB`,
          heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)} MB`,
          heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)} MB`,
        },
        broker: {
          enabled: !!this.broker,
          connected: this.broker ? this.broker.connected : false,
        },
        inference: {
          enabled: !!this.inferenceBridge,
          connected: this.inferenceBridge ? this.inferenceBridge.connected : false,
        },
      });
    });

    logger.info('Express middleware configured');
  }

  /**
   * Setup broker subscriptions
   */
  async setupBrokerSubscriptions() {
    if (!this.broker) return;

    // Subscribe to broadcast channel
    await this.broker.subscribe('broadcast:*', (message) => {
      try {
        const data = JSON.parse(message);
        const { type, payload } = data;

        // Broadcast to all connected clients subscribed to the channel
        for (const [clientId, client] of this.clients.entries()) {
          if (client.ws.readyState === 1) { // OPEN
            const channel = payload.channel || 'default';
            
            // Check if client is subscribed to this channel
            if (!client.subscriptions || client.subscriptions.has(channel)) {
              try {
                client.ws.send(JSON.stringify(data));
              } catch (error) {
                logger.error('Failed to send broadcast', { 
                  clientId, 
                  error: error.message 
                });
              }
            }
          }
        }
      } catch (error) {
        logger.error('Failed to process broadcast message', { 
          error: error.message 
        });
      }
    });

    logger.info('Broker subscriptions configured');
  }

  /**
   * Setup WebSocket server
   */
  setupWebSocket() {
    this.wss = new WebSocket.Server({ 
      server: this.server,
      path: '/ws',
    });

    this.wss.on('connection', (ws, req) => {
      this.handleConnection(ws, req);
    });

    this.wss.on('error', (error) => {
      logger.error('WebSocket server error', { error: error.message });
    });

    logger.info('WebSocket server configured');
  }

  /**
   * Handle new WebSocket connection
   */
  handleConnection(ws, req) {
    const clientId = generateClientId();
    const ip = req.socket.remoteAddress;

    logger.info('New connection', { clientId, ip });

    // Store client info
    this.clients.set(clientId, {
      ws,
      clientId,
      ip,
      authenticated: false,
      connectedAt: new Date().toISOString(),
      subscriptions: new Set(['default']), // Default subscription
    });

    // Register with heartbeat manager
    if (this.heartbeatManager) {
      this.heartbeatManager.register(clientId, ws);
    }

    // Send welcome message
    ws.send(createSuccessResponse('CONNECTED', {
      clientId,
      message: 'Welcome to WebSocket API Server',
      handlers: this.router.getHandlers(),
    }));

    // Handle messages
    ws.on('message', (data) => {
      this.handleMessage(ws, data, clientId);
    });

    // Handle close
    ws.on('close', (code, reason) => {
      this.handleDisconnection(clientId, code, reason);
    });

    // Handle errors
    ws.on('error', (error) => {
      logger.error('WebSocket error', { clientId, error: error.message });
    });
  }

  /**
   * Handle incoming message
   */
  async handleMessage(ws, data, clientId) {
    try {
      // Update heartbeat
      if (this.heartbeatManager) {
        this.heartbeatManager.updatePing(clientId);
      }

      // Parse message
      const message = parseMessage(data);
      if (!message) {
        ws.send(createErrorResponse(null, 'Invalid JSON format', 'PARSE_ERROR'));
        return;
      }

      const { type, payload, auth } = message;

      // Check rate limit
      if (this.rateLimiter && !this.rateLimiter.isAllowed(clientId)) {
        ws.send(createErrorResponse(type, 'Rate limit exceeded', 'RATE_LIMIT'));
        return;
      }

      // Handle authentication
      const client = this.clients.get(clientId);
      if (!client.authenticated) {
        if (auth) {
          if (auth.token) {
            const decoded = verifyToken(auth.token);
            if (decoded) {
              client.authenticated = true;
              client.authData = decoded;
              logger.info('Client authenticated with JWT', { clientId });
            }
          } else if (auth.apiKey) {
            if (verifyApiKey(auth.apiKey)) {
              client.authenticated = true;
              logger.info('Client authenticated with API key', { clientId });
            }
          }
        }

        // Allow PING without authentication
        if (!client.authenticated && type !== 'PING') {
          ws.send(createErrorResponse(type, 'Authentication required', 'AUTH_REQUIRED'));
          return;
        }
      }

      // Route message
      const response = await this.router.route(ws, message, clientId, this.clients);
      
      if (response) {
        ws.send(response);
      }
    } catch (error) {
      logger.error('Message handling error', { 
        clientId, 
        error: error.message,
        stack: error.stack 
      });
      
      ws.send(createErrorResponse(
        null,
        error.message,
        'HANDLER_ERROR'
      ));
    }
  }

  /**
   * Handle client disconnection
   */
  handleDisconnection(clientId, code, reason) {
    logger.info('Client disconnected', { 
      clientId, 
      code, 
      reason: reason.toString() 
    });

    // Unregister from heartbeat manager
    if (this.heartbeatManager) {
      this.heartbeatManager.unregister(clientId);
    }

    // Remove from clients map
    this.clients.delete(clientId);

    // Reset rate limiter
    if (this.rateLimiter) {
      this.rateLimiter.reset(clientId);
    }
  }

  /**
   * Start the server
   */
  async start() {
    try {
      await this.initialize();

      this.server.listen(config.server.port, config.server.host, () => {
        logger.info('Server started', {
          host: config.server.host,
          port: config.server.port,
          wsPath: '/ws',
          environment: config.server.nodeEnv,
        });

        console.log('╔════════════════════════════════════════════════════════════╗');
        console.log('║  WebSocket API Server                                      ║');
        console.log('╠════════════════════════════════════════════════════════════╣');
        console.log(`║  HTTP:       http://${config.server.host}:${config.server.port}             ║`);
        console.log(`║  WebSocket:  ws://${config.server.host}:${config.server.port}/ws           ║`);
        console.log(`║  Demo:       http://${config.server.host}:${config.server.port}/demo.html  ║`);
        console.log('╠════════════════════════════════════════════════════════════╣');
        console.log(`║  Broker:     ${this.broker ? '✓ Connected' : '✗ Disabled'}                       ║`);
        console.log(`║  Inference:  ${this.inferenceBridge ? '✓ Connected' : '✗ Disabled'}                       ║`);
        console.log('╚════════════════════════════════════════════════════════════╝');
      });
    } catch (error) {
      logger.error('Failed to start server', { error: error.message });
      process.exit(1);
    }
  }

  /**
   * Stop the server
   */
  async stop() {
    logger.info('Stopping server...');

    // Stop heartbeat manager
    if (this.heartbeatManager) {
      this.heartbeatManager.stop();
    }

    // Close all client connections
    for (const [clientId, client] of this.clients.entries()) {
      try {
        client.ws.close(1001, 'Server shutting down');
      } catch (error) {
        logger.error('Error closing client connection', { 
          clientId, 
          error: error.message 
        });
      }
    }

    // Close WebSocket server
    if (this.wss) {
      this.wss.close();
    }

    // Close HTTP server
    this.server.close();

    // Disconnect broker
    if (this.broker) {
      await this.broker.disconnect();
    }

    // Disconnect inference bridge
    if (this.inferenceBridge) {
      await this.inferenceBridge.disconnect();
    }

    logger.info('Server stopped');
  }
}

// Create and start server
const server = new WebSocketAPIServer();

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received');
  await server.stop();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received');
  await server.stop();
  process.exit(0);
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { 
    error: error.message, 
    stack: error.stack 
  });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection', { reason, promise });
  process.exit(1);
});

// Start the server
server.start();

module.exports = WebSocketAPIServer;
