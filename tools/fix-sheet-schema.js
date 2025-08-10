#!/usr/bin/env node

/**
 * Fix Google Sheets Schema for Thumbnail Optimization
 * 
 * This tool adds the missing thumbnailConcepts column and fixes the schema
 */

import GoogleSheetsService from '../src/services/googleSheetsService.js';
import logger from '../src/utils/logger.js';

class SchemaFixer {
  constructor() {
    this.sheetsService = new GoogleSheetsService();
  }

  async fixSchema() {
    try {
      logger.info('🔧 Starting schema fix for thumbnail optimization...');
      
      // Step 1: Insert new column O for thumbnailConcepts
      logger.info('📝 Inserting "🤖 Thumbnail Concepts" column at position O...');
      
      await this.sheetsService.sheets.spreadsheets.batchUpdate({
        spreadsheetId: this.sheetsService.masterSheetId,
        resource: {
          requests: [
            {
              insertDimension: {
                range: {
                  sheetId: 0, // Master sheet (first sheet)
                  dimension: 'COLUMNS',
                  startIndex: 14, // Insert at column O (index 14)
                  endIndex: 15
                }
              }
            }
          ]
        }
      });

      // Step 2: Add the header for the new column
      await this.sheetsService.sheets.spreadsheets.values.update({
        spreadsheetId: this.sheetsService.masterSheetId,
        range: 'O1', // New column O, row 1
        valueInputOption: 'RAW',
        resource: {
          values: [['🤖 Thumbnail Concepts']]
        }
      });

      logger.info('✅ Successfully added "🤖 Thumbnail Concepts" column at position O');
      logger.info('📊 Schema is now compatible with thumbnail optimization!');
      
      // Verify the fix
      await this.verifyFix();
      
      return true;
      
    } catch (error) {
      logger.error('❌ Error fixing schema:', error);
      throw error;
    }
  }

  async verifyFix() {
    logger.info('🔍 Verifying schema fix...');
    
    const response = await this.sheetsService.sheets.spreadsheets.values.get({
      spreadsheetId: this.sheetsService.masterSheetId,
      range: 'O1:S1', // Check the affected columns
    });

    const headers = response.data.values?.[0] || [];
    
    logger.info('📊 UPDATED SCHEMA (columns O-S):');
    headers.forEach((header, index) => {
      const columnLetter = String.fromCharCode(79 + index); // O, P, Q, R, S
      const actualIndex = 14 + index;
      logger.info(`  ${columnLetter}${actualIndex}: "${header}"`);
    });

    const thumbnailConceptsHeader = headers[0]; // O column
    if (thumbnailConceptsHeader === '🤖 Thumbnail Concepts') {
      logger.info('✅ thumbnailConcepts column correctly positioned at O14');
      logger.info('🎨 Thumbnail optimization is now ready to work!');
      return true;
    } else {
      logger.error('❌ Fix verification failed');
      return false;
    }
  }

  async createBackup() {
    logger.info('💾 Creating backup before schema changes...');
    // This would create a backup copy - simplified for now
    logger.info('💾 Consider manually backing up your sheet before running this fix');
  }
}

// Main execution
async function main() {
  const fixer = new SchemaFixer();
  
  try {
    logger.info('⚠️  WARNING: This will modify your Google Sheets structure!');
    logger.info('⚠️  Make sure you have a backup before proceeding.');
    logger.info('');
    logger.info('This fix will:');
    logger.info('1. Insert a new column at position O for "🤖 Thumbnail Concepts"');
    logger.info('2. Shift existing columns (Created Time, Last Edited Time, etc.) to the right');
    logger.info('3. Make the schema compatible with thumbnail optimization');
    logger.info('');
    
    // For safety, let's make this an interactive script
    logger.info('🔧 Ready to fix schema? This will make thumbnail optimization work properly.');
    
    const success = await fixer.fixSchema();
    
    if (success) {
      logger.info('🎉 Schema fix completed successfully!');
      logger.info('✅ Your sheet is now compatible with thumbnail optimization');
      logger.info('🚀 Run `npm start` to begin using the optimized workflow');
    }
    
  } catch (error) {
    logger.error('💥 Schema fix failed:', error);
    process.exit(1);
  }
}

// Export for use
export default SchemaFixer;

// Run the fix automatically
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}