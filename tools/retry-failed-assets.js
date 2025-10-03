#!/usr/bin/env node
import GoogleSheetsService from '../src/services/googleSheetsService.js';
import PexelsService from '../src/services/pexelsService.js';
import logger from '../src/utils/logger.js';

/**
 * Retry Failed Assets Tool
 *
 * Purpose:
 * - Find videos with "Asset Download Failed" sentences
 * - Reset failed sentences to "Pending" status
 * - Trigger asset download to retry
 *
 * This tool works around the PexelsService limitation that only processes
 * sentences with "Pending", "", or null status.
 */

const sheetsService = new GoogleSheetsService();
const pexelsService = new PexelsService();

const DELAY_BETWEEN_VIDEOS = 2000;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Reset failed assets to Pending status for a single video
 */
async function resetFailedAssets(videoId, breakdown) {
  const failed = breakdown.filter(s => s.status === 'Asset Download Failed');

  if (failed.length === 0) {
    return 0;
  }

  logger.info(`🔄 Resetting ${failed.length} failed assets to "Pending"...`);

  let resetCount = 0;

  for (const sentence of failed) {
    try {
      // Use updateSentenceStatus to reset to Pending
      await sheetsService.updateSentenceStatus(
        videoId,
        sentence.sentenceNumber,
        'Pending',
        null // Clear imageUrl
      );

      resetCount++;
      logger.info(`   ✅ Reset sentence ${sentence.sentenceNumber}: "${sentence.searchPhrase}"`);

    } catch (error) {
      logger.error(`   ❌ Failed to reset sentence ${sentence.sentenceNumber}:`, error.message);
    }
  }

  logger.info(`✅ Reset ${resetCount}/${failed.length} failed assets\n`);

  return resetCount;
}

/**
 * Process a single video: reset failed assets and retry download
 */
async function processVideo(video) {
  try {
    logger.info(`\n${'='.repeat(80)}`);
    logger.info(`📹 Processing: ${video.videoId}`);
    logger.info(`   Title: ${video.title || 'N/A'}`);
    logger.info(`${'='.repeat(80)}\n`);

    // Get script breakdown
    const breakdown = await sheetsService.getScriptBreakdown(video.videoId);

    if (!breakdown || breakdown.length === 0) {
      logger.error(`❌ Script Breakdown is empty for ${video.videoId}`);
      return {
        videoId: video.videoId,
        status: 'error',
        error: 'Script Breakdown missing'
      };
    }

    // Count statuses
    const total = breakdown.length;
    const completed = breakdown.filter(s => s.status === 'Complete').length;
    const failed = breakdown.filter(s => s.status === 'Asset Download Failed').length;

    logger.info(`📊 Current Status:`);
    logger.info(`   Total: ${total}`);
    logger.info(`   ✅ Complete: ${completed}`);
    logger.info(`   ❌ Failed: ${failed}\n`);

    // Check if all assets are already downloaded
    if (completed === total) {
      logger.info(`✅ All assets already downloaded!`);
      await sheetsService.updateMasterSheetStatus(video.videoId, 'Completed');
      return {
        videoId: video.videoId,
        status: 'already_complete',
        completed: total,
        total: total
      };
    }

    // Reset failed assets to Pending
    const resetCount = await resetFailedAssets(video.videoId, breakdown);

    if (resetCount === 0 && failed > 0) {
      logger.error(`❌ Failed to reset any assets, cannot proceed`);
      return {
        videoId: video.videoId,
        status: 'error',
        error: 'Failed to reset assets to Pending'
      };
    }

    // Retry asset download
    logger.info(`🚀 Starting asset download for ${resetCount} pending assets...\n`);

    const result = await pexelsService.processScriptBreakdownAssets(video.videoId);

    logger.info(`\n📈 Download Results:`);
    logger.info(`   Success: ${result.successCount}`);
    logger.info(`   Failed: ${result.failureCount}`);
    logger.info(`   Total: ${result.totalSentences}\n`);

    // Update Master Sheet status
    if (result.successCount > 0) {
      const finalCompleted = completed + result.successCount;
      const finalFailed = result.failureCount;

      if (finalFailed === 0) {
        logger.info(`✅ Full success: All assets downloaded`);
        await sheetsService.updateMasterSheetStatus(video.videoId, 'Completed');

        return {
          videoId: video.videoId,
          status: 'success',
          completed: finalCompleted,
          total: total,
          newDownloads: result.successCount
        };
      } else {
        logger.warn(`⚠️  Partial success: ${result.successCount} downloaded, ${finalFailed} still failed`);
        // Keep in "Downloading Assets" status for another retry attempt
        return {
          videoId: video.videoId,
          status: 'partial_success',
          completed: finalCompleted,
          total: total,
          newDownloads: result.successCount,
          stillFailed: finalFailed
        };
      }
    } else {
      logger.error(`❌ Download failed: No new assets downloaded`);
      await sheetsService.updateMasterSheetStatus(video.videoId, 'Asset Download Failed');

      return {
        videoId: video.videoId,
        status: 'failed',
        completed: completed,
        total: total,
        newDownloads: 0
      };
    }

  } catch (error) {
    logger.error(`❌ Error processing ${video.videoId}:`, error.message);
    return {
      videoId: video.videoId,
      status: 'error',
      error: error.message
    };
  }
}

