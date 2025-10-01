import { EventEmitter } from 'events';
import { config } from '../../config/config.js';
import logger from '../utils/logger.js';
import GoogleSheetsService from './googleSheetsService.js';
import PexelsService from './pexelsService.js';

/**
 * AssetDownloadOrchestrator - Event-driven asset download automation
 *
 * Orchestrates automatic asset downloading when script approval status changes.
 * Implements event-driven architecture with robust error handling and retry logic.
 * Integrates seamlessly with existing Google Sheets workflow management.
 */
class AssetDownloadOrchestrator extends EventEmitter {
  constructor() {
    super();

    // Initialize dependent services
    this.sheetsService = new GoogleSheetsService();
    this.pexelsService = new PexelsService();

    // Configuration from config
    this.maxRetries = config.assetDownload?.maxRetries || 3;
    this.retryDelay = config.assetDownload?.retryDelay || 5000;
    this.processingTimeout = config.assetDownload?.processingTimeout || 300000; // 5 minutes
    this.enableAutoDownload = config.assetDownload?.enableAutoDownload !== false; // Default true
    this.delayBetweenProcessing = config.assetDownload?.delayBetweenProcessing || 2000;

    // Internal state tracking
    this.processingQueue = new Map(); // videoId -> processing status
    this.processingHistory = new Map(); // videoId -> last processing attempt

    logger.info('AssetDownloadOrchestrator initialized', {
      enableAutoDownload: this.enableAutoDownload,
      maxRetries: this.maxRetries,
      retryDelay: this.retryDelay
    });
  }

  /**
   * Handle script approval event - main entry point for asset download automation
   * @param {string} videoId - Video ID that was approved
   * @param {Object} approvalData - Additional approval context data
   */
  async handleScriptApproval(videoId, approvalData = {}) {
    if (!this.enableAutoDownload) {
      logger.info(`Auto download disabled, skipping asset download for ${videoId}`);
      return { skipped: true, reason: 'Auto download disabled' };
    }

    try {
      logger.info(`🎬 Script approval detected for ${videoId}`, approvalData);

      // Check if already processing to prevent duplicate processing
      if (this.isProcessing(videoId)) {
        logger.warn(`Asset download already in progress for ${videoId}, skipping`);
        return { skipped: true, reason: 'Already processing' };
      }

      // Check recent processing history to prevent excessive retries
      const recentAttempt = this.checkRecentProcessingAttempt(videoId);
      if (recentAttempt.tooRecent) {
        logger.warn(`Recent processing attempt for ${videoId}, cooling down`, {
          lastAttempt: recentAttempt.lastAttempt,
          cooldownRemaining: recentAttempt.cooldownRemaining
        });
        return {
          skipped: true,
          reason: 'Recent processing attempt',
          cooldownRemaining: recentAttempt.cooldownRemaining
        };
      }

      // Mark as processing
      this.markAsProcessing(videoId);

      // Emit processing started event
      this.emit('processingStarted', { videoId, timestamp: new Date() });

      // Validate video and prerequisites
      const validation = await this.validateVideoForProcessing(videoId);
      if (!validation.valid) {
        logger.warn(`Video ${videoId} failed validation:`, validation.errors);
        this.markAsCompleted(videoId, false, validation.errors.join(', '));
        return {
          success: false,
          reason: 'Validation failed',
          errors: validation.errors
        };
      }

      // Process assets with timeout and retry logic
      const result = await this.processAssetsWithRetry(videoId, validation.videoData);

      // Update processing status
      this.markAsCompleted(videoId, result.success, result.error);

      // Emit completion event
      this.emit('processingCompleted', {
        videoId,
        success: result.success,
        result: result,
        timestamp: new Date()
      });

      return result;

    } catch (error) {
      logger.error(`Unexpected error in script approval handler for ${videoId}:`, error);

      this.markAsCompleted(videoId, false, error.message);
      this.emit('processingError', {
        videoId,
        error: error.message,
        timestamp: new Date()
      });

      return {
        success: false,
        reason: 'Unexpected error',
        error: error.message
      };
    }
  }

