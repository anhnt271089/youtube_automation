#!/usr/bin/env node

/**
 * Validation script for network timeout fixes
 * Tests the implemented retry logic and error handling without requiring API access
 */

import TelegramService from '../src/services/telegramService.js';
import { config } from '../config/config.js';
import logger from '../src/utils/logger.js';

class NetworkFixValidator {
  constructor() {
    this.telegramService = new TelegramService();
    this.testsPassed = 0;
    this.testsTotal = 0;
  }

  runTest(testName, testFn) {
    try {
      logger.info(`🔍 Testing: ${testName}`);
      const result = testFn();
      this.testsPassed++;
      logger.info(`✅ ${testName}: PASS`);
      return result;
    } catch (error) {
      logger.error(`❌ ${testName}: FAIL - ${error.message}`);
      return null;
    } finally {
      this.testsTotal++;
    }
  }

  validateConfigurationUpdates() {
    return this.runTest('Configuration Updates', () => {
      // Check that new timeout configurations exist
      if (!config.telegram.requestTimeout) {
        throw new Error('Missing requestTimeout in telegram config');
      }
      if (!config.telegram.maxRetries) {
        throw new Error('Missing maxRetries in telegram config');
      }
      if (!config.telegram.retryDelay) {
        throw new Error('Missing retryDelay in telegram config');
      }

      logger.info(`  - Timeout: ${config.telegram.requestTimeout}ms`);
      logger.info(`  - Max Retries: ${config.telegram.maxRetries}`);
      logger.info(`  - Retry Delay: ${config.telegram.retryDelay}ms`);
      
      return {
        requestTimeout: config.telegram.requestTimeout,
        maxRetries: config.telegram.maxRetries,
        retryDelay: config.telegram.retryDelay
      };
    });
  }

  validateTelegramServiceEnhancements() {
    return this.runTest('Telegram Service Enhancements', () => {
      // Check that new methods exist
      const requiredMethods = [
        'isNetworkError',
        'isRetryableError', 
        'calculateRetryDelay',
        'sendMessageSafe'
      ];

      for (const method of requiredMethods) {
        if (typeof this.telegramService[method] !== 'function') {
          throw new Error(`Missing method: ${method}`);
        }
      }

      logger.info(`  - All ${requiredMethods.length} new methods present`);
      return { methodsImplemented: requiredMethods.length };
    });
  }

  validateNetworkErrorDetection() {
    return this.runTest('Network Error Detection', () => {
      const testErrors = [
        { code: 'ETIMEDOUT', expected: true },
        { code: 'ECONNRESET', expected: true },
        { code: 'ENOTFOUND', expected: true },
        { message: 'socket hang up', expected: true },
        { message: 'timeout', expected: true },
        { code: 'EACCES', expected: false },
        { message: 'Not found', expected: false }
      ];

      let correctDetections = 0;
      for (const testError of testErrors) {
        const detected = this.telegramService.isNetworkError(testError);
        if (detected === testError.expected) {
          correctDetections++;
        } else {
          throw new Error(`Network error detection failed for ${JSON.stringify(testError)}`);
        }
      }

      logger.info(`  - Correctly detected ${correctDetections}/${testErrors.length} error types`);
      return { correctDetections, totalTests: testErrors.length };
    });
  }

  validateRetryLogic() {
    return this.runTest('Retry Logic Implementation', () => {
      // Test exponential backoff calculation
      const delays = [];
      for (let attempt = 1; attempt <= 3; attempt++) {
        const delay = this.telegramService.calculateRetryDelay(attempt);
        delays.push(delay);
        
        // Verify exponential growth (with jitter tolerance)
        const expectedMin = config.telegram.retryDelay * Math.pow(2, attempt - 1);
        const expectedMax = expectedMin * 2; // Account for jitter
        
        if (delay < expectedMin || delay > expectedMax) {
          throw new Error(`Retry delay ${delay}ms not in expected range ${expectedMin}-${expectedMax}ms for attempt ${attempt}`);
        }
      }

      // Verify delays are increasing (generally)
      if (delays[1] <= delays[0] || delays[2] <= delays[1]) {
        logger.warn('  - Delay pattern may be affected by jitter (this is normal)');
      }

      logger.info(`  - Retry delays: ${delays.map(d => Math.round(d) + 'ms').join(' → ')}`);
      return { delays };
    });
  }

