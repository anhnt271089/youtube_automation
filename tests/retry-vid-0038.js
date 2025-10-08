/**
 * Retry processing VID-0038 with grid limit fix in place
 *
 * This script will:
 * 1. Reset VID-0038 status to allow reprocessing
 * 2. Trigger the workflow to complete the video
 * 3. Verify the Video Info sheet expands correctly
 *
 * Usage: node tests/retry-vid-0038.js
 */

import GoogleSheetsService from '../src/services/googleSheetsService.js';
import WorkflowService from '../src/services/workflowService.js';
import logger from '../src/utils/logger.js';

const sheetsService = new GoogleSheetsService();
const workflowService = new WorkflowService();

async function retryVID0038() {
  const videoId = 'VID-0038';

  try {
    logger.info(`🔄 Retrying processing for ${videoId} with grid limit fix`);

    // Step 1: Get current video details
    logger.info(`\n📋 Step 1: Getting current video details`);
    const videoDetails = await sheetsService.getVideoDetails(videoId);

    if (!videoDetails) {
      logger.error(`❌ ${videoId} not found`);
      return { success: false, error: 'Video not found' };
    }

    logger.info(`✅ Video found: ${videoDetails.title}`);
    logger.info(`   Current status: ${videoDetails.status}`);

    // Step 2: Reset status to allow reprocessing
    logger.info(`\n🔄 Step 2: Resetting video status for reprocessing`);

    await sheetsService.updateVideoFields(videoId, {
      status: 'Processing Script'
    });

    logger.info(`✅ Status reset to 'Processing Script'`);

    // Step 3: Get video row data for reprocessing
    logger.info(`\n🎬 Step 3: Retrieving video data for workflow`);
    const videoRow = await sheetsService.findVideoRow(videoId);

    if (!videoRow) {
      throw new Error(`Failed to find video row for ${videoId}`);
    }

    const videoData = {
      videoId: videoRow.data[sheetsService.masterColumns.youtubeVideoId],
      id: videoRow.data[sheetsService.masterColumns.youtubeVideoId],
      title: videoRow.data[sheetsService.masterColumns.title],
      youtubeUrl: videoRow.data[sheetsService.masterColumns.youtubeUrl],
      channelTitle: videoRow.data[sheetsService.masterColumns.channel],
      duration: videoRow.data[sheetsService.masterColumns.duration],
      viewCount: videoRow.data[sheetsService.masterColumns.viewCount],
      publishedAt: videoRow.data[sheetsService.masterColumns.publishedDate]
    };

    logger.info(`✅ Video data retrieved`);

    // Step 4: Process the video with the fix
    logger.info(`\n⚙️  Step 4: Processing video with grid limit fix enabled`);
    logger.info(`   This will:`);
    logger.info(`   - Generate enhanced script and breakdown`);
    logger.info(`   - Automatically expand Video Info sheet if needed`);
    logger.info(`   - Populate all data without grid limit errors`);

    const result = await workflowService.processInitialVideo(videoData, videoId);

    if (result.success) {
      logger.info(`\n✅ Processing completed successfully!`);

      // Step 5: Verify the fix worked
      logger.info(`\n🔍 Step 5: Verifying grid limit fix`);

      const workbookId = videoDetails.detailWorkbookUrl.split('/d/')[1].split('/')[0];

      const sheetMetadata = await sheetsService.sheets.spreadsheets.get({
        spreadsheetId: workbookId,
        fields: 'sheets(properties(sheetId,title,gridProperties))'
      });

      const videoInfoSheet = sheetMetadata.data.sheets.find(
        sheet => sheet.properties.title === 'Video Info'
      );

      const newRowCount = videoInfoSheet.properties.gridProperties.rowCount;
      logger.info(`   ✅ Video Info sheet now has ${newRowCount} rows (was 53)`);

      if (newRowCount > 53) {
        logger.info(`   🎉 Grid limit fix worked! Sheet auto-expanded from 53 to ${newRowCount} rows`);
      }

      // Check script breakdown
      const breakdown = await sheetsService.getScriptBreakdown(videoId);
      logger.info(`   ✅ Script breakdown: ${breakdown ? breakdown.length : 0} sentences`);

      return {
        success: true,
        videoId,
        previousRows: 53,
        newRows: newRowCount,
        scriptLength: breakdown ? breakdown.length : 0,
        result
      };

    } else {
      logger.error(`\n❌ Processing failed:`, result.error || 'Unknown error');
      return {
        success: false,
        videoId,
        error: result.error || 'Processing failed'
      };
    }

  } catch (error) {
    logger.error(`\n❌ Retry failed:`, error);
    logger.error(error.stack);
    return {
      success: false,
      videoId,
      error: error.message,
      stack: error.stack
    };
  }
}

// Run the retry
retryVID0038()
  .then(result => {
    if (result.success) {
      logger.info(`\n🎉 VID-0038 processing completed successfully!`);
      logger.info(`\n📊 Results:`);
      logger.info(`   Video Info rows: ${result.previousRows} → ${result.newRows} (+${result.newRows - result.previousRows})`);
      logger.info(`   Script sentences: ${result.scriptLength}`);
      logger.info(`\n✅ Grid limit fix verified working!`);
      process.exit(0);
    } else {
      logger.error(`\n❌ Retry failed: ${result.error}`);
      process.exit(1);
    }
  })
  .catch(error => {
    logger.error('Fatal error:', error);
    process.exit(1);
  });
