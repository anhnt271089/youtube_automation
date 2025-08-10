#!/usr/bin/env node

/**
 * Check Google Sheets Schema
 * 
 * This tool checks if the actual Google Sheets headers match the code implementation
 */

import GoogleSheetsService from '../src/services/googleSheetsService.js';
import logger from '../src/utils/logger.js';

class SchemaChecker {
  constructor() {
    this.sheetsService = new GoogleSheetsService();
  }

  async checkMasterSheetSchema() {
    try {
      logger.info('🔍 Checking Google Sheets schema...');
      
      // Get the first row (headers) from the master sheet
      const response = await this.sheetsService.sheets.spreadsheets.values.get({
        spreadsheetId: this.sheetsService.masterSheetId,
        range: '1:1', // First row only
      });

      const headers = response.data.values?.[0] || [];
      
      logger.info('📊 ACTUAL SHEET HEADERS:');
      headers.forEach((header, index) => {
        const columnLetter = String.fromCharCode(65 + index); // A, B, C, etc.
        logger.info(`  ${columnLetter}${index}: "${header}"`);
      });

      logger.info('\n🔧 EXPECTED BY CODE (masterColumns):');
      Object.entries(this.sheetsService.masterColumns).forEach(([key, index]) => {
        const columnLetter = String.fromCharCode(65 + index);
        const actualHeader = headers[index] || 'MISSING';
        const match = actualHeader !== 'MISSING' ? '✅' : '❌';
        logger.info(`  ${match} ${columnLetter}${index}: ${key} -> "${actualHeader}"`);
      });

      // Check for mismatches
      const mismatches = [];
      const missing = [];

      Object.entries(this.sheetsService.masterColumns).forEach(([key, index]) => {
        if (index >= headers.length) {
          missing.push(`${key} at column ${String.fromCharCode(65 + index)}${index}`);
        }
      });

      // Check for extra columns in sheet
      const extraColumns = [];
      if (headers.length > Object.keys(this.sheetsService.masterColumns).length) {
        for (let i = Object.keys(this.sheetsService.masterColumns).length; i < headers.length; i++) {
          extraColumns.push(`Column ${String.fromCharCode(65 + i)}${i}: "${headers[i]}"`);
        }
      }

      logger.info('\n📋 SCHEMA ANALYSIS SUMMARY:');
      logger.info(`  Total headers in sheet: ${headers.length}`);
      logger.info(`  Expected columns by code: ${Object.keys(this.sheetsService.masterColumns).length}`);
      
      if (missing.length > 0) {
        logger.warn('❌ MISSING COLUMNS:');
        missing.forEach(col => logger.warn(`  - ${col}`));
      } else {
        logger.info('✅ All expected columns are present');
      }

      if (extraColumns.length > 0) {
        logger.info('📝 EXTRA COLUMNS IN SHEET:');
        extraColumns.forEach(col => logger.info(`  + ${col}`));
      }

      // Check for thumbnailConcepts column specifically
      const thumbnailConceptsIndex = this.sheetsService.masterColumns.thumbnailConcepts;
      const thumbnailConceptsHeader = headers[thumbnailConceptsIndex];
      
      logger.info('\n🎨 THUMBNAIL OPTIMIZATION CHECK:');
      if (thumbnailConceptsHeader) {
        logger.info(`✅ thumbnailConcepts column found at O${thumbnailConceptsIndex}: "${thumbnailConceptsHeader}"`);
      } else {
        logger.warn(`❌ thumbnailConcepts column MISSING at expected position O${thumbnailConceptsIndex}`);
      }

      return {
        actualHeaders: headers,
        expectedColumns: this.sheetsService.masterColumns,
        missing,
        extraColumns,
        thumbnailConceptsPresent: !!thumbnailConceptsHeader
      };

    } catch (error) {
      logger.error('❌ Error checking sheet schema:', error);
      throw error;
    }
  }

  async generateSchemaFixScript() {
    logger.info('\n🛠️ SCHEMA FIX RECOMMENDATIONS:');
    logger.info('If there are mismatches, you can:');
    logger.info('1. Update sheet headers to match the code');
    logger.info('2. Update the code to match your sheet');
    logger.info('3. Create a migration script to reorganize data');
    logger.info('\nFor thumbnail optimization to work, ensure column O contains "🤖 Thumbnail Concepts" or similar.');
  }
}

// Main execution
async function main() {
  const checker = new SchemaChecker();
  
  try {
    const result = await checker.checkMasterSheetSchema();
    await checker.generateSchemaFixScript();
    
    logger.info('\n🎉 Schema check completed successfully!');
    
  } catch (error) {
    logger.error('💥 Schema check failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default SchemaChecker;