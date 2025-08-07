#!/usr/bin/env node

import dotenv from 'dotenv';
import WorkflowService from './src/services/workflowService.js';
import logger from './src/utils/logger.js';
import { validateConfig } from './config/config.js';
import { TEST_SCENARIOS, TEST_VIDEOS } from './src/test-data/beyondBeingTestData.js';

dotenv.config();

class SingleRunTest {
  constructor() {
    this.workflowService = new WorkflowService();
  }

  async initialize() {
    try {
      console.log('🚀 Initializing Single Run Test System...');
      
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

  async runHealthCheck() {
    console.log('\n🔍 Running Health Check...');
    try {
      const result = await this.workflowService.processHealthCheck();
      console.log('Health Check Results:', result);
      return result;
    } catch (error) {
      console.error('❌ Health check failed:', error.message);
      return { healthy: false, error: error.message };
    }
  }

  async runNewVideosProcessing() {
    console.log('\n📥 Processing New Videos...');
    try {
      const result = await this.workflowService.processNewVideos();
      console.log('New Videos Processing Results:', result);
      return result;
    } catch (error) {
      console.error('❌ New videos processing failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  async runApprovedScriptsProcessing() {
    console.log('\n✅ Processing Approved Scripts...');
    try {
      const result = await this.workflowService.processApprovedScripts();
      console.log('Approved Scripts Processing Results:', result);
      return result;
    } catch (error) {
      console.error('❌ Approved scripts processing failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  // Video generation removed - handled manually outside this automated flow

  async runTimeoutCleanup() {
    console.log('\n⏰ Running Timeout Cleanup...');
    try {
      const result = await this.workflowService.processTimeouts();
      console.log('Timeout Cleanup Results:', result);
      return result;
    } catch (error) {
      console.error('❌ Timeout cleanup failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  async runReadyForReview() {
    console.log('\n📋 Processing Ready for Review Videos...');
    try {
      const result = await this.workflowService.processReadyForReview();
      console.log('Ready for Review Processing Results:', result);
      return result;
    } catch (error) {
      console.error('❌ Ready for review processing failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  async runErrorVideos() {
    console.log('\n🔄 Processing Error Videos for Retry...');
    try {
      const result = await this.workflowService.processErrorVideos();
      console.log('Error Videos Processing Results:', result);
      return result;
    } catch (error) {
      console.error('❌ Error videos processing failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  async processSingleVideo(youtubeUrl) {
    console.log(`\n🎯 Processing Single Video: ${youtubeUrl}`);
    try {
      const result = await this.workflowService.processSingleVideo(youtubeUrl);
      console.log('Single Video Processing Results:', result);
      return result;
    } catch (error) {
      console.error('❌ Single video processing failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  async runAllServices() {
    console.log('\n🔄 Running All Services Once...\n');
    
    const results = {
      healthCheck: null,
      newVideos: null,
      approvedScripts: null,
      readyForReview: null,
      errorVideos: null,
      timeoutCleanup: null
    };

    // Run each service once (video generation handled manually outside automated flow)
    results.healthCheck = await this.runHealthCheck();
    results.newVideos = await this.runNewVideosProcessing();
    results.approvedScripts = await this.runApprovedScriptsProcessing();
    results.readyForReview = await this.runReadyForReview();
    results.errorVideos = await this.runErrorVideos();
    results.timeoutCleanup = await this.runTimeoutCleanup();

    return results;
  }

  displaySummary(results) {
    console.log('\n📊 EXECUTION SUMMARY');
    console.log('==================');
    
    Object.entries(results).forEach(([service, result]) => {
      const status = result?.healthy !== undefined 
        ? (result.healthy ? '✅' : '❌')
        : (result?.success !== false ? '✅' : '❌');
      
      console.log(`${status} ${service}: ${JSON.stringify(result, null, 2)}`);
    });
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const videoUrl = args[1];

  const testRunner = new SingleRunTest();

  try {
    await testRunner.initialize();

    let results;

    switch (command) {
      case 'health':
        results = await testRunner.runHealthCheck();
        break;
        
      case 'new-videos':
        results = await testRunner.runNewVideosProcessing();
        break;
        
      case 'approved-scripts':
        results = await testRunner.runApprovedScriptsProcessing();
        break;
        
      // video-generation removed - handled manually outside automated flow
        
      case 'timeout-cleanup':
        results = await testRunner.runTimeoutCleanup();
        break;
        
      case 'ready-for-review':
        results = await testRunner.runReadyForReview();
        break;
        
      case 'error-videos':
        results = await testRunner.runErrorVideos();
        break;
        
      case 'single-video':
        if (!videoUrl) {
          console.error('❌ Please provide a YouTube URL for single video processing');
          console.log('Usage: node test-single-run.js single-video <youtube_url>');
          console.log('');
          console.log('🎬 BeyondBeing sample URLs:');
          TEST_VIDEOS.slice(0, 3).forEach((video, index) => {
            console.log(`  ${index + 1}. ${video.youtubeUrl} (${video.viewCount.toLocaleString()} views)`);
          });
          process.exit(1);
        }
        results = await testRunner.processSingleVideo(videoUrl);
        break;
        
      case 'all':
      default:
        results = await testRunner.runAllServices();
        testRunner.displaySummary(results);
        break;
    }

    if (command !== 'all') {
      console.log('\n📊 Results:', JSON.stringify(results, null, 2));
    }

    console.log('\n🎉 Single run test completed!');
    process.exit(0);

  } catch (error) {
    console.error('💥 Fatal error:', error.message);
    logger.error('Single run test failed:', error);
    process.exit(1);
  }
}

// Show usage if no arguments
if (process.argv.length === 2) {
  console.log(`
🔧 YouTube Automation Single Run Test Script

Usage:
  node test-single-run.js [command] [options]

Commands:
  all                    Run all services once (default)
  health                 Run health check only
  new-videos            Process new videos from Notion
  approved-scripts      Process videos with approved scripts
  ready-for-review      Process videos ready for human review
  error-videos          Test error recovery and retry system
  timeout-cleanup       Clean up timed out processes
  single-video <url>    Process a specific YouTube URL
  
Note: Video generation is handled manually outside the automated flow

Examples:
  node test-single-run.js
  node test-single-run.js all
  node test-single-run.js health
  node test-single-run.js new-videos
  node test-single-run.js single-video ${TEST_SCENARIOS.WORKFLOW_TESTING.primaryUrl}

🎬 BeyondBeing Test Videos:
  Top Performer:    ${TEST_VIDEOS[0].youtubeUrl} (${TEST_VIDEOS[0].viewCount.toLocaleString()} views)
  Second Best:      ${TEST_VIDEOS[1].youtubeUrl} (${TEST_VIDEOS[1].viewCount.toLocaleString()} views)
  Quick Test:       ${TEST_SCENARIOS.WORKFLOW_TESTING.quickTestUrl} (${TEST_VIDEOS[4].viewCount.toLocaleString()} views)

Options:
  --help               Show this help message
`);
  process.exit(0);
}

// Run the main function
main();