/**
 * Main function
 */
async function retryFailedAssets() {
  try {
    logger.info('🔍 Finding videos with "Downloading Assets" status...\n');

    const videos = await sheetsService.getVideosByStatus('Downloading Assets');

    if (!videos || videos.length === 0) {
      logger.info('✅ No videos found with "Downloading Assets" status');
      return;
    }

    logger.info(`📊 Found ${videos.length} video(s) to process\n`);
    logger.info(`${'='.repeat(80)}`);
    logger.info('🚀 STARTING FAILED ASSET RETRY');
    logger.info(`${'='.repeat(80)}\n`);

    const results = [];

    for (let i = 0; i < videos.length; i++) {
      const video = videos[i];
      logger.info(`\n[${i + 1}/${videos.length}] Processing ${video.videoId}...`);

      const result = await processVideo(video);
      results.push(result);

      if (i < videos.length - 1) {
        logger.info(`⏸️  Waiting ${DELAY_BETWEEN_VIDEOS}ms (rate limiting)...`);
        await sleep(DELAY_BETWEEN_VIDEOS);
      }
    }

    // Final report
    logger.info(`\n${'='.repeat(80)}`);
    logger.info('📊 FINAL REPORT');
    logger.info(`${'='.repeat(80)}\n`);

    const successCount = results.filter(r => r.status === 'success').length;
    const partialCount = results.filter(r => r.status === 'partial_success').length;
    const alreadyCompleteCount = results.filter(r => r.status === 'already_complete').length;
    const failedCount = results.filter(r => r.status === 'failed').length;
    const errorCount = results.filter(r => r.status === 'error').length;

    logger.info(`Total Videos: ${results.length}`);
    logger.info(`✅ Success (all assets downloaded): ${successCount}`);
    logger.info(`🟡 Partial Success (some still failed): ${partialCount}`);
    logger.info(`✔️  Already Complete: ${alreadyCompleteCount}`);
    logger.info(`❌ Failed (no new downloads): ${failedCount}`);
    logger.info(`⚠️  Errors: ${errorCount}\n`);

    logger.info('📋 DETAILED RESULTS:');
    logger.info(`${'-'.repeat(80)}`);

    results.forEach(r => {
      const icon = r.status === 'success' ? '✅' :
                  r.status === 'partial_success' ? '🟡' :
                  r.status === 'already_complete' ? '✔️' :
                  r.status === 'failed' ? '❌' : '⚠️';

      if (r.status === 'success' || r.status === 'partial_success' || r.status === 'already_complete') {
        const pct = Math.round((r.completed / r.total) * 100);
        logger.info(`${icon} ${r.videoId}: ${r.completed}/${r.total} (${pct}%)`);
        if (r.newDownloads) {
          logger.info(`   📥 New downloads: ${r.newDownloads}`);
        }
        if (r.stillFailed) {
          logger.info(`   ⚠️  Still failed: ${r.stillFailed}`);
        }
      } else {
        logger.info(`${icon} ${r.videoId}: ${r.error || r.status}`);
      }
      logger.info('');
    });

    logger.info(`${'='.repeat(80)}`);

    // Verification
    const remaining = await sheetsService.getVideosByStatus('Downloading Assets');
    if (!remaining || remaining.length === 0) {
      logger.info('✅ SUCCESS: No videos remain in "Downloading Assets" status\n');
    } else {
      logger.warn(`⚠️  ${remaining.length} video(s) still in "Downloading Assets" status`);
      logger.info('   Run this tool again to retry, or check logs for errors\n');
    }

    return results;

  } catch (error) {
    logger.error('❌ Fatal error:', error);
    throw error;
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  retryFailedAssets()
    .then(() => {
      logger.info('✅ Retry process complete');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('❌ Retry process failed:', error);
      process.exit(1);
    });
}

export default retryFailedAssets;
