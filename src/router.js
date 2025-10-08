import { logger, utils, connectionManager } from './utils.js';
import inferenceBridge from './inference-bridge.js';
import broker from './broker.js';
import { validateMessage, validatePayload } from './validation.js';

/**
 * Message Router
 * Routes incoming WebSocket messages to appropriate handlers
 */
class MessageRouter {
  constructor() {
    this.handlers = new Map();
    this.registerDefaultHandlers();
  }

  /**
   * Register default message handlers
   */
  registerDefaultHandlers() {
    // Ping/Pong
    this.register('PING', this.handlePing.bind(this));
    this.register('PONG', this.handlePong.bind(this));

    // Connection management
    this.register('SUBSCRIBE', this.handleSubscribe.bind(this));
    this.register('UNSUBSCRIBE', this.handleUnsubscribe.bind(this));

    // Messaging
    this.register('BROADCAST', this.handleBroadcast.bind(this));
    this.register('DIRECT_MESSAGE', this.handleDirectMessage.bind(this));
    this.register('ROOM_MESSAGE', this.handleRoomMessage.bind(this));

    // Inference
    this.register('INFERENCE_REQUEST', this.handleInferenceRequest.bind(this));
    this.register('INFERENCE_STREAM', this.handleInferenceStream.bind(this));
    this.register('INFERENCE_CANCEL', this.handleInferenceCancel.bind(this));

    // System
    this.register('GET_STATS', this.handleGetStats.bind(this));
    this.register('GET_CONNECTIONS', this.handleGetConnections.bind(this));

    logger.info('Default message handlers registered');
  }

  /**
   * Register a message handler
   * @param {string} type - Message type
   * @param {Function} handler - Handler function
   */
  register(type, handler) {
    this.handlers.set(type, handler);
    logger.debug('Handler registered', { type });
  }

  /**
   * Route incoming message to appropriate handler
   * @param {string} clientId - Client identifier
   * @param {Object} message - Parsed message object
   * @param {Object} ws - WebSocket connection
   */
  async route(clientId, message, ws) {
    const { type, payload = {}, requestId } = message;

    // Validate message structure
    const messageValidation = validateMessage(message);
    if (!messageValidation.valid) {
      return this.sendError(
        ws,
        requestId,
        `Invalid message structure: ${messageValidation.errors.join(', ')}`
      );
    }

    if (!type) {
      return this.sendError(ws, requestId, 'Message type is required');
    }

    const handler = this.handlers.get(type);
    if (!handler) {
      return this.sendError(ws, requestId, `Unknown message type: ${type}`);
    }

    // Validate payload for this message type
    const payloadValidation = validatePayload(type, payload);
    if (!payloadValidation.valid) {
      return this.sendError(
        ws,
        requestId,
        `Invalid payload: ${payloadValidation.errors.join(', ')}`
      );
    }

    try {
      logger.debug('Routing message', { clientId, type, requestId });
      await handler(clientId, payload, ws, requestId);
    } catch (error) {
      logger.error('Handler error', { clientId, type, error: error.message });
      this.sendError(ws, requestId, error.message);
    }
  }

  /**
   * Send response to client
   * @param {Object} ws - WebSocket connection
   * @param {string} type - Response type
   * @param {Object} payload - Response payload
   * @param {string} requestId - Original request ID
   */
  sendResponse(ws, type, payload, requestId = null) {
    const response = {
      type,
      payload,
      timestamp: Date.now(),
    };

    if (requestId) {
      response.requestId = requestId;
    }

    try {
      ws.send(JSON.stringify(response));
    } catch (error) {
      logger.error('Failed to send response', { error: error.message });
    }
  }

  /**
   * Send error response
   * @param {Object} ws - WebSocket connection
   * @param {string} requestId - Request ID
   * @param {string} errorMessage - Error message
   */
  sendError(ws, requestId, errorMessage) {
    this.sendResponse(ws, 'ERROR', { error: errorMessage }, requestId);
  }

