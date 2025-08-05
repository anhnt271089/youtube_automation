import YouTubeService from './youtubeService.js';
import NotionService from './notionService.js';
import GoogleDriveService from './googleDriveService.js';
import AIService from './aiService.js';
import TelegramService from './telegramService.js';
import VideoService from './videoService.js';
import logger from '../utils/logger.js';

class WorkflowService {
  constructor() {
    this.youtubeService = new YouTubeService();
    this.notionService = new NotionService();
    this.driveService = new GoogleDriveService();
    this.aiService = new AIService();
    this.telegramService = new TelegramService();
    this.videoService = new VideoService();
    
    this.processingQueue = new Map();
    this.stats = {
      totalProcessed: 0,
      successful: 0,
      failed: 0,
      pending: 0
    };
  }

  async processNewVideos() {
    try {
      logger.info('Starting new video processing cycle');
      
      const newVideos = await this.notionService.getVideosByStatus('New');
      
      if (newVideos.length === 0) {
        logger.info('No new videos to process');
        return { success: true, processed: 0, message: 'No new videos to process' };
      }

      logger.info(`Found ${newVideos.length} new videos to process`);
      let processedCount = 0;

      for (const video of newVideos) {
        try {
          await this.processSingleVideo(video);
          processedCount++;
        } catch (error) {
          logger.error(`Error processing video ${video.title}:`, error);
          await this.handleVideoError(video, error, 'Initial Processing');
        }
      }

      logger.info('New video processing cycle completed');
      return { success: true, processed: processedCount, total: newVideos.length };
    } catch (error) {
      logger.error('Error in processNewVideos:', error);
      return { success: false, error: error.message };
    }
  }

  async processApprovedScripts() {
    try {
      logger.info('Processing approved scripts');
      
      const approvedVideos = await this.notionService.getVideosByStatus('Approved');
      
      if (approvedVideos.length === 0) {
        logger.info('No approved scripts to process');
        return { success: true, processed: 0, message: 'No approved scripts to process' };
      }

      let processedCount = 0;
      for (const video of approvedVideos) {
        try {
          await this.processApprovedScript(video);
          processedCount++;
        } catch (error) {
          logger.error(`Error processing approved script for ${video.title}:`, error);
          await this.handleVideoError(video, error, 'Script Processing');
        }
      }

      logger.info('Approved script processing completed');
      return { success: true, processed: processedCount, total: approvedVideos.length };
    } catch (error) {
      logger.error('Error in processApprovedScripts:', error);
      return { success: false, error: error.message };
    }
  }

  async processVideoGeneration() {
    try {
      logger.info('Processing video generation queue');
      
      const readyVideos = await this.notionService.getVideosByStatus('Video Generated');
      
      if (readyVideos.length === 0) {
        logger.info('No videos ready for generation');
        return { success: true, processed: 0, message: 'No videos ready for generation' };
      }

      let processedCount = 0;
      for (const video of readyVideos) {
        try {
          await this.generateFinalVideo(video);
          processedCount++;
        } catch (error) {
          logger.error(`Error generating video for ${video.title}:`, error);
          await this.handleVideoError(video, error, 'Video Generation');
        }
      }

      logger.info('Video generation processing completed');
      return { success: true, processed: processedCount, total: readyVideos.length };
    } catch (error) {
      logger.error('Error in processVideoGeneration:', error);
      return { success: false, error: error.message };
    }
  }

  async processNewUrl(youtubeUrl) {
    try {
      logger.info(`Processing new URL: ${youtubeUrl}`);
      
      // Step 1: Create initial Notion entry with just the URL
      const notionEntry = await this.notionService.addVideoUrl(youtubeUrl);
      
      // Step 2: Extract YouTube data
      const videoData = await this.youtubeService.getCompleteVideoData(youtubeUrl);
      
      // Step 3: Auto-populate Notion entry with YouTube data
      await this.notionService.autoPopulateVideoData(notionEntry.id, videoData);

      // Step 4: Continue with workflow processing
      const result = await this.processInitialVideo(videoData, notionEntry.id);
      
      return { success: true, videoData, notionId: notionEntry.id, ...result };
    } catch (error) {
      logger.error('Error processing new URL:', error);
      throw error;
    }
  }

