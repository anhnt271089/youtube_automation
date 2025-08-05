// Jest setup file for global test configurations
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const dotenv = require('dotenv');

// Load environment variables for testing
dotenv.config({ path: '.env.test' });

// Global test timeout - removed as it's deprecated in newer Jest versions

// Mock console.log in tests to reduce noise
global.console = {
  ...console,
  log: () => {},
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: console.error // Keep error for debugging
};