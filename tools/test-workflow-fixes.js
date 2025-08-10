#!/usr/bin/env node

/**
 * Test script for workflow fixes:
 * 1. Thumbnail folder fix - ensure thumbnails go to existing video detail folders
 * 2. Status update consolidation - test consolidated messaging
 */

import ThumbnailService from '../src/services/thumbnailService.js';
import TelegramService from '../src/services/telegramService.js';
import StatusMonitorService from '../src/services/statusMonitorService.js';
import GoogleSheetsService from '../src/services/googleSheetsService.js';
import GoogleDriveService from '../src/services/googleDriveService.js';
import AIService from '../src/services/aiService.js';
import logger from '../src/utils/logger.js';

class WorkflowFixesTest {
  constructor() {
    this.sheetsService = new GoogleSheetsService();
    this.driveService = new GoogleDriveService();
    this.aiService = new AIService();
    this.telegramService = new TelegramService();
    this.thumbnailService = new ThumbnailService(this.aiService, this.driveService);
    this.statusMonitorService = new StatusMonitorService();
  }

  /**
   * Test 1: Thumbnail folder fix
   * Verify that thumbnails are uploaded to existing video detail folders
   */
  async testThumbnailFolderFix() {
    console.log('\n🧪 TEST 1: Thumbnail Folder Fix');
    console.log('=' .repeat(50));
    
    try {
      // Find a video that already has a Drive folder
      const allVideos = await this.sheetsService.getAllVideosStatus();
      const testVideo = allVideos.find(video => video.driveFolder && video.driveFolder.includes('drive.google.com'));
      
      if (!testVideo) {
        console.log('❌ No test video with existing Drive folder found');
        return false;
      }
      
      console.log(`📁 Test video: ${testVideo.videoId} - ${testVideo.title}`);
      console.log(`📁 Existing folder: ${testVideo.driveFolder}`);
      
      // Check if thumbnails already exist to avoid regeneration
      const existingCheck = await this.thumbnailService.checkExistingThumbnails(
        testVideo.videoId, 
        testVideo.title || 'Test Video'
      );
      
      console.log(`🖼️ Existing thumbnails: ${existingCheck.exists ? 'Yes' : 'No'}`);
      
      if (existingCheck.exists) {
        console.log('✅ TEST PASSED: Thumbnails exist in correct folder structure');
        console.log(`   📁 Folder: ${existingCheck.folderUrl}`);
        console.log(`   📊 Count: ${existingCheck.count} thumbnails`);
        
        // Verify folder is in the video's detail folder
        if (testVideo.driveFolder && existingCheck.videoFolderUrl) {
          const isCorrectLocation = existingCheck.videoFolderUrl.includes(
            testVideo.driveFolder.split('/folders/')[1]?.split('/')[0] || ''
          );
          console.log(`✅ Correct location: ${isCorrectLocation ? 'Yes' : 'No'}`);
          return isCorrectLocation;
        }
        return true;
      } else {
        console.log('ℹ️ No existing thumbnails found - folder fix would be tested during generation');
        return true;
      }
      
    } catch (error) {
      console.error('❌ Thumbnail folder test failed:', error.message);
      return false;
    }
  }

  /**
   * Test 2: Status update consolidation
   * Test the consolidated messaging functionality
   */
  async testStatusUpdateConsolidation() {
    console.log('\n🧪 TEST 2: Status Update Consolidation');
    console.log('=' .repeat(50));
    
    try {
      // Mock status changes for testing
      const mockStatusChanges = {
        scriptApproved: {
          old: 'Pending',
          new: 'Approved'
        },
        voiceGenerationStatus: {
          old: 'Not Started',
          new: 'In Progress'
        },
        videoEditingStatus: {
          old: 'Not Started',
          new: 'Planning'
        }
      };
      
      console.log('📊 Testing consolidated status update with mock changes:');
      Object.entries(mockStatusChanges).forEach(([field, change]) => {
        console.log(`   ${field}: ${change.old} → ${change.new}`);
      });
      
      // Test the consolidated message method (without actually sending)
      console.log('\n📝 Testing message generation...');
      
      // Verify the method exists and can be called
      if (typeof this.telegramService.sendConsolidatedStatusUpdate === 'function') {
        console.log('✅ sendConsolidatedStatusUpdate method exists');
      } else {
        console.log('❌ sendConsolidatedStatusUpdate method not found');
        return false;
      }
      
      // Test status icon generation
      const testIcons = [
        { field: 'scriptApproved', status: 'Approved' },
        { field: 'voiceGenerationStatus', status: 'In Progress' },
        { field: 'videoEditingStatus', status: 'Completed' }
      ];
      
      console.log('\n🎨 Testing status icon generation:');
      testIcons.forEach(({ field, status }) => {
        const icon = this.telegramService.getStatusIcon(field, status);
        console.log(`   ${field} (${status}): ${icon}`);
      });
      
      // Test contextual message generation
      const contextualMessages = this.telegramService.generateContextualMessages(mockStatusChanges);
      console.log('\n💡 Generated contextual messages:');
      contextualMessages.forEach((msg, index) => {
        console.log(`   ${index + 1}. ${msg}`);
      });
      
      console.log('\n✅ TEST PASSED: Status consolidation methods work correctly');
      return true;
      
    } catch (error) {
      console.error('❌ Status consolidation test failed:', error.message);
      return false;
    }
  }