  /**
   * Validate video is ready for asset processing
   * @param {string} videoId - Video ID to validate
   * @returns {Promise<Object>} Validation result
   */
  async validateVideoForProcessing(videoId) {
    const errors = [];
    let videoData = null;

    try {
      // Check video exists and has required data
      videoData = await this.sheetsService.getVideoDetails(videoId);
      if (!videoData) {
        errors.push('Video not found');
        return { valid: false, errors, videoData: null };
      }

      // Verify script is approved
      if (videoData.scriptApproved !== 'Approved') {
        errors.push(`Script not approved (current: ${videoData.scriptApproved})`);
      }

      // Check Drive folder exists
      if (!videoData.driveFolder) {
        errors.push('Drive folder not configured');
      } else {
        // Validate Drive folder URL format
        if (!videoData.driveFolder.includes('/folders/')) {
          errors.push('Invalid Drive folder URL format');
        }
      }

      // Verify script breakdown exists
      const scriptBreakdown = await this.sheetsService.getScriptBreakdown(videoId);
      if (!scriptBreakdown || scriptBreakdown.length === 0) {
        errors.push('No script breakdown found');
      } else {
        // Check if there are sentences with search phrases
        const sentencesWithSearchPhrases = scriptBreakdown.filter(s =>
          s.searchPhrase && s.searchPhrase.trim() !== ''
        );

        if (sentencesWithSearchPhrases.length === 0) {
          errors.push('No sentences have search phrases for asset download');
        }

        // Check if any sentences need processing (not already complete)
        const needsProcessing = scriptBreakdown.filter(s =>
          s.status !== 'Complete' &&
          s.status !== 'Generated' &&
          s.searchPhrase &&
          s.searchPhrase.trim() !== ''
        );

        if (needsProcessing.length === 0) {
          errors.push('All sentences already have assets downloaded');
        }
      }

      return {
        valid: errors.length === 0,
        errors,
        videoData,
        scriptBreakdown
      };

    } catch (error) {
      logger.error(`Validation error for ${videoId}:`, error);
      errors.push(`Validation exception: ${error.message}`);
      return { valid: false, errors, videoData };
    }
  }

