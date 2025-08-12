#!/usr/bin/env node

/**
 * Test script to verify the Column Z mapping fix
 * This script tests that status updates no longer attempt to write to column Z
 */

import GoogleSheetsService from '../src/services/googleSheetsService.js';
import StatusMonitorService from '../src/services/statusMonitorService.js';
import logger from '../src/utils/logger.js';

async function testColumnZFix() {
  console.log('🧪 Testing Column Z Fix - VID-0003 Status Update');
  console.log('='.repeat(60));

  try {
    const googleSheetsService = new GoogleSheetsService();
    const statusMonitorService = new StatusMonitorService();

    // Test 1: Try updating VID-0003 with errorTime field (the problematic field)
    console.log('🔍 Test 1: Updating VID-0003 with errorTime field...');
    
    const testUpdates = {
      errorTime: '2025-08-12T10:30:00',
      lastEditedTime: '2025-08-12T10:30:00'
    };

    await googleSheetsService.updateVideoFields('VID-0003', testUpdates);
    console.log('✅ SUCCESS: updateVideoFields completed without column Z error');

    // Test 2: Verify only supported timestamp fields work
    console.log('\n🔍 Test 2: Testing all timestamp fields...');
    
    const allTimestampUpdates = {
      scriptApprovedTime: '2025-08-12T10:30:00',     // Column R (17) - Should work
      scriptNeedsChangesTime: '2025-08-12T10:30:00', // Column S (18) - Should work  
      voiceStartedTime: '2025-08-12T10:30:00',       // Column T (19) - Should work
      voiceCompletedTime: '2025-08-12T10:30:00',     // Column U (20) - Should be skipped
      videoEditingStartedTime: '2025-08-12T10:30:00', // Column V (21) - Should be skipped
      videoEditingCompletedTime: '2025-08-12T10:30:00', // Column W (22) - Should be skipped
      processingStartedTime: '2025-08-12T10:30:00',  // Column X (23) - Should be skipped
      processingCompletedTime: '2025-08-12T10:30:00', // Column Y (24) - Should be skipped
      errorTime: '2025-08-12T10:30:00'               // Column Z (25) - Should be skipped
    };

    await googleSheetsService.updateVideoFields('VID-0003', allTimestampUpdates);
    console.log('✅ SUCCESS: All timestamp field updates handled without errors');
    console.log('💡 Fields beyond column T (20) should have been skipped with warnings');

    // Test 3: Simulate the original StatusMonitorService error scenario
    console.log('\n🔍 Test 3: Simulating StatusMonitorService error scenario...');
    
    const errorStatusChange = {
      videoId: 'VID-0003',
      title: 'Test Video',
      changes: {
        status: {
          old: 'Processing',
          new: 'Error'
        }
      }
    };

    // This should trigger the errorTime update but now it should be handled gracefully
    await statusMonitorService.updateAllRelatedColumns(errorStatusChange);
    console.log('✅ SUCCESS: StatusMonitorService error scenario handled without column Z error');

    console.log('\n🎉 ALL TESTS PASSED!');
    console.log('🔧 The Column Z mapping issue has been successfully fixed.');
    console.log('📊 Google Sheets updates are now limited to columns A-T (20 columns max)');
    console.log('⚠️  Extended timestamp fields (U-Z) are gracefully skipped with warnings');

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    console.error('\n🔍 Error Details:');
    console.error(error);
    
    if (error.message.includes('Range (Videos!Z4) exceeds grid limits')) {
      console.error('\n❌ COLUMN Z ERROR STILL EXISTS!');
      console.error('🔧 The fix was not properly applied or there are other column Z references');
    } else if (error.message.includes('exceeds grid limits')) {
      console.error('\n❌ OTHER COLUMN LIMIT ERROR DETECTED');
      console.error('🔧 Check for other columns beyond the 20-column limit');
    }
    
    process.exit(1);
  }
}

// Run the test
testColumnZFix().catch(console.error);