#!/usr/bin/env node

/**
 * Test Post-Approval Workflow Fix
 * 
 * This script tests the fixed post-approval workflow for videos VID-0008 and VID-0013
 * to verify that voice_script.txt creation and thumbnail generation work correctly.
 */

import { config } from '../config/config.js';
import WorkflowService from '../src/services/workflowService.js';
import GoogleSheetsService from '../src/services/googleSheetsService.js';
import logger from '../src/utils/logger.js';

class PostApprovalWorkflowTester {
  constructor() {
    this.workflowService = new WorkflowService();
    this.sheetsService = new GoogleSheetsService();
  }

  /**
   * Test the complete post-approval workflow for specific videos
   */
  async testPostApprovalWorkflow(videoIds = ['VID-0008', 'VID-0013']) {
    logger.info('🧪 Testing Post-Approval Workflow Fix...');
    
    const results = {};
    
    for (const videoId of videoIds) {
      logger.info(`\n🎬 Testing ${videoId}...`);
      
      try {
        // 1. Get video details
        const videoDetails = await this.sheetsService.getVideoDetails(videoId);
        if (!videoDetails) {
          throw new Error(`Video not found: ${videoId}`);
        }
        
        logger.info(`📋 Found video: ${videoDetails.title}`);
        logger.info(`📊 Current Status: ${videoDetails.status}`);
        logger.info(`✅ Script Approved: ${videoDetails.scriptApproved}`);
        
        // 2. Check if script is approved
        if (videoDetails.scriptApproved !== 'Approved' && videoDetails.scriptApproved !== true) {
          logger.warn(`⚠️ ${videoId}: Script not approved (${videoDetails.scriptApproved}), skipping workflow test`);
          results[videoId] = {
            status: 'skipped',
            reason: 'Script not approved',
            scriptApproved: videoDetails.scriptApproved
          };
          continue;
        }
        
        // 3. Test voice script creation (the main fix)
        logger.info(`📄 Testing voice script creation for ${videoId}...`);
        const voiceScriptResult = await this.workflowService.createAndUploadVoiceScript(videoId, false);
        
        let voiceScriptStatus = 'failed';
        if (voiceScriptResult) {
          if (voiceScriptResult.skipped) {
            voiceScriptStatus = 'exists';
            logger.info(`📄 ✅ Voice script already exists for ${videoId}`);
          } else {
            voiceScriptStatus = 'created';
            logger.info(`📄 ✅ Voice script created for ${videoId}: ${voiceScriptResult.fileName}`);
          }
        }
        
        // 4. Check thumbnail status
        logger.info(`🎨 Checking thumbnail status for ${videoId}...`);
        const thumbnailCheck = await this.workflowService.checkThumbnailsForVideo(videoId);
        
        logger.info(`🎨 Thumbnail status: ${thumbnailCheck.exists ? `${thumbnailCheck.count} thumbnails exist` : 'No thumbnails found'}`);
        
        // 5. Test complete processApprovedScript workflow (if script approved but status not completed)
        let workflowResult = null;
        if (videoDetails.status !== 'Completed' && videoDetails.status !== 'Generating Images') {
          logger.info(`🔄 Testing complete processApprovedScript workflow for ${videoId}...`);
          
          try {
            const videoInfo = {
              videoId: videoId,
              title: videoDetails.title,
              youtubeUrl: videoDetails.youtubeUrl,
              status: 'Approved',
              voiceGenerationStatus: videoDetails.voiceGenerationStatus || 'Not Started'
            };
            
            // This should now include voice script creation as the first step
            workflowResult = await this.workflowService.processApprovedScript(videoInfo);
            logger.info(`🔄 ✅ Complete workflow executed successfully for ${videoId}`);
            
          } catch (workflowError) {
            logger.error(`🔄 ❌ Complete workflow failed for ${videoId}:`, workflowError.message);
            workflowResult = { error: workflowError.message };
          }
        } else {
          logger.info(`🔄 ${videoId} is already completed or in progress, skipping full workflow test`);
        }
        
        results[videoId] = {
          status: 'tested',
          video: {
            title: videoDetails.title,
            currentStatus: videoDetails.status,
            scriptApproved: videoDetails.scriptApproved
          },
          voiceScript: {
            status: voiceScriptStatus,
            result: voiceScriptResult
          },
          thumbnails: {
            exists: thumbnailCheck.exists,
            count: thumbnailCheck.count,
            folderUrl: thumbnailCheck.folderUrl
          },
          completeWorkflow: workflowResult
        };
        
        logger.info(`✅ ${videoId} testing completed successfully`);
        
      } catch (error) {
        logger.error(`❌ Error testing ${videoId}:`, error.message);
        results[videoId] = {
          status: 'error',
          error: error.message,
          stack: error.stack
        };
      }
    }
    
    return results;
  }

