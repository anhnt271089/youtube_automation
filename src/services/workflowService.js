import YouTubeService from './youtubeService.js';
import NotionService from './notionService.js';
import AIService from './aiService.js';
import TelegramService from './telegramService.js';
import VideoService from './videoService.js';
// import DigitalOceanService from './digitalOceanService.js';
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
      
      // Process both "New" and "Processing" status videos to handle interrupted workflows
      const [newVideos, processingVideos] = await Promise.all([
        this.notionService.getVideosByStatus('New'),
        this.notionService.getVideosByStatus('Processing')
      ]);
      
      const allVideosToProcess = [...newVideos, ...processingVideos];
      
      if (allVideosToProcess.length === 0) {
        logger.info('No videos to process');
        return { success: true, processed: 0, message: 'No videos to process' };
      }

      logger.info(`Found ${newVideos.length} new videos and ${processingVideos.length} processing videos to handle`);
      let processedCount = 0;

      for (const video of allVideosToProcess) {
        try {
          // For processing videos, continue from where they left off
          if (video.status === 'Processing') {
            logger.info(`Resuming processing for video: ${video.videoId} - ${video.title}`);
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

      logger.info('Video processing cycle completed');
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
      logger.info(`Resuming processing for interrupted video: ${video.videoId} - ${video.title}`);
      
      // Get complete video data from YouTube
      const videoData = await this.youtubeService.getCompleteVideoData(video.youtubeUrl);
      
      // Check what stage the video was interrupted at by examining existing data
      const hasScript = video.optimizedTitle && video.optimizedTitle.trim() !== '';
      const hasApproval = video.scriptApproved;
      
      if (!hasScript) {
        // Resume from script generation stage
        logger.info(`Resuming from script generation stage for: ${video.videoId}`);
        
        // Ensure basic video data fields are populated if missing
        if (!video.youtubeVideoId || !video.title || video.title === 'Processing...') {
          logger.info(`Auto-populating missing video data for resumed video: ${video.videoId}`);
          await this.notionService.autoPopulateVideoData(video.id, videoData);
        }
        
        const result = await this.processInitialVideo(videoData, video.id);
        return result;
      } else if (hasScript && hasApproval) {
        // Resume from image generation stage (script was already approved)
        logger.info(`Resuming from image generation stage for: ${video.videoId}`);
        const result = await this.processApprovedScript(video);
        return result;
      } else {
        // Script exists but not approved - update status to Script Generated for manual approval
        logger.info(`Script exists but not approved, updating status for: ${video.videoId}`);
        await this.notionService.updateVideoStatus(video.id, 'Script Generated');
        
        // Send approval request
        await this.telegramService.sendScriptApprovalRequest(
          `${video.videoId} - ${video.title}`,
          `https://notion.so/${video.id.replace(/-/g, '')}`
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
      logger.info('Processing approved scripts');
      
      // Process both "Approved" and "Generating Images" status videos to handle interrupted workflows
      const [approvedVideos, generatingVideos] = await Promise.all([
        this.notionService.getVideosByStatus('Approved'),
        this.notionService.getVideosByStatus('Generating Images')
      ]);
      
      const allVideosToProcess = [...approvedVideos, ...generatingVideos];
      
      if (allVideosToProcess.length === 0) {
        logger.info('No approved scripts to process');
        return { success: true, processed: 0, message: 'No approved scripts to process' };
      }

      logger.info(`Found ${approvedVideos.length} approved scripts and ${generatingVideos.length} generating videos to handle`);
      let processedCount = 0;
      
      for (const video of allVideosToProcess) {
        try {
          if (video.status === 'Generating Images') {
            logger.info(`Resuming image generation for video: ${video.videoId} - ${video.title}`);
          }
          await this.processApprovedScript(video);
          processedCount++;
        } catch (error) {
          logger.error(`Error processing approved script for ${video.videoId} - ${video.title}:`, error);
          await this.handleVideoError(video, error, 'Script Processing');
        }
      }

      logger.info('Approved script processing completed');
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

  async processVideoGeneration() {
    try {
      logger.info('Processing video generation queue');
      
      // Process both "Video Generated" and "Generating Final Video" status to handle interrupted workflows
      const [readyVideos, generatingVideos] = await Promise.all([
        this.notionService.getVideosByStatus('Video Generated'),
        this.notionService.getVideosByStatus('Generating Final Video')
      ]);
      
      const allVideosToProcess = [...readyVideos, ...generatingVideos];
      
      if (allVideosToProcess.length === 0) {
        logger.info('No videos ready for generation');
        return { success: true, processed: 0, message: 'No videos ready for generation' };
      }

      logger.info(`Found ${readyVideos.length} ready videos and ${generatingVideos.length} interrupted video generation to handle`);
      let processedCount = 0;
      
      for (const video of allVideosToProcess) {
        try {
          if (video.status === 'Generating Final Video') {
            logger.info(`Resuming final video generation for: ${video.videoId} - ${video.title}`);
          }
          await this.generateFinalVideo(video);
          processedCount++;
        } catch (error) {
          logger.error(`Error generating video for ${video.videoId} - ${video.title}:`, error);
          await this.handleVideoError(video, error, 'Video Generation');
        }
      }

      logger.info('Video generation processing completed');
      return { 
        success: true, 
        processed: processedCount, 
        total: allVideosToProcess.length,
        breakdown: {
          readyVideos: readyVideos.length,
          resumedGeneration: generatingVideos.length
        }
      };
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
      // Fetch the video information from Notion to get the proper VideoID (VID-XX format)
      let videoDisplayId = notionPageId.replace(/-/g, ''); // Fallback
      try {
        // Query the database to get the video record with the proper VideoID
        const videos = await this.notionService.getVideosByStatus('Processing');
        const currentVideo = videos.find(v => v.id === notionPageId);
        if (currentVideo && currentVideo.videoId) {
          videoDisplayId = currentVideo.videoId; // Use the proper VID-XX format
        }
      } catch (fetchError) {
        logger.warn('Could not fetch proper VideoID, using fallback:', fetchError.message);
      }

      await this.telegramService.sendVideoProcessingStarted({
        ...videoData,
        recordId: videoDisplayId,
        displayTitle: `${videoDisplayId} - ${videoData.title}`
      });

      // Set the proper VideoID (VID-XX format) for Digital Ocean operations
      videoData.videoId = videoDisplayId;
      
      const enhancedContent = await this.aiService.enhanceContentWithAI(videoData);

      await this.telegramService.sendScriptGenerated(
        `${videoDisplayId} - ${videoData.title}`, 
        enhancedContent.attractiveScript
      );

      await this.telegramService.sendKeywordResearchResults(
        `${videoDisplayId} - ${videoData.title}`, 
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
            `📋 Video: ${videoDisplayId} - ${videoData.title}\n` +
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
          `✅ <b>Script Auto-Approved</b>\n\n🎬 ${videoDisplayId} - ${videoData.title}\n🤖 Automatically approved for processing`
        );
      } else {
        await this.telegramService.sendScriptApprovalRequest(
          `${videoDisplayId} - ${videoData.title}`,
          `https://notion.so/${notionPageId.replace(/-/g, '')}` // Keep using page ID for Notion URL
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

      // Get video data with proper video ID for cost tracking
      const videoData = await this.youtubeService.getCompleteVideoData(videoInfo.youtubeUrl);
      videoData.videoId = videoInfo.videoId || videoInfo.id;

      // Create Digital Ocean folder structure for this video
      const videoDisplayId = videoInfo.videoId || videoInfo.id; // Use VideoID (VID-XX) or fallback to internal ID
      try {
        await this.aiService.digitalOceanService.createVideoFolder(videoDisplayId);
        logger.info(`Created Digital Ocean folder structure for video ${videoDisplayId}`);
      } catch (error) {
        logger.warn('Failed to create Digital Ocean folder structure:', error.message);
        // Continue processing
      }

      // Enhanced AI content processing with new features
      const enhancedContent = await this.aiService.enhanceContentWithAI(videoData);

      // All images are already generated and uploaded to Digital Ocean by enhanceContentWithAI
      const generatedImages = enhancedContent.generatedImages || [];
      const imageUrls = generatedImages.map(img => img.uploadedUrl);
      
      // Update Script Details database with Digital Ocean image URLs
      if (imageUrls && imageUrls.length > 0) {
        try {
          await this.notionService.updateMultipleImageUrls(videoInfo.id, imageUrls);
          logger.info(`Updated Script Details database with ${imageUrls.length} image URLs from Digital Ocean`);
        } catch (error) {
          logger.warn('Failed to update Script Details with image URLs:', error.message);
          // Continue workflow even if database update fails
        }
      }

      // Send enhanced Telegram notification with cost information
      const costSummary = enhancedContent.costSummary;
      const folderName = `videos/${videoInfo.videoId || videoInfo.id}`;
      
      await this.telegramService.sendMessage(
        '✅ <b>Image Generation Completed</b>\n\n' +
        `🎬 ${videoDisplayId} - ${videoInfo.title}\n` +
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
        `🔗 [View Record](https://notion.so/${videoInfo.id.replace(/-/g, '')})`
      );

      // Thumbnail is already generated by enhanceContentWithAI
      const thumbnailResult = enhancedContent.thumbnail;
      if (thumbnailResult) {
        // Upload thumbnail to Digital Ocean if not already done
        const thumbnailFileName = `${(videoInfo.videoId || videoInfo.id).replace(/-/g, '_')}_thumbnail.jpg`;
        try {
          const thumbnailUpload = await this.aiService.downloadAndUploadImage(
            thumbnailResult.url,
            thumbnailFileName,
            videoInfo.videoId || videoInfo.id
          );
          
          await this.telegramService.sendMessage(
            '🖼️ <b>Thumbnail Generated</b>\n\n' +
            `🎬 Video: ${videoInfo.title}\n` +
            `🎨 Style: ${thumbnailResult.style}\n` +
            `📱 [View Thumbnail](${thumbnailUpload.cdnUrl})`
          );
        } catch (error) {
          logger.warn('Failed to upload thumbnail to Digital Ocean:', error.message);
          // Use original URL as fallback
          await this.telegramService.sendThumbnailGenerated(
            videoInfo.title,
            thumbnailResult.url
          );
        }
      }

      // Update status to Video Generated with enhanced metadata
      await this.notionService.updateVideoStatus(videoInfo.id, 'Video Generated', {
        imagesGenerated: generatedImages.length,
        imageStyle: enhancedContent.videoStyle?.style,
        totalCost: costSummary.totalCost,
        imageFormat: '1920x1080',
        storageProvider: 'Digital Ocean Spaces',
        thumbnailUrl: thumbnailResult?.url,
        processingCompletedAt: new Date().toISOString()
      });

      logger.info(`Script processing completed for: ${videoInfo.title} (${generatedImages.length} images, $${costSummary.totalCost.toFixed(4)})`);
      
      return { 
        videoData, 
        enhancedContent, 
        imageUrls,
        generatedImages,
        thumbnailResult,
        costSummary 
      };
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
      // Set the proper VideoID (VID-XX format) for Digital Ocean operations
      videoData.videoId = videoInfo.videoId || videoInfo.id;
      
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

      // Get complete cost summary for final message
      const finalCostSummary = this.aiService.getCostSummary();
      const videoDisplayId = videoInfo.videoId || videoInfo.id.replace(/-/g, ''); // Use proper VideoID (VID-XX) or fallback
      
      await this.telegramService.sendVideoCompleted(
        { 
          ...videoData, 
          optimizedTitle: enhancedContent.optimizedTitles.recommended,
          recordId: videoDisplayId,
          displayTitle: `${videoDisplayId} - ${videoData.title}`,
          costSummary: finalCostSummary
        },
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
          const videoDisplayTitle = video.videoId ? `${video.videoId} - ${video.title}` : video.title;
          await this.telegramService.sendApprovalTimeout(videoDisplayTitle, 24);
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
        
        // Auto-populate Notion entry with YouTube data (populate 🔒 fields)
        await this.notionService.autoPopulateVideoData(notionPageId, videoData);
        
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
   * Health check including Digital Ocean Spaces
   * @returns {Promise<object>} Health check results
   */
  async healthCheck() {
    const checks = {
      youtube: false,
      notion: false,
      ai: false,
      telegram: false,
      digitalOcean: false
    };

    // Test YouTube API
    try {
      await this.youtubeService.healthCheck();
      checks.youtube = true;
    } catch (error) {
      logger.error('YouTube service health check failed:', error);
    }

    // Test Notion API
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

    const overallHealth = Object.values(checks).every(check => check);
    
    return {
      healthy: overallHealth,
      services: checks,
      timestamp: new Date().toISOString(),
      costSummary: this.getCostSummary()
    };
  }
}

export default WorkflowService;