  async processInitialVideo(videoData, notionPageId) {
    try {
      await this.telegramService.sendVideoProcessingStarted(videoData);

      const driveFolder = await this.driveService.createVideoFolder(
        videoData.title, 
        videoData.videoId
      );

      const enhancedContent = await this.aiService.enhanceContentWithAI(videoData);

      await this.telegramService.sendScriptGenerated(
        videoData.title, 
        enhancedContent.attractiveScript
      );

      await this.telegramService.sendKeywordResearchResults(
        videoData.title, 
        enhancedContent.keywords
      );

      let spreadsheet = null;
      try {
        spreadsheet = await this.driveService.createScriptBreakdownSheet(
          videoData.title,
          videoData.videoId,
          driveFolder.folderId
        );

        await this.driveService.updateScriptBreakdown(
          spreadsheet.spreadsheetId,
          enhancedContent.scriptSentences,
          enhancedContent.imagePrompts
        );
        
        logger.info('Script breakdown sheet created successfully');
        logger.info(`View spreadsheet: ${spreadsheet.spreadsheetUrl}`);
        
        // Send Telegram notification about successful sheet creation
        if (this.telegramService) {
          try {
            await this.telegramService.sendMessage(
              `✅ Script breakdown sheet created successfully!\n\n` +
              `📋 Video: ${videoData.title}\n` +
              `📊 Sentences: ${enhancedContent.scriptSentences.length}\n` +
              `🔗 Spreadsheet: ${spreadsheet.spreadsheetUrl}`
            );
          } catch (telegramError) {
            logger.warn('Failed to send Telegram notification:', telegramError.message);
          }
        }
        
      } catch (error) {
        if (error.code === 'SHEETS_API_DISABLED') {
          logger.error('🚨 GOOGLE SHEETS API NOT ENABLED 🚨');
          logger.error('Script breakdown sheets cannot be created until you enable the Google Sheets API.');
          logger.error('📋 SOLUTION: See GOOGLE_SHEETS_SETUP.md file for step-by-step instructions.');
          
          // Send Telegram alert about missing API
          if (this.telegramService) {
            try {
              await this.telegramService.sendMessage(
                `🚨 GOOGLE SHEETS API REQUIRED 🚨\n\n` +
                `Script breakdown sheets are not being created because the Google Sheets API is not enabled.\n\n` +
                `📋 TO FIX:\n` +
                `1. Go to: https://console.cloud.google.com/apis/library\n` +
                `2. Search for "Google Sheets API"\n` +
                `3. Click "ENABLE"\n\n` +
                `📄 See GOOGLE_SHEETS_SETUP.md for detailed instructions.\n\n` +
                `Video processing will continue without spreadsheets.`
              );
            } catch (telegramError) {
              logger.warn('Failed to send Telegram alert:', telegramError.message);
            }
          }
          
        } else {
          logger.warn('Failed to create script breakdown sheet:', error.message);
        }
        
        // Continue without spreadsheet - it's not critical for the workflow
        spreadsheet = { 
          error: error.message,
          apiDisabled: error.code === 'SHEETS_API_DISABLED',
          fallbackMessage: 'Script breakdown will be handled manually'
        };
      }

      await this.notionService.updateVideoStatus(notionPageId, 'Script Generated', {
        optimizedTitle: enhancedContent.optimizedTitles.recommended,
        optimizedDescription: enhancedContent.optimizedDescription,
        keywords: enhancedContent.keywords.primaryKeywords,
        driveFolder: driveFolder.folderUrl
      });

      await this.telegramService.sendScriptApprovalRequest(
        videoData.title,
        `https://notion.so/${notionPageId.replace(/-/g, '')}`
      );

      logger.info(`Initial processing completed for: ${videoData.title}`);
      this.stats.totalProcessed++;
      
      return {
        videoData,
        enhancedContent,
        driveFolder,
        spreadsheet,
        notionPageId
      };
    } catch (error) {
      logger.error('Error in processInitialVideo:', error);
      throw error;
    }
  }

  async processApprovedScript(videoInfo) {
    try {
      logger.info(`Processing approved script for: ${videoInfo.title}`);

      await this.notionService.updateVideoStatus(videoInfo.id, 'Generating Images');

      const videoData = await this.youtubeService.getCompleteVideoData(videoInfo.youtubeUrl);
      const enhancedContent = await this.aiService.enhanceContentWithAI(videoData);

      const { imageUrls } = await this.videoService.generateImagesFromPrompts(
        enhancedContent.imagePrompts,
        this.aiService
      );

      await this.telegramService.sendImageGenerationUpdate(
        videoInfo.title,
        imageUrls.length,
        enhancedContent.imagePrompts.length
      );

      const thumbnailResult = await this.aiService.generateThumbnail(
        enhancedContent.optimizedTitles.recommended,
        enhancedContent.attractiveScript
      );

      await this.telegramService.sendThumbnailGenerated(
        videoInfo.title,
        thumbnailResult.url
      );

      await this.notionService.updateVideoStatus(videoInfo.id, 'Video Generated', {
        thumbnailUrl: thumbnailResult.url
      });

      logger.info(`Script processing completed for: ${videoInfo.title}`);
      return { videoData, enhancedContent, imageUrls, thumbnailResult };
    } catch (error) {
      logger.error('Error in processApprovedScript:', error);
      throw error;
    }
  }

