import cron from 'node-cron';
import { config, validateConfig } from '../config/config.js';
import WorkflowService from './services/workflowService.js';
import lockManager from './services/lockManagerService.js';
import AssetDownloadScheduler from './services/assetDownloadScheduler.js';
import logger from './utils/logger.js';
import fs from 'fs';

class YouTubeAutomation {
  constructor() {
    this.workflowService = new WorkflowService();
    this.jobs = new Map();
    this.isRunning = false;
    this.assetDownloadScheduler = null; // Asset download scheduler instance
  }

  async initialize() {
    try {
      logger.info('Starting system initialization...');
      validateConfig();

      // Create necessary directories
      this.createDirectories();

      // Initialize services
      await this.setupCronJobs();
      
      // Perform initial health check
      const healthCheck = await this.workflowService.processHealthCheck();
      
      if (!healthCheck.healthy) {
        logger.warn('Health check failed:', healthCheck.checks);
      }

      this.isRunning = true;
      logger.info('System initialized successfully');
      
      return true;
    } catch (error) {
      logger.error('Failed to initialize system:', error);
      throw error;
    }
  }

  createDirectories() {
    const directories = ['./logs', './temp', './output'];
    
    directories.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        logger.info(`Created directory: ${dir}`);
      }
    });
  }

  async setupCronJobs() {
    try {
      // Define timezone configuration for all cron jobs
      const cronOptions = {
        scheduled: false,
        timezone: config.app.timezone
      };

      // Process new videos every 10 minutes
      this.jobs.set('newVideos', cron.schedule('*/10 * * * *', async () => {
        if (!this.isRunning) return;
        
        // Acquire mutex to prevent overlapping execution
        const mutexAcquired = lockManager.acquireCronMutex('newVideoProcessor');
        if (!mutexAcquired) {
          logger.warn('Skipping new video processing - already running');
          return;
        }
        
        try {
          logger.info('Processing new videos...');
          await this.workflowService.processNewVideos();
        } catch (error) {
          logger.error('Error in scheduled new video processing:', error);
        } finally {
          lockManager.releaseCronMutex('newVideoProcessor');
        }
      }, {
        ...cronOptions,
        name: 'newVideoProcessor'
      }));

      // Process videos ready for review every 12 minutes
      this.jobs.set('readyForReview', cron.schedule('*/12 * * * *', async () => {
        if (!this.isRunning) return;
        
        const mutexAcquired = lockManager.acquireCronMutex('reviewProcessor');
        if (!mutexAcquired) {
          logger.warn('Skipping ready for review processing - already running');
          return;
        }
        
        try {
          logger.info('Processing videos ready for review...');
          await this.workflowService.processReadyForReview();
        } catch (error) {
          logger.error('Error in scheduled ready for review processing:', error);
        } finally {
          lockManager.releaseCronMutex('reviewProcessor');
        }
      }, {
        ...cronOptions,
        name: 'reviewProcessor'
      }));

      // Process approved scripts every 15 minutes
      this.jobs.set('approvedScripts', cron.schedule('*/15 * * * *', async () => {
        if (!this.isRunning) return;
        
        const mutexAcquired = lockManager.acquireCronMutex('scriptProcessor');
        if (!mutexAcquired) {
          logger.warn('Skipping approved script processing - already running');
          return;
        }
        
        try {
          logger.info('Processing approved scripts...');
          await this.workflowService.processApprovedScripts();
        } catch (error) {
          logger.error('Error in scheduled script processing:', error);
        } finally {
          lockManager.releaseCronMutex('scriptProcessor');
        }
      }, {
        ...cronOptions,
        name: 'scriptProcessor'
      }));

      // Process error videos for retry every 2 hours
      this.jobs.set('errorVideos', cron.schedule('0 */2 * * *', async () => {
        if (!this.isRunning) return;
        
        const mutexAcquired = lockManager.acquireCronMutex('errorProcessor');
        if (!mutexAcquired) {
          logger.warn('Skipping error video processing - already running');
          return;
        }
        
        try {
          logger.info('Processing error videos for retry...');
          await this.workflowService.processErrorVideos();
        } catch (error) {
          logger.error('Error in scheduled error video processing:', error);
        } finally {
          lockManager.releaseCronMutex('errorProcessor');
        }
      }, {
        ...cronOptions,
        name: 'errorProcessor'
      }));

      // Video generation removed from automated workflow
      // Users will now manually handle video generation after voice processing

      // Check for approval timeouts every hour
      this.jobs.set('timeouts', cron.schedule('0 * * * *', async () => {
        if (!this.isRunning) return;
        
        const mutexAcquired = lockManager.acquireCronMutex('timeoutChecker');
        if (!mutexAcquired) {
          logger.warn('Skipping timeout check - already running');
          return;
        }
        
        try {
          logger.info('Checking approval timeouts...');
          await this.workflowService.processTimeouts();
        } catch (error) {
          logger.error('Error checking approval timeouts:', error);
        } finally {
          lockManager.releaseCronMutex('timeoutChecker');
        }
      }, {
        ...cronOptions,
        name: 'timeoutChecker'
      }));

      // Daily summary at 9 AM Bangkok time
      this.jobs.set('dailySummary', cron.schedule('0 9 * * *', async () => {
        if (!this.isRunning) return;
        
        const mutexAcquired = lockManager.acquireCronMutex('summaryGenerator');
        if (!mutexAcquired) {
          logger.warn('Skipping daily summary - already running');
          return;
        }
        
        try {
          logger.info('Generating daily summary...');
          await this.workflowService.generateDailySummary();
        } catch (error) {
          logger.error('Error generating daily summary:', error);
        } finally {
          lockManager.releaseCronMutex('summaryGenerator');
        }
      }, {
        ...cronOptions,
        name: 'summaryGenerator'
      }));

      // Health check every 6 hours (starting at midnight Bangkok time)
      this.jobs.set('healthCheck', cron.schedule('0 */6 * * *', async () => {
        if (!this.isRunning) return;
        
        const mutexAcquired = lockManager.acquireCronMutex('healthChecker');
        if (!mutexAcquired) {
          logger.warn('Skipping health check - already running');
          return;
        }
        
        try {
          logger.info('Running health check...');
          const health = await this.workflowService.processHealthCheck();
          
          if (!health.healthy) {
            logger.warn('Health check failed:', health.checks);
          }
        } catch (error) {
          logger.error('Error in health check:', error);
        } finally {
          lockManager.releaseCronMutex('healthChecker');
        }
      }, {
        ...cronOptions,
        name: 'healthChecker'
      }));

      // Monitor manual status changes in Google Sheets every 5 minutes
      this.jobs.set('statusMonitor', cron.schedule('*/5 * * * *', async () => {
        if (!this.isRunning) return;

        const mutexAcquired = lockManager.acquireCronMutex('statusMonitor');
        if (!mutexAcquired) {
          logger.warn('Skipping status monitoring - already running');
          return;
        }

        try {
          logger.info('Monitoring status changes...');
          await this.workflowService.processStatusChanges();
        } catch (error) {
          logger.error('Error in status monitoring:', error);
        } finally {
          lockManager.releaseCronMutex('statusMonitor');
        }
      }, {
        ...cronOptions,
        name: 'statusMonitor'
      }));

      logger.info('Cron jobs configured successfully');

      // Initialize Asset Download Scheduler if enabled
      await this.initializeAssetDownloadScheduler();
    } catch (error) {
      logger.error('Error setting up cron jobs:', error);
      throw error;
    }
  }

  /**
   * Initialize and start Asset Download Scheduler
   * Runs automatic asset downloads for approved scripts
   */
  async initializeAssetDownloadScheduler() {
    try {
      // Check if asset download scheduler is enabled
      if (!config.assetDownloadScheduler?.enabled) {
        logger.info('🔕 Asset Download Scheduler is disabled in config');
        return;
      }

      logger.info('🤖 Initializing Asset Download Scheduler...');

      // Create scheduler instance
      this.assetDownloadScheduler = new AssetDownloadScheduler();

      // Set up event listeners for monitoring and logging
      this.setupAssetSchedulerEventListeners();

      // Start the scheduler
      const started = this.assetDownloadScheduler.start();

      if (started) {
        logger.info('✅ Asset Download Scheduler started successfully', {
          cronPattern: this.assetDownloadScheduler.cronPattern,
          maxConcurrent: this.assetDownloadScheduler.maxConcurrentProcessing,
          cooldownMinutes: this.assetDownloadScheduler.cooldownPeriodMinutes
        });
      } else {
        logger.warn('⚠️ Asset Download Scheduler failed to start');
      }

    } catch (error) {
      logger.error('❌ Failed to initialize Asset Download Scheduler:', error);
      // Don't throw - allow system to continue even if scheduler fails
    }
  }

  /**
   * Set up event listeners for Asset Download Scheduler
   * Provides logging and monitoring of scheduler activities
   */
  setupAssetSchedulerEventListeners() {
    if (!this.assetDownloadScheduler) return;

    // Scheduler lifecycle events
    this.assetDownloadScheduler.on('schedulerStarted', (data) => {
      logger.info('📅 Asset Download Scheduler started', {
        cronPattern: data.cronPattern,
        nextRun: data.nextRunTime
      });
    });

    this.assetDownloadScheduler.on('schedulerStopped', (data) => {
      logger.info('🛑 Asset Download Scheduler stopped', {
        totalRuns: data.totalRuns,
        lastRun: data.lastRunTime
      });
    });

    // Execution events
    this.assetDownloadScheduler.on('executionStarted', (data) => {
      logger.debug(`🔍 Asset scheduler execution started [${data.executionId}]`);
    });

    this.assetDownloadScheduler.on('executionCompleted', (data) => {
      logger.info(`✅ Asset scheduler execution completed [${data.executionId}]`, {
        duration: `${data.duration}ms`,
        videosProcessed: data.videosProcessed,
        result: data.result
      });
    });

    this.assetDownloadScheduler.on('executionError', (data) => {
      logger.error(`❌ Asset scheduler execution error [${data.executionId}]`, {
        error: data.error,
        consecutiveErrors: data.consecutiveErrors
      });
    });

    // Video processing events
    this.assetDownloadScheduler.on('videoProcessed', (data) => {
      logger.info(`📹 Video assets processed: ${data.videoId}`, {
        title: data.title,
        result: data.result
      });
    });

    this.assetDownloadScheduler.on('videoProcessingFailed', (data) => {
      logger.warn(`⚠️ Video asset processing failed: ${data.videoId}`, {
        title: data.title,
        error: data.error
      });
    });

    this.assetDownloadScheduler.on('videoProcessingError', (data) => {
      logger.error(`💥 Video asset processing error: ${data.videoId}`, {
        title: data.title,
        error: data.error
      });
    });
  }

  /**
   * Get Asset Download Scheduler status
   * @returns {Object} Scheduler status information
   */
  getAssetSchedulerStatus() {
    if (!this.assetDownloadScheduler) {
      return {
        enabled: false,
        message: 'Asset Download Scheduler not initialized'
      };
    }

    return {
      enabled: true,
      status: this.assetDownloadScheduler.getStatus(),
      isRunning: this.assetDownloadScheduler.isRunning
    };
  }

  /**
   * Manually trigger asset download scheduler
   * @param {string} reason - Reason for manual trigger
   * @returns {Promise<Object>} Trigger result
   */
  async triggerAssetScheduler(reason = 'Manual trigger from main system') {
    if (!this.assetDownloadScheduler) {
      throw new Error('Asset Download Scheduler not initialized');
    }

    return await this.assetDownloadScheduler.triggerManualExecution(reason);
  }

  async start() {
    try {
      if (!this.isRunning) {
        logger.error('System not initialized. Call initialize() first.');
        return false;
      }

      // Start all cron jobs
      this.jobs.forEach((job) => {
        job.start();
      });

      logger.info('YouTube Automation System Started');
      logger.info(`Active jobs: ${Array.from(this.jobs.keys()).join(', ')}`);

      // Log system status every hour
      setInterval(() => {
        const stats = this.workflowService.getProcessingStats();
        logger.info('System Status:', stats);
      }, 60 * 60 * 1000);

      return true;
    } catch (error) {
      logger.error('Error starting automation system:', error);
      throw error;
    }
  }

  async stop() {
    try {
      logger.info('Stopping YouTube Automation System...');

      this.isRunning = false;

      // Stop all cron jobs
      this.jobs.forEach((job) => {
        job.stop();
      });

      // Stop Asset Download Scheduler
      if (this.assetDownloadScheduler && this.assetDownloadScheduler.isRunning) {
        logger.info('Stopping Asset Download Scheduler...');
        this.assetDownloadScheduler.stop();
      }

      logger.info('System stopped successfully');
      return true;
    } catch (error) {
      logger.error('Error stopping automation system:', error);
      throw error;
    }
  }

  // Manual processing methods for testing/immediate execution
  async processUrl(youtubeUrl) {
    try {
      logger.info(`Processing URL: ${youtubeUrl}`);
      return await this.workflowService.processNewUrl(youtubeUrl);
    } catch (error) {
      logger.error('Error in manual URL processing:', error);
      throw error;
    }
  }

  async forceProcessNewVideos() {
    try {
      logger.info('Force processing new videos...');
      return await this.workflowService.processNewVideos();
    } catch (error) {
      logger.error('Error in force processing new videos:', error);
      throw error;
    }
  }

  async forceProcessReadyForReview() {
    try {
      logger.info('Force processing videos ready for review...');
      return await this.workflowService.processReadyForReview();
    } catch (error) {
      logger.error('Error in force processing ready for review:', error);
      throw error;
    }
  }

  async forceProcessApprovedScripts() {
    try {
      logger.info('Force processing scripts...');
      return await this.workflowService.processApprovedScripts();
    } catch (error) {
      logger.error('Error in force processing approved scripts:', error);
      throw error;
    }
  }

  async forceProcessErrorVideos() {
    try {
      logger.info('Force processing error videos for retry...');
      return await this.workflowService.processErrorVideos();
    } catch (error) {
      logger.error('Error in force processing error videos:', error);
      throw error;
    }
  }

  async forceProcessStatusChanges() {
    try {
      logger.info('Force processing status changes...');
      return await this.workflowService.processStatusChanges();
    } catch (error) {
      logger.error('Error in force processing status changes:', error);
      throw error;
    }
  }

  async forceProcessThumbnailsForApprovedScripts() {
    try {
      logger.info('Force processing thumbnails for approved scripts...');
      return await this.workflowService.processApprovedScriptsWithThumbnailCheck();
    } catch (error) {
      logger.error('Error in force processing thumbnails for approved scripts:', error);
      throw error;
    }
  }

  async checkThumbnailsForVideo(videoId) {
    try {
      logger.info(`Checking thumbnails for video: ${videoId}`);
      
      // Get video details first
      const videoRow = await this.workflowService.sheetsService.findVideoRow(videoId);
      if (!videoRow || !videoRow.data) {
        throw new Error(`Video ${videoId} not found in sheets`);
      }
      
      const videoTitle = videoRow.data[this.workflowService.sheetsService.masterColumns.title];
      const thumbnailCheck = await this.workflowService.thumbnailService.checkExistingThumbnails(videoId, videoTitle);
      
      return thumbnailCheck;
    } catch (error) {
      logger.error(`Error checking thumbnails for ${videoId}:`, error);
      throw error;
    }
  }

  async generateThumbnailsForVideo(videoId, forceRegenerate = false) {
    try {
      logger.info(`Generating thumbnails for video: ${videoId}`);
      
      // Get video details
      const videoRow = await this.workflowService.sheetsService.findVideoRow(videoId);
      if (!videoRow || !videoRow.data) {
        throw new Error(`Video ${videoId} not found in sheets`);
      }
      
      const youtubeUrl = videoRow.data[this.workflowService.sheetsService.masterColumns.youtubeUrl];
      const scriptApproved = videoRow.data[this.workflowService.sheetsService.masterColumns.scriptApproved];
      
      if (scriptApproved !== 'Approved') {
        throw new Error(`Script must be approved first. Current status: ${scriptApproved}`);
      }
      
      // Get complete video data for thumbnail generation
      const videoData = await this.workflowService.youtubeService.getCompleteVideoData(youtubeUrl);
      videoData.videoId = videoId;
      
      // Generate thumbnails
      const thumbnailResult = await this.workflowService.thumbnailService.processVideoThumbnails(
        videoData, 
        videoId, 
        forceRegenerate
      );
      
      return thumbnailResult;
    } catch (error) {
      logger.error(`Error generating thumbnails for ${videoId}:`, error);
      throw error;
    }
  }

  async refreshStatusCache() {
    try {
      logger.info('Force refreshing status cache...');
      return await this.workflowService.refreshStatusCache();
    } catch (error) {
      logger.error('Error refreshing status cache:', error);
      throw error;
    }
  }

  async clearStatusCache() {
    try {
      logger.info('Clearing status cache...');
      return await this.workflowService.clearStatusCache();
    } catch (error) {
      logger.error('Error clearing status cache:', error);
      throw error;
    }
  }

  // Video generation removed from automated workflow
  // Manual video generation will be handled outside this system

  getSystemStatus() {
    return {
      isRunning: this.isRunning,
      activeJobs: Array.from(this.jobs.keys()),
      stats: this.workflowService.getProcessingStats(),
      assetScheduler: this.getAssetSchedulerStatus(),
      uptime: process.uptime(),
      environment: config.app.nodeEnv
    };
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Received SIGINT signal, shutting down gracefully...');
  
  if (global.automationSystem) {
    await global.automationSystem.stop();
  }
  
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM signal, shutting down gracefully...');
  
  if (global.automationSystem) {
    await global.automationSystem.stop();
  }
  
  process.exit(0);
});

// Main execution
async function main() {
  try {
    const automation = new YouTubeAutomation();
    global.automationSystem = automation;

    await automation.initialize();
    await automation.start();

    // Keep the process alive
    process.stdin.resume();
    
  } catch (error) {
    logger.error('Failed to start YouTube Automation System:', error);
    process.exit(1);
  }
}

// Export for testing or external use
export default YouTubeAutomation;

// Start the system if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}