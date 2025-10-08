/**
 * ESLint Configuration
 * Linting rules for WebSocket API Server
 */
module.exports = {
  env: {
    es2021: true,
    node: true,
    jest: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:prettier/recommended',
  ],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  rules: {
    // Error prevention
    'no-console': 'off', // Allow console for server logging
    'no-unused-vars': ['error', {
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
    }],
    'no-var': 'error',
    'prefer-const': 'error',

    // Best practices
    'eqeqeq': ['error', 'always'],
    'no-throw-literal': 'error',
    'prefer-promise-reject-errors': 'error',

    // ES6+
    'arrow-body-style': ['error', 'as-needed'],
    'prefer-arrow-callback': 'error',
    'prefer-destructuring': ['error', {
      array: false,
      object: true,
    }],
    'prefer-template': 'error',

    // Code style (handled by Prettier)
    'prettier/prettier': 'error',
  },
};