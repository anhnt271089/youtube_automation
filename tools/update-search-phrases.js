#!/usr/bin/env node

/**
 * Update Search Phrases for VID-0001
 *
 * This script:
 * 1. Reads the script breakdown for VID-0001 from Google Sheets
 * 2. Uses the existing generateEnhancedSearchPhrase function to create search phrases
 * 3. Updates the Google Sheets with the generated search phrases
 * 4. Tests a few samples with the Pexels service
 */

import GoogleSheetsService from '../src/services/googleSheetsService.js';
import PexelsService from '../src/services/pexelsService.js';
import logger from '../src/utils/logger.js';

class SearchPhraseUpdater {
  constructor() {
    this.googleSheetsService = new GoogleSheetsService();
    this.pexelsService = new PexelsService();
    this.videoId = 'VID-0001';
  }

  async updateSearchPhrases() {
    try {
      logger.info(`🚀 Starting search phrase update for ${this.videoId}`);

      // Step 1: Get the script breakdown
      logger.info('📖 Reading script breakdown from Google Sheets...');
      const scriptBreakdown = await this.googleSheetsService.getScriptBreakdown(this.videoId);

      if (!scriptBreakdown || scriptBreakdown.length === 0) {
        throw new Error(`No script breakdown found for ${this.videoId}`);
      }

      logger.info(`Found ${scriptBreakdown.length} sentences in script breakdown`);

      // Step 2: Generate search phrases for each sentence
      logger.info('🔍 Generating search phrases for each sentence...');
      const updates = [];
      let generatedCount = 0;

      for (let i = 0; i < scriptBreakdown.length; i++) {
        const sentence = scriptBreakdown[i];
        const scriptText = sentence.scriptText || '';
        const imagePrompt = sentence.imagePrompt || '';

        // Skip if already has search phrase
        if (sentence.searchPhrase && sentence.searchPhrase.trim()) {
          logger.info(`Sentence ${i + 1}: Already has search phrase: "${sentence.searchPhrase}"`);
          continue;
        }

        // Generate enhanced search phrase using existing function
        const searchPhrase = this.googleSheetsService.generateEnhancedSearchPhrase(
          scriptText,
          imagePrompt
        );

        if (searchPhrase && searchPhrase !== 'business person') {
          logger.info(`Sentence ${i + 1}: Generated search phrase: "${searchPhrase}"`);
          generatedCount++;

          // Store update for batch processing
          updates.push({
            sentenceNumber: i + 1,
            searchPhrase: searchPhrase,
            scriptText: scriptText.substring(0, 50) + '...' // For logging
          });
        } else {
          logger.warn(`Sentence ${i + 1}: Could not generate meaningful search phrase, got: "${searchPhrase}"`);
        }
      }

      logger.info(`Generated ${generatedCount} search phrases out of ${scriptBreakdown.length} sentences`);

      // Step 3: Update Google Sheets with search phrases
      if (updates.length > 0) {
        logger.info('📝 Updating Google Sheets with generated search phrases...');
        await this.batchUpdateSearchPhrases(updates);
        logger.info(`✅ Successfully updated ${updates.length} search phrases in Google Sheets`);
      } else {
        logger.info('ℹ️ No search phrases to update');
      }

      // Step 4: Test a few samples with Pexels service
      if (updates.length > 0) {
        logger.info('🧪 Testing a few search phrases with Pexels service...');
        await this.testPexelsIntegration(updates.slice(0, 3));
      }

      logger.info('🎉 Search phrase update completed successfully!');

      return {
        totalSentences: scriptBreakdown.length,
        generated: generatedCount,
        updated: updates.length
      };

    } catch (error) {
      logger.error('❌ Error updating search phrases:', error);
      throw error;
    }
  }

  /**
   * Batch update search phrases in Google Sheets
   */
  async batchUpdateSearchPhrases(updates) {
    try {
      // Get video row and workbook details
      const videoRow = await this.googleSheetsService.findVideoRow(this.videoId);
      if (!videoRow || !videoRow.data[this.googleSheetsService.masterColumns.detailWorkbookUrl]) {
        throw new Error(`Detail workbook not found for ${this.videoId}`);
      }

      const workbookUrl = videoRow.data[this.googleSheetsService.masterColumns.detailWorkbookUrl];
      const workbookId = this.extractWorkbookId(workbookUrl);

      const batchUpdates = [];
      const searchPhraseColumn = this.googleSheetsService.columnIndexToLetter(
        this.googleSheetsService.scriptColumns.searchPhrase
      );

      // Create batch update requests
      for (const update of updates) {
        const rowIndex = update.sentenceNumber + 1; // +1 for header row
        const range = `Script Breakdown!${searchPhraseColumn}${rowIndex}`;

        batchUpdates.push({
          range: range,
          values: [[update.searchPhrase]]
        });
      }

      // Execute batch update
      await this.googleSheetsService.sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: workbookId,
        resource: {
          valueInputOption: 'USER_ENTERED',
          data: batchUpdates
        }
      });

      logger.info(`Updated ${batchUpdates.length} search phrases in Google Sheets`);

    } catch (error) {
      logger.error('Error batch updating search phrases:', error);
      throw error;
    }
  }

  /**
   * Test Pexels integration with sample search phrases
   */
  async testPexelsIntegration(sampleUpdates) {
    try {
      for (let i = 0; i < sampleUpdates.length; i++) {
        const update = sampleUpdates[i];
        logger.info(`Testing sentence ${update.sentenceNumber}: "${update.searchPhrase}"`);

        try {
          // Test photo search
          const photos = await this.pexelsService.searchPhotos(update.searchPhrase, 3);
          if (photos && photos.length > 0) {
            logger.info(`  ✅ Found ${photos.length} photos for "${update.searchPhrase}"`);
            logger.info(`  📸 Sample photo: ${photos[0].url}`);
          } else {
            logger.warn(`  ⚠️ No photos found for "${update.searchPhrase}"`);
          }

          // Test video search
          const videos = await this.pexelsService.searchVideos(update.searchPhrase, 2);
          if (videos && videos.length > 0) {
            logger.info(`  ✅ Found ${videos.length} videos for "${update.searchPhrase}"`);
            logger.info(`  🎥 Sample video: ${videos[0].url}`);
          } else {
            logger.warn(`  ⚠️ No videos found for "${update.searchPhrase}"`);
          }

        } catch (testError) {
          logger.error(`  ❌ Error testing "${update.searchPhrase}":`, testError.message);
        }

        // Small delay between requests to avoid rate limiting
        if (i < sampleUpdates.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

    } catch (error) {
      logger.error('Error testing Pexels integration:', error);
      throw error;
    }
  }

  /**
   * Extract workbook ID from Google Sheets URL
   */
  extractWorkbookId(url) {
    const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (!match) {
      throw new Error(`Invalid Google Sheets URL: ${url}`);
    }
    return match[1];
  }
}

// Main execution
async function main() {
  try {
    const updater = new SearchPhraseUpdater();
    const result = await updater.updateSearchPhrases();

    logger.info('\n📊 Summary:');
    logger.info(`Total sentences: ${result.totalSentences}`);
    logger.info(`Search phrases generated: ${result.generated}`);
    logger.info(`Google Sheets updated: ${result.updated}`);

    process.exit(0);
  } catch (error) {
    logger.error('Script failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default SearchPhraseUpdater;