const Redis = require('ioredis');
const { connect, StringCodec } = require('nats');
const config = require('./config');
const { logger } = require('./utils');

/**
 * Abstract Broker class
 */
class Broker {
  constructor() {
    this.connected = false;
  }

  async connect() {
    throw new Error('Method not implemented');
  }

  async disconnect() {
    throw new Error('Method not implemented');
  }

  async publish(channel, message) {
    throw new Error('Method not implemented');
  }

  async subscribe(channel, callback) {
    throw new Error('Method not implemented');
  }
}

/**
 * Redis Broker implementation
 */
class RedisBroker extends Broker {
  constructor() {
    super();
    this.publisher = null;
    this.subscriber = null;
    this.subscriptions = new Map();
  }

  async connect() {
    try {
      const redisConfig = {
        host: config.redis.host,
        port: config.redis.port,
        db: config.redis.db,
        retryStrategy: (times) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
      };

      if (config.redis.password) {
        redisConfig.password = config.redis.password;
      }

      this.publisher = new Redis(redisConfig);
      this.subscriber = new Redis(redisConfig);

      this.publisher.on('error', (err) => {
        logger.error('Redis publisher error', { error: err.message });
      });

      this.subscriber.on('error', (err) => {
        logger.error('Redis subscriber error', { error: err.message });
      });

      this.publisher.on('connect', () => {
        logger.info('Redis publisher connected');
      });

      this.subscriber.on('connect', () => {
        logger.info('Redis subscriber connected');
      });

      // Handle subscription messages
      this.subscriber.on('message', (channel, message) => {
        const callback = this.subscriptions.get(channel);
        if (callback) {
          try {
            callback(message);
          } catch (error) {
            logger.error('Error in subscription callback', { 
              channel, 
              error: error.message 
            });
          }
        }
      });

      this.connected = true;
      logger.info('Redis broker initialized');
    } catch (error) {
      logger.error('Failed to connect to Redis', { error: error.message });
      throw error;
    }
  }

  async disconnect() {
    try {
      if (this.publisher) {
        await this.publisher.quit();
      }
      if (this.subscriber) {
        await this.subscriber.quit();
      }
      this.connected = false;
      logger.info('Redis broker disconnected');
    } catch (error) {
      logger.error('Error disconnecting Redis', { error: error.message });
    }
  }

  async publish(channel, message) {
    if (!this.connected) {
      throw new Error('Broker not connected');
    }

    try {
      const payload = typeof message === 'string' ? message : JSON.stringify(message);
      await this.publisher.publish(channel, payload);
      logger.debug('Published message', { channel, payload });
    } catch (error) {
      logger.error('Failed to publish message', { 
        channel, 
        error: error.message 
      });
      throw error;
    }
  }

  async subscribe(channel, callback) {
    if (!this.connected) {
      throw new Error('Broker not connected');
    }

    try {
      await this.subscriber.subscribe(channel);
      this.subscriptions.set(channel, callback);
      logger.info('Subscribed to channel', { channel });
    } catch (error) {
      logger.error('Failed to subscribe to channel', { 
        channel, 
        error: error.message 
      });
      throw error;
    }
  }

  async unsubscribe(channel) {
    if (!this.connected) {
      return;
    }

    try {
      await this.subscriber.unsubscribe(channel);
      this.subscriptions.delete(channel);
      logger.info('Unsubscribed from channel', { channel });
    } catch (error) {
      logger.error('Failed to unsubscribe from channel', { 
        channel, 
        error: error.message 
      });
    }
  }
}

/**
 * NATS Broker implementation
 */
class NATSBroker extends Broker {
  constructor() {
    super();
    this.client = null;
    this.subscriptions = new Map();
  }

  async connect() {
    try {
      this.client = await connect({ servers: config.nats.url });
      
      this.client.closed().then((err) => {
        if (err) {
          logger.error('NATS connection closed with error', { error: err.message });
        } else {
          logger.info('NATS connection closed');
        }
      });

      this.connected = true;
      logger.info('NATS broker initialized');
    } catch (error) {
      logger.error('Failed to connect to NATS', { error: error.message });
      throw error;
    }
  }

  async disconnect() {
    try {
      if (this.client) {
        await this.client.drain();
        this.connected = false;
        logger.info('NATS broker disconnected');
      }
    } catch (error) {
      logger.error('Error disconnecting NATS', { error: error.message });
    }
  }

  async publish(channel, message) {
    if (!this.connected) {
      throw new Error('Broker not connected');
    }

    try {
      const sc = StringCodec();
      const payload = typeof message === 'string' ? message : JSON.stringify(message);
      this.client.publish(channel, sc.encode(payload));
      logger.debug('Published message', { channel, payload });
    } catch (error) {
      logger.error('Failed to publish message', { 
        channel, 
        error: error.message 
      });
      throw error;
    }
  }

  async subscribe(channel, callback) {
    if (!this.connected) {
      throw new Error('Broker not connected');
    }

    try {
      const sc = StringCodec();
      const sub = this.client.subscribe(channel);
      
      this.subscriptions.set(channel, sub);
      
      (async () => {
        for await (const msg of sub) {
          try {
            const data = sc.decode(msg.data);
            callback(data);
          } catch (error) {
            logger.error('Error in subscription callback', { 
              channel, 
              error: error.message 
            });
          }
        }
      })();

      logger.info('Subscribed to channel', { channel });
    } catch (error) {
      logger.error('Failed to subscribe to channel', { 
        channel, 
        error: error.message 
      });
      throw error;
    }
  }

  async unsubscribe(channel) {
    if (!this.connected) {
      return;
    }

    try {
      const sub = this.subscriptions.get(channel);
      if (sub) {
        sub.unsubscribe();
        this.subscriptions.delete(channel);
        logger.info('Unsubscribed from channel', { channel });
      }
    } catch (error) {
      logger.error('Failed to unsubscribe from channel', { 
        channel, 
        error: error.message 
      });
    }
  }
}

/**
 * Factory function to create appropriate broker
 */
function createBroker() {
  if (config.redis.enabled) {
    return new RedisBroker();
  } else if (config.nats.enabled) {
    return new NATSBroker();
  } else {
    logger.warn('No broker enabled, using null broker');
    return null;
  }
}

module.exports = {
  Broker,
  RedisBroker,
  NATSBroker,
  createBroker,
};
