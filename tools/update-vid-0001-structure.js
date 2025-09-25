#!/usr/bin/env node
/**
 * Update VID-0001 Script Breakdown sheet to match new 8-column structure
 * with "Search phrase" column between Image Prompt and Image URL
 */

import GoogleSheetsService from '../src/services/googleSheetsService.js';
import logger from '../src/utils/logger.js';

const VIDEO_ID = 'VID-0001';

class Vid0001StructureUpdater {
  constructor() {
    this.sheetsService = new GoogleSheetsService();
  }

  /**
   * Main orchestration method
   */
  async updateStructure() {
    try {
      logger.info(`🔄 Starting VID-0001 structure update to new 8-column layout`);

      // Step 1: Read current sheet structure and data
      const currentData = await this.readCurrentSheetData();
      logger.info(`📊 Found ${currentData.rows.length} data rows with ${currentData.columns} columns`);

      // Step 2: Analyze current structure vs expected
      const needsUpdate = this.analyzeStructureDifference(currentData);

      if (!needsUpdate) {
        logger.info(`✅ VID-0001 already has the correct 8-column structure!`);
        return;
      }

      // Step 3: Update headers to new 8-column structure
      await this.updateHeaders();

      // Step 4: Migrate existing data to new structure
      const migratedData = await this.migrateExistingData(currentData);

      // Step 5: Write updated data back to sheet
      await this.writeUpdatedData(migratedData);

      // Step 6: Validate the migration
      await this.validateMigration();

      logger.info(`🎉 Successfully updated VID-0001 to new 8-column structure!`);

    } catch (error) {
      logger.error(`❌ Failed to update VID-0001 structure: ${error.message}`);
      throw error;
    }
  }

  /**
   * Read current sheet structure and data
   */
  async readCurrentSheetData() {
    const videoRow = await this.sheetsService.findVideoRow(VIDEO_ID);
    if (!videoRow || !videoRow.data[this.sheetsService.masterColumns.detailWorkbookUrl]) {
      throw new Error(`Detail workbook not found for ${VIDEO_ID}`);
    }

    const workbookUrl = videoRow.data[this.sheetsService.masterColumns.detailWorkbookUrl];
    const workbookId = workbookUrl.split('/d/')[1].split('/')[0];

    logger.info(`📋 Reading current data from workbook: ${workbookId}`);

    // Read all current data (up to column H to be safe)
    const response = await this.sheetsService.sheets.spreadsheets.values.get({
      spreadsheetId: workbookId,
      range: `${this.sheetsService.detailSheets.scriptBreakdown}!A:H`
    });

    const values = response.data.values || [];
    const headers = values[0] || [];
    const dataRows = values.slice(1);

    return {
      workbookId,
      headers,
      rows: dataRows,
      columns: headers.length,
      totalRows: values.length
    };
  }

  /**
   * Analyze if structure needs updating
   */
  analyzeStructureDifference(currentData) {
    const expectedHeaders = [
      'Sentence Number',
      'Script Text',
      'Image Prompt',
      'Search phrase',  // This is the new column
      'Image URL',
      'Editor Keywords',
      'Status',
      'Word Count'
    ];

    logger.info(`📐 Current headers: [${currentData.headers.join(', ')}]`);
    logger.info(`📐 Expected headers: [${expectedHeaders.join(', ')}]`);

    // Check if we already have 8 columns with correct structure
    if (currentData.columns === 8 && currentData.headers[3] === 'Search phrase') {
      return false; // No update needed
    }

    // Check if we have old 7-column structure without search phrase
    if (currentData.columns <= 7 || currentData.headers[3] !== 'Search phrase') {
      logger.info(`🔧 Structure update needed: ${currentData.columns} columns → 8 columns`);
      return true;
    }

    return false;
  }

  /**
   * Update headers to new 8-column structure
   */
  async updateHeaders() {
    const videoRow = await this.sheetsService.findVideoRow(VIDEO_ID);
    const workbookUrl = videoRow.data[this.sheetsService.masterColumns.detailWorkbookUrl];
    const workbookId = workbookUrl.split('/d/')[1].split('/')[0];

    const newHeaders = [
      'Sentence Number',
      'Script Text',
      'Image Prompt',
      'Search phrase',  // NEW COLUMN
      'Image URL',
      'Editor Keywords',
      'Status',
      'Word Count'
    ];

    logger.info(`📝 Updating headers to: [${newHeaders.join(', ')}]`);

    await this.sheetsService.sheets.spreadsheets.values.update({
      spreadsheetId: workbookId,
      range: `${this.sheetsService.detailSheets.scriptBreakdown}!A1:H1`,
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [newHeaders]
      }
    });

