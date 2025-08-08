#!/usr/bin/env node

/**
 * Test script for status monitoring system
 * Usage: node test-status-monitoring.js [command]
 * 
 * Commands:
 * - health: Test health check of all services
 * - cache-refresh: Initialize/refresh the status cache
 * - cache-clear: Clear the status cache
 * - monitor: Run status change monitoring once
 * - test-notifications: Test individual notification methods
 */

import YouTubeAutomation from './src/index.js';
import logger from './src/utils/logger.js';

async function main() {
  const command = process.argv[2] || 'help';
  
  try {
    const automation = new YouTubeAutomation();
    await automation.initialize();

    switch (command) {
      case 'health':
        await testHealthCheck(automation);
        break;
        
      case 'cache-refresh':
        await testCacheRefresh(automation);
        break;
        
      case 'cache-clear':
        await testCacheClear(automation);
        break;
        
      case 'monitor':
        await testStatusMonitoring(automation);
        break;
        
      case 'test-notifications':
        await testNotifications(automation);
        break;
        
      case 'help':
      default:
        printHelp();
        break;
    }

    await automation.stop();
    
  } catch (error) {
    logger.error('Test failed:', error);
    process.exit(1);
  }
}

async function testHealthCheck(automation) {
  console.log('🔍 Testing health check of all services...\n');
  
  try {
    const health = await automation.workflowService.healthCheck();
    
    console.log('📊 Health Check Results:');
    console.log('Overall Health:', health.healthy ? '✅ HEALTHY' : '❌ UNHEALTHY');
    console.log('\nService Status:');
    
    Object.entries(health.services).forEach(([service, status]) => {
      console.log(`  ${service}: ${status ? '✅' : '❌'}`);
    });
    
    if (health.statusMonitoring) {
      console.log('\n📋 Status Monitoring Info:');
      console.log('  Cache Status:', health.statusMonitoring.cacheStatus);
      console.log('  Master Sheet URL:', health.statusMonitoring.masterSheetUrl);
    }
    
    console.log('\n✅ Health check completed successfully');
    
  } catch (error) {
    console.error('❌ Health check failed:', error.message);
    throw error;
  }
}

async function testCacheRefresh(automation) {
  console.log('🔄 Testing status cache refresh...\n');
  
  try {
    const result = await automation.refreshStatusCache();
    console.log('✅ Cache refresh result:', result);
    console.log(`📊 Cached ${result.videoCount} videos`);
    
  } catch (error) {
    console.error('❌ Cache refresh failed:', error.message);
    throw error;
  }
}

async function testCacheClear(automation) {
  console.log('🗑️ Testing status cache clear...\n');
  
  try {
    const result = await automation.clearStatusCache();
    console.log('✅ Cache clear result:', result);
    
  } catch (error) {
    console.error('❌ Cache clear failed:', error.message);
    throw error;
  }
}

async function testStatusMonitoring(automation) {
  console.log('📊 Testing status change monitoring...\n');
  
  try {
    const result = await automation.forceProcessStatusChanges();
    
    console.log('📋 Monitoring Result:');
    console.log('  Success:', result.success ? '✅' : '❌');
    console.log('  Message:', result.message);
    
    if (result.changes && result.changes.length > 0) {
      console.log('\n🔄 Changes Detected:');
      result.changes.forEach((change, index) => {
        console.log(`  ${index + 1}. ${change.videoId} - ${change.title}`);
        Object.entries(change.changes).forEach(([field, changeInfo]) => {
          console.log(`     ${field}: ${changeInfo.old} → ${changeInfo.new}`);
        });
      });
    }
    
    console.log('\n✅ Status monitoring test completed');
    
  } catch (error) {
    console.error('❌ Status monitoring test failed:', error.message);
    throw error;
  }
}

async function testNotifications(automation) {
  console.log('📱 Testing notification methods...\n');
  
  try {
    const telegramService = automation.workflowService.telegramService;
    
    // Test Voice Generation Status notification
    console.log('Testing Voice Generation Status notification...');
    await telegramService.sendVoiceGenerationStatusChanged(
      'VID-TEST',
      'Test Video Title',
      'Not Started',
      'In Progress',
      'https://docs.google.com/spreadsheets/d/test-master-sheet',
      'https://docs.google.com/spreadsheets/d/test-workbook'
    );
    
    // Small delay between notifications
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Test Video Editing Status notification
    console.log('Testing Video Editing Status notification...');
    await telegramService.sendVideoEditingStatusChanged(
      'VID-TEST',
      'Test Video Title',
      'Not Started',
      'First Draft',
      'https://docs.google.com/spreadsheets/d/test-master-sheet',
      'https://docs.google.com/spreadsheets/d/test-workbook',
      'https://drive.google.com/drive/folders/test-folder'
    );
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Test Script Approval notification
    console.log('Testing Script Approval notification...');
    await telegramService.sendScriptApprovedChanged(
      'VID-TEST',
      'Test Video Title',
      'Pending',
      'Approved',
      'https://docs.google.com/spreadsheets/d/test-master-sheet',
      'https://docs.google.com/spreadsheets/d/test-workbook'
    );
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Test Script Regeneration notification
    console.log('Testing Script Regeneration notification...');
    await telegramService.sendScriptRegenerationStarted(
      'VID-TEST',
      'Test Video Title - Script Regeneration Test',
      'https://docs.google.com/spreadsheets/d/test-master-sheet',
      'https://docs.google.com/spreadsheets/d/test-workbook'
    );
    
    console.log('\n✅ All notification tests sent successfully');
    console.log('📱 Check your Telegram for the test messages');
    
  } catch (error) {
    console.error('❌ Notification test failed:', error.message);
    throw error;
  }
}

function printHelp() {
  console.log(`
📊 Status Monitoring Test Suite

Usage: node test-status-monitoring.js [command]

Commands:
  health           - Test health check of all services
  cache-refresh    - Initialize/refresh the status cache
  cache-clear      - Clear the status cache
  monitor          - Run status change monitoring once
  test-notifications - Test individual notification methods
  help             - Show this help message

Examples:
  node test-status-monitoring.js health
  node test-status-monitoring.js cache-refresh
  node test-status-monitoring.js monitor

Setup Instructions:
1. First run: node test-status-monitoring.js cache-refresh
2. Make manual changes in Google Sheets
3. Test monitoring: node test-status-monitoring.js monitor
4. Check Telegram for notifications
`);
}

// Handle uncaught errors
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

// Run the main function
main();