import GoogleSheetsService from './googleSheetsService.js';
import StatusCacheService from './statusCacheService.js';
import TelegramService from './telegramService.js';
import { config } from '../../config/config.js';
import logger from '../utils/logger.js';

class StatusMonitorService {
  /**
   * Get current timestamp in configured timezone for consistent display
   * @returns {string} Formatted timestamp in Asia/Bangkok (GMT+7) timezone
   */
  getCurrentTimestamp() {
    const now = new Date();
    // Convert to Asia/Bangkok timezone and format
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

  constructor(workflowService = null) {
    this.googleSheetsService = new GoogleSheetsService();
    this.statusCacheService = new StatusCacheService();
    this.telegramService = new TelegramService();
    this.workflowService = workflowService; // For thumbnail generation integration
    
    // Generate URLs for notifications
    this.masterSheetUrl = `https://docs.google.com/spreadsheets/d/${config.google.masterSheetId}`;
  }

  /**
   * Monitor status changes and send notifications
   */
  async monitorStatusChanges() {
    try {
      logger.info('Starting status change monitoring...');

      // Get current status from Google Sheets
      const currentVideos = await this.googleSheetsService.getAllVideosStatus();
      
      // Get cached status for comparison
      const cachedVideos = this.statusCacheService.getCachedVideos();
      
      if (cachedVideos.length === 0) {
        // First run - just cache current status without notifications
        await this.statusCacheService.updateCache(currentVideos);
        logger.info(`Initial cache created with ${currentVideos.length} videos`);
        return { message: 'Initial cache created', changesDetected: 0 };
      }

      // Detect changes
      const changes = this.googleSheetsService.detectStatusChanges(currentVideos, cachedVideos);
      
      if (changes.length === 0) {
        logger.info('No manual status changes detected');
        // Update cache with current status
        await this.statusCacheService.updateCache(currentVideos);
        return { message: 'No changes detected', changesDetected: 0 };
      }

      logger.info(`Detected ${changes.length} manual status changes`);
      
      // Send notifications for each change
      await this.sendStatusChangeNotifications(changes);
      
      // Update cache with current status
      await this.statusCacheService.updateCache(currentVideos);
      
      logger.info(`Status monitoring completed, ${changes.length} notifications sent`);
      return { 
        message: 'Status monitoring completed', 
        changesDetected: changes.length,
        changes: changes 
      };

    } catch (error) {
      logger.error('Error in status monitoring:', error);
      throw error;
    }
  }

  /**
   * Send appropriate notifications for detected changes
   */
  async sendStatusChangeNotifications(changes) {
    try {
      // If many changes at once, send summary instead of individual notifications
      if (changes.length > 3) {
        await this.telegramService.sendStatusChangesSummary(changes);
        return;
      }

      // Send individual notifications for each change
      for (const change of changes) {
        await this.sendIndividualChangeNotifications(change);
      }
    } catch (error) {
      logger.error('Error sending status change notifications:', error);
      throw error;
    }
  }

  /**
   * Send individual notifications for a video's status changes
   */
  async sendIndividualChangeNotifications(change) {
    try {
      const { videoId, title, driveFolder, detailWorkbookUrl, changes: statusChanges } = change;

      // Send notification for each field that changed
      for (const [field, changeInfo] of Object.entries(statusChanges)) {
        switch (field) {
        case 'voiceGenerationStatus':
          await this.telegramService.sendVoiceGenerationStatusChanged(
            videoId,
            title,
            changeInfo.old,
            changeInfo.new,
            this.masterSheetUrl,
            detailWorkbookUrl
          );
          break;

        case 'videoEditingStatus':
          await this.telegramService.sendVideoEditingStatusChanged(
            videoId,
            title,
            changeInfo.old,
            changeInfo.new,
            this.masterSheetUrl,
            detailWorkbookUrl,
            driveFolder
          );
          break;

        case 'scriptApproved':
          await this.telegramService.sendScriptApprovedChanged(
            videoId,
            title,
            changeInfo.old,
            changeInfo.new,
            this.masterSheetUrl,
            detailWorkbookUrl
          );
            
          // Handle "Needs Changes" status - trigger script regeneration
          if (changeInfo.new === 'Needs Changes') {
            logger.info(`${videoId}: Script marked as Needs Changes, triggering regeneration`);
            await this.handleScriptNeedsChanges(videoId, title, detailWorkbookUrl);
          }
          
          // Handle "Approved" status - trigger complete approved script workflow (voice script + thumbnails)
          if (changeInfo.new === 'Approved') {
            logger.info(`${videoId}: Script approved, triggering complete approved script workflow`);
            
            // Set Voice Generation Status to "Not Started"
            await this.googleSheetsService.updateVideoField(videoId, 'voiceGenerationStatus', 'Not Started');
            
            // If WorkflowService is available, use the complete processApprovedScript workflow
            if (this.workflowService) {
              try {
                logger.info(`${videoId}: Triggering complete approved script workflow (voice + thumbnails)`);
                
                // Get video details for processApprovedScript
                const videoRow = await this.googleSheetsService.findVideoRow(videoId);
                if (!videoRow || !videoRow.data) {
                  throw new Error('Video data not found in sheets');
                }
                
                const videoInfo = {
                  videoId: videoId,
                  title: title,
                  youtubeUrl: videoRow.data[this.googleSheetsService.masterColumns.youtubeUrl],
                  status: 'Approved',
                  voiceGenerationStatus: videoRow.data[this.googleSheetsService.masterColumns.voiceGenerationStatus] || 'Not Started'
                };
                
                // Trigger the complete approved script workflow (includes thumbnails)
                await this.workflowService.processApprovedScript(videoInfo);
                
                logger.info(`${videoId}: Complete approved script workflow completed successfully`);
                
              } catch (workflowError) {
                logger.error(`Failed to run complete approved script workflow for ${videoId}:`, workflowError);
                
                // Fallback to voice script creation only
                await this.createVoiceScriptFallback(videoId, title, workflowError);
              }
            } else {
              // Fallback: Create voice script only (old behavior)
              logger.warn(`${videoId}: WorkflowService not available, using fallback voice script creation`);
              await this.createVoiceScriptFallback(videoId, title);
            }
          }
          break;

        default:
          logger.warn(`Unknown status field changed: ${field}`);
        }
      }
    } catch (error) {
      logger.error(`Error sending notifications for video ${change.videoId}:`, error);
      throw error;
    }
  }

  /**
   * Handle script needs changes - trigger script regeneration with backup
   */
  async handleScriptNeedsChanges(videoId, title, detailWorkbookUrl) {
    try {
      logger.info(`${videoId}: Starting script regeneration process`);
      
      // 1. Create backup of existing script content before regeneration
      await this.createScriptBackup(videoId, title);
      
      // 2. Reset main automation status to "Processing" 
      await this.googleSheetsService.updateVideoStatus(videoId, 'Processing');
      
      // 3. Reset Script Approved to "Pending"
      await this.googleSheetsService.updateVideoField(videoId, 'scriptApproved', 'Pending');
      
      // 4. Mark video as being regenerated for voice script force recreation
      await this.googleSheetsService.updateVideoField(videoId, 'isRegenerating', 'true');
      
      // 4. Send Telegram notification about script regeneration
      await this.telegramService.sendScriptRegenerationStarted(
        videoId,
        title,
        this.masterSheetUrl,
        detailWorkbookUrl
      );
      
      logger.info(`${videoId}: Script regeneration triggered successfully`);
      
    } catch (error) {
      logger.error(`Error handling script needs changes for ${videoId}:`, error);
      
      // Send error notification
      await this.telegramService.sendMessage(
        `❌ <b>Script Regeneration Failed</b>\n\n🎬 ${videoId} - ${title}\n🔄 Failed to trigger script regeneration\n📋 Error: ${error.message}\n\n🔧 Manual intervention required`
      );
      
      throw error;
    }
  }

  /**
   * Fallback method for voice script creation when full workflow fails
   */
  async createVoiceScriptFallback(videoId, title, originalError = null) {
    try {
      logger.info(`${videoId}: Creating voice script file (fallback mode)`);
      const voiceScriptResult = await this.googleSheetsService.createAndUploadVoiceScript(videoId, false);
      
      if (voiceScriptResult && !voiceScriptResult.skipped) {
        const message = originalError ? 
          `⚠️ <b>Voice Script Created (Fallback)</b>\n\n🎬 ${videoId} - ${title}\n📄 File: voice_script.txt\n📁 Location: Google Drive folder\n\n⚠️ <i>Full workflow failed, but voice script created successfully</i>\n🔧 ${originalError.message}` :
          `✅ <b>Voice Script Created</b>\n\n🎬 ${videoId} - ${title}\n📄 File: voice_script.txt\n📁 Location: Google Drive folder\n\n💡 <i>Ready for voice generation</i>`;
        
        await this.telegramService.sendMessage(message);
      }
    } catch (voiceScriptError) {
      logger.error(`Fallback voice script creation also failed for ${videoId}:`, voiceScriptError);
      await this.telegramService.sendMessage(
        `❌ <b>Voice Script Creation Failed</b>\n\n🎬 ${videoId} - ${title}\n🔄 Error: ${voiceScriptError.message}\n\n🔧 Manual intervention required`
      );
    }
  }

  /**
   * Create backup of existing script content before regeneration
   */
  async createScriptBackup(videoId, title) {
    try {
      logger.info(`${videoId}: Creating script backup before regeneration`);
      
      // Get existing script content from Video Info sheet
      const existingContent = await this.googleSheetsService.getExistingScriptContent(videoId);
      
      if (existingContent && existingContent.cleanVoiceScript) {
        // Create backup file with timestamp
        const timestamp = this.getCurrentTimestamp().replace(/[:.]/g, '-');
        const backupFileName = `voice_script_backup_${timestamp}.txt`;
        
        // Upload backup to Drive
        await this.googleSheetsService.createBackupVoiceScript(videoId, backupFileName, existingContent.cleanVoiceScript);
        
        // Send notification about backup
        await this.telegramService.sendMessage(
          `💾 <b>Script Backup Created</b>\n\n🎬 ${videoId} - ${title}\n📄 Backup: ${backupFileName}\n🕒 Before regeneration\n\n💡 <i>Previous script version preserved</i>`
        );
        
        logger.info(`${videoId}: Script backup created - ${backupFileName}`);
      } else {
        logger.warn(`${videoId}: No existing script content found to backup`);
      }
      
    } catch (error) {
      logger.warn(`${videoId}: Failed to create script backup:`, error.message);
      // Don't fail the entire regeneration process if backup fails
    }
  }

  /**
   * Get status monitoring statistics
   */
  getMonitoringStats() {
    const cacheStats = this.statusCacheService.getCacheStats();
    
    return {
      cacheStatus: cacheStats,
      masterSheetUrl: this.masterSheetUrl,
      monitoringActive: true,
      lastCacheUpdate: cacheStats.lastUpdate
    };
  }

  /**
   * Force refresh cache without notifications (for debugging/setup)
   */
  async refreshCache() {
    try {
      logger.info('Force refreshing status cache...');
      
      const currentVideos = await this.googleSheetsService.getAllVideosStatus();
      await this.statusCacheService.updateCache(currentVideos);
      
      logger.info(`Cache refreshed with ${currentVideos.length} videos`);
      return { 
        message: 'Cache refreshed successfully', 
        videoCount: currentVideos.length 
      };
    } catch (error) {
      logger.error('Error refreshing cache:', error);
      throw error;
    }
  }

  /**
   * Clear cache (for debugging/reset)
   */
  async clearCache() {
    try {
      const cleared = this.statusCacheService.clearCache();
      if (cleared) {
        logger.info('Status cache cleared successfully');
        return { message: 'Cache cleared successfully' };
      } else {
        throw new Error('Failed to clear cache');
      }
    } catch (error) {
      logger.error('Error clearing cache:', error);
      throw error;
    }
  }

  /**
   * Health check for status monitoring service
   */
  async healthCheck() {
    try {
      // Check all dependent services
      const googleSheetsHealth = await this.googleSheetsService.healthCheck();
      const cacheHealth = await this.statusCacheService.healthCheck();
      const telegramHealth = await this.telegramService.healthCheck();
      
      const healthy = googleSheetsHealth.status === 'healthy' && 
                     cacheHealth.status === 'healthy' && 
                     telegramHealth === true;

      return {
        status: healthy ? 'healthy' : 'unhealthy',
        service: 'StatusMonitor',
        dependencies: {
          googleSheets: googleSheetsHealth,
          cache: cacheHealth,
          telegram: telegramHealth
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        service: 'StatusMonitor',
        error: error.message
      };
    }
  }
}

export default StatusMonitorService;