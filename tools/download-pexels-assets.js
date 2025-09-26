#!/usr/bin/env node

/**
 * Test Tool: Download Pexels Assets
 *
 * This tool tests the PexelsService functionality by downloading assets
 * for a specific video's Script Breakdown sheet and uploading them to Google Drive.
 *
 * Usage:
 *   node tools/download-pexels-assets.js [videoId]
 *   node tools/download-pexels-assets.js --list-videos
 *   node tools/download-pexels-assets.js --health-check
 *
 * Examples:
 *   node tools/download-pexels-assets.js VID-0001
 *   node tools/download-pexels-assets.js --list-videos
 *   node tools/download-pexels-assets.js --health-check
 */

import { config, validateConfig } from '../config/config.js';
import logger from '../src/utils/logger.js';
import PexelsService from '../src/services/pexelsService.js';
import GoogleSheetsService from '../src/services/googleSheetsService.js';

// Console formatting utilities
const formatSection = (title, content = '') => {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🎬 ${title.toUpperCase()}`);
  console.log(`${'='.repeat(60)}`);
  if (content) console.log(content);
};

const formatSubsection = (title) => {
  console.log(`\n${'─'.repeat(40)}`);
  console.log(`📋 ${title}`);
  console.log(`${'─'.repeat(40)}`);
};

const formatSuccess = (message) => {
  console.log(`✅ ${message}`);
};

const formatError = (message) => {
  console.log(`❌ ${message}`);
};

const formatWarning = (message) => {
  console.log(`⚠️  ${message}`);
};

const formatInfo = (message) => {
  console.log(`ℹ️  ${message}`);
};

// Get command line arguments
const args = process.argv.slice(2);
const videoId = args[0];

// Command flags
const showHelp = args.includes('--help') || args.includes('-h');
const listVideos = args.includes('--list-videos') || args.includes('-l');
const healthCheck = args.includes('--health-check') || args.includes('--health');
const cleanupAssets = args.includes('--clean') || args.includes('--cleanup');

async function showUsage() {
  formatSection('PEXELS ASSET DOWNLOAD TEST TOOL');

  console.log(`
📖 USAGE:
   node tools/download-pexels-assets.js [videoId]
   node tools/download-pexels-assets.js --list-videos
   node tools/download-pexels-assets.js --health-check
   node tools/download-pexels-assets.js [videoId] --clean

📋 EXAMPLES:
   node tools/download-pexels-assets.js VID-0001
   node tools/download-pexels-assets.js --list-videos
   node tools/download-pexels-assets.js --health-check
   node tools/download-pexels-assets.js VID-0001 --clean

🔧 OPTIONS:
   [videoId]        Process specific video ID (e.g., VID-0001)
   --list-videos    Show all available videos with their statuses
   --health-check   Test Pexels API and service connectivity
   --clean          Clean existing assets and reset status before processing
   --help           Show this help message

🎯 FUNCTIONALITY:
   • Downloads video assets for sentences with word count > 6
   • Downloads photo assets for sentences with word count <= 6
   • All assets are filtered to landscape orientation only
   • Uses search phrases from Script Breakdown sheet
   • Creates 'Assets' subfolder in video's Google Drive folder
   • Uploads assets to the Assets subfolder
   • Updates Image URL column in Script Breakdown with 'Complete' status
   • Clean mode: Removes existing assets and resets all statuses first
   • Provides detailed processing statistics

📋 REQUIREMENTS:
   • PEXELS_API_KEY must be set in .env file
   • Video must have Script Breakdown sheet with search phrases
   • Google Drive integration must be configured
  `);
}

async function performHealthCheck() {
  formatSection('HEALTH CHECK', 'Testing Pexels API and service connectivity...');

  try {
    // Validate configuration
    formatSubsection('Configuration Validation');
    validateConfig();
    formatSuccess('Configuration validation passed');

    if (!config.pexels.apiKey) {
      formatError('PEXELS_API_KEY is missing from environment variables');
      return false;
    }
    formatSuccess('Pexels API key is configured');

    // Test Pexels service
    formatSubsection('Pexels Service Health Check');
    const pexelsService = new PexelsService();
    const healthStatus = await pexelsService.healthCheck();

    if (healthStatus.status === 'healthy') {
      formatSuccess('Pexels API connection successful');
      formatInfo(`Results found in test: ${healthStatus.resultsFound}`);
    } else {
      formatError('Pexels API health check failed');
      formatError(`Error: ${healthStatus.error}`);
      return false;
    }

    // Test Google Sheets service
    formatSubsection('Google Sheets Service Health Check');
    const sheetsService = new GoogleSheetsService();
    const sheetsHealth = await sheetsService.healthCheck();

    if (sheetsHealth.status === 'healthy') {
      formatSuccess('Google Sheets connection successful');
    } else {
      formatError('Google Sheets health check failed');
      formatError(`Error: ${sheetsHealth.error}`);
      return false;
    }

    formatSection('HEALTH CHECK RESULTS', '🎉 All services are healthy and ready to use!');
    return true;

  } catch (error) {
    formatError(`Health check failed: ${error.message}`);
    return false;
  }
}

async function listAvailableVideos() {
  formatSection('AVAILABLE VIDEOS', 'Listing all videos with their processing status...');

  try {
    const sheetsService = new GoogleSheetsService();
    const pexelsService = new PexelsService();

    // Get all videos
    const allVideos = await sheetsService.getAllVideos();

    if (allVideos.length === 0) {
      formatWarning('No videos found in the master sheet');
      return;
    }

    formatInfo(`Found ${allVideos.length} total videos`);

    formatSubsection('Video Processing Status');

    for (const video of allVideos.slice(0, 10)) { // Limit to first 10 for performance
      try {
        const stats = await pexelsService.getProcessingStats(video.videoId);

        console.log(`\n📹 ${video.videoId} - ${video.title || 'Unknown Title'}`);
        console.log(`   Status: ${video.status || 'Unknown'}`);
        console.log(`   Script Approved: ${video.scriptApproved || 'Pending'}`);
        console.log(`   Total Sentences: ${stats.totalSentences}`);
        console.log(`   Assets Downloaded: ${stats.processed}`);
        console.log(`   Pending: ${stats.pending}`);
        console.log(`   Failed: ${stats.failed}`);

        if (stats.totalSentences > 0 && stats.pending > 0) {
          console.log(`   🎯 Ready for asset processing`);
        }

      } catch (error) {
        console.log(`\n📹 ${video.videoId} - ${video.title || 'Unknown Title'}`);
        console.log(`   ⚠️  Could not get processing stats: ${error.message}`);
      }
    }

    if (allVideos.length > 10) {
      formatInfo(`... and ${allVideos.length - 10} more videos (showing first 10)`);
    }

  } catch (error) {
    formatError(`Failed to list videos: ${error.message}`);
  }
}

async function processVideoAssets(videoId) {
  formatSection('PEXELS ASSET PROCESSING', `Processing assets for video: ${videoId}`);

  try {
    // Initialize services
    const pexelsService = new PexelsService();
    const sheetsService = new GoogleSheetsService();

    // Validate video exists
    formatSubsection('Video Validation');
    const videoDetails = await sheetsService.getVideoDetails(videoId);
    if (!videoDetails) {
      formatError(`Video not found: ${videoId}`);
      return;
    }

    formatSuccess(`Found video: ${videoDetails.title}`);
    formatInfo(`Status: ${videoDetails.status}`);
    formatInfo(`Drive Folder: ${videoDetails.driveFolder}`);

    // Check if Script Breakdown exists
    const scriptBreakdown = await sheetsService.getScriptBreakdown(videoId);
    if (!scriptBreakdown || scriptBreakdown.length === 0) {
      formatError(`No Script Breakdown found for ${videoId}`);
      formatWarning('Make sure the video has been processed and has Script Breakdown data');
      return;
    }

    formatSuccess(`Found Script Breakdown with ${scriptBreakdown.length} sentences`);

    // Show preview of what will be processed
    formatSubsection('Processing Preview');

    let videoCount = 0;
    let photoCount = 0;

    for (const sentence of scriptBreakdown) {
      const wordCount = parseInt(sentence.wordCount) || 0;
      const assetType = wordCount > 6 ? 'video' : 'photo';

      if (assetType === 'video') videoCount++;
      else photoCount++;
    }

    formatInfo(`Will download: ${videoCount} videos, ${photoCount} photos`);

    console.log('\n📝 Preview of sentences to process:');
    scriptBreakdown.slice(0, 5).forEach(sentence => {
      const wordCount = parseInt(sentence.wordCount) || 0;
      const assetType = wordCount > 6 ? '🎬 VIDEO' : '📸 PHOTO';
      console.log(`   S-${sentence.sentenceNumber}: "${sentence.searchPhrase}" (${wordCount} words) → ${assetType}`);
    });

    if (scriptBreakdown.length > 5) {
      formatInfo(`... and ${scriptBreakdown.length - 5} more sentences`);
    }

    // Handle cleanup if requested
    if (cleanupAssets) {
      formatSubsection('Asset Cleanup');
      console.log('\n⚠️  CLEANUP MODE: This will remove all existing assets and reset statuses first.');
      console.log('   Press Ctrl+C to cancel, or wait 5 seconds to continue...\n');

      // 5 second countdown for cleanup
      for (let i = 5; i > 0; i--) {
        process.stdout.write(`\rStarting cleanup in ${i} seconds...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      console.log('\n');

      const cleanupResults = await pexelsService.cleanExistingAssets(videoId);

      formatSuccess(`Cleanup completed:`);
      console.log(`   Files deleted: ${cleanupResults.deletedFiles}`);
      console.log(`   Statuses reset: ${cleanupResults.resetStatuses}`);

      if (cleanupResults.errors.length > 0) {
        formatWarning(`Cleanup errors (${cleanupResults.errors.length}):`);
        cleanupResults.errors.forEach(error => console.log(`   ${error}`));
      }
      console.log('');
    }

    // Confirm processing
    console.log('\n⚠️  This will download and upload assets to Google Drive (Assets subfolder).');
    console.log('   All assets will be landscape orientation only and status will be set to "Complete".');
    console.log('   Press Ctrl+C to cancel, or wait 5 seconds to continue...\n');

    // 5 second countdown
    for (let i = 5; i > 0; i--) {
      process.stdout.write(`\rStarting in ${i} seconds...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    console.log('\n');

    // Process the assets
    formatSubsection('Asset Processing');

    const startTime = new Date();
    const results = await pexelsService.processScriptBreakdownAssets(videoId);
    const endTime = new Date();
    const duration = Math.round((endTime - startTime) / 1000);

    // Display results
    formatSubsection('Processing Results');

    formatSuccess(`Processing completed in ${duration} seconds`);
    console.log(`\n📊 SUMMARY:`);
    console.log(`   Total Sentences: ${results.totalSentences}`);
    console.log(`   Successfully Processed: ${results.successCount}`);
    console.log(`   Failed: ${results.failureCount}`);
    console.log(`   Video Assets: ${results.videoAssets}`);
    console.log(`   Photo Assets: ${results.photoAssets}`);

    if (results.successCount > 0) {
      console.log(`\n✅ SUCCESS: ${results.successCount} assets downloaded and uploaded to Google Drive`);
    }

    if (results.failureCount > 0) {
      console.log(`\n❌ FAILURES (${results.failureCount}):`);
      results.errors.forEach(error => {
        console.log(`   S-${error.sentenceNumber}: ${error.reason} (searched: "${error.searchPhrase}")`);
      });
    }

    // Show detailed results for successful downloads
    if (results.results.length > 0) {
      formatSubsection('Detailed Results');

      results.results.forEach(result => {
        if (result.success) {
          console.log(`✅ S-${result.sentenceNumber}: ${result.filename} (${result.assetType.toUpperCase()}) - Pexels ID: ${result.pexelsId}`);
        } else {
          console.log(`❌ S-${result.sentenceNumber}: ${result.reason}`);
        }
      });
    }

    formatSection('PROCESSING COMPLETE', `🎉 Asset processing finished for ${videoId}`);

  } catch (error) {
    formatError(`Failed to process video assets: ${error.message}`);
    logger.error('Detailed error:', error);
  }
}

async function main() {
  console.log('🚀 Pexels Asset Download Test Tool\n');

  // Show help
  if (showHelp) {
    await showUsage();
    return;
  }

  // Health check mode
  if (healthCheck) {
    const isHealthy = await performHealthCheck();
    process.exit(isHealthy ? 0 : 1);
  }

  // List videos mode
  if (listVideos) {
    await listAvailableVideos();
    return;
  }

  // Process specific video
  if (videoId) {
    if (!videoId.match(/^VID-\d{4}$/)) {
      formatError('Invalid video ID format. Expected format: VID-XXXX (e.g., VID-0001)');
      await showUsage();
      return;
    }

    await processVideoAssets(videoId);
    return;
  }

  // No arguments provided
  formatError('No arguments provided');
  await showUsage();
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n⚠️  Process interrupted by user');
  console.log('🛑 Shutting down gracefully...');
  process.exit(130);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Run the main function
main().catch(error => {
  formatError(`Tool execution failed: ${error.message}`);
  console.error('\n🔍 Debug Information:');
  console.error(error.stack);
  process.exit(1);
});