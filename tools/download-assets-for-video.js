#!/usr/bin/env node

/**
 * Tool: Download Assets for Specific Video
 *
 * Downloads all required assets (images/videos) for a specific video ID
 * and updates Google Sheets with the results.
 *
 * Usage:
 *   node tools/download-assets-for-video.js <videoId>
 *   node tools/download-assets-for-video.js VID-0011
 */

import AssetDownloadOrchestrator from '../src/services/assetDownloadOrchestrator.js';
import GoogleSheetsService from '../src/services/googleSheetsService.js';
import PexelsService from '../src/services/pexelsService.js';
import logger from '../src/utils/logger.js';

// Get video ID from command line arguments
const videoId = process.argv[2];

if (!videoId) {
  console.error('❌ Error: Video ID is required');
  console.error('Usage: node tools/download-assets-for-video.js <videoId>');
  console.error('Example: node tools/download-assets-for-video.js VID-0011');
  process.exit(1);
}

async function downloadAssetsForVideo(videoId) {
  try {
    logger.info(`🎬 Starting asset download for ${videoId}`);
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🎬 Asset Download Tool for ${videoId}`);
    console.log(`${'='.repeat(60)}\n`);

    // Initialize services
    const sheetsService = new GoogleSheetsService();
    const pexelsService = new PexelsService();
    const orchestrator = new AssetDownloadOrchestrator();

    // Step 1: Check video exists and get details
    console.log('📋 Step 1: Checking video details...');
    const videoDetails = await sheetsService.getVideoDetails(videoId);

    if (!videoDetails) {
      throw new Error(`Video not found: ${videoId}`);
    }

    console.log(`   ✓ Video found: ${videoDetails.title}`);
    console.log(`   ✓ Status: ${videoDetails.status}`);
    console.log(`   ✓ Script Approved: ${videoDetails.scriptApproved}`);
    console.log(`   ✓ Drive Folder: ${videoDetails.driveFolder || 'Not set'}`);
    console.log(`   ✓ Detail Workbook: ${videoDetails.detailWorkbookUrl || 'Not set'}`);

    // Step 2: Validate prerequisites
    console.log('\n🔍 Step 2: Validating prerequisites...');
    const validation = await orchestrator.validateVideoForProcessing(videoId);

    if (!validation.valid) {
      console.error('\n❌ Validation failed:');
      validation.errors.forEach(error => {
        console.error(`   ✗ ${error}`);
      });
      throw new Error('Video validation failed - see errors above');
    }

    console.log('   ✓ All prerequisites met');
    console.log(`   ✓ Script breakdown found: ${validation.scriptBreakdown?.length || 0} sentences`);

    // Count sentences needing assets
    const needsProcessing = validation.scriptBreakdown.filter(s =>
      s.searchPhrase &&
      s.searchPhrase.trim() !== '' &&
      s.status !== 'Complete' &&
      s.status !== 'Generated'
    );
    console.log(`   ✓ Sentences needing assets: ${needsProcessing.length}`);

    // Step 3: Check for existing assets
    console.log('\n📊 Step 3: Checking existing asset status...');
    const stats = await pexelsService.getProcessingStats(videoId);
    console.log(`   • Total sentences: ${stats.totalSentences}`);
    console.log(`   • Already processed: ${stats.processed}`);
    console.log(`   • Pending: ${stats.pending}`);
    console.log(`   • Failed: ${stats.failed}`);

    if (needsProcessing.length === 0) {
      console.log('\n✅ All assets already downloaded!');
      console.log('   No further processing needed.');
      return {
        success: true,
        skipped: true,
        reason: 'All assets already present',
        stats
      };
    }

    // Step 4: Start asset download process
    console.log('\n🚀 Step 4: Starting asset download...');
    console.log(`   Processing ${needsProcessing.length} sentences...`);
    console.log('   This may take several minutes...\n');

    const result = await orchestrator.handleScriptApproval(videoId, {
      triggeredBy: 'manual-tool',
      toolName: 'download-assets-for-video'
    });

    // Step 5: Report results
    console.log(`\n${'='.repeat(60)}`);
    console.log('📊 RESULTS SUMMARY');
    console.log(`${'='.repeat(60)}\n`);

    if (result.skipped) {
      console.log(`⏭️  Processing skipped: ${result.reason}`);
      if (result.cooldownRemaining) {
        const minutes = Math.ceil(result.cooldownRemaining / 60000);
        console.log(`   Cooldown remaining: ${minutes} minutes`);
      }
    } else if (result.success) {
      console.log('✅ Asset download completed successfully!\n');
      console.log(`   Video ID: ${videoId}`);
      console.log(`   Total sentences: ${result.result.totalSentences}`);
      console.log(`   Processed: ${result.result.processedCount}`);
      console.log(`   Successful: ${result.result.successCount}`);
      console.log(`   Failed: ${result.result.failureCount}`);
      console.log(`   Skipped: ${result.result.skippedCount}`);
      console.log(`   Video assets: ${result.result.videoAssets}`);
      console.log(`   Photo assets: ${result.result.photoAssets}`);

      if (result.result.errors && result.result.errors.length > 0) {
        console.log('\n⚠️  Errors encountered:');
        result.result.errors.forEach(error => {
          console.log(`   • S-${error.sentenceNumber}: ${error.reason}`);
        });
      }

      // Show Drive folder link
      if (videoDetails.driveFolder) {
        console.log(`\n📁 Assets saved to: ${videoDetails.driveFolder}`);
      }
    } else {
      console.log('❌ Asset download failed\n');
      console.log(`   Reason: ${result.reason || result.error}`);
      if (result.errors) {
        console.log('\n   Errors:');
        result.errors.forEach(error => {
          console.log(`   • ${error}`);
        });
      }
    }

    // Step 6: Final verification
    console.log('\n🔍 Step 6: Verifying final status...');
    const finalStats = await pexelsService.getProcessingStats(videoId);
    console.log(`   • Total sentences: ${finalStats.totalSentences}`);
    console.log(`   • Processed: ${finalStats.processed}`);
    console.log(`   • Pending: ${finalStats.pending}`);
    console.log(`   • Failed: ${finalStats.failed}`);

    // Calculate completion percentage
    const completionRate = finalStats.totalSentences > 0
      ? Math.round((finalStats.processed / finalStats.totalSentences) * 100)
      : 0;
    console.log(`   • Completion rate: ${completionRate}%`);

    console.log(`\n${'='.repeat(60)}`);
    console.log('✅ Asset download process completed!');
    console.log(`${'='.repeat(60)}\n`);

    return {
      success: !result.skipped && result.success,
      result,
      finalStats,
      completionRate
    };

  } catch (error) {
    console.error(`\n❌ Error downloading assets for ${videoId}:`, error.message);
    logger.error(`Asset download tool error for ${videoId}:`, error);
    throw error;
  }
}

// Execute the tool
downloadAssetsForVideo(videoId)
  .then(result => {
    if (result.success || result.skipped) {
      process.exit(0);
    } else {
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('\n💥 Fatal error:', error.message);
    process.exit(1);
  });
