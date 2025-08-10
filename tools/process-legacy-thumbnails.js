#!/usr/bin/env node

/**
 * Comprehensive Legacy Video Thumbnail Processor
 * 
 * This tool processes ALL legacy videos in Google Sheets that have "Script Approved" = "Approved"
 * and generates missing thumbnails with robust error handling and progress tracking.
 * 
 * Key Features:
 * - Fixes JSON parsing errors in thumbnail context generation
 * - Creates missing Google Drive folders for legacy videos
 * - Handles videos with incomplete metadata or workflow states
 * - Batch processes all legacy videos safely with comprehensive error handling
 * - Provides detailed progress tracking and reporting
 * - Continues processing even if individual videos fail
 * 
 * Usage:
 *   # Process all legacy videos with approved scripts
 *   node tools/process-legacy-thumbnails.js --process-all
 * 
 *   # Dry run to see what would be processed
 *   node tools/process-legacy-thumbnails.js --dry-run
 * 
 *   # Check specific video
 *   node tools/process-legacy-thumbnails.js --check-video VIDEO_ID
 * 
 *   # Process specific video with force regeneration
 *   node tools/process-legacy-thumbnails.js --process-video VIDEO_ID --force
 * 
 *   # Get detailed report of all approved videos
 *   node tools/process-legacy-thumbnails.js --analyze-approved
 */

import YouTubeAutomation from '../src/index.js';
import GoogleSheetsService from '../src/services/googleSheetsService.js';
import ThumbnailService from '../src/services/thumbnailService.js';
import AIService from '../src/services/aiService.js';
import GoogleDriveService from '../src/services/googleDriveService.js';
import logger from '../src/utils/logger.js';

class LegacyThumbnailProcessor {
  constructor() {
    this.googleSheetsService = new GoogleSheetsService();
    this.aiService = new AIService();
    this.googleDriveService = new GoogleDriveService();
    this.thumbnailService = new ThumbnailService(this.aiService, this.googleDriveService);
    
    this.stats = {
      totalApprovedVideos: 0,
      processedVideos: 0,
      successfulThumbnails: 0,
      skippedThumbnails: 0,
      failedThumbnails: 0,
      foldersCreated: 0,
      foldersFixed: 0,
      errors: [],
      processingTime: 0
    };
  }

  /**
   * Find all legacy videos that need thumbnail processing
   */
  async findLegacyVideosForThumbnails(dryRun = false) {
    try {
      logger.info('🔍 Finding legacy videos with approved scripts for thumbnail processing...');
      
      const approvedVideos = await this.googleSheetsService.getVideosWithApprovedScripts();
      this.stats.totalApprovedVideos = approvedVideos.length;
      
      logger.info(`📊 Found ${approvedVideos.length} videos with approved scripts`);
      
      const videosNeedingThumbnails = [];
      const videoAnalysis = [];
      
      for (const video of approvedVideos) {
        try {
          const analysis = await this.analyzeVideoForThumbnails(video, dryRun);
          videoAnalysis.push(analysis);
          
          if (analysis.needsThumbnails) {
            videosNeedingThumbnails.push({
              ...video,
              analysis
            });
          }
          
        } catch (analysisError) {
          logger.error(`Failed to analyze video ${video.videoId}:`, analysisError.message);
          this.stats.errors.push({
            videoId: video.videoId,
            stage: 'analysis',
            error: analysisError.message
          });
        }
      }
      
      logger.info(`🎯 Identified ${videosNeedingThumbnails.length} videos needing thumbnail processing`);
      
      return {
        total: approvedVideos.length,
        needingThumbnails: videosNeedingThumbnails.length,
        videos: videosNeedingThumbnails,
        analysis: videoAnalysis
      };
      
    } catch (error) {
      logger.error('❌ Failed to find legacy videos:', error);
      throw error;
    }
  }

