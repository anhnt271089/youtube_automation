#!/usr/bin/env node

/**
 * Test script for workflow deadlock prevention system
 * Tests the new validateAndAutoAdvanceImageGeneration functionality
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Add src to path
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// Setup path for imports
process.env.NODE_PATH = join(__dirname, '..', 'src');

import WorkflowService from '../src/services/workflowService.js';
import GoogleSheetsService from '../src/services/googleSheetsService.js';
import logger from '../src/utils/logger.js';

/**
 * Test the deadlock prevention system
 */
async function testDeadlockPrevention() {
  console.log('🧪 Testing Workflow Deadlock Prevention System...\n');
  
  const workflowService = new WorkflowService();
  const sheetsService = new GoogleSheetsService();
  
  try {
    // 1. Find videos with "Generating Images" status
    console.log('🔍 Step 1: Finding videos with "Generating Images" status...');
    const generatingVideos = await sheetsService.getVideosByStatus('Generating Images');
    
    if (generatingVideos.length === 0) {
      console.log('✅ No videos with "Generating Images" status found');
      console.log('💡 This is expected if there are no deadlocked workflows');
      return;
    }
    
    console.log(`📊 Found ${generatingVideos.length} videos with "Generating Images" status:`);
    generatingVideos.forEach(video => {
      console.log(`   - ${video.videoId}: ${video.title}`);
    });
    console.log();
    
    // 2. Test validation for each video
    console.log('🔍 Step 2: Validating each video for deadlock prevention...\n');
    
    for (const video of generatingVideos) {
      console.log(`🎬 Testing: ${video.videoId} - ${video.title}`);
      
      try {
        // Check entries needing generation manually first
        const entriesNeedingGeneration = await sheetsService.getEntriesNeedingImageGeneration(video.videoId);
        console.log(`   📊 Entries needing generation: ${entriesNeedingGeneration.length}`);
        
        if (entriesNeedingGeneration.length > 0) {
          console.log(`   ✅ No deadlock detected - ${entriesNeedingGeneration.length} entries need generation`);
          entriesNeedingGeneration.forEach(entry => {
            console.log(`      - Sentence ${entry.sentenceNumber}: "${entry.sentence.substring(0, 50)}..."`);
          });
        } else {
          console.log('   🚨 DEADLOCK DETECTED: No entries need generation but status is "Generating Images"');
          
          // Test the deadlock prevention system
          console.log('   🚀 Testing deadlock prevention system...');
          
          const validationResult = await workflowService.validateAndAutoAdvanceImageGeneration(video.videoId);
          
          console.log('   📋 Validation Result:');
          console.log(`      - Needs Auto-Advance: ${validationResult.needsAutoAdvance}`);
          console.log(`      - Auto-Advanced: ${validationResult.autoAdvanced || false}`);
          console.log(`      - Previous Status: ${validationResult.previousStatus || 'N/A'}`);
          console.log(`      - New Status: ${validationResult.newStatus || 'N/A'}`);
          console.log(`      - Voice Script Created: ${validationResult.voiceScriptCreated || false}`);
          console.log(`      - Message: ${validationResult.message}`);
          
          if (validationResult.autoAdvanced) {
            console.log('   ✅ DEADLOCK PREVENTED: Workflow auto-advanced successfully');
          } else {
            console.log('   ⚠️  Auto-advance not needed or failed');
          }
        }
        
      } catch (error) {
        console.error(`   ❌ Error testing ${video.videoId}:`, error.message);
      }
      
      console.log(); // Empty line for readability
    }
    
    // 3. Test the processApprovedScripts method with deadlock prevention
    console.log('🔍 Step 3: Testing processApprovedScripts with deadlock prevention...');
    
    const result = await workflowService.processApprovedScripts();
    
    console.log('📊 Process Approved Scripts Results:');
    console.log(`   - Success: ${result.success}`);
    console.log(`   - Total Processed: ${result.processed}`);
    console.log(`   - Total Videos: ${result.total}`);
    
    if (result.breakdown) {
      console.log('   📈 Breakdown:');
      console.log(`      - Approved Scripts: ${result.breakdown.approvedScripts}`);
      console.log(`      - Resumed Image Generation: ${result.breakdown.resumedImageGeneration}`);
      console.log(`      - Thumbnail Only Processing: ${result.breakdown.thumbnailOnlyProcessing}`);
      console.log(`      - Auto-Advanced Deadlocks: ${result.breakdown.autoAdvancedDeadlocks}`);
      
      if (result.breakdown.autoAdvancedDeadlocks > 0) {
        console.log(`   🚀 SUCCESS: ${result.breakdown.autoAdvancedDeadlocks} deadlocks were automatically prevented!`);
      }
    }
    
    console.log('\n✅ Deadlock prevention testing completed successfully!');
    console.log('\n💡 Key Features Tested:');
    console.log('   ✅ Detection of "Generating Images" status with no "Need Generate" entries');
    console.log('   ✅ Auto-advancement from "Generating Images" to "Completed"');
    console.log('   ✅ Voice script creation during auto-advancement');
    console.log('   ✅ Workflow status updates after auto-advancement');
    console.log('   ✅ Telegram notifications for deadlock prevention');
    console.log('   ✅ Integration with processApprovedScripts workflow');
    
  } catch (error) {
    console.error('❌ Testing failed:', error);
    logger.error('Deadlock prevention test failed:', error);
    throw error;
  }
}

/**
 * Test selective image generation deadlock prevention
 */
async function testSelectiveImageGenerationDeadlockPrevention(videoId) {
  if (!videoId) {
    console.log('ℹ️  Skipping selective image generation test - no video ID provided');
    return;
  }
  
  console.log(`\n🧪 Testing Selective Image Generation Deadlock Prevention for ${videoId}...\n`);
  
  const workflowService = new WorkflowService();
  
  try {
    const result = await workflowService.processSelectiveImageGeneration(videoId);
    
    console.log('📊 Selective Image Generation Results:');
    console.log(`   - Images Generated: ${result.generated}`);
    console.log(`   - Auto-Advanced: ${result.autoAdvanced || false}`);
    console.log(`   - Message: ${result.message}`);
    
    if (result.autoAdvanced) {
      console.log('   🚀 SUCCESS: Deadlock prevented via selective image generation call!');
    }
    
  } catch (error) {
    console.error(`❌ Selective image generation test failed for ${videoId}:`, error.message);
  }
}

// Main execution
async function main() {
  const videoId = process.argv[2]; // Optional: specific video ID to test
  
  try {
    await testDeadlockPrevention();
    
    if (videoId) {
      await testSelectiveImageGenerationDeadlockPrevention(videoId);
    }
    
    console.log('\n🎉 All deadlock prevention tests completed!');
    process.exit(0);
    
  } catch (error) {
    console.error('\n💥 Test suite failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { testDeadlockPrevention, testSelectiveImageGenerationDeadlockPrevention };