  /**
   * Generate a test report
   */
  generateTestReport(results) {
    logger.info('\n📊 POST-APPROVAL WORKFLOW TEST REPORT');
    logger.info('=====================================');
    
    let totalTested = 0;
    let successful = 0;
    let failed = 0;
    let skipped = 0;
    
    for (const [videoId, result] of Object.entries(results)) {
      logger.info(`\n🎬 ${videoId}:`);
      
      if (result.status === 'skipped') {
        logger.info(`   📋 Status: SKIPPED (${result.reason})`);
        skipped++;
      } else if (result.status === 'error') {
        logger.info(`   📋 Status: ERROR`);
        logger.info(`   ❌ Error: ${result.error}`);
        failed++;
      } else if (result.status === 'tested') {
        logger.info(`   📋 Status: TESTED`);
        logger.info(`   🎬 Title: ${result.video.title}`);
        logger.info(`   📊 Current Status: ${result.video.currentStatus}`);
        logger.info(`   ✅ Script Approved: ${result.video.scriptApproved}`);
        logger.info(`   📄 Voice Script: ${result.voiceScript.status.toUpperCase()}`);
        logger.info(`   🎨 Thumbnails: ${result.thumbnails.exists ? `${result.thumbnails.count} exist` : 'None found'}`);
        
        if (result.completeWorkflow) {
          if (result.completeWorkflow.error) {
            logger.info(`   🔄 Complete Workflow: FAILED - ${result.completeWorkflow.error}`);
          } else {
            logger.info(`   🔄 Complete Workflow: SUCCESS`);
          }
        } else {
          logger.info(`   🔄 Complete Workflow: SKIPPED (already completed)`);
        }
        
        successful++;
      }
      
      totalTested++;
    }
    
    logger.info('\n📈 SUMMARY:');
    logger.info(`   Total Videos: ${totalTested}`);
    logger.info(`   ✅ Successful: ${successful}`);
    logger.info(`   ❌ Failed: ${failed}`);
    logger.info(`   ⏭️ Skipped: ${skipped}`);
    
    return {
      total: totalTested,
      successful,
      failed,
      skipped,
      results
    };
  }
}

// Run the test
async function runTest() {
  try {
    const tester = new PostApprovalWorkflowTester();
    
    // Test the specific problematic videos
    const results = await tester.testPostApprovalWorkflow(['VID-0008', 'VID-0013']);
    
    // Generate report
    const report = tester.generateTestReport(results);
    
    // Save results to file
    const fs = await import('fs');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportFile = `./test-results/post-approval-workflow-test-${timestamp}.json`;
    
    // Ensure directory exists
    const path = await import('path');
    const dir = path.dirname(reportFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
    logger.info(`\n💾 Test results saved to: ${reportFile}`);
    
    // Exit with appropriate code
    if (report.failed > 0) {
      logger.error('\n❌ Some tests failed. Check the logs above for details.');
      process.exit(1);
    } else {
      logger.info('\n✅ All tests completed successfully!');
      process.exit(0);
    }
    
  } catch (error) {
    logger.error('Fatal error in test execution:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTest();
}

export default PostApprovalWorkflowTester;