const axios = require('axios');
const WebSocket = require('ws');
const config = require('./config');
const { logger, retryWithBackoff } = require('./utils');

/**
 * Abstract Inference Bridge
 */
class InferenceBridge {
  constructor() {
    this.connected = false;
  }

  async connect() {
    throw new Error('Method not implemented');
  }

  async disconnect() {
    throw new Error('Method not implemented');
  }

  async inference(input, options = {}) {
    throw new Error('Method not implemented');
  }
}

/**
 * REST Inference Bridge
 */
class RESTInferenceBridge extends InferenceBridge {
  constructor() {
    super();
    this.client = null;
  }

  async connect() {
    this.client = axios.create({
      baseURL: config.inference.rest.url,
      timeout: config.inference.timeout,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Test connection
    try {
      await retryWithBackoff(
        async () => {
          // Try to reach the inference endpoint
          // This is optional - just marks as connected
          this.connected = true;
        },
        1,
        0
      );
      logger.info('REST inference bridge initialized', { 
        url: config.inference.rest.url 
      });
    } catch (error) {
      logger.warn('REST inference endpoint not reachable yet', { 
        url: config.inference.rest.url,
        error: error.message 
      });
      this.connected = true; // Still mark as connected for lazy initialization
    }
  }

  async disconnect() {
    this.connected = false;
    logger.info('REST inference bridge disconnected');
  }

  async inference(input, options = {}) {
    if (!this.connected) {
      throw new Error('Inference bridge not connected');
    }

    try {
      const response = await retryWithBackoff(
        async () => {
          const result = await this.client.post('', {
            input,
            options,
          });
          return result.data;
        },
        config.inference.retryAttempts,
        config.inference.retryDelay
      );

      logger.info('Inference completed', { 
        inputLength: input.length,
        hasResult: !!response 
      });

      return response;
    } catch (error) {
      logger.error('Inference request failed', { 
        error: error.message,
        input: input.substring(0, 100) 
      });
      throw error;
    }
  }
}

/**
 * gRPC Inference Bridge (Stub - requires proto definitions)
 */
class GRPCInferenceBridge extends InferenceBridge {
  constructor() {
    super();
    this.client = null;
  }

  async connect() {
    // In a real implementation, you would:
    // 1. Load proto definitions
    // 2. Create gRPC client
    // 3. Establish connection
    
    logger.info('gRPC inference bridge initialized (STUB)', {
      host: config.inference.grpc.host,
      port: config.inference.grpc.port,
    });

    // For demonstration purposes, mark as connected
    this.connected = true;
  }

  async disconnect() {
    // Close gRPC connection
    this.connected = false;
    logger.info('gRPC inference bridge disconnected');
  }

  async inference(input, options = {}) {
    if (!this.connected) {
      throw new Error('Inference bridge not connected');
    }

    // Stub implementation - return mock response
    logger.warn('gRPC inference called (STUB implementation)');
    
    return {
      result: `gRPC inference result for: ${input.substring(0, 50)}...`,
      mode: 'grpc',
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * WebSocket Inference Bridge
 */
class WebSocketInferenceBridge extends InferenceBridge {
  constructor() {
    super();
    this.ws = null;
    this.pendingRequests = new Map();
    this.reconnectTimer = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
  }

  async connect() {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(config.inference.websocket.url);

        this.ws.on('open', () => {
          this.connected = true;
          this.reconnectAttempts = 0;
          logger.info('WebSocket inference bridge connected', {
            url: config.inference.websocket.url,
          });
          resolve();
        });

        this.ws.on('message', (data) => {
          this.handleMessage(data);
        });

        this.ws.on('error', (error) => {
          logger.error('WebSocket inference error', { error: error.message });
          if (!this.connected) {
            reject(error);
          }
        });

        this.ws.on('close', () => {
          this.connected = false;
          logger.warn('WebSocket inference bridge disconnected');
          this.attemptReconnect();
        });
      } catch (error) {
        logger.error('Failed to create WebSocket inference bridge', { 
          error: error.message 
        });
        reject(error);
      }
    });
  }

  attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error('Max reconnection attempts reached for inference bridge');
      return;
    }

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;

    logger.info('Attempting to reconnect inference bridge', {
      attempt: this.reconnectAttempts,
      delay,
    });

    this.reconnectTimer = setTimeout(() => {
      this.connect().catch((error) => {
        logger.error('Reconnection attempt failed', { error: error.message });
      });
    }, delay);
  }

  handleMessage(data) {
    try {
      const message = JSON.parse(data.toString());
      
      if (message.requestId && this.pendingRequests.has(message.requestId)) {
        const { resolve, reject } = this.pendingRequests.get(message.requestId);
        
        if (message.error) {
          reject(new Error(message.error));
        } else {
          resolve(message.result);
        }
        
        this.pendingRequests.delete(message.requestId);
      }
    } catch (error) {
      logger.error('Failed to handle inference response', { 
        error: error.message 
      });
    }
  }

  async disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    // Reject all pending requests
    for (const [requestId, { reject }] of this.pendingRequests.entries()) {
      reject(new Error('Inference bridge disconnected'));
    }
    this.pendingRequests.clear();

    this.connected = false;
    logger.info('WebSocket inference bridge disconnected');
  }

  async inference(input, options = {}) {
    if (!this.connected) {
      throw new Error('Inference bridge not connected');
    }

    return new Promise((resolve, reject) => {
      const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error('Inference request timeout'));
      }, config.inference.timeout);

      this.pendingRequests.set(requestId, {
        resolve: (result) => {
          clearTimeout(timeout);
          resolve(result);
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        },
      });

      try {
        this.ws.send(JSON.stringify({
          requestId,
          input,
          options,
        }));
      } catch (error) {
        this.pendingRequests.delete(requestId);
        clearTimeout(timeout);
        reject(error);
      }
    });
  }
}

/**
 * Factory function to create appropriate inference bridge
 */
function createInferenceBridge() {
  if (!config.inference.enabled) {
    logger.info('Inference bridge disabled');
    return null;
  }

  switch (config.inference.mode) {
    case 'rest':
      return new RESTInferenceBridge();
    case 'grpc':
      return new GRPCInferenceBridge();
    case 'websocket':
      return new WebSocketInferenceBridge();
    default:
      logger.error('Unknown inference mode', { mode: config.inference.mode });
      return null;
  }
}

module.exports = {
  InferenceBridge,
  RESTInferenceBridge,
  GRPCInferenceBridge,
  WebSocketInferenceBridge,
  createInferenceBridge,
};
