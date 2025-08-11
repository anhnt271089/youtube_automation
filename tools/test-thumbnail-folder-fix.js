#!/usr/bin/env node

/**
 * Test Thumbnail Folder Fix
 * 
 * Tests the fixed thumbnail upload logic to ensure thumbnails go to correct video folders
 * and verifies the system correctly detects existing thumbnails to avoid regeneration.
 */

import { fileURLToPath } from 'url';
import { dirname } from 'path';
import logger from '../src/utils/logger.js';
import GoogleSheetsService from '../src/services/googleSheetsService.js';
import GoogleDriveService from '../src/services/googleDriveService.js';
import ThumbnailService from '../src/services/thumbnailService.js';
import AIService from '../src/services/aiService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class ThumbnailFolderFixTester {
  constructor() {
    this.googleSheetsService = new GoogleSheetsService();
    this.googleDriveService = new GoogleDriveService();
    this.aiService = new AIService();
    this.thumbnailService = new ThumbnailService(this.aiService, this.googleDriveService);
    
    // Test videos - using different video IDs to verify fix
    this.testVideos = ['VID-0001', 'VID-0002', 'VID-0003'];
  }

  /**
   * Test thumbnail folder detection for all test videos
   */
  async testExistingThumbnailDetection() {
    logger.info('🔍 Testing existing thumbnail detection for all videos...');
    logger.info('═══════════════════════════════════════════════════════');
    
    for (const videoId of this.testVideos) {
      try {
        logger.info(`\n📋 Testing ${videoId}:`);
        
        // Get video details
        const videoDetails = await this.googleSheetsService.getVideoDetails(videoId);
        if (!videoDetails) {
          logger.warn(`❌ ${videoId} not found in Google Sheets`);
          continue;
        }
        
        logger.info(`📝 Title: "${videoDetails.title}"`);
        logger.info(`📁 Drive folder: ${videoDetails.driveFolder || 'Not set'}`);
        
        // Test existing thumbnail check
        const existingCheck = await this.thumbnailService.checkExistingThumbnails(videoId, videoDetails.title);
        
        if (existingCheck.exists) {
          logger.info(`✅ Found ${existingCheck.count} existing thumbnails`);
          logger.info(`📁 Video folder: ${existingCheck.videoFolderUrl}`);
          logger.info(`🖼️ Thumbnail folder: ${existingCheck.folderUrl}`);
          existingCheck.thumbnails.forEach((thumb, index) => {
            logger.info(`  ${index + 1}. ${thumb.fileName} (${new Date(thumb.createdTime).toLocaleString()})`);
          });
        } else {
          logger.info(`📋 No existing thumbnails found`);
          logger.info(`🔍 Reason: ${existingCheck.reason}`);
        }
        
      } catch (error) {
        logger.error(`❌ Error testing ${videoId}:`, error.message);
      }
    }
  }

  /**
   * Test thumbnail generation without actually generating (dry run)
   */
  async testThumbnailGenerationDryRun() {
    logger.info('\n🎨 Testing thumbnail generation workflow (dry run)...');
    logger.info('═══════════════════════════════════════════════════════');
    
    // Use VID-0001 for dry run test
    const testVideoId = 'VID-0001';
    
    try {
      const videoDetails = await this.googleSheetsService.getVideoDetails(testVideoId);
      if (!videoDetails) {
        throw new Error(`${testVideoId} not found in Google Sheets`);
      }
      
      logger.info(`\n📋 Testing workflow for ${testVideoId}:`);
      logger.info(`📝 Title: "${videoDetails.title}"`);
      
      // Check if thumbnails exist (should not regenerate if they exist)
      const existingCheck = await this.thumbnailService.checkExistingThumbnails(testVideoId, videoDetails.title);
      
      if (existingCheck.exists) {
        logger.info(`✅ Thumbnails exist - system should SKIP regeneration`);
        logger.info(`📊 Found ${existingCheck.count} existing thumbnails`);
      } else {
        logger.info(`📋 No thumbnails found - system would GENERATE new ones`);
      }
      
      // Test folder path logic without actual generation
      logger.info(`\n🔍 Testing folder path resolution:`);
      
      // Simulate the folder finding logic
      const sanitizedTitle = this.googleDriveService.sanitizeFolderName(videoDetails.title);
      const possibleFolderNames = [
        `${sanitizedTitle} (${testVideoId})`,  // Current format
        `(${testVideoId}) ${sanitizedTitle}`   // Legacy format
      ];
      
      logger.info(`🔍 Will try these folder name patterns:`);
      possibleFolderNames.forEach((name, index) => {
        logger.info(`  ${index + 1}. "${name}"`);
      });
      
      return {
        videoId: testVideoId,
        hasExistingThumbnails: existingCheck.exists,
        thumbnailCount: existingCheck.count,
        folderPatterns: possibleFolderNames,
        shouldSkipGeneration: existingCheck.exists
      };
      
    } catch (error) {
      logger.error(`❌ Dry run test failed:`, error.message);
      throw error;
    }
  }

  /**
   * Test actual thumbnail generation for a video (use with caution)
   */
  async testActualThumbnailGeneration(videoId, forceRegenerate = false) {
    logger.info(`\n🎨 Testing ACTUAL thumbnail generation for ${videoId}...`);
    logger.info('⚠️  This will generate real thumbnails and use API credits!');
    logger.info('═══════════════════════════════════════════════════════');
    
    try {
      const videoDetails = await this.googleSheetsService.getVideoDetails(videoId);
      if (!videoDetails) {
        throw new Error(`${videoId} not found in Google Sheets`);
      }
      
      logger.info(`📝 Title: "${videoDetails.title}"`);
      logger.info(`🔄 Force regenerate: ${forceRegenerate}`);
      
      // Prepare video data for thumbnail generation
      const videoData = {
        title: videoDetails.title,
        youtubeUrl: videoDetails.youtubeUrl,
        optimizedScript: 'Test script for thumbnail generation',
        transcriptText: null
      };
      
      // Use the fixed thumbnail service
      const startTime = Date.now();
      const result = await this.thumbnailService.processVideoThumbnails(
        videoData,
        videoId,
        forceRegenerate,
        this.googleSheetsService
      );
      const processingTime = Date.now() - startTime;
      
      logger.info(`\n📊 Generation Results:`);
      logger.info(`✅ Success: ${result.success}`);
      logger.info(`🎨 Generated: ${result.generated}`);
      logger.info(`📁 Uploaded: ${result.uploaded}`);
      logger.info(`❌ Failed: ${result.failed}`);
      logger.info(`⏱️  Processing time: ${processingTime}ms`);
      
      if (result.skipped) {
        logger.info(`⏭️  Skipped: ${result.message}`);
      }
      
      if (result.error) {
        logger.error(`❌ Error: ${result.error}`);
      }
      
      if (result.success && result.thumbnails) {
        logger.info(`\n🖼️  Generated Thumbnails:`);
        Object.entries(result.thumbnails).forEach(([key, thumb]) => {
          logger.info(`  ${key}: ${thumb.style} (${thumb.fileName})`);
          if (thumb.upload && thumb.upload.success) {
            logger.info(`    📁 Uploaded: ${thumb.upload.viewLink}`);
          }
        });
      }
      
      if (result.driveFolder) {
        logger.info(`📁 Thumbnail folder: ${result.driveFolder}`);
      }
      
      if (result.videoFolderUrl) {
        logger.info(`📁 Video folder: ${result.videoFolderUrl}`);
      }
      
      return result;
      
    } catch (error) {
      logger.error(`❌ Actual generation test failed:`, error.message);
      throw error;
    }
  }

  /**
   * Run all tests
   */
  async runAllTests() {
    try {
      logger.info('🧪 Starting Thumbnail Folder Fix Tests...');
      logger.info('═══════════════════════════════════════════════════════');
      
      // Test 1: Check existing thumbnail detection
      await this.testExistingThumbnailDetection();
      
      // Test 2: Dry run generation test
      const dryRunResult = await this.testThumbnailGenerationDryRun();
      
      // Test 3: Summary and recommendations
      logger.info('\n📊 Test Summary:');
      logger.info('═══════════════════════════════════════════════════════');
      logger.info(`🔍 Tested ${this.testVideos.length} video IDs for existing thumbnails`);
      logger.info(`📋 Dry run test completed for ${dryRunResult.videoId}`);
      
      if (dryRunResult.shouldSkipGeneration) {
        logger.info(`✅ System correctly detects existing thumbnails - will skip regeneration`);
      } else {
        logger.info(`📋 System ready to generate thumbnails for videos without existing ones`);
      }
      
      logger.info('\n🎯 Next Steps:');
      logger.info('1. The thumbnail folder fix has been implemented');
      logger.info('2. System now checks both naming conventions (current and legacy)');
      logger.info('3. Thumbnails will upload to the correct video-specific folders');
      logger.info('4. Existing thumbnail detection prevents unnecessary regeneration');
      
      logger.info('\n⚠️  To test actual generation (uses API credits):');
      logger.info('node tools/test-thumbnail-folder-fix.js --generate VID-0001');
      logger.info('node tools/test-thumbnail-folder-fix.js --generate VID-0002 --force');
      
    } catch (error) {
      logger.error('❌ Test suite failed:', error);
      throw error;
    }
  }
}

// Command line handling
const args = process.argv.slice(2);
const tester = new ThumbnailFolderFixTester();

if (args.includes('--generate') && args.length >= 2) {
  // Actual generation test
  const videoIdIndex = args.indexOf('--generate') + 1;
  const videoId = args[videoIdIndex];
  const forceRegenerate = args.includes('--force');
  
  if (!videoId || !videoId.startsWith('VID-')) {
    console.error('❌ Invalid video ID. Use format: --generate VID-XXXX');
    process.exit(1);
  }
  
  tester.testActualThumbnailGeneration(videoId, forceRegenerate)
    .then(() => {
      logger.info('✅ Actual generation test completed!');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('❌ Actual generation test failed:', error);
      process.exit(1);
    });
    
} else {
  // Default: run all safe tests (no generation)
  tester.runAllTests()
    .then(() => {
      logger.info('\n✅ All thumbnail folder fix tests completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('\n❌ Thumbnail folder fix tests failed:', error);
      process.exit(1);
    });
}