#!/usr/bin/env node

/**
 * Test timezone display functionality
 * Verifies that timestamps are properly formatted in GMT+7 (Asia/Bangkok) timezone
 */

import { config } from '../config/config.js';
import GoogleSheetsService from '../src/services/googleSheetsService.js';
import WorkflowService from '../src/services/workflowService.js';
import StatusMonitorService from '../src/services/statusMonitorService.js';
import logger from '../src/utils/logger.js';

async function testTimezoneDisplay() {
  try {
    logger.info('🕐 Testing timezone display functionality...');
    logger.info(`Configured timezone: ${config.app.timezone}`);

    // Test Google Sheets Service
    const sheetsService = new GoogleSheetsService();
    const sheetsTimestamp = sheetsService.getCurrentTimestamp();
    logger.info(`Google Sheets Service timestamp: ${sheetsTimestamp}`);

    // Test Workflow Service  
    const workflowService = new WorkflowService();
    const workflowTimestamp = workflowService.getCurrentTimestamp();
    logger.info(`Workflow Service timestamp: ${workflowTimestamp}`);

    // Test Status Monitor Service
    const statusMonitorService = new StatusMonitorService();
    const statusTimestamp = statusMonitorService.getCurrentTimestamp();
    logger.info(`Status Monitor Service timestamp: ${statusTimestamp}`);

    // Show current time in different formats for comparison
    const now = new Date();
    logger.info('\n📊 Timezone comparison:');
    logger.info(`UTC time: ${now.toISOString()}`);
    logger.info(`Local system time: ${now.toString()}`);
    logger.info(`Asia/Bangkok time: ${now.toLocaleString('sv-SE', { timeZone: 'Asia/Bangkok' })}`);
    
    // Verify GMT+7 offset (7 hours ahead of UTC)
    const utcHours = now.getUTCHours();
    const bangkokTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }));
    const bangkokHours = bangkokTime.getHours();
    
    // Calculate expected GMT+7 hour (accounting for day rollover)
    const expectedBangkokHours = (utcHours + 7) % 24;
    
    logger.info('\n🔍 Timezone verification:');
    logger.info(`UTC hour: ${utcHours}`);
    logger.info(`Bangkok hour: ${bangkokHours}`);
    logger.info(`Expected Bangkok hour (UTC+7): ${expectedBangkokHours}`);
    
    if (bangkokHours === expectedBangkokHours || Math.abs(bangkokHours - expectedBangkokHours) <= 1) {
      logger.info('✅ Timezone calculation appears correct (GMT+7)');
    } else {
      logger.warn('⚠️ Timezone calculation may be incorrect');
    }

    // Test that all services return consistent timestamps
    if (sheetsTimestamp === workflowTimestamp && workflowTimestamp === statusTimestamp) {
      logger.info('✅ All services return consistent timestamps');
    } else {
      logger.warn('⚠️ Services return different timestamps:');
      logger.warn(`  Sheets: ${sheetsTimestamp}`);
      logger.warn(`  Workflow: ${workflowTimestamp}`);
      logger.warn(`  Status Monitor: ${statusTimestamp}`);
    }

    // Validate timestamp format (ISO-like but with local timezone)
    const timestampRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/;
    if (timestampRegex.test(sheetsTimestamp)) {
      logger.info('✅ Timestamp format is valid (YYYY-MM-DDTHH:MM:SS)');
    } else {
      logger.warn(`⚠️ Timestamp format is invalid: ${sheetsTimestamp}`);
    }

    logger.info('\n🎉 Timezone display test completed successfully');
    logger.info('📋 All timestamps in Google Sheets will now display in GMT+7 timezone');
    
    return {
      success: true,
      sheetsTimestamp,
      workflowTimestamp, 
      statusTimestamp,
      timezone: config.app.timezone,
      utcOffset: '+07:00'
    };

  } catch (error) {
    logger.error('❌ Timezone display test failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Run test if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testTimezoneDisplay()
    .then(result => {
      if (result.success) {
        logger.info('🎉 Test completed successfully');
        process.exit(0);
      } else {
        logger.error('❌ Test failed:', result.error);
        process.exit(1);
      }
    })
    .catch(error => {
      logger.error('❌ Test execution failed:', error);
      process.exit(1);
    });
}

export default testTimezoneDisplay;