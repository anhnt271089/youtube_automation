#!/usr/bin/env node

/**
 * Repair Tool for Specific Videos
 * Fix VID-0008 and VID-0013 by creating missing assets and correcting workflow status
 */

import GoogleSheetsService from '../src/services/googleSheetsService.js';
import GoogleDriveService from '../src/services/googleDriveService.js';
import WorkflowService from '../src/services/workflowService.js';
import logger from '../src/utils/logger.js';

class VideoRepairService {
  constructor() {
    this.sheetsService = new GoogleSheetsService();
    this.driveService = new GoogleDriveService();
    this.workflowService = new WorkflowService();
  }

  /**
   * Repair specific videos by recreating missing assets and fixing workflow status
   */
  async repairVideos(videoIds) {
    logger.info(`🔧 Starting repair process for videos: ${videoIds.join(', ')}`);
    
    const results = {
      videoIds,
      repairResults: [],
      summary: {
        totalRepaired: 0,
        successful: 0,
        failed: 0
      }
    };

    for (const videoId of videoIds) {
      logger.info(`\n🎯 ===== REPAIRING ${videoId} =====`);
      
      const repairResult = {
        videoId,
        timestamp: new Date().toISOString(),
        originalState: null,
        actions: [],
        finalState: null,
        success: false,
        errors: []
      };

      try {
        // 1. Capture original state
        logger.info(`📋 Capturing original state for ${videoId}...`);
        repairResult.originalState = await this.captureVideoState(videoId);
        
        if (!repairResult.originalState.exists) {
          repairResult.errors.push(`Video ${videoId} not found in master sheet`);
          results.repairResults.push(repairResult);
          continue;
        }

        // 2. Clear error status
        logger.info(`🧹 Clearing error status for ${videoId}...`);
        await this.clearErrorStatus(videoId, repairResult);

        // 3. Create missing Drive folder
        logger.info(`📁 Creating Drive folder for ${videoId}...`);
        await this.createMissingDriveFolder(videoId, repairResult);

        // 4. Create missing detail workbook
        logger.info(`📊 Creating detail workbook for ${videoId}...`);
        await this.createMissingDetailWorkbook(videoId, repairResult);

        // 5. Re-run workflow to generate script content
        logger.info(`⚙️ Re-running workflow for ${videoId}...`);
        await this.reRunWorkflow(videoId, repairResult);

        // 6. Capture final state
        logger.info(`✅ Capturing final state for ${videoId}...`);
        repairResult.finalState = await this.captureVideoState(videoId);
        
        repairResult.success = true;
        results.summary.successful++;
        logger.info(`🎉 Successfully repaired ${videoId}`);

      } catch (error) {
        logger.error(`❌ Repair failed for ${videoId}:`, error);
        repairResult.errors.push(error.message);
        repairResult.success = false;
        results.summary.failed++;
      }

      results.repairResults.push(repairResult);
      results.summary.totalRepaired++;
    }

    // Generate summary
    this.generateRepairSummary(results);
    
    return results;
  }

  /**
   * Capture current state of video
   */
  async captureVideoState(videoId) {
    try {
      const videoDetails = await this.sheetsService.getVideoDetails(videoId);
      
      if (!videoDetails) {
        return {
          exists: false,
          data: null
        };
      }

      return {
        exists: true,
        data: {
          videoId: videoDetails.id,
          title: videoDetails.title,
          status: videoDetails.status,
          scriptApproved: videoDetails.scriptApproved,
          driveFolder: videoDetails.driveFolder,
          detailWorkbookUrl: videoDetails.detailWorkbookUrl,
          youtubeUrl: videoDetails.youtubeUrl,
          youtubeVideoId: videoDetails.youtubeVideoId
        }
      };
    } catch (error) {
      return {
        exists: false,
        error: error.message
      };
    }
  }

