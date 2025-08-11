#!/usr/bin/env node
/**
 * Test Workflow with Telegram Fixes
 * Simulates a complete workflow to verify Telegram issues don't interrupt processing
 */

import TelegramService from '../src/services/telegramService.js';
import WorkflowService from '../src/services/workflowService.js';
import logger from '../src/utils/logger.js';

class WorkflowTelegramTest {
  constructor() {
    this.telegramService = new TelegramService();
    this.workflowService = new WorkflowService();
  }

  async testWorkflowResilience() {
    console.log('🎬 Testing Workflow Resilience with Telegram Fixes...\n');

    try {
      // Test 1: Simulate video processing started notification
      await this.testVideoProcessingStarted();
      
      // Test 2: Simulate script generation notification
      await this.testScriptGeneration();
      
      // Test 3: Simulate error notification (non-critical)
      await this.testErrorNotification();
      
      // Test 4: Test workflow helper method
      await this.testWorkflowHelperMethods();
      
      console.log('✅ All workflow tests completed successfully!');
      console.log('🎯 Key Result: Workflow would continue regardless of Telegram status');
      
    } catch (error) {
      console.error('❌ Workflow test failed:', error.message);
      logger.error('Workflow telegram test error:', {
        error: error.message,
        stack: error.stack
      });
    }
  }

  async testVideoProcessingStarted() {
    console.log('1️⃣ Testing Video Processing Started Notification...');
    
    try {
      const mockVideoData = {
        title: 'Test Video - Telegram Fix Verification',
        channelTitle: 'Test Channel',
        duration: '5:30',
        displayTitle: 'VID-TEST - Test Video'
      };
      
      const mockMasterSheetUrl = 'https://docs.google.com/spreadsheets/d/test-master-sheet';
      
      // This should use the enhanced sendNotificationSafe method
      const result = await this.telegramService.sendNotificationSafe(
        `🎬 <b>Processing Started</b>\n\n📹 ${mockVideoData.displayTitle}\n📺 ${mockVideoData.channelTitle}\n⏱️ ${mockVideoData.duration}\n\n📊 <a href="${mockMasterSheetUrl}">View Master Sheet</a>`,
        { parse_mode: 'HTML', disable_web_page_preview: true },
        'Video Processing Started: VID-TEST'
      );
      
      if (result && result.message_id) {
        console.log('   ✅ Video processing notification sent successfully');
        console.log('   📨 Message ID:', result.message_id);
      } else if (result && result.graceful_degradation) {
        console.log('   ⚠️ Notification failed gracefully - workflow would continue');
        console.log('   📊 Context:', result.context);
      } else {
        console.log('   ❓ Unexpected result:', result);
      }
      
    } catch (error) {
      console.log('   ❌ CRITICAL: Video processing notification threw exception');
      console.log('   🚨 This should not happen with graceful degradation');
      throw error;
    }
    
    console.log();
  }

  async testScriptGeneration() {
    console.log('2️⃣ Testing Script Generation Notification...');
    
    try {
      const mockWorkbookUrl = 'https://docs.google.com/spreadsheets/d/test-workbook';
      const mockMasterSheetUrl = 'https://docs.google.com/spreadsheets/d/test-master-sheet';
      const mockKeywords = {
        primaryKeywords: ['test automation', 'telegram fix', 'workflow resilience'],
        trendingHashtags: ['#testing', '#automation', '#resilience']
      };
      
      // Test the workflow helper method
      const scriptMessage = this.workflowService.buildScriptGeneratedMessage(
        'VID-TEST',
        'Test Video - Telegram Fix Verification',
        mockWorkbookUrl,
        mockMasterSheetUrl,
        mockKeywords
      );
      
      console.log('   📝 Generated script message preview:');
      console.log('   ' + scriptMessage.split('\n')[0]); // First line only
      console.log('   ' + scriptMessage.split('\n')[1]); // Second line only
      console.log('   ... (message continues with keywords and links)');
      
      const result = await this.telegramService.sendNotificationSafe(
        scriptMessage,
        { parse_mode: 'HTML', disable_web_page_preview: true },
        'Script Generated: VID-TEST'
      );
      
      if (result && result.message_id) {
        console.log('   ✅ Script generation notification sent successfully');
        console.log('   📨 Message ID:', result.message_id);
      } else if (result && result.graceful_degradation) {
        console.log('   ⚠️ Notification failed gracefully - workflow would continue');
        console.log('   📊 Context:', result.context);
      }
      
    } catch (error) {
      console.log('   ❌ CRITICAL: Script generation notification threw exception');
      throw error;
    }
    
    console.log();
  }

