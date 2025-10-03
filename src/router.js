const { logger, createErrorResponse, createSuccessResponse } = require('./utils');

/**
 * Message Router
 * Routes incoming WebSocket messages to appropriate handlers
 */
class MessageRouter {
  constructor(broker, inferenceBridge) {
    this.broker = broker;
    this.inferenceBridge = inferenceBridge;
    this.handlers = new Map();
    this.registerDefaultHandlers();
  }

  /**
   * Register default message handlers
   */
  registerDefaultHandlers() {
    // PING handler
    this.register('PING', async (ws, payload, clientId) => {
      return createSuccessResponse('PONG', {
        timestamp: new Date().toISOString(),
        clientId,
      });
    });

    // ECHO handler
    this.register('ECHO', async (ws, payload, clientId) => {
      return createSuccessResponse('ECHO_RESPONSE', {
        echo: payload,
        clientId,
      });
    });

    // BROADCAST handler
    this.register('BROADCAST', async (ws, payload, clientId, clients) => {
      const message = payload.message || '';
      const channel = payload.channel || 'default';

      // If broker is available, publish to broker
      if (this.broker && this.broker.connected) {
        await this.broker.publish(`broadcast:${channel}`, JSON.stringify({
          type: 'BROADCAST_MESSAGE',
          payload: {
            message,
            channel,
            from: clientId,
            timestamp: new Date().toISOString(),
          },
        }));
      } else {
        // Otherwise, broadcast to local clients only
        const broadcastMessage = createSuccessResponse('BROADCAST_MESSAGE', {
          message,
          channel,
          from: clientId,
          timestamp: new Date().toISOString(),
        });

        for (const [cId, client] of clients.entries()) {
          if (cId !== clientId && client.ws.readyState === 1) { // OPEN
            try {
              client.ws.send(broadcastMessage);
            } catch (error) {
              logger.error('Failed to broadcast to client', { 
                clientId: cId, 
                error: error.message 
              });
            }
          }
        }
      }

      return createSuccessResponse('BROADCAST_SENT', {
        channel,
        message,
      });
    });

    // INFERENCE_REQUEST handler
    this.register('INFERENCE_REQUEST', async (ws, payload, clientId) => {
      if (!this.inferenceBridge || !this.inferenceBridge.connected) {
        throw new Error('Inference service not available');
      }

      const input = payload.input || '';
      const options = payload.options || {};

      logger.info('Processing inference request', { 
        clientId, 
        inputLength: input.length 
      });

      const result = await this.inferenceBridge.inference(input, options);

      return createSuccessResponse('INFERENCE_RESPONSE', {
        result,
        requestId: payload.requestId,
      });
    });

    // SUBSCRIBE handler
    this.register('SUBSCRIBE', async (ws, payload, clientId, clients) => {
      const channel = payload.channel || 'default';
      
      // Store subscription info in client metadata
      const client = clients.get(clientId);
      if (client) {
        if (!client.subscriptions) {
          client.subscriptions = new Set();
        }
        client.subscriptions.add(channel);
      }

      logger.info('Client subscribed', { clientId, channel });

      return createSuccessResponse('SUBSCRIBED', {
        channel,
      });
    });

    // UNSUBSCRIBE handler
    this.register('UNSUBSCRIBE', async (ws, payload, clientId, clients) => {
      const channel = payload.channel || 'default';
      
      const client = clients.get(clientId);
      if (client && client.subscriptions) {
        client.subscriptions.delete(channel);
      }

      logger.info('Client unsubscribed', { clientId, channel });

      return createSuccessResponse('UNSUBSCRIBED', {
        channel,
      });
    });

    // GET_STATUS handler
    this.register('GET_STATUS', async (ws, payload, clientId, clients) => {
      return createSuccessResponse('STATUS', {
        clientId,
        connectedClients: clients.size,
        brokerConnected: this.broker ? this.broker.connected : false,
        inferenceConnected: this.inferenceBridge ? this.inferenceBridge.connected : false,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
      });
    });

    // LIST_CLIENTS handler
    this.register('LIST_CLIENTS', async (ws, payload, clientId, clients) => {
      const clientList = Array.from(clients.entries()).map(([id, client]) => ({
        clientId: id,
        authenticated: client.authenticated,
        connectedAt: client.connectedAt,
        subscriptions: client.subscriptions ? Array.from(client.subscriptions) : [],
      }));

      return createSuccessResponse('CLIENT_LIST', {
        clients: clientList,
      });
    });

    // DIRECT_MESSAGE handler
    this.register('DIRECT_MESSAGE', async (ws, payload, clientId, clients) => {
      const targetClientId = payload.targetClientId;
      const message = payload.message;

      if (!targetClientId) {
        throw new Error('Target client ID required');
      }

      const targetClient = clients.get(targetClientId);
      if (!targetClient) {
        throw new Error('Target client not found');
      }

      if (targetClient.ws.readyState !== 1) { // OPEN
        throw new Error('Target client not connected');
      }

      const directMessage = createSuccessResponse('DIRECT_MESSAGE_RECEIVED', {
        from: clientId,
        message,
        timestamp: new Date().toISOString(),
      });

      targetClient.ws.send(directMessage);

      return createSuccessResponse('DIRECT_MESSAGE_SENT', {
        targetClientId,
      });
    });
  }

  /**
   * Register a message handler
   */
  register(type, handler) {
    this.handlers.set(type, handler);
    logger.debug('Registered handler', { type });
  }

  /**
   * Unregister a message handler
   */
  unregister(type) {
    this.handlers.delete(type);
    logger.debug('Unregistered handler', { type });
  }

  /**
   * Route a message to the appropriate handler
   */
  async route(ws, message, clientId, clients) {
    const { type, payload } = message;

    if (!type) {
      throw new Error('Message type required');
    }

    const handler = this.handlers.get(type);
    
    if (!handler) {
      throw new Error(`Unknown message type: ${type}`);
    }

    try {
      logger.info('Routing message', { type, clientId });
      const response = await handler(ws, payload, clientId, clients);
      return response;
    } catch (error) {
      logger.error('Handler error', { 
        type, 
        clientId, 
        error: error.message,
        stack: error.stack 
      });
      throw error;
    }
  }

  /**
   * Get all registered handlers
   */
  getHandlers() {
    return Array.from(this.handlers.keys());
  }
}

module.exports = MessageRouter;