  /**
   * Analyze a single video to determine if it needs thumbnail processing
   */
  async analyzeVideoForThumbnails(video, dryRun = false) {
    const analysis = {
      videoId: video.videoId,
      title: video.title,
      needsThumbnails: false,
      hasDriveFolder: !!video.driveFolder,
      hasDetailWorkbook: !!video.detailWorkbookUrl,
      thumbnailStatus: 'unknown',
      issues: [],
      recommendations: []
    };
    
    try {
      // Check if Drive folder exists
      if (!video.driveFolder) {
        analysis.issues.push('Missing Drive folder URL');
        analysis.recommendations.push('Will create Drive folder automatically');
        analysis.needsThumbnails = true;
      }
      
      // Check if detail workbook exists
      if (!video.detailWorkbookUrl) {
        analysis.issues.push('Missing detail workbook');
        analysis.recommendations.push('May need to create workbook first');
      }
      
      // Check existing thumbnails
      try {
        const existingThumbnails = await this.thumbnailService.checkExistingThumbnails(video.videoId, video.title);
        
        if (existingThumbnails.exists) {
          analysis.thumbnailStatus = `${existingThumbnails.count} thumbnails exist`;
          analysis.needsThumbnails = false;
        } else {
          analysis.thumbnailStatus = 'No thumbnails found';
          analysis.needsThumbnails = true;
          analysis.recommendations.push('Generate 2 thumbnails (Emotional/Dramatic & Professional/Clean styles)');
        }
        
      } catch (thumbnailCheckError) {
        analysis.issues.push(`Thumbnail check failed: ${thumbnailCheckError.message}`);
        analysis.thumbnailStatus = 'Check failed - will attempt processing';
        analysis.needsThumbnails = true;
      }
      
      // Validate video data completeness
      if (!video.title || video.title === 'Unknown Title' || video.title === 'YouTube API Error - Run fix-missing-titles.js') {
        analysis.issues.push('Invalid or missing video title');
        analysis.recommendations.push('May need to fix title first');
      }
      
      if (dryRun) {
        logger.info(`📋 ${video.videoId} - ${analysis.thumbnailStatus} - Needs: ${analysis.needsThumbnails ? 'YES' : 'NO'}`);
        if (analysis.issues.length > 0) {
          logger.info(`   Issues: ${analysis.issues.join(', ')}`);
        }
      }
      
    } catch (error) {
      analysis.issues.push(`Analysis error: ${error.message}`);
      analysis.needsThumbnails = true; // Default to processing on error
    }
    
    return analysis;
  }

  /**
   * Process a single video for thumbnail generation
   */
  async processVideoThumbnails(video, forceRegenerate = false) {
    const startTime = Date.now();
    
    try {
      const videoId = video.id || video.videoId;
      logger.info(`🎨 Processing thumbnails for ${videoId} - ${video.title}`);
      
      // Prepare video data with fallbacks for legacy videos
      const videoData = {
        videoId: videoId,
        id: video.youtubeVideoId || videoId,
        title: video.title || 'Legacy Video',
        youtubeUrl: video.youtubeUrl || '',
        channelTitle: video.channel || 'Unknown Channel',
        duration: video.duration || 'Unknown',
        viewCount: video.viewCount || 0,
        publishedAt: video.publishedDate || 'Unknown',
        // Add transcript or script content for thumbnail context
        transcriptText: `Legacy video: ${video.title}. This is an approved script video that needs thumbnail generation.`,
        optimizedScript: `Legacy video content for ${video.title}.`
      };
      
      // Process thumbnails with enhanced error handling
      const result = await this.thumbnailService.processVideoThumbnails(
        videoData, 
        videoId, 
        forceRegenerate,
        this.googleSheetsService
      );
      
      // Update statistics
      this.stats.processedVideos++;
      if (result.success) {
        this.stats.successfulThumbnails += result.uploaded;
      } else if (result.skipped) {
        this.stats.skippedThumbnails++;
      } else {
        this.stats.failedThumbnails++;
        this.stats.errors.push({
          videoId: video.videoId,
          stage: 'thumbnail_processing',
          error: result.error || 'Unknown error'
        });
      }
      
      const processingTime = Date.now() - startTime;
      
      return {
        videoId: videoId,
        title: video.title,
        success: result.success,
        skipped: result.skipped,
        generated: result.generated,
        uploaded: result.uploaded,
        failed: result.failed,
        error: result.error,
        processingTime,
        driveFolder: result.videoFolderUrl || result.driveFolder,
        thumbnailFolder: result.driveFolder
      };
      
    } catch (error) {
      const videoId = video.id || video.videoId;
      this.stats.failedThumbnails++;
      this.stats.errors.push({
        videoId: videoId,
        stage: 'thumbnail_processing',
        error: error.message
      });
      
      logger.error(`❌ Failed to process thumbnails for ${videoId}:`, error);
      
      return {
        videoId: videoId,
        title: video.title,
        success: false,
        error: error.message,
        processingTime: Date.now() - startTime
      };
    }
  }