  // ==================== Message Handlers ====================

  /**
   * Handle PING message
   */
  async handlePing(clientId, payload, ws, requestId) {
    this.sendResponse(ws, 'PONG', { timestamp: Date.now() }, requestId);
  }

  /**
   * Handle PONG message
   */
  async handlePong(clientId, payload, ws, requestId) {
    logger.debug('PONG received', { clientId });
  }

  /**
   * Handle SUBSCRIBE message (join a room/channel)
   */
  async handleSubscribe(clientId, payload, ws, requestId) {
    const { channel } = payload;

    if (!channel) {
      return this.sendError(ws, requestId, 'Channel is required');
    }

    const connection = connectionManager.getConnection(clientId);
    if (!connection) {
      return this.sendError(ws, requestId, 'Connection not found');
    }

    // Add channel to connection metadata
    if (!connection.metadata.channels) {
      connection.metadata.channels = new Set();
    }
    connection.metadata.channels.add(channel);

    logger.info('Client subscribed to channel', { clientId, channel });

    this.sendResponse(ws, 'SUBSCRIBED', { channel }, requestId);

    // Notify others in the channel
    this.broadcastToChannel(channel, {
      type: 'USER_JOINED',
      payload: { clientId, channel },
    }, clientId);
  }

  /**
   * Handle UNSUBSCRIBE message (leave a room/channel)
   */
  async handleUnsubscribe(clientId, payload, ws, requestId) {
    const { channel } = payload;

    if (!channel) {
      return this.sendError(ws, requestId, 'Channel is required');
    }

    const connection = connectionManager.getConnection(clientId);
    if (!connection || !connection.metadata.channels) {
      return this.sendError(ws, requestId, 'Not subscribed to channel');
    }

    connection.metadata.channels.delete(channel);

    logger.info('Client unsubscribed from channel', { clientId, channel });

    this.sendResponse(ws, 'UNSUBSCRIBED', { channel }, requestId);

    // Notify others in the channel
    this.broadcastToChannel(channel, {
      type: 'USER_LEFT',
      payload: { clientId, channel },
    }, clientId);
  }

  /**
   * Handle BROADCAST message (send to all connected clients)
   */
  async handleBroadcast(clientId, payload, ws, requestId) {
    const { message } = payload;

    if (!message) {
      return this.sendError(ws, requestId, 'Message is required');
    }

    logger.info('Broadcasting message', { clientId, messageLength: message.length });

    connectionManager.broadcast(
      {
        type: 'BROADCAST',
        payload: {
          from: clientId,
          message,
          timestamp: Date.now(),
        },
      },
      clientId
    );

    // Publish to broker for multi-instance scaling
    if (broker.isConnected()) {
      await broker.publish('broadcast', {
        from: clientId,
        message,
        timestamp: Date.now(),
      });
    }

    this.sendResponse(ws, 'BROADCAST_SENT', { recipients: connectionManager.connections.size - 1 }, requestId);
  }

  /**
   * Handle DIRECT_MESSAGE (send to specific client)
   */
  async handleDirectMessage(clientId, payload, ws, requestId) {
    const { targetClientId, message } = payload;

    if (!targetClientId || !message) {
      return this.sendError(ws, requestId, 'targetClientId and message are required');
    }

    const targetConnection = connectionManager.getConnection(targetClientId);
    if (!targetConnection) {
      return this.sendError(ws, requestId, 'Target client not found');
    }

    logger.info('Sending direct message', { from: clientId, to: targetClientId });

    this.sendResponse(targetConnection.ws, 'DIRECT_MESSAGE', {
      from: clientId,
      message,
      timestamp: Date.now(),
    });

    this.sendResponse(ws, 'DIRECT_MESSAGE_SENT', { targetClientId }, requestId);
  }

