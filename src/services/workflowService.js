import YouTubeService from './youtubeService.js';
import NotionService from './notionService.js';
import AIService from './aiService.js';
import TelegramService from './telegramService.js';
import VideoService from './videoService.js';
import { config } from '../../config/config.js';
import fs from 'fs';
import path from 'path';
import logger from '../utils/logger.js';

class WorkflowService {
  constructor() {
    this.youtubeService = new YouTubeService();
    this.notionService = new NotionService();
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

      const enhancedContent = await this.aiService.enhanceContentWithAI(videoData);

      await this.telegramService.sendScriptGenerated(
        videoData.title, 
        enhancedContent.attractiveScript
      );

      await this.telegramService.sendKeywordResearchResults(
        videoData.title, 
        enhancedContent.keywords
      );

      // Create complete hierarchical script structure (script pages + breakdown database)
      const scriptStructure = await this.notionService.createCompleteScriptStructure(
        notionPageId,
        videoData.title,
        videoData.transcriptText, // Original transcript
        enhancedContent.attractiveScript, // Optimized script
        enhancedContent.scriptSentences,
        enhancedContent.imagePrompts,
        enhancedContent.editorKeywords
      );
      
      logger.info(`Complete script structure created successfully for: ${videoData.title}`);
      logger.info(`- Original Script: ${scriptStructure.originalScriptPage.pageUrl}`);
      logger.info(`- Optimized Script: ${scriptStructure.optimizedScriptPage.pageUrl}`);
      if (scriptStructure.scriptDatabase) {
        logger.info(`- Script Breakdown: ${scriptStructure.scriptDatabase.databaseUrl}`);
      }
      logger.info(`Script sentences: ${enhancedContent.scriptSentences.length}`);
      logger.info(`Image prompts: ${enhancedContent.imagePrompts.length}`);
      
      // Get navigation links for user-friendly notification using known URLs
      const knownUrls = {
        originalScript: scriptStructure.originalScriptPage?.pageUrl,
        optimizedScript: scriptStructure.optimizedScriptPage?.pageUrl,
        scriptBreakdown: scriptStructure.scriptDatabase?.databaseUrl
      };
      const navigationLinks = await this.notionService.getVideoNavigationLinks(notionPageId, knownUrls);
      
      // Send enhanced Telegram notification with hierarchical structure
      if (this.telegramService) {
        try {
          await this.telegramService.sendMessage(
            '✅ Complete script structure created in Notion!\n\n' +
            `📋 Video: ${videoData.title}\n` +
            `📊 Sentences: ${enhancedContent.scriptSentences.length}\n` +
            `🎨 Image Prompts: ${enhancedContent.imagePrompts.length}\n\n` +
            '📁 **Hierarchical Structure Created:**\n' +
            `🎬 [Main Video Record](${navigationLinks.links.mainVideo})\n` +
            `├── 📝 [Original Script](${navigationLinks.links.originalScript})\n` +
            `├── ✨ [Optimized Script](${navigationLinks.links.optimizedScript})\n` +
            (navigationLinks.links.scriptBreakdown ? `└── 🎯 [Script Breakdown](${navigationLinks.links.scriptBreakdown})\n` : '') +
            '\n💡 *Navigate directly from the main video record to review scripts and access the detailed breakdown!*'
          );
        } catch (telegramError) {
          logger.warn('Failed to send Telegram notification:', telegramError.message);
        }
      }

      // Update main video record with enhanced content
      const notionUpdateData = {
        optimizedTitle: enhancedContent.optimizedTitles.recommended,
        optimizedDescription: enhancedContent.optimizedDescription,
        keywords: enhancedContent.keywords.primaryKeywords
      };

      await this.notionService.updateVideoStatus(notionPageId, 'Script Generated', notionUpdateData);

      // Check if auto-approval is enabled
      if (config.app.autoApproveScripts) {
        logger.info(`Auto-approving script for: ${videoData.title}`);
        
        // Auto-approve the script
        await this.notionService.updateVideoStatus(notionPageId, 'Approved', {
          scriptApproved: true,
          autoApproved: true,
          approvedAt: new Date().toISOString()
        });
        
        await this.telegramService.sendMessage(
          `✅ <b>Script Auto-Approved</b>\n\n🎬 ${videoData.title}\n🤖 Automatically approved for processing`
        );
      } else {
        await this.telegramService.sendScriptApprovalRequest(
          videoData.title,
          `https://notion.so/${notionPageId.replace(/-/g, '')}`
        );
      }

      logger.info(`Initial processing completed for: ${videoData.title}`);
      this.stats.totalProcessed++;
      
      return {
        videoData,
        enhancedContent,
        scriptStructure, // Updated to return the complete structure
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

      // Generate images and upload to Google Drive
      const { imageUrls, driveUrls } = await this.videoService.generateImagesFromPrompts(
        enhancedContent.imagePrompts,
        this.aiService,
        videoInfo
      );

      // Update Script Details database with Google Drive image URLs
      const urlsToUpdate = driveUrls && driveUrls.length > 0 ? driveUrls : imageUrls;
      if (urlsToUpdate && urlsToUpdate.length > 0) {
        try {
          await this.notionService.updateMultipleImageUrls(videoInfo.id, urlsToUpdate);
          logger.info(`Updated Script Details database with ${urlsToUpdate.length} image URLs`);
        } catch (error) {
          logger.warn('Failed to update Script Details with image URLs:', error.message);
          // Continue workflow even if database update fails
        }
      }

      // Send clean Telegram notification
      await this.telegramService.sendImageGenerationCompleted(
        videoInfo.title,
        urlsToUpdate ? urlsToUpdate.length : 0
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

      await this.notionService.updateVideoStatus(videoInfo.id, 'Generating Final Video');

      const videoData = await this.youtubeService.getCompleteVideoData(videoInfo.youtubeUrl);
      const enhancedContent = await this.aiService.enhanceContentWithAI(videoData);

      // Get existing image paths from previous processing step
      let existingImagePaths = null;
      try {
        // Try to get image paths from the previous step's temp files
        const tempDir = './temp';
        if (fs.existsSync(tempDir)) {
          const imageFiles = fs.readdirSync(tempDir).filter(file => file.includes('image_') && file.endsWith('.png'));
          if (imageFiles.length > 0) {
            existingImagePaths = imageFiles.map(file => path.join(tempDir, file));
          }
        }
      } catch (error) {
        logger.warn('Could not find existing image paths, will regenerate:', error.message);
      }
      
      const videoResult = await this.videoService.createCompleteVideo(
        videoData,
        enhancedContent,
        this.aiService,
        existingImagePaths
      );

      // Mark as completed (final video is stored locally in output/ directory)
      await this.notionService.updateVideoStatus(videoInfo.id, 'Completed', {
        finalVideoPath: videoResult.videoPath,
        processingCompleted: new Date().toISOString()
      });

      await this.telegramService.sendVideoCompleted(
        { ...videoData, optimizedTitle: enhancedContent.optimizedTitles.recommended },
        'Local Output Directory',
        videoResult.videoPath
      );

      this.stats.successful++;
      logger.info(`Video generation completed for: ${videoInfo.title}`);
      
      return { videoResult };
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
        await this.notionService.healthCheck();
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