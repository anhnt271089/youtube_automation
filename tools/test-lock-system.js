#!/usr/bin/env node
/**
 * Comprehensive test for the Lock Manager System
 * Tests processing locks, cooldown periods, and cron job mutex
 */

import lockManager from '../src/services/lockManagerService.js';
import GoogleSheetsService from '../src/services/googleSheetsService.js';
import logger from '../src/utils/logger.js';

class LockSystemTester {
  constructor() {
    this.sheetsService = new GoogleSheetsService();
    this.testResults = {
      passed: 0,
      failed: 0,
      tests: []
    };
  }

  async runTest(testName, testFunction) {
    try {
      logger.info(`🧪 Running test: ${testName}`);
      await testFunction();
      this.testResults.passed++;
      this.testResults.tests.push({ name: testName, status: 'PASSED' });
      logger.info(`✅ Test passed: ${testName}`);
    } catch (error) {
      this.testResults.failed++;
      this.testResults.tests.push({ name: testName, status: 'FAILED', error: error.message });
      logger.error(`❌ Test failed: ${testName} - ${error.message}`);
    }
  }

  async testProcessingLocks() {
    await this.runTest('Processing Locks - Basic Acquisition', async () => {
      const videoId = 'TEST-001';
      
      // Test lock acquisition
      const acquired = await lockManager.acquireLock(videoId, 'videoProcessing', {
        holder: 'TestRunner',
        reason: 'Testing lock system'
      });
      
      if (!acquired) {
        throw new Error('Failed to acquire lock');
      }

      // Test lock check
      const isLocked = lockManager.isLocked(videoId, 'videoProcessing');
      if (!isLocked) {
        throw new Error('Lock check failed - should be locked');
      }

      // Test lock info
      const lockInfo = lockManager.getLockInfo(videoId, 'videoProcessing');
      if (!lockInfo || lockInfo.holder !== 'TestRunner') {
        throw new Error('Lock info incorrect');
      }

      // Test lock release
      const released = lockManager.releaseLock(videoId, 'videoProcessing');
      if (!released) {
        throw new Error('Failed to release lock');
      }

      // Verify lock is released
      const stillLocked = lockManager.isLocked(videoId, 'videoProcessing');
      if (stillLocked) {
        throw new Error('Lock should be released but still locked');
      }
    });

    await this.runTest('Processing Locks - Prevent Concurrent Access', async () => {
      const videoId = 'TEST-002';
      
      // Acquire first lock
      const acquired1 = await lockManager.acquireLock(videoId, 'videoProcessing', {
        holder: 'Process1'
      });
      
      if (!acquired1) {
        throw new Error('Failed to acquire first lock');
      }

      // Try to acquire second lock (should fail)
      const acquired2 = await lockManager.acquireLock(videoId, 'videoProcessing', {
        holder: 'Process2'
      });
      
      if (acquired2) {
        throw new Error('Second lock should have been rejected');
      }

      // Release first lock
      lockManager.releaseLock(videoId, 'videoProcessing');

      // Now second process should be able to acquire lock
      const acquired3 = await lockManager.acquireLock(videoId, 'videoProcessing', {
        holder: 'Process2'
      });
      
      if (!acquired3) {
        throw new Error('Should be able to acquire lock after release');
      }

      // Cleanup
      lockManager.releaseLock(videoId, 'videoProcessing');
    });

    await this.runTest('Processing Locks - Different Lock Types', async () => {
      const videoId = 'TEST-003';
      
      // Acquire different types of locks for same video (should work)
      const scriptLock = await lockManager.acquireLock(videoId, 'scriptGeneration');
      const imageLock = await lockManager.acquireLock(videoId, 'imageGeneration');
      const thumbnailLock = await lockManager.acquireLock(videoId, 'thumbnailGeneration');
      
      if (!scriptLock || !imageLock || !thumbnailLock) {
        throw new Error('Should be able to acquire different lock types for same video');
      }

      // Cleanup
      lockManager.releaseLock(videoId, 'scriptGeneration');
      lockManager.releaseLock(videoId, 'imageGeneration');
      lockManager.releaseLock(videoId, 'thumbnailGeneration');
    });
  }

