export default {
  testEnvironment: 'node',
  rootDir: '../',
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/index.js'
  ],
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.test.js',
    '<rootDir>/src/**/?(*.)+(spec|test).js'
  ],
  verbose: true,
  setupFilesAfterEnv: ['<rootDir>/.config/jest.setup.js'],
  testTimeout: 30000,
  transform: {},
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1'
  },
  globals: {
    'jest': true
  }
};