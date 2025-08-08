#!/usr/bin/env node

import dotenv from 'dotenv';
import WorkflowService from '../../src/services/workflowService.js';
import NotionService from '../../src/services/notionService.js';
import logger from '../../src/utils/logger.js';
import { validateConfig } from '../../config/config.js';
import { TEST_SCENARIOS, TEST_VIDEOS } from '../../src/test-data/beyondBeingTestData.js';

dotenv.config();

class CompleteWorkflowTest {
  constructor() {
    this.workflowService = new WorkflowService();
    this.notionService = new NotionService();
  }

  async initialize() {
    try {
      console.log('🚀 Initializing Complete Workflow Test System...');
      
      // Validate configuration
      validateConfig();
      console.log('✅ Configuration validated');

      // Create necessary directories
      await this.createDirectories();
      console.log('✅ Directories created');

      return true;
    } catch (error) {
      console.error('❌ Failed to initialize:', error.message);
      throw error;
    }
  }

  async createDirectories() {
    const fs = await import('fs');
    const directories = ['./logs', './temp', './output'];
    
    directories.forEach(dir => {
      if (!fs.default.existsSync(dir)) {
        fs.default.mkdirSync(dir, { recursive: true });
      }
    });
  }

  async runCompleteWorkflow(youtubeUrl, autoApprove = true) {
    try {
      console.log(`\n🎯 Starting Complete End-to-End Workflow`);
      console.log(`📹 Video URL: ${youtubeUrl}`);
      console.log(`🔄 Auto-approval: ${autoApprove ? 'ENABLED' : 'DISABLED'}`);
      console.log(`⏰ Started at: ${new Date().toISOString()}\n`);

      const results = {
        startTime: Date.now(),
        stages: {},
        finalAssets: {},
        errors: []
      };

      // Stage 1: Initial Processing (URL → Script Generation)
      console.log('📍 STAGE 1: Initial Video Processing');
      console.log('─────────────────────────────────────');
      try {
        console.log('🔄 Processing YouTube URL...');
        const initialResult = await this.workflowService.processSingleVideo(youtubeUrl);
        results.stages.initialProcessing = {
          success: true,
          duration: Date.now() - results.startTime,
          data: initialResult
        };
        console.log('✅ Stage 1 completed successfully');
        console.log(`   💾 Notion ID: ${initialResult.notionId}`);
        console.log(`   📝 Video Title: ${initialResult.videoData.title}`);
        console.log(`   ⏱️  Duration: ${Math.round((Date.now() - results.startTime) / 1000)}s\n`);
      } catch (error) {
        console.error('❌ Stage 1 failed:', error.message);
        results.stages.initialProcessing = { success: false, error: error.message };
        results.errors.push(`Stage 1: ${error.message}`);
        throw error;
      }

      // Stage 2: Wait and Auto-Approve (if enabled)
      if (autoApprove) {
        console.log('📍 STAGE 2: Auto-Approval Process');
        console.log('─────────────────────────────────────');
        try {
          console.log('⏳ Waiting 10 seconds for script generation to complete...');
          await this.sleep(10000);

          console.log('🔄 Finding video with Script Generated status...');
          const scriptGeneratedVideos = await this.notionService.getVideosByStatus('Script Generated');
          
          if (scriptGeneratedVideos.length === 0) {
            throw new Error('No videos found with Script Generated status');
          }

          const targetVideo = scriptGeneratedVideos.find(v => 
            v.youtubeUrl === youtubeUrl || 
            v.youtubeVideoId === this.extractVideoId(youtubeUrl)
          );

          if (!targetVideo) {
            throw new Error('Target video not found in Script Generated status');
          }

          console.log(`🎯 Found target video: ${targetVideo.title}`);
          console.log('🔄 Auto-approving script...');
          
          await this.notionService.userUpdateVideoProperties(targetVideo.id, {
            'Script Approved': true
          });

          console.log('✅ Script auto-approved successfully');
          console.log('🔄 Updating status to Approved...');
          
          await this.notionService.updateVideoStatus(targetVideo.id, 'Approved');
          
          results.stages.autoApproval = {
            success: true,
            videoId: targetVideo.id,
            duration: Date.now() - results.startTime
          };
          
          console.log('✅ Stage 2 completed successfully');
          console.log(`   ⏱️  Total Duration: ${Math.round((Date.now() - results.startTime) / 1000)}s\n`);
          
        } catch (error) {
          console.error('❌ Stage 2 failed:', error.message);
          results.stages.autoApproval = { success: false, error: error.message };
          results.errors.push(`Stage 2: ${error.message}`);
          throw error;
        }
      }

      // Stage 3: Process Approved Scripts (Image Generation)
      console.log('📍 STAGE 3: Approved Script Processing');
      console.log('─────────────────────────────────────');
      try {
        console.log('⏳ Waiting 5 seconds for approval to process...');
        await this.sleep(5000);
        
        console.log('🔄 Processing approved scripts...');
        const approvedResult = await this.workflowService.processApprovedScripts();
        
        results.stages.approvedScripts = {
          success: true,
          duration: Date.now() - results.startTime,
          data: approvedResult
        };
        
        console.log('✅ Stage 3 completed successfully');
        console.log(`   📊 Processed: ${approvedResult.processed} videos`);
        console.log(`   ⏱️  Total Duration: ${Math.round((Date.now() - results.startTime) / 1000)}s\n`);
        
      } catch (error) {
        console.error('❌ Stage 3 failed:', error.message);
        results.stages.approvedScripts = { success: false, error: error.message };
        results.errors.push(`Stage 3: ${error.message}`);
        throw error;
      }

      // Stage 4: Video Generation
      console.log('📍 STAGE 4: Video Generation');
      console.log('─────────────────────────────────────');
      try {
        console.log('⏳ Waiting 10 seconds for image generation to complete...');
        await this.sleep(10000);
        
        console.log('🔄 Running video generation...');
        const videoGenResult = await this.workflowService.processVideoGeneration();
        
        results.stages.videoGeneration = {
          success: true,
          duration: Date.now() - results.startTime,
          data: videoGenResult
        };
        
        console.log('✅ Stage 4 completed successfully');
        console.log(`   📊 Generated: ${videoGenResult.processed} videos`);
        console.log(`   ⏱️  Total Duration: ${Math.round((Date.now() - results.startTime) / 1000)}s\n`);
        
      } catch (error) {
        console.error('❌ Stage 4 failed:', error.message);
        results.stages.videoGeneration = { success: false, error: error.message };
        results.errors.push(`Stage 4: ${error.message}`);
        throw error;
      }

      // Stage 5: Final Asset Collection
      console.log('📍 STAGE 5: Final Asset Collection');
      console.log('─────────────────────────────────────');
      try {
        console.log('🔄 Collecting final assets and results...');
        
        // Get the processed video data
        const finalVideo = await this.findVideoByUrl(youtubeUrl);
        if (finalVideo) {
          results.finalAssets = {
            notionPageId: finalVideo.id,
            title: finalVideo.title,
            status: finalVideo.status,
            optimizedTitle: finalVideo.optimizedTitle,
            driveFolder: finalVideo.driveFolder,
            thumbnail: finalVideo.thumbnail,
            totalSentences: finalVideo.totalSentences,
            completedSentences: finalVideo.completedSentences
          };
        }

        results.stages.assetCollection = {
          success: true,
          duration: Date.now() - results.startTime
        };
        
        console.log('✅ Stage 5 completed successfully');
        console.log(`   ⏱️  Total Duration: ${Math.round((Date.now() - results.startTime) / 1000)}s\n`);
        
      } catch (error) {
        console.error('❌ Stage 5 failed:', error.message);
        results.stages.assetCollection = { success: false, error: error.message };
        results.errors.push(`Stage 5: ${error.message}`);
      }

      // Calculate total duration
      results.totalDuration = Date.now() - results.startTime;
      results.endTime = new Date().toISOString();

      return results;

    } catch (error) {
      logger.error('Complete workflow failed:', error);
      throw error;
    }
  }

