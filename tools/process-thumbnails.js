#!/usr/bin/env node

/**
 * Manual Thumbnail Processing Utility
 * 
 * This tool helps process thumbnails for approved scripts that may have missed thumbnail generation.
 * 
 * Usage:
 *   # Check and process all approved scripts for missing thumbnails
 *   node tools/process-thumbnails.js --check-all
 * 
 *   # Check thumbnails for specific video
 *   node tools/process-thumbnails.js --check VIDEO_ID
 * 
 *   # Generate thumbnails for specific video (only if script is approved)
 *   node tools/process-thumbnails.js --generate VIDEO_ID
 * 
 *   # Force regenerate thumbnails for specific video (even if they exist)
 *   node tools/process-thumbnails.js --force-generate VIDEO_ID
 */

import YouTubeAutomation from '../src/index.js';
import logger from '../src/utils/logger.js';

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('Usage:');
    console.log('  --check-all                  Check and process all approved scripts for missing thumbnails');
    console.log('  --check VIDEO_ID            Check thumbnails for specific video');
    console.log('  --generate VIDEO_ID         Generate thumbnails for specific video');
    console.log('  --force-generate VIDEO_ID   Force regenerate thumbnails (even if exist)');
    console.log('');
    console.log('Examples:');
    console.log('  node tools/process-thumbnails.js --check-all');
    console.log('  node tools/process-thumbnails.js --check abc123def456');
    console.log('  node tools/process-thumbnails.js --generate abc123def456');
    console.log('  node tools/process-thumbnails.js --force-generate abc123def456');
    process.exit(1);
  }

  const automation = new YouTubeAutomation();
  
  try {
    // Initialize the automation system
    await automation.initialize();
    
    const command = args[0];
    const videoId = args[1];
    
    switch (command) {
      case '--check-all':
        logger.info('🎨 Processing all approved scripts for missing thumbnails...');
        const allResults = await automation.forceProcessThumbnailsForApprovedScripts();
        
        console.log('\n=== THUMBNAIL PROCESSING RESULTS ===');
        console.log(`Total approved scripts: ${allResults.total}`);
        console.log(`Processed: ${allResults.processed}`);
        console.log(`Thumbnails generated: ${allResults.breakdown?.thumbnailsGenerated || 0}`);
        console.log(`Thumbnails skipped (already exist): ${allResults.breakdown?.thumbnailsSkipped || 0}`);
        console.log(`Errors: ${allResults.breakdown?.errors || 0}`);
        
        if (allResults.results && allResults.results.length > 0) {
          console.log('\n=== DETAILED RESULTS ===');
          allResults.results.forEach(result => {
            const status = result.action === 'generated' ? '✅ GENERATED' : 
                          result.action === 'skipped' ? '⏭️ SKIPPED' :
                          result.action === 'failed' ? '❌ FAILED' : '⚠️ ERROR';
            
            console.log(`${status} ${result.videoId} - ${result.title}`);
            if (result.thumbnailCount) {
              console.log(`  📊 Thumbnails: ${result.thumbnailCount}`);
            }
            if (result.driveFolder) {
              console.log(`  📁 Folder: ${result.driveFolder}`);
            }
            if (result.reason) {
              console.log(`  📝 Reason: ${result.reason}`);
            }
            if (result.error) {
              console.log(`  ❌ Error: ${result.error}`);
            }
            console.log('');
          });
        }
        break;
        
      case '--check':
        if (!videoId) {
          logger.error('❌ Video ID required for --check command');
          process.exit(1);
        }
        
        logger.info(`🔍 Checking thumbnails for video: ${videoId}`);
        const checkResult = await automation.checkThumbnailsForVideo(videoId);
        
        console.log(`\n=== THUMBNAIL CHECK RESULTS for ${videoId} ===`);
        console.log(`Thumbnails exist: ${checkResult.exists ? '✅ YES' : '❌ NO'}`);
        
        if (checkResult.exists) {
          console.log(`Count: ${checkResult.count}`);
          console.log(`Folder: ${checkResult.folderUrl}`);
          console.log('\nThumbnail files:');
          checkResult.thumbnails.forEach(thumb => {
            console.log(`  📄 ${thumb.fileName} (${thumb.size} bytes)`);
            console.log(`     Created: ${thumb.createdTime}`);
            console.log(`     Link: ${thumb.viewLink}`);
            console.log('');
          });
        } else {
          console.log(`Reason: ${checkResult.reason}`);
        }
        break;
        
      case '--generate':
        if (!videoId) {
          logger.error('❌ Video ID required for --generate command');
          process.exit(1);
        }
        
        logger.info(`🎨 Generating thumbnails for video: ${videoId}`);
        const generateResult = await automation.generateThumbnailsForVideo(videoId, false);
        
        console.log(`\n=== THUMBNAIL GENERATION RESULTS for ${videoId} ===`);
        console.log(`Success: ${generateResult.success ? '✅ YES' : '❌ NO'}`);
        
        if (generateResult.skipped) {
          console.log('⏭️ Generation skipped - thumbnails already exist');
          console.log(`Existing count: ${generateResult.existing?.count || 0}`);
        } else if (generateResult.success) {
          console.log(`Generated: ${generateResult.generated}`);
          console.log(`Uploaded: ${generateResult.uploaded}`);
          console.log(`Drive folder: ${generateResult.driveFolder}`);
        } else {
          console.log('❌ Generation failed');
        }
        break;
        
      case '--force-generate':
        if (!videoId) {
          logger.error('❌ Video ID required for --force-generate command');
          process.exit(1);
        }
        
        logger.info(`🔄 Force generating thumbnails for video: ${videoId}`);
        const forceResult = await automation.generateThumbnailsForVideo(videoId, true);
        
        console.log(`\n=== FORCE THUMBNAIL GENERATION RESULTS for ${videoId} ===`);
        console.log(`Success: ${forceResult.success ? '✅ YES' : '❌ NO'}`);
        console.log(`Generated: ${forceResult.generated}`);
        console.log(`Uploaded: ${forceResult.uploaded}`);
        console.log(`Drive folder: ${forceResult.driveFolder}`);
        break;
        
      default:
        logger.error(`❌ Unknown command: ${command}`);
        process.exit(1);
    }
    
    logger.info('✅ Thumbnail processing completed successfully');
    
  } catch (error) {
    logger.error('❌ Thumbnail processing failed:', error);
    console.log('\n❌ ERROR:', error.message);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  logger.info('Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

main().catch(error => {
  logger.error('Unhandled error in thumbnail processing:', error);
  process.exit(1);
});