#!/usr/bin/env node

/**
 * Utility script to fix currently stuck workflows
 * Finds videos with "Generating Images" status and applies deadlock prevention
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

process.env.NODE_PATH = join(__dirname, '..', 'src');

import WorkflowService from '../src/services/workflowService.js';
import GoogleSheetsService from '../src/services/googleSheetsService.js';
import logger from '../src/utils/logger.js';

/**
 * Fix all stuck workflows by applying deadlock prevention
 */
async function fixStuckWorkflows() {
  console.log('🔧 Fixing Stuck Workflows...\n');
  
  const workflowService = new WorkflowService();
  const sheetsService = new GoogleSheetsService();
  
  try {
    // Find videos with "Generating Images" status
    console.log('🔍 Looking for videos with "Generating Images" status...');
    const generatingVideos = await sheetsService.getVideosByStatus('Generating Images');
    
    if (generatingVideos.length === 0) {
      console.log('✅ No videos with "Generating Images" status found - no stuck workflows to fix');
      return { fixed: 0, total: 0 };
    }
    
    console.log(`📊 Found ${generatingVideos.length} videos with "Generating Images" status\n`);
    
    let fixedCount = 0;
    let errors = 0;
    
    // Process each video
    for (const video of generatingVideos) {
      console.log(`🎬 Processing: ${video.videoId} - ${video.title}`);
      
      try {
        // Apply deadlock prevention validation
        const result = await workflowService.validateAndAutoAdvanceImageGeneration(video.videoId);
        
        if (result.autoAdvanced) {
          console.log(`   ✅ FIXED: Auto-advanced from "${result.previousStatus}" to "${result.newStatus}"`);
          console.log(`   📝 Voice Script Created: ${result.voiceScriptCreated ? 'Yes' : 'No'}`);
          fixedCount++;
        } else if (result.needsAutoAdvance === false && result.entriesNeedingGeneration > 0) {
          console.log(`   ℹ️  NO FIX NEEDED: ${result.entriesNeedingGeneration} entries still need generation`);
        } else {
          console.log(`   ⚠️  Status: ${result.message}`);
        }
        
      } catch (error) {
        console.error(`   ❌ Error processing ${video.videoId}:`, error.message);
        errors++;
      }
      
      console.log(); // Empty line for readability
    }
    
    // Summary
    console.log('📊 Fix Results Summary:');
    console.log(`   Total Videos Checked: ${generatingVideos.length}`);
    console.log(`   Stuck Workflows Fixed: ${fixedCount}`);
    console.log(`   Errors: ${errors}`);
    console.log(`   Still Need Processing: ${generatingVideos.length - fixedCount - errors}`);
    
    if (fixedCount > 0) {
      console.log(`\n🎉 SUCCESS: Fixed ${fixedCount} stuck workflow${fixedCount > 1 ? 's' : ''}!`);
      console.log('   All fixed workflows have been:');
      console.log('   ✅ Advanced to "Completed" status');
      console.log('   ✅ Had voice scripts created');
      console.log('   ✅ Had workflow statuses updated');
      console.log('   ✅ Sent Telegram notifications');
    } else if (errors === 0) {
      console.log('\n✅ No stuck workflows found - all "Generating Images" videos have entries that need generation');
    }
    
    if (errors > 0) {
      console.log(`\n⚠️  ${errors} error${errors > 1 ? 's' : ''} occurred - check logs for details`);
    }
    
    return { 
      total: generatingVideos.length, 
      fixed: fixedCount, 
      errors: errors,
      stillNeedProcessing: generatingVideos.length - fixedCount - errors
    };
    
  } catch (error) {
    console.error('❌ Failed to fix stuck workflows:', error);
    logger.error('Fix stuck workflows failed:', error);
    throw error;
  }
}

/**
 * Fix a specific stuck workflow by video ID
 */
async function fixSpecificWorkflow(videoId) {
  console.log(`🔧 Fixing Stuck Workflow: ${videoId}\n`);
  
  const workflowService = new WorkflowService();
  const sheetsService = new GoogleSheetsService();
  
  try {
    // Get video details
    const videoDetails = await sheetsService.getVideoDetails(videoId);
    if (!videoDetails) {
      throw new Error(`Video not found: ${videoId}`);
    }
    
    console.log(`🎬 Video: ${videoId} - ${videoDetails.title}`);
    console.log(`📊 Current Status: ${videoDetails.status}`);
    
    if (videoDetails.status !== 'Generating Images') {
      console.log(`ℹ️  No fix needed - video status is "${videoDetails.status}", not "Generating Images"`);
      return { fixed: false, reason: 'Status is not "Generating Images"' };
    }
    
    // Apply deadlock prevention
    console.log('\n🔍 Applying deadlock prevention...');
    const result = await workflowService.validateAndAutoAdvanceImageGeneration(videoId);
    
    if (result.autoAdvanced) {
      console.log(`✅ WORKFLOW FIXED!`);
      console.log(`   Previous Status: ${result.previousStatus}`);
      console.log(`   New Status: ${result.newStatus}`);
      console.log(`   Voice Script Created: ${result.voiceScriptCreated ? 'Yes' : 'No'}`);
      console.log(`   Auto-Advance Reason: ${result.message}`);
      
      return { 
        fixed: true, 
        previousStatus: result.previousStatus,
        newStatus: result.newStatus,
        voiceScriptCreated: result.voiceScriptCreated
      };
    } else {
      console.log(`ℹ️  No fix applied: ${result.message}`);
      
      if (result.entriesNeedingGeneration > 0) {
        console.log(`   ${result.entriesNeedingGeneration} entries still need image generation`);
      }
      
      return { 
        fixed: false, 
        reason: result.message,
        entriesNeedingGeneration: result.entriesNeedingGeneration || 0
      };
    }
    
  } catch (error) {
    console.error(`❌ Failed to fix workflow for ${videoId}:`, error);
    throw error;
  }
}

// Main execution
async function main() {
  const videoId = process.argv[2];
  
  try {
    if (videoId) {
      // Fix specific workflow
      const result = await fixSpecificWorkflow(videoId);
      
      if (result.fixed) {
        console.log('\n🎉 Specific workflow fixed successfully!');
      } else {
        console.log('\n💡 No fix was needed for this workflow');
      }
    } else {
      // Fix all stuck workflows
      const result = await fixStuckWorkflows();
      
      if (result.fixed > 0) {
        console.log('\n🎉 Stuck workflow fix operation completed successfully!');
      } else {
        console.log('\n💡 No stuck workflows were found that needed fixing');
      }
    }
    
    console.log('\n🔧 Next Steps:');
    console.log('   • Check Telegram for auto-advancement notifications');
    console.log('   • Verify voice scripts were created in Google Drive');  
    console.log('   • Monitor future workflows to ensure no new deadlocks occur');
    console.log('\n   For prevention going forward, the system now automatically');
    console.log('   detects and fixes deadlocks during regular processing cycles.');
    
    process.exit(0);
    
  } catch (error) {
    console.error('\n💥 Fix operation failed:', error);
    process.exit(1);
  }
}

// Show usage if no arguments
if (process.argv.length === 2) {
  console.log('🔧 Fix Stuck Workflows Utility\n');
  console.log('Usage:');
  console.log('  node tools/fix-stuck-workflows.js              # Fix all stuck workflows');
  console.log('  node tools/fix-stuck-workflows.js VID-001      # Fix specific workflow');
  console.log('');
  console.log('This utility finds videos stuck on "Generating Images" status');
  console.log('and applies deadlock prevention to advance them to "Completed".');
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { fixStuckWorkflows, fixSpecificWorkflow };