import YouTubeService from './youtubeService.js';
import NotionService from './notionService.js';
import AIService from './aiService.js';
import TelegramService from './telegramService.js';
import VideoService from './videoService.js';
// import DigitalOceanService from './digitalOceanService.js';
import { config } from '../../config/config.js';
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
      logger.info('Processing new videos...');
      
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

      logger.info(`Found ${newVideos.length} new + ${processingVideos.length} resuming`);
      let processedCount = 0;

      for (const video of allVideosToProcess) {
        try {
          // For processing videos, continue from where they left off
          if (video.status === 'Processing') {
            logger.info(`Resuming ${video.videoId}`);
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

      logger.info('New videos completed');
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
      logger.info(`Resuming ${video.videoId}`);
      
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
          await this.notionService.autoPopulateVideoData(video.id, videoData);
        }
        
        const result = await this.processInitialVideo(videoData, video.id);
        return result;
      } else if (hasScript && hasApproval) {
        // Resume from image generation stage (script was already approved)
        logger.info(`${video.videoId}: image generation`);
        const result = await this.processApprovedScript(video);
        return result;
      } else {
        // Script exists but not approved - update status to Script Separated for manual approval
        logger.info(`${video.videoId}: awaiting approval`);
        await this.notionService.updateVideoStatus(video.id, 'Script Separated');
        
        // Auto-transition: Script Separated → Ready for Review
        await this.notionService.autoTransitionStatus(video.id, 'Script Separated', video.scriptApproved);
        
        // Auto-update workflow statuses for resumed script generation
        await this.notionService.autoUpdateWorkflowStatuses(video.id, 'Script Separated');
        
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
      logger.info('Processing approved scripts...');
      
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

      logger.info(`Found ${approvedVideos.length} approved + ${generatingVideos.length} generating`);
      let processedCount = 0;
      
      for (const video of allVideosToProcess) {
        try {
          if (video.status === 'Generating Images') {
            logger.info(`Resuming ${video.videoId}`);
          }
          await this.processApprovedScript(video);
          processedCount++;
        } catch (error) {
          logger.error(`Error processing approved script for ${video.videoId} - ${video.title}:`, error);
          await this.handleVideoError(video, error, 'Script Processing');
        }
      }

      logger.info('Scripts completed');
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
      logger.info('Processing videos ready for review...');
      
      const readyForReviewVideos = await this.notionService.getVideosByStatus('Ready for Review');
      
      if (readyForReviewVideos.length === 0) {
        logger.info('No videos ready for review');
        return { success: true, processed: 0, message: 'No videos ready for review' };
      }

      logger.info(`Found ${readyForReviewVideos.length} videos ready for review`);
      let processedCount = 0;
      
      for (const video of readyForReviewVideos) {
        try {
          // Check if Script Approved checkbox has been checked
          if (video.scriptApproved === true) {
            logger.info(`${video.videoId}: Script approved, transitioning to Approved status`);
            
            // Auto-transition: Ready for Review → Approved
            const transition = await this.notionService.autoTransitionStatus(
              video.id, 
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
      logger.info('Processing error videos for retry...');
      
      const errorVideos = await this.notionService.getVideosByStatus('Error');
      
      if (errorVideos.length === 0) {
        logger.info('No error videos to retry');
        return { success: true, processed: 0, message: 'No error videos to retry' };
      }

      logger.info(`Found ${errorVideos.length} error videos`);
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
          await this.notionService.updateVideoStatus(video.id, resetStatus, {
            retryCount: retryCount + 1,
            lastRetryTime: new Date().toISOString(),
            errorMessage: null, // Clear previous error
            errorStage: null,
            errorTime: null
          });
          
          retriedCount++;
          logger.info(`${video.videoId}: Reset to ${resetStatus} for retry ${retryCount + 1}`);
          
          // Send retry notification
          await this.telegramService.sendMessage(
            '🔄 <b>Retry Attempt</b>\n\n' +
            `🎬 ${video.title}\n` +
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
      logger.info(`New URL: ${youtubeUrl}`);
      
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

      await this.notionService.updateVideoStatus(notionPageId, 'Script Separated', notionUpdateData);

      // Auto-transition: Script Separated → Ready for Review
      await this.notionService.autoTransitionStatus(notionPageId, 'Script Separated', false);

      // Auto-update workflow statuses after script generation
      await this.notionService.autoUpdateWorkflowStatuses(notionPageId, 'Script Separated');

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
      logger.info(`Approved: ${videoInfo.title}`);

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
        '✅ <b>Processing Completed</b>\n\n' +
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
        '📝 <i>Ready for voice generation - check Voice Status when complete</i>\n' +
        `🔗 [View Record](https://notion.so/${videoInfo.id.replace(/-/g, '')})`
      );

      // Thumbnail is already generated by enhanceContentWithAI
      const thumbnailResult = enhancedContent.thumbnail;
      if (thumbnailResult) {
        // Upload thumbnail to Digital Ocean if not already done
        const thumbnailFileName = `${(videoInfo.videoId || videoInfo.id)}_thumbnail.jpg`;
        try {
          const thumbnailUpload = await this.aiService.downloadAndUploadImage(
            thumbnailResult.url,
            thumbnailFileName,
            videoInfo.videoId || videoInfo.id,
            'thumbnails'
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

      // Update status to Completed with enhanced metadata (workflow ends here)
      await this.notionService.updateVideoStatus(videoInfo.id, 'Completed', {
        imagesGenerated: generatedImages.length,
        imageStyle: enhancedContent.videoStyle?.style,
        totalCost: costSummary.totalCost,
        imageFormat: '1920x1080',
        storageProvider: 'Digital Ocean Spaces',
        thumbnailUrl: thumbnailResult?.url,
        processingCompletedAt: new Date().toISOString()
      });

      // Auto-update workflow statuses after automation completion
      // Note: Video Editing Status will only update if Voice Generation Status is "Completed"
      await this.notionService.autoUpdateWorkflowStatuses(videoInfo.id, 'Completed', videoInfo.voiceGenerationStatus);

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

  // generateFinalVideo method removed - video generation is now manual

  async handleVideoError(video, error, stage) {
    try {
      await this.notionService.updateVideoStatus(video.id, 'Error', {
        errorMessage: error.message,
        errorStage: stage,
        errorTime: new Date().toISOString(),
        retryCount: (video.retryCount || 0) + 1
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
      const pendingApprovals = await this.notionService.getVideosByStatus('Script Separated');
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
        this.notionService.getVideosByStatus('Error')
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
      logger.info(`Single video: ${video.title || video.youtubeUrl}`);
      
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
        
        // Auto-populate Notion entry with YouTube data (populate 🤖 fields)
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