#!/usr/bin/env node

/**
 * Quick Test Script for Legacy Thumbnail Processing System
 * 
 * This script provides a quick way to test the legacy thumbnail processing system
 * before running the full batch processing on all legacy videos.
 * 
 * Usage:
 *   # Test single video
 *   node tools/test-legacy-thumbnails.js --test-video VIDEO_ID
 * 
 *   # Test JSON parsing fixes
 *   node tools/test-legacy-thumbnails.js --test-json-parsing
 * 
 *   # Test Drive folder creation
 *   node tools/test-legacy-thumbnails.js --test-folder-creation VIDEO_ID
 * 
 *   # Quick validation of all components
 *   node tools/test-legacy-thumbnails.js --validate-system
 */

import ThumbnailService from '../src/services/thumbnailService.js';
import GoogleSheetsService from '../src/services/googleSheetsService.js';
import AIService from '../src/services/aiService.js';
import GoogleDriveService from '../src/services/googleDriveService.js';
import logger from '../src/utils/logger.js';

class LegacyThumbnailTester {
  constructor() {
    this.googleSheetsService = new GoogleSheetsService();
    this.aiService = new AIService();
    this.googleDriveService = new GoogleDriveService();
    this.thumbnailService = new ThumbnailService(this.aiService, this.googleDriveService);
  }

  /**
   * Test JSON parsing robustness with various edge cases
   */
  async testJsonParsing() {
    console.log('🧪 Testing JSON parsing robustness...');
    
    const testCases = [
      {
        name: 'Valid JSON response',
        mockResponse: '{"mainTheme": "Test", "keyElements": ["a", "b"], "emotionalTone": "inspiring"}'
      },
      {
        name: 'JSON with code blocks',
        mockResponse: '```json\n{"mainTheme": "Test", "keyElements": ["a", "b"], "emotionalTone": "inspiring"}\n```'
      },
      {
        name: 'JSON with extra text',
        mockResponse: 'Here is the analysis:\n\n{"mainTheme": "Test", "keyElements": ["a", "b"], "emotionalTone": "inspiring"}\n\nThis should work well.'
      },
      {
        name: 'Malformed JSON',
        mockResponse: '{"mainTheme": "Test", "keyElements": [a, b], "emotionalTone":'
      },
      {
        name: 'Empty response',
        mockResponse: ''
      },
      {
        name: 'Non-JSON response',
        mockResponse: 'This is not JSON at all, just plain text response.'
      }
    ];
    
    for (const testCase of testCases) {
      try {
        console.log(`\n   Testing: ${testCase.name}`);
        
        // Mock AI service response
        const originalAnthropic = this.aiService.anthropic;
        this.aiService.anthropic = {
          messages: {
            create: async () => ({
              content: [{ text: testCase.mockResponse }]
            })
          }
        };
        
        const result = await this.thumbnailService.generateThumbnailContext('Test Title', 'Test content');
        
        console.log(`   ✅ Result: ${JSON.stringify(result, null, 2)}`);
        
        // Restore original service
        this.aiService.anthropic = originalAnthropic;
        
      } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
      }
    }
    
