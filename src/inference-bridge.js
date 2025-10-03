import axios from 'axios';
import config from './config.js';
import { logger, utils } from './utils.js';
import broker from './broker.js';

/**
 * Inference Bridge
 * Connects WebSocket server to external inference VMs/services
 * Supports REST, gRPC (via REST gateway), and WebSocket inference endpoints
 */
class InferenceBridge {
  constructor() {
    this.pendingRequests = new Map();
    this.inferenceEndpoints = new Map();
    this.defaultEndpoint = config.inference.endpoint;
    this.timeout = config.inference.timeout;
    this.retries = config.inference.retries;
    
    // Add default endpoint
    this.addEndpoint('default', this.defaultEndpoint);
  }

  /**
   * Initialize the inference bridge
   */
  async initialize() {
    if (!config.inference.enabled) {
      logger.info('Inference bridge disabled');
      return;
    }

    // Subscribe to inference response channel
    if (broker.isConnected()) {
      await broker.subscribe('inference.response', this.handleInferenceResponse.bind(this));
      logger.info('Inference bridge subscribed to broker responses');
    }

    logger.info('Inference bridge initialized', {
      defaultEndpoint: this.defaultEndpoint,
      timeout: this.timeout,
      retries: this.retries,
    });
  }

  /**
   * Add an inference endpoint
   * @param {string} name - Endpoint name/identifier
   * @param {string} url - Endpoint URL
   * @param {Object} options - Additional options (headers, auth, etc.)
   */
  addEndpoint(name, url, options = {}) {
    this.inferenceEndpoints.set(name, {
      url,
      ...options,
    });
    logger.info('Inference endpoint added', { name, url });
  }

  /**
   * Remove an inference endpoint
   * @param {string} name - Endpoint name/identifier
   */
  removeEndpoint(name) {
    this.inferenceEndpoints.delete(name);
    logger.info('Inference endpoint removed', { name });
  }

