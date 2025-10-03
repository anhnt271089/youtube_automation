#!/usr/bin/env node

/**
 * BYPASS TOOL: Direct asset retry for stuck videos
 *
 * This tool bypasses the buggy updateSentenceStatus method and directly
 * updates Google Sheets to reset failed assets to "Pending" status.
 *
 * Target Videos:
 * - VID-0023: 18 failed assets
 * - VID-0029: 17 failed assets
 * - VID-0033: 7 failed assets
 * - VID-0034: 16 failed assets
 *
 * Strategy:
 * 1. Get script breakdown for each video
 * 2. Find all "Asset Download Failed" sentences
 * 3. Calculate correct row positions from breakdown array
 * 4. Use direct Google Sheets batchUpdate API (bypass buggy method)
 * 5. Trigger asset download retry
 */

import GoogleSheetsService from '../src/services/googleSheetsService.js';
import AssetDownloadOrchestrator from '../src/services/assetDownloadOrchestrator.js';
import logger from '../src/utils/logger.js';

const STUCK_VIDEOS = ['VID-0023', 'VID-0029', 'VID-0033', 'VID-0034'];

/**
 * Main bypass function - resets failed assets and triggers retry
 */
async function retryFailedAssetsDirect() {
  const sheetsService = new GoogleSheetsService();
  const orchestrator = new AssetDownloadOrchestrator();

  logger.info('🚀 Starting direct asset retry bypass tool...');
  logger.info(`📹 Processing ${STUCK_VIDEOS.length} stuck videos: ${STUCK_VIDEOS.join(', ')}\n`);

  const results = {
    processed: 0,
    totalReset: 0,
    totalRetried: 0,
    errors: [],
    details: []
  };

  for (const videoId of STUCK_VIDEOS) {
    try {
      logger.info(`\n${'='.repeat(60)}`);
      logger.info(`📹 Processing ${videoId}...`);
      logger.info('='.repeat(60));

      // Get video details
      const videoDetails = await sheetsService.getVideoDetails(videoId);
      if (!videoDetails) {
        const errorMsg = `Video ${videoId} not found`;
        logger.error(`❌ ${errorMsg}`);
        results.errors.push({ videoId, error: errorMsg });
        continue;
      }

      logger.info(`📝 Title: ${videoDetails.title}`);
      logger.info(`📊 Current Status: ${videoDetails.status}`);

      // Get breakdown to find failed assets
      const breakdown = await sheetsService.getScriptBreakdown(videoId);
      if (!breakdown || breakdown.length === 0) {
        const errorMsg = `No script breakdown found for ${videoId}`;
        logger.error(`❌ ${errorMsg}`);
        results.errors.push({ videoId, error: errorMsg });
        continue;
      }

      logger.info(`📋 Total sentences in breakdown: ${breakdown.length}`);

      // Find failed assets
      const failedAssets = breakdown.filter(s => s.status === 'Asset Download Failed');

      if (failedAssets.length === 0) {
        logger.info(`✅ No failed assets found for ${videoId} - skipping`);
        results.details.push({
          videoId,
          title: videoDetails.title,
          totalSentences: breakdown.length,
          failedAssets: 0,
          resetCount: 0,
          skipped: true
        });
        continue;
      }

      logger.info(`❌ Found ${failedAssets.length} failed assets`);
      logger.info(`\n🔧 Resetting failed assets to "Pending" using direct API...`);

      // Get workbook ID from detail workbook URL
      const workbookUrl = videoDetails.detailWorkbookUrl;
      if (!workbookUrl) {
        const errorMsg = `No detail workbook URL found for ${videoId}`;
        logger.error(`❌ ${errorMsg}`);
        results.errors.push({ videoId, error: errorMsg });
        continue;
      }

      const workbookId = workbookUrl.split('/d/')[1].split('/')[0];
      logger.info(`📊 Workbook ID: ${workbookId}`);

      // Build batch updates for direct API call
      const batchUpdates = [];
      let resetCount = 0;

      for (const sentence of failedAssets) {
        // Find the sentence's position in the breakdown array
        const sentenceIndex = breakdown.findIndex(s =>
          parseInt(s.sentenceNumber) === parseInt(sentence.sentenceNumber)
        );

        if (sentenceIndex === -1) {
          logger.warn(`⚠️ Could not find sentence ${sentence.sentenceNumber} in breakdown`);
          continue;
        }

        // Calculate correct row: index + 2 (header row + 0-based index)
        const rowIndex = sentenceIndex + 2;

        logger.info(`  📍 S-${sentence.sentenceNumber}: Row ${rowIndex} → Resetting to "Pending"`);

        // Direct Google Sheets API update (bypass buggy method)
        batchUpdates.push({
          range: `'Script Breakdown'!G${rowIndex}`,
          values: [['Pending']]
        });

        resetCount++;
      }

      // Execute batch update
      if (batchUpdates.length > 0) {
        await sheetsService.sheets.spreadsheets.values.batchUpdate({
          spreadsheetId: workbookId,
          resource: {
            valueInputOption: 'USER_ENTERED',
            data: batchUpdates
          }
        });

        logger.info(`\n✅ Successfully reset ${resetCount} assets to "Pending"`);
        results.totalReset += resetCount;
      }

      // Trigger asset download retry
      logger.info(`\n🔄 Triggering asset download retry for ${videoId}...`);

      try {
        const retryResult = await orchestrator.handleScriptApproval(videoId, {
          triggerReason: 'Direct bypass tool retry',
          bypassValidation: false
        });

        if (retryResult.success) {
          logger.info(`✅ Asset retry completed successfully`);
          logger.info(`   📊 Success: ${retryResult.result?.successCount || 0}`);
          logger.info(`   ❌ Failed: ${retryResult.result?.failureCount || 0}`);
          results.totalRetried += (retryResult.result?.successCount || 0);
        } else if (retryResult.skipped) {
          logger.warn(`⚠️ Asset retry skipped: ${retryResult.reason}`);
        } else {
          logger.error(`❌ Asset retry failed: ${retryResult.reason || retryResult.error}`);
          results.errors.push({
            videoId,
            error: `Retry failed: ${retryResult.reason || retryResult.error}`
          });
        }
      } catch (retryError) {
        logger.error(`❌ Asset retry exception:`, retryError.message);
        results.errors.push({ videoId, error: `Retry exception: ${retryError.message}` });
      }

      results.processed++;
      results.details.push({
        videoId,
        title: videoDetails.title,
        totalSentences: breakdown.length,
        failedAssets: failedAssets.length,
        resetCount,
        retryResult: 'See logs above'
      });

      // Brief delay between videos
      if (results.processed < STUCK_VIDEOS.length) {
        logger.info(`\n⏳ Waiting 3 seconds before next video...\n`);
        await new Promise(resolve => setTimeout(resolve, 3000));
      }

    } catch (error) {
      logger.error(`❌ Error processing ${videoId}:`, error.message);
      results.errors.push({ videoId, error: error.message });
    }
  }

  // Print summary
  logger.info(`\n${'='.repeat(60)}`);
  logger.info('📊 BYPASS TOOL SUMMARY');
  logger.info('='.repeat(60));
  logger.info(`✅ Videos processed: ${results.processed}/${STUCK_VIDEOS.length}`);
  logger.info(`🔄 Total assets reset: ${results.totalReset}`);
  logger.info(`✅ Total assets retried: ${results.totalRetried}`);
  logger.info(`❌ Errors encountered: ${results.errors.length}`);

  if (results.errors.length > 0) {
    logger.info(`\n❌ Error Details:`);
    results.errors.forEach(err => {
      logger.error(`   ${err.videoId}: ${err.error}`);
    });
  }

  logger.info(`\n📋 Detailed Results:`);
  results.details.forEach(detail => {
    logger.info(`\n  ${detail.videoId}:`);
    logger.info(`    Title: ${detail.title}`);
    logger.info(`    Total Sentences: ${detail.totalSentences}`);
    logger.info(`    Failed Assets: ${detail.failedAssets}`);
    logger.info(`    Reset Count: ${detail.resetCount}`);
    if (detail.skipped) {
      logger.info(`    Status: Skipped (no failed assets)`);
    }
  });

  logger.info(`\n✅ Bypass tool completed!`);
  logger.info(`\n💡 Next Steps:`);
  logger.info(`   1. Verify videos moved to "Completed" status in Master Sheet`);
  logger.info(`   2. Check Script Breakdown sheets for updated statuses`);
  logger.info(`   3. Run find-stuck-downloads.js to verify all issues resolved`);
  logger.info(`   4. If issues persist, proceed with core bug fixes (Phase 2)\n`);

  return results;
}

// Run the tool
retryFailedAssetsDirect()
  .then(results => {
    logger.info('✅ Tool execution completed successfully');
    process.exit(0);
  })
  .catch(error => {
    logger.error('❌ Tool execution failed:', error);
    process.exit(1);
  });
