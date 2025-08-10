#!/usr/bin/env node

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { config } from '../config/config.js';
import GoogleSheetsService from '../src/services/googleSheetsService.js';
import WorkflowService from '../src/services/workflowService.js';
import logger from '../src/utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class FailedVideoFixer {
  constructor() {
    this.sheetsService = new GoogleSheetsService();
    this.workflowService = new WorkflowService();
  }

  async fixFailedVideo(videoId) {
    logger.info(`🔧 Fixing failed video: ${videoId}`);
    
    try {
      // 1. Get video details
      const videoDetails = await this.sheetsService.getVideoDetails(videoId);
      if (!videoDetails) {
        throw new Error(`Video ${videoId} not found in database`);
      }
      
      logger.info(`📹 Video: ${videoDetails.title}`);
      logger.info(`🔗 YouTube URL: ${videoDetails.youtubeUrl}`);
      
      // 2. Reset status from Error to Processing
      logger.info(`📊 Resetting status from Error to Processing...`);
      await this.sheetsService.updateVideoStatus(videoId, 'Processing');
      
      // 3. Clear any error flags
      try {
        await this.sheetsService.updateVideoDetails(videoId, {
          scriptApproved: '',  // Clear script approval to start fresh
          voiceGenerationStatus: '',
          videoEditingStatus: ''
        });
        logger.info(`✅ Cleared previous status flags`);
      } catch (updateError) {
        logger.warn(`Warning: Could not clear status flags:`, updateError.message);
      }
      
      // 4. Retry the complete initial processing workflow
      logger.info(`🔄 Retrying complete initial processing workflow...`);
      
      // Get YouTube data fresh
      const videoData = await this.workflowService.youtubeService.getCompleteVideoData(videoDetails.youtubeUrl);
      
      // Set the video ID to our format
      videoData.videoId = videoId;
      
      // Call the main processing method
      const result = await this.workflowService.processInitialVideo(videoData, videoId);
      
      if (result.success) {
        logger.info(`✅ Successfully reprocessed ${videoId}`);
        
        // Send success notification
        await this.workflowService.telegramService.sendMessage(
          `✅ <b>Video Recovery Successful</b>\n\n` +
          `🎬 ${videoId} - ${videoDetails.title}\n` +
          `🔄 Video has been successfully reprocessed\n` +
          `📊 Status reset and workflow restarted\n\n` +
          `📋 Next: Review and approve the generated script`
        );
        
        return { success: true, message: 'Video successfully reprocessed' };
      } else {
        throw new Error(result.error || 'Reprocessing failed');
      }
      
    } catch (error) {
      logger.error(`❌ Failed to fix ${videoId}:`, error);
      
      // Send error notification
      try {
        await this.workflowService.telegramService.sendMessage(
          `❌ <b>Video Recovery Failed</b>\n\n` +
          `🎬 ${videoId}\n` +
          `❌ Error: ${error.message}\n\n` +
          `🔧 Manual intervention may be required`
        );
      } catch (telegramError) {
        logger.error('Failed to send error notification:', telegramError);
      }
      
      return { success: false, error: error.message };
    }
  }

  async run() {
    try {
      logger.info('🔧 Starting failed video recovery process...');
      
      const failedVideoIds = ['VID-0008', 'VID-0013'];
      const results = [];
      
      for (const videoId of failedVideoIds) {
        logger.info(`\n${'='.repeat(50)}`);
        const result = await this.fixFailedVideo(videoId);
        results.push({ videoId, ...result });
        
        // Wait between videos to avoid overwhelming APIs
        if (failedVideoIds.indexOf(videoId) < failedVideoIds.length - 1) {
          logger.info('⏳ Waiting 5 seconds before next video...');
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }
      
      logger.info(`\n${'='.repeat(50)}`);
      logger.info('📊 Recovery Results Summary:');
      results.forEach(result => {
        const status = result.success ? '✅ SUCCESS' : '❌ FAILED';
        logger.info(`  ${result.videoId}: ${status}`);
        if (result.error) {
          logger.error(`    Error: ${result.error}`);
        }
        if (result.message) {
          logger.info(`    ${result.message}`);
        }
      });
      
      const successCount = results.filter(r => r.success).length;
      logger.info(`\n🎯 Recovery completed: ${successCount}/${results.length} videos fixed`);
      
    } catch (error) {
      logger.error('❌ Recovery process failed:', error);
      process.exit(1);
    }
  }
}

// Run the recovery
const fixer = new FailedVideoFixer();
fixer.run().catch(error => {
  logger.error('Fatal error:', error);
  process.exit(1);
});