  async testErrorNotification() {
    console.log('3️⃣ Testing Error Notification (Non-Critical)...');
    
    try {
      const mockErrorMessage = `❌ <b>Processing Error (Non-Critical Test)</b>

🎬 <b>Video:</b> VID-TEST - Test Video
🔧 <b>Stage:</b> Image Generation  
⚠️ <b>Error:</b> Mock error for testing graceful degradation

<i>This is a test error - workflow continues regardless of notification status.</i>`;

      const result = await this.telegramService.sendNotificationSafe(
        mockErrorMessage,
        { parse_mode: 'HTML' },
        'Error Notification Test'
      );
      
      if (result && result.message_id) {
        console.log('   ✅ Error notification sent successfully');
        console.log('   📨 Message ID:', result.message_id);
      } else if (result && result.graceful_degradation) {
        console.log('   ⚠️ Error notification failed gracefully');
        console.log('   🎯 Key Point: Even error notifications failing won\'t stop workflow');
      }
      
    } catch (error) {
      console.log('   ❌ CRITICAL: Error notification threw exception');
      throw error;
    }
    
    console.log();
  }

  async testWorkflowHelperMethods() {
    console.log('4️⃣ Testing Workflow Integration...');
    
    try {
      // Test buildScriptGeneratedMessage helper
      const testMessage = this.workflowService.buildScriptGeneratedMessage(
        'VID-TEST',
        'Integration Test Video',
        'https://docs.google.com/spreadsheets/d/test',
        'https://docs.google.com/spreadsheets/d/master',
        {
          primaryKeywords: ['integration', 'testing'],
          trendingHashtags: ['#integration', '#testing']
        }
      );
      
      console.log('   ✅ buildScriptGeneratedMessage helper working');
      console.log('   📏 Generated message length:', testMessage.length, 'characters');
      
      // Verify message contains expected components
      const hasVideoId = testMessage.includes('VID-TEST');
      const hasTitle = testMessage.includes('Integration Test Video');
      const hasKeywords = testMessage.includes('integration');
      const hasLinks = testMessage.includes('Review & Approve Script');
      
      console.log('   📋 Message components check:');
      console.log('      Video ID:', hasVideoId ? '✅' : '❌');
      console.log('      Title:', hasTitle ? '✅' : '❌');
      console.log('      Keywords:', hasKeywords ? '✅' : '❌');
      console.log('      Action Links:', hasLinks ? '✅' : '❌');
      
      if (hasVideoId && hasTitle && hasKeywords && hasLinks) {
        console.log('   ✅ All message components present');
      } else {
        console.log('   ⚠️ Some message components missing');
      }
      
    } catch (error) {
      console.log('   ❌ Workflow helper method test failed:', error.message);
      throw error;
    }
    
    console.log();
  }

  async runStressTest() {
    console.log('💪 Running Telegram Stress Test...\n');
    
    const messageCount = 5;
    const successCount = { sent: 0, graceful: 0, failed: 0 };
    
    for (let i = 1; i <= messageCount; i++) {
      console.log(`📨 Sending test message ${i}/${messageCount}...`);
      
      try {
        const testMessage = `🔄 <b>Stress Test Message ${i}/${messageCount}</b>

⏰ <b>Time:</b> ${new Date().toISOString()}
🧪 <b>Test:</b> Rapid fire messaging
💪 <b>Purpose:</b> Verify system handles multiple notifications

<i>Testing enhanced retry logic and graceful degradation under load.</i>`;

        const result = await this.telegramService.sendNotificationSafe(
          testMessage,
          { parse_mode: 'HTML' },
          `Stress Test ${i}/${messageCount}`
        );
        
        if (result && result.message_id) {
          successCount.sent++;
          console.log(`   ✅ Message ${i} sent (ID: ${result.message_id})`);
        } else if (result && result.graceful_degradation) {
          successCount.graceful++;
          console.log(`   ⚠️ Message ${i} failed gracefully`);
        } else {
          successCount.failed++;
          console.log(`   ❌ Message ${i} unexpected result`);
        }
        
        // Small delay to avoid overwhelming
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        successCount.failed++;
        console.log(`   ❌ Message ${i} threw exception: ${error.message}`);
      }
    }
    
    console.log('\n📊 Stress Test Results:');
    console.log(`   📤 Successfully Sent: ${successCount.sent}/${messageCount}`);
    console.log(`   🛡️ Gracefully Handled: ${successCount.graceful}/${messageCount}`);
    console.log(`   ❌ Failed: ${successCount.failed}/${messageCount}`);
    
    const reliabilityRate = ((successCount.sent + successCount.graceful) / messageCount) * 100;
    console.log(`   🎯 System Reliability: ${reliabilityRate.toFixed(1)}%`);
    
    if (reliabilityRate >= 100) {
      console.log('   ✅ Perfect reliability - all messages handled appropriately');
    } else if (reliabilityRate >= 80) {
      console.log('   ✅ Good reliability - system working as expected');
    } else {
      console.log('   ⚠️ Reliability concerns - check error logs');
    }
  }
}

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new WorkflowTelegramTest();
  
  const runStress = process.argv.includes('--stress');
  
  if (runStress) {
    tester.runStressTest().catch(console.error);
  } else {
    tester.testWorkflowResilience().catch(console.error);
  }
}

export default WorkflowTelegramTest;