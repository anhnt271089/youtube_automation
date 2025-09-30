import cron from 'node-cron';
import { EventEmitter } from 'events';
import { config } from '../../config/config.js';
import logger from '../utils/logger.js';
import GoogleSheetsService from './googleSheetsService.js';

/**
 * AssetDownloadScheduler - Cron-based scheduler for automatic asset downloads
 *
 * Features:
 * - Periodic checks for approved scripts needing asset downloads
 * - Prevents duplicate processing with concurrent execution tracking
 * - Implements comprehensive error handling and retry logic
 * - Provides detailed monitoring and status reporting
 * - Integrates seamlessly with existing AssetDownloadOrchestrator
 */
class AssetDownloadScheduler extends EventEmitter {
  constructor() {
    super();

    // Initialize services
    this.sheetsService = new GoogleSheetsService();

    // Scheduler configuration from config.js
    this.enabled = config.assetDownloadScheduler?.enabled !== false; // Default true
    this.cronPattern = config.assetDownloadScheduler?.cronPattern || '*/7 * * * *'; // Every 7 minutes default
    this.maxConcurrentProcessing = config.assetDownloadScheduler?.maxConcurrentProcessing || 3;
    this.processingTimeout = config.assetDownloadScheduler?.processingTimeout || 600000; // 10 minutes
    this.cooldownPeriodMinutes = config.assetDownloadScheduler?.cooldownPeriodMinutes || 30;
    this.enableRetryLogic = config.assetDownloadScheduler?.enableRetryLogic !== false;
    this.maxRetryAttempts = config.assetDownloadScheduler?.maxRetryAttempts || 3;
    this.enableStatusTracking = config.assetDownloadScheduler?.enableStatusTracking !== false;

    // Internal state management
    this.schedulerTask = null;
    this.isRunning = false;
    this.currentlyProcessing = new Set(); // Track videos currently being processed
    this.processingHistory = new Map(); // Track processing history and cooldowns
    this.statisticsData = {
      totalRuns: 0,
      successfulProcessing: 0,
      failedProcessing: 0,
      videosSkipped: 0,
      lastRunTime: null,
      nextRunTime: null
    };

    // Monitor system resources and health
    this.healthStatus = {
      status: 'idle',
      lastHealthCheck: null,
      errorCount: 0,
      consecutiveErrors: 0
    };

    logger.info('🤖 AssetDownloadScheduler initialized', {
      enabled: this.enabled,
      cronPattern: this.cronPattern,
      maxConcurrentProcessing: this.maxConcurrentProcessing,
      cooldownPeriodMinutes: this.cooldownPeriodMinutes
    });
  }

  /**
   * Start the cron job scheduler
   */
  start() {
    if (!this.enabled) {
      logger.warn('AssetDownloadScheduler is disabled, not starting');
      return false;
    }

    if (this.schedulerTask) {
      logger.warn('AssetDownloadScheduler is already running');
      return false;
    }

    try {
      // Validate cron pattern before starting
      if (!cron.validate(this.cronPattern)) {
        throw new Error(`Invalid cron pattern: ${this.cronPattern}`);
      }

      // Create and start the scheduled task
      this.schedulerTask = cron.schedule(this.cronPattern, async () => {
        await this.executeScheduledCheck();
      }, {
        scheduled: true,
        timezone: config.app.timezone || 'Asia/Bangkok'
      });

      this.isRunning = true;
      this.healthStatus.status = 'running';
      this.statisticsData.nextRunTime = this.getNextRunTime();

      logger.info(`✅ AssetDownloadScheduler started successfully`, {
        cronPattern: this.cronPattern,
        timezone: config.app.timezone || 'Asia/Bangkok',
        nextRun: this.statisticsData.nextRunTime
      });

      // Emit scheduler started event
      this.emit('schedulerStarted', {
        cronPattern: this.cronPattern,
        nextRunTime: this.statisticsData.nextRunTime
      });

      return true;
    } catch (error) {
      logger.error('❌ Failed to start AssetDownloadScheduler:', error.message);
      this.healthStatus.status = 'error';
      this.healthStatus.errorCount++;
      this.emit('schedulerError', { error: error.message, phase: 'startup' });
      return false;
    }
  }