  /**
   * Process inference request
   * @param {string} requestId - Unique request identifier
   * @param {Object} payload - Inference payload
   * @param {string} endpointName - Endpoint to use (optional)
   * @returns {Promise<Object>} Inference result
   */
  async processInferenceRequest(requestId, payload, endpointName = 'default') {
    if (!config.inference.enabled) {
      throw new Error('Inference bridge is disabled');
    }

    const endpoint = this.inferenceEndpoints.get(endpointName);
    if (!endpoint) {
      throw new Error(`Inference endpoint '${endpointName}' not found`);
    }

    logger.info('Processing inference request', { requestId, endpoint: endpointName });

    // Create promise for async response handling
    const responsePromise = new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error('Inference request timeout'));
      }, this.timeout);

      this.pendingRequests.set(requestId, {
        resolve,
        reject,
        timeoutId,
        startTime: Date.now(),
      });
    });

    // Publish to broker if connected (for distributed processing)
    if (broker.isConnected()) {
      await broker.publish('inference.request', {
        requestId,
        payload,
        endpoint: endpointName,
        timestamp: Date.now(),
      });
    } else {
      // Direct HTTP request to inference endpoint
      this.sendHttpInferenceRequest(requestId, payload, endpoint);
    }

    return responsePromise;
  }

  /**
   * Send HTTP inference request with retry logic
   * @param {string} requestId - Request identifier
   * @param {Object} payload - Inference payload
   * @param {Object} endpoint - Endpoint configuration
   */
  async sendHttpInferenceRequest(requestId, payload, endpoint) {
    try {
      const result = await utils.retry(
        async () => {
          const response = await axios.post(
            endpoint.url,
            {
              requestId,
              ...payload,
            },
            {
              timeout: this.timeout,
              headers: endpoint.headers || {},
            }
          );
          return response.data;
        },
        this.retries,
        1000
      );

      // Resolve pending request
      this.resolveRequest(requestId, result);
    } catch (error) {
      logger.error('Inference HTTP request failed', {
        requestId,
        error: error.message,
      });
      this.rejectRequest(requestId, error);
    }
  }

  /**
   * Handle inference response from broker
   * @param {Object} message - Response message
   */
  handleInferenceResponse(message) {
    const { requestId, result, error } = message;

    if (error) {
      this.rejectRequest(requestId, new Error(error));
    } else {
      this.resolveRequest(requestId, result);
    }
  }

  /**
   * Resolve pending inference request
   * @param {string} requestId - Request identifier
   * @param {Object} result - Inference result
   */
  resolveRequest(requestId, result) {
    const pending = this.pendingRequests.get(requestId);
    if (!pending) {
      logger.warn('No pending request found for resolution', { requestId });
      return;
    }

    clearTimeout(pending.timeoutId);
    const duration = Date.now() - pending.startTime;
    
    logger.info('Inference request completed', { requestId, duration });
    
    pending.resolve(result);
    this.pendingRequests.delete(requestId);
  }

  /**
   * Reject pending inference request
   * @param {string} requestId - Request identifier
   * @param {Error} error - Error object
   */
  rejectRequest(requestId, error) {
    const pending = this.pendingRequests.get(requestId);
    if (!pending) {
      logger.warn('No pending request found for rejection', { requestId });
      return;
    }

    clearTimeout(pending.timeoutId);
    const duration = Date.now() - pending.startTime;
    
    logger.error('Inference request failed', { requestId, duration, error: error.message });
    
    pending.reject(error);
    this.pendingRequests.delete(requestId);
  }

  /**
   * Stream inference request (for long-running tasks)
   * @param {string} requestId - Request identifier
   * @param {Object} payload - Inference payload
   * @param {Function} onChunk - Callback for each chunk
   * @param {string} endpointName - Endpoint to use
   */
  async streamInferenceRequest(requestId, payload, onChunk, endpointName = 'default') {
    const endpoint = this.inferenceEndpoints.get(endpointName);
    if (!endpoint) {
      throw new Error(`Inference endpoint '${endpointName}' not found`);
    }

    logger.info('Starting streaming inference request', { requestId, endpoint: endpointName });

    try {
      const response = await axios.post(
        endpoint.url,
        {
          requestId,
          stream: true,
          ...payload,
        },
        {
          responseType: 'stream',
          timeout: this.timeout,
          headers: endpoint.headers || {},
        }
      );

      return new Promise((resolve, reject) => {
        let buffer = '';

        response.data.on('data', (chunk) => {
          buffer += chunk.toString();
          const lines = buffer.split('\n');
          buffer = lines.pop(); // Keep incomplete line in buffer

          lines.forEach(line => {
            if (line.trim()) {
              try {
                const data = JSON.parse(line);
                onChunk(data);
              } catch (error) {
                logger.warn('Failed to parse streaming chunk', { error: error.message });
              }
            }
          });
        });

        response.data.on('end', () => {
          logger.info('Streaming inference completed', { requestId });
          resolve();
        });

        response.data.on('error', (error) => {
          logger.error('Streaming inference error', { requestId, error: error.message });
          reject(error);
        });
      });
    } catch (error) {
      logger.error('Failed to start streaming inference', {
        requestId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get inference statistics
   * @returns {Object} Statistics
   */
  getStats() {
    return {
      pendingRequests: this.pendingRequests.size,
      endpoints: Array.from(this.inferenceEndpoints.keys()),
      enabled: config.inference.enabled,
    };
  }

  /**
   * Cancel pending request
   * @param {string} requestId - Request identifier
   */
  cancelRequest(requestId) {
    const pending = this.pendingRequests.get(requestId);
    if (pending) {
      clearTimeout(pending.timeoutId);
      pending.reject(new Error('Request cancelled'));
      this.pendingRequests.delete(requestId);
      logger.info('Inference request cancelled', { requestId });
    }
  }

  /**
   * Cancel all pending requests
   */
  cancelAllRequests() {
    for (const requestId of this.pendingRequests.keys()) {
      this.cancelRequest(requestId);
    }
    logger.info('All inference requests cancelled');
  }
}

// Singleton instance
const inferenceBridge = new InferenceBridge();

export default inferenceBridge;
