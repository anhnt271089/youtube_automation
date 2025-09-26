#!/usr/bin/env node

/**
 * Update Search Phrases AND Editor Keywords for VID-0001
 *
 * This script:
 * 1. Reads the script breakdown for VID-0001 from Google Sheets
 * 2. Uses AI services to generate both search phrases and editor keywords for all sentences
 * 3. Updates the Google Sheets with both generated search phrases and editor keywords
 * 4. Provides verification that updates were successfully saved
 */

import GoogleSheetsService from '../src/services/googleSheetsService.js';
import AIService from '../src/services/aiService.js';
import PexelsService from '../src/services/pexelsService.js';
import logger from '../src/utils/logger.js';

class SearchPhraseAndEditorKeywordUpdater {
  constructor() {
    this.googleSheetsService = new GoogleSheetsService();
    this.aiService = new AIService();
    this.pexelsService = new PexelsService();
    this.videoId = 'VID-0001';
  }

  async updateAllContent() {
    try {
      logger.info(`🚀 Starting comprehensive update for ${this.videoId}`);

      // Step 1: Get the script breakdown
      logger.info('📖 Reading script breakdown from Google Sheets...');
      const scriptBreakdown = await this.googleSheetsService.getScriptBreakdown(this.videoId);

      if (!scriptBreakdown || scriptBreakdown.length === 0) {
        throw new Error(`No script breakdown found for ${this.videoId}`);
      }

      logger.info(`Found ${scriptBreakdown.length} sentences in script breakdown`);

      // Step 2: Generate search phrases for ALL sentences (refresh all)
      logger.info('🔍 Generating search phrases for ALL sentences...');
      const searchPhraseUpdates = [];

      for (let i = 0; i < scriptBreakdown.length; i++) {
        const sentence = scriptBreakdown[i];
        const scriptText = sentence.scriptText || '';
        const imagePrompt = sentence.imagePrompt || '';

        // Generate enhanced search phrase using existing function (force regeneration)
        const searchPhrase = this.googleSheetsService.generateEnhancedSearchPhrase(
          scriptText,
          imagePrompt
        );

        if (searchPhrase && searchPhrase !== 'business person') {
          logger.info(`Sentence ${i + 1}: Generated search phrase: "${searchPhrase}"`);
          searchPhraseUpdates.push({
            sentenceNumber: i + 1,
            searchPhrase: searchPhrase,
            scriptText: scriptText.substring(0, 50) + '...' // For logging
          });
        } else {
          logger.warn(`Sentence ${i + 1}: Could not generate meaningful search phrase, got: "${searchPhrase}"`);
          // Use fallback
          const fallbackPhrase = this.generateFallbackSearchPhrase(scriptText);
          searchPhraseUpdates.push({
            sentenceNumber: i + 1,
            searchPhrase: fallbackPhrase,
            scriptText: scriptText.substring(0, 50) + '...'
          });
          logger.info(`Sentence ${i + 1}: Using fallback search phrase: "${fallbackPhrase}"`);
        }
      }

      logger.info(`Generated ${searchPhraseUpdates.length} search phrases out of ${scriptBreakdown.length} sentences`);

      // Step 3: Generate editor keywords for ALL sentences using AI
      logger.info('🎨 Generating editor keywords for ALL sentences using AI...');
      const scriptTexts = scriptBreakdown.map(s => s.scriptText || '');

      let editorKeywords = [];
      try {
        editorKeywords = await this.aiService.generateEditorKeywords(scriptTexts);
        logger.info(`Generated ${editorKeywords.length} sets of editor keywords using AI`);
      } catch (error) {
        logger.error('AI editor keyword generation failed, using fallback:', error.message);
        // Fallback to manual generation
        editorKeywords = scriptTexts.map(text => this.generateFallbackEditorKeywords(text));
        logger.info(`Generated ${editorKeywords.length} sets of fallback editor keywords`);
      }

      // Step 4: Prepare combined updates for Google Sheets
      const combinedUpdates = [];
      for (let i = 0; i < scriptBreakdown.length; i++) {
        combinedUpdates.push({
          sentenceNumber: i + 1,
          searchPhrase: searchPhraseUpdates[i]?.searchPhrase || 'business person',
          editorKeywords: editorKeywords[i] || 'business, professional, corporate',
          scriptText: scriptBreakdown[i].scriptText?.substring(0, 50) + '...'
        });
      }

      // Step 5: Update Google Sheets with both search phrases and editor keywords
      logger.info('📝 Updating Google Sheets with search phrases and editor keywords...');
      await this.batchUpdateBothColumns(combinedUpdates);
      logger.info(`✅ Successfully updated ${combinedUpdates.length} rows with both search phrases and editor keywords`);

      // Step 6: Verify the updates were saved
      logger.info('🔍 Verifying updates were saved to Google Sheets...');
      await this.verifyUpdates();

      // Step 7: Test a few search phrases with Pexels service
      logger.info('🧪 Testing sample search phrases with Pexels service...');
      await this.testPexelsIntegration(searchPhraseUpdates.slice(0, 3));

      logger.info('🎉 Complete update finished successfully!');

      return {
        totalSentences: scriptBreakdown.length,
        searchPhrasesUpdated: searchPhraseUpdates.length,
        editorKeywordsGenerated: editorKeywords.length,
        combinedUpdates: combinedUpdates.length
      };

    } catch (error) {
      logger.error('❌ Error in comprehensive update:', error);
      throw error;
    }
  }