  /**
   * Clear error status and reset to appropriate workflow state
   */
  async clearErrorStatus(videoId, repairResult) {
    try {
      // Update status from "Error" to "New" to restart workflow
      await this.sheetsService.updateVideoStatus(videoId, 'New', {
        scriptApproved: 'Pending'
      });

      repairResult.actions.push({
        action: 'CLEAR_ERROR_STATUS',
        success: true,
        details: 'Changed status from "Error" to "New", reset script approval to "Pending"'
      });

      logger.info(`✅ Cleared error status for ${videoId}`);

    } catch (error) {
      repairResult.actions.push({
        action: 'CLEAR_ERROR_STATUS',
        success: false,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Create missing Drive folder
   */
  async createMissingDriveFolder(videoId, repairResult) {
    try {
      const videoDetails = await this.sheetsService.getVideoDetails(videoId);
      
      if (!videoDetails || !videoDetails.title) {
        throw new Error(`Cannot create folder - video details or title missing for ${videoId}`);
      }

      // Create folder using the video title
      const folderResult = await this.sheetsService.createVideoDetailWorkbook(videoId, videoDetails.title);
      
      repairResult.actions.push({
        action: 'CREATE_DRIVE_FOLDER',
        success: true,
        details: {
          folderId: folderResult.folderId,
          folderUrl: folderResult.folderUrl
        }
      });

      logger.info(`✅ Created Drive folder for ${videoId}: ${folderResult.folderUrl}`);

    } catch (error) {
      repairResult.actions.push({
        action: 'CREATE_DRIVE_FOLDER',
        success: false,
        error: error.message
      });
      
      // Don't throw here - folder might already exist, continue with workbook creation
      logger.warn(`⚠️ Drive folder creation issue for ${videoId}: ${error.message}`);
    }
  }

  /**
   * Create missing detail workbook
   */
  async createMissingDetailWorkbook(videoId, repairResult) {
    try {
      const videoDetails = await this.sheetsService.getVideoDetails(videoId);
      
      if (!videoDetails || !videoDetails.title) {
        throw new Error(`Cannot create workbook - video details or title missing for ${videoId}`);
      }

      // If folder creation failed above, this will create both folder and workbook
      if (!videoDetails.detailWorkbookUrl) {
        const workbookResult = await this.sheetsService.createVideoDetailWorkbook(videoId, videoDetails.title);
        
        repairResult.actions.push({
          action: 'CREATE_DETAIL_WORKBOOK',
          success: true,
          details: {
            workbookId: workbookResult.workbookId,
            workbookUrl: workbookResult.workbookUrl,
            folderUrl: workbookResult.folderUrl
          }
        });

        logger.info(`✅ Created detail workbook for ${videoId}: ${workbookResult.workbookUrl}`);
      } else {
        repairResult.actions.push({
          action: 'CREATE_DETAIL_WORKBOOK',
          success: true,
          details: 'Workbook URL already exists, skipping creation'
        });

        logger.info(`ℹ️ Detail workbook already exists for ${videoId}`);
      }

    } catch (error) {
      repairResult.actions.push({
        action: 'CREATE_DETAIL_WORKBOOK',
        success: false,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Re-run workflow to generate script content
   */
  async reRunWorkflow(videoId, repairResult) {
    try {
      logger.info(`🔄 Processing video through workflow: ${videoId}`);
      
      // Process video through the main workflow
      const result = await this.workflowService.processVideo(videoId);
      
      repairResult.actions.push({
        action: 'RERUN_WORKFLOW',
        success: true,
        details: result || 'Workflow completed successfully'
      });

      logger.info(`✅ Workflow completed for ${videoId}`);

    } catch (error) {
      repairResult.actions.push({
        action: 'RERUN_WORKFLOW',
        success: false,
        error: error.message
      });
      
      // Don't throw - partial success is still valuable
      logger.warn(`⚠️ Workflow issue for ${videoId}: ${error.message}`);
    }
  }

  /**
   * Generate repair summary
   */
  generateRepairSummary(results) {
    logger.info('\n' + '='.repeat(60));
    logger.info('🔧 VIDEO REPAIR SUMMARY REPORT');
    logger.info('='.repeat(60));

    logger.info(`\n📊 OVERALL RESULTS:`);
    logger.info(`   🎯 Videos Processed: ${results.summary.totalRepaired}`);
    logger.info(`   ✅ Successfully Repaired: ${results.summary.successful}`);
    logger.info(`   ❌ Failed Repairs: ${results.summary.failed}`);

    for (const repair of results.repairResults) {
      const videoId = repair.videoId;
      const status = repair.success ? '✅ SUCCESS' : '❌ FAILED';
      
      logger.info(`\n🎯 ${videoId}: ${status}`);
      
      if (repair.originalState?.exists) {
        logger.info(`   📋 Original Status: ${repair.originalState.data.status}`);
        logger.info(`   📁 Had Drive Folder: ${repair.originalState.data.driveFolder ? 'Yes' : 'No'}`);
        logger.info(`   📊 Had Workbook: ${repair.originalState.data.detailWorkbookUrl ? 'Yes' : 'No'}`);
      }

      logger.info(`   🔧 Actions Performed: ${repair.actions.length}`);
      repair.actions.forEach(action => {
        const actionStatus = action.success ? '✅' : '❌';
        logger.info(`      ${actionStatus} ${action.action}`);
        if (action.error) {
          logger.info(`         Error: ${action.error}`);
        }
      });

      if (repair.finalState?.exists) {
        logger.info(`   📋 Final Status: ${repair.finalState.data.status}`);
        logger.info(`   📁 Has Drive Folder: ${repair.finalState.data.driveFolder ? 'Yes' : 'No'}`);
        logger.info(`   📊 Has Workbook: ${repair.finalState.data.detailWorkbookUrl ? 'Yes' : 'No'}`);
      }

      if (repair.errors.length > 0) {
        logger.info(`   ⚠️ Errors: ${repair.errors.join(', ')}`);
      }
    }

    logger.info('\n🎉 REPAIR RECOMMENDATIONS:');
    
    if (results.summary.successful > 0) {
      logger.info(`   ✅ ${results.summary.successful} video(s) successfully repaired`);
      logger.info(`   📋 Check Google Sheets for updated status`);
      logger.info(`   📁 Verify Drive folders contain expected files`);
      logger.info(`   📊 Review detail workbooks for script content`);
    }

    if (results.summary.failed > 0) {
      logger.info(`   ⚠️ ${results.summary.failed} video(s) need manual attention`);
      logger.info(`   🔍 Review error messages above`);
      logger.info(`   🛠️ Consider running individual repair steps manually`);
    }

    logger.info(`\n📈 NEXT STEPS:`);
    logger.info(`   1. Check master Google Sheet for updated video statuses`);
    logger.info(`   2. Manually approve scripts if content looks correct`);
    logger.info(`   3. Monitor workflow progress for voice generation`);
    logger.info(`   4. Verify all Drive folders and workbooks are accessible`);

    logger.info('\n' + '='.repeat(60));
  }
}

// Main execution
async function main() {
  try {
    const repairService = new VideoRepairService();
    const videoIds = ['VID-0008', 'VID-0013'];
    
    logger.info('🚀 Starting video repair service...');
    const results = await repairService.repairVideos(videoIds);
    
    logger.info('\n✅ Video repair process completed');
    
    // Write detailed results to file
    const fs = await import('fs').then(m => m.promises);
    const resultsFile = `repair-results-${Date.now()}.json`;
    await fs.writeFile(resultsFile, JSON.stringify(results, null, 2));
    logger.info(`📁 Detailed repair results saved to: ${resultsFile}`);
    
  } catch (error) {
    logger.error('❌ Repair service failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default VideoRepairService;