  /**
   * Stop the cron job scheduler
   */
  stop() {
    if (!this.schedulerTask) {
      logger.warn('AssetDownloadScheduler is not running');
      return false;
    }

    try {
      this.schedulerTask.stop();
      this.schedulerTask.destroy();
      this.schedulerTask = null;
      this.isRunning = false;
      this.healthStatus.status = 'stopped';

      logger.info('🛑 AssetDownloadScheduler stopped successfully');

      // Emit scheduler stopped event
      this.emit('schedulerStopped', {
        totalRuns: this.statisticsData.totalRuns,
        lastRunTime: this.statisticsData.lastRunTime
      });

      return true;
    } catch (error) {
      logger.error('❌ Error stopping AssetDownloadScheduler:', error.message);
      return false;
    }
  }

  /**
   * Execute scheduled check for pending asset downloads
   */
  async executeScheduledCheck() {
    if (!this.isRunning) {
      logger.warn('Scheduled check triggered but scheduler is not running, skipping');
      return;
    }

    const executionId = `exec_${Date.now()}`;
    const startTime = Date.now();

    try {
      logger.info(`🔍 Starting scheduled asset download check [${executionId}]`);

      this.statisticsData.totalRuns++;
      this.statisticsData.lastRunTime = new Date();
      this.statisticsData.nextRunTime = this.getNextRunTime();
      this.healthStatus.lastHealthCheck = new Date();

      // Emit execution started event
      this.emit('executionStarted', { executionId, startTime: new Date() });

      // Get videos that need asset processing
      const videosToProcess = await this.getVideosNeedingAssetDownload();

      if (videosToProcess.length === 0) {
        logger.info(`📄 No videos requiring asset download found [${executionId}]`);
        this.emit('executionCompleted', {
          executionId,
          duration: Date.now() - startTime,
          videosProcessed: 0,
          result: 'no_videos_found'
        });
        return;
      }

      logger.info(`🎯 Found ${videosToProcess.length} videos needing asset download [${executionId}]`, {
        videoIds: videosToProcess.map(v => v.videoId)
      });

      // Process videos with concurrency control
      const processingResults = await this.processVideosWithConcurrencyControl(videosToProcess, executionId);

      // Update statistics
      this.updateProcessingStatistics(processingResults);

      // Reset consecutive error counter on successful execution
      this.healthStatus.consecutiveErrors = 0;
      this.healthStatus.status = 'running';

      const duration = Date.now() - startTime;
      logger.info(`✅ Scheduled asset download check completed [${executionId}]`, {
        duration: `${duration}ms`,
        totalVideos: videosToProcess.length,
        successfulProcessing: processingResults.successCount,
        failedProcessing: processingResults.failureCount,
        skippedProcessing: processingResults.skipCount
      });

      // Emit execution completed event
      this.emit('executionCompleted', {
        executionId,
        duration,
        videosProcessed: videosToProcess.length,
        results: processingResults,
        result: 'success'
      });

    } catch (error) {
      const duration = Date.now() - startTime;

      logger.error(`❌ Scheduled asset download check failed [${executionId}]:`, error.message);

      // Update health status and error tracking
      this.healthStatus.errorCount++;
      this.healthStatus.consecutiveErrors++;
      this.statisticsData.failedProcessing++;

      // If too many consecutive errors, temporarily disable
      if (this.healthStatus.consecutiveErrors >= 5) {
        logger.error('🚨 Too many consecutive errors, temporarily disabling scheduler for 30 minutes');
        this.healthStatus.status = 'disabled_error';

        // Re-enable after 30 minutes
        setTimeout(() => {
          if (this.healthStatus.status === 'disabled_error') {
            this.healthStatus.status = 'running';
            this.healthStatus.consecutiveErrors = 0;
            logger.info('🔄 AssetDownloadScheduler re-enabled after error recovery period');
          }
        }, 30 * 60 * 1000); // 30 minutes
      }

      // Emit execution error event
      this.emit('executionError', {
        executionId,
        error: error.message,
        duration,
        consecutiveErrors: this.healthStatus.consecutiveErrors
      });
    }
  }