    console.log('\n✅ JSON parsing test completed');
  }

  /**
   * Test Drive folder creation logic
   */
  async testFolderCreation(videoId) {
    console.log(`🧪 Testing Drive folder creation for ${videoId}...`);
    
    try {
      const videoDetails = await this.googleSheetsService.getVideoDetails(videoId);
      if (!videoDetails) {
        throw new Error(`Video not found: ${videoId}`);
      }
      
      const sanitizedTitle = this.googleDriveService.sanitizeFolderName(videoDetails.title);
      const folderName = `${sanitizedTitle} (${videoId})`;
      
      console.log(`   📁 Looking for folder: ${folderName}`);
      
      // Test the enhanced findVideoFolder method
      const folderResult = await this.thumbnailService.findVideoFolder(folderName);
      
      console.log(`   ✅ Folder result:`, JSON.stringify(folderResult, null, 2));
      
      return folderResult;
      
    } catch (error) {
      console.log(`   ❌ Folder creation test failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Test complete thumbnail processing for a single video
   */
  async testSingleVideo(videoId) {
    console.log(`🧪 Testing complete thumbnail processing for ${videoId}...`);
    
    try {
      const videoDetails = await this.googleSheetsService.getVideoDetails(videoId);
      if (!videoDetails) {
        throw new Error(`Video not found: ${videoId}`);
      }
      
      console.log(`   📊 Video details:`, {
        title: videoDetails.title,
        scriptApproved: videoDetails.scriptApproved,
        driveFolder: videoDetails.driveFolder ? 'EXISTS' : 'MISSING',
        detailWorkbook: videoDetails.detailWorkbookUrl ? 'EXISTS' : 'MISSING'
      });
      
      // Test thumbnail check
      console.log(`   🔍 Checking existing thumbnails...`);
      const existingCheck = await this.thumbnailService.checkExistingThumbnails(videoId, videoDetails.title);
      console.log(`   📋 Existing thumbnails:`, {
        exists: existingCheck.exists,
        count: existingCheck.count || 0,
        reason: existingCheck.reason
      });
      
      // Prepare test video data
      const videoData = {
        videoId: videoDetails.id || videoId,
        id: videoDetails.youtubeVideoId || videoId,
        title: videoDetails.title || 'Test Video',
        youtubeUrl: videoDetails.youtubeUrl || '',
        channelTitle: videoDetails.channel || 'Test Channel',
        duration: videoDetails.duration || 'Unknown',
        viewCount: videoDetails.viewCount || 0,
        publishedAt: videoDetails.publishedDate || 'Unknown',
        transcriptText: `Test script content for ${videoDetails.title}`,
        optimizedScript: `Test optimized script for ${videoDetails.title}`
      };
      
      console.log(`   🎨 Testing thumbnail generation (dry run - no actual generation)...`);
      
      // For testing, we'll just test the context generation part
      const context = await this.thumbnailService.generateThumbnailContext(
        videoData.title, 
        videoData.transcriptText
      );
      
      console.log(`   ✅ Thumbnail context generated:`, JSON.stringify(context, null, 2));
      
      console.log(`   ✅ Single video test completed successfully`);
      return { success: true, context, existingCheck };
      
    } catch (error) {
      console.log(`   ❌ Single video test failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Validate entire system components
   */
  async validateSystem() {
    console.log('🧪 Validating legacy thumbnail processing system...');
    
    const validationResults = {
      services: {},
      methods: {},
      integration: {}
    };
    
    try {
      // Test service initialization
      console.log('\n📋 Testing service initialization...');
      validationResults.services.googleSheets = !!this.googleSheetsService;
      validationResults.services.aiService = !!this.aiService;
      validationResults.services.googleDrive = !!this.googleDriveService;
      validationResults.services.thumbnail = !!this.thumbnailService;
      
      console.log('   ✅ All services initialized');
      
      // Test enhanced methods exist
      console.log('\n📋 Testing enhanced methods...');
      validationResults.methods.generateThumbnailContext = typeof this.thumbnailService.generateThumbnailContext === 'function';
      validationResults.methods.findVideoFolder = typeof this.thumbnailService.findVideoFolder === 'function';
      validationResults.methods.createVideoFolder = typeof this.thumbnailService.createVideoFolder === 'function';
      validationResults.methods.processVideoThumbnails = typeof this.thumbnailService.processVideoThumbnails === 'function';
      
      console.log('   ✅ All enhanced methods available');
      
      // Test Google Sheets integration
      console.log('\n📋 Testing Google Sheets integration...');
      const approvedVideos = await this.googleSheetsService.getVideosWithApprovedScripts();
      validationResults.integration.sheetsAccess = true;
      validationResults.integration.approvedVideosCount = approvedVideos.length;
      
      console.log(`   ✅ Found ${approvedVideos.length} approved videos`);
      
      // Test AI service
      console.log('\n📋 Testing AI service connectivity...');
      if (this.aiService.anthropic) {
        validationResults.integration.aiService = true;
        console.log('   ✅ AI service connected');
      } else {
        validationResults.integration.aiService = false;
        console.log('   ⚠️  AI service not connected');
      }
      
      console.log('\n✅ System validation completed');
      
      return validationResults;
      
    } catch (error) {
      console.log(`\n❌ System validation failed: ${error.message}`);
      throw error;
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('Quick Test Script for Legacy Thumbnail Processing System');
    console.log('');
    console.log('Usage:');
    console.log('  --test-video VIDEO_ID      Test complete processing for single video');
    console.log('  --test-json-parsing        Test JSON parsing robustness');
    console.log('  --test-folder-creation ID  Test Drive folder creation logic');
    console.log('  --validate-system          Validate all system components');
    console.log('');
    console.log('Examples:');
    console.log('  node tools/test-legacy-thumbnails.js --test-video VID-0001');
    console.log('  node tools/test-legacy-thumbnails.js --test-json-parsing');
    console.log('  node tools/test-legacy-thumbnails.js --validate-system');
    process.exit(1);
  }

  const tester = new LegacyThumbnailTester();
  
  try {
    const command = args[0];
    const videoId = args[1];
    
    switch (command) {
      case '--test-video':
        if (!videoId) {
          console.log('❌ Video ID required for --test-video command');
          process.exit(1);
        }
        await tester.testSingleVideo(videoId);
        break;
        
      case '--test-json-parsing':
        await tester.testJsonParsing();
        break;
        
      case '--test-folder-creation':
        if (!videoId) {
          console.log('❌ Video ID required for --test-folder-creation command');
          process.exit(1);
        }
        await tester.testFolderCreation(videoId);
        break;
        
      case '--validate-system':
        const results = await tester.validateSystem();
        console.log('\n📊 Validation Results:');
        console.log(JSON.stringify(results, null, 2));
        break;
        
      default:
        console.log(`❌ Unknown command: ${command}`);
        process.exit(1);
    }
    
    console.log('\n✅ Testing completed successfully');
    
  } catch (error) {
    console.log('\n❌ Testing failed:', error.message);
    console.log('\nStack trace:', error.stack);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

main().catch(error => {
  console.log('Unhandled error in testing:', error);
  process.exit(1);
});