  /**
   * Process assets with retry logic and timeout
   * @param {string} videoId - Video ID to process
   * @param {Object} videoData - Video details from validation
   * @returns {Promise<Object>} Processing result
   */
  async processAssetsWithRetry(videoId, videoData) {
    let lastError = null;

    // Update Master Sheet status to "Downloading Assets" at the start
    try {
      await this.sheetsService.updateMasterSheetStatus(videoId, 'Downloading Assets');
      logger.info(`✅ Master Sheet status updated to "Downloading Assets" for ${videoId}`);
    } catch (statusError) {
      logger.error(`Failed to update Master Sheet status to "Downloading Assets" for ${videoId}:`, statusError.message);
      // Continue processing even if status update fails
    }

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        logger.info(`🔄 Asset processing attempt ${attempt}/${this.maxRetries} for ${videoId}`);

        // Create processing timeout promise
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Processing timeout')), this.processingTimeout);
        });

        // Create processing promise
        const processingPromise = this.pexelsService.processScriptBreakdownAssets(videoId);

        // Race between processing and timeout
        const result = await Promise.race([processingPromise, timeoutPromise]);

        // Check if processing was successful
        if (result && result.successCount > 0) {
          logger.info(`✅ Asset processing successful for ${videoId}:`, {
            attempt,
            successCount: result.successCount,
            failureCount: result.failureCount,
            totalSentences: result.totalSentences
          });

          // Update video workflow status if all assets were successful
          if (result.failureCount === 0 && result.successCount === result.totalSentences) {
            await this.updateWorkflowStatus(videoId, 'assets-complete');

            // Update Master Sheet status to "Completed"
            try {
              await this.sheetsService.updateMasterSheetStatus(videoId, 'Completed');
              logger.info(`✅ Master Sheet status updated to "Completed" for ${videoId}`);
            } catch (statusError) {
              logger.error(`Failed to update Master Sheet status to "Completed" for ${videoId}:`, statusError.message);
            }
          } else if (result.successCount > 0) {
            await this.updateWorkflowStatus(videoId, 'assets-partial');

            // Update Master Sheet status to "Completed" (partial success still counts as completed)
            try {
              await this.sheetsService.updateMasterSheetStatus(videoId, 'Completed');
              logger.info(`✅ Master Sheet status updated to "Completed" (partial) for ${videoId}`);
            } catch (statusError) {
              logger.error(`Failed to update Master Sheet status to "Completed" for ${videoId}:`, statusError.message);
            }
          }

          return {
            success: true,
            attempt,
            result,
            videoData
          };
        } else {
          throw new Error(`No assets were successfully processed (success: ${result?.successCount || 0})`);
        }

      } catch (error) {
        lastError = error;
        logger.warn(`Asset processing attempt ${attempt} failed for ${videoId}:`, error.message);

        // If this is the final attempt, don't delay
        if (attempt < this.maxRetries) {
          const delay = this.retryDelay * attempt; // Exponential backoff
          logger.info(`Retrying ${videoId} in ${delay}ms...`);
          await this.delay(delay);
        }
      }
    }

    // All attempts failed
    logger.error(`❌ All asset processing attempts failed for ${videoId}:`, lastError?.message);

    // Update workflow status to indicate failure
    await this.updateWorkflowStatus(videoId, 'assets-failed', lastError?.message);

    // Update Master Sheet status to "Asset Download Failed"
    try {
      await this.sheetsService.updateMasterSheetStatus(videoId, 'Asset Download Failed');
      logger.info(`✅ Master Sheet status updated to "Asset Download Failed" for ${videoId}`);
    } catch (statusError) {
      logger.error(`Failed to update Master Sheet status to "Asset Download Failed" for ${videoId}:`, statusError.message);
    }

    return {
      success: false,
      attempts: this.maxRetries,
      error: lastError?.message || 'Unknown error',
      videoData
    };
  }

  /**
   * Update video workflow status after asset processing
   * @param {string} videoId - Video ID
   * @param {string} assetStatus - Asset processing status
   * @param {string} errorMessage - Optional error message
   */
  async updateWorkflowStatus(videoId, assetStatus, errorMessage = null) {
    try {
      const updates = {};

      switch (assetStatus) {
        case 'assets-complete':
          updates.voiceGenerationStatus = 'Ready'; // Enable next step
          break;

        case 'assets-partial':
          updates.voiceGenerationStatus = 'Ready'; // Still allow next step
          break;

        case 'assets-failed':
          updates.voiceGenerationStatus = 'Not Ready'; // Block next step
          break;
      }

      if (Object.keys(updates).length > 0) {
        await this.sheetsService.updateVideoFields(videoId, updates);
        logger.info(`Updated workflow status for ${videoId}:`, updates);
      }

    } catch (error) {
      logger.error(`Failed to update workflow status for ${videoId}:`, error.message);
    }
  }

  /**
   * Check if video is currently being processed
   * @param {string} videoId - Video ID to check
   * @returns {boolean} True if processing
   */
  isProcessing(videoId) {
    const status = this.processingQueue.get(videoId);
    return status && status.inProgress;
  }

  /**
   * Mark video as currently processing
   * @param {string} videoId - Video ID
   */
  markAsProcessing(videoId) {
    this.processingQueue.set(videoId, {
      inProgress: true,
      startTime: new Date(),
      attempts: 0
    });

    logger.info(`Marked ${videoId} as processing`);
  }

  /**
   * Mark video processing as completed
   * @param {string} videoId - Video ID
   * @param {boolean} success - Whether processing was successful
   * @param {string} errorMessage - Error message if failed
   */
  markAsCompleted(videoId, success, errorMessage = null) {
    const status = this.processingQueue.get(videoId) || {};
    const completedTime = new Date();
    const duration = status.startTime ? completedTime - status.startTime : 0;

    this.processingQueue.set(videoId, {
      inProgress: false,
      completed: true,
      success,
      errorMessage,
      completedTime,
      duration
    });

    // Add to processing history
    this.processingHistory.set(videoId, {
      timestamp: completedTime,
      success,
      errorMessage,
      duration
    });

    logger.info(`Marked ${videoId} as completed:`, {
      success,
      duration: `${Math.round(duration / 1000)}s`,
      error: errorMessage
    });
  }

  /**
   * Check if video was processed recently to prevent excessive retries
   * @param {string} videoId - Video ID
   * @returns {Object} Recent attempt status
   */
  checkRecentProcessingAttempt(videoId) {
    const history = this.processingHistory.get(videoId);
    if (!history) {
      return { tooRecent: false };
    }

    const now = new Date();
    const lastAttempt = history.timestamp;
    const timeSinceAttempt = now - lastAttempt;
    const cooldownPeriod = 15 * 60 * 1000; // 15 minutes

    if (timeSinceAttempt < cooldownPeriod) {
      return {
        tooRecent: true,
        lastAttempt,
        timeSinceAttempt,
        cooldownRemaining: cooldownPeriod - timeSinceAttempt
      };
    }

    return { tooRecent: false };
  }

  /**
   * Get processing status for a video
   * @param {string} videoId - Video ID
   * @returns {Object} Processing status
   */
  getProcessingStatus(videoId) {
    const current = this.processingQueue.get(videoId);
    const history = this.processingHistory.get(videoId);

    return {
      current,
      history,
      isProcessing: this.isProcessing(videoId)
    };
  }

  /**
   * Get all currently processing videos
   * @returns {Array} List of processing videos
   */
  getCurrentlyProcessing() {
    const processing = [];
    for (const [videoId, status] of this.processingQueue.entries()) {
      if (status.inProgress) {
        processing.push({
          videoId,
          startTime: status.startTime,
          duration: new Date() - status.startTime
        });
      }
    }
    return processing;
  }

  /**
   * Clear processing history (maintenance function)
   * @param {number} olderThanHours - Clear entries older than this many hours
   */
  clearOldProcessingHistory(olderThanHours = 24) {
    const cutoff = new Date(Date.now() - (olderThanHours * 60 * 60 * 1000));
    let clearedCount = 0;

    for (const [videoId, history] of this.processingHistory.entries()) {
      if (history.timestamp < cutoff) {
        this.processingHistory.delete(videoId);
        clearedCount++;
      }
    }

    // Also clear completed entries from processing queue
    for (const [videoId, status] of this.processingQueue.entries()) {
      if (!status.inProgress && status.completedTime && status.completedTime < cutoff) {
        this.processingQueue.delete(videoId);
      }
    }

    logger.info(`Cleared ${clearedCount} old processing history entries`);
    return clearedCount;
  }

  /**
   * Emergency stop all processing (for shutdown/maintenance)
   */
  async emergencyStop() {
    logger.warn('🛑 Emergency stop initiated - halting all asset processing');

    const currentlyProcessing = this.getCurrentlyProcessing();
    for (const item of currentlyProcessing) {
      this.markAsCompleted(item.videoId, false, 'Emergency stop');
    }

    this.emit('emergencyStop', {
      stoppedCount: currentlyProcessing.length,
      timestamp: new Date()
    });

    logger.info(`Emergency stop completed - stopped ${currentlyProcessing.length} processing jobs`);
  }

  /**
   * Health check for orchestrator
   * @returns {Promise<Object>} Health status
   */
  async healthCheck() {
    try {
      const currentlyProcessing = this.getCurrentlyProcessing();
      const historySize = this.processingHistory.size;

      // Check dependent services
      const sheetsHealth = await this.sheetsService.healthCheck();
      const pexelsHealth = await this.pexelsService.healthCheck();

      const healthy = sheetsHealth.status === 'healthy' && pexelsHealth.status === 'healthy';

      return {
        status: healthy ? 'healthy' : 'unhealthy',
        service: 'AssetDownloadOrchestrator',
        currentlyProcessing: currentlyProcessing.length,
        historySize,
        enableAutoDownload: this.enableAutoDownload,
        dependencies: {
          sheets: sheetsHealth.status,
          pexels: pexelsHealth.status
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        service: 'AssetDownloadOrchestrator',
        error: error.message
      };
    }
  }

  /**
   * Utility delay function
   * @param {number} ms - Milliseconds to delay
   * @returns {Promise} Promise that resolves after delay
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default AssetDownloadOrchestrator;