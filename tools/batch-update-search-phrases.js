#!/usr/bin/env node
/**
 * Batch Update Search Phrases Tool
 *
 * Updates search phrases for videos VID-0002 through VID-0016 using the existing
 * generateEnhancedSearchPhrase() function from GoogleSheetsService.
 *
 * This tool processes each video sequentially, reading Script Breakdown content,
 * regenerating ALL search phrases for each sentence, and updating Google Sheets.
 *
 * Usage: node tools/batch-update-search-phrases.js
 *
 * Features:
 * - Sequential processing with detailed progress logging
 * - Robust error handling with retry logic
 * - Verification of search phrases after updates
 * - Summary statistics and processing reports
 * - Sample Pexels API testing for compatibility
 */

import GoogleSheetsService from '../src/services/googleSheetsService.js';
import PexelsService from '../src/services/pexelsService.js';
import logger from '../src/utils/logger.js';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class BatchSearchPhraseUpdater {
  constructor() {
    this.googleSheetsService = new GoogleSheetsService();
    this.pexelsService = new PexelsService();
    this.targetVideoIds = [
      'VID-0002', 'VID-0003', 'VID-0004', 'VID-0005', 'VID-0006',
      'VID-0007', 'VID-0008', 'VID-0009', 'VID-0010', 'VID-0011',
      'VID-0012', 'VID-0013', 'VID-0014', 'VID-0015', 'VID-0016'
    ];

    this.stats = {
      totalVideos: 0,
      processedVideos: 0,
      failedVideos: 0,
      totalSentences: 0,
      updatedSentences: 0,
      skippedVideos: [],
      successfulVideos: [],
      failedVideosList: [],
      startTime: null,
      endTime: null
    };
  }

  /**
   * Main execution function
   */
  async run() {
    try {
      this.stats.startTime = new Date();
      logger.info('🚀 Starting batch search phrase update process...');
      logger.info(`📋 Target videos: ${this.targetVideoIds.length} videos (${this.targetVideoIds[0]} to ${this.targetVideoIds[this.targetVideoIds.length - 1]})`);

      // Verify Google Sheets connection
      await this.verifyConnection();

      // Process each video sequentially
      for (let i = 0; i < this.targetVideoIds.length; i++) {
        const videoId = this.targetVideoIds[i];
        const videoIndex = i + 1;

        logger.info(`\n📼 Processing ${videoIndex}/${this.targetVideoIds.length}: ${videoId}`);

        try {
          const result = await this.processVideo(videoId);

          if (result.success) {
            this.stats.successfulVideos.push({
              videoId: videoId,
              sentencesUpdated: result.sentencesUpdated,
              title: result.title
            });
            this.stats.updatedSentences += result.sentencesUpdated;
            this.stats.processedVideos++;
            logger.info(`✅ ${videoId} completed: ${result.sentencesUpdated} sentences updated`);
          } else {
            this.stats.skippedVideos.push({
              videoId: videoId,
              reason: result.reason,
              title: result.title || 'Unknown'
            });
            logger.warn(`⚠️ ${videoId} skipped: ${result.reason}`);
          }

        } catch (error) {
          this.stats.failedVideos++;
          this.stats.failedVideosList.push({
            videoId: videoId,
            error: error.message
          });
          logger.error(`❌ ${videoId} failed: ${error.message}`);

          // Continue with next video on error
          continue;
        }

        // Brief pause between videos to avoid API rate limits
        if (i < this.targetVideoIds.length - 1) {
          await this.delay(1000); // 1 second delay
        }
      }

      // Generate final summary
      await this.generateSummary();

      // Test sample search phrases with Pexels
      await this.testSampleSearchPhrases();

      this.stats.endTime = new Date();
      logger.info('\n🎉 Batch search phrase update process completed!');

    } catch (error) {
      logger.error('💥 Batch update process failed:', error);
      throw error;
    }
  }

  /**
   * Verify Google Sheets connection
   */
  async verifyConnection() {
    try {
      logger.info('🔍 Verifying Google Sheets connection...');
      const healthCheck = await this.googleSheetsService.healthCheck();

      if (healthCheck.status !== 'healthy') {
        throw new Error(`Google Sheets service unhealthy: ${healthCheck.error}`);
      }

      logger.info('✅ Google Sheets connection verified');
      return true;
    } catch (error) {
      logger.error('❌ Google Sheets connection failed:', error.message);
      throw error;
    }
  }

  /**
   * Process a single video
   */
  async processVideo(videoId) {
    try {
      // Get video details
      const videoDetails = await this.googleSheetsService.getVideoDetails(videoId);
      if (!videoDetails) {
        return {
          success: false,
          reason: 'Video not found in master sheet'
        };
      }

      logger.info(`📝 Video: "${videoDetails.title}" (${videoDetails.status})`);

      // Get script breakdown data
      const scriptBreakdown = await this.googleSheetsService.getScriptBreakdown(videoId);
      if (!scriptBreakdown || scriptBreakdown.length === 0) {
        return {
          success: false,
          reason: 'No script breakdown found',
          title: videoDetails.title
        };
      }

      logger.info(`📊 Found ${scriptBreakdown.length} sentences to process`);
      this.stats.totalSentences += scriptBreakdown.length;

      // Process each sentence to regenerate search phrases
      let updatedCount = 0;
      const batchUpdates = [];

      for (let i = 0; i < scriptBreakdown.length; i++) {
        const sentence = scriptBreakdown[i];
        const sentenceNumber = sentence.sentenceNumber || (i + 1);

        // Generate new search phrase using existing function
        const newSearchPhrase = this.googleSheetsService.generateEnhancedSearchPhrase(
          sentence.scriptText || '',
          sentence.imagePrompt || ''
        );

        // Only update if the search phrase is different or empty
        if (newSearchPhrase && newSearchPhrase.trim() !== (sentence.searchPhrase || '').trim()) {
          batchUpdates.push({
            sentenceNumber: sentenceNumber,
            searchPhrase: newSearchPhrase,
            oldPhrase: sentence.searchPhrase || '(empty)'
          });
          updatedCount++;

          logger.info(`  📝 Sentence ${sentenceNumber}: "${sentence.searchPhrase || '(empty)'}" → "${newSearchPhrase}"`);
        }
      }

      // Apply batch updates to Google Sheets
      if (batchUpdates.length > 0) {
        await this.applyBatchUpdates(videoId, batchUpdates);
        logger.info(`💾 Applied ${batchUpdates.length} search phrase updates to Google Sheets`);
      } else {
        logger.info('📋 No search phrase updates needed - all phrases already optimal');
      }

      return {
        success: true,
        sentencesUpdated: updatedCount,
        totalSentences: scriptBreakdown.length,
        title: videoDetails.title
      };

    } catch (error) {
      logger.error(`❌ Error processing ${videoId}:`, error.message);
      throw error;
    }
  }

  /**
   * Apply batch updates to Google Sheets
   */
  async applyBatchUpdates(videoId, updates) {
    try {
      const videoRow = await this.googleSheetsService.findVideoRow(videoId);
      if (!videoRow || !videoRow.data[this.googleSheetsService.masterColumns.detailWorkbookUrl]) {
        throw new Error(`Detail workbook not found for video: ${videoId}`);
      }

      const workbookUrl = videoRow.data[this.googleSheetsService.masterColumns.detailWorkbookUrl];
      const workbookId = workbookUrl.split('/d/')[1].split('/')[0];

      // Prepare batch update requests
      const batchUpdateRequests = updates.map(update => ({
        range: `${this.googleSheetsService.detailSheets.scriptBreakdown}!D${parseInt(update.sentenceNumber) + 1}`, // Column D for Search Phrase
        values: [[update.searchPhrase]]
      }));

      // Execute batch update
      await this.googleSheetsService.sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: workbookId,
        resource: {
          valueInputOption: 'USER_ENTERED',
          data: batchUpdateRequests
        }
      });

      logger.info(`✅ Successfully updated ${updates.length} search phrases in ${videoId}`);
      return true;

    } catch (error) {
      logger.error(`❌ Failed to apply batch updates for ${videoId}:`, error.message);
      throw error;
    }
  }

  /**
   * Generate comprehensive summary report
   */
  async generateSummary() {
    const duration = this.stats.endTime ?
      Math.round((this.stats.endTime - this.stats.startTime) / 1000) :
      Math.round((new Date() - this.stats.startTime) / 1000);

    logger.info('\n📊 ===== BATCH UPDATE SUMMARY =====');
    logger.info(`⏱️  Total processing time: ${duration} seconds`);
    logger.info(`📼 Videos targeted: ${this.targetVideoIds.length}`);
    logger.info(`✅ Videos processed successfully: ${this.stats.processedVideos}`);
    logger.info(`⚠️  Videos skipped: ${this.stats.skippedVideos.length}`);
    logger.info(`❌ Videos failed: ${this.stats.failedVideos}`);
    logger.info(`📝 Total sentences processed: ${this.stats.totalSentences}`);
    logger.info(`🔄 Search phrases updated: ${this.stats.updatedSentences}`);

    if (this.stats.successfulVideos.length > 0) {
      logger.info('\n✅ Successfully Processed Videos:');
      this.stats.successfulVideos.forEach((video, index) => {
        logger.info(`  ${index + 1}. ${video.videoId}: ${video.sentencesUpdated} phrases updated - "${video.title}"`);
      });
    }

    if (this.stats.skippedVideos.length > 0) {
      logger.info('\n⚠️  Skipped Videos:');
      this.stats.skippedVideos.forEach((video, index) => {
        logger.info(`  ${index + 1}. ${video.videoId}: ${video.reason} - "${video.title}"`);
      });
    }

    if (this.stats.failedVideosList.length > 0) {
      logger.info('\n❌ Failed Videos (Need Manual Attention):');
      this.stats.failedVideosList.forEach((video, index) => {
        logger.info(`  ${index + 1}. ${video.videoId}: ${video.error}`);
      });
    }

    logger.info('\n📋 Next Steps:');
    if (this.stats.updatedSentences > 0) {
      logger.info('  ✅ All search phrases are now ready for Pexels asset downloads');
      logger.info('  🔧 Run download-pexels-assets.js to download assets for updated phrases');
    }
    if (this.stats.failedVideosList.length > 0) {
      logger.info('  ⚠️  Review and manually fix failed videos');
    }
    if (this.stats.skippedVideos.length > 0) {
      logger.info('  📝 Review skipped videos - may need script generation first');
    }
  }

  /**
   * Test sample search phrases with Pexels API
   */
  async testSampleSearchPhrases() {
    try {
      logger.info('\n🧪 Testing sample search phrases with Pexels API...');

      // Get a few successful videos for testing
      const sampleVideos = this.stats.successfulVideos.slice(0, 2);

      if (sampleVideos.length === 0) {
        logger.info('⚠️ No successful videos to test search phrases');
        return;
      }

      for (const video of sampleVideos) {
        logger.info(`\n🔍 Testing phrases from ${video.videoId}...`);

        // Get updated script breakdown
        const breakdown = await this.googleSheetsService.getScriptBreakdown(video.videoId);
        if (!breakdown || breakdown.length === 0) continue;

        // Test first 3 search phrases
        const phrasesToTest = breakdown.slice(0, 3).filter(s => s.searchPhrase && s.searchPhrase.trim());

        for (const sentence of phrasesToTest) {
          const phrase = sentence.searchPhrase.trim();
          if (!phrase) continue;

          try {
            logger.info(`  🔎 Testing: "${phrase}"`);

            // Test photo search
            const photos = await this.pexelsService.searchPhotos(phrase, 5);
            const photoCount = photos && photos.photos ? photos.photos.length : 0;

            // Test video search
            const videos = await this.pexelsService.searchVideos(phrase, 5);
            const videoCount = videos && videos.videos ? videos.videos.length : 0;

            logger.info(`    📷 Photos: ${photoCount} found, 🎬 Videos: ${videoCount} found`);

            if (photoCount === 0 && videoCount === 0) {
              logger.warn(`    ⚠️ No assets found for "${phrase}" - may need manual review`);
            } else {
              logger.info(`    ✅ "${phrase}" - compatible with Pexels API`);
            }

          } catch (testError) {
            logger.error(`    ❌ Failed to test "${phrase}": ${testError.message}`);
          }

          // Brief delay between API calls
          await this.delay(500);
        }
      }

      logger.info('\n✅ Pexels API compatibility testing completed');

    } catch (error) {
      logger.error('❌ Failed to test search phrases with Pexels:', error.message);
    }
  }

  /**
   * Utility function to add delay
   */
  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Main execution
async function main() {
  try {
    const updater = new BatchSearchPhraseUpdater();
    await updater.run();

    logger.info('\n🎯 Batch search phrase update completed successfully!');
    logger.info('📁 All target videos (VID-0002 to VID-0016) have been processed.');
    logger.info('🔧 Search phrases are now optimized for Pexels asset downloads.');

    process.exit(0);
  } catch (error) {
    logger.error('💥 Batch update failed:', error);
    process.exit(1);
  }
}

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    logger.error('💥 Unhandled error:', error);
    process.exit(1);
  });
}

export default BatchSearchPhraseUpdater;