  /**
   * Get videos that need asset download processing
   * Checks for videos with scriptApproved = 'Approved' that haven't been processed recently
   */
  async getVideosNeedingAssetDownload() {
    try {
      // Get all videos with approved scripts
      const response = await this.sheetsService.sheets.spreadsheets.values.get({
        spreadsheetId: this.sheetsService.masterSheetId,
        range: 'Videos!A:T'
      });

      const values = response.data.values || [];
      if (values.length <= 1) {
        return [];
      }

      const pendingVideos = [];
      const now = Date.now();

      // Skip header row and check each video
      for (let i = 1; i < values.length; i++) {
        const row = values[i];
        const videoId = row[this.sheetsService.masterColumns.videoId];
        const scriptApproved = row[this.sheetsService.masterColumns.scriptApproved];
        const detailWorkbookUrl = row[this.sheetsService.masterColumns.detailWorkbookUrl];
        const title = row[this.sheetsService.masterColumns.title] || 'Unknown Title';

        // Skip if no video ID or not approved
        if (!videoId || scriptApproved !== 'Approved') {
          continue;
        }

        // Skip if no detail workbook (script hasn't been processed yet)
        if (!detailWorkbookUrl) {
          logger.debug(`Skipping ${videoId}: No detail workbook found`);
          continue;
        }

        // Check if currently being processed by another instance
        if (this.currentlyProcessing.has(videoId)) {
          logger.debug(`Skipping ${videoId}: Currently being processed`);
          continue;
        }

        // Check cooldown period
        const lastProcessing = this.processingHistory.get(videoId);
        if (lastProcessing) {
          const timeSinceLastProcessing = now - lastProcessing.timestamp;
          const cooldownPeriod = this.cooldownPeriodMinutes * 60 * 1000;

          if (timeSinceLastProcessing < cooldownPeriod && lastProcessing.success) {
            logger.debug(`Skipping ${videoId}: In cooldown period (${Math.ceil((cooldownPeriod - timeSinceLastProcessing) / 60000)} minutes remaining)`);
            continue;
          }
        }

        // Check if assets have already been downloaded by examining script breakdown
        const hasProcessedAssets = await this.checkIfAssetsAlreadyProcessed(videoId);
        if (hasProcessedAssets) {
          logger.debug(`Skipping ${videoId}: Assets already processed`);
          continue;
        }

        pendingVideos.push({
          videoId,
          title,
          detailWorkbookUrl,
          priority: this.calculateProcessingPriority(row, lastProcessing)
        });
      }

      // Sort by priority (higher priority first)
      pendingVideos.sort((a, b) => b.priority - a.priority);

      return pendingVideos;

    } catch (error) {
      logger.error('Error getting videos needing asset download:', error.message);
      throw error;
    }
  }

  /**
   * Check if video assets have already been processed
   * This helps prevent duplicate processing of the same video
   * FIX: Also check for "Downloading" status to detect in-progress processing
   */
  async checkIfAssetsAlreadyProcessed(videoId) {
    try {
      // Get script breakdown to check if assets have been downloaded
      const breakdown = await this.sheetsService.getScriptBreakdown(videoId);

      if (!breakdown || breakdown.length === 0) {
        return false;
      }

      // FIX: Check for "Downloading" status - indicates concurrent processing
      const downloadingEntries = breakdown.filter(entry =>
        entry.status === 'Downloading'
      );

      if (downloadingEntries.length > 0) {
        logger.debug(`Video ${videoId} is currently being processed: ${downloadingEntries.length} entries in "Downloading" state`);
        return true; // Treat as processed to avoid concurrent download
      }

      // Check if any sentences have image URLs (indicates processing was completed)
      const processedEntries = breakdown.filter(entry =>
        entry.imageUrl && entry.imageUrl.trim() !== ''
      );

      // If more than 20% of entries have images, consider it processed
      const processedPercentage = processedEntries.length / breakdown.length;
      const isProcessed = processedPercentage > 0.2;

      if (isProcessed) {
        logger.debug(`Video ${videoId} appears processed: ${processedEntries.length}/${breakdown.length} entries have assets`);
      }

      return isProcessed;
    } catch (error) {
      logger.warn(`Could not check asset processing status for ${videoId}:`, error.message);
      return false; // Assume not processed if we can't check
    }
  }

  /**
   * Calculate processing priority for a video
   * Higher priority = processed first
   */
  calculateProcessingPriority(videoData, lastProcessing) {
    let priority = 100; // Base priority

    // Boost priority for videos that failed processing (retry logic)
    if (lastProcessing && !lastProcessing.success) {
      priority += 50;
    }

    // Boost priority for newer videos (based on created time)
    try {
      const createdTime = new Date(videoData[this.sheetsService.masterColumns.createdTime]);
      const ageInDays = (Date.now() - createdTime.getTime()) / (24 * 60 * 60 * 1000);

      if (ageInDays < 1) priority += 30; // Very new
      else if (ageInDays < 3) priority += 20; // Recent
      else if (ageInDays < 7) priority += 10; // Within a week
    } catch (error) {
      // Ignore date parsing errors
    }

    // Boost priority for high view count videos
    try {
      const viewCount = parseInt(videoData[this.sheetsService.masterColumns.viewCount] || '0');
      if (viewCount > 100000) priority += 25;
      else if (viewCount > 50000) priority += 15;
      else if (viewCount > 10000) priority += 10;
    } catch (error) {
      // Ignore parsing errors
    }

    return priority;
  }

