#!/usr/bin/env node

/**
 * Regenerate Thumbnails for VID-0001
 * 
 * This script regenerates thumbnails for VID-0001 using the fixed thumbnail generation
 * prompts that no longer include YouTube frame references and incorporate the latest
 * optimization improvements.
 * 
 * Features:
 * - Uses optimized thumbnail generation with full canvas usage
 * - Removes brand contamination and YouTube frame references
 * - Applies maximum contrast and mobile-first design
 * - Updates Google Sheets with new thumbnail information
 * 
 * Usage: node tools/regenerate-vid-0001-thumbnails.js
 */

import ThumbnailService from '../src/services/thumbnailService.js';
import AIService from '../src/services/aiService.js';
import GoogleDriveService from '../src/services/googleDriveService.js';
import GoogleSheetsService from '../src/services/googleSheetsService.js';
import logger from '../src/utils/logger.js';

async function regenerateVID0001Thumbnails() {
  const startTime = Date.now();
  
  try {
    console.log('🎨 Regenerating Thumbnails for VID-0001 with Fixed Prompts\n');
    
    // Initialize services
    console.log('🔧 Initializing services...');
    const aiService = new AIService();
    const googleDriveService = new GoogleDriveService();
    const googleSheetsService = new GoogleSheetsService();
    const thumbnailService = new ThumbnailService(aiService, googleDriveService);
    
    const videoId = 'VID-0001';
    
    // Step 1: Get video data from Google Sheets
    console.log(`🔍 Fetching video data for ${videoId}...`);
    const videoDetails = await googleSheetsService.getVideoDetails(videoId);
    
    if (!videoDetails) {
      throw new Error(`Video ${videoId} not found in Google Sheets`);
    }
    
    console.log(`✅ Found video: "${videoDetails.title}"`);
    console.log(`   Channel: ${videoDetails.channel}`);
    console.log(`   Status: ${videoDetails.status}`);
    console.log(`   YouTube URL: ${videoDetails.youtubeUrl}`);
    
    // Get additional content for thumbnail generation
    let scriptContent = null;
    try {
      // Try to get the optimized script from the detail workbook
      if (videoDetails.detailWorkbookUrl) {
        console.log('🔍 Attempting to get script content from detail workbook...');
        scriptContent = await googleSheetsService.extractCleanVoiceScript(videoId);
        if (scriptContent) {
          console.log(`✅ Retrieved script content (${scriptContent.length} chars)`);
        }
      }
    } catch (error) {
      console.log(`⚠️ Could not retrieve script content: ${error.message}`);
    }
    
    // Prepare video data for thumbnail generation
    const videoData = {
      title: videoDetails.title,
      transcriptText: scriptContent || `Content about: ${videoDetails.title}`,
      optimizedScript: scriptContent,
      youtubeUrl: videoDetails.youtubeUrl,
      channel: videoDetails.channel
    };
    
    // Step 2: Check if thumbnails already exist
    console.log('\n🔍 Checking existing thumbnails...');
    const existingThumbnails = await thumbnailService.checkExistingThumbnails(videoId, videoDetails.title);
    
    if (existingThumbnails.exists) {
      console.log(`📁 Found ${existingThumbnails.count} existing thumbnails:`);
      existingThumbnails.thumbnails.forEach((thumb, index) => {
        console.log(`   ${index + 1}. ${thumb.fileName} (${thumb.createdTime})`);
        console.log(`      View: ${thumb.viewLink}`);
        console.log(`      Direct: ${thumb.directLink}`);
      });
      console.log('\n⚠️ Existing thumbnails will be overwritten with regenerated versions');
    } else {
      console.log('📋 No existing thumbnails found - generating fresh');
    }
    
    // Step 3: Get stored thumbnail concepts if available
    console.log('\n🎨 Checking for stored thumbnail concepts...');
    let storedConcepts = null;
    try {
      storedConcepts = await googleSheetsService.getStoredThumbnailConcepts(videoId);
      if (storedConcepts) {
        console.log(`📋 Found stored concepts (${storedConcepts.length} chars) - will use for consistency`);
      } else {
        console.log('📋 No stored concepts found - will generate fresh concepts');
      }
    } catch (conceptError) {
      console.log(`⚠️ Could not retrieve stored concepts: ${conceptError.message}`);
    }
    
    // Step 4: Display current optimization status
    console.log('\n✨ Current Thumbnail Optimization Features:');
    console.log('   ✅ Full canvas usage (no padding/borders/margins)');
    console.log('   ✅ Maximum contrast for mobile readability');
    console.log('   ✅ Single focal point design');
    console.log('   ✅ Minimalist approach (2-3 colors max)');
    console.log('   ✅ Brand contamination removed');
    console.log('   ✅ YouTube frame references eliminated');
    console.log('   ✅ Mobile-first optimization (320px+ clarity)');
    
    // Step 5: Force regenerate thumbnails with latest optimizations
    console.log('\n🎨 Regenerating thumbnails with optimized prompts...');
    const regenerationResult = await thumbnailService.processVideoThumbnails(
      videoData,
      videoId,
      true, // forceRegenerate = true
      googleSheetsService,
      storedConcepts
    );
    
    // Step 6: Display results
    const processingTime = Date.now() - startTime;
    
    console.log('\n📊 REGENERATION RESULTS:');
    console.log(`   Video ID: ${regenerationResult.videoId}`);
    console.log(`   Video Title: ${regenerationResult.videoTitle}`);
    console.log(`   Success: ${regenerationResult.success ? '✅' : '❌'}`);
    console.log(`   Generated: ${regenerationResult.generated} thumbnails`);
    console.log(`   Uploaded: ${regenerationResult.uploaded} thumbnails`);
    console.log(`   Failed: ${regenerationResult.failed} thumbnails`);
    console.log(`   Processing Time: ${regenerationResult.processingTime}ms`);
    console.log(`   Concept Source: ${regenerationResult.conceptSource || 'fresh_generation'}`);
    
    if (regenerationResult.success && regenerationResult.thumbnails) {
      console.log('\n🖼️ Generated Thumbnails:');
      
      if (regenerationResult.thumbnails.thumbnail1) {
        const thumb1 = regenerationResult.thumbnails.thumbnail1;
        console.log(`   1. ${thumb1.fileName} - ${thumb1.style}`);
        if (thumb1.upload && thumb1.upload.success) {
          console.log(`      ✅ Drive URL: ${thumb1.upload.viewLink}`);
          console.log(`      📁 Direct URL: ${thumb1.upload.directLink}`);
        }
      }
      
      if (regenerationResult.thumbnails.thumbnail2) {
        const thumb2 = regenerationResult.thumbnails.thumbnail2;
        console.log(`   2. ${thumb2.fileName} - ${thumb2.style}`);
        if (thumb2.upload && thumb2.upload.success) {
          console.log(`      ✅ Drive URL: ${thumb2.upload.viewLink}`);
          console.log(`      📁 Direct URL: ${thumb2.upload.directLink}`);
        }
      }
      
      if (regenerationResult.driveFolder) {
        console.log(`\n📁 Thumbnail Folder: ${regenerationResult.driveFolder}`);
      }
      
      if (regenerationResult.videoFolderUrl) {
        console.log(`📁 Video Folder: ${regenerationResult.videoFolderUrl}`);
      }
    }
    
    if (regenerationResult.error) {
      console.log(`\n❌ Error: ${regenerationResult.error}`);
      throw new Error(regenerationResult.error);
    }
    
    // Step 7: Update Google Sheets if needed
    if (regenerationResult.success && regenerationResult.uploaded > 0) {
      console.log('\n📝 Updating Google Sheets with regeneration status...');
      try {
        // Update the last edited time to reflect the regeneration
        const timestamp = googleSheetsService.getCurrentTimestamp();
        await googleSheetsService.updateVideoField(videoId, 'lastEditedTime', timestamp);
        
        // Add a note about regeneration in status if needed
        if (videoDetails.status !== 'Thumbnails Regenerated') {
          // Only update status if it's not already indicating recent work
          const currentStatus = videoDetails.status;
          if (!currentStatus.includes('Regenerated') && !currentStatus.includes('Updated')) {
            await googleSheetsService.updateVideoField(videoId, 'status', 'Thumbnails Regenerated');
            console.log('✅ Updated video status to "Thumbnails Regenerated"');
          }
        }
        
        console.log('✅ Google Sheets updated successfully');
      } catch (updateError) {
        console.log(`⚠️ Could not update Google Sheets: ${updateError.message}`);
      }
    }
    
    // Final summary
    console.log(`\n🎉 THUMBNAIL REGENERATION COMPLETE FOR ${videoId}`);
    console.log(`⏱️ Total processing time: ${processingTime}ms`);
    console.log(`🎨 Generated ${regenerationResult.generated} optimized thumbnails`);
    console.log(`📁 Uploaded ${regenerationResult.uploaded} to Google Drive`);
    console.log(`✨ Applied latest optimization improvements:`);
    console.log(`   • Removed YouTube frame references`);
    console.log(`   • Full canvas edge-to-edge design`);
    console.log(`   • Maximum mobile contrast`);
    console.log(`   • Brand-neutral approach`);
    
    console.log('\n✅ VID-0001 thumbnails successfully regenerated with fixed prompts!');
    
  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error(`\n❌ Thumbnail regeneration failed for VID-0001:`);
    console.error(`   Error: ${error.message}`);
    console.error(`   Processing time: ${processingTime}ms`);
    console.error(`   Stack trace:`, error.stack);
    
    // Log to system logger as well
    logger.error(`Thumbnail regeneration failed for VID-0001: ${error.message}`, error);
    
    process.exit(1);
  }
}

// Run the regeneration
console.log('🚀 Starting VID-0001 thumbnail regeneration...\n');
regenerateVID0001Thumbnails();