  /**
   * Generate fallback search phrase when main function fails
   */
  generateFallbackSearchPhrase(scriptText) {
    const words = scriptText.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3);

    const visualWords = words.filter(word =>
      ['business', 'person', 'people', 'work', 'office', 'computer', 'team', 'meeting',
       'success', 'growth', 'money', 'finance', 'technology', 'data', 'chart'].includes(word)
    );

    if (visualWords.length >= 2) {
      return visualWords.slice(0, 2).join(' ');
    } else if (visualWords.length === 1) {
      return `${visualWords[0]} person`;
    }

    return 'business person';
  }

  /**
   * Generate fallback editor keywords when AI fails
   */
  generateFallbackEditorKeywords(scriptText) {
    const words = scriptText.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2)
      .filter(word => !['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'man', 'new', 'now', 'old', 'see', 'two', 'who', 'boy', 'did', 'its', 'let', 'put', 'say', 'she', 'too', 'use'].includes(word));

    const keyWords = words.slice(0, 4);
    return keyWords.length > 0 ? keyWords.join(', ') : 'business, professional, corporate';
  }

  /**
   * Batch update both search phrases and editor keywords in Google Sheets
   */
  async batchUpdateBothColumns(updates) {
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
      const editorKeywordsColumn = this.googleSheetsService.columnIndexToLetter(
        this.googleSheetsService.scriptColumns.editorKeywords
      );

      // Create batch update requests for both columns
      for (const update of updates) {
        const rowIndex = update.sentenceNumber + 1; // +1 for header row

        // Search phrase update
        batchUpdates.push({
          range: `Script Breakdown!${searchPhraseColumn}${rowIndex}`,
          values: [[update.searchPhrase]]
        });

        // Editor keywords update
        batchUpdates.push({
          range: `Script Breakdown!${editorKeywordsColumn}${rowIndex}`,
          values: [[update.editorKeywords]]
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

      logger.info(`Updated ${updates.length} rows with both search phrases and editor keywords in Google Sheets`);

    } catch (error) {
      logger.error('Error batch updating search phrases and editor keywords:', error);
      throw error;
    }
  }

  /**
   * Verify that updates were saved successfully
   */
  async verifyUpdates() {
    try {
      logger.info('📊 Reading back updated data to verify...');

      const scriptBreakdown = await this.googleSheetsService.getScriptBreakdown(this.videoId);

      let searchPhrasesCount = 0;
      let editorKeywordsCount = 0;
      let emptySearchPhrases = 0;
      let emptyEditorKeywords = 0;

      for (let i = 0; i < scriptBreakdown.length; i++) {
        const sentence = scriptBreakdown[i];
        const searchPhrase = sentence.searchPhrase?.trim();
        const editorKeywords = sentence.editorKeywords?.trim();

        if (searchPhrase && searchPhrase.length > 0) {
          searchPhrasesCount++;
        } else {
          emptySearchPhrases++;
          logger.warn(`Sentence ${i + 1}: Empty search phrase`);
        }

        if (editorKeywords && editorKeywords.length > 0) {
          editorKeywordsCount++;
        } else {
          emptyEditorKeywords++;
          logger.warn(`Sentence ${i + 1}: Empty editor keywords`);
        }

        // Sample a few for verification
        if (i < 3) {
          logger.info(`Sentence ${i + 1} verified:`);
          logger.info(`  Search Phrase: "${searchPhrase}"`);
          logger.info(`  Editor Keywords: "${editorKeywords}"`);
        }
      }

      logger.info('📈 Verification Summary:');
      logger.info(`Total sentences: ${scriptBreakdown.length}`);
      logger.info(`Search phrases populated: ${searchPhrasesCount}`);
      logger.info(`Editor keywords populated: ${editorKeywordsCount}`);
      logger.info(`Empty search phrases: ${emptySearchPhrases}`);
      logger.info(`Empty editor keywords: ${emptyEditorKeywords}`);

      if (emptySearchPhrases > 0 || emptyEditorKeywords > 0) {
        logger.warn('⚠️ Some entries are still empty - may need manual review');
      } else {
        logger.info('✅ All entries successfully populated!');
      }

    } catch (error) {
      logger.error('Error verifying updates:', error);
      throw error;
    }
  }

  /**
   * Test Pexels integration with sample search phrases
   */
  async testPexelsIntegration(sampleUpdates) {
    try {
      for (let i = 0; i < Math.min(sampleUpdates.length, 3); i++) {
        const update = sampleUpdates[i];
        logger.info(`Testing sentence ${update.sentenceNumber}: "${update.searchPhrase}"`);

        try {
          // Test photo search
          const photos = await this.pexelsService.searchPhotos(update.searchPhrase, 2);
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
    const updater = new SearchPhraseAndEditorKeywordUpdater();
    const result = await updater.updateAllContent();

    logger.info('\n📊 Final Summary:');
    logger.info(`Total sentences: ${result.totalSentences}`);
    logger.info(`Search phrases updated: ${result.searchPhrasesUpdated}`);
    logger.info(`Editor keywords generated: ${result.editorKeywordsGenerated}`);
    logger.info(`Combined updates applied: ${result.combinedUpdates}`);

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

export default SearchPhraseAndEditorKeywordUpdater;