  /**
   * Process all legacy videos in batch with progress tracking
   */
  async processAllLegacyVideos(forceRegenerate = false, maxConcurrent = 2) {
    const overallStartTime = Date.now();
    
    try {
      logger.info('🚀 Starting batch processing of all legacy videos...');
      
      // Find videos that need processing
      const legacyData = await this.findLegacyVideosForThumbnails(false);
      
      if (legacyData.videos.length === 0) {
        logger.info('✅ No legacy videos need thumbnail processing');
        return {
          total: legacyData.total,
          processed: 0,
          results: [],
          stats: this.stats
        };
      }
      
      logger.info(`📈 Processing ${legacyData.videos.length} legacy videos (max concurrent: ${maxConcurrent})`);
      
      const results = [];
      const videos = legacyData.videos;
      
      // Process videos in batches to avoid overwhelming the APIs
      for (let i = 0; i < videos.length; i += maxConcurrent) {
        const batch = videos.slice(i, i + maxConcurrent);
        const batchNumber = Math.floor(i / maxConcurrent) + 1;
        const totalBatches = Math.ceil(videos.length / maxConcurrent);
        
        logger.info(`🔄 Processing batch ${batchNumber}/${totalBatches} (${batch.length} videos)`);
        
        // Process batch concurrently
        const batchPromises = batch.map(video => this.processVideoThumbnails(video, forceRegenerate));
        const batchResults = await Promise.allSettled(batchPromises);
        
        // Process results
        batchResults.forEach((result, index) => {
          const video = batch[index];
          
          if (result.status === 'fulfilled') {
            results.push(result.value);
            
            const res = result.value;
            if (res.success) {
              logger.info(`✅ ${video.videoId} - SUCCESS: ${res.uploaded} thumbnails generated`);
            } else if (res.skipped) {
              logger.info(`⏭️ ${video.videoId} - SKIPPED: Thumbnails already exist`);
            } else {
              logger.warn(`⚠️ ${video.videoId} - FAILED: ${res.error}`);
            }
          } else {
            logger.error(`❌ ${video.videoId} - BATCH ERROR: ${result.reason}`);
            results.push({
              videoId: video.videoId,
              title: video.title,
              success: false,
              error: result.reason?.message || 'Batch processing failed'
            });
          }
        });
        
        // Add delay between batches to be respectful to APIs
        if (i + maxConcurrent < videos.length) {
          logger.info('⏳ Waiting 3 seconds before next batch...');
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }
      
      this.stats.processingTime = Date.now() - overallStartTime;
      
      logger.info('🎉 Batch processing completed!');
      this.logFinalStats();
      
      return {
        total: legacyData.total,
        identified: legacyData.videos.length,
        processed: results.length,
        results,
        stats: this.stats
      };
      
    } catch (error) {
      logger.error('❌ Batch processing failed:', error);
      throw error;
    }
  }

  /**
   * Log comprehensive statistics
   */
  logFinalStats() {
    const stats = this.stats;
    
    logger.info('\n' + '='.repeat(60));
    logger.info('📊 LEGACY THUMBNAIL PROCESSING RESULTS');
    logger.info('='.repeat(60));
    logger.info(`⏱️  Total Processing Time: ${(stats.processingTime / 1000).toFixed(2)}s`);
    logger.info(`📁 Total Approved Videos: ${stats.totalApprovedVideos}`);
    logger.info(`🎬 Videos Processed: ${stats.processedVideos}`);
    logger.info(`✅ Successful Thumbnails: ${stats.successfulThumbnails}`);
    logger.info(`⏭️  Skipped (Already Exist): ${stats.skippedThumbnails}`);
    logger.info(`❌ Failed Thumbnails: ${stats.failedThumbnails}`);
    
    if (stats.errors.length > 0) {
      logger.info('\n🚨 ERRORS ENCOUNTERED:');
      stats.errors.forEach((error, index) => {
        logger.info(`   ${index + 1}. ${error.videoId} (${error.stage}): ${error.error}`);
      });
    }
    
    if (stats.processedVideos > 0) {
      const successRate = ((stats.successfulThumbnails / stats.processedVideos) * 100).toFixed(1);
      logger.info(`\n📈 Success Rate: ${successRate}%`);
    }
    
    logger.info('='.repeat(60));
  }

  /**
   * Generate detailed analysis report
   */
  async generateAnalysisReport() {
    try {
      logger.info('📋 Generating detailed analysis report...');
      
      const legacyData = await this.findLegacyVideosForThumbnails(true);
      
      console.log('\n' + '='.repeat(80));
      console.log('📊 LEGACY VIDEO THUMBNAIL ANALYSIS REPORT');
      console.log('='.repeat(80));
      console.log(`Total Approved Scripts: ${legacyData.total}`);
      console.log(`Videos Needing Thumbnails: ${legacyData.needingThumbnails}`);
      console.log(`Videos Already Have Thumbnails: ${legacyData.total - legacyData.needingThumbnails}`);
      
      // Group videos by status
      const byStatus = {
        needsThumbnails: [],
        hasThumbnails: [],
        hasIssues: []
      };
      
      legacyData.analysis.forEach(analysis => {
        if (analysis.needsThumbnails) {
          byStatus.needsThumbnails.push(analysis);
        } else {
          byStatus.hasThumbnails.push(analysis);
        }
        
        if (analysis.issues.length > 0) {
          byStatus.hasIssues.push(analysis);
        }
      });
      
      console.log('\n🎯 VIDEOS NEEDING THUMBNAILS:');
      byStatus.needsThumbnails.forEach(video => {
        console.log(`   ${video.videoId} - ${video.title}`);
        console.log(`      Status: ${video.thumbnailStatus}`);
        if (video.issues.length > 0) {
          console.log(`      Issues: ${video.issues.join(', ')}`);
        }
        if (video.recommendations.length > 0) {
          console.log(`      Actions: ${video.recommendations.join(', ')}`);
        }
        console.log('');
      });
      
      console.log('\n✅ VIDEOS WITH EXISTING THUMBNAILS:');
      byStatus.hasThumbnails.forEach(video => {
        console.log(`   ${video.videoId} - ${video.title} (${video.thumbnailStatus})`);
      });
      
      if (byStatus.hasIssues.length > 0) {
        console.log('\n⚠️  VIDEOS WITH ISSUES:');
        byStatus.hasIssues.forEach(video => {
          console.log(`   ${video.videoId} - Issues: ${video.issues.join(', ')}`);
        });
      }
      
      console.log('\n='.repeat(80));
      
      return legacyData;
      
    } catch (error) {
      logger.error('❌ Failed to generate analysis report:', error);
      throw error;
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('Comprehensive Legacy Video Thumbnail Processor');
    console.log('');
    console.log('Usage:');
    console.log('  --process-all           Process all legacy videos with approved scripts');
    console.log('  --dry-run               Show what would be processed without doing anything');
    console.log('  --check-video ID        Analyze specific video for thumbnail needs');
    console.log('  --process-video ID      Process specific video for thumbnails');
    console.log('  --process-video ID --force  Force regenerate thumbnails for specific video');
    console.log('  --analyze-approved      Generate detailed analysis report');
    console.log('');
    console.log('Examples:');
    console.log('  node tools/process-legacy-thumbnails.js --process-all');
    console.log('  node tools/process-legacy-thumbnails.js --dry-run');
    console.log('  node tools/process-legacy-thumbnails.js --check-video VID-0001');
    console.log('  node tools/process-legacy-thumbnails.js --process-video VID-0001 --force');
    console.log('  node tools/process-legacy-thumbnails.js --analyze-approved');
    process.exit(1);
  }

  const processor = new LegacyThumbnailProcessor();
  
  try {
    const command = args[0];
    const videoId = args[1];
    const force = args.includes('--force');
    
    switch (command) {
      case '--process-all':
        logger.info('🚀 Processing all legacy videos for thumbnail generation...');
        const allResults = await processor.processAllLegacyVideos(false, 2);
        
        console.log('\n=== FINAL RESULTS ===');
        console.log(`Total approved videos: ${allResults.total}`);
        console.log(`Videos identified for processing: ${allResults.identified}`);
        console.log(`Videos processed: ${allResults.processed}`);
        console.log(`Successful thumbnails: ${processor.stats.successfulThumbnails}`);
        console.log(`Skipped (already exist): ${processor.stats.skippedThumbnails}`);
        console.log(`Failed: ${processor.stats.failedThumbnails}`);
        console.log(`Total errors: ${processor.stats.errors.length}`);
        break;
        
      case '--dry-run':
        logger.info('🔍 Performing dry run analysis...');
        const dryRunResults = await processor.findLegacyVideosForThumbnails(true);
        
        console.log('\n=== DRY RUN RESULTS ===');
        console.log(`Total approved videos: ${dryRunResults.total}`);
        console.log(`Videos needing thumbnails: ${dryRunResults.needingThumbnails}`);
        console.log(`Videos with existing thumbnails: ${dryRunResults.total - dryRunResults.needingThumbnails}`);
        console.log('\nNo actual processing was performed.');
        break;
        
      case '--check-video':
        if (!videoId) {
          logger.error('❌ Video ID required for --check-video command');
          process.exit(1);
        }
        
        logger.info(`🔍 Checking video: ${videoId}`);
        // Implementation for checking specific video
        const videoDetails = await processor.googleSheetsService.getVideoDetails(videoId);
        if (!videoDetails) {
          logger.error(`❌ Video not found: ${videoId}`);
          process.exit(1);
        }
        
        const analysis = await processor.analyzeVideoForThumbnails(videoDetails);
        
        console.log(`\n=== ANALYSIS for ${videoId} ===`);
        console.log(`Title: ${analysis.title}`);
        console.log(`Needs Thumbnails: ${analysis.needsThumbnails ? 'YES' : 'NO'}`);
        console.log(`Thumbnail Status: ${analysis.thumbnailStatus}`);
        console.log(`Has Drive Folder: ${analysis.hasDriveFolder ? 'YES' : 'NO'}`);
        console.log(`Has Detail Workbook: ${analysis.hasDetailWorkbook ? 'YES' : 'NO'}`);
        
        if (analysis.issues.length > 0) {
          console.log(`Issues: ${analysis.issues.join(', ')}`);
        }
        if (analysis.recommendations.length > 0) {
          console.log(`Recommendations: ${analysis.recommendations.join(', ')}`);
        }
        break;
        
      case '--process-video':
        if (!videoId) {
          logger.error('❌ Video ID required for --process-video command');
          process.exit(1);
        }
        
        logger.info(`🎨 Processing video: ${videoId} ${force ? '(FORCE)' : ''}`);
        const videoToProcess = await processor.googleSheetsService.getVideoDetails(videoId);
        if (!videoToProcess) {
          logger.error(`❌ Video not found: ${videoId}`);
          process.exit(1);
        }
        
        const processResult = await processor.processVideoThumbnails(videoToProcess, force);
        
        console.log(`\n=== PROCESSING RESULTS for ${videoId} ===`);
        console.log(`Success: ${processResult.success ? '✅ YES' : '❌ NO'}`);
        console.log(`Skipped: ${processResult.skipped ? 'YES' : 'NO'}`);
        console.log(`Generated: ${processResult.generated || 0}`);
        console.log(`Uploaded: ${processResult.uploaded || 0}`);
        console.log(`Failed: ${processResult.failed || 0}`);
        console.log(`Processing Time: ${processResult.processingTime || 0}ms`);
        
        if (processResult.error) {
          console.log(`Error: ${processResult.error}`);
        }
        if (processResult.driveFolder) {
          console.log(`Drive Folder: ${processResult.driveFolder}`);
        }
        break;
        
      case '--analyze-approved':
        logger.info('📊 Generating comprehensive analysis of approved videos...');
        await processor.generateAnalysisReport();
        break;
        
      default:
        logger.error(`❌ Unknown command: ${command}`);
        process.exit(1);
    }
    
    logger.info('✅ Legacy thumbnail processing completed successfully');
    
  } catch (error) {
    logger.error('❌ Legacy thumbnail processing failed:', error);
    console.log('\n❌ ERROR:', error.message);
    console.log('\nStack trace:', error.stack);
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
  logger.error('Unhandled error in legacy thumbnail processing:', error);
  process.exit(1);
});