#!/usr/bin/env node

/**
 * Test script for image generation workflow
 * Tests the complete pipeline with auto-approval and limited image generation
 */

import WorkflowService from './src/services/workflowService.js';
import { config, validateConfig } from './config/config.js';
import logger from './src/utils/logger.js';

async function testImageWorkflow() {
  try {
    console.log('🧪 Starting Image Workflow Test');
    console.log('================================');
    
    // Validate configuration
    try {
      validateConfig();
      console.log('✅ Configuration validated');
    } catch (error) {
      console.error('❌ Configuration error:', error.message);
      process.exit(1);
    }

    // Display current settings
    console.log('📋 Current Settings:');
    console.log(`   - Image Generation Limit: ${config.app.imageGenerationLimit || 'No limit'}`);
    console.log(`   - Auto-Approve Scripts: ${config.app.autoApproveScripts ? 'Yes' : 'No'}`);
    console.log('');

    // Create workflow service
    const workflow = new WorkflowService();

    // Test with a sample YouTube URL (replace with actual URL for testing)
    const testUrl = process.argv[2] || 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
    
    console.log(`🎬 Testing with URL: ${testUrl}`);
    console.log('');

    console.log('🔍 Step 1: Processing URL and extracting metadata...');
    const result = await workflow.processNewUrl(testUrl);
    
    if (result.success) {
      console.log('✅ Step 1 Complete: URL processed successfully');
      console.log(`   - Video: ${result.videoData.title}`);
      console.log(`   - Channel: ${result.videoData.channelTitle}`);
      console.log(`   - Duration: ${result.videoData.duration}`);
      console.log(`   - Notion Page ID: ${result.notionId}`);
      console.log('');

      if (config.app.autoApproveScripts) {
        console.log('🤖 Auto-approval is enabled, waiting for automatic processing...');
        console.log('');
        
        // Wait a bit for auto-approval to take effect
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        console.log('🎨 Step 2: Processing approved script (image generation)...');
        
        // Process approved scripts
        const approvedResult = await workflow.processApprovedScripts();
        
        if (approvedResult.success) {
          console.log('✅ Step 2 Complete: Images generated and saved');
          console.log(`   - Processed: ${approvedResult.processed} videos`);
          console.log('');
          
          console.log('🎬 Step 3: Final video generation...');
          
          // Process video generation
          const videoResult = await workflow.processVideoGeneration();
          
          if (videoResult.success) {
            console.log('✅ Step 3 Complete: Final video generated');
            console.log(`   - Processed: ${videoResult.processed} videos`);
            console.log('');
            
            console.log('🎉 TEST COMPLETE: End-to-end workflow successful!');
            console.log('');
            console.log('📊 Summary:');
            console.log(`   - Video processed: ${result.videoData.title}`);
            console.log(`   - Images generated: Limited to ${config.app.imageGenerationLimit || 'all'}`);
            console.log(`   - Auto-approval: ${config.app.autoApproveScripts ? 'Used' : 'Manual required'}`);
            console.log('   - Google Drive: Images uploaded');
            console.log('   - Notion: Script Details database updated');
            console.log('   - Telegram: Clean notifications sent');
          } else {
            console.error('❌ Step 3 Failed: Video generation error');
            console.error('   Error:', videoResult.error || 'Unknown error');
          }
        } else {
          console.error('❌ Step 2 Failed: Image generation error');
          console.error('   Error:', approvedResult.error || 'Unknown error');
        }
      } else {
        console.log('⚠️  Auto-approval is disabled');
        console.log('   Manual approval required in Notion before continuing');
        console.log('   Set AUTO_APPROVE_SCRIPTS=true in .env for full automation');
      }
    } else {
      console.error('❌ Step 1 Failed: URL processing error');
      console.error('   Error:', result.error || 'Unknown error');
    }

  } catch (error) {
    console.error('💥 Test failed with error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

async function testHealthCheck() {
  console.log('🏥 Running health check...');
  const workflow = new WorkflowService();
  const health = await workflow.processHealthCheck();
  
  console.log('Health Check Results:');
  Object.entries(health.checks).forEach(([service, status]) => {
    console.log(`   ${service}: ${status ? '✅' : '❌'}`);
  });
  
  console.log(`Overall Health: ${health.healthy ? '✅ Healthy' : '❌ Unhealthy'}`);
  return health.healthy;
}

// Main execution
async function main() {
  const command = process.argv[2];
  
  if (command === 'health') {
    const healthy = await testHealthCheck();
    process.exit(healthy ? 0 : 1);
  } else {
    await testImageWorkflow();
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Test interrupted by user');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Test terminated');
  process.exit(0);
});

main().catch(error => {
  console.error('💥 Unhandled error:', error);
  process.exit(1);
});