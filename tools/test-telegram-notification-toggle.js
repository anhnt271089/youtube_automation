#!/usr/bin/env node

/**
 * Test script for Telegram notification toggle functionality
 * 
 * This script tests that the TELEGRAM_NOTIFICATIONS_ENABLED toggle
 * works correctly for all notification methods.
 */

import dotenv from 'dotenv';
import { config } from '../config/config.js';
import TelegramService from '../src/services/telegramService.js';
import logger from '../src/utils/logger.js';

// Load environment variables
dotenv.config();

async function testTelegramToggle() {
  logger.info('🧪 Testing Telegram notification toggle functionality...');
  
  try {
    // Test 1: Check current configuration
    logger.info('\n📋 Test 1: Configuration Check');
    logger.info(`Notifications Enabled: ${config.telegram.notificationsEnabled}`);
    logger.info(`Environment Variable: ${process.env.TELEGRAM_NOTIFICATIONS_ENABLED}`);
    
    // Create Telegram service instance
    const telegramService = new TelegramService();
    
    // Test 2: Test basic notification method with current setting
    logger.info('\n📋 Test 2: Test Basic Notification');
    const testVideoData = {
      title: 'Test Video for Toggle Testing',
      displayTitle: 'Toggle Test Video',
      channelTitle: 'Test Channel',
      duration: '10:30'
    };
    
    const result1 = await telegramService.sendVideoProcessingStarted(testVideoData, 'https://test-sheet-url.com');
    
    if (result1 && result1.skipped) {
      logger.info('✅ Notification correctly skipped (notifications disabled)');
      logger.info(`   Reason: ${result1.reason}`);
    } else if (result1 && result1.message_id) {
      logger.info('✅ Notification sent successfully (notifications enabled)');
      logger.info(`   Message ID: ${result1.message_id}`);
    } else {
      logger.warn('⚠️ Unexpected result format:', result1);
    }
    
    // Test 3: Test error notification
    logger.info('\n📋 Test 3: Test Error Notification');
    const result2 = await telegramService.sendError(
      'Test Video Error',
      'This is a test error message',
      'Testing Stage',
      'https://test-sheet-url.com'
    );
    
    if (result2 && result2.skipped) {
      logger.info('✅ Error notification correctly skipped (notifications disabled)');
    } else if (result2 && result2.message_id) {
      logger.info('✅ Error notification sent successfully (notifications enabled)');
    } else {
      logger.warn('⚠️ Unexpected error notification result:', result2);
    }
    
    // Test 4: Test safe notification method
    logger.info('\n📋 Test 4: Test Safe Notification Method');
    const result3 = await telegramService.sendNotificationSafe(
      '🧪 This is a test safe notification',
      {},
      'toggle-test'
    );
    
    if (result3 && result3.skipped) {
      logger.info('✅ Safe notification correctly skipped (notifications disabled)');
      logger.info(`   Context: ${result3.context}`);
    } else if (result3 && result3.message_id) {
      logger.info('✅ Safe notification sent successfully (notifications enabled)');
    } else {
      logger.warn('⚠️ Unexpected safe notification result:', result3);
    }
    
    // Test 5: Test checkNotificationsEnabled method directly
    logger.info('\n📋 Test 5: Test checkNotificationsEnabled Method');
    const isEnabled = telegramService.checkNotificationsEnabled('direct-test');
    logger.info(`✅ Direct check result: ${isEnabled}`);
    
    // Test Summary
    logger.info('\n📊 Test Summary:');
    logger.info(`Configuration setting: TELEGRAM_NOTIFICATIONS_ENABLED=${process.env.TELEGRAM_NOTIFICATIONS_ENABLED || 'undefined'}`);
    logger.info(`Parsed value: ${config.telegram.notificationsEnabled}`);
    logger.info(`Service notifications enabled: ${telegramService.notificationsEnabled}`);
    
    if (config.telegram.notificationsEnabled) {
      logger.info('🔊 Notifications are ENABLED - messages will be sent to Telegram');
      logger.info('💡 To disable: Set TELEGRAM_NOTIFICATIONS_ENABLED=false in .env');
    } else {
      logger.info('🔇 Notifications are DISABLED - messages will be logged only');
      logger.info('💡 To enable: Set TELEGRAM_NOTIFICATIONS_ENABLED=true in .env (or remove the line)');
    }
    
    logger.info('\n✅ Telegram notification toggle test completed successfully!');
    
  } catch (error) {
    logger.error('❌ Telegram toggle test failed:', {
      error: error.message,
      stack: error.stack,
      notificationsEnabled: config.telegram.notificationsEnabled
    });
    process.exit(1);
  }
}

// Instructions for manual testing
function printTestInstructions() {
  logger.info('\n📖 Manual Testing Instructions:');
  logger.info('1. Check your current .env file for TELEGRAM_NOTIFICATIONS_ENABLED setting');
  logger.info('2. Run this script to see current behavior');
  logger.info('3. Change TELEGRAM_NOTIFICATIONS_ENABLED to opposite value');
  logger.info('4. Run script again to verify toggle works');
  logger.info('5. Values to test:');
  logger.info('   - TELEGRAM_NOTIFICATIONS_ENABLED=true (should send messages)');
  logger.info('   - TELEGRAM_NOTIFICATIONS_ENABLED=false (should skip messages)');
  logger.info('   - Comment out line (should default to true)');
  logger.info('');
}

// Run the test
if (import.meta.url === `file://${process.argv[1]}`) {
  printTestInstructions();
  testTelegramToggle();
}

export { testTelegramToggle };