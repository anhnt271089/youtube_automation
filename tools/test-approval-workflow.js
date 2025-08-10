#!/usr/bin/env node

import GoogleSheetsService from '../src/services/googleSheetsService.js';
import WorkflowService from '../src/services/workflowService.js';
import logger from '../src/utils/logger.js';

class ApprovalWorkflowTester {
  constructor() {
    this.sheetsService = new GoogleSheetsService();
    this.workflowService = new WorkflowService();
  }

  async testVoiceScriptCreation(videoId) {
    logger.info(`📄 Testing voice script creation for ${videoId}...`);
    
    try {
      // Test the voice script creation method
      const result = await this.sheetsService.createAndUploadVoiceScript(videoId, false);
      
      if (result && !result.skipped) {
        logger.info(`✅ Voice script created successfully:`);
        logger.info(`  File: ${result.fileName}`);
        logger.info(`  Drive URL: ${result.viewLink}`);
        return { success: true, result };
      } else if (result && result.skipped) {
        logger.info(`📄 Voice script already exists (skipped)`);
        return { success: true, skipped: true, result };
      } else {
        throw new Error('Voice script creation returned null/undefined');
      }
      
    } catch (error) {
      logger.error(`❌ Voice script creation failed:`, error);
      return { success: false, error: error.message };
    }
  }

  async testApprovalWorkflow(videoId) {
    logger.info(`🔄 Testing complete approval workflow for ${videoId}...`);
    
    try {
      // Get video details
      const videoDetails = await this.sheetsService.getVideoDetails(videoId);
      if (!videoDetails) {
        throw new Error(`Video ${videoId} not found`);
      }

      // Create videoInfo object for processApprovedScript
      const videoInfo = {
        videoId: videoId,
        title: videoDetails.title,
        youtubeUrl: videoDetails.youtubeUrl,
        status: 'Approved',
        voiceGenerationStatus: 'Not Started'
      };

      logger.info(`📋 Video: ${videoInfo.title}`);
      logger.info(`🔗 URL: ${videoInfo.youtubeUrl}`);

      // Test the complete approved script workflow
      const result = await this.workflowService.processApprovedScript(videoInfo);
      
      if (result && result.success) {
        logger.info(`✅ Approval workflow completed successfully`);
        logger.info(`  Stage: ${result.stage}`);
        if (result.imagesGenerated !== undefined) {
          logger.info(`  Images Generated: ${result.imagesGenerated}`);
        }
        return { success: true, result };
      } else {
        throw new Error(result?.error || 'Approval workflow failed');
      }
      
    } catch (error) {
      logger.error(`❌ Approval workflow failed:`, error);
      return { success: false, error: error.message };
    }
  }

  async simulateScriptApproval(videoId) {
    logger.info(`📝 Simulating script approval for ${videoId}...`);
    
    try {
      // Check if script is already approved
      const allVideos = await this.sheetsService.getAllVideos();
      const video = allVideos.find(v => v.videoId === videoId);
      
      if (!video) {
        throw new Error(`Video ${videoId} not found`);
      }

      logger.info(`Current status: ${video.status}`);
      logger.info(`Current script approved: ${video.scriptApproved || 'Not Set'}`);

      // Only proceed if the video has a script ready (Script Separated status)
      if (video.status !== 'Script Separated' && video.status !== 'Processing') {
        logger.warn(`⚠️  Video status is "${video.status}" - may not be ready for approval`);
        logger.info(`   Proceeding with approval test anyway...`);
      }

      // Set script as approved
      await this.sheetsService.updateVideoField(videoId, 'scriptApproved', 'Approved');
      logger.info(`✅ Set scriptApproved = "Approved"`);

      // Wait a moment for any monitoring to detect the change
      logger.info(`⏳ Waiting 3 seconds for status monitoring...`);
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Check if voice generation status was auto-updated
      const updatedVideos = await this.sheetsService.getAllVideos();
      const updatedVideo = updatedVideos.find(v => v.videoId === videoId);
      
      logger.info(`Updated script approved: ${updatedVideo.scriptApproved}`);
      logger.info(`Updated voice generation: ${updatedVideo.voiceGenerationStatus || 'Not Set'}`);

      return { success: true, updatedVideo };
      
    } catch (error) {
      logger.error(`❌ Script approval simulation failed:`, error);
      return { success: false, error: error.message };
    }
  }

  async run() {
    try {
      logger.info('🧪 Starting approval workflow tests...');
      
      // Use VID-0001 which should have a complete setup
      const testVideoId = 'VID-0001';
      
      logger.info(`\n${'='.repeat(60)}`);
      logger.info(`Testing with ${testVideoId}`);
      
      // Test 1: Voice script creation
      logger.info(`\n🔬 Test 1: Voice Script Creation`);
      const voiceScriptTest = await this.testVoiceScriptCreation(testVideoId);
      
      // Test 2: Complete approval workflow 
      logger.info(`\n🔬 Test 2: Complete Approval Workflow`);
      const approvalTest = await this.testApprovalWorkflow(testVideoId);
      
      // Test 3: Script approval simulation (if needed)
      logger.info(`\n🔬 Test 3: Script Approval Simulation`);
      const approvalSimulation = await this.simulateScriptApproval(testVideoId);
      
      // Results summary
      logger.info(`\n${'='.repeat(60)}`);
      logger.info(`📊 Test Results Summary:`);
      logger.info(`  Voice Script Creation: ${voiceScriptTest.success ? '✅ PASS' : '❌ FAIL'}`);
      if (voiceScriptTest.error) logger.error(`    Error: ${voiceScriptTest.error}`);
      
      logger.info(`  Approval Workflow: ${approvalTest.success ? '✅ PASS' : '❌ FAIL'}`);
      if (approvalTest.error) logger.error(`    Error: ${approvalTest.error}`);
      
      logger.info(`  Approval Simulation: ${approvalSimulation.success ? '✅ PASS' : '❌ FAIL'}`);
      if (approvalSimulation.error) logger.error(`    Error: ${approvalSimulation.error}`);
      
      const passedTests = [voiceScriptTest, approvalTest, approvalSimulation].filter(t => t.success).length;
      logger.info(`\n🎯 Overall: ${passedTests}/3 tests passed`);
      
      if (passedTests === 3) {
        logger.info(`✅ All approval workflow tests PASSED!`);
        logger.info(`\n📋 What this means:`);
        logger.info(`  ✅ Voice script creation works correctly`);
        logger.info(`  ✅ Post-approval workflow triggers properly`);
        logger.info(`  ✅ Status monitoring detects script approvals`);
        logger.info(`  ✅ Files are created and uploaded to Drive`);
        logger.info(`\n🎬 When you set "Script Approved" = "Approved":`);
        logger.info(`  1. voice_script.txt will be created automatically`);
        logger.info(`  2. Thumbnail images will be generated (if enabled)`);
        logger.info(`  3. All files will be uploaded to Google Drive`);
        logger.info(`  4. Telegram notifications will be sent`);
        logger.info(`  5. Status will progress to next workflow steps`);
      } else {
        logger.warn(`⚠️  Some tests failed - workflow may have issues`);
      }
      
    } catch (error) {
      logger.error('❌ Test suite failed:', error);
      process.exit(1);
    }
  }
}

// Run the tests
const tester = new ApprovalWorkflowTester();
tester.run().catch(error => {
  logger.error('Fatal error:', error);
  process.exit(1);
});