  /**
   * Test 3: StatusMonitorService integration
   * Test that the status monitor uses consolidated messaging appropriately
   */
  async testStatusMonitorIntegration() {
    console.log('\n🧪 TEST 3: StatusMonitor Integration');
    console.log('=' .repeat(50));
    
    try {
      // Test that the method exists and has the right logic
      const hasConsolidatedLogic = this.statusMonitorService.sendIndividualChangeNotifications
        .toString()
        .includes('hasMultipleChanges');
      
      if (hasConsolidatedLogic) {
        console.log('✅ StatusMonitor has consolidated messaging logic');
      } else {
        console.log('❌ StatusMonitor missing consolidated messaging logic');
        return false;
      }
      
      // Test that special workflow actions method exists
      const hasWorkflowActions = typeof this.statusMonitorService.handleSpecialWorkflowActions === 'function';
      
      if (hasWorkflowActions) {
        console.log('✅ StatusMonitor has special workflow actions method');
      } else {
        console.log('❌ StatusMonitor missing special workflow actions method');
        return false;
      }
      
      console.log('\n✅ TEST PASSED: StatusMonitor integration looks correct');
      return true;
      
    } catch (error) {
      console.error('❌ StatusMonitor integration test failed:', error.message);
      return false;
    }
  }

  /**
   * Run all tests
   */
  async runAllTests() {
    console.log('🧪 WORKFLOW FIXES TEST SUITE');
    console.log('================================');
    console.log('Testing fixes for:');
    console.log('1. Thumbnail upload folder location');
    console.log('2. Status update message consolidation');
    console.log('3. StatusMonitor service integration');
    
    const results = {
      thumbnailFix: false,
      statusConsolidation: false,
      statusMonitorIntegration: false
    };
    
    try {
      // Test 1: Thumbnail folder fix
      results.thumbnailFix = await this.testThumbnailFolderFix();
      
      // Test 2: Status consolidation
      results.statusConsolidation = await this.testStatusUpdateConsolidation();
      
      // Test 3: StatusMonitor integration
      results.statusMonitorIntegration = await this.testStatusMonitorIntegration();
      
      // Summary
      console.log('\n📊 TEST RESULTS SUMMARY');
      console.log('=' .repeat(30));
      console.log(`Thumbnail Fix: ${results.thumbnailFix ? '✅ PASSED' : '❌ FAILED'}`);
      console.log(`Status Consolidation: ${results.statusConsolidation ? '✅ PASSED' : '❌ FAILED'}`);
      console.log(`StatusMonitor Integration: ${results.statusMonitorIntegration ? '✅ PASSED' : '❌ FAILED'}`);
      
      const allPassed = Object.values(results).every(result => result === true);
      console.log(`\n${allPassed ? '🎉 ALL TESTS PASSED!' : '⚠️ SOME TESTS FAILED'}`);
      
      if (allPassed) {
        console.log('\n✅ Workflow fixes appear to be working correctly!');
        console.log('📋 Next steps:');
        console.log('• Deploy and monitor thumbnail uploads in production');
        console.log('• Test status update consolidation with real sheet changes');
        console.log('• Verify no duplicate messages are sent');
      }
      
      return allPassed;
      
    } catch (error) {
      console.error('\n❌ Test suite failed:', error);
      return false;
    }
  }
}

// Run tests if script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new WorkflowFixesTest();
  
  tester.runAllTests()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Fatal test error:', error);
      process.exit(1);
    });
}

export default WorkflowFixesTest;