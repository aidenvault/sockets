/**
 * Jest Configuration
 * Test framework configuration for WebSocket API Server
 */
export default {
  // Test environment
  testEnvironment: 'node',

  // File extensions to consider
  moduleFileExtensions: ['js', 'json'],

  // Test match patterns
  testMatch: [
    '**/tests/**/*.test.js',
    '**/__tests__/**/*.js',
  ],

  // Coverage collection
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/server.js', // Exclude main entry point
  ],

  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },

  // Coverage directory
  coverageDirectory: 'coverage',

  // Coverage reporters
  coverageReporters: ['text', 'text-summary', 'lcov', 'html'],

  // Clear mocks between tests
  clearMocks: true,

  // Reset mocks between tests
  resetMocks: true,

  // Restore mocks between tests
  restoreMocks: true,

  // Test timeout (10 seconds)
  testTimeout: 10000,

  // Verbose output
  verbose: true,

  // Transform configuration for ES modules
  transform: {},

  // Module name mapper for aliases (if needed)
  moduleNameMapper: {},

  // Setup files after environment
  setupFilesAfterEnv: [],

  // Global setup/teardown
  // globalSetup: './tests/globalSetup.js',
  // globalTeardown: './tests/globalTeardown.js',
};