#!/usr/bin/env node

/**
 * Read Master Sheet Headers - Columns O through T Analysis
 * 
 * This tool reads the actual column headers from the Google Sheets master sheet
 * to diagnose the mismatch between expected and actual column structure.
 * 
 * User reported:
 * - Column O is "🤖 Thumbnail Concepts" (not "Created Time" as code expects)
 * - Column Q is "Last Edited Time" (not "Is Regenerating" as code expects)
 */

import GoogleSheetsService from '../src/services/googleSheetsService.js';
import logger from '../src/utils/logger.js';

async function readMasterSheetHeaders() {
  try {
    logger.info('🔍 Reading actual column headers from Google Sheets master sheet...');
    
    const googleSheetsService = new GoogleSheetsService();
    
    // Read the first row (headers) from the master sheet
    const response = await googleSheetsService.sheets.spreadsheets.values.get({
      spreadsheetId: googleSheetsService.masterSheetId,
      range: 'Videos!A1:Z1' // Read first row up to column Z to see all headers
    });

    const headers = response.data.values?.[0] || [];
    
    logger.info('📊 GOOGLE SHEETS COLUMN ANALYSIS:');
    logger.info('=====================================');
    
    // Show all headers with their column letters
    headers.forEach((header, index) => {
      const columnLetter = String.fromCharCode(65 + index); // A=65
      const columnDescription = header || '(empty)';
      
      // Highlight the problematic columns O, P, Q, R, S, T
      if (index >= 14 && index <= 19) {
        logger.info(`🔴 ${columnLetter}${index.toString().padStart(2)}: "${columnDescription}"`);
      } else {
        logger.info(`   ${columnLetter}${index.toString().padStart(2)}: "${columnDescription}"`);
      }
    });
    
    logger.info('=====================================');
    logger.info('🎯 FOCUS ON PROBLEMATIC COLUMNS (O-T):');
    logger.info('');
    
    // Focus on columns O-T (indices 14-19)
    const problemColumns = [
      { letter: 'O', index: 14, expected: '🤖 Created Time', actual: headers[14] },
      { letter: 'P', index: 15, expected: '🤖 Last Edited Time', actual: headers[15] },
      { letter: 'Q', index: 16, expected: '🤖 Is Regenerating Flag', actual: headers[16] },
      { letter: 'R', index: 17, expected: '(undefined in code)', actual: headers[17] },
      { letter: 'S', index: 18, expected: '(undefined in code)', actual: headers[18] },
      { letter: 'T', index: 19, expected: '(undefined in code)', actual: headers[19] }
    ];
    
    problemColumns.forEach(col => {
      const match = col.expected === (col.actual || '(empty)') ? '✅' : '❌';
      logger.info(`${match} Column ${col.letter} (${col.index}): Expected: "${col.expected}" | Actual: "${col.actual || '(empty)'}"`);
    });
    
    logger.info('');
    logger.info('🔧 CODE MAPPING ANALYSIS:');
    logger.info('Current GoogleSheetsService.masterColumns mapping:');
    
    const currentMapping = {
      videoId: 0,           // A: 🤖 Video ID
      youtubeUrl: 1,        // B: 🔧 YouTube URL
      status: 2,            // C: 🤖 Status
      title: 3,             // D: 🤖 Title
      channel: 4,           // E: 🤖 Channel
      duration: 5,          // F: 🤖 Duration
      viewCount: 6,         // G: 🤖 View Count
      publishedDate: 7,     // H: 🤖 Published Date
      youtubeVideoId: 8,    // I: 🤖 YouTube Video ID
      scriptApproved: 9,    // J: 👤 Script Approved
      voiceGenerationStatus: 10, // K: 👤 Voice Generation Status
      videoEditingStatus: 11, // L: 👤 Video Editing Status
      driveFolder: 12,      // M: 🤖 Drive Folder Link
      detailWorkbookUrl: 13, // N: 🤖 Detail Workbook URL
      createdTime: 14,      // O: EXPECTED "🤖 Created Time" → ACTUAL "???"
      lastEditedTime: 15,   // P: EXPECTED "🤖 Last Edited Time" → ACTUAL "???"
      isRegenerating: 16    // Q: EXPECTED "🤖 Is Regenerating Flag" → ACTUAL "???"
    };
    
    Object.entries(currentMapping).forEach(([field, index]) => {
      const columnLetter = String.fromCharCode(65 + index);
      const expectedHeader = `Column ${columnLetter}`;
      const actualHeader = headers[index] || '(empty)';
      const match = index <= 13 ? '✅' : '❓'; // Assume A-N are correct, O+ need verification
      
      logger.info(`${match} ${field.padEnd(20)} → ${expectedHeader} (${index.toString().padStart(2)}): "${actualHeader}"`);
    });
    
    logger.info('');
    logger.info('💡 RECOMMENDATIONS:');
    
    if (headers[14] && headers[14].includes('Thumbnail')) {
      logger.info('• Column O appears to be thumbnail-related, not "Created Time"');
    }
    
    if (headers[16] && headers[16].includes('Last Edited')) {
      logger.info('• Column Q appears to be "Last Edited Time", not "Is Regenerating"');
    }
    
    logger.info('• Update GoogleSheetsService.masterColumns mapping to match actual sheet structure');
    logger.info('• Ensure consistent column usage across all operations');
    logger.info('• Consider using named ranges in Google Sheets for better maintainability');
    
    return { success: true, headers };
    
  } catch (error) {
    logger.error('❌ Failed to read master sheet headers:', error.message);
    logger.error('Stack trace:', error.stack);
    return { success: false, error: error.message };
  }
}

// Run the analysis
readMasterSheetHeaders()
  .then(result => {
    if (result.success) {
      logger.info('✅ Master sheet header analysis completed successfully');
    } else {
      logger.error('❌ Master sheet header analysis failed');
      process.exit(1);
    }
  })
  .catch(error => {
    logger.error('💥 Unexpected error during header analysis:', error);
    process.exit(1);
  });