  /**
   * Handle ROOM_MESSAGE (send to all clients in a room/channel)
   */
  async handleRoomMessage(clientId, payload, ws, requestId) {
    const { channel, message } = payload;

    if (!channel || !message) {
      return this.sendError(ws, requestId, 'channel and message are required');
    }

    logger.info('Sending room message', { clientId, channel });

    this.broadcastToChannel(channel, {
      type: 'ROOM_MESSAGE',
      payload: {
        from: clientId,
        channel,
        message,
        timestamp: Date.now(),
      },
    }, clientId);

    this.sendResponse(ws, 'ROOM_MESSAGE_SENT', { channel }, requestId);
  }

  /**
   * Handle INFERENCE_REQUEST
   */
  async handleInferenceRequest(clientId, payload, ws, requestId) {
    const { input, model, endpoint = 'default' } = payload;

    if (!input) {
      return this.sendError(ws, requestId, 'input is required');
    }

    logger.info('Processing inference request', { clientId, requestId, model, endpoint });

    try {
      const result = await inferenceBridge.processInferenceRequest(
        requestId || utils.generateId(),
        { input, model },
        endpoint
      );

      this.sendResponse(ws, 'INFERENCE_RESPONSE', result, requestId);
    } catch (error) {
      this.sendError(ws, requestId, `Inference failed: ${error.message}`);
    }
  }

  /**
   * Handle INFERENCE_STREAM (streaming inference)
   */
  async handleInferenceStream(clientId, payload, ws, requestId) {
    const { input, model, endpoint = 'default' } = payload;

    if (!input) {
      return this.sendError(ws, requestId, 'input is required');
    }

    logger.info('Processing streaming inference request', { clientId, requestId, model, endpoint });

    try {
      await inferenceBridge.streamInferenceRequest(
        requestId || utils.generateId(),
        { input, model },
        (chunk) => {
          this.sendResponse(ws, 'INFERENCE_CHUNK', chunk, requestId);
        },
        endpoint
      );

      this.sendResponse(ws, 'INFERENCE_STREAM_END', {}, requestId);
    } catch (error) {
      this.sendError(ws, requestId, `Streaming inference failed: ${error.message}`);
    }
  }

  /**
   * Handle INFERENCE_CANCEL
   */
  async handleInferenceCancel(clientId, payload, ws, requestId) {
    const { inferenceRequestId } = payload;

    if (!inferenceRequestId) {
      return this.sendError(ws, requestId, 'inferenceRequestId is required');
    }

    inferenceBridge.cancelRequest(inferenceRequestId);
    this.sendResponse(ws, 'INFERENCE_CANCELLED', { inferenceRequestId }, requestId);
  }

  /**
   * Handle GET_STATS
   */
  async handleGetStats(clientId, payload, ws, requestId) {
    const stats = {
      connections: connectionManager.connections.size,
      inference: inferenceBridge.getStats(),
      broker: {
        connected: broker.isConnected(),
        type: broker.getType(),
      },
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    };

    this.sendResponse(ws, 'STATS', stats, requestId);
  }

  /**
   * Handle GET_CONNECTIONS
   */
  async handleGetConnections(clientId, payload, ws, requestId) {
    const connections = connectionManager.getAllConnections();
    this.sendResponse(ws, 'CONNECTIONS', { connections }, requestId);
  }

  /**
   * Broadcast message to all clients in a channel
   * @param {string} channel - Channel name
   * @param {Object} message - Message to send
   * @param {string} excludeClientId - Client to exclude
   */
  broadcastToChannel(channel, message, excludeClientId = null) {
    let sent = 0;

    for (const [clientId, connection] of connectionManager.connections.entries()) {
      if (clientId === excludeClientId) continue;

      const channels = connection.metadata.channels;
      if (channels && channels.has(channel)) {
        try {
          connection.ws.send(JSON.stringify(message));
          sent++;
        } catch (error) {
          logger.error('Failed to send to channel member', { clientId, error: error.message });
        }
      }
    }

    logger.debug('Channel broadcast sent', { channel, recipients: sent });
  }
}

// Singleton instance
const router = new MessageRouter();

export default router;
