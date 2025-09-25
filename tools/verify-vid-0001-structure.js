#!/usr/bin/env node
/**
 * Verify VID-0001 Script Breakdown sheet structure after migration
 */

import GoogleSheetsService from '../src/services/googleSheetsService.js';
import logger from '../src/utils/logger.js';

const VIDEO_ID = 'VID-0001';

async function verifyStructure() {
  try {
    const sheetsService = new GoogleSheetsService();

    // Get workbook info
    const videoRow = await sheetsService.findVideoRow(VIDEO_ID);
    const workbookUrl = videoRow.data[sheetsService.masterColumns.detailWorkbookUrl];
    const workbookId = workbookUrl.split('/d/')[1].split('/')[0];

    console.log(`\n🔍 VERIFYING VID-0001 STRUCTURE`);
    console.log(`📋 Workbook ID: ${workbookId}`);
    console.log(`🔗 Workbook URL: ${workbookUrl}`);

    // Read current structure
    const response = await sheetsService.sheets.spreadsheets.values.get({
      spreadsheetId: workbookId,
      range: `${sheetsService.detailSheets.scriptBreakdown}!A1:H10` // First 10 rows for verification
    });

    const values = response.data.values || [];
    const headers = values[0] || [];
    const sampleRows = values.slice(1, 6); // First 5 data rows

    console.log(`\n📊 STRUCTURE ANALYSIS:`);
    console.log(`   📐 Total columns: ${headers.length}`);
    console.log(`   📝 Headers: [${headers.join(', ')}]`);

    console.log(`\n📋 COLUMN MAPPING:`);
    headers.forEach((header, index) => {
      const columnLetter = String.fromCharCode(65 + index); // A, B, C, etc.
      console.log(`   ${columnLetter}: ${header}`);
    });

    console.log(`\n📄 SAMPLE DATA (First 5 rows):`);
    sampleRows.forEach((row, index) => {
      const rowNum = index + 1;
      console.log(`\n   Row ${rowNum}:`);
      console.log(`     A (${headers[0]}): ${row[0] || 'empty'}`);
      console.log(`     B (${headers[1]}): ${(row[1] || 'empty').substring(0, 80)}${row[1] && row[1].length > 80 ? '...' : ''}`);
      console.log(`     C (${headers[2]}): ${(row[2] || 'empty').substring(0, 80)}${row[2] && row[2].length > 80 ? '...' : ''}`);
      console.log(`     D (${headers[3]}): ${row[3] || 'empty'}`); // This should be the search phrase
      console.log(`     E (${headers[4]}): ${row[4] || 'empty'}`);
      console.log(`     F (${headers[5]}): ${row[5] || 'empty'}`);
      console.log(`     G (${headers[6]}): ${row[6] || 'empty'}`);
      console.log(`     H (${headers[7]}): ${row[7] || 'empty'}`);
    });

    // Verify search phrases are populated
    const fullDataResponse = await sheetsService.sheets.spreadsheets.values.get({
      spreadsheetId: workbookId,
      range: `${sheetsService.detailSheets.scriptBreakdown}!D:D` // Search phrase column
    });

    const searchPhrases = fullDataResponse.data.values || [];
    const dataSearchPhrases = searchPhrases.slice(1); // Skip header
    const populatedCount = dataSearchPhrases.filter(row => row[0] && row[0].trim()).length;

    console.log(`\n✅ MIGRATION VERIFICATION:`);
    console.log(`   📏 Structure: ${headers.length === 8 ? '✅ 8 columns' : '❌ Expected 8 columns'}`);
    console.log(`   🔍 Search phrase column: ${headers[3] === 'Search phrase' ? '✅ Correct position' : '❌ Wrong position'}`);
    console.log(`   📊 Search phrases populated: ${populatedCount}/${dataSearchPhrases.length} rows`);
    console.log(`   📝 Header format: ${headers[0] === 'Sentence Number' ? '✅ Standardized' : '⚠️  Custom format'}`);

    if (headers.length === 8 && headers[3] === 'Search phrase' && populatedCount > 0) {
      console.log(`\n🎉 SUCCESS: VID-0001 has been successfully updated to the new 8-column structure!`);
    } else {
      console.log(`\n⚠️  WARNING: Structure may need additional adjustments.`);
    }

  } catch (error) {
    console.error(`❌ Verification failed: ${error.message}`);
    process.exit(1);
  }
}

verifyStructure();