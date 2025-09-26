#!/usr/bin/env node

/**
 * Generate and update search phrases for VID-0001 Script Breakdown
 * This tool examines existing Script Breakdown data and generates appropriate
 * search phrases for Pexels asset download based on sentence content and context.
 */

import { config } from '../config/config.js';
import logger from '../src/utils/logger.js';
import GoogleSheetsService from '../src/services/googleSheetsService.js';
import PexelsService from '../src/services/pexelsService.js';

class SearchPhraseGenerator {
  constructor() {
    this.sheetsService = new GoogleSheetsService();
    this.pexelsService = new PexelsService();
    this.videoId = 'VID-0001';
  }

  /**
   * Analyze sentence content and generate appropriate search phrases
   * Focus on visual, concrete concepts suitable for Pexels searches
   */
  generateSearchPhrase(scriptText, imagePrompt = '') {
    // Planning and goal achievement focused keywords for VID-0001
    const planningKeywords = [
      'planning', 'notebook', 'strategy', 'goals', 'success', 'achievement', 'focus',
      'business plan', 'writing notes', 'calendar', 'checklist', 'progress',
      'productivity', 'organization', 'time management', 'motivation', 'vision',
      'target', 'deadline', 'execution', 'results', 'growth', 'improvement',
      'brainstorming', 'ideas', 'thinking', 'concentration', 'determination'
    ];

    const businessKeywords = [
      'business person', 'office', 'computer', 'desk', 'meeting', 'presentation',
      'teamwork', 'professional', 'workspace', 'laptop', 'documents', 'analysis',
      'startup', 'entrepreneur', 'leadership', 'strategy meeting', 'whiteboard',
      'charts', 'data', 'dashboard', 'project management'
    ];

    const actionKeywords = [
      'writing', 'working', 'thinking', 'planning', 'studying', 'learning',
      'analyzing', 'reviewing', 'organizing', 'preparing', 'executing',
      'celebrating', 'achieving', 'completing', 'finishing', 'succeeding'
    ];

    const emotionKeywords = [
      'success celebration', 'happy person', 'confident', 'determined',
      'motivated', 'focused', 'satisfied', 'accomplished', 'proud',
      'energetic', 'positive', 'inspiring', 'breakthrough'
    ];

    // Clean and analyze text
    const allText = `${scriptText} ${imagePrompt}`.toLowerCase();
    const words = allText.replace(/[^\w\s]/g, ' ').split(/\s+/).filter(w => w.length > 2);

    // Find relevant keywords that match the content
    const matchingKeywords = [];

    // Check for planning-related concepts
    if (this.containsAnyWord(allText, ['plan', 'goal', 'strategy', 'achieve', 'success', 'target'])) {
      matchingKeywords.push(...planningKeywords.slice(0, 2));
    }

    // Check for business/work concepts
    if (this.containsAnyWord(allText, ['business', 'work', 'professional', 'office', 'team', 'meeting'])) {
      matchingKeywords.push(...businessKeywords.slice(0, 2));
    }

    // Check for action concepts
    if (this.containsAnyWord(allText, ['write', 'think', 'study', 'learn', 'analyze', 'execute'])) {
      matchingKeywords.push(...actionKeywords.slice(0, 2));
    }

    // Check for emotional/success concepts
    if (this.containsAnyWord(allText, ['success', 'happy', 'confident', 'motivated', 'achieve', 'win'])) {
      matchingKeywords.push(...emotionKeywords.slice(0, 2));
    }

    // If no specific matches, use general planning-related terms
    if (matchingKeywords.length === 0) {
      // Analyze specific words in the sentence for context
      if (this.containsAnyWord(allText, ['mistake', 'wrong', 'fail', 'error', 'problem'])) {
        return 'business problem solving';
      } else if (this.containsAnyWord(allText, ['time', 'schedule', 'when', 'timing'])) {
        return 'time management planning';
      } else if (this.containsAnyWord(allText, ['step', 'process', 'method', 'way', 'approach'])) {
        return 'business strategy process';
      } else if (this.containsAnyWord(allText, ['people', 'person', 'team', 'group'])) {
        return 'business teamwork planning';
      } else {
        return 'business planning notebook';
      }
    }

    // Remove duplicates and take top 3 terms
    const uniqueKeywords = [...new Set(matchingKeywords)];
    return uniqueKeywords.slice(0, 3).join(' ').substring(0, 50); // Max 50 chars for Pexels
  }

  /**
   * Check if text contains any of the specified words
   */
  containsAnyWord(text, words) {
    return words.some(word => text.includes(word));
  }

  /**
   * Main execution method
   */
  async run() {
    try {
      logger.info('🚀 Starting search phrase generation for VID-0001');

      // Step 1: Get current Script Breakdown data
      logger.info('📊 Fetching current Script Breakdown data for VID-0001...');
      const scriptBreakdown = await this.sheetsService.getScriptBreakdown(this.videoId);

      if (!scriptBreakdown || scriptBreakdown.length === 0) {
        throw new Error(`No Script Breakdown data found for ${this.videoId}`);
      }

      logger.info(`✅ Found ${scriptBreakdown.length} sentences in Script Breakdown`);

      // Step 2: Analyze current data and identify missing search phrases
      let missingSearchPhrases = 0;
      const sentencesToUpdate = [];

      for (const sentence of scriptBreakdown) {
        if (!sentence.searchPhrase || sentence.searchPhrase.trim() === '') {
          missingSearchPhrases++;
          sentencesToUpdate.push(sentence);
        }
      }

      logger.info(`📝 Found ${missingSearchPhrases} sentences missing search phrases`);

      if (missingSearchPhrases === 0) {
        logger.info('✅ All sentences already have search phrases! No updates needed.');
        return;
      }

      // Step 3: Generate search phrases for sentences that need them
      logger.info('🎯 Generating search phrases for missing entries...');

      const updates = [];
      for (const sentence of sentencesToUpdate) {
        const searchPhrase = this.generateSearchPhrase(
          sentence.scriptText || '',
          sentence.imagePrompt || ''
        );

        updates.push({
          sentenceNumber: sentence.sentenceNumber,
          searchPhrase: searchPhrase
        });

        logger.info(`  • Sentence ${sentence.sentenceNumber}: "${searchPhrase}"`);
      }

      // Step 4: Update Google Sheets with generated search phrases
      logger.info('💾 Updating Google Sheets with generated search phrases...');

      const videoRow = await this.sheetsService.findVideoRow(this.videoId);
      if (!videoRow || !videoRow.data[this.sheetsService.masterColumns.detailWorkbookUrl]) {
        throw new Error(`Detail workbook not found for ${this.videoId}`);
      }

      const workbookUrl = videoRow.data[this.sheetsService.masterColumns.detailWorkbookUrl];
      const workbookId = workbookUrl.split('/d/')[1].split('/')[0];

      // Batch update all search phrases
      const batchUpdates = updates.map(update => ({
        range: `${this.sheetsService.detailSheets.scriptBreakdown}!D${parseInt(update.sentenceNumber) + 1}`,
        values: [[update.searchPhrase]]
      }));

      await this.sheetsService.sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: workbookId,
        resource: {
          valueInputOption: 'USER_ENTERED',
          data: batchUpdates
        }
      });

      logger.info(`✅ Successfully updated ${updates.length} search phrases in Google Sheets`);

      // Step 5: Verify the updates
      logger.info('🔍 Verifying search phrase updates...');
      const updatedBreakdown = await this.sheetsService.getScriptBreakdown(this.videoId);
      let verifiedCount = 0;

      for (const sentence of updatedBreakdown) {
        if (sentence.searchPhrase && sentence.searchPhrase.trim() !== '') {
          verifiedCount++;
        }
      }

      logger.info(`✅ Verification complete: ${verifiedCount}/${updatedBreakdown.length} sentences have search phrases`);

      // Step 6: Test search phrases with Pexels API
      logger.info('🧪 Testing a few search phrases with Pexels API...');

      const testPhrases = updates.slice(0, 3); // Test first 3 phrases
      for (const test of testPhrases) {
        try {
          const photos = await this.pexelsService.searchPhotos(test.searchPhrase, 3);
          logger.info(`  • "${test.searchPhrase}": ${photos.length} results found`);
        } catch (error) {
          logger.warn(`  • "${test.searchPhrase}": Error - ${error.message}`);
        }

        // Small delay to be respectful to Pexels API
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Final summary
      logger.info('\n🎉 Search phrase generation completed successfully!');
      logger.info(`📊 Summary:`);
      logger.info(`   • Video ID: ${this.videoId}`);
      logger.info(`   • Total sentences: ${scriptBreakdown.length}`);
      logger.info(`   • Search phrases generated: ${updates.length}`);
      logger.info(`   • Total sentences with search phrases: ${verifiedCount}`);
      logger.info(`   • Ready for Pexels asset download: ✅`);

      // Get video details for reference
      const videoDetails = await this.sheetsService.getVideoDetails(this.videoId);
      if (videoDetails) {
        logger.info(`   • Video title: "${videoDetails.title}"`);
        logger.info(`   • Detail workbook: ${videoDetails.detailWorkbookUrl}`);
      }

    } catch (error) {
      logger.error('❌ Search phrase generation failed:', error.message);
      throw error;
    }
  }
}

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const generator = new SearchPhraseGenerator();

  generator.run()
    .then(() => {
      logger.info('✅ Search phrase generation tool completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('❌ Search phrase generation tool failed:', error.message);
      process.exit(1);
    });
}

export default SearchPhraseGenerator;