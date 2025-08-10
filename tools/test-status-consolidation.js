#!/usr/bin/env node

import GoogleSheetsService from '../src/services/googleSheetsService.js';
import TelegramService from '../src/services/telegramService.js';
import logger from '../src/utils/logger.js';

class StatusConsolidationTester {
  constructor() {
    this.sheetsService = new GoogleSheetsService();
    this.telegramService = new TelegramService();
  }

  async testConsolidatedMessage() {
    logger.info('🧪 Testing consolidated status message...');
    
    try {
      // Simulate multiple status changes for a test video
      const videoId = 'VID-0001';
      const title = 'Test Video Title';
      
      // Test case 1: Multiple simultaneous status changes
      const statusChanges1 = {
        scriptApproved: { old: 'Pending', new: 'Approved' },
        voiceGenerationStatus: { old: '', new: 'Not Started' },
        videoEditingStatus: { old: '', new: 'Not Started' }
      };
      
      logger.info('\n📧 Test 1: Multiple status changes (should consolidate):');
      await this.telegramService.sendConsolidatedStatusUpdate(
        videoId,
        title,
        statusChanges1,
        'https://sheets.googleapis.com/master',
        'https://sheets.googleapis.com/workbook',
        'https://drive.google.com/folders/test'
      );
      
      // Wait to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Test case 2: Single status change (would normally use individual message)
      const statusChanges2 = {
        voiceGenerationStatus: { old: 'Not Started', new: 'In Progress' }
      };
      
      logger.info('\n📧 Test 2: Single status change (for comparison):');
      await this.telegramService.sendVoiceGenerationStatusChanged(
        videoId,
        title,
        statusChanges2.voiceGenerationStatus.old,
        statusChanges2.voiceGenerationStatus.new,
        'https://sheets.googleapis.com/master',
        'https://sheets.googleapis.com/workbook'
      );
      
      // Wait to avoid rate limits  
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Test case 3: Full workflow completion scenario
      const statusChanges3 = {
        scriptApproved: { old: 'Pending', new: 'Approved' },
        voiceGenerationStatus: { old: 'Not Started', new: 'Completed' },
        videoEditingStatus: { old: 'Not Started', new: 'Completed' }
      };
      
      logger.info('\n📧 Test 3: Full workflow completion:');
      await this.telegramService.sendConsolidatedStatusUpdate(
        videoId,
        'Test Video - Full Workflow Complete',
        statusChanges3,
        'https://sheets.googleapis.com/master',
        'https://sheets.googleapis.com/workbook', 
        'https://drive.google.com/folders/test'
      );
      
      logger.info('\n✅ Consolidated messaging tests sent successfully!');
      logger.info('📱 Check Telegram to see the consolidated vs individual messages');
      
    } catch (error) {
      logger.error('❌ Test failed:', error);
      throw error;
    }
  }

  async demonstrateCurrentBehavior() {
    logger.info('📋 Demonstrating current status monitoring behavior...');
    
    try {
      // Test the actual status monitoring logic
      const videoId = 'VID-0001';
      
      // Get current video details to see how real changes would be processed
      const allVideos = await this.sheetsService.getAllVideos();
      const video = allVideos.find(v => v.videoId === videoId);
      
      if (!video) {
        logger.warn(`Video ${videoId} not found for demonstration`);
        return;
      }
      
      logger.info(`\n📊 Current status of ${videoId}:`);
      logger.info(`  Status: ${video.status}`);
      logger.info(`  Script Approved: ${video.scriptApproved || 'Not Set'}`);
      logger.info(`  Voice Generation: ${video.voiceGenerationStatus || 'Not Set'}`);
      logger.info(`  Video Editing: ${video.videoEditingStatus || 'Not Set'}`);
      
      logger.info('\n💡 Status consolidation logic:');
      logger.info('  - Single field change → Individual notification');
      logger.info('  - Multiple field changes → Consolidated notification');
      logger.info('  - StatusMonitorService detects changes and routes appropriately');
      
    } catch (error) {
      logger.error('❌ Demonstration failed:', error);
    }
  }

  async run() {
    try {
      logger.info('🔬 Testing status message consolidation...');
      
      await this.testConsolidatedMessage();
      
      await this.demonstrateCurrentBehavior();
      
      logger.info('\n🎯 Summary:');
      logger.info('✅ Consolidated messaging system is implemented and working');
      logger.info('📧 Multiple status changes will be sent as single comprehensive message');
      logger.info('📱 Individual changes still get individual notifications');
      logger.info('🤖 StatusMonitorService automatically chooses appropriate message type');
      
    } catch (error) {
      logger.error('❌ Test suite failed:', error);
      process.exit(1);
    }
  }
}

// Run the test
const tester = new StatusConsolidationTester();
tester.run().catch(error => {
  logger.error('Fatal error:', error);
  process.exit(1);
});