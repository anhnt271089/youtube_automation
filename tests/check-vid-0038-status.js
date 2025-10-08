/**
 * Check detailed status of VID-0038 to understand what happened
 */

import GoogleSheetsService from '../src/services/googleSheetsService.js';
import logger from '../src/utils/logger.js';

const sheetsService = new GoogleSheetsService();

async function checkStatus() {
  try {
    const videoId = 'VID-0038';

    logger.info(`Checking status for ${videoId}...`);

    const videoDetails = await sheetsService.getVideoDetails(videoId);

    if (!videoDetails) {
      logger.error(`${videoId} not found`);
      return;
    }

    logger.info('Video Details:', JSON.stringify(videoDetails, null, 2));

    // Try to get workbook ID and check sheets
    if (videoDetails.detailWorkbookUrl) {
      const workbookId = videoDetails.detailWorkbookUrl.split('/d/')[1].split('/')[0];
      logger.info(`\nWorkbook ID: ${workbookId}`);

      // Get all sheets
      const metadata = await sheetsService.sheets.spreadsheets.get({
        spreadsheetId: workbookId,
        fields: 'sheets(properties(title,sheetId,gridProperties))'
      });

      logger.info('\nSheets in workbook:');
      metadata.data.sheets.forEach(sheet => {
        logger.info(`  - ${sheet.properties.title}: ${sheet.properties.gridProperties.rowCount} rows × ${sheet.properties.gridProperties.columnCount} cols`);
      });

      // Check Video Info content
      const videoInfoResponse = await sheetsService.sheets.spreadsheets.values.get({
        spreadsheetId: workbookId,
        range: 'Video Info!A1:B100'
      });

      const videoInfoData = videoInfoResponse.data.values || [];
      logger.info(`\nVideo Info sheet has ${videoInfoData.length} rows of data`);

      // Check for key sections
      const hasCleanScript = videoInfoData.some(row => row[0] === 'CLEAN VOICE SCRIPT');
      logger.info(`Has CLEAN VOICE SCRIPT: ${hasCleanScript}`);

      // Check Script Breakdown
      const breakdownResponse = await sheetsService.sheets.spreadsheets.values.get({
        spreadsheetId: workbookId,
        range: 'Script Breakdown!A1:H100'
      });

      const breakdownData = breakdownResponse.data.values || [];
      logger.info(`\nScript Breakdown has ${breakdownData.length} rows (including header)`);
      if (breakdownData.length > 1) {
        logger.info(`First breakdown entry: ${JSON.stringify(breakdownData[1])}`);
      }
    }

  } catch (error) {
    logger.error('Error:', error.message);
    logger.error(error.stack);
  }
}

checkStatus()
  .then(() => process.exit(0))
  .catch(error => {
    logger.error('Fatal:', error);
    process.exit(1);
  });
