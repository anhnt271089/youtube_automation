#!/usr/bin/env node

/**
 * Update search phrases in VID-0001 using enhanced algorithm
 * Reads existing script text and image prompts to generate better search phrases
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import configuration and services
import { config } from '../config/config.js';
import GoogleSheetsService from '../src/services/googleSheetsService.js';

const logger = {
  info: (...args) => console.log('📋', ...args),
  error: (...args) => console.error('❌', ...args),
  warn: (...args) => console.warn('⚠️', ...args)
};

async function updateEnhancedSearchPhrases() {
  try {
    console.log('🚀 Starting enhanced search phrase update for VID-0001...\n');

    const sheetsService = new GoogleSheetsService();
    const videoId = 'VID-0001';

    // Get current script breakdown data
    console.log('📋 Reading current Script Breakdown data...');
    const breakdownData = await sheetsService.getScriptBreakdown(videoId);

    if (!breakdownData || breakdownData.length === 0) {
      console.error('❌ No script breakdown data found for VID-0001');
      return;
    }

    console.log(`✅ Found ${breakdownData.length} sentences to process\n`);

    // Process each sentence and generate enhanced search phrases
    const updates = [];
    console.log('🔄 Generating enhanced search phrases...\n');

    for (let i = 0; i < breakdownData.length; i++) {
      const sentence = breakdownData[i];
      const scriptText = sentence.scriptText || '';
      const imagePrompt = sentence.imagePrompt || '';
      const currentSearchPhrase = sentence.searchPhrase || '';

      // Generate enhanced search phrase
      const enhancedSearchPhrase = sheetsService.generateEnhancedSearchPhrase(scriptText, imagePrompt);

      console.log(`Sentence ${i + 1}:`);
      console.log(`  Script: "${scriptText.substring(0, 60)}${scriptText.length > 60 ? '...' : ''}"`);
      console.log(`  Current: "${currentSearchPhrase}"`);
      console.log(`  Enhanced: "${enhancedSearchPhrase}"`);
      console.log('');

      updates.push({
        row: i + 2, // +2 because row 1 is header and array is 0-indexed
        searchPhrase: enhancedSearchPhrase
      });
    }

    // Get video row to find workbook ID
    const videoRow = await sheetsService.findVideoRow(videoId);
    if (!videoRow || !videoRow.data[sheetsService.masterColumns.detailWorkbookUrl]) {
      throw new Error(`Detail workbook not found for video: ${videoId}`);
    }

    const workbookUrl = videoRow.data[sheetsService.masterColumns.detailWorkbookUrl];
    const workbookId = workbookUrl.split('/d/')[1].split('/')[0];

    // Update search phrases in batches
    console.log('💾 Updating search phrases in Google Sheets...');

    const batchUpdates = updates.map(update => ({
      range: `Script Breakdown!D${update.row}`, // Column D is searchPhrase
      values: [[update.searchPhrase]]
    }));

    await sheetsService.sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: workbookId,
      resource: {
        valueInputOption: 'USER_ENTERED',
        data: batchUpdates
      }
    });

    console.log(`\n✅ Successfully updated ${updates.length} search phrases!`);
    console.log(`📊 VID-0001 Script Breakdown now has enhanced search phrases for Pexels integration`);

    // Show summary of changes
    const uniquePhrases = [...new Set(updates.map(u => u.searchPhrase))];
    console.log(`\n📈 Generated ${uniquePhrases.length} unique search phrases:`);
    uniquePhrases.slice(0, 10).forEach(phrase => {
      console.log(`   • "${phrase}"`);
    });
    if (uniquePhrases.length > 10) {
      console.log(`   ... and ${uniquePhrases.length - 10} more`);
    }

  } catch (error) {
    console.error('\n❌ Error updating search phrases:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Run the update
updateEnhancedSearchPhrases();