    logger.info(`✅ Headers updated successfully`);
  }

  /**
   * Migrate existing data to new 8-column structure
   */
  async migrateExistingData(currentData) {
    logger.info(`🔄 Migrating ${currentData.rows.length} rows to new structure...`);

    const migratedRows = [];

    for (let i = 0; i < currentData.rows.length; i++) {
      const oldRow = currentData.rows[i] || [];
      const newRow = new Array(8).fill(''); // Initialize 8 columns

      // Map old columns to new positions
      newRow[0] = oldRow[0] || (i + 1); // Sentence Number
      newRow[1] = oldRow[1] || ''; // Script Text
      newRow[2] = oldRow[2] || ''; // Image Prompt

      // Generate search phrase from image prompt (NEW COLUMN)
      const imagePrompt = oldRow[2] || '';
      newRow[3] = this.generateSearchPhrase(imagePrompt);

      // Shift remaining columns
      newRow[4] = oldRow[3] || ''; // Image URL (was column 3, now 4)
      newRow[5] = oldRow[4] || ''; // Editor Keywords (was column 4, now 5)
      newRow[6] = oldRow[5] || 'Pending'; // Status (was column 5, now 6)
      newRow[7] = oldRow[6] || `=LEN(TRIM(B${i + 2}))-LEN(SUBSTITUTE(TRIM(B${i + 2})," ",""))+1`; // Word Count (was column 6, now 7)

      migratedRows.push(newRow);

      if (i < 5) { // Show first few rows for verification
        logger.info(`📄 Row ${i + 1}: [${newRow.slice(0, 4).join(' | ')}...]`);
      }
    }

    logger.info(`✅ Migrated ${migratedRows.length} rows to new structure`);
    return migratedRows;
  }

  /**
   * Generate search phrase from image prompt
   */
  generateSearchPhrase(imagePrompt) {
    if (!imagePrompt || typeof imagePrompt !== 'string') {
      return '';
    }

    // Use same logic as in createScriptBreakdown
    return imagePrompt
      .toLowerCase()
      .replace(/\b(a |an |the |with |of |in |on |at |by |for |from |up |about |into |through |during|against|before|after|above|below|under|over)\b/g, ' ')
      .replace(/\b(detailed|realistic|high-quality|professional|cinematic|dramatic|beautiful|stunning|amazing|incredible|perfect)\b/g, '')
      .replace(/\b(image|photo|picture|shot|scene|view|illustration|artwork)\b/g, '')
      .replace(/[^\w\s]/g, ' ') // Remove punctuation
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .trim()
      .split(' ')
      .filter(word => word.length > 2) // Remove short words
      .slice(0, 3) // Take first 3 main keywords
      .join(' ');
  }

  /**
   * Write updated data back to sheet
   */
  async writeUpdatedData(migratedData) {
    const videoRow = await this.sheetsService.findVideoRow(VIDEO_ID);
    const workbookUrl = videoRow.data[this.sheetsService.masterColumns.detailWorkbookUrl];
    const workbookId = workbookUrl.split('/d/')[1].split('/')[0];

    if (migratedData.length === 0) {
      logger.info(`⚠️  No data to write back`);
      return;
    }

    logger.info(`💾 Writing ${migratedData.length} rows to sheet...`);

    await this.sheetsService.sheets.spreadsheets.values.update({
      spreadsheetId: workbookId,
      range: `${this.sheetsService.detailSheets.scriptBreakdown}!A2:H${migratedData.length + 1}`,
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: migratedData
      }
    });

    logger.info(`✅ Successfully wrote ${migratedData.length} rows to sheet`);
  }

  /**
   * Validate the migration was successful
   */
  async validateMigration() {
    logger.info(`🔍 Validating migration...`);

    const validationData = await this.readCurrentSheetData();

    const expectedColumns = 8;
    const expectedSearchPhraseColumn = 'Search phrase';

    if (validationData.columns !== expectedColumns) {
      throw new Error(`Validation failed: Expected ${expectedColumns} columns, got ${validationData.columns}`);
    }

    if (validationData.headers[3] !== expectedSearchPhraseColumn) {
      throw new Error(`Validation failed: Expected "Search phrase" in column D, got "${validationData.headers[3]}"`);
    }

    // Check that we have search phrases populated
    let searchPhrasesPopulated = 0;
    for (const row of validationData.rows) {
      if (row[3] && row[3].trim()) {
        searchPhrasesPopulated++;
      }
    }

    logger.info(`✅ Validation successful:`);
    logger.info(`   - ${validationData.columns} columns (✓)`);
    logger.info(`   - ${validationData.rows.length} data rows`);
    logger.info(`   - ${searchPhrasesPopulated} search phrases populated`);
    logger.info(`   - Headers: [${validationData.headers.join(', ')}]`);
  }
}

// Main execution
async function main() {
  try {
    const updater = new Vid0001StructureUpdater();
    await updater.updateStructure();
    process.exit(0);
  } catch (error) {
    logger.error(`💥 Script failed: ${error.message}`);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default Vid0001StructureUpdater;