  /**
   * Process videos with concurrency control to avoid overwhelming the system
   */
  async processVideosWithConcurrencyControl(videosToProcess, executionId) {
    const results = {
      successCount: 0,
      failureCount: 0,
      skipCount: 0,
      details: []
    };

    // Process videos in batches to respect concurrency limits
    const batches = this.createProcessingBatches(videosToProcess, this.maxConcurrentProcessing);

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];

      logger.info(`📦 Processing batch ${batchIndex + 1}/${batches.length} [${executionId}]`, {
        videoIds: batch.map(v => v.videoId)
      });

      // Process batch concurrently
      const batchPromises = batch.map(async (video) => {
        return this.processIndividualVideo(video, executionId);
      });

      const batchResults = await Promise.allSettled(batchPromises);

      // Aggregate results
      batchResults.forEach((result, index) => {
        const video = batch[index];

        if (result.status === 'fulfilled') {
          const processResult = result.value;

          if (processResult.success) {
            results.successCount++;
          } else if (processResult.skipped) {
            results.skipCount++;
          } else {
            results.failureCount++;
          }

          results.details.push({
            videoId: video.videoId,
            title: video.title,
            result: processResult
          });
        } else {
          // Promise was rejected
          results.failureCount++;
          results.details.push({
            videoId: video.videoId,
            title: video.title,
            result: {
              success: false,
              error: result.reason?.message || 'Promise rejected'
            }
          });
        }
      });

