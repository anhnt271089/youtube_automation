import YouTubeService from './youtubeService.js';
import GoogleSheetsService from './googleSheetsService.js';
import GoogleDriveService from './googleDriveService.js';
import AIService from './aiService.js';
import TelegramService from './telegramService.js';
import VideoService from './videoService.js';
import StatusMonitorService from './statusMonitorService.js';
import MetadataService from './metadataService.js';
import ThumbnailService from './thumbnailService.js';
import lockManager from './lockManagerService.js';
import { config } from '../../config/config.js';
import logger, { safeJsonStringify } from '../utils/logger.js';

class WorkflowService {
  /**
   * Safely serialize error objects for logging, avoiding circular references
   * @param {Error|object} error - Error object or any object to serialize safely
   * @returns {object} Safe error object for logging
   */
  safeErrorSerialization(error) {
    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: error.code,
        type: 'Error'
      };
    }
    
    if (typeof error === 'object' && error !== null) {
      try {
        // Try to extract useful information from HTTP errors
        if (error.response) {
          return {
            message: error.message || 'HTTP Error',
            status: error.response.status,
            statusText: error.response.statusText,
            url: error.config?.url,
            method: error.config?.method,
            type: 'HTTPError'
          };
        }
        
        if (error.request) {
          return {
            message: error.message || 'Network Error',
            url: error.config?.url,
            method: error.config?.method,
            type: 'NetworkError'
          };
        }
        
        // For other objects, use the safe JSON stringifier
        return JSON.parse(safeJsonStringify(error));
      } catch {
        return {
          message: 'Error serialization failed',
          originalError: error.toString(),
          type: 'SerializationError'
        };
      }
    }
    
    return { message: String(error), type: 'Unknown' };
  }

  /**
   * Get current timestamp in configured timezone for consistent display
   * @returns {string} Formatted timestamp in Asia/Bangkok (GMT+7) timezone
   */
  getCurrentTimestamp() {
    const now = new Date();
    // Convert to Asia/Bangkok timezone and format for Google Sheets
    return now.toLocaleString('sv-SE', { 
      timeZone: config.app.timezone,
      year: 'numeric',
      month: '2-digit', 
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).replace(' ', 'T');
  }

  constructor() {
    this.youtubeService = new YouTubeService();
    this.sheetsService = new GoogleSheetsService();
    this.driveService = new GoogleDriveService();
    this.aiService = new AIService();
    this.telegramService = new TelegramService();
    this.videoService = new VideoService();
    
    // Initialize MetadataService with service dependencies for fallback
    this.metadataService = new MetadataService(this.sheetsService, this.youtubeService);
    
    // Initialize ThumbnailService with required dependencies
    this.thumbnailService = new ThumbnailService(this.aiService, this.driveService);
    
    // Initialize StatusMonitorService with this workflow service for thumbnail integration
    this.statusMonitorService = new StatusMonitorService(this);
    
    // Metadata cache for workflow efficiency
    this.metadataCache = new Map();
    
    this.processingQueue = new Map();
    this.stats = {
      totalProcessed: 0,
      successful: 0,
      failed: 0,
      pending: 0
    };
    
    // Clean up stale thumbnail processing locks every 10 minutes
    setInterval(() => {
      this.thumbnailService.cleanupStaleLocks();
    }, 10 * 60 * 1000);
  }

  /**
   * Get reliable video metadata using bulletproof MetadataService
   * This prevents workflow failures due to human modifications of Google Sheets
   */
  async getReliableVideoMetadata(videoId, useCache = true) {
    try {
      // Check cache first for performance
      if (useCache && this.metadataCache.has(videoId)) {
        const cached = this.metadataCache.get(videoId);
        // Cache valid for 5 minutes to balance performance vs freshness
        if (Date.now() - cached.timestamp < 5 * 60 * 1000) {
          logger.debug(`Using cached metadata for ${videoId}`);
          return cached.metadata;
        }
      }

      // Get reliable metadata from MetadataService
      const metadata = await this.metadataService.getReliableVideoMetadata(videoId);
      
      // Cache for performance
      this.metadataCache.set(videoId, {
        metadata,
        timestamp: Date.now()
      });

      logger.info(`Retrieved reliable metadata for ${videoId}: "${metadata.title}"`);
      return metadata;

    } catch (error) {
      logger.error(`Failed to get reliable metadata for ${videoId}:`, error);
      
      // Fallback: try direct sheet access as last resort
      try {
        const videoRow = await this.sheetsService.findVideoRow(videoId);
        if (videoRow && videoRow.data) {
          const fallbackMetadata = {
            title: videoRow.data[this.sheetsService.masterColumns.title] || 'Unknown Title',
            youtubeUrl: videoRow.data[this.sheetsService.masterColumns.youtubeUrl],
            videoId: videoRow.data[this.sheetsService.masterColumns.youtubeVideoId],
            channelTitle: videoRow.data[this.sheetsService.masterColumns.channel],
            duration: videoRow.data[this.sheetsService.masterColumns.duration]
          };
          logger.warn(`Using fallback sheet data for ${videoId} (reliability not guaranteed)`);
          return fallbackMetadata;
        }
      } catch (fallbackError) {
        logger.error(`Fallback sheet access also failed for ${videoId}:`, fallbackError);
      }

      // Ultimate fallback to prevent workflow crashes
      return {
        title: `Video ${videoId}`,
        youtubeUrl: null,
        videoId: null,
        channelTitle: 'Unknown Channel',
        duration: 'Unknown Duration'
      };
    }
  }

  /**
   * Save original YouTube metadata for bulletproof retrieval
   */
  async saveVideoMetadata(videoId, youtubeMetadata) {
    try {
      await this.metadataService.saveOriginalMetadata(videoId, youtubeMetadata);
      
      // Update cache
      this.metadataCache.set(videoId, {
        metadata: youtubeMetadata,
        timestamp: Date.now()
      });
      
      logger.info(`Saved bulletproof metadata for ${videoId}`);
    } catch (error) {
      logger.error(`Failed to save metadata for ${videoId}:`, error);
      // Don't throw - this is not critical for workflow continuation
    }
  }

  /**
   * Database service wrapper methods for easier transition
   */
  async getVideosByStatus(status) {
    return this.sheetsService.getVideosByStatus(status);
  }

  async updateVideoStatus(videoId, status, additionalData = {}) {
    return this.sheetsService.updateVideoStatus(videoId, status, additionalData);
  }

  async getVideoDetails(videoId) {
    return this.sheetsService.getVideoDetails(videoId);
  }

  async approveScript(videoId) {
    return this.sheetsService.approveScript(videoId);
  }

  async createVideoEntry(videoData) {
    return this.sheetsService.createVideoEntry(videoData);
  }

  async createScriptBreakdown(videoId, scriptSentences, imagePrompts, editorKeywords = []) {
    return this.sheetsService.createScriptBreakdown(videoId, scriptSentences, imagePrompts, editorKeywords);
  }

  async updateSentenceStatus(videoId, sentenceNumber, status, imageUrl = null) {
    return this.sheetsService.updateSentenceStatus(videoId, sentenceNumber, status, imageUrl);
  }

  /**
   * Extract clean voice script from script breakdown
   */
  async extractCleanVoiceScript(videoId) {
    return this.sheetsService.extractCleanVoiceScript(videoId);
  }

  /**
   * Create and upload voice script file to Google Drive
   */
  async createAndUploadVoiceScript(videoId, forceRecreate = false) {
    return this.sheetsService.createAndUploadVoiceScript(videoId, forceRecreate);
  }

  async autoPopulateVideoData(videoId, videoData) {
    try {
      logger.info(`📋 Auto-populating metadata for ${videoId}...`);
      
      // 1. Save reliable metadata for bulletproof system
      await this.saveVideoMetadata(videoId, videoData);
      
      // 2. Update master sheet with metadata from reliable source
      const updates = {
        title: videoData.title || 'Title Unavailable',
        channel: videoData.channelTitle || 'Unknown Channel', 
        duration: videoData.duration || 'Unknown',
        youtubeVideoId: videoData.videoId || 'Unknown',
        viewCount: videoData.viewCount || 0,
        publishedDate: videoData.publishedAt || this.getCurrentTimestamp()
      };
      
      // Update master sheet with metadata
      await this.updateVideoStatus(videoId, 'Processing', updates);
      
      logger.info(`✅ Auto-populated ${videoId}: "${videoData.title}"`);
      return { success: true, populated: Object.keys(updates).length };
      
    } catch (error) {
      logger.error(`Failed to auto-populate ${videoId}:`, error);
      // Still update to Processing even if metadata population fails
      await this.updateVideoStatus(videoId, 'Processing');
      return { success: false, error: error.message };
    }
  }

  async addVideoUrl(_youtubeUrl) {
    // This method is no longer needed since we create entries directly
    // Return a mock object to maintain compatibility
    return { id: null };
  }

  async createCompleteScriptStructure(videoId, title, originalTranscript, optimizedScript, scriptSentences = [], imagePrompts = [], editorKeywords = []) {
    // Check if workbook already exists before creating
    const videoRow = await this.sheetsService.findVideoRow(videoId);
    if (videoRow && videoRow.data[this.sheetsService.masterColumns.detailWorkbookUrl]) {
      logger.info(`Detail workbook already exists for ${videoId}, skipping creation`);
      return {
        originalScriptPage: { pageUrl: videoRow.data[this.sheetsService.masterColumns.detailWorkbookUrl] },
        optimizedScriptPage: { pageUrl: videoRow.data[this.sheetsService.masterColumns.detailWorkbookUrl] },
        scriptDatabase: { databaseUrl: videoRow.data[this.sheetsService.masterColumns.detailWorkbookUrl] }
      };
    }

    // Create detail workbook and script breakdown
    const workbookResult = await this.sheetsService.createVideoDetailWorkbook(videoId, title);
    let scriptBreakdownResult = null;
    
    if (scriptSentences.length > 0) {
      scriptBreakdownResult = await this.createScriptBreakdown(videoId, scriptSentences, imagePrompts, editorKeywords);
    }
    
    // Return structure compatible with existing code expectations
    return {
      originalScriptPage: { pageUrl: workbookResult?.workbookUrl }, // Google Sheets doesn't have separate pages, using workbook URL
      optimizedScriptPage: { pageUrl: workbookResult?.workbookUrl },
      scriptDatabase: scriptBreakdownResult ? { databaseUrl: workbookResult?.workbookUrl } : null
    };
  }

  async autoTransitionStatus(videoId, currentStatus, scriptApproved = false) {
    try {
      // Handle status transitions based on current status and script approval
      if (currentStatus === 'Ready for Review' && scriptApproved === true) {
        // Transition from Ready for Review to Approved when script is approved
        await this.updateVideoStatus(videoId, 'Approved', {
          transitionedAt: this.getCurrentTimestamp(),
          transitionReason: 'Script approved by user'
        });
        
        logger.info(`${videoId}: Status transitioned from "Ready for Review" to "Approved"`);
        return { 
          transitioned: true, 
          fromStatus: 'Ready for Review', 
          toStatus: 'Approved' 
        };
      }
      
      // No transition needed
      return { 
        transitioned: false, 
        fromStatus: currentStatus, 
        toStatus: currentStatus 
      };
    } catch (error) {
      logger.error(`Error in autoTransitionStatus for ${videoId}:`, error);
      return { 
        transitioned: false, 
        error: error.message,
        fromStatus: currentStatus, 
        toStatus: currentStatus 
      };
    }
  }

  async autoUpdateWorkflowStatuses(videoId, status) {
    // Update workflow statuses based on main status
    if (status === 'Script Separated') {
      // Only set scriptApproved to Pending, not voiceGenerationStatus
      // Voice Generation Status will be set when Script Approved = "Approved"
      return this.updateVideoStatus(videoId, null, {
        scriptApproved: 'Pending'
      });
    } else if (status === 'Completed') {
      return this.updateVideoStatus(videoId, null, {
        videoEditingStatus: 'Not Started'
      });
    }
    return true;
  }

  async getVideoNavigationLinks(videoId, _knownUrls = {}) {
    // Return mock navigation links since Google Sheets doesn't have hierarchical structure
    return {
      originalScript: null,
      optimizedScript: null,
      scriptBreakdown: null
    };
  }

  async updateMultipleImageUrls(videoId, imageUrls) {
    // Store image URLs in the thumbnailUrls field
    const urlsText = imageUrls.map(img => img.url || img).join(', ');
    return this.updateVideoStatus(videoId, null, {
      thumbnailUrls: urlsText
    });
  }

  async processNewVideos() {
    try {
      logger.info('🆕 Processing new videos...');
      
      // Process both "New" and "Processing" status videos to handle interrupted workflows
      const [newVideos, processingVideos] = await Promise.all([
        this.sheetsService.getVideosByStatus('New'),
        this.sheetsService.getVideosByStatus('Processing')
      ]);
      
      const allVideosToProcess = [...newVideos, ...processingVideos];
      
      if (allVideosToProcess.length === 0) {
        logger.info('🆕 No videos to process');
        return { success: true, processed: 0, message: 'No videos to process' };
      }

      logger.info(`🆕 Found ${newVideos.length} new + ${processingVideos.length} resuming`);
      let processedCount = 0;

      for (const video of allVideosToProcess) {
        try {
          // For processing videos, continue from where they left off
          if (video.status === 'Processing') {
            logger.info(`🔄 Resuming ${video.videoId}`);
            await this.resumeVideoProcessing(video);
          } else {
            // Normal processing for new videos
            await this.processSingleVideo(video);
          }
          processedCount++;
        } catch (error) {
          logger.error(`Error processing video ${video.videoId} - ${video.title}:`, error);
          await this.handleVideoError(video, error, 'Initial Processing');
        }
      }

      logger.info('🆕 New videos completed');
      return { 
        success: true, 
        processed: processedCount, 
        total: allVideosToProcess.length,
        breakdown: {
          newVideos: newVideos.length,
          resumedVideos: processingVideos.length
        }
      };
    } catch (error) {
      logger.error('Error in processNewVideos:', error);
      return { success: false, error: error.message };
    }
  }

  async resumeVideoProcessing(video) {
    try {
      logger.info(`🔄 Resuming ${video.videoId}`);
      
      // Get complete video data from YouTube
      const videoData = await this.youtubeService.getCompleteVideoData(video.youtubeUrl);
      
      // Check what stage the video was interrupted at by examining existing data
      const hasScript = video.optimizedTitle && video.optimizedTitle.trim() !== '';
      const hasApproval = video.scriptApproved;
      
      if (!hasScript) {
        // Resume from script generation stage
        logger.info(`${video.videoId}: script generation`);
        
        // Ensure basic video data fields are populated if missing
        if (!video.youtubeVideoId || !video.title || video.title === 'Processing...') {
          logger.info(`${video.videoId}: populating data`);
          await this.autoPopulateVideoData(video.videoId, videoData);
        }
        
        const result = await this.processInitialVideo(videoData, video.videoId);
        return result;
      } else if (hasScript && hasApproval) {
        // Resume from image generation stage (script was already approved)
        logger.info(`${video.videoId}: image generation`);
        const result = await this.processApprovedScript(video);
        return result;
      } else {
        // Script exists but not approved - update status to Script Separated for manual approval
        logger.info(`${video.videoId}: awaiting approval`);
        await this.updateVideoStatus(video.videoId, 'Script Separated');
        
        // Auto-transition: Script Separated → Ready for Review
        await this.autoTransitionStatus(video.videoId, 'Script Separated', video.scriptApproved);
        
        // Auto-update workflow statuses for resumed script generation
        await this.autoUpdateWorkflowStatuses(video.videoId, 'Script Separated');
        
        // Send approval request with reliable metadata and URLs
        const masterSheetUrl = this.telegramService.generateMasterSheetUrl(config.google.masterSheetId);
        let workbookUrl = null;
        
        try {
          const videoRow = await this.sheetsService.findVideoRow(video.videoId);
          workbookUrl = videoRow.data && videoRow.data[this.sheetsService.masterColumns.detailWorkbookUrl] 
            ? videoRow.data[this.sheetsService.masterColumns.detailWorkbookUrl]
            : null;
        } catch (error) {
          logger.warn(`Could not retrieve workbook URL for ${video.videoId}:`, error);
        }

        // Use reliable metadata for display title
        const reliableMetadata = await this.getReliableVideoMetadata(video.videoId);
        const displayTitle = `${video.videoId} - ${reliableMetadata.title}`;
          
        await this.telegramService.sendScriptApprovalRequest(
          displayTitle,
          workbookUrl,
          masterSheetUrl
        );
        
        return { success: true, stage: 'awaiting_approval' };
      }
    } catch (error) {
      logger.error(`Error resuming video processing for ${video.videoId}:`, error);
      throw error;
    }
  }

  async processApprovedScripts() {
    try {
      logger.info('✅ Processing approved scripts...');
      
      // DEPRECATED: 2025-01-10 - "Generating Images" status no longer used (switched to automated asset downloads from Pexels)
      // Process both "Approved" and "Generating Images" status videos to handle interrupted workflows
      // PLUS get all videos with approved scripts (regardless of status) for comprehensive coverage
      const [approvedVideos, /* generatingVideos, */ allApprovedScriptVideos] = await Promise.all([
        this.sheetsService.getVideosByStatus('Approved'),
        // this.sheetsService.getVideosByStatus('Generating Images'), // DEPRECATED: No longer using "Generating Images" status
        this.sheetsService.getVideosWithApprovedScripts()
      ]);
      const generatingVideos = []; // DEPRECATED: Empty array to maintain code structure
      
      // Combine and deduplicate videos (prioritize status-based videos for main processing)
      const statusBasedVideos = [...approvedVideos, ...generatingVideos];
      const statusBasedIds = new Set(statusBasedVideos.map(v => v.videoId));
      
      // Find approved scripts that aren't in the main processing queue (missing thumbnails case)
      const additionalApprovedScripts = allApprovedScriptVideos.filter(
        video => !statusBasedIds.has(video.videoId)
      );
      
      const allVideosToProcess = [...statusBasedVideos, ...additionalApprovedScripts];
      
      if (allVideosToProcess.length === 0) {
        logger.info('✅ No approved scripts to process');
        return { success: true, processed: 0, message: 'No approved scripts to process' };
      }

      logger.info(`✅ Found ${approvedVideos.length} approved + ${generatingVideos.length} generating + ${additionalApprovedScripts.length} missing thumbnails`);
      let processedCount = 0;
      let thumbnailOnlyCount = 0;
      let autoAdvancedCount = 0;
      
      for (const video of allVideosToProcess) {
        try {
          const isStatusBased = statusBasedIds.has(video.videoId);
          
          if (isStatusBased) {
            // DEPRECATED: 2025-01-10 - "Generating Images" status handling removed
            // Legacy deadlock prevention code - no longer needed with automated asset downloads
            /*
            // DEADLOCK PREVENTION: Check if "Generating Images" status but no images actually need generation
            if (video.status === 'Generating Images') {
              logger.info(`🔍 Checking image generation requirements for ${video.videoId}`);

              // Check if any entries actually need image generation
              const entriesNeedingGeneration = await this.sheetsService.getEntriesNeedingImageGeneration(video.videoId);

              if (entriesNeedingGeneration.length === 0) {
                logger.info(`🚀 Auto-advancing ${video.videoId}: No entries need image generation`);

                // Auto-advance to next step - mark as completed since no images need generation
                await this.updateVideoStatus(video.videoId, 'Completed', {
                  imagesGenerated: 0,
                  imageGenerationSkipped: true,
                  autoAdvanced: true,
                  autoAdvancedAt: this.getCurrentTimestamp(),
                  autoAdvanceReason: 'No entries with "Need Generate" status found',
                  processingCompletedAt: this.getCurrentTimestamp()
                });

                // CRITICAL: Create voice script file even when no images need generation
                try {
                  logger.info(`🎤 Creating voice script file (auto-advanced): ${video.videoId}`);
                  const voiceScriptResult = await this.createAndUploadVoiceScript(video.videoId, false);

                  if (voiceScriptResult && !voiceScriptResult.skipped) {
                    logger.info(`✅ Voice script created during auto-advance: ${voiceScriptResult.fileName}`);
                  }
                } catch (voiceScriptError) {
                  logger.error(`❌ Failed to create voice script during auto-advance for ${video.videoId}:`, voiceScriptError);
                }

                // Auto-update workflow statuses after auto-advancement
                await this.autoUpdateWorkflowStatuses(video.videoId, 'Completed');

                // Get reliable metadata for notification
                const metadata = await this.getReliableVideoMetadata(video.videoId);

                // Send Telegram notification about auto-advancement
                await this.telegramService.sendMessage(
                  '🚀 <b>Workflow Auto-Advanced</b> (Deadlock Prevention)\n\n' +
                  `🎬 ${video.videoId} - ${metadata.title}\n` +
                  '📊 Previous Status: Generating Images\n' +
                  '✅ New Status: Completed\n\n' +
                  '🔍 <b>Reason:</b> No entries with "Need Generate" status found\n' +
                  '💡 System automatically progressed to prevent workflow deadlock\n' +
                  '📝 <i>Voice script created and ready for next steps</i>\n\n' +
                  `🔗 [View Record](${await this.getVideoRecordLink(video.videoId)})`
                );

                autoAdvancedCount++;
                processedCount++;
                continue; // Skip normal processing since we auto-advanced
              } else {
                logger.info(`🔄 Resuming ${video.videoId}: ${entriesNeedingGeneration.length} entries need generation`);
              }
            }
            */
            
            // Regular workflow processing (full script processing)
            await this.processApprovedScript(video);
            processedCount++;
          } else {
            // Thumbnail-only processing for approved scripts that missed thumbnail generation
            logger.info(`🎨 Processing thumbnails for approved script: ${video.videoId}`);
            
            const metadata = await this.getReliableVideoMetadata(video.videoId);
            
            // Check if thumbnails already exist
            const existingThumbnails = await this.thumbnailService.checkExistingThumbnails(
              video.videoId, 
              metadata.title
            );
            
            if (!existingThumbnails.exists) {
              // Generate missing thumbnails
              const videoData = await this.youtubeService.getCompleteVideoData(video.youtubeUrl);
              videoData.videoId = video.videoId;
              
              const thumbnailResult = await this.thumbnailService.processVideoThumbnails(
                videoData, 
                video.videoId, 
                false,
                this.sheetsService
              );
              
              if (thumbnailResult.success) {
                await this.telegramService.sendMessage(
                  '🎨 <b>Missing Thumbnails Generated</b>\n\n' +
                  `🎬 ${video.videoId} - ${metadata.title}\n` +
                  `📊 Current Status: ${video.status}\n` +
                  `🖼️ Generated: ${thumbnailResult.generated} thumbnails\n` +
                  `📁 [View Thumbnails](${thumbnailResult.driveFolder})\n` +
                  '✨ <i>Approved script now has thumbnails</i>'
                );
              }
            } else {
              logger.info(`✅ ${video.videoId}: Thumbnails already exist (${existingThumbnails.count} files)`);
            }
            
            thumbnailOnlyCount++;
          }
        } catch (error) {
          logger.error(`Error processing approved script for ${video.videoId} - ${video.title}:`, error);
          await this.handleVideoError(video, error, 'Script Processing');
        }
      }

      logger.info('✅ Scripts processing completed');
      return { 
        success: true, 
        processed: processedCount + thumbnailOnlyCount, 
        total: allVideosToProcess.length,
        breakdown: {
          approvedScripts: approvedVideos.length,
          resumedImageGeneration: generatingVideos.length - autoAdvancedCount, // Subtract auto-advanced from resumed
          thumbnailOnlyProcessing: thumbnailOnlyCount,
          autoAdvancedDeadlocks: autoAdvancedCount // New metric for deadlock prevention
        }
      };
    } catch (error) {
      logger.error('Error in processApprovedScripts:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Process approved scripts that may have missed thumbnail generation
   * This handles cases where videos have Script Approved = "Approved" but haven't gone through thumbnail generation
   */
  async processApprovedScriptsWithThumbnailCheck() {
    try {
      logger.info('🎨 Processing approved scripts with thumbnail check...');
      
      // Get ALL videos with Script Approved = "Approved" (regardless of main status)
      const approvedScriptVideos = await this.sheetsService.getVideosWithApprovedScripts();
      
      if (approvedScriptVideos.length === 0) {
        logger.info('🎨 No approved scripts found');
        return { success: true, processed: 0, message: 'No approved scripts found' };
      }

      logger.info(`🎨 Found ${approvedScriptVideos.length} videos with approved scripts`);
      
      let processedCount = 0;
      let thumbnailsGenerated = 0;
      let thumbnailsSkipped = 0;
      let errors = 0;
      
      const results = [];
      
      for (const video of approvedScriptVideos) {
        try {
          // Get reliable metadata first
          const metadata = await this.getReliableVideoMetadata(video.videoId);
          
          // Check if thumbnails already exist
          const existingThumbnails = await this.thumbnailService.checkExistingThumbnails(
            video.videoId, 
            metadata.title
          );
          
          if (existingThumbnails.exists) {
            logger.info(`✅ ${video.videoId}: Thumbnails already exist (${existingThumbnails.count} files)`);
            thumbnailsSkipped++;
            results.push({
              videoId: video.videoId,
              title: metadata.title,
              action: 'skipped',
              reason: `${existingThumbnails.count} thumbnails already exist`,
              thumbnailCount: existingThumbnails.count
            });
          } else {
            // Generate thumbnails for videos that don't have them
            logger.info(`🎨 ${video.videoId}: Generating missing thumbnails`);
            
            // Get complete video data for thumbnail generation
            const videoData = await this.youtubeService.getCompleteVideoData(video.youtubeUrl);
            videoData.videoId = video.videoId;
            
            // Generate thumbnails specifically
            const thumbnailResult = await this.thumbnailService.processVideoThumbnails(
              videoData, 
              video.videoId, 
              false, // Don't force regeneration
              this.sheetsService
            );
            
            if (thumbnailResult.success) {
              thumbnailsGenerated++;
              logger.info(`✅ ${video.videoId}: Generated ${thumbnailResult.generated} thumbnails successfully`);
              
              // Send Telegram notification for newly generated thumbnails
              await this.telegramService.sendMessage(
                '🎨 <b>Thumbnails Generated</b> (Retroactive)\n\n' +
                `🎬 ${video.videoId} - ${metadata.title}\n` +
                `📊 Status: ${video.status}\n` +
                `🖼️ Generated: ${thumbnailResult.generated} thumbnails\n` +
                `📁 [View Thumbnails](${thumbnailResult.driveFolder})\n` +
                '🔄 <i>Retroactive thumbnail generation completed</i>'
              );
              
              results.push({
                videoId: video.videoId,
                title: metadata.title,
                action: 'generated',
                thumbnailCount: thumbnailResult.generated,
                driveFolder: thumbnailResult.driveFolder
              });
            } else {
              errors++;
              results.push({
                videoId: video.videoId,
                title: metadata.title,
                action: 'failed',
                error: 'Thumbnail generation failed'
              });
            }
          }
          
          processedCount++;
        } catch (error) {
          logger.error(`Error processing approved script thumbnails for ${video.videoId}:`, error);
          errors++;
          results.push({
            videoId: video.videoId,
            title: video.title,
            action: 'error',
            error: error.message
          });
        }
      }

      logger.info(`🎨 Approved scripts thumbnail check completed: ${processedCount} processed, ${thumbnailsGenerated} generated, ${thumbnailsSkipped} skipped, ${errors} errors`);
      
      return { 
        success: true, 
        processed: processedCount, 
        total: approvedScriptVideos.length,
        breakdown: {
          thumbnailsGenerated,
          thumbnailsSkipped,
          errors
        },
        results
      };
    } catch (error) {
      logger.error('Error in processApprovedScriptsWithThumbnailCheck:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Process videos in "Ready for Review" status and auto-transition to "Approved" when Script Approved checkbox is checked
   * This handles the human approval workflow step
   */
  async processReadyForReview() {
    try {
      logger.info('👀 Processing videos ready for review...');
      
      const readyForReviewVideos = await this.getVideosByStatus('Ready for Review');
      
      if (readyForReviewVideos.length === 0) {
        logger.info('👀 No videos ready for review');
        return { success: true, processed: 0, message: 'No videos ready for review' };
      }

      logger.info(`👀 Found ${readyForReviewVideos.length} videos ready for review`);
      let processedCount = 0;
      
      for (const video of readyForReviewVideos) {
        try {
          // Check if Script Approved checkbox has been checked
          if (video.scriptApproved === true) {
            logger.info(`${video.videoId}: Script approved, transitioning to Approved status`);
            
            // Auto-transition: Ready for Review → Approved
            const transition = await this.autoTransitionStatus(
              video.videoId, 
              video.status, 
              true
            );
            
            if (transition.transitioned) {
              processedCount++;
              logger.info(`${video.videoId}: ${transition.fromStatus} → ${transition.toStatus}`);
              
              // Send notification about approval
              await this.telegramService.sendMessage(
                `✅ <b>Script Approved</b>\n\n🎬 ${video.title}\n📋 Status: ${transition.toStatus}\n🚀 Ready for image generation`
              );
            }
          } else {
            logger.debug(`${video.videoId}: Still awaiting human approval`);
          }
          
        } catch (error) {
          logger.error(`Error processing ready for review video ${video.videoId}:`, error);
        }
      }
      
      return { 
        success: true, 
        processed: processedCount, 
        total: readyForReviewVideos.length,
        message: `Processed ${processedCount}/${readyForReviewVideos.length} ready for review videos` 
      };
      
    } catch (error) {
      logger.error('Error in processReadyForReview:', error);
      throw error;
    }
  }

  /**
   * Process videos in Error status for retry logic
   * Automatically retries failed videos after a cooldown period with exponential backoff
   */
  async processErrorVideos() {
    try {
      logger.info('🔄 Processing error videos for retry...');
      
      const errorVideos = await this.getVideosByStatus('Error');
      
      if (errorVideos.length === 0) {
        logger.info('🔄 No error videos to retry');
        return { success: true, processed: 0, message: 'No error videos to retry' };
      }

      logger.info(`🔄 Found ${errorVideos.length} error videos`);
      let processedCount = 0;
      let retriedCount = 0;
      
      for (const video of errorVideos) {
        try {
          const retryCount = video.retryCount || 0;
          const maxRetries = 3;
          
          // Calculate exponential backoff cooldown (1h, 4h, 12h)
          const cooldownHours = Math.pow(2, retryCount) * 1; // 1, 2, 4, 8 hours
          const errorTime = new Date(video.errorTime || video.createdTime);
          const cooldownEnd = new Date(errorTime.getTime() + (cooldownHours * 60 * 60 * 1000));
          const now = new Date();
          
          // Check if still in cooldown period
          if (now < cooldownEnd) {
            const remainingMinutes = Math.ceil((cooldownEnd - now) / (60 * 1000));
            logger.debug(`${video.videoId}: Still in cooldown (${remainingMinutes}min remaining)`);
            processedCount++;
            continue;
          }
          
          // Check if max retries exceeded
          if (retryCount >= maxRetries) {
            logger.warn(`${video.videoId}: Max retries exceeded (${retryCount}/${maxRetries}), skipping`);
            processedCount++;
            continue;
          }
          
          logger.info(`${video.videoId}: Retrying (attempt ${retryCount + 1}/${maxRetries}) after ${cooldownHours}h cooldown`);
          
          // Reset status based on where the error occurred
          let resetStatus = 'New';
          if (video.errorStage === 'Script Processing') {
            resetStatus = 'Script Separated'; // Retry from script processing
          } else if (video.errorStage === 'Initial Processing') {
            resetStatus = 'New'; // Retry from beginning
          }
          
          // Reset video to appropriate status for retry
          await this.updateVideoStatus(video.videoId, resetStatus, {
            retryCount: retryCount + 1,
            lastRetryTime: this.getCurrentTimestamp(),
            errorMessage: null, // Clear previous error
            errorStage: null,
            errorTime: null
          });
          
          retriedCount++;
          logger.info(`${video.videoId}: Reset to ${resetStatus} for retry ${retryCount + 1}`);
          
          // Send retry notification with reliable metadata
          const retryMetadata = await this.getReliableVideoMetadata(video.videoId);
          
          await this.telegramService.sendMessage(
            '🔄 <b>Retry Attempt</b>\n\n' +
            `🎬 ${retryMetadata.title}\n` +
            `📊 Attempt: ${retryCount + 1}/${maxRetries}\n` +
            `⏰ After: ${cooldownHours}h cooldown\n` +
            `🔄 Reset to: ${resetStatus}`
          );
          
        } catch (error) {
          logger.error(`Error processing retry for video ${video.videoId}:`, error);
        }
        
        processedCount++;
      }
      
      return { 
        success: true, 
        processed: processedCount, 
        retried: retriedCount,
        total: errorVideos.length,
        message: `Processed ${processedCount}/${errorVideos.length} error videos, retried ${retriedCount}` 
      };
      
    } catch (error) {
      logger.error('Error in processErrorVideos:', error);
      throw error;
    }
  }

  // Video generation removed from automated workflow
  // Manual video generation will be handled outside this system

  async processNewUrl(youtubeUrl) {
    try {
      logger.info(`🎬 New URL: ${youtubeUrl}`);
      
      // Step 1: Extract YouTube data first
      const videoData = await this.youtubeService.getCompleteVideoData(youtubeUrl);
      videoData.youtubeUrl = youtubeUrl; // Ensure URL is included
      
      // Step 2: Create entry in Google Sheets with video metadata
      const videoId = await this.createVideoEntry(videoData);
      
      // Defensive programming: ensure video ID was created successfully
      if (!videoId) {
        throw new Error('Failed to create video entry - video ID is null/undefined');
      }
      
      logger.info(`📝 Created video entry with ID: ${videoId}`);
      
      // Step 3: Continue with workflow processing using the Google Sheets video ID
      const result = await this.processInitialVideo(videoData, videoId);
      
      return { success: true, videoData, videoId: videoId, ...result };
    } catch (error) {
      const safeError = this.safeErrorSerialization(error);
      logger.error('Error processing new URL:', safeError);
      throw error;
    }
  }

  async processInitialVideo(videoData, videoId) {
    try {
      // Defensive programming: ensure video ID is valid
      if (!videoId) {
        const errorMsg = 'Video ID is undefined or null in processInitialVideo';
        logger.error(errorMsg, {
          videoData: videoData ? {
            title: videoData.title,
            videoId: videoData.videoId,
            youtubeUrl: videoData.youtubeUrl
          } : 'undefined'
        });
        throw new Error(errorMsg);
      }
      
      // Ensure videoData is valid before proceeding
      if (!videoData || !videoData.title) {
        const errorMsg = 'Invalid video data in processInitialVideo';
        logger.error(errorMsg, {
          videoId,
          videoData: videoData ? Object.keys(videoData) : 'undefined'
        });
        throw new Error(errorMsg);
      }
      
      // The videoId is already in VID-XX format from Google Sheets
      const videoDisplayId = videoId;

      // Generate master sheet URL for status tracking
      const masterSheetUrl = this.telegramService.generateMasterSheetUrl(config.google.masterSheetId);
      
      // Save reliable metadata before processing starts
      await this.saveVideoMetadata(videoDisplayId, videoData);
      
      // Send initial processing notification (network-safe)
      try {
        // Use reliable metadata for Telegram notifications
        const videoMetadata = await this.getReliableVideoMetadata(videoDisplayId);
        
        // Use graceful notification that never fails the workflow
        await this.telegramService.sendNotificationSafe(
          `🎬 <b>Processing Started</b>\n\n📹 ${videoDisplayId} - ${videoMetadata.title}\n📺 ${videoData.channelTitle}\n⏱️ ${videoData.duration}${masterSheetUrl ? `\n\n📊 <a href="${masterSheetUrl}">View Master Sheet</a>` : ''}`,
          { parse_mode: 'HTML', disable_web_page_preview: true },
          `Video Processing Started: ${videoDisplayId}`
        );
        
        logger.info(`✅ Processing started notification sent for ${videoDisplayId}`);
      } catch (telegramError) {
        // This should never happen with sendNotificationSafe, but keep for safety
        logger.warn(`⚠️ Telegram notification failed for ${videoDisplayId}, but workflow continues:`, {
          error: telegramError.message,
          code: telegramError.code
        });
      }

      // Set the proper VideoID (VID-XX format) for Digital Ocean operations
      videoData.videoId = videoDisplayId;
      
      // Pass MetadataService to AIService for enhanced context reliability
      const enhancedContent = await this.aiService.enhanceContentWithAI(videoData, this.metadataService);

      // Get workbook URL using reliable metadata to prevent workflow failures
      let workbookUrl = null;
      try {
        const videoRow = await this.sheetsService.findVideoRow(videoDisplayId);
        workbookUrl = videoRow.data && videoRow.data[this.sheetsService.masterColumns.detailWorkbookUrl] 
          ? videoRow.data[this.sheetsService.masterColumns.detailWorkbookUrl]
          : null;
      } catch (error) {
        logger.warn(`Could not retrieve workbook URL for ${videoDisplayId}:`, error);
        // Continue workflow without workbook URL - Telegram notifications will adapt
      }
      
      // Use reliable metadata for consistent title display
      const scriptMetadata = await this.getReliableVideoMetadata(videoDisplayId);
      
      // MERGED: Script generated + keyword research notification (graceful degradation)
      await this.telegramService.sendNotificationSafe(
        this.buildScriptGeneratedMessage(videoDisplayId, scriptMetadata.title, workbookUrl, masterSheetUrl, enhancedContent.keywords),
        { parse_mode: 'HTML', disable_web_page_preview: true },
        `Script Generated: ${videoDisplayId}`
      );

      // Create complete hierarchical script structure (script pages + breakdown database)
      // Only create breakdown if script breakdown is enabled
      const scriptSentences = config.app.enableScriptBreakdown ? enhancedContent.scriptSentences : [];
      const imagePrompts = config.app.enableScriptBreakdown ? enhancedContent.imagePrompts : [];
      const editorKeywords = config.app.enableScriptBreakdown ? enhancedContent.editorKeywords : [];
      
      const scriptStructure = await this.createCompleteScriptStructure(
        videoId,
        videoData.title,
        videoData.transcriptText, // Original transcript
        enhancedContent.attractiveScript, // Optimized script
        scriptSentences,
        imagePrompts,
        editorKeywords
      );

      // Populate Video Info sheet with metadata and optimized content (not in master sheet)
      try {
        await this.sheetsService.populateVideoInfoSheet(videoId, videoData, enhancedContent);
        logger.info(`Video Info sheet populated for: ${videoData.title}`);
      } catch (error) {
        logger.warn('Failed to populate Video Info sheet:', error.message);
        // Don't fail the entire workflow if sheet population fails
      }

      // Update Analytics sheet with metrics
      try {
        await this.sheetsService.updateAnalyticsSheet(videoId, videoData);
        logger.info(`Analytics sheet updated for: ${videoData.title}`);
      } catch (error) {
        logger.warn('Failed to update Analytics sheet:', error.message);
        // Don't fail the entire workflow if analytics update fails
      }
      
      logger.info(`Complete script structure created successfully for: ${videoData.title}`);
      if (scriptStructure.originalScriptPage?.pageUrl) {
        logger.info(`- Original Script: ${scriptStructure.originalScriptPage.pageUrl}`);
      }
      if (scriptStructure.optimizedScriptPage?.pageUrl) {
        logger.info(`- Optimized Script: ${scriptStructure.optimizedScriptPage.pageUrl}`);
      }
      if (scriptStructure.scriptDatabase?.databaseUrl) {
        logger.info(`- Script Breakdown: ${scriptStructure.scriptDatabase.databaseUrl}`);
      }
      logger.info(`Script sentences: ${scriptSentences.length}`);
      logger.info(`Image prompts: ${imagePrompts.length}`);
      
      // Get navigation links for user-friendly notification using known URLs
      const knownUrls = {
        originalScript: scriptStructure.originalScriptPage?.pageUrl,
        optimizedScript: scriptStructure.optimizedScriptPage?.pageUrl,
        scriptBreakdown: scriptStructure.scriptDatabase?.databaseUrl
      };
      const navigationLinks = await this.getVideoNavigationLinks(videoId, knownUrls);
      
      // Send enhanced Telegram notification with hierarchical structure
      if (this.telegramService) {
        try {
          const breakdownEnabled = config.app.enableScriptBreakdown;
          await this.telegramService.sendMessage(
            '✅ Complete script structure created in Google Sheets!\n\n' +
            `📋 Video: ${videoDisplayId} - ${videoData.title}\n` +
            (breakdownEnabled ? `📊 Sentences: ${enhancedContent.scriptSentences.length}\n` : '') +
            (breakdownEnabled ? `🎨 Image Prompts: ${enhancedContent.imagePrompts.length}\n` : '🚫 Script breakdown disabled in configuration\n') +
            '\n📁 **Hierarchical Structure Created:**\n' +
            `🎬 [Main Video Record](${navigationLinks.links.mainVideo})\n` +
            `├── 📝 [Original Script](${navigationLinks.links.originalScript})\n` +
            `├── ✨ [Optimized Script](${navigationLinks.links.optimizedScript})\n` +
            (breakdownEnabled && navigationLinks.links.scriptBreakdown ? `└── 🎯 [Script Breakdown](${navigationLinks.links.scriptBreakdown})\n` : '') +
            '\n💡 *Navigate directly from the main video record to review scripts' + 
            (breakdownEnabled ? ' and access the detailed breakdown' : '') + '!*'
          );
        } catch (telegramError) {
          logger.warn('Failed to send Telegram notification:', telegramError.message);
        }
      }

      // Generate thumbnail concepts for optimization (if enabled)
      if (config.app.enableThumbnailConceptGeneration) {
        try {
          logger.info(`🎨 Pre-generating thumbnail concepts for ${videoDisplayId} (optimization)`);
          
          // Create video data object for thumbnail concept generation
          const thumbnailVideoData = {
            title: videoData.title,
            transcriptText: videoData.transcriptText,
            optimizedScript: enhancedContent.attractiveScript
          };
          
          // Generate and cache thumbnail concepts
          const conceptsJson = await this.thumbnailService.generateThumbnailConceptsForCaching(
            thumbnailVideoData, 
            videoDisplayId
          );
          
          // Store concepts in Google Sheets for later use
          await this.sheetsService.storeThumbnailConcepts(videoId, conceptsJson);
          
          logger.info(`✅ Cached thumbnail concepts for ${videoDisplayId} - will enable 90% faster thumbnail generation after approval`);
          
        } catch (conceptError) {
          logger.warn(`Failed to generate thumbnail concepts for ${videoDisplayId}:`, conceptError.message);
          // Don't fail the entire workflow if concept generation fails
        }
      } else {
        logger.info(`🎨 Thumbnail concept pre-generation disabled for ${videoDisplayId}`);
      }

      // Don't update master sheet with optimized content - it goes to Video Detail sheet
      // Only update basic video status in master sheet
      await this.updateVideoStatus(videoId, 'Script Separated');

      // Auto-transition: Script Separated → Ready for Review
      await this.autoTransitionStatus(videoId, 'Script Separated', false);

      // Auto-update workflow statuses after script generation
      await this.autoUpdateWorkflowStatuses(videoId, 'Script Separated');

      // Check if auto-approval is enabled
      if (config.app.autoApproveScripts) {
        logger.info(`Auto-approving script for: ${videoData.title}`);
        
        // Auto-approve the script
        await this.updateVideoStatus(videoId, 'Approved', {
          scriptApproved: true,
          autoApproved: true,
          approvedAt: this.getCurrentTimestamp()
        });
        
        // Use reliable metadata for auto-approval notification
        const approvalMetadata = await this.getReliableVideoMetadata(videoDisplayId);
        
        await this.telegramService.sendMessage(
          `✅ <b>Script Auto-Approved</b>\n\n🎬 ${videoDisplayId} - ${approvalMetadata.title}\n🤖 Automatically approved for processing`
        );
      } else {
        // Note: Script approval request now handled in the merged notification above
      }

      logger.info(`🎬 Initial processing completed for: ${videoData.title}`);
      this.stats.totalProcessed++;
      
      return {
        videoData,
        enhancedContent,
        scriptStructure, // Updated to return the complete structure
        videoId
      };
    } catch (error) {
      const safeError = this.safeErrorSerialization(error);
      logger.error('Error in processInitialVideo:', safeError);
      throw error;
    }
  }

  async processApprovedScript(videoInfo) {
    try {
      // Use reliable metadata for processing approved scripts
      const approvedMetadata = await this.getReliableVideoMetadata(videoInfo.videoId);
      logger.info(`🎨 Approved: ${approvedMetadata.title}`);

      const videoDisplayId = videoInfo.videoId;
      
      // Check if image generation is enabled
      if (!config.app.enableImageGeneration) {
        logger.info(`Image generation disabled - skipping image generation for ${videoDisplayId}`);
        
        // CRITICAL: Create voice script file even when image generation is disabled
        try {
          logger.info(`🎤 Creating voice script file (image generation disabled): ${videoDisplayId}`);
          const voiceScriptResult = await this.createAndUploadVoiceScript(videoDisplayId, false);
          
          if (voiceScriptResult && !voiceScriptResult.skipped) {
            logger.info(`✅ Voice script created successfully: ${voiceScriptResult.fileName}`);
          } else if (voiceScriptResult && voiceScriptResult.skipped) {
            logger.info(`ℹ️ Voice script already exists: ${voiceScriptResult.fileName}`);
          }
        } catch (voiceScriptError) {
          logger.error(`❌ Failed to create voice script for ${videoDisplayId}:`, voiceScriptError);
        }
        
        // Send notification with reliable metadata
        const completionMetadata = await this.getReliableVideoMetadata(videoInfo.videoId);
        
        // Get video details for Google Sheets link
        const videoDetails = await this.sheetsService.getVideoDetails(videoInfo.videoId);
        const viewRecordLink = videoDetails?.detailWorkbookUrl || 
                               `https://docs.google.com/spreadsheets/d/${config.google.masterSpreadsheetId}`;
        
        await this.telegramService.sendMessage(
          '✅ <b>Processing Completed</b> (Images Disabled)\n\n' +
          `🎬 ${videoDisplayId} - ${completionMetadata.title}\n` +
          '🚫 Image generation is disabled in configuration\n' +
          '📝 <i>Script is ready for voice generation</i>\n' +
          `🔗 [View Record](${viewRecordLink})`
        );

        // Update status to Completed without image generation
        await this.updateVideoStatus(videoInfo.videoId, 'Completed', {
          imagesGenerated: 0,
          imageGenerationSkipped: true,
          processingCompletedAt: this.getCurrentTimestamp(),
          note: 'Image generation disabled in configuration'
        });

        // Auto-update workflow statuses
        await this.autoUpdateWorkflowStatuses(videoInfo.videoId, 'Completed');

        return { success: true, stage: 'completed_no_images', imagesGenerated: 0 };
      }

      // DEPRECATED: 2025-01-10 - "Generating Images" status no longer used
      // await this.updateVideoStatus(videoInfo.videoId, 'Generating Images');

      // Get video data with proper video ID for cost tracking
      const videoData = await this.youtubeService.getCompleteVideoData(videoInfo.youtubeUrl);
      videoData.videoId = videoInfo.videoId;

      // Note: Google Drive folder structure is created automatically during image uploads
      logger.info(`Google Drive will create folder structure for video ${videoDisplayId} automatically`);

      // Enhanced AI content processing with new features
      // Pass MetadataService to AIService for enhanced context reliability
      const enhancedContent = await this.aiService.enhanceContentWithAI(videoData, this.metadataService);
      
      // CRITICAL: Create and upload voice script file when script is approved
      try {
        logger.info(`🎤 Creating voice script file for approved video: ${videoDisplayId}`);
        const voiceScriptResult = await this.createAndUploadVoiceScript(videoDisplayId, false);
        
        if (voiceScriptResult && !voiceScriptResult.skipped) {
          logger.info(`✅ Voice script created successfully: ${voiceScriptResult.fileName}`);
        } else if (voiceScriptResult && voiceScriptResult.skipped) {
          logger.info(`ℹ️ Voice script already exists: ${voiceScriptResult.fileName}`);
        }
      } catch (voiceScriptError) {
        logger.error(`❌ Failed to create voice script for ${videoDisplayId}:`, voiceScriptError);
        // Send notification but don't fail the entire workflow
        await this.telegramService.sendMessage(
          `⚠️ <b>Voice Script Creation Warning</b>\n\n🎬 ${videoDisplayId}\n❌ Error: ${voiceScriptError.message}\n\n🔄 Will attempt again during next processing cycle`
        );
      }

      // All images are already generated and uploaded to Digital Ocean by enhanceContentWithAI
      const generatedImages = enhancedContent.generatedImages || [];
      const imageUrls = generatedImages.map(img => img.uploadedUrl);
      
      // Update Script Details database with Digital Ocean image URLs
      if (imageUrls && imageUrls.length > 0) {
        try {
          await this.updateMultipleImageUrls(videoInfo.videoId, imageUrls);
          logger.info(`Updated Script Details database with ${imageUrls.length} image URLs from Digital Ocean`);
        } catch (error) {
          logger.warn('Failed to update Script Details with image URLs:', error.message);
          // Continue workflow even if database update fails
        }
      }

      // Send enhanced Telegram notification with cost information
      const costSummary = enhancedContent.costSummary;
      const folderName = `videos/${videoInfo.videoId}`;
      
      // Use reliable metadata for completion notification
      const finalMetadata = await this.getReliableVideoMetadata(videoInfo.videoId);
      
      await this.telegramService.sendMessage(
        '✅ <b>Processing Completed</b>\n\n' +
        `🎬 ${videoDisplayId} - ${finalMetadata.title}\n` +
        `📁 Folder: ${folderName}\n` +
        `🎨 Images Generated: ${generatedImages.length}\n` +
        `🏷️ Style: ${enhancedContent.videoStyle?.style || 'Custom'}\n` +
        `💰 Total Cost: $${costSummary.totalCost.toFixed(4)}\n` +
        '🖼️ Format: 1792x1024 (16:9 YouTube)\n' +
        '☁️ Storage: Digital Ocean Spaces\n\n' +
        `📊 <b>Full Flow Cost Breakdown:</b>\n${
          Object.entries(costSummary.breakdown)
            .map(([type, cost]) => `• ${type}: $${cost.toFixed(4)}`)
            .join('\n')
        }\n\n` +
        `💡 <i>Total processing cost for this video: $${costSummary.totalCost.toFixed(4)}</i>\n` +
        '📝 <i>Ready for voice generation - check Voice Status when complete</i>\n' +
        `🔗 [View Record](${await this.getVideoRecordLink(videoInfo.videoId)})`
      );

      // Thumbnail is already generated by enhanceContentWithAI
      const thumbnailResult = enhancedContent.thumbnail;
      if (thumbnailResult) {
        // Upload thumbnail to Digital Ocean if not already done
        const thumbnailFileName = `${videoInfo.videoId}_thumbnail.jpg`;
        try {
          const thumbnailUpload = await this.aiService.downloadAndUploadImage(
            thumbnailResult.url,
            thumbnailFileName,
            videoInfo.videoId,
            'thumbnails'
          );
          
          // Use reliable metadata for thumbnail notification
          const thumbnailMetadata = await this.getReliableVideoMetadata(videoInfo.videoId);
          
          await this.telegramService.sendMessage(
            '🖼️ <b>Thumbnail Generated</b>\n\n' +
            `🎬 Video: ${thumbnailMetadata.title}\n` +
            `🎨 Style: ${thumbnailResult.style}\n` +
            `📱 [View Thumbnail](${thumbnailUpload.cdnUrl})`
          );
        } catch (error) {
          logger.warn('Failed to upload thumbnail to Digital Ocean:', error.message);
          // Use original URL as fallback and get relevant URLs with reliable metadata
          const fallbackMetadata = await this.getReliableVideoMetadata(videoInfo.videoId);
          
          let workbookUrl = null;
          let driveFolderUrl = null;
          
          try {
            const videoRow = await this.sheetsService.findVideoRow(videoInfo.videoId);
            workbookUrl = videoRow.data && videoRow.data[this.sheetsService.masterColumns.detailWorkbookUrl] 
              ? videoRow.data[this.sheetsService.masterColumns.detailWorkbookUrl]
              : null;
            driveFolderUrl = videoRow.data && videoRow.data[this.sheetsService.masterColumns.driveFolder]
              ? videoRow.data[this.sheetsService.masterColumns.driveFolder]
              : null;
          } catch (error) {
            logger.warn(`Could not retrieve sheet URLs for ${videoInfo.videoId}:`, error);
          }
            
          await this.telegramService.sendThumbnailGenerated(
            fallbackMetadata.title,
            thumbnailResult.url,
            driveFolderUrl,
            workbookUrl
          );
        }
      }

      // NOTE: Thumbnail generation moved to AFTER script approval
      // This ensures proper workflow: Script Generation → Manual Approval → Thumbnail Generation
      logger.info(`🎨 Thumbnails will generate after script approval for ${videoDisplayId}`);

      // Update status to Completed with enhanced metadata (workflow ends here)
      await this.updateVideoStatus(videoInfo.videoId, 'Completed', {
        imagesGenerated: generatedImages.length,
        imageStyle: enhancedContent.videoStyle?.style,
        totalCost: costSummary.totalCost,
        imageFormat: '1920x1080',
        storageProvider: 'Digital Ocean Spaces',
        thumbnailUrl: thumbnailResult?.url,
        youtubeThumbnailsGenerated: youtubeThumbnailResults?.generated || 0,
        youtubeThumbnailsUploaded: youtubeThumbnailResults?.uploaded || 0,
        processingCompletedAt: this.getCurrentTimestamp()
      });

      // Auto-update workflow statuses after automation completion
      // Note: Video Editing Status will only update if Voice Generation Status is "Completed"
      await this.autoUpdateWorkflowStatuses(videoInfo.videoId, 'Completed', videoInfo.voiceGenerationStatus);

      logger.info(`🎨 Script processing completed for: ${videoInfo.title} (${generatedImages.length} images, $${costSummary.totalCost.toFixed(4)})`);
      
      return { 
        videoData, 
        enhancedContent, 
        imageUrls,
        generatedImages,
        thumbnailResult,
        youtubeThumbnailResults,
        costSummary 
      };
    } catch (error) {
      logger.error('Error in processApprovedScript:', error);
      throw error;
    }
  }

  // generateFinalVideo method removed - video generation is now manual

  async handleVideoError(video, error, stage) {
    try {
      // Use safe error serialization to avoid circular reference issues
      const safeError = this.safeErrorSerialization(error);
      
      // Ensure video object has required fields
      const videoId = video?.videoId || 'UNKNOWN';
      const videoTitle = video?.title || `Video ${videoId}`;
      
      // Update status with comprehensive error information
      await this.updateVideoStatus(videoId, 'Error', {
        errorMessage: safeError.message || error.message || 'Unknown error',
        errorStage: stage,
        errorTime: this.getCurrentTimestamp(),
        retryCount: (video.retryCount || 0) + 1,
        errorCode: error.code || 'UNKNOWN',
        errorType: safeError.type || 'Unknown'
      });

      // Get reliable metadata and URLs for error notification (with fallbacks)
      let errorMetadata;
      try {
        errorMetadata = await this.getReliableVideoMetadata(videoId);
      } catch (metadataError) {
        logger.warn(`Could not get reliable metadata for error ${videoId}:`, metadataError.message);
        errorMetadata = { title: videoTitle };
      }
      
      const masterSheetUrl = this.telegramService.generateMasterSheetUrl(config.google.masterSheetId);
      
      let workbookUrl = null;
      try {
        const videoRow = await this.sheetsService.findVideoRow(videoId);
        workbookUrl = videoRow.data && videoRow.data[this.sheetsService.masterColumns.detailWorkbookUrl] 
          ? videoRow.data[this.sheetsService.masterColumns.detailWorkbookUrl]
          : null;
      } catch (urlError) {
        logger.warn(`Could not retrieve workbook URL for error notification ${videoId}:`, urlError.message);
      }
      
      // Send error notification (network-safe)
      try {
        await this.telegramService.sendError(
          errorMetadata.title || videoTitle,
          safeError.message || error.message || 'Unknown error',
          stage,
          masterSheetUrl,
          workbookUrl
        );
      } catch (telegramError) {
        logger.warn(`Failed to send error notification for ${videoId}:`, telegramError.message);
        
        // Send simplified error notification as fallback
        await this.telegramService.sendMessageSafe(
          `❌ <b>Processing Error</b>\n\n🎬 ${videoId} - ${errorMetadata.title || videoTitle}\n🔧 Stage: ${stage}\n⚠️ ${(safeError.message || error.message || 'Unknown error').substring(0, 100)}...`
        );
      }

      this.stats.failed++;
      logger.error(`Video ${videoTitle} (${videoId}) failed at stage: ${stage}`, {
        ...safeError,
        videoId,
        videoTitle,
        stage,
        retryCount: (video.retryCount || 0) + 1
      });
    } catch (errorHandlingError) {
      const safeErrorHandlingError = this.safeErrorSerialization(errorHandlingError);
      logger.error('Error in error handling:', {
        ...safeErrorHandlingError,
        originalVideoId: video?.videoId || 'UNKNOWN',
        originalError: error?.message || 'Unknown original error'
      });
    }
  }

  async processTimeouts() {
    try {
      const pendingApprovals = await this.getVideosByStatus('Script Separated');
      const timeoutThreshold = 24 * 60 * 60 * 1000; // 24 hours
      let processedCount = 0;
      
      for (const video of pendingApprovals) {
        const createdTime = new Date(video.createdTime);
        const now = new Date();
        
        if (now - createdTime > timeoutThreshold) {
          // Use reliable metadata for timeout notification
          const timeoutMetadata = await this.getReliableVideoMetadata(video.videoId);
          const videoDisplayTitle = `${video.videoId} - ${timeoutMetadata.title}`;
          
          // Generate URLs for timeout notification
          const masterSheetUrl = this.telegramService.generateMasterSheetUrl(config.google.masterSheetId);
          
          let workbookUrl = null;
          try {
            const videoRow = await this.sheetsService.findVideoRow(video.videoId);
            workbookUrl = videoRow.data && videoRow.data[this.sheetsService.masterColumns.detailWorkbookUrl] 
              ? videoRow.data[this.sheetsService.masterColumns.detailWorkbookUrl]
              : null;
          } catch (urlError) {
            logger.warn(`Could not retrieve workbook URL for timeout notification ${video.videoId}:`, urlError);
          }
          
          await this.telegramService.sendApprovalTimeout(
            videoDisplayTitle, 
            24, 
            workbookUrl,
            masterSheetUrl
          );
          processedCount++;
          
          if (now - createdTime > timeoutThreshold * 2) { // 48 hours
            await this.updateVideoStatus(video.videoId, 'Timeout - Manual Review Required');
          }
        }
      }
      
      return { success: true, processed: processedCount, total: pendingApprovals.length };
    } catch (error) {
      logger.error('Error processing timeouts:', error);
      return { success: false, error: error.message };
    }
  }

  async generateDailySummary() {
    try {
      const [pending, processing, completed, failed] = await Promise.all([
        this.getVideosByStatus('Pending'),
        this.getVideosByStatus('Processing'),
        this.getVideosByStatus('Completed'),
        this.getVideosByStatus('Error')
      ]);

      const stats = {
        totalProcessed: this.stats.totalProcessed,
        successful: completed.length,
        failed: failed.length,
        pending: pending.length + processing.length,
        avgProcessingTime: 25, // Estimated
        estimatedCosts: this.stats.totalProcessed * 0.75 // Estimated cost per video
      };

      await this.telegramService.sendProcessingSummary(stats);
      
      // Reset daily stats
      this.stats = { totalProcessed: 0, successful: 0, failed: 0, pending: 0 };
      
      logger.info('Daily summary sent successfully');
    } catch (error) {
      logger.error('Error generating daily summary:', error);
    }
  }

  async processHealthCheck() {
    try {
      const checks = {
        youtube: false,
        googleSheets: false,
        googleDrive: false,
        ai: false,
        telegram: false
      };

      // Test YouTube API
      try {
        await this.youtubeService.extractVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
        checks.youtube = true;
      } catch (error) {
        logger.error('YouTube service health check failed:', error);
      }

      // Test Google Sheets API
      try {
        await this.sheetsService.healthCheck();
        checks.googleSheets = true;
      } catch (error) {
        logger.error('Google Sheets service health check failed:', error);
      }

      // Test Google Drive API
      try {
        await this.driveService.healthCheck();
        checks.googleDrive = true;
      } catch (error) {
        logger.error('Google Drive service health check failed:', error);
      }

      // Test AI Service
      try {
        await this.aiService.healthCheck();
        checks.ai = true;
      } catch (error) {
        logger.error('AI service health check failed:', error);
      }

      // Test Telegram
      try {
        checks.telegram = true; // Basic check - could ping bot
      } catch (error) {
        logger.error('Telegram service health check failed:', error);
      }

      const healthStatus = Object.values(checks).every(check => check);
      logger.info('Health check completed:', { checks, healthy: healthStatus });
      
      return { checks, healthy: healthStatus };
    } catch (error) {
      logger.error('Error in health check:', error);
      return { checks: {}, healthy: false };
    }
  }

  async processSingleVideo(video) {
    const videoId = typeof video === 'string' ? 'URL' : video.videoId;
    
    // Acquire lock to prevent concurrent processing
    const lockAcquired = await lockManager.acquireLock(videoId, 'videoProcessing', {
      holder: 'WorkflowService',
      reason: 'Processing single video'
    });
    
    if (!lockAcquired) {
      logger.warn(`🔒 ${videoId}: Video processing already in progress, skipping`);
      return { skipped: true, reason: 'Processing already in progress' };
    }
    
    try {
      logger.info(`🎯 Single video: ${video.title || video.youtubeUrl}`);
      
      let videoData;
      
      if (typeof video === 'string') {
        // It's a URL
        const result = await this.processNewUrl(video);
        return result;
      } else {
        // It's a video object from Google Sheets
        videoData = await this.youtubeService.getCompleteVideoData(video.youtubeUrl);
        
        // Update status to Processing
        await this.updateVideoStatus(videoId, 'Processing');
        
        // Auto-populate video entry with YouTube data
        await this.autoPopulateVideoData(videoId, videoData);
        
        // Process the video
        const result = await this.processInitialVideo(videoData, videoId);
        return { success: true, videoData, videoId: videoId, ...result };
      }
    } catch (error) {
      const safeError = this.safeErrorSerialization(error);
      logger.error('Error in processSingleVideo:', safeError);
      throw error;
    } finally {
      // Always release lock
      lockManager.releaseLock(videoId, 'videoProcessing');
    }
  }

  getProcessingStats() {
    return {
      ...this.stats,
      queueSize: this.processingQueue.size,
      timestamp: this.getCurrentTimestamp()
    };
  }

  /**
   * Get comprehensive cost summary for image generation
   * @returns {object} Cost tracking summary with savings analysis
   */
  getCostSummary() {
    const aiCostSummary = this.aiService.getCostSummary();
    
    return {
      ...aiCostSummary,
      // Add workflow-specific metrics
      systemStats: this.getProcessingStats(),
      costEfficiency: {
        costPerSuccessfulVideo: this.stats.successful > 0 ? 
          aiCostSummary.totalCost / this.stats.successful : 0,
        processingSuccess: this.stats.totalProcessed > 0 ? 
          (this.stats.successful / this.stats.totalProcessed) * 100 : 0
      },
      recommendations: this.generateCostRecommendations(aiCostSummary)
    };
  }

  /**
   * Generate cost optimization recommendations
   * @param {object} costSummary - Cost summary from AI service
   * @returns {Array} Array of recommendation strings
   */
  generateCostRecommendations(costSummary) {
    const recommendations = [];
    
    if (costSummary.averageCostPerVideo > config.app.maxImageCostPerVideo * 0.8) {
      recommendations.push('Consider reducing image generation limit for better cost control');
    }
    
    // Leonardo AI is already the most cost-effective option at ~$0.002/image
    if (costSummary.totalImagesGenerated > 100) {
      recommendations.push('Leonardo AI provides excellent cost efficiency at current generation volume');
    }
    
    if (costSummary.videoCount > 10 && costSummary.averageCostPerVideo < config.app.maxImageCostPerVideo * 0.5) {
      recommendations.push('Budget utilization is low - consider increasing image generation limit for higher quality');
    }
    
    return recommendations;
  }

  /**
   * Monitor manual status changes in Google Sheets and send notifications
   */
  async processStatusChanges() {
    try {
      logger.info('📊 Starting status change monitoring workflow...');
      
      const result = await this.statusMonitorService.monitorStatusChanges();
      
      if (result.changesDetected > 0) {
        logger.info(`Detected and notified ${result.changesDetected} manual status changes`);
        
        // Update processing stats
        this.stats.totalProcessed += result.changesDetected;
        
        return {
          success: true,
          message: `Processed ${result.changesDetected} status changes`,
          changes: result.changes
        };
      } else {
        return {
          success: true,
          message: 'No status changes detected',
          changes: []
        };
      }
      
    } catch (error) {
      logger.error('Error in status monitoring workflow:', error);
      
      // Try to send error notification
      try {
        await this.telegramService.sendError(
          'Status Monitoring System',
          error.message,
          'Status Change Detection'
        );
      } catch (notifyError) {
        logger.error('Failed to send status monitoring error notification:', notifyError);
      }
      
      return {
        success: false,
        message: 'Status monitoring failed',
        error: error.message
      };
    }
  }

  /**
   * Get status monitoring statistics and cache info
   */
  getStatusMonitoringStats() {
    try {
      return this.statusMonitorService.getMonitoringStats();
    } catch (error) {
      logger.error('Error getting status monitoring stats:', error);
      return {
        error: error.message,
        monitoringActive: false
      };
    }
  }

  /**
   * Force refresh status cache (for debugging/setup)
   */
  async refreshStatusCache() {
    try {
      return await this.statusMonitorService.refreshCache();
    } catch (error) {
      logger.error('Error refreshing status cache:', error);
      throw error;
    }
  }

  /**
   * Clear status cache (for debugging/reset)
   */
  async clearStatusCache() {
    try {
      return await this.statusMonitorService.clearCache();
    } catch (error) {
      logger.error('Error clearing status cache:', error);
      throw error;
    }
  }

  /**
   * Process thumbnails for approved scripts that may have missed thumbnail generation
   * This handles legacy videos and videos that had thumbnail generation disabled
   */
  async forceProcessThumbnailsForApprovedScripts(maxConcurrent = 2) {
    try {
      logger.info('🎨 Starting batch thumbnail processing for approved scripts...');
      
      const approvedVideos = await this.sheetsService.getVideosWithApprovedScripts();
      logger.info(`Found ${approvedVideos.length} videos with approved scripts`);
      
      if (approvedVideos.length === 0) {
        return {
          total: 0,
          processed: 0,
          results: [],
          breakdown: {
            thumbnailsGenerated: 0,
            thumbnailsSkipped: 0,
            errors: 0
          }
        };
      }
      
      const results = [];
      let thumbnailsGenerated = 0;
      let thumbnailsSkipped = 0;
      let errors = 0;
      
      // Process in batches to avoid API limits
      for (let i = 0; i < approvedVideos.length; i += maxConcurrent) {
        const batch = approvedVideos.slice(i, i + maxConcurrent);
        const batchNumber = Math.floor(i / maxConcurrent) + 1;
        const totalBatches = Math.ceil(approvedVideos.length / maxConcurrent);
        
        logger.info(`Processing batch ${batchNumber}/${totalBatches} (${batch.length} videos)`);
        
        const batchResults = await Promise.allSettled(
          batch.map(async (video) => {
            try {
              // Get reliable metadata for the video
              const metadata = await this.getReliableVideoMetadata(video.videoId);
              
              // Process thumbnails using enhanced ThumbnailService
              const thumbnailResult = await this.thumbnailService.processVideoThumbnails(
                metadata, 
                video.videoId, 
                false, // Don't force regeneration - skip if thumbnails exist
                this.sheetsService
              );
              
              if (thumbnailResult.skipped) {
                thumbnailsSkipped++;
                return {
                  videoId: video.videoId,
                  title: video.title,
                  action: 'skipped',
                  reason: thumbnailResult.message,
                  thumbnailCount: thumbnailResult.existing?.count || 0,
                  driveFolder: thumbnailResult.existing?.folderUrl || video.driveFolder
                };
              } else if (thumbnailResult.success) {
                thumbnailsGenerated += thumbnailResult.uploaded;
                return {
                  videoId: video.videoId,
                  title: video.title,
                  action: 'generated',
                  thumbnailCount: thumbnailResult.uploaded,
                  driveFolder: thumbnailResult.driveFolder || thumbnailResult.videoFolderUrl
                };
              } else {
                errors++;
                return {
                  videoId: video.videoId,
                  title: video.title,
                  action: 'failed',
                  error: thumbnailResult.error
                };
              }
              
            } catch (error) {
              errors++;
              logger.error(`Failed to process thumbnails for ${video.videoId}:`, error);
              return {
                videoId: video.videoId,
                title: video.title,
                action: 'failed',
                error: error.message
              };
            }
          })
        );
        
        // Process batch results
        batchResults.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            results.push(result.value);
          } else {
            const video = batch[index];
            errors++;
            results.push({
              videoId: video.videoId,
              title: video.title,
              action: 'failed',
              error: result.reason?.message || 'Batch processing failed'
            });
          }
        });
        
        // Brief pause between batches
        if (i + maxConcurrent < approvedVideos.length) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
      
      logger.info(`🎨 Batch thumbnail processing completed: ${thumbnailsGenerated} generated, ${thumbnailsSkipped} skipped, ${errors} errors`);
      
      return {
        total: approvedVideos.length,
        processed: results.length,
        results,
        breakdown: {
          thumbnailsGenerated,
          thumbnailsSkipped,
          errors
        }
      };
      
    } catch (error) {
      logger.error('Failed to process thumbnails for approved scripts:', error);
      throw error;
    }
  }

  /**
   * Check thumbnails for a specific video
   */
  async checkThumbnailsForVideo(videoId) {
    try {
      const videoDetails = await this.sheetsService.getVideoDetails(videoId);
      if (!videoDetails) {
        throw new Error(`Video not found: ${videoId}`);
      }
      
      return await this.thumbnailService.checkExistingThumbnails(videoId, videoDetails.title);
      
    } catch (error) {
      logger.error(`Failed to check thumbnails for ${videoId}:`, error);
      throw error;
    }
  }

  /**
   * Generate thumbnails for a specific video
   */
  async generateThumbnailsForVideo(videoId, forceRegenerate = false) {
    try {
      const metadata = await this.getReliableVideoMetadata(videoId);
      
      return await this.thumbnailService.processVideoThumbnails(
        metadata, 
        videoId, 
        forceRegenerate,
        this.sheetsService
      );
      
    } catch (error) {
      logger.error(`Failed to generate thumbnails for ${videoId}:`, error);
      throw error;
    }
  }

  /**
   * DEPRECATED: 2025-01-10 - "Generating Images" status no longer used
   * Validate "Generating Images" status and auto-advance if no images need generation
   * This method prevents workflow deadlocks by checking if any entries actually need generation
   * @param {string} videoId - Video identifier
   * @returns {Promise<object>} Validation result with auto-advance status
   * @deprecated No longer needed with automated asset downloads from Pexels
   */
  async validateAndAutoAdvanceImageGeneration(videoId) {
    try {
      logger.info(`🔍 Validating image generation status for ${videoId}`);
      
      // Get current video status
      const videoDetails = await this.sheetsService.getVideoDetails(videoId);
      if (!videoDetails) {
        throw new Error(`Video not found: ${videoId}`);
      }
      
      // Only apply deadlock prevention for "Generating Images" status
      if (videoDetails.status !== 'Generating Images') {
        return {
          needsAutoAdvance: false,
          currentStatus: videoDetails.status,
          message: `Video status is "${videoDetails.status}" - no deadlock prevention needed`
        };
      }
      
      // Check if any entries actually need image generation
      const entriesNeedingGeneration = await this.sheetsService.getEntriesNeedingImageGeneration(videoId);
      
      if (entriesNeedingGeneration.length > 0) {
        return {
          needsAutoAdvance: false,
          currentStatus: videoDetails.status,
          entriesNeedingGeneration: entriesNeedingGeneration.length,
          message: `${entriesNeedingGeneration.length} entries need image generation - processing should continue normally`
        };
      }
      
      // DEADLOCK DETECTED: Status is "Generating Images" but no entries need generation
      logger.info(`🚀 Deadlock detected for ${videoId}: Status is "Generating Images" but no entries need generation`);
      
      // Get reliable metadata for logging and notifications
      const metadata = await this.getReliableVideoMetadata(videoId);
      
      // Auto-advance to Completed status
      await this.updateVideoStatus(videoId, 'Completed', {
        imagesGenerated: 0,
        imageGenerationSkipped: true,
        autoAdvanced: true,
        autoAdvancedAt: this.getCurrentTimestamp(),
        autoAdvanceReason: 'Deadlock prevention - No entries with "Need Generate" status found',
        deadlockPrevention: true,
        processingCompletedAt: this.getCurrentTimestamp()
      });
      
      // CRITICAL: Create voice script file during auto-advance
      try {
        logger.info(`🎤 Creating voice script file (deadlock prevention): ${videoId}`);
        const voiceScriptResult = await this.createAndUploadVoiceScript(videoId, false);
        
        if (voiceScriptResult && !voiceScriptResult.skipped) {
          logger.info(`✅ Voice script created during deadlock prevention: ${voiceScriptResult.fileName}`);
        }
      } catch (voiceScriptError) {
        logger.error(`❌ Failed to create voice script during deadlock prevention for ${videoId}:`, voiceScriptError);
      }
      
      // Auto-update workflow statuses
      await this.autoUpdateWorkflowStatuses(videoId, 'Completed');
      
      // Send Telegram notification about deadlock prevention
      await this.telegramService.sendMessage(
        '🚀 <b>Deadlock Prevention Activated</b>\n\n' +
        `🎬 ${videoId} - ${metadata.title}\n` +
        '🔒 <b>Issue:</b> Workflow stuck on "Generating Images"\n' +
        '🔍 <b>Root Cause:</b> No entries with "Need Generate" status found\n' +
        '✅ <b>Resolution:</b> Auto-advanced to "Completed" status\n\n' +
        '💡 This prevents workflow deadlocks when no images actually need generation\n' +
        '📝 Voice script created and workflow ready for next steps\n\n' +
        `🔗 [View Record](${await this.getVideoRecordLink(videoId)})`
      );
      
      logger.info(`✅ Deadlock prevention completed for ${videoId}: Auto-advanced to Completed status`);
      
      return {
        needsAutoAdvance: true,
        autoAdvanced: true,
        previousStatus: 'Generating Images',
        newStatus: 'Completed',
        entriesNeedingGeneration: 0,
        message: 'Deadlock prevented - workflow auto-advanced to Completed status',
        voiceScriptCreated: true
      };
      
    } catch (error) {
      logger.error(`Failed to validate/auto-advance image generation for ${videoId}:`, error);
      return {
        needsAutoAdvance: false,
        error: error.message,
        message: `Validation failed: ${error.message}`
      };
    }
  }

  /**
   * Process selective image generation for entries with "Need Generate" status
   * @param {string} videoId - Video identifier
   * @returns {Promise<object>} Generation results
   */
  async processSelectiveImageGeneration(videoId) {
    try {
      logger.info(`🎨 Processing selective image generation for ${videoId}`);
      
      if (!config.app.enableImageGeneration) {
        logger.info(`Image generation disabled - skipping selective generation for ${videoId}`);
        return { generated: 0, message: 'Image generation disabled' };
      }

      // Get video metadata for context
      const metadata = await this.getReliableVideoMetadata(videoId);
      const videoDisplayId = metadata ? `${videoId} - ${metadata.title}` : videoId;

      // DEPRECATED: 2025-01-10 - "Generating Images" deadlock prevention no longer needed
      /*
      // DEADLOCK PREVENTION: First check if any entries actually need generation
      const entriesNeedingGeneration = await this.sheetsService.getEntriesNeedingImageGeneration(videoId);

      if (entriesNeedingGeneration.length === 0) {
        logger.info(`🚀 Auto-advancing workflow: No entries need image generation for ${videoDisplayId}`);

        // Check current video status to see if we need to advance workflow
        const videoDetails = await this.sheetsService.getVideoDetails(videoId);

        if (videoDetails && videoDetails.status === 'Generating Images') {
          // Auto-advance from "Generating Images" to "Completed" since no images need generation
          await this.updateVideoStatus(videoId, 'Completed', {
            imagesGenerated: 0,
            imageGenerationSkipped: true,
            autoAdvanced: true,
            autoAdvancedAt: this.getCurrentTimestamp(),
            autoAdvanceReason: 'No entries with "Need Generate" status found (manual trigger)',
            processingCompletedAt: this.getCurrentTimestamp()
          });

          // CRITICAL: Create voice script file during auto-advance
          try {
            logger.info(`🎤 Creating voice script file (manual auto-advance): ${videoId}`);
            const voiceScriptResult = await this.createAndUploadVoiceScript(videoId, false);

            if (voiceScriptResult && !voiceScriptResult.skipped) {
              logger.info(`✅ Voice script created during manual auto-advance: ${voiceScriptResult.fileName}`);
            }
          } catch (voiceScriptError) {
            logger.error(`❌ Failed to create voice script during manual auto-advance for ${videoId}:`, voiceScriptError);
          }

          // Auto-update workflow statuses
          await this.autoUpdateWorkflowStatuses(videoId, 'Completed');

          // Send notification about auto-advancement
          await this.telegramService.sendMessage(
            '🚀 <b>Workflow Auto-Advanced</b> (Manual Trigger)\n\n' +
            `🎬 ${videoDisplayId}\n` +
            '📊 Previous Status: Generating Images\n' +
            '✅ New Status: Completed\n\n' +
            '🔍 <b>Reason:</b> No entries with "Need Generate" status found\n' +
            '🔧 <b>Trigger:</b> Manual selective image generation call\n' +
            '💡 System automatically progressed to prevent workflow deadlock\n' +
            '📝 <i>Voice script created and ready for next steps</i>\n\n' +
            `🔗 [View Record](${await this.getVideoRecordLink(videoId)})`
          );

          return {
            generated: 0,
            autoAdvanced: true,
            message: 'No entries with "Need Generate" status - workflow auto-advanced to prevent deadlock'
          };
        }

        return {
          generated: 0,
          message: 'No entries with "Need Generate" status found'
        };
      }
      */

      // Use AI service to generate images selectively
      const generatedImages = await this.aiService.generateSelectiveImages(videoId, {
        googleSheetsService: this.sheetsService
      });

      if (generatedImages.length === 0) {
        logger.info(`No images generated for ${videoDisplayId} despite having entries needing generation`);
        return { generated: 0, message: 'Image generation failed or no valid prompts found' };
      }

      const totalCost = generatedImages.reduce((sum, img) => sum + (img.cost || 0), 0);

      // Send notification about completed image generation
      try {
        const message = `🎨 <b>Images Generated Successfully</b>

🎬 ${videoDisplayId}
📊 Generated: ${generatedImages.length} images
💰 Cost: $${totalCost.toFixed(4)}

Generated images for sentences: ${generatedImages.map(img => img.sentenceNumber).join(', ')}

✅ Images have been uploaded and links updated in Script Breakdown sheet.

📋 <a href="${metadata.detailWorkbookUrl || await this.getVideoRecordLink(videoId)}">View Script Breakdown</a>`;

        await this.telegramService.sendMessage(message, { parse_mode: 'HTML' });
      } catch (notificationError) {
        logger.warn(`Failed to send image generation notification for ${videoId}:`, notificationError.message);
      }

      logger.info(`✅ Generated ${generatedImages.length} images for ${videoDisplayId} (Cost: $${totalCost.toFixed(4)})`);
      
      return {
        generated: generatedImages.length,
        totalCost: totalCost,
        images: generatedImages,
        message: `Generated ${generatedImages.length} images successfully`
      };

    } catch (error) {
      logger.error(`Failed selective image generation for ${videoId}:`, error);
      
      // Send error notification
      try {
        const message = `❌ <b>Image Generation Failed</b>

🎬 ${videoId}
🚨 Error: ${error.message}

Please check logs and try again.`;

        await this.telegramService.sendMessage(message, { parse_mode: 'HTML' });
      } catch (notificationError) {
        logger.warn(`Failed to send error notification for ${videoId}:`, notificationError.message);
      }

      throw error;
    }
  }

  /**
   * Health check including Digital Ocean Spaces and Status Monitoring
   * @returns {Promise<object>} Health check results
   */
  async healthCheck() {
    const checks = {
      youtube: false,
      sheets: false,
      ai: false,
      telegram: false,
      googleDrive: false,
      statusMonitor: false,
      metadata: false
    };

    // Test YouTube API
    try {
      await this.youtubeService.healthCheck();
      checks.youtube = true;
    } catch (error) {
      logger.error('YouTube service health check failed:', error);
    }

    // Test Google Sheets API
    try {
      const sheetsHealth = await this.sheetsService.healthCheck();
      checks.sheets = sheetsHealth.status === 'healthy';
    } catch (error) {
      logger.error('Google Sheets service health check failed:', error);
    }

    // Test AI Service
    try {
      await this.aiService.healthCheck();
      checks.ai = true;
    } catch (error) {
      logger.error('AI service health check failed:', error);
    }

    // Test Telegram Bot
    try {
      await this.telegramService.healthCheck();
      checks.telegram = true;
    } catch (error) {
      logger.error('Telegram service health check failed:', error);
    }

    // Test Google Drive
    try {
      await this.aiService.googleDriveService.healthCheck();
      checks.googleDrive = true;
    } catch (error) {
      logger.error('Google Drive service health check failed:', error);
    }

    // Test Status Monitoring Service
    try {
      const statusHealth = await this.statusMonitorService.healthCheck();
      checks.statusMonitor = statusHealth.status === 'healthy';
    } catch (error) {
      logger.error('Status monitor service health check failed:', error);
    }

    // Test MetadataService (bulletproof metadata storage)
    try {
      const metadataHealth = await this.metadataService.healthCheck();
      checks.metadata = metadataHealth.status === 'healthy';
    } catch (error) {
      logger.error('Metadata service health check failed:', error);
    }

    const overallHealth = Object.values(checks).every(check => check);
    
    return {
      healthy: overallHealth,
      services: checks,
      timestamp: this.getCurrentTimestamp(),
      costSummary: this.getCostSummary(),
      statusMonitoring: this.getStatusMonitoringStats()
    };
  }

  /**
   * Get the appropriate Google Sheets/Drive link for a video record
   * @param {string} videoId - Video ID
   * @returns {Promise<string>} URL to view the video record
   */
  async getVideoRecordLink(videoId) {
    try {
      const videoDetails = await this.sheetsService.getVideoDetails(videoId);
      
      // Prefer detail workbook if available, otherwise use master spreadsheet
      if (videoDetails?.detailWorkbookUrl) {
        return videoDetails.detailWorkbookUrl;
      }
      
      // Fallback to master spreadsheet
      return `https://docs.google.com/spreadsheets/d/${config.google.masterSpreadsheetId}`;
      
    } catch (error) {
      logger.warn(`Failed to get video record link for ${videoId}:`, error.message);
      // Fallback to master spreadsheet
      return `https://docs.google.com/spreadsheets/d/${config.google.masterSpreadsheetId}`;
    }
  }

  /**
   * Helper method to build script generated message for Telegram
   */
  buildScriptGeneratedMessage(videoId, title, workbookUrl, masterSheetUrl, keywords) {
    let message = `✍️ <b>Script Generated & Approval Required</b>

🎬 ${videoId} - ${title}
✅ Script separated and ready for review`;

    // Add keyword information if available
    if (keywords) {
      const primaryKeywords = keywords.primaryKeywords?.slice(0, 3).join(', ') || '';
      const hashtags = keywords.trendingHashtags?.slice(0, 3).join(' ') || '';
      
      if (primaryKeywords || hashtags) {
        message += '\n\n🔍 <b>Keywords Applied:</b>';
        if (primaryKeywords) {
          message += `\n🎯 <code>${primaryKeywords}</code>`;
        }
        if (hashtags) {
          message += `\n📱 ${hashtags}`;
        }
      }
    }

    message += '\n\n⚠️ <b>Action Required:</b> Please review and approve script';

    // Add relevant links
    const links = [];
    if (workbookUrl) {
      links.push(`📋 <a href="${workbookUrl}">Review & Approve Script</a>`);
    }
    if (masterSheetUrl) {
      links.push(`📊 <a href="${masterSheetUrl}">Update Status in Master Sheet</a>`);
    }
    
    if (links.length > 0) {
      message += `\n\n${links.join('\n')}`;
    }
    
    return message;
  }
}

export default WorkflowService;