  async generateFinalVideo(videoInfo) {
    try {
      logger.info(`Generating final video for: ${videoInfo.title}`);

      await this.notionService.updateVideoStatus(videoInfo.id, 'Video Generated');

      const videoData = await this.youtubeService.getCompleteVideoData(videoInfo.youtubeUrl);
      const enhancedContent = await this.aiService.enhanceContentWithAI(videoData);

      const videoResult = await this.videoService.createCompleteVideo(
        videoData,
        enhancedContent,
        this.aiService
      );

      const driveVideoFile = await this.driveService.uploadFile(
        videoResult.videoPath,
        videoResult.filename,
        videoInfo.driveFolder,
        'video/mp4'
      );

      await this.notionService.updateVideoStatus(videoInfo.id, 'Completed', {
        finalVideoUrl: driveVideoFile.webViewLink,
        processingCompleted: new Date().toISOString()
      });

      await this.telegramService.sendVideoCompleted(
        { ...videoData, optimizedTitle: enhancedContent.optimizedTitles.recommended },
        videoInfo.driveFolder,
        driveVideoFile.webViewLink
      );

      this.stats.successful++;
      logger.info(`Video generation completed for: ${videoInfo.title}`);
      
      return { videoResult, driveVideoFile };
    } catch (error) {
      logger.error('Error in generateFinalVideo:', error);
      throw error;
    }
  }

  async handleVideoError(video, error, stage) {
    try {
      await this.notionService.updateVideoStatus(video.id, 'Failed', {
        errorMessage: error.message,
        errorStage: stage,
        errorTime: new Date().toISOString()
      });

      await this.telegramService.sendError(
        video.title,
        error.message,
        stage
      );

      this.stats.failed++;
      logger.error(`Video ${video.title} failed at stage: ${stage}`);
    } catch (errorHandlingError) {
      logger.error('Error in error handling:', errorHandlingError);
    }
  }

  async processTimeouts() {
    try {
      const pendingApprovals = await this.notionService.getVideosByStatus('Script Generated');
      const timeoutThreshold = 24 * 60 * 60 * 1000; // 24 hours
      let processedCount = 0;
      
      for (const video of pendingApprovals) {
        const createdTime = new Date(video.createdTime);
        const now = new Date();
        
        if (now - createdTime > timeoutThreshold) {
          await this.telegramService.sendApprovalTimeout(video.title, 24);
          processedCount++;
          
          if (now - createdTime > timeoutThreshold * 2) { // 48 hours
            await this.notionService.updateVideoStatus(video.id, 'Timeout - Manual Review Required');
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
        this.notionService.getVideosByStatus('Pending'),
        this.notionService.getVideosByStatus('Processing'),
        this.notionService.getVideosByStatus('Completed'),
        this.notionService.getVideosByStatus('Failed')
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
        drive: false,
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

      // Test Notion API
      try {
        await this.notionService.getVideosByStatus('New');
        checks.notion = true;
      } catch (error) {
        logger.error('Notion service health check failed:', error);
      }

      // Test Google Drive API
      try {
        await this.driveService.healthCheck();
        checks.drive = true;
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
    try {
      logger.info(`Processing single video: ${video.title || video.youtubeUrl}`);
      
      let videoData;
      let notionPageId;
      
      if (typeof video === 'string') {
        // It's a URL
        const result = await this.processNewUrl(video);
        return result;
      } else {
        // It's a video object from Notion
        videoData = await this.youtubeService.getCompleteVideoData(video.youtubeUrl);
        notionPageId = video.id;
        
        // Update status to Processing
        await this.notionService.updateVideoStatus(notionPageId, 'Processing');
        
        // Process the video
        const result = await this.processInitialVideo(videoData, notionPageId);
        return { success: true, videoData, notionId: notionPageId, ...result };
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
      timestamp: new Date().toISOString()
    };
  }
}

export default WorkflowService;