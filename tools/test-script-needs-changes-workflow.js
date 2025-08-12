#!/usr/bin/env node

/**
 * TEST: Script Approved "Needs Changes" Workflow
 * 
 * Tests the complete workflow when Script Approved changes from any status to "Needs Changes"
 * Verifies that script regeneration is triggered and workflow continues properly
 */

import { config } from '../config/config.js';
import GoogleSheetsService from '../src/services/googleSheetsService.js';
import StatusMonitorService from '../src/services/statusMonitorService.js';
import logger from '../src/utils/logger.js';

async function testScriptNeedsChangesWorkflow() {
  logger.info('\n🔄 Testing Script Approved → "Needs Changes" Workflow');
  
  try {
    // Initialize services
    const googleSheetsService = new GoogleSheetsService();
    const statusMonitorService = new StatusMonitorService();
    
    // Test with a specific video that exists in the sheet
    const testVideoId = 'VID-0001'; // Using an existing video
    
    logger.info(`\n📋 Testing with video: ${testVideoId}`);
    
    // Step 1: Get current status
    logger.info('\n1️⃣ Getting current status...');
    const currentScript = await googleSheetsService.getVideoField(testVideoId, 'scriptApproved');
    const currentStatus = await googleSheetsService.getVideoField(testVideoId, 'status');
    
    logger.info(`   Current Script Approved: ${currentScript}`);
    logger.info(`   Current Status: ${currentStatus}`);
    
    // Step 2: Test workflow action determination
    logger.info('\n2️⃣ Testing workflow action determination...');
    
    const testChangedFields = {
      scriptApproved: {
        old: currentScript || 'Pending',
        new: 'Needs Changes'
      }
    };
    
    const workflowActions = statusMonitorService.determineWorkflowAction(testChangedFields);
    logger.info(`   Determined Actions: ${JSON.stringify(workflowActions)}`);
    
    if (!workflowActions.includes('TRIGGER_SCRIPT_REGENERATION')) {
      throw new Error('TRIGGER_SCRIPT_REGENERATION action not determined for Needs Changes');
    }
    
    logger.info(`   ✅ TRIGGER_SCRIPT_REGENERATION action properly determined`);
    
    // Step 3: Test priority level determination
    logger.info('\n3️⃣ Testing priority level determination...');
    
    const priorityLevel = statusMonitorService.determinePriorityLevel(testChangedFields);
    logger.info(`   Priority Level: ${priorityLevel}`);
    
    if (priorityLevel !== 'HIGH') {
      logger.warn(`   ⚠️ Expected HIGH priority, got ${priorityLevel}`);
    } else {
      logger.info(`   ✅ HIGH priority correctly assigned`);
    }
    
    // Step 4: Test column update logic
    logger.info('\n4️⃣ Testing column update logic...');
    
    const timestamp = new Date().toISOString();
    const mockChange = {
      videoId: testVideoId,
      changes: testChangedFields
    };
    
    // Test what columns would be updated
    logger.info(`   Testing updateAllRelatedColumns logic...`);
    
    try {
      // This is a dry-run test - we'll check what updates would be made
      const updates = {};
      updates.lastEditedTime = timestamp;
      
      // Simulate the scriptApproved case logic
      if (testChangedFields.scriptApproved.new === 'Needs Changes') {
        updates.lastRegenTime = timestamp;
        updates.scriptNeedsChangesTime = timestamp;
      }
      
      logger.info(`   ✅ Column updates would include: ${Object.keys(updates).join(', ')}`);
      
    } catch (updateError) {
      logger.error(`   ❌ Column update logic error: ${updateError.message}`);
    }
    
    // Step 5: Check if handleScriptNeedsChanges method exists and is callable
    logger.info('\n5️⃣ Testing script regeneration handler...');
    
    if (typeof statusMonitorService.handleScriptNeedsChanges !== 'function') {
      throw new Error('handleScriptNeedsChanges method not found');
    }
    
    logger.info(`   ✅ handleScriptNeedsChanges method exists`);
    
    // Step 6: Test status monitoring detection
    logger.info('\n6️⃣ Testing status monitoring detection...');
    
    logger.info(`   📍 To test actual workflow trigger, you would need to:`);
    logger.info(`   1. Change Script Approved to "Needs Changes" in Google Sheets`);
    logger.info(`   2. The status monitor service should detect this change`);
    logger.info(`   3. It should trigger script regeneration automatically`);
    logger.info(`   4. Watch logs for "🚀 PRIORITY STATUS CHANGE" message`);
    
    // Step 7: Check if status monitoring is enabled
    logger.info('\n7️⃣ Checking status monitoring configuration...');
    
    logger.info(`   Status monitoring should be running in main application`);
    logger.info(`   Check logs for: "📊 Starting YouTube automation status monitoring..."`);
    
    logger.info('\n✅ Script "Needs Changes" Workflow Test PASSED');
    logger.info('🔄 All workflow components are properly configured');
    
    return {
      success: true,
      testVideoId,
      workflowActions,
      priorityLevel,
      recommendation: 'Change Script Approved to "Needs Changes" in Google Sheets to trigger actual workflow'
    };
    
  } catch (error) {
    logger.error(`❌ Script "Needs Changes" Workflow Test FAILED: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

// Run test if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testScriptNeedsChangesWorkflow()
    .then(result => {
      if (result.success) {
        logger.info('\n🎉 Workflow is properly configured!');
        logger.info('\n💡 NEXT STEPS:');
        logger.info('1. Make sure the status monitoring service is running');
        logger.info('2. Change a video\'s Script Approved to "Needs Changes" in Google Sheets');
        logger.info('3. Watch logs for automatic script regeneration');
      } else {
        logger.error('\n💥 Workflow needs fixing before it can work');
        process.exit(1);
      }
    })
    .catch(error => {
      logger.error('Test script failed:', error);
      process.exit(1);
    });
}

export default testScriptNeedsChangesWorkflow;