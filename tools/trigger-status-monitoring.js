#!/usr/bin/env node

/**
 * MANUAL TRIGGER: Status Monitoring
 * 
 * Manually triggers the status monitoring service to detect changes immediately
 * instead of waiting for the 5-minute cron job schedule
 */

import WorkflowService from '../src/services/workflowService.js';
import logger from '../src/utils/logger.js';

async function triggerStatusMonitoring() {
  logger.info('\n🔍 Manually Triggering Status Monitoring');
  
  try {
    // Initialize the workflow service
    const workflowService = new WorkflowService();
    
    logger.info('\n⚡ Running status monitoring immediately...');
    logger.info('   (This normally runs every 5 minutes via cron job)');
    
    // Trigger the same method that the cron job calls
    const result = await workflowService.processStatusChanges();
    
    logger.info('\n📊 Status Monitoring Results:');
    logger.info(`   📊 Changes Detected: ${result.changesDetected || 0}`);
    logger.info(`   🔄 Total Processed: ${result.totalProcessed || 0}`);
    logger.info(`   ⏱️ Processing Time: ${result.processingTime || 'N/A'}`);
    
    if (result.changesDetected > 0) {
      logger.info('\n✅ Status changes detected and processed!');
      logger.info('   Check logs above for detailed workflow actions');
    } else {
      logger.info('\n📋 No status changes detected');
      logger.info('   Either no changes were made, or all changes already processed');
    }
    
    logger.info('\n💡 Next Steps:');
    logger.info('1. If you just changed Script Approved to "Needs Changes", check if workflow was triggered above');
    logger.info('2. If no changes detected, try changing the status in Google Sheets and run this again');
    logger.info('3. Look for "🚨 PRIORITY STATUS CHANGE" and "🚀 Executing workflow action" messages');
    
    return {
      success: true,
      changesDetected: result.changesDetected || 0
    };
    
  } catch (error) {
    logger.error(`❌ Status monitoring trigger failed: ${error.message}`);
    logger.error('Stack trace:', error.stack);
    
    return {
      success: false,
      error: error.message
    };
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  triggerStatusMonitoring()
    .then(result => {
      if (result.success) {
        logger.info('\n🎉 Status monitoring completed successfully!');
        if (result.changesDetected > 0) {
          logger.info('✅ Changes were detected and workflows triggered');
        } else {
          logger.info('📋 No changes found - system is up to date');
        }
      } else {
        logger.error('\n💥 Status monitoring failed');
        process.exit(1);
      }
    })
    .catch(error => {
      logger.error('Manual trigger failed:', error);
      process.exit(1);
    });
}

export default triggerStatusMonitoring;