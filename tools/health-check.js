#!/usr/bin/env node

/**
 * System Health Check Script
 * Verifies all service integrations including Google Sheets API
 */

import GoogleDriveService from '../src/services/googleDriveService.js';
import YouTubeService from '../src/services/youtubeService.js';
import TelegramService from '../src/services/telegramService.js';
import AIService from '../src/services/aiService.js';
import logger from '../src/utils/logger.js';
import {
  formatHeader,
  formatSubHeader,
  formatSuccess,
  formatError,
  formatInfo,
  formatStep,
  formatProgress,
  formatWarning,
  formatSeparator,
  formatCompletion,
  formatListItem,
  EMOJIS
} from '../src/utils/consoleFormatter.js';

class HealthChecker {
  constructor() {
    this.services = {
      'Google Drive': new GoogleDriveService(),
      'YouTube': new YouTubeService(),
      'Telegram': new TelegramService(),
      'AI': new AIService()
    };
  }

  async checkAllServices() {
    console.log(formatHeader('YouTube Automation System Health Check', { emoji: EMOJIS.VALIDATING }));
    
    const results = {};
    let overallHealthy = true;

    for (const [serviceName, service] of Object.entries(this.services)) {
      console.log(formatInfo(`Checking ${serviceName}...`, { emoji: EMOJIS.PROCESSING }));
      
      try {
        await service.healthCheck();
        console.log(formatSuccess(`${serviceName}: Healthy`));
        results[serviceName] = { status: 'healthy', error: null };
      } catch (error) {
        console.log(formatError(`${serviceName}: Failed`));
        console.log(formatListItem(`Error: ${error.message}`, { indent: 1 }));
        results[serviceName] = { status: 'failed', error: error.message };
        overallHealthy = false;

        // Special handling for Google Sheets API
        if (serviceName === 'Google Drive' && error.message.includes('Sheets API')) {
          console.log(formatListItem('Solution: Enable Google Sheets API in Google Cloud Console', { bullet: EMOJIS.FIXING, indent: 1 }));
          console.log(formatListItem('See GOOGLE_SHEETS_SETUP.md for instructions', { bullet: EMOJIS.INFO, indent: 1 }));
        }
      }
      console.log('');
    }

    // Summary
    console.log(formatSubHeader('Health Check Summary', { emoji: EMOJIS.GOOGLE }));
    console.log(formatSeparator(40, '='));
    
    for (const [serviceName, result] of Object.entries(results)) {
      const status = result.status === 'healthy' ? EMOJIS.SUCCESS : EMOJIS.ERROR;
      console.log(formatListItem(`${serviceName}: ${result.status.toUpperCase()}`, { bullet: status }));
    }

    const overallStatus = overallHealthy ? 'HEALTHY' : 'NEEDS ATTENTION';
    const overallEmoji = overallHealthy ? EMOJIS.SUCCESS : EMOJIS.ERROR;
    console.log(formatInfo(`Overall System Health: ${overallStatus}`, { emoji: overallEmoji }));

    if (!overallHealthy) {
      console.log(formatWarning('Issues detected. Please resolve the failed services above.', { emoji: EMOJIS.FIXING }));
      console.log(formatInfo('Refer to the documentation and setup guides for solutions.', { emoji: EMOJIS.INFO }));
    }

    return { overallHealthy, results };
  }

  async testGoogleSheets() {
    console.log(formatSubHeader('Google Sheets API Specific Test', { emoji: EMOJIS.TESTING }));
    
    const driveService = new GoogleDriveService();
    
    try {
      await driveService.testSheetsAPI();
      console.log(formatSuccess('Google Sheets API is enabled and working'));
      console.log(formatListItem('Your system can create script breakdown spreadsheets', { indent: 1 }));
      return true;
    } catch (error) {
      console.log(formatError('Google Sheets API is not working'));
      console.log(formatListItem(`Error: ${error.message}`, { indent: 1 }));
      
      if (error.message.includes('has not been used') || error.message.includes('disabled')) {
        console.log(formatSubHeader('SOLUTION: Enable Google Sheets API', { emoji: EMOJIS.FIXING }));
        console.log(formatSubHeader('Steps', { emoji: EMOJIS.INFO }));
        console.log(formatListItem('Go to: https://console.cloud.google.com/apis/library'));
        console.log(formatListItem('Search for "Google Sheets API"'));
        console.log(formatListItem('Click on "Google Sheets API"'));
        console.log(formatListItem('Click "ENABLE"'));
        console.log(formatListItem('Wait 1-2 minutes for activation'));
        console.log(formatInfo('For detailed instructions, see: GOOGLE_SHEETS_SETUP.md', { emoji: EMOJIS.INFO }));
      }
      
      return false;
    }
  }
}

// Command line interface
async function main() {
  const checker = new HealthChecker();
  
  const command = process.argv[2];
  
  switch (command) {
    case 'sheets':
      await checker.testGoogleSheets();
      break;
    case 'all':
    default:
      const result = await checker.checkAllServices();
      process.exit(result.overallHealthy ? 0 : 1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error(formatError(`Health check failed: ${error.message}`));
    process.exit(1);
  });
}

export default HealthChecker;