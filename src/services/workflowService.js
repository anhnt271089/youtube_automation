import YouTubeService from './youtubeService.js';
import GoogleSheetsService from './googleSheetsService.js';
import GoogleDriveService from './googleDriveService.js';
import AIService from './aiService.js';
import TelegramService from './telegramService.js';
import VideoService from './videoService.js';
import StatusMonitorService from './statusMonitorService.js';
import MetadataService from './metadataService.js';
import ThumbnailService from './thumbnailService.js';
import { config } from '../../config/config.js';
import logger from '../utils/logger.js';

class WorkflowService {
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
    this.statusMonitorService = new StatusMonitorService();
    
    // Initialize MetadataService with service dependencies for fallback
    this.metadataService = new MetadataService(this.sheetsService, this.youtubeService);
    
    // Initialize ThumbnailService with required dependencies
    this.thumbnailService = new ThumbnailService(this.aiService, this.driveService);
    
    // Metadata cache for workflow efficiency
    this.metadataCache = new Map();
    
    this.processingQueue = new Map();
    this.stats = {
      totalProcessed: 0,
      successful: 0,
      failed: 0,
      pending: 0
    };
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

  async autoTransitionStatus(videoId, status, _scriptApproved = false) {
    // Simple status transition - Google Sheets doesn't have complex state logic
    return true;
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
      
      // Process both "Approved" and "Generating Images" status videos to handle interrupted workflows
      const [approvedVideos, generatingVideos] = await Promise.all([
        this.sheetsService.getVideosByStatus('Approved'),
        this.sheetsService.getVideosByStatus('Generating Images')
      ]);
      
      const allVideosToProcess = [...approvedVideos, ...generatingVideos];
      
      if (allVideosToProcess.length === 0) {
        logger.info('✅ No approved scripts to process');
        return { success: true, processed: 0, message: 'No approved scripts to process' };
      }

      logger.info(`✅ Found ${approvedVideos.length} approved + ${generatingVideos.length} generating`);
      let processedCount = 0;
      
      for (const video of allVideosToProcess) {
        try {
          if (video.status === 'Generating Images') {
            logger.info(`🔄 Resuming ${video.videoId}`);
          }
          await this.processApprovedScript(video);
          processedCount++;
        } catch (error) {
          logger.error(`Error processing approved script for ${video.videoId} - ${video.title}:`, error);
          await this.handleVideoError(video, error, 'Script Processing');
        }
      }

      logger.info('✅ Scripts completed');
      return { 
        success: true, 
        processed: processedCount, 
        total: allVideosToProcess.length,
        breakdown: {
          approvedScripts: approvedVideos.length,
          resumedImageGeneration: generatingVideos.length
        }
      };
    } catch (error) {
      logger.error('Error in processApprovedScripts:', error);
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
              'Ready for Review', 
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
      
      // Step 3: Continue with workflow processing using the Google Sheets video ID
      const result = await this.processInitialVideo(videoData, videoId);
      
      return { success: true, videoData, videoId: videoId, ...result };
    } catch (error) {
      logger.error('Error processing new URL:', error);
      throw error;
    }
  }

  async processInitialVideo(videoData, videoId) {
    try {
      // The videoId is already in VID-XX format from Google Sheets
      const videoDisplayId = videoId;

      // Generate master sheet URL for status tracking
      const masterSheetUrl = this.telegramService.generateMasterSheetUrl(config.google.masterSheetId);
      
      // Save reliable metadata before processing starts
      await this.saveVideoMetadata(videoDisplayId, videoData);
      
      // Use reliable metadata for Telegram notifications
      const videoMetadata = await this.getReliableVideoMetadata(videoDisplayId);
      
      await this.telegramService.sendVideoProcessingStarted({
        ...videoData,
        ...videoMetadata, // Override with reliable metadata
        recordId: videoDisplayId,
        displayTitle: `${videoDisplayId} - ${videoMetadata.title}`
      }, masterSheetUrl);

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
      
      await this.telegramService.sendScriptGenerated(
        `${videoDisplayId} - ${scriptMetadata.title}`, 
        enhancedContent.attractiveScript,
        workbookUrl,
        masterSheetUrl
      );

      // Use reliable metadata for keyword research results
      const keywordMetadata = await this.getReliableVideoMetadata(videoDisplayId);
      
      await this.telegramService.sendKeywordResearchResults(
        `${videoDisplayId} - ${keywordMetadata.title}`, 
        enhancedContent.keywords
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
            '✅ Complete script structure created in Notion!\n\n' +
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
        // Get URLs for approval request with reliable metadata
        const masterSheetUrl = this.telegramService.generateMasterSheetUrl(config.google.masterSheetId);
        const workbookUrl = scriptStructure.originalScriptPage?.pageUrl || null;
        const requestMetadata = await this.getReliableVideoMetadata(videoDisplayId);
        
        await this.telegramService.sendScriptApprovalRequest(
          `${videoDisplayId} - ${requestMetadata.title}`,
          workbookUrl,
          masterSheetUrl
        );
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
      logger.error('Error in processInitialVideo:', error);
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
        
        // Send notification with reliable metadata
        const completionMetadata = await this.getReliableVideoMetadata(videoInfo.videoId);
        
        await this.telegramService.sendMessage(
          '✅ <b>Processing Completed</b> (Images Disabled)\n\n' +
          `🎬 ${videoDisplayId} - ${completionMetadata.title}\n` +
          '🚫 Image generation is disabled in configuration\n' +
          '📝 <i>Script is ready for voice generation</i>\n' +
          `🔗 [View Record](https://notion.so/${videoInfo.videoId.replace(/-/g, '')})`
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

      await this.updateVideoStatus(videoInfo.videoId, 'Generating Images');

      // Get video data with proper video ID for cost tracking
      const videoData = await this.youtubeService.getCompleteVideoData(videoInfo.youtubeUrl);
      videoData.videoId = videoInfo.videoId;

      // Create Digital Ocean folder structure for this video
      try {
        await this.aiService.digitalOceanService.createVideoFolder(videoDisplayId);
        logger.info(`Created Digital Ocean folder structure for video ${videoDisplayId}`);
      } catch (error) {
        logger.warn('Failed to create Digital Ocean folder structure:', error.message);
        // Continue processing
      }

      // Enhanced AI content processing with new features
      // Pass MetadataService to AIService for enhanced context reliability
      const enhancedContent = await this.aiService.enhanceContentWithAI(videoData, this.metadataService);

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
        `🔗 [View Record](https://notion.so/${videoInfo.videoId.replace(/-/g, '')})`
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

      // Generate 2 YouTube thumbnails and upload to Google Drive
      let youtubeThumbnailResults = null;
      if (config.app.enableThumbnailGeneration !== false) { // Default enabled if not explicitly disabled
        try {
          logger.info(`🎨 Generating 2 YouTube thumbnails for ${videoDisplayId}`);
          
          await this.updateVideoStatus(videoInfo.videoId, null, {
            thumbnailGenerationStatus: 'Generating'
          });
          
          // Generate and upload 2 thumbnails
          youtubeThumbnailResults = await this.thumbnailService.processVideoThumbnails(videoData, videoDisplayId);
          
          // Update status with results
          await this.updateVideoStatus(videoInfo.videoId, null, {
            thumbnailGenerationStatus: `Completed (${youtubeThumbnailResults.uploaded}/${youtubeThumbnailResults.generated})`,
            thumbnail1Url: youtubeThumbnailResults.thumbnails.thumbnail1?.upload?.directLink || null,
            thumbnail2Url: youtubeThumbnailResults.thumbnails.thumbnail2?.upload?.directLink || null,
            thumbnailDriveFolder: youtubeThumbnailResults.driveFolder
          });
          
          // Use reliable metadata for thumbnail notification
          const youtubeThumbnailMetadata = await this.getReliableVideoMetadata(videoInfo.videoId);
          
          await this.telegramService.sendMessage(
            '🎨 <b>YouTube Thumbnails Generated</b>\n\n' +
            `🎬 ${videoDisplayId} - ${youtubeThumbnailMetadata.title}\n` +
            `🖼️ Generated: ${youtubeThumbnailResults.generated} thumbnails\n` +
            `✅ Uploaded: ${youtubeThumbnailResults.uploaded} successfully\n` +
            `📐 Size: ${youtubeThumbnailResults.specifications.width}x${youtubeThumbnailResults.specifications.height}\n` +
            `🎨 Styles: ${youtubeThumbnailResults.thumbnails.thumbnail1.style} & ${youtubeThumbnailResults.thumbnails.thumbnail2.style}\n` +
            `📁 [Drive Folder](${youtubeThumbnailResults.driveFolder})\n\n` +
            '💡 <i>Both thumbnails ready for YouTube upload</i>'
          );
          
          logger.info(`🎨 YouTube thumbnails completed for ${videoDisplayId}: ${youtubeThumbnailResults.uploaded}/${youtubeThumbnailResults.generated} uploaded`);
          
        } catch (thumbnailError) {
          logger.error(`❌ Failed to generate YouTube thumbnails for ${videoDisplayId}:`, thumbnailError);
          
          await this.updateVideoStatus(videoInfo.videoId, null, {
            thumbnailGenerationStatus: 'Failed',
            thumbnailError: thumbnailError.message
          });
          
          // Send error notification
          const thumbnailErrorMetadata = await this.getReliableVideoMetadata(videoInfo.videoId);
          await this.telegramService.sendMessage(
            '❌ <b>Thumbnail Generation Failed</b>\n\n' +
            `🎬 ${videoDisplayId} - ${thumbnailErrorMetadata.title}\n` +
            `🚨 Error: ${thumbnailError.message}\n\n` +
            '💡 <i>Processing continues - thumbnails can be generated manually</i>'
          );
        }
      } else {
        logger.info(`Thumbnail generation disabled for ${videoDisplayId}`);
        await this.updateVideoStatus(videoInfo.videoId, null, {
          thumbnailGenerationStatus: 'Disabled'
        });
      }

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
      await this.updateVideoStatus(video.videoId, 'Error', {
        errorMessage: error.message,
        errorStage: stage,
        errorTime: this.getCurrentTimestamp(),
        retryCount: (video.retryCount || 0) + 1
      });

      // Get reliable metadata and URLs for error notification
      const errorMetadata = await this.getReliableVideoMetadata(video.videoId);
      const masterSheetUrl = this.telegramService.generateMasterSheetUrl(config.google.masterSheetId);
      
      let workbookUrl = null;
      try {
        const videoRow = await this.sheetsService.findVideoRow(video.videoId);
        workbookUrl = videoRow.data && videoRow.data[this.sheetsService.masterColumns.detailWorkbookUrl] 
          ? videoRow.data[this.sheetsService.masterColumns.detailWorkbookUrl]
          : null;
      } catch (urlError) {
        logger.warn(`Could not retrieve workbook URL for error notification ${video.videoId}:`, urlError);
      }
      
      await this.telegramService.sendError(
        errorMetadata.title,
        error.message,
        stage,
        masterSheetUrl,
        workbookUrl
      );

      this.stats.failed++;
      logger.error(`Video ${video.title} failed at stage: ${stage}`);
    } catch (errorHandlingError) {
      logger.error('Error in error handling:', errorHandlingError);
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
        notion: false,
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

      // Test Notion API (both databases)
      try {
        await this.healthCheck();
        checks.notion = true;
      } catch (error) {
        logger.error('Notion service health check failed:', error);
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
        const videoId = video.videoId;
        
        // Update status to Processing
        await this.updateVideoStatus(videoId, 'Processing');
        
        // Auto-populate video entry with YouTube data
        await this.autoPopulateVideoData(videoId, videoData);
        
        // Process the video
        const result = await this.processInitialVideo(videoData, videoId);
        return { success: true, videoData, videoId: videoId, ...result };
      }
    } catch (error) {
      logger.error('Error in processSingleVideo:', error);
      throw error;
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
      recommendations.push('Consider reducing image generation limit or using DALL-E 2 for better cost control');
    }
    
    if (costSummary.totalImagesGenerated > 0) {
      const currentModel = config.app.imageModel;
      if (currentModel === 'dall-e-3') {
        const savings = costSummary.totalImagesGenerated * 
          (this.aiService.imagePricing['dall-e-3'] - this.aiService.imagePricing['dall-e-2']);
        recommendations.push(`Switch to DALL-E 2 could save $${savings.toFixed(2)} total`);
      }
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
   * Health check including Digital Ocean Spaces and Status Monitoring
   * @returns {Promise<object>} Health check results
   */
  async healthCheck() {
    const checks = {
      youtube: false,
      sheets: false,
      ai: false,
      telegram: false,
      digitalOcean: false,
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

    // Test Digital Ocean Spaces
    try {
      await this.aiService.digitalOceanService.healthCheck();
      checks.digitalOcean = true;
    } catch (error) {
      logger.error('Digital Ocean service health check failed:', error);
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
}

export default WorkflowService;