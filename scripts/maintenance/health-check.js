#!/usr/bin/env node

/**
 * System Health Check Script
 * Verifies all service integrations including Google Sheets API
 */

import GoogleDriveService from '../../src/services/googleDriveService.js';
import YouTubeService from '../../src/services/youtubeService.js';
import NotionService from '../../src/services/notionService.js';
import TelegramService from '../../src/services/telegramService.js';
import AIService from '../../src/services/aiService.js';
import DigitalOceanService from '../../src/services/digitalOceanService.js';
import logger from '../../src/utils/logger.js';

class HealthChecker {
  constructor() {
    this.services = {
      'Google Drive': new GoogleDriveService(),
      'YouTube': new YouTubeService(),
      'Notion': new NotionService(),
      'Telegram': new TelegramService(),
      'AI': new AIService(),
      'Digital Ocean': new DigitalOceanService()
    };
  }

  async checkAllServices() {
    console.log('🔍 YouTube Automation System Health Check\n');
    
    const results = {};
    let overallHealthy = true;

    for (const [serviceName, service] of Object.entries(this.services)) {
      console.log(`Checking ${serviceName}...`);
      
      try {
        await service.healthCheck();
        console.log(`✅ ${serviceName}: Healthy`);
        results[serviceName] = { status: 'healthy', error: null };
      } catch (error) {
        console.log(`❌ ${serviceName}: Failed`);
        console.log(`   Error: ${error.message}`);
        results[serviceName] = { status: 'failed', error: error.message };
        overallHealthy = false;

        // Special handling for Google Sheets API
        if (serviceName === 'Google Drive' && error.message.includes('Sheets API')) {
          console.log(`   🔧 Solution: Enable Google Sheets API in Google Cloud Console`);
          console.log(`   📋 See GOOGLE_SHEETS_SETUP.md for instructions`);
        }
      }
      console.log('');
    }

    // Summary
    console.log('📊 Health Check Summary:');
    console.log('=======================');
    
    for (const [serviceName, result] of Object.entries(results)) {
      const status = result.status === 'healthy' ? '✅' : '❌';
      console.log(`${status} ${serviceName}: ${result.status.toUpperCase()}`);
    }

    console.log(`\n🏥 Overall System Health: ${overallHealthy ? '✅ HEALTHY' : '❌ NEEDS ATTENTION'}`);

    if (!overallHealthy) {
      console.log('\n🔧 Issues detected. Please resolve the failed services above.');
      console.log('📖 Refer to the documentation and setup guides for solutions.');
    }

    return { overallHealthy, results };
  }

  async testGoogleSheets() {
    console.log('🧪 Google Sheets API Specific Test\n');
    
    const driveService = new GoogleDriveService();
    
    try {
      await driveService.testSheetsAPI();
      console.log('✅ Google Sheets API is enabled and working');
      console.log('   Your system can create script breakdown spreadsheets');
      return true;
    } catch (error) {
      console.log('❌ Google Sheets API is not working');
      console.log(`   Error: ${error.message}`);
      
      if (error.message.includes('has not been used') || error.message.includes('disabled')) {
        console.log('\n🔧 SOLUTION: Enable Google Sheets API');
        console.log('📋 Steps:');
        console.log('   1. Go to: https://console.cloud.google.com/apis/library');
        console.log('   2. Search for "Google Sheets API"');
        console.log('   3. Click on "Google Sheets API"');
        console.log('   4. Click "ENABLE"');
        console.log('   5. Wait 1-2 minutes for activation');
        console.log('\n📄 For detailed instructions, see: GOOGLE_SHEETS_SETUP.md');
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
    console.error('Health check failed:', error);
    process.exit(1);
  });
}

export default HealthChecker;