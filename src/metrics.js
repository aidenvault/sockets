/**
 * Prometheus Metrics Module
 * Provides metrics collection and export for monitoring
 */
import promClient from 'prom-client';
import { logger } from './utils.js';

// Create a Registry which registers the metrics
const register = new promClient.Registry();

// Add default metrics (CPU, memory, etc.)
promClient.collectDefaultMetrics({
  register,
  prefix: 'websocket_server_',
});

/**
 * Custom Metrics
 */

// WebSocket Connections
export const connectionsGauge = new promClient.Gauge({
  name: 'websocket_connections_total',
  help: 'Total number of active WebSocket connections',
  registers: [register],
});

export const connectionsPerIpGauge = new promClient.Gauge({
  name: 'websocket_connections_per_ip',
  help: 'Number of connections per IP address',
  labelNames: ['ip'],
  registers: [register],
});

// Messages
export const messagesCounter = new promClient.Counter({
  name: 'websocket_messages_total',
  help: 'Total number of messages processed',
  labelNames: ['type', 'status'],
  registers: [register],
});

export const messageLatency = new promClient.Histogram({
  name: 'websocket_message_latency_seconds',
  help: 'Message processing latency in seconds',
  labelNames: ['type'],
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [register],
});

export const messageSizeHistogram = new promClient.Histogram({
  name: 'websocket_message_size_bytes',
  help: 'Size of WebSocket messages in bytes',
  labelNames: ['type'],
  buckets: [100, 500, 1000, 5000, 10000, 50000, 100000],
  registers: [register],
});

// Inference Metrics
export const inferenceRequestsCounter = new promClient.Counter({
  name: 'inference_requests_total',
  help: 'Total number of inference requests',
  labelNames: ['endpoint', 'status'],
  registers: [register],
});

export const inferenceLatency = new promClient.Histogram({
  name: 'inference_request_latency_seconds',
  help: 'Inference request latency in seconds',
  labelNames: ['endpoint', 'status'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60],
  registers: [register],
});

export const inferencePendingGauge = new promClient.Gauge({
  name: 'inference_pending_requests',
  help: 'Number of pending inference requests',
  registers: [register],
});

// Broker Metrics
export const brokerMessagesCounter = new promClient.Counter({
  name: 'broker_messages_total',
  help: 'Total number of broker messages',
  labelNames: ['channel', 'direction'],
  registers: [register],
});

export const brokerConnectionGauge = new promClient.Gauge({
  name: 'broker_connected',
  help: 'Broker connection status (1 = connected, 0 = disconnected)',
  labelNames: ['type'],
  registers: [register],
});

// Error Metrics
export const errorsCounter = new promClient.Counter({
  name: 'websocket_errors_total',
  help: 'Total number of errors',
  labelNames: ['type', 'severity'],
  registers: [register],
});

// Rate Limiting Metrics
export const rateLimitHitsCounter = new promClient.Counter({
  name: 'rate_limit_hits_total',
  help: 'Total number of rate limit hits',
  labelNames: ['type'],
  registers: [register],
});

// Channel/Room Metrics
export const channelSubscriptionsGauge = new promClient.Gauge({
  name: 'websocket_channel_subscriptions',
  help: 'Number of subscriptions per channel',
  labelNames: ['channel'],
  registers: [register],
});

/**
 * Helper function to track message processing
 */
export function trackMessage(type, size, processFunc) {
  const start = Date.now();

  return async (...args) => {
    try {
      const result = await processFunc(...args);

      const duration = (Date.now() - start) / 1000;
      messageLatency.labels(type).observe(duration);
      messagesCounter.labels(type, 'success').inc();

      if (size) {
        messageSizeHistogram.labels(type).observe(size);
      }

      return result;
    } catch (error) {
      messagesCounter.labels(type, 'error').inc();
      errorsCounter.labels(type, 'error').inc();
      throw error;
    }
  };
}

/**
 * Helper function to track inference requests
 */
export function trackInference(endpoint, requestFunc) {
  const start = Date.now();

  return async (...args) => {
    inferencePendingGauge.inc();

    try {
      const result = await requestFunc(...args);

      const duration = (Date.now() - start) / 1000;
      inferenceLatency.labels(endpoint, 'success').observe(duration);
      inferenceRequestsCounter.labels(endpoint, 'success').inc();

      return result;
    } catch (error) {
      const duration = (Date.now() - start) / 1000;
      inferenceLatency.labels(endpoint, 'error').observe(duration);
      inferenceRequestsCounter.labels(endpoint, 'error').inc();

      throw error;
    } finally {
      inferencePendingGauge.dec();
    }
  };
}

/**
 * Update connection metrics
 */
export function updateConnectionMetrics(connections, ipConnectionCounts) {
  connectionsGauge.set(connections);

  // Update per-IP metrics
  if (ipConnectionCounts) {
    for (const [ip, count] of ipConnectionCounts.entries()) {
      connectionsPerIpGauge.labels(ip).set(count);
    }
  }
}

/**
 * Update broker connection status
 */
export function updateBrokerStatus(type, connected) {
  brokerConnectionGauge.labels(type).set(connected ? 1 : 0);
}

/**
 * Track channel subscription
 */
export function updateChannelSubscriptions(channel, count) {
  channelSubscriptionsGauge.labels(channel).set(count);
}

/**
 * Get metrics for Prometheus scraping
 */
export async function getMetrics() {
  try {
    return await register.metrics();
  } catch (error) {
    logger.error('Error generating metrics', { error: error.message });
    throw error;
  }
}

/**
 * Get metrics content type
 */
export function getContentType() {
  return register.contentType;
}

/**
 * Reset all metrics (useful for testing)
 */
export function resetMetrics() {
  register.resetMetrics();
}

export default {
  register,
  connectionsGauge,
  connectionsPerIpGauge,
  messagesCounter,
  messageLatency,
  messageSizeHistogram,
  inferenceRequestsCounter,
  inferenceLatency,
  inferencePendingGauge,
  brokerMessagesCounter,
  brokerConnectionGauge,
  errorsCounter,
  rateLimitHitsCounter,
  channelSubscriptionsGauge,
  trackMessage,
  trackInference,
  updateConnectionMetrics,
  updateBrokerStatus,
  updateChannelSubscriptions,
  getMetrics,
  getContentType,
  resetMetrics,
};