#!/usr/bin/env node

/**
 * Check Actual Google Sheets Column Headers
 * 
 * This tool examines the actual column headers in the master sheet
 * to verify the real structure vs. code mappings in googleSheetsService.js
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import GoogleSheetsService from '../src/services/googleSheetsService.js';
import logger from '../src/utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function checkActualSheetHeaders() {
  try {
    logger.info('🔍 Checking actual Google Sheets master sheet headers...');
    
    const sheetsService = new GoogleSheetsService();
    
    // Get the header row (row 1) from the master sheet
    const response = await sheetsService.sheets.spreadsheets.values.get({
      spreadsheetId: sheetsService.masterSheetId,
      range: 'Videos!1:1' // Get only the header row
    });
    
    const headerRow = response.data.values?.[0] || [];
    
    logger.info('\n📋 ACTUAL GOOGLE SHEETS COLUMN HEADERS:');
    logger.info('=====================================');
    
    // Display each column with its letter and index
    for (let i = 0; i < headerRow.length; i++) {
      const columnLetter = String.fromCharCode(65 + i); // A, B, C, etc.
      const headerText = headerRow[i] || '(EMPTY)';
      logger.info(`${columnLetter} (${i}): ${headerText}`);
    }
    
    logger.info(`\n📊 Total columns in sheet: ${headerRow.length}`);
    
    logger.info('\n🔍 CODE MAPPING COMPARISON:');
    logger.info('===========================');
    
    // Compare with code mappings
    const codeMappings = {
      videoId: 0,           // A: 🤖 Video ID (VID-XXXX format)
      youtubeUrl: 1,        // B: 🔧 YouTube URL
      status: 2,            // C: 🤖 Status
      title: 3,             // D: 🤖 Title
      channel: 4,           // E: 🤖 Channel
      duration: 5,          // F: 🤖 Duration
      viewCount: 6,         // G: 🤖 View Count
      publishedDate: 7,     // H: 🤖 Published Date
      youtubeVideoId: 8,    // I: 🤖 YouTube Video ID
      scriptApproved: 9,    // J: 👤 Script Approved (dropdown: 'Pending', 'Approved', 'Needs Changes')
      voiceGenerationStatus: 10, // K: 👤 Voice Generation Status
      videoEditingStatus: 11, // L: 👤 Video Editing Status
      driveFolder: 12,      // M: 🤖 Drive Folder Link
      detailWorkbookUrl: 13, // N: 🤖 Detail Workbook URL
      createdTime: 14,      // O: 🤖 Created Time
      lastEditedTime: 15,   // P: 🤖 Last Edited Time
      isRegenerating: 16    // Q: 🤖 Is Regenerating Flag (internal use)
    };
    
    // Check each mapping
    for (const [fieldName, expectedIndex] of Object.entries(codeMappings)) {
      const columnLetter = String.fromCharCode(65 + expectedIndex);
      const actualHeader = headerRow[expectedIndex] || '(MISSING)';
      
      logger.info(`${fieldName} → ${columnLetter}${expectedIndex}: ${actualHeader}`);
    }
    
    // Highlight potential issues with columns O, P, Q, S, T
    logger.info('\n🎯 FOCUS COLUMNS ANALYSIS:');
    logger.info('==========================');
    
    const focusColumns = [
      { letter: 'O', index: 14, expectedBy: 'Code', expectedContent: '🤖 Created Time' },
      { letter: 'P', index: 15, expectedBy: 'Code', expectedContent: '🤖 Last Edited Time' },
      { letter: 'Q', index: 16, expectedBy: 'Code', expectedContent: '🤖 Is Regenerating Flag' },
      { letter: 'S', index: 18, expectedBy: 'User', expectedContent: '(User says this should be something else)' },
      { letter: 'T', index: 19, expectedBy: 'User', expectedContent: '(User says this should be something else)' }
    ];
    
    for (const col of focusColumns) {
      const actualContent = headerRow[col.index] || '(EMPTY/MISSING)';
      const status = actualContent === col.expectedContent ? '✅ MATCH' : '❌ MISMATCH';
      
      logger.info(`${col.letter}${col.index}: ${actualContent}`);
      logger.info(`   Expected: ${col.expectedContent}`);
      logger.info(`   Status: ${status}\n`);
    }
    
    // Check for columns beyond Q (index 16)
    if (headerRow.length > 17) {
      logger.info('\n🔍 COLUMNS BEYOND CODE MAPPING:');
      logger.info('================================');
      
      for (let i = 17; i < headerRow.length; i++) {
        const columnLetter = String.fromCharCode(65 + i);
        const headerText = headerRow[i] || '(EMPTY)';
        logger.info(`${columnLetter} (${i}): ${headerText}`);
      }
    }
    
    logger.info('\n✅ Sheet header analysis completed!');
    
    return {
      actualHeaders: headerRow,
      totalColumns: headerRow.length,
      codeMappings: codeMappings
    };
    
  } catch (error) {
    logger.error('❌ Error checking sheet headers:', error);
    throw error;
  }
}

// Run the check
checkActualSheetHeaders()
  .then((result) => {
    logger.info('\n🎉 Analysis complete! Check the output above for discrepancies.');
    process.exit(0);
  })
  .catch((error) => {
    logger.error('💥 Tool execution failed:', error.message);
    process.exit(1);
  });