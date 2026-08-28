module.exports = {
  testEnvironment: 'node',
  verbose: true,
  clearMocks: true,
  restoreMocks: true,
  detectOpenHandles: true,
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/server.js',
    '!src/**/*.test.js',
    '!src/contracts/**',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'json-summary'],
  coverageThreshold: {
    global: {
      branches: 55,
      functions: 65,
      lines: 65,
      statements: 65,
    },
  },
};