      // Add delay between batches to prevent overwhelming the system
      if (batchIndex < batches.length - 1) {
        await this.sleep(3000); // 3 second delay between batches
      }
    }

    return results;
  }

  /**
   * Process an individual video for asset download
   */
  async processIndividualVideo(video, executionId) {
    const videoId = video.videoId;

    try {
      // Mark as processing
      this.currentlyProcessing.add(videoId);

      logger.info(`🎬 Starting asset download for ${videoId} [${executionId}]`);

      // Trigger asset download using existing orchestrator
      const assetDownloadResult = await this.sheetsService.triggerAssetDownload(
        videoId,
        `Cron job execution ${executionId}`
      );

      // Record processing history
      this.processingHistory.set(videoId, {
        timestamp: Date.now(),
        success: assetDownloadResult.success,
        executionId,
        result: assetDownloadResult
      });

      if (assetDownloadResult.success) {
        logger.info(`✅ Asset download completed for ${videoId} [${executionId}]`);

        // Emit successful processing event
        this.emit('videoProcessed', {
          videoId,
          title: video.title,
          executionId,
          result: 'success',
          details: assetDownloadResult
        });

        return { success: true, result: assetDownloadResult };
      } else if (assetDownloadResult.skipped) {
        logger.info(`⏭️ Asset download skipped for ${videoId}: ${assetDownloadResult.reason} [${executionId}]`);

        return {
          skipped: true,
          reason: assetDownloadResult.reason,
          result: assetDownloadResult
        };
      } else {
        logger.warn(`❌ Asset download failed for ${videoId}: ${assetDownloadResult.reason || assetDownloadResult.error} [${executionId}]`);

        // Emit failed processing event
        this.emit('videoProcessingFailed', {
          videoId,
          title: video.title,
          executionId,
          error: assetDownloadResult.reason || assetDownloadResult.error,
          result: assetDownloadResult
        });

        return {
          success: false,
          error: assetDownloadResult.reason || assetDownloadResult.error,
          result: assetDownloadResult
        };
      }

    } catch (error) {
      logger.error(`💥 Error processing video ${videoId} [${executionId}]:`, error.message);

      // Record failed attempt
      this.processingHistory.set(videoId, {
        timestamp: Date.now(),
        success: false,
        error: error.message,
        executionId
      });

      // Emit processing error event
      this.emit('videoProcessingError', {
        videoId,
        title: video.title,
        executionId,
        error: error.message
      });

      return { success: false, error: error.message };
    } finally {
      // Always remove from processing set
      this.currentlyProcessing.delete(videoId);
    }
  }

  /**
   * Create processing batches for concurrent execution
   */
  createProcessingBatches(videos, batchSize) {
    const batches = [];

    for (let i = 0; i < videos.length; i += batchSize) {
      batches.push(videos.slice(i, i + batchSize));
    }

    return batches;
  }

  /**
   * Update processing statistics
   */
  updateProcessingStatistics(results) {
    this.statisticsData.successfulProcessing += results.successCount;
    this.statisticsData.failedProcessing += results.failureCount;
    this.statisticsData.videosSkipped += results.skipCount;
  }

  /**
   * Get the next scheduled run time
   */
  getNextRunTime() {
    if (!this.schedulerTask) return null;

    try {
      // Simple approximation - in a real implementation, you'd parse the cron pattern
      const now = new Date();
      const cronParts = this.cronPattern.split(' ');

      // For */X patterns, calculate next execution
      if (cronParts[0].startsWith('*/')) {
        const interval = parseInt(cronParts[0].substring(2));
        const nextMinute = Math.ceil(now.getMinutes() / interval) * interval;
        const nextRun = new Date(now);
        nextRun.setMinutes(nextMinute, 0, 0);

        // If we've passed this hour's last interval, go to next hour
        if (nextRun <= now) {
          nextRun.setHours(nextRun.getHours() + 1, interval, 0, 0);
        }

        return nextRun;
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get comprehensive status information
   */
  getStatus() {
    return {
      scheduler: {
        isRunning: this.isRunning,
        enabled: this.enabled,
        cronPattern: this.cronPattern,
        nextRunTime: this.statisticsData.nextRunTime,
        lastRunTime: this.statisticsData.lastRunTime
      },
      processing: {
        currentlyProcessing: Array.from(this.currentlyProcessing),
        processingCount: this.currentlyProcessing.size,
        maxConcurrentProcessing: this.maxConcurrentProcessing
      },
      statistics: {
        ...this.statisticsData
      },
      health: {
        ...this.healthStatus
      },
      configuration: {
        cronPattern: this.cronPattern,
        maxConcurrentProcessing: this.maxConcurrentProcessing,
        cooldownPeriodMinutes: this.cooldownPeriodMinutes,
        enableRetryLogic: this.enableRetryLogic
      }
    };
  }

  /**
   * Manual trigger for immediate execution (for testing and emergency processing)
   */
  async triggerManualExecution(reason = 'Manual trigger') {
    if (!this.isRunning && this.enabled) {
      logger.warn('Scheduler is not running, cannot trigger manual execution');
      return { success: false, reason: 'Scheduler not running' };
    }

    try {
      logger.info(`🔥 Manual execution triggered: ${reason}`);

      // Execute the same logic as scheduled check
      await this.executeScheduledCheck();

      return { success: true, reason };
    } catch (error) {
      logger.error('Manual execution failed:', error.message);
      return { success: false, error: error.message, reason };
    }
  }

  /**
   * Clear processing history (for maintenance)
   */
  clearProcessingHistory() {
    const historySize = this.processingHistory.size;
    this.processingHistory.clear();

    logger.info(`🧹 Cleared processing history: ${historySize} entries removed`);

    this.emit('historyCleared', { entriesRemoved: historySize });

    return { entriesRemoved: historySize };
  }

  /**
   * Health check for monitoring
   */
  async performHealthCheck() {
    try {
      // Check Google Sheets connectivity
      const sheetsHealth = await this.sheetsService.healthCheck();

      // Update health status
      this.healthStatus.lastHealthCheck = new Date();

      if (sheetsHealth.status === 'healthy') {
        this.healthStatus.status = this.isRunning ? 'running' : 'stopped';
        return {
          status: 'healthy',
          scheduler: this.isRunning,
          lastHealthCheck: this.healthStatus.lastHealthCheck,
          services: {
            googleSheets: sheetsHealth
          }
        };
      } else {
        this.healthStatus.status = 'unhealthy';
        return {
          status: 'unhealthy',
          scheduler: this.isRunning,
          lastHealthCheck: this.healthStatus.lastHealthCheck,
          services: {
            googleSheets: sheetsHealth
          },
          error: 'Google Sheets service unhealthy'
        };
      }
    } catch (error) {
      this.healthStatus.status = 'error';
      this.healthStatus.errorCount++;

      return {
        status: 'error',
        scheduler: this.isRunning,
        lastHealthCheck: this.healthStatus.lastHealthCheck,
        error: error.message
      };
    }
  }

  /**
   * Utility function for async sleep
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default AssetDownloadScheduler;