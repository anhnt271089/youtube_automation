#!/usr/bin/env node

/**
 * VID-0017 Verification Script
 *
 * Manually inspects VID-0017's Script Breakdown sheet to check column data
 */

import GoogleSheetsService from '../../src/services/googleSheetsService.js';
import logger from '../../src/utils/logger.js';

async function verifyVID0017() {
  const sheetsService = new GoogleSheetsService();

  try {
    console.log('='.repeat(80));
    console.log('VID-0017 VERIFICATION REPORT');
    console.log('='.repeat(80));

    // Get all videos
    const allVideos = await sheetsService.getAllVideos();
    const video = allVideos.find(v => v.videoId === 'VID-0017');

    if (!video) {
      console.log('ERROR: VID-0017 not found in Master Sheet');
      return;
    }

    console.log('\nVIDEO INFO:');
    console.log(`  Video ID: ${video.videoId}`);
    console.log(`  Title: ${video.title}`);
    console.log(`  Status: ${video.status}`);
    console.log(`  Detail Workbook: ${video.detailWorkbookUrl}`);

    if (!video.detailWorkbookUrl) {
      console.log('\nERROR: No detail workbook URL found');
      return;
    }

    // Extract workbook ID
    const match = video.detailWorkbookUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (!match) {
      console.log('\nERROR: Could not extract workbook ID from URL');
      return;
    }

    const workbookId = match[1];
    console.log(`  Workbook ID: ${workbookId}`);

    // Read Script Breakdown sheet
    const sheetName = sheetsService.detailSheets.scriptBreakdown;
    const response = await sheetsService.sheets.spreadsheets.values.get({
      spreadsheetId: workbookId,
      range: `${sheetName}!A:H`,
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      console.log('\nERROR: No data found in Script Breakdown sheet');
      return;
    }

    console.log(`\nSCRIPT BREAKDOWN DATA:`);
    console.log(`  Total Rows: ${rows.length} (including header)`);

    // Show header row
    if (rows.length > 0) {
      console.log('\nHEADER ROW:');
      const header = rows[0];
      console.log('  A: ' + (header[0] || '(empty)'));
      console.log('  B: ' + (header[1] || '(empty)'));
      console.log('  C: ' + (header[2] || '(empty)'));
      console.log('  D: ' + (header[3] || '(empty)'));
      console.log('  E: ' + (header[4] || '(empty)'));
      console.log('  F: ' + (header[5] || '(empty)'));
      console.log('  G: ' + (header[6] || '(empty)'));
      console.log('  H: ' + (header[7] || '(empty)'));
    }

    // Analyze data rows
    console.log('\nDATA ANALYSIS:');
    let dataRows = rows.slice(1); // Skip header
    let columnDUrls = 0;
    let columnEUrls = 0;
    let columnFStatuses = 0;
    let columnGStatuses = 0;
    let columnEEmpty = 0;
    let legacyPattern = 0;

    dataRows.forEach((row, idx) => {
      const colD = row[3] || '';
      const colE = row[4] || '';
      const colF = row[5] || '';
      const colG = row[6] || '';

      // Check for URLs
      if (colD && (colD.includes('http') || colD.includes('drive.google.com') || colD.includes('pexels.com'))) {
        columnDUrls++;
      }
      if (colE && (colE.includes('http') || colE.includes('drive.google.com') || colE.includes('pexels.com'))) {
        columnEUrls++;
      }

      // Check for status values
      if (colF && (colF.includes('✅') || colF.includes('pending') || colF.includes('success'))) {
        columnFStatuses++;
      }
      if (colG && (colG.includes('✅') || colG.includes('pending') || colG.includes('success'))) {
        columnGStatuses++;
      }

      // Check if E is empty
      if (!colE || colE.trim() === '') {
        columnEEmpty++;
      }

      // Check for legacy pattern (URL in D, empty E)
      if (colD && (colD.includes('http') || colD.includes('drive.google.com') || colD.includes('pexels.com'))) {
        if (!colE || colE.trim() === '') {
          legacyPattern++;
        }
      }
    });

    console.log(`  Data Rows: ${dataRows.length}`);
    console.log(`  Column D URLs: ${columnDUrls}`);
    console.log(`  Column E URLs: ${columnEUrls}`);
    console.log(`  Column F Statuses: ${columnFStatuses}`);
    console.log(`  Column G Statuses: ${columnGStatuses}`);
    console.log(`  Column E Empty: ${columnEEmpty}`);
    console.log(`  Legacy Pattern (URL in D, empty E): ${legacyPattern}`);

    // Show first 3 data rows as sample
    console.log('\nSAMPLE DATA ROWS (first 3):');
    for (let i = 0; i < Math.min(3, dataRows.length); i++) {
      const row = dataRows[i];
      console.log(`\nRow ${i + 2}:`);
      console.log(`  A (Sentence #): ${row[0] || '(empty)'}`);
      console.log(`  B (Script Text): ${(row[1] || '(empty)').substring(0, 50)}...`);
      console.log(`  C (Image Prompt): ${(row[2] || '(empty)').substring(0, 50)}...`);
      console.log(`  D (Search Phrase): ${row[3] || '(empty)'}`);
      console.log(`  E (Image URL): ${row[4] || '(empty)'}`);
      console.log(`  F (Editor Keywords): ${row[5] || '(empty)'}`);
      console.log(`  G (Status): ${row[6] || '(empty)'}`);
      console.log(`  H (Word Count): ${row[7] || '(empty)'}`);
    }

    // Show last row as well
    if (dataRows.length > 3) {
      const lastRow = dataRows[dataRows.length - 1];
      console.log(`\nLast Row (${dataRows.length + 1}):`);
      console.log(`  A (Sentence #): ${lastRow[0] || '(empty)'}`);
      console.log(`  B (Script Text): ${(lastRow[1] || '(empty)').substring(0, 50)}...`);
      console.log(`  C (Image Prompt): ${(lastRow[2] || '(empty)').substring(0, 50)}...`);
      console.log(`  D (Search Phrase): ${lastRow[3] || '(empty)'}`);
      console.log(`  E (Image URL): ${lastRow[4] || '(empty)'}`);
      console.log(`  F (Editor Keywords): ${lastRow[5] || '(empty)'}`);
      console.log(`  G (Status): ${lastRow[6] || '(empty)'}`);
      console.log(`  H (Word Count): ${lastRow[7] || '(empty)'}`);
    }

    console.log('\n' + '='.repeat(80));
    console.log('CONCLUSION:');
    if (legacyPattern > 0) {
      console.log(`  ⚠️  LEGACY DATA DETECTED: ${legacyPattern} rows have URLs in column D with empty column E`);
      console.log('  This indicates the asset download system wrote to the wrong column.');
      console.log('  Migration is needed.');
    } else if (columnDUrls > 0 && columnEUrls > 0) {
      console.log('  ℹ️  Mixed data: Both column D and E contain URLs');
      console.log('  This may indicate partial migration or different data types.');
    } else if (columnEUrls > 0) {
      console.log('  ✅ Data appears to be in correct columns (E for URLs, G for status)');
      console.log('  No migration needed.');
    } else {
      console.log('  ℹ️  No URLs found in either column D or E');
      console.log('  Assets may not have been downloaded yet.');
    }
    console.log('='.repeat(80));

  } catch (error) {
    console.error('ERROR:', error.message);
    logger.error('Verification failed:', error);
  }
}

verifyVID0017()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });