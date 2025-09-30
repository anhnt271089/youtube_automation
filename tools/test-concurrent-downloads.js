#!/usr/bin/env node

/**
 * Test Concurrent Download Prevention
 *
 * This script tests the duplicate download prevention by simulating concurrent
 * download attempts on the same video
 *
 * Usage:
 *   node tools/test-concurrent-downloads.js [VIDEO_ID]
 */

import PexelsService from '../src/services/pexelsService.js';
import GoogleSheetsService from '../src/services/googleSheetsService.js';
import logger from '../src/utils/logger.js';

const pexelsService = new PexelsService();
const sheetsService = new GoogleSheetsService();

async function simulateConcurrentDownload(videoId, processId) {
  console.log(`[Process ${processId}] Starting download for ${videoId}...`);

  try {
    const startTime = Date.now();
    const result = await pexelsService.processScriptBreakdownAssets(videoId, {
      triggeredBy: `concurrent-test-${processId}`
    });

    const duration = Math.round((Date.now() - startTime) / 1000);

    console.log(`\n[Process ${processId}] Completed in ${duration}s:`);
    console.log(`  - Processed: ${result.processedCount} sentences`);
    console.log(`  - Success: ${result.successCount}`);
    console.log(`  - Failed: ${result.failureCount}`);
    console.log(`  - Skipped: ${result.skippedCount}`);

    if (result.errors && result.errors.length > 0) {
      console.log(`  - Errors: ${result.errors.length}`);
      result.errors.slice(0, 3).forEach(err => {
        console.log(`    * S-${err.sentenceNumber}: ${err.reason}`);
      });
    }

    return {
      processId,
      success: true,
      result,
      duration
    };

  } catch (error) {
    console.error(`[Process ${processId}] Error:`, error.message);
    return {
      processId,
      success: false,
      error: error.message
    };
  }
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('Usage: node tools/test-concurrent-downloads.js [VIDEO_ID]');
    console.log('Example: node tools/test-concurrent-downloads.js VID-0017');
    process.exit(1);
  }

  const videoId = args[0];

  console.log('🧪 Concurrent Download Prevention Test');
  console.log('='.repeat(60));
  console.log(`Testing video: ${videoId}`);
  console.log(`Starting 2 concurrent download processes...\n`);

  // First, check if video has approved script
  const videoDetails = await sheetsService.getVideoDetails(videoId);
  if (!videoDetails) {
    console.error(`❌ Video ${videoId} not found`);
    process.exit(1);
  }

  if (videoDetails.scriptApproved !== 'Approved') {
    console.error(`❌ Video ${videoId} script is not approved (status: ${videoDetails.scriptApproved})`);
    console.log('Please approve the script first before testing concurrent downloads');
    process.exit(1);
  }

  console.log(`✅ Video found: ${videoDetails.title}`);
  console.log(`✅ Script approved: ${videoDetails.scriptApproved}\n`);

  // Reset any stuck downloads first
  console.log('🔧 Resetting any stuck downloads...');
  await pexelsService.resetStuckDownloadingStatuses(videoId);
  console.log('✅ Reset complete\n');

  // Get initial breakdown state
  const initialBreakdown = await sheetsService.getScriptBreakdown(videoId);
  const pendingCount = initialBreakdown.filter(s =>
    s.status === 'Pending' || s.status === '' || !s.status
  ).length;

  console.log(`📊 Initial state:`);
  console.log(`  - Total sentences: ${initialBreakdown.length}`);
  console.log(`  - Pending: ${pendingCount}`);
  console.log(`  - Already complete: ${initialBreakdown.length - pendingCount}\n`);

  if (pendingCount === 0) {
    console.log('⚠️  All sentences already have assets. To test properly:');
    console.log('   1. Use tools/clean-video-assets.js to clean existing assets');
    console.log('   2. Run this test again');
    process.exit(0);
  }

  console.log('🚀 Starting concurrent processes...\n');

  // Start both processes simultaneously
  const [result1, result2] = await Promise.all([
    simulateConcurrentDownload(videoId, 1),
    simulateConcurrentDownload(videoId, 2)
  ]);

  // Get final breakdown state
  console.log('\n' + '='.repeat(60));
  console.log('📊 Final Results:');
  console.log('='.repeat(60));

  const finalBreakdown = await sheetsService.getScriptBreakdown(videoId);
  const completeCount = finalBreakdown.filter(s => s.status === 'Complete').length;
  const downloadingCount = finalBreakdown.filter(s => s.status === 'Downloading').length;
  const failedCount = finalBreakdown.filter(s => s.status === 'Asset Download Failed').length;

  console.log(`\n📋 Final breakdown:`);
  console.log(`  - Total sentences: ${finalBreakdown.length}`);
  console.log(`  - Complete: ${completeCount}`);
  console.log(`  - Downloading (stuck): ${downloadingCount}`);
  console.log(`  - Failed: ${failedCount}`);
  console.log(`  - Pending: ${finalBreakdown.length - completeCount - downloadingCount - failedCount}`);

  console.log(`\n⏱️  Process durations:`);
  console.log(`  - Process 1: ${result1.duration || 'N/A'}s`);
  console.log(`  - Process 2: ${result2.duration || 'N/A'}s`);

  // Check for duplicate downloads
  console.log(`\n🔍 Duplicate detection:`);

  const process1Downloaded = result1.result?.successCount || 0;
  const process2Downloaded = result2.result?.successCount || 0;
  const totalDownloaded = process1Downloaded + process2Downloaded;

  console.log(`  - Process 1 downloaded: ${process1Downloaded} assets`);
  console.log(`  - Process 2 downloaded: ${process2Downloaded} assets`);
  console.log(`  - Total downloaded: ${totalDownloaded} assets`);
  console.log(`  - Expected maximum: ${pendingCount} assets`);

  if (totalDownloaded > pendingCount) {
    console.log(`\n⚠️  WARNING: Downloaded ${totalDownloaded - pendingCount} MORE assets than pending!`);
    console.log(`    This indicates duplicate downloads occurred.`);
  } else if (process1Downloaded > 0 && process2Downloaded > 0) {
    console.log(`\n✅ SUCCESS: Both processes downloaded different assets (no duplicates)`);
    console.log(`    The duplicate prevention system is working correctly!`);
  } else if (process1Downloaded > 0 || process2Downloaded > 0) {
    console.log(`\n✅ SUCCESS: One process downloaded, the other detected and skipped`);
    console.log(`    The duplicate prevention system is working correctly!`);
  } else {
    console.log(`\n⚠️  No downloads occurred - both processes may have skipped`);
  }

  // Check for stuck downloads
  if (downloadingCount > 0) {
    console.log(`\n⚠️  ${downloadingCount} sentences stuck in "Downloading" status`);
    console.log(`    Run: node tools/reset-stuck-downloads.js ${videoId}`);
  }
}

main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});