  validateRetryableErrorLogic() {
    return this.runTest('Retryable Error Logic', () => {
      const testCases = [
        // Network errors should be retryable
        { error: { code: 'ETIMEDOUT' }, expected: true },
        { error: { code: 'ECONNRESET' }, expected: true },
        
        // HTTP 5xx errors should be retryable
        { error: { response: { status: 500 } }, expected: true },
        { error: { response: { status: 502 } }, expected: true },
        { error: { response: { status: 503 } }, expected: true },
        { error: { response: { status: 429 } }, expected: true },
        
        // HTTP 4xx errors (except 429) should not be retryable
        { error: { response: { status: 400 } }, expected: false },
        { error: { response: { status: 401 } }, expected: false },
        { error: { response: { status: 404 } }, expected: false },
        
        // Other errors should not be retryable
        { error: { message: 'Invalid token' }, expected: false }
      ];

      let correctResults = 0;
      for (const testCase of testCases) {
        const isRetryable = this.telegramService.isRetryableError(testCase.error);
        if (isRetryable === testCase.expected) {
          correctResults++;
        } else {
          throw new Error(`Retryable logic failed for ${JSON.stringify(testCase)}`);
        }
      }

      logger.info(`  - Correctly handled ${correctResults}/${testCases.length} error scenarios`);
      return { correctResults, totalTests: testCases.length };
    });
  }

  validateBotConfiguration() {
    return this.runTest('Bot Configuration', () => {
      // Check bot configuration includes timeout settings
      const bot = this.telegramService.bot;
      const options = bot.options;
      
      if (!options.request) {
        throw new Error('Bot request configuration missing');
      }
      
      if (!options.request.timeout) {
        throw new Error('Bot timeout configuration missing');
      }

      logger.info(`  - Bot timeout: ${options.request.timeout}ms`);
      logger.info(`  - Connection pooling: ${options.request.forever ? 'enabled' : 'disabled'}`);
      logger.info(`  - Max sockets: ${options.request.pool?.maxSockets || 'default'}`);
      
      return {
        timeout: options.request.timeout,
        forever: options.request.forever,
        maxSockets: options.request.pool?.maxSockets
      };
    });
  }

  async runAllValidations() {
    logger.info('🚀 Validating Network Timeout Fixes...');
    logger.info('=' .repeat(60));

    // Run all validations
    this.validateConfigurationUpdates();
    this.validateTelegramServiceEnhancements();
    this.validateNetworkErrorDetection();
    this.validateRetryLogic();
    this.validateRetryableErrorLogic();
    this.validateBotConfiguration();

    logger.info('=' .repeat(60));
    logger.info(`📊 Validation Summary: ${this.testsPassed}/${this.testsTotal} tests passed`);

    if (this.testsPassed === this.testsTotal) {
      logger.info('✅ All network timeout fixes validated successfully!');
      logger.info('🎉 The system should now handle network timeouts gracefully');
      return { success: true, passed: this.testsPassed, total: this.testsTotal };
    } else {
      logger.error(`❌ ${this.testsTotal - this.testsPassed} validations failed`);
      return { success: false, passed: this.testsPassed, total: this.testsTotal };
    }
  }
}

// Main execution
async function main() {
  try {
    const validator = new NetworkFixValidator();
    const result = await validator.runAllValidations();
    
    if (result.success) {
      logger.info('');
      logger.info('🔧 Next Steps:');
      logger.info('1. Update your .env file with the new Telegram timeout settings');
      logger.info('2. Test with a real video processing workflow');
      logger.info('3. Monitor logs for network error patterns and retry attempts');
      logger.info('4. Run network diagnostic tool: node tools/network-diagnostic.js');
      
      process.exit(0);
    } else {
      process.exit(1);
    }
  } catch (error) {
    logger.error('Validation failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default NetworkFixValidator;