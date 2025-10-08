/**
 * Input Validation Module
 * Defines validation schemas for all message types
 */

/**
 * Validation schemas for different message types
 */
export const schemas = {
  PING: {
    validate: (payload) => {
      return { valid: true, errors: [] };
    },
  },

  PONG: {
    validate: (payload) => {
      return { valid: true, errors: [] };
    },
  },

  BROADCAST: {
    validate: (payload) => {
      const errors = [];

      if (!payload.message) {
        errors.push('message field is required');
      } else if (typeof payload.message !== 'string') {
        errors.push('message must be a string');
      } else if (payload.message.length === 0) {
        errors.push('message cannot be empty');
      } else if (payload.message.length > 10000) {
        errors.push('message cannot exceed 10000 characters');
      }

      return { valid: errors.length === 0, errors };
    },
  },

  DIRECT_MESSAGE: {
    validate: (payload) => {
      const errors = [];

      if (!payload.targetClientId) {
        errors.push('targetClientId is required');
      } else if (typeof payload.targetClientId !== 'string') {
        errors.push('targetClientId must be a string');
      }

      if (!payload.message) {
        errors.push('message is required');
      } else if (typeof payload.message !== 'string') {
        errors.push('message must be a string');
      } else if (payload.message.length === 0) {
        errors.push('message cannot be empty');
      } else if (payload.message.length > 10000) {
        errors.push('message cannot exceed 10000 characters');
      }

      return { valid: errors.length === 0, errors };
    },
  },

  ROOM_MESSAGE: {
    validate: (payload) => {
      const errors = [];

      if (!payload.channel) {
        errors.push('channel is required');
      } else if (typeof payload.channel !== 'string') {
        errors.push('channel must be a string');
      } else if (!/^[a-z0-9-_]+$/i.test(payload.channel)) {
        errors.push('channel must contain only alphanumeric characters, hyphens, and underscores');
      } else if (payload.channel.length > 100) {
        errors.push('channel name cannot exceed 100 characters');
      }

      if (!payload.message) {
        errors.push('message is required');
      } else if (typeof payload.message !== 'string') {
        errors.push('message must be a string');
      } else if (payload.message.length === 0) {
        errors.push('message cannot be empty');
      } else if (payload.message.length > 10000) {
        errors.push('message cannot exceed 10000 characters');
      }

      return { valid: errors.length === 0, errors };
    },
  },

  SUBSCRIBE: {
    validate: (payload) => {
      const errors = [];

      if (!payload.channel) {
        errors.push('channel is required');
      } else if (typeof payload.channel !== 'string') {
        errors.push('channel must be a string');
      } else if (!/^[a-z0-9-_]+$/i.test(payload.channel)) {
        errors.push('channel must contain only alphanumeric characters, hyphens, and underscores');
      } else if (payload.channel.length > 100) {
        errors.push('channel name cannot exceed 100 characters');
      }

      return { valid: errors.length === 0, errors };
    },
  },

  UNSUBSCRIBE: {
    validate: (payload) => {
      const errors = [];

      if (!payload.channel) {
        errors.push('channel is required');
      } else if (typeof payload.channel !== 'string') {
        errors.push('channel must be a string');
      } else if (!/^[a-z0-9-_]+$/i.test(payload.channel)) {
        errors.push('channel must contain only alphanumeric characters, hyphens, and underscores');
      } else if (payload.channel.length > 100) {
        errors.push('channel name cannot exceed 100 characters');
      }

      return { valid: errors.length === 0, errors };
    },
  },

  GET_STATS: {
    validate: (payload) => {
      return { valid: true, errors: [] };
    },
  },

  INFERENCE_REQUEST: {
    validate: (payload) => {
      const errors = [];

      if (!payload.input) {
        errors.push('input is required');
      } else if (typeof payload.input !== 'string') {
        errors.push('input must be a string');
      } else if (payload.input.length === 0) {
        errors.push('input cannot be empty');
      } else if (payload.input.length > 50000) {
        errors.push('input cannot exceed 50000 characters');
      }

      if (payload.model !== undefined) {
        if (typeof payload.model !== 'string') {
          errors.push('model must be a string');
        } else if (payload.model.length > 100) {
          errors.push('model name cannot exceed 100 characters');
        }
      }

      if (payload.endpoint !== undefined) {
        if (typeof payload.endpoint !== 'string') {
          errors.push('endpoint must be a string');
        } else if (payload.endpoint.length > 200) {
          errors.push('endpoint cannot exceed 200 characters');
        }
      }

      return { valid: errors.length === 0, errors };
    },
  },
};

/**
 * Validate a message payload
 * @param {string} type - Message type
 * @param {Object} payload - Message payload to validate
 * @returns {Object} - { valid: boolean, errors: string[] }
 */
export function validatePayload(type, payload = {}) {
  const schema = schemas[type];

  if (!schema) {
    return { valid: false, errors: [`No validation schema defined for message type: ${type}`] };
  }

  // Validate that payload is an object
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    return { valid: false, errors: ['payload must be an object'] };
  }

  return schema.validate(payload);
}

/**
 * Validate message structure
 * @param {Object} message - Complete message object
 * @returns {Object} - { valid: boolean, errors: string[] }
 */
export function validateMessage(message) {
  const errors = [];

  // Check if message is an object
  if (typeof message !== 'object' || message === null || Array.isArray(message)) {
    return { valid: false, errors: ['message must be an object'] };
  }

  // Validate type field
  if (!message.type) {
    errors.push('type field is required');
  } else if (typeof message.type !== 'string') {
    errors.push('type must be a string');
  } else if (message.type.length > 50) {
    errors.push('type cannot exceed 50 characters');
  }

  // Validate requestId if present
  if (message.requestId !== undefined) {
    if (typeof message.requestId !== 'string') {
      errors.push('requestId must be a string');
    } else if (message.requestId.length > 100) {
      errors.push('requestId cannot exceed 100 characters');
    }
  }

  // Validate payload if present
  if (message.payload !== undefined) {
    if (typeof message.payload !== 'object' || message.payload === null || Array.isArray(message.payload)) {
      errors.push('payload must be an object');
    }
  }

  return { valid: errors.length === 0, errors };
}

export default {
  schemas,
  validatePayload,
  validateMessage,
};