  async findVideoByUrl(youtubeUrl) {
    try {
      const videoId = this.extractVideoId(youtubeUrl);
      const allVideos = await this.notionService.getAllVideos();
      return allVideos.find(v => 
        v.youtubeUrl === youtubeUrl || 
        v.youtubeVideoId === videoId
      );
    } catch (error) {
      logger.error('Error finding video by URL:', error);
      return null;
    }
  }

  extractVideoId(url) {
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/);
    return match ? match[1] : null;
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  displayResults(results) {
    const duration = Math.round(results.totalDuration / 1000);
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;

    console.log('\n🎉 COMPLETE WORKFLOW RESULTS');
    console.log('═════════════════════════════════════');
    console.log(`⏱️  Total Duration: ${minutes}m ${seconds}s`);
    console.log(`🕐 Started: ${new Date(results.startTime).toLocaleString()}`);
    console.log(`🕕 Ended: ${results.endTime}`);
    console.log(`❌ Errors: ${results.errors.length}`);

    console.log('\n📊 STAGE BREAKDOWN:');
    Object.entries(results.stages).forEach(([stage, data], index) => {
      const stageNum = index + 1;
      const status = data.success ? '✅' : '❌';
      const stageDuration = Math.round(data.duration / 1000);
      console.log(`${stageNum}. ${status} ${stage}: ${stageDuration}s`);
      if (!data.success && data.error) {
        console.log(`   💥 Error: ${data.error}`);
      }
    });

    if (results.finalAssets && Object.keys(results.finalAssets).length > 0) {
      console.log('\n🎬 FINAL ASSETS:');
      console.log(`📄 Notion Page: ${results.finalAssets.notionPageId}`);
      console.log(`📝 Title: ${results.finalAssets.title}`);
      console.log(`🎯 Optimized Title: ${results.finalAssets.optimizedTitle}`);
      console.log(`📊 Status: ${results.finalAssets.status}`);
      console.log(`📁 Drive Folder: ${results.finalAssets.driveFolder || 'Not available'}`);
      console.log(`🖼️  Thumbnail: ${results.finalAssets.thumbnail || 'Not available'}`);
      console.log(`📈 Script Progress: ${results.finalAssets.completedSentences}/${results.finalAssets.totalSentences}`);
    }

    if (results.errors.length > 0) {
      console.log('\n⚠️  ERRORS ENCOUNTERED:');
      results.errors.forEach((error, index) => {
        console.log(`${index + 1}. ${error}`);
      });
    }

    console.log('\n🎯 WORKFLOW STATUS:', results.errors.length === 0 ? '✅ SUCCESS' : '⚠️  PARTIAL SUCCESS');
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  const youtubeUrl = args[0];
  const autoApprove = args[1] !== 'false'; // Default to true unless explicitly set to false

  if (!youtubeUrl) {
    console.log(`
🎬 YouTube Automation Complete Workflow Test

Usage:
  node test-complete-workflow.js <youtube_url> [auto_approve]

Parameters:
  youtube_url     YouTube video URL to process
  auto_approve    Enable auto-approval (default: true, set to 'false' to disable)

Examples:
  # Run complete workflow with auto-approval (recommended for testing)
  node test-complete-workflow.js ${TEST_SCENARIOS.WORKFLOW_TESTING.primaryUrl}

  # Run workflow but stop at manual approval stage  
  node test-complete-workflow.js ${TEST_SCENARIOS.WORKFLOW_TESTING.primaryUrl} false

🎬 BeyondBeing Test Video URLs (from your channel data):
  • ${TEST_VIDEOS[0].youtubeUrl} (${TEST_VIDEOS[0].viewCount.toLocaleString()} views - "${TEST_VIDEOS[0].title}")
  • ${TEST_VIDEOS[1].youtubeUrl} (${TEST_VIDEOS[1].viewCount.toLocaleString()} views - "${TEST_VIDEOS[1].title}")
  • ${TEST_VIDEOS[2].youtubeUrl} (${TEST_VIDEOS[2].viewCount.toLocaleString()} views - "${TEST_VIDEOS[2].title}")

Workflow Stages:
  1. Initial Processing (YouTube data extraction, AI enhancement, script structure)
  2. Auto-Approval (automatic script approval for testing)
  3. Approved Script Processing (image generation, database updates)
  4. Video Generation (final video assembly and delivery)
  5. Asset Collection (gather all final results)

⚠️  This test will process a real video and consume API credits.
    Make sure all services are properly configured in your .env file.
`);
    process.exit(0);
  }

  const testRunner = new CompleteWorkflowTest();

  try {
    await testRunner.initialize();
    
    console.log('🚀 Starting Complete End-to-End Workflow Test');
    console.log(`🎯 Target Video: ${youtubeUrl}`);
    console.log(`🔧 Auto-Approval: ${autoApprove ? 'ENABLED' : 'DISABLED'}`);
    
    const results = await testRunner.runCompleteWorkflow(youtubeUrl, autoApprove);
    
    testRunner.displayResults(results);
    
    console.log('\n🎉 Complete workflow test finished!');
    process.exit(results.errors.length === 0 ? 0 : 1);

  } catch (error) {
    console.error('\n💥 Fatal workflow error:', error.message);
    logger.error('Complete workflow test failed:', error);
    process.exit(1);
  }
}

// Run the main function
main();