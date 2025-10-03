import { createClient } from 'redis';
import { connect as natsConnect } from 'nats';
import config from './config.js';
import { logger } from './utils.js';

/**
 * Message Broker for Pub/Sub Communication
 * Supports both Redis and NATS for horizontal scaling
 */
class MessageBroker {
  constructor() {
    this.type = null;
    this.client = null;
    this.subscriber = null;
    this.publisher = null;
    this.subscriptions = new Map();
    this.connected = false;
  }

  /**
   * Initialize broker connection
   */
  async connect() {
    try {
      if (config.redis.enabled) {
        await this.connectRedis();
      } else if (config.nats.enabled) {
        await this.connectNats();
      } else {
        logger.info('No message broker enabled, using in-memory mode');
        this.type = 'memory';
        this.connected = true;
      }
    } catch (error) {
      logger.error('Failed to connect to message broker', { error: error.message });
      throw error;
    }
  }

  /**
   * Connect to Redis
   */
  async connectRedis() {
    logger.info('Connecting to Redis...', {
      host: config.redis.host,
      port: config.redis.port,
    });

    const clientConfig = {
      socket: {
        host: config.redis.host,
        port: config.redis.port,
      },
      database: config.redis.db,
    };

    if (config.redis.password) {
      clientConfig.password = config.redis.password;
    }

    // Create publisher client
    this.publisher = createClient(clientConfig);
    this.publisher.on('error', (err) => logger.error('Redis Publisher Error', { error: err.message }));
    await this.publisher.connect();

    // Create subscriber client
    this.subscriber = createClient(clientConfig);
    this.subscriber.on('error', (err) => logger.error('Redis Subscriber Error', { error: err.message }));
    await this.subscriber.connect();

    this.type = 'redis';
    this.connected = true;
    logger.info('Redis connected successfully');
  }

  /**
   * Connect to NATS
   */
  async connectNats() {
    logger.info('Connecting to NATS...', { url: config.nats.url });

    this.client = await natsConnect({
      servers: config.nats.url,
    });

    this.type = 'nats';
    this.connected = true;
    logger.info('NATS connected successfully');

    // Handle connection events
    (async () => {
      for await (const status of this.client.status()) {
        logger.info('NATS status change', { status: status.type });
      }
    })();
  }

  /**
   * Publish message to a channel/topic
   * @param {string} channel - Channel/topic name
   * @param {Object} message - Message to publish
   */
  async publish(channel, message) {
    if (!this.connected) {
      logger.warn('Broker not connected, skipping publish');
      return;
    }

    const messageStr = JSON.stringify(message);

    try {
      switch (this.type) {
        case 'redis':
          await this.publisher.publish(channel, messageStr);
          break;

        case 'nats':
          this.client.publish(channel, messageStr);
          break;

        case 'memory':
          // In-memory mode: directly call handlers
          const handlers = this.subscriptions.get(channel) || [];
          handlers.forEach(handler => {
            try {
              handler(message);
            } catch (error) {
              logger.error('Handler error in memory mode', { error: error.message });
            }
          });
          break;
      }

      logger.debug('Message published', { channel, type: this.type });
    } catch (error) {
      logger.error('Failed to publish message', { channel, error: error.message });
      throw error;
    }
  }

  /**
   * Subscribe to a channel/topic
   * @param {string} channel - Channel/topic name
   * @param {Function} handler - Message handler function
   */
  async subscribe(channel, handler) {
    if (!this.connected && this.type !== 'memory') {
      logger.warn('Broker not connected, cannot subscribe');
      return;
    }

    try {
      switch (this.type) {
        case 'redis':
          await this.subscriber.subscribe(channel, (message) => {
            try {
              const parsed = JSON.parse(message);
              handler(parsed);
            } catch (error) {
              logger.error('Failed to parse Redis message', { error: error.message });
            }
          });
          break;

        case 'nats':
          const subscription = this.client.subscribe(channel);
          (async () => {
            for await (const msg of subscription) {
              try {
                const parsed = JSON.parse(msg.string());
                handler(parsed);
              } catch (error) {
                logger.error('Failed to parse NATS message', { error: error.message });
              }
            }
          })();
          break;

        case 'memory':
          // Store handler for in-memory mode
          if (!this.subscriptions.has(channel)) {
            this.subscriptions.set(channel, []);
          }
          this.subscriptions.get(channel).push(handler);
          break;
      }

      logger.info('Subscribed to channel', { channel, type: this.type });
    } catch (error) {
      logger.error('Failed to subscribe to channel', { channel, error: error.message });
      throw error;
    }
  }

  /**
   * Unsubscribe from a channel/topic
   * @param {string} channel - Channel/topic name
   */
  async unsubscribe(channel) {
    try {
      switch (this.type) {
        case 'redis':
          await this.subscriber.unsubscribe(channel);
          break;

        case 'nats':
          // NATS subscriptions need to be tracked separately for unsubscribe
          logger.warn('NATS unsubscribe not fully implemented');
          break;

        case 'memory':
          this.subscriptions.delete(channel);
          break;
      }

      logger.info('Unsubscribed from channel', { channel, type: this.type });
    } catch (error) {
      logger.error('Failed to unsubscribe from channel', { channel, error: error.message });
    }
  }

  /**
   * Disconnect from broker
   */
  async disconnect() {
    try {
      if (this.type === 'redis') {
        await this.publisher?.quit();
        await this.subscriber?.quit();
      } else if (this.type === 'nats') {
        await this.client?.close();
      }

      this.connected = false;
      logger.info('Broker disconnected');
    } catch (error) {
      logger.error('Error disconnecting from broker', { error: error.message });
    }
  }

  /**
   * Check if broker is connected
   * @returns {boolean}
   */
  isConnected() {
    return this.connected;
  }

  /**
   * Get broker type
   * @returns {string}
   */
  getType() {
    return this.type;
  }
}

// Singleton instance
const broker = new MessageBroker();

export default broker;
