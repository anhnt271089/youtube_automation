#!/usr/bin/env node
import GoogleSheetsService from '../src/services/googleSheetsService.js';
import logger from '../src/utils/logger.js';

/**
 * Diagnostic Tool: Find Videos Stuck in "Downloading Assets" Status
 *
 * Purpose:
 * - Query Master Sheet for videos with "Downloading Assets" status
 * - Check Script Breakdown to determine actual progress
 * - Identify videos that are truly stuck vs. legitimately in progress
 *
 * Output:
 * - List of all videos in "Downloading Assets" status
 * - Progress metrics for each video (completed/total assets)
 * - Diagnosis of whether video is stuck or progressing normally
 */

const sheetsService = new GoogleSheetsService();

async function findStuckDownloads() {
  try {
    logger.info('🔍 Searching for videos with "Downloading Assets" status...\n');

    // Query Google Sheets for videos with "Downloading Assets" status
    const videos = await sheetsService.getVideosByStatus('Downloading Assets');

    if (!videos || videos.length === 0) {
      logger.info('✅ No videos found with "Downloading Assets" status');
      logger.info('All videos appear to be in a proper state!');
      return;
    }

    logger.info(`📊 Found ${videos.length} video(s) with "Downloading Assets" status:\n`);
    logger.info('================================================================================');

    const diagnostics = [];

    // Analyze each video's progress
    for (const video of videos) {
      try {
        logger.info(`\n📹 Video: ${video.videoId}`);
        logger.info(`   Title: ${video.title || 'N/A'}`);
        logger.info(`   YouTube: ${video.youtubeUrl || 'N/A'}`);

        // Get script breakdown to check progress
        const breakdown = await sheetsService.getScriptBreakdown(video.videoId);

        if (!breakdown || breakdown.length === 0) {
          logger.warn('   ⚠️  WARNING: Script Breakdown is empty - video needs regeneration');
          diagnostics.push({
            videoId: video.videoId,
            title: video.title,
            status: 'ERROR',
            issue: 'Script Breakdown missing',
            completed: 0,
            total: 0,
            pending: 0,
            recommendation: 'Regenerate script breakdown'
          });
          continue;
        }

        // Count asset statuses
        const total = breakdown.length;
        const completed = breakdown.filter(s => s.status === 'Complete').length;
        const pending = breakdown.filter(s => s.status === 'Pending').length;
        const generated = breakdown.filter(s => s.status === 'Generated').length;
        const assetDownloadFailed = breakdown.filter(s => s.status === 'Asset Download Failed').length;
        const otherStatuses = breakdown.filter(s =>
          s.status !== 'Complete' &&
          s.status !== 'Pending' &&
          s.status !== 'Generated' &&
          s.status !== 'Asset Download Failed'
        ).length;

        const completionPercentage = Math.round((completed / total) * 100);

        logger.info(`   Assets: ${completed}/${total} downloaded (${completionPercentage}%)`);
        logger.info(`   Pending: ${pending} | Generated: ${generated} | Failed: ${assetDownloadFailed}`);
        if (otherStatuses > 0) {
          logger.info(`   Other/Unknown: ${otherStatuses}`);
        }

        // Diagnose the issue
        let status = 'OK';
        let issue = 'In progress';
        let recommendation = 'Continue monitoring';

        if (completed === 0 && pending === total) {
          status = 'STUCK';
          issue = 'Download never started';
          recommendation = 'Restart download process';
        } else if (completed === total) {
          status = 'COMPLETE';
          issue = 'All assets downloaded';
          recommendation = 'Update status to Completed';
        } else if (completed > 0 && pending > 0) {
          status = 'PARTIAL';
          issue = 'Download interrupted';
          recommendation = 'Resume downloading pending assets';
        } else if (assetDownloadFailed > 0) {
          status = 'RETRY_NEEDED';
          issue = `${assetDownloadFailed} assets failed and need retry`;
          recommendation = 'Retry failed asset downloads';
        } else if (otherStatuses > 0) {
          status = 'UNKNOWN';
          issue = `${otherStatuses} assets in unknown state`;
          recommendation = 'Check logs and retry download';
        }

        const statusIcon = status === 'STUCK' ? '🔴' :
                          status === 'COMPLETE' ? '🟢' :
                          status === 'PARTIAL' ? '🟡' :
                          status === 'RETRY_NEEDED' ? '🔄' :
                          status === 'UNKNOWN' ? '⚠️' : '🔵';

        logger.info(`   ${statusIcon} Status: ${status} - ${issue}`);
        logger.info(`   📝 Recommendation: ${recommendation}`);

        diagnostics.push({
          videoId: video.videoId,
          title: video.title,
          status,
          issue,
          completed,
          total,
          pending,
          failed: assetDownloadFailed,
          completionPercentage,
          recommendation
        });

      } catch (error) {
        logger.error(`   ❌ Error analyzing ${video.videoId}:`, error.message);
        diagnostics.push({
          videoId: video.videoId,
          title: video.title,
          status: 'ERROR',
          issue: error.message,
          completed: 0,
          total: 0,
          pending: 0,
          recommendation: 'Check logs for details'
        });
      }
    }

    // Print summary report
    logger.info('\n================================================================================');
    logger.info('📊 DIAGNOSTIC SUMMARY');
    logger.info('================================================================================\n');

    const stuckCount = diagnostics.filter(d => d.status === 'STUCK').length;
    const completeCount = diagnostics.filter(d => d.status === 'COMPLETE').length;
    const partialCount = diagnostics.filter(d => d.status === 'PARTIAL').length;
    const retryNeededCount = diagnostics.filter(d => d.status === 'RETRY_NEEDED').length;
    const unknownCount = diagnostics.filter(d => d.status === 'UNKNOWN').length;
    const errorCount = diagnostics.filter(d => d.status === 'ERROR').length;

    logger.info(`Total Videos: ${diagnostics.length}`);
    logger.info(`🔴 Stuck (0% complete): ${stuckCount}`);
    logger.info(`🟢 Complete (100%): ${completeCount}`);
    logger.info(`🟡 Partial (1-99%): ${partialCount}`);
    logger.info(`🔄 Retry Needed (assets failed): ${retryNeededCount}`);
    logger.info(`⚠️  Unknown Status: ${unknownCount}`);
    logger.info(`❌ Errors: ${errorCount}`);

    logger.info('\n📋 DETAILED BREAKDOWN:');
    logger.info('--------------------------------------------------------------------------------');

    diagnostics.forEach(d => {
      const statusIcon = d.status === 'STUCK' ? '🔴' :
                        d.status === 'COMPLETE' ? '🟢' :
                        d.status === 'PARTIAL' ? '🟡' :
                        d.status === 'RETRY_NEEDED' ? '🔄' :
                        d.status === 'UNKNOWN' ? '⚠️' : '❌';

      logger.info(`${statusIcon} ${d.videoId}: ${d.issue}`);
      logger.info(`   Progress: ${d.completed}/${d.total} (${d.completionPercentage || 0}%)`);
      if (d.failed && d.failed > 0) {
        logger.info(`   Failed: ${d.failed} assets need retry`);
      }
      logger.info(`   Action: ${d.recommendation}`);
      logger.info('');
    });

    logger.info('================================================================================');
    logger.info('Next Steps:');
    logger.info('1. Run "node tools/complete-stuck-downloads.js" to attempt automatic fixes');
    logger.info('2. Videos with ERROR status may need manual intervention');
    logger.info('3. Check logs for detailed error messages');
    logger.info('================================================================================\n');

    // Return diagnostics for programmatic use
    return diagnostics;

  } catch (error) {
    logger.error('❌ Fatal error in findStuckDownloads:', error);
    throw error;
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  findStuckDownloads()
    .then(() => {
      logger.info('✅ Diagnostic scan complete');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('❌ Diagnostic scan failed:', error);
      process.exit(1);
    });
}

export default findStuckDownloads;
