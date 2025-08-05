import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { config, validateConfig } from '../../config/config.js';

describe('Config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment variables
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  test('should export config object with expected structure', () => {
    expect(config).toBeDefined();
    expect(config.youtube).toBeDefined();
    expect(config.google).toBeDefined();
    expect(config.notion).toBeDefined();
    expect(config.openai).toBeDefined();
    expect(config.anthropic).toBeDefined();
    expect(config.telegram).toBeDefined();
    expect(config.app).toBeDefined();
  });

  test('should have default values for app config', () => {
    expect(config.app.nodeEnv).toBe('development');
    expect(config.app.logLevel).toBe('info');
    expect(config.app.concurrentWorkers).toBe(4);
  });

  test('should throw error when required env vars are missing', () => {
    // Clear all environment variables
    process.env = {};
    
    expect(() => {
      validateConfig();
    }).toThrow('Missing required environment variables');
  });

  test('should pass validation when all required env vars are present', () => {
    // Set required environment variables
    process.env.YOUTUBE_API_KEY = 'test-key';
    process.env.GOOGLE_CLIENT_EMAIL = 'test@example.com';
    process.env.GOOGLE_PRIVATE_KEY = 'test-key';
    process.env.NOTION_TOKEN = 'test-token';
    process.env.NOTION_DATABASE_ID = 'test-id';
    process.env.TELEGRAM_BOT_TOKEN = 'test-token';
    process.env.TELEGRAM_CHAT_ID = 'test-chat-id';

    expect(() => {
      validateConfig();
    }).not.toThrow();
  });

  test('should parse concurrent workers as integer', async () => {
    process.env.CONCURRENT_WORKERS = '8';
    const { config: testConfig } = await import('../../config/config.js');
    expect(testConfig.app.concurrentWorkers).toBe(8);
  });
});