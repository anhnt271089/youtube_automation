import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import logger from '../utils/logger.js';

const testLogDir = path.join(process.cwd(), 'logs');

describe('Logger', () => {
  beforeEach(() => {
    // Ensure logs directory exists
    if (!fs.existsSync(testLogDir)) {
      fs.mkdirSync(testLogDir, { recursive: true });
    }
  });

  afterEach(() => {
    // Clean up test logs
    try {
      const logFiles = fs.readdirSync(testLogDir);
      logFiles.forEach(file => {
        if (file.includes('test') || file.includes('error')) {
          fs.unlinkSync(path.join(testLogDir, file));
        }
      });
    } catch {
      // Ignore cleanup errors
    }
  });

  test('should create logger instance', () => {
    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.debug).toBe('function');
  });

  test('should log info messages', () => {
    expect(() => {
      logger.info('Test info message');
    }).not.toThrow();
  });

  test('should log error messages', () => {
    expect(() => {
      logger.error('Test error message');
    }).not.toThrow();
  });

  test('should log warn messages', () => {
    expect(() => {
      logger.warn('Test warn message');
    }).not.toThrow();
  });
});