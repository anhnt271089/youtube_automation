#!/usr/bin/env node

/**
 * Reset Stuck Downloads Utility
 *
 * Resets any sentences stuck in "Downloading" status back to "Pending"
 * This is useful for recovering from interrupted asset downloads
 *
 * Usage:
 *   node tools/reset-stuck-downloads.js [VIDEO_ID]
 *   node tools/reset-stuck-downloads.js --all
 */

import PexelsService from '../src/services/pexelsService.js';
import GoogleSheetsService from '../src/services/googleSheetsService.js';
import logger from '../src/utils/logger.js';

const pexelsService = new PexelsService();
const sheetsService = new GoogleSheetsService();

async function resetStuckDownloadsForVideo(videoId) {
  try {
    console.log(`\n🔍 Checking ${videoId} for stuck downloads...`);

    const result = await pexelsService.resetStuckDownloadingStatuses(videoId);

    if (result.reset > 0) {
      console.log(`✅ Reset ${result.reset}/${result.total} stuck downloads for ${videoId}`);
      return { videoId, reset: result.reset, total: result.total };
    } else if (result.error) {
      console.log(`❌ Error for ${videoId}: ${result.error}`);
      return { videoId, error: result.error };
    } else {
      console.log(`✓ ${videoId}: ${result.message || 'No stuck downloads'}`);
      return { videoId, reset: 0 };
    }
  } catch (error) {
    console.error(`❌ Failed to reset ${videoId}:`, error.message);
    return { videoId, error: error.message };
  }
}

async function resetAllStuckDownloads() {
  try {
    console.log('🔍 Finding all videos with approved scripts...');

    const allVideos = await sheetsService.getAllVideos();
    const approvedVideos = allVideos.filter(v => v.scriptApproved === 'Approved');

    console.log(`Found ${approvedVideos.length} videos with approved scripts\n`);

    const results = [];
    let totalReset = 0;

    for (const video of approvedVideos) {
      const result = await resetStuckDownloadsForVideo(video.videoId);
      results.push(result);
      if (result.reset) {
        totalReset += result.reset;
      }

      // Add small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 Summary:');
    console.log('='.repeat(60));
    console.log(`Total videos checked: ${approvedVideos.length}`);
    console.log(`Total sentences reset: ${totalReset}`);

    const videosWithResets = results.filter(r => r.reset > 0);
    if (videosWithResets.length > 0) {
      console.log(`\nVideos with resets:`);
      videosWithResets.forEach(r => {
        console.log(`  - ${r.videoId}: ${r.reset} sentences`);
      });
    }

    const videosWithErrors = results.filter(r => r.error);
    if (videosWithErrors.length > 0) {
      console.log(`\nVideos with errors:`);
      videosWithErrors.forEach(r => {
        console.log(`  - ${r.videoId}: ${r.error}`);
      });
    }

    return results;

  } catch (error) {
    console.error('❌ Failed to reset stuck downloads:', error.message);
    throw error;
  }
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('Usage:');
    console.log('  node tools/reset-stuck-downloads.js [VIDEO_ID]');
    console.log('  node tools/reset-stuck-downloads.js --all');
    console.log('\nExamples:');
    console.log('  node tools/reset-stuck-downloads.js VID-0017');
    console.log('  node tools/reset-stuck-downloads.js --all');
    process.exit(1);
  }

  const videoIdOrFlag = args[0];

  console.log('🔧 Reset Stuck Downloads Utility');
  console.log('='.repeat(60));

  if (videoIdOrFlag === '--all') {
    await resetAllStuckDownloads();
  } else {
    await resetStuckDownloadsForVideo(videoIdOrFlag);
  }

  console.log('\n✅ Reset operation completed');
}

main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});