  async testCooldownSystem() {
    await this.runTest('Cooldown System - Basic Functionality', async () => {
      const videoId = 'TEST-COOLDOWN-001';
      
      // Initially should not be in cooldown
      const initialCheck = lockManager.checkCooldown(videoId, 'scriptRegeneration');
      if (initialCheck.inCooldown) {
        throw new Error('Should not be in cooldown initially');
      }

      // Set cooldown
      const cooldown = lockManager.setCooldown(videoId, 'scriptRegeneration', {
        reason: 'Testing cooldown'
      });
      
      if (!cooldown.expiresAt) {
        throw new Error('Cooldown should have expiration time');
      }

      // Should now be in cooldown
      const cooldownCheck = lockManager.checkCooldown(videoId, 'scriptRegeneration');
      if (!cooldownCheck.inCooldown) {
        throw new Error('Should be in cooldown after setting');
      }

      if (cooldownCheck.remainingTime <= 0) {
        throw new Error('Remaining time should be positive');
      }

      // Clear cooldown
      const cleared = lockManager.clearCooldown(videoId, 'scriptRegeneration');
      if (!cleared) {
        throw new Error('Should be able to clear cooldown');
      }

      // Should no longer be in cooldown
      const finalCheck = lockManager.checkCooldown(videoId, 'scriptRegeneration');
      if (finalCheck.inCooldown) {
        throw new Error('Should not be in cooldown after clearing');
      }
    });

    await this.runTest('Cooldown System - Expiration', async () => {
      const videoId = 'TEST-COOLDOWN-002';
      
      // Set short cooldown for testing (override period)
      lockManager.cooldownPeriods.testCooldown = 100; // 100ms
      lockManager.setCooldown(videoId, 'testCooldown');

      // Should be in cooldown immediately
      const immediateCheck = lockManager.checkCooldown(videoId, 'testCooldown');
      if (!immediateCheck.inCooldown) {
        throw new Error('Should be in cooldown immediately after setting');
      }

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 150));

      // Should no longer be in cooldown
      const expiredCheck = lockManager.checkCooldown(videoId, 'testCooldown');
      if (expiredCheck.inCooldown) {
        throw new Error('Cooldown should have expired');
      }

      // Cleanup
      delete lockManager.cooldownPeriods.testCooldown;
    });
  }

  async testCronMutex() {
    await this.runTest('Cron Mutex - Basic Functionality', async () => {
      const jobName = 'testProcessor';
      
      // Acquire mutex
      const acquired = lockManager.acquireCronMutex(jobName);
      if (!acquired) {
        throw new Error('Failed to acquire cron mutex');
      }

      // Try to acquire again (should fail)
      const acquired2 = lockManager.acquireCronMutex(jobName);
      if (acquired2) {
        throw new Error('Second mutex acquisition should fail');
      }

      // Release mutex
      const released = lockManager.releaseCronMutex(jobName);
      if (!released) {
        throw new Error('Failed to release cron mutex');
      }

      // Should be able to acquire again
      const acquired3 = lockManager.acquireCronMutex(jobName);
      if (!acquired3) {
        throw new Error('Should be able to acquire mutex after release');
      }

      // Cleanup
      lockManager.releaseCronMutex(jobName);
    });
  }

  async testGoogleSheetsIntegration() {
    await this.runTest('Google Sheets - Cooldown Integration', async () => {
      // This test requires a real video ID from sheets
      const videos = await this.sheetsService.getVideosByStatus('Processing');
      
      if (videos.length === 0) {
        logger.info('No videos in processing status, skipping Google Sheets integration test');
        return;
      }

      const testVideoId = videos[0].videoId;
      logger.info(`Testing with video: ${testVideoId}`);

      // Test cooldown check (should not be in cooldown initially)
      const initialCheck = await this.sheetsService.checkRegenerationCooldown(testVideoId, 'script');
      
      // Note: Don't actually set cooldown in production data unless explicitly testing
      logger.info(`Initial cooldown check result: ${JSON.stringify(initialCheck)}`);
      
      // Verify the method works without errors
      if (typeof initialCheck.inCooldown !== 'boolean') {
        throw new Error('Cooldown check should return boolean inCooldown');
      }
    });
  }

  async testLockCleanup() {
    await this.runTest('Lock Cleanup - Stale Lock Detection', async () => {
      const videoId = 'TEST-CLEANUP-001';
      
      // Acquire lock
      await lockManager.acquireLock(videoId, 'videoProcessing');
      
      // Manually set timestamp to make it stale
      const lockKey = `videoProcessing:${videoId}`;
      const lock = lockManager.locks.get(lockKey);
      if (lock) {
        lock.timestamp = Date.now() - (lockManager.lockTimeouts.videoProcessing + 1000); // Make it stale
        lockManager.locks.set(lockKey, lock);
      }

      // Check if lock is considered stale
      const isLocked = lockManager.isLocked(videoId, 'videoProcessing');
      if (isLocked) {
        throw new Error('Stale lock should be considered unlocked');
      }
    });
  }

  async testSystemStatus() {
    await this.runTest('System Status - Status Reporting', async () => {
      const videoId = 'TEST-STATUS-001';
      
      // Create some test locks and cooldowns
      await lockManager.acquireLock(videoId, 'videoProcessing');
      lockManager.setCooldown(videoId, 'scriptRegeneration');
      lockManager.acquireCronMutex('testJob');

      // Get status
      const status = lockManager.getStatus();
      
      if (status.locks.active < 1) {
        throw new Error('Should have at least 1 active lock');
      }

      if (status.cooldowns.active < 1) {
        throw new Error('Should have at least 1 active cooldown');
      }

      if (status.cronMutexes.active < 1) {
        throw new Error('Should have at least 1 active cron mutex');
      }

      // Cleanup
      lockManager.releaseLock(videoId, 'videoProcessing');
      lockManager.clearCooldown(videoId, 'scriptRegeneration');
      lockManager.releaseCronMutex('testJob');
    });
  }

  async runAllTests() {
    try {
      logger.info('🚀 Starting comprehensive lock system tests...');
      
      await this.testProcessingLocks();
      await this.testCooldownSystem();
      await this.testCronMutex();
      await this.testGoogleSheetsIntegration();
      await this.testLockCleanup();
      await this.testSystemStatus();
      
      // Final cleanup
      lockManager.clearAll();
      
      logger.info('\n📊 Test Results Summary:');
      logger.info(`✅ Passed: ${this.testResults.passed}`);
      logger.info(`❌ Failed: ${this.testResults.failed}`);
      logger.info(`📋 Total: ${this.testResults.tests.length}`);
      
      if (this.testResults.failed > 0) {
        logger.info('\n❌ Failed Tests:');
        this.testResults.tests
          .filter(t => t.status === 'FAILED')
          .forEach(t => logger.info(`  - ${t.name}: ${t.error}`));
      }
      
      const success = this.testResults.failed === 0;
      logger.info(`\n🎯 Overall Result: ${success ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
      
      return {
        success,
        results: this.testResults,
        lockSystemStatus: lockManager.getStatus()
      };
      
    } catch (error) {
      logger.error('❌ Test execution failed:', error);
      return {
        success: false,
        error: error.message,
        results: this.testResults
      };
    }
  }
}

// Run tests if script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new LockSystemTester();
  
  tester.runAllTests()
    .then(results => {
      process.exit(results.success ? 0 : 1);
    })
    .catch(error => {
      logger.error('Test runner error:', error);
      process.exit(1);
    });
}

export default LockSystemTester;