import GoogleSheetsService from './googleSheetsService.js';
import StatusCacheService from './statusCacheService.js';
import TelegramService from './telegramService.js';
import AIService from './aiService.js';
import YouTubeService from './youtubeService.js';
import MetadataService from './metadataService.js';
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
    this.aiService = new AIService();
    this.youtubeService = new YouTubeService();
    this.metadataService = new MetadataService(new GoogleSheetsService(), new YouTubeService());
    this.workflowService = workflowService; // For thumbnail generation integration
    
    // Generate URLs for notifications
    this.masterSheetUrl = `https://docs.google.com/spreadsheets/d/${config.google.masterSheetId}`;
  }

  /**
   * Monitor status changes with PRIORITY SYSTEM - ALL human status changes trigger immediate workflow continuation
   */
  async monitorStatusChanges() {
    try {
      logger.info('🚨 PRIORITY STATUS MONITORING: Starting comprehensive status change detection...');

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

      // PRIORITY DETECTION: Detect ALL status changes (not just manual ones)
      const changes = this.detectPriorityStatusChanges(currentVideos, cachedVideos);
      
      if (changes.length === 0) {
        logger.info('No priority status changes detected');
        // Update cache with current status
        await this.statusCacheService.updateCache(currentVideos);
        return { message: 'No changes detected', changesDetected: 0 };
      }

      logger.info(`🚨 PRIORITY: Detected ${changes.length} status changes - triggering immediate workflow continuation`);
      
      // PRIORITY PROCESSING: Send notifications AND trigger workflow continuation immediately
      await this.processPriorityStatusChanges(changes);
      
      // Update cache with current status
      await this.statusCacheService.updateCache(currentVideos);
      
      logger.info(`✅ Priority status monitoring completed, ${changes.length} changes processed with workflow continuation`);
      return { 
        message: 'Priority status monitoring completed', 
        changesDetected: changes.length,
        changes: changes,
        priorityProcessing: true
      };

    } catch (error) {
      logger.error('Error in priority status monitoring:', error);
      throw error;
    }
  }

  /**
   * PRIORITY: Detect ALL status changes (comprehensive monitoring)
   * Unlike the original method, this treats ALL status changes as priority for immediate workflow continuation
   */
  detectPriorityStatusChanges(currentVideos, cachedVideos) {
    const changes = [];
    
    // Create lookup map for cached videos
    const cachedMap = new Map();
    cachedVideos.forEach(video => {
      cachedMap.set(video.videoId, video);
    });

    for (const currentVideo of currentVideos) {
      const cachedVideo = cachedMap.get(currentVideo.videoId);
      
      if (!cachedVideo) {
        // New video detected - skip since this is handled by other processes
        continue;
      }

      // PRIORITY: Check for changes in ALL monitored fields (no filtering)
      const changedFields = {};
      
      // Main workflow status
      if (currentVideo.status !== cachedVideo.status) {
        changedFields.status = {
          old: cachedVideo.status,
          new: currentVideo.status
        };
      }

      // Script approval status (critical workflow transition)
      if (currentVideo.scriptApproved !== cachedVideo.scriptApproved) {
        changedFields.scriptApproved = {
          old: cachedVideo.scriptApproved,
          new: currentVideo.scriptApproved
        };
      }

      // Voice generation status
      if (currentVideo.voiceGenerationStatus !== cachedVideo.voiceGenerationStatus) {
        changedFields.voiceGenerationStatus = {
          old: cachedVideo.voiceGenerationStatus,
          new: currentVideo.voiceGenerationStatus
        };
      }

      // Video editing status
      if (currentVideo.videoEditingStatus !== cachedVideo.videoEditingStatus) {
        changedFields.videoEditingStatus = {
          old: cachedVideo.videoEditingStatus,
          new: currentVideo.videoEditingStatus
        };
      }

      // PRIORITY: Record ANY change for immediate workflow continuation
      if (Object.keys(changedFields).length > 0) {
        changes.push({
          videoId: currentVideo.videoId,
          title: currentVideo.title,
          driveFolder: currentVideo.driveFolder,
          detailWorkbookUrl: currentVideo.detailWorkbookUrl,
          changes: changedFields,
          priorityLevel: this.determinePriorityLevel(changedFields),
          workflowAction: this.determineWorkflowAction(changedFields)
        });

        logger.info(`🚨 PRIORITY STATUS CHANGE: ${currentVideo.videoId} - ${Object.keys(changedFields).join(', ')}`);
      }
    }

    return changes;
  }

  /**
   * PRIORITY: Determine priority level based on status changes
   */
  determinePriorityLevel(changedFields) {
    // Critical priority for script approval changes
    if (changedFields.scriptApproved) {
      return 'CRITICAL';
    }
    
    // High priority for main status changes
    if (changedFields.status) {
      return 'HIGH';
    }
    
    // Medium priority for workflow status changes
    if (changedFields.voiceGenerationStatus || changedFields.videoEditingStatus) {
      return 'MEDIUM';
    }
    
    return 'NORMAL';
  }

  /**
   * PRIORITY: Determine what workflow action to take based on status changes
   */
  determineWorkflowAction(changedFields) {
    const actions = [];

    // Script approval workflow actions
    if (changedFields.scriptApproved) {
      if (changedFields.scriptApproved.new === 'Approved') {
        actions.push('TRIGGER_APPROVED_SCRIPT_WORKFLOW');
      } else if (changedFields.scriptApproved.new === 'Needs Changes') {
        actions.push('TRIGGER_SCRIPT_REGENERATION');
      }
    }

    // Voice generation workflow actions
    if (changedFields.voiceGenerationStatus) {
      if (changedFields.voiceGenerationStatus.new === 'Completed') {
        actions.push('UPDATE_VOICE_COMPLETION_STATUS');
        actions.push('CHECK_VIDEO_EDITING_ELIGIBILITY');
      }
    }

    // Video editing workflow actions
    if (changedFields.videoEditingStatus) {
      if (changedFields.videoEditingStatus.new === 'Completed') {
        actions.push('UPDATE_VIDEO_COMPLETION_STATUS');
        actions.push('NOTIFY_FINAL_COMPLETION');
      }
    }

    // Main status workflow actions
    if (changedFields.status) {
      actions.push('UPDATE_RELATED_COLUMNS');
      actions.push('SYNC_WORKFLOW_STATUS');
    }

    return actions.length > 0 ? actions : ['UPDATE_TIMESTAMPS'];
  }

  /**
   * PRIORITY: Process priority status changes with immediate workflow continuation
   */
  async processPriorityStatusChanges(changes) {
    try {
      logger.info(`🚨 Processing ${changes.length} priority status changes with workflow continuation`);

      // Sort changes by priority level (CRITICAL first)
      const sortedChanges = changes.sort((a, b) => {
        const priorityOrder = { 'CRITICAL': 0, 'HIGH': 1, 'MEDIUM': 2, 'NORMAL': 3 };
        return priorityOrder[a.priorityLevel] - priorityOrder[b.priorityLevel];
      });

      // Process each change with immediate workflow continuation
      for (const change of sortedChanges) {
        try {
          logger.info(`🚨 PRIORITY ${change.priorityLevel}: Processing ${change.videoId} - Actions: ${change.workflowAction.join(', ')}`);

          // 1. Send status change notifications
          await this.sendIndividualChangeNotifications(change);

          // 2. Update all related columns automatically
          await this.updateAllRelatedColumns(change);

          // 3. Execute workflow actions immediately
          await this.executeWorkflowActions(change);

          logger.info(`✅ Priority processing completed for ${change.videoId}`);

        } catch (changeError) {
          logger.error(`❌ Priority processing failed for ${change.videoId}:`, changeError);
          
          // Send error notification but continue processing other changes
          await this.sendPriorityProcessingError(change, changeError);
        }
      }

      logger.info(`✅ All ${changes.length} priority status changes processed successfully`);

    } catch (error) {
      logger.error('Error processing priority status changes:', error);
      throw error;
    }
  }

  /**
   * PRIORITY: Update all related columns when a status changes
   */
  async updateAllRelatedColumns(change) {
    try {
      const { videoId, changes: statusChanges } = change;
      const timestamp = this.getCurrentTimestamp();
      const updates = {};

      // Always update last edited time
      updates.lastEditedTime = timestamp;

      // Update related columns based on status changes
      for (const [field, changeInfo] of Object.entries(statusChanges)) {
        switch (field) {
        case 'scriptApproved':
          if (changeInfo.new === 'Approved') {
            // When script is approved, set voice generation to "Not Started" if not already set
            updates.voiceGenerationStatus = 'Not Started';
            updates.scriptApprovedTime = timestamp;
          } else if (changeInfo.new === 'Needs Changes') {
            // When script needs changes, reset related statuses
            updates.lastRegenTime = timestamp;
            updates.scriptNeedsChangesTime = timestamp;
          }
          break;

        case 'voiceGenerationStatus':
          if (changeInfo.new === 'Completed') {
            // When voice generation is complete, check if video editing should be available
            updates.voiceCompletedTime = timestamp;
            // Only set video editing to "Not Started" if it's currently empty/null
            const currentStatus = await this.googleSheetsService.getVideoField(videoId, 'videoEditingStatus');
            if (!currentStatus || currentStatus === '') {
              updates.videoEditingStatus = 'Not Started';
            }
          } else if (changeInfo.new === 'In Progress') {
            updates.voiceStartedTime = timestamp;
          }
          break;

        case 'videoEditingStatus':
          if (changeInfo.new === 'Completed') {
            updates.videoEditingCompletedTime = timestamp;
            // Update main status to completed when video editing is done
            updates.status = 'Completed';
            updates.processingCompletedTime = timestamp;
          } else if (changeInfo.new === 'In Progress') {
            updates.videoEditingStartedTime = timestamp;
          }
          break;

        case 'status':
          // Update status-specific timestamps
          if (changeInfo.new === 'Processing') {
            updates.processingStartedTime = timestamp;
          } else if (changeInfo.new === 'Completed') {
            updates.processingCompletedTime = timestamp;
          } else if (changeInfo.new === 'Error') {
            updates.errorTime = timestamp;
          }
          break;
        }
      }

      if (Object.keys(updates).length > 0) {
        // Update all related columns in Google Sheets
        await this.googleSheetsService.updateVideoFields(videoId, updates);
        logger.info(`✅ Updated ${Object.keys(updates).length} related columns for ${videoId}: ${Object.keys(updates).join(', ')}`);
      }

    } catch (error) {
      logger.error(`Failed to update related columns for ${change.videoId}:`, error);
      // Don't throw - this shouldn't stop the workflow
    }
  }

  /**
   * PRIORITY: Execute workflow actions based on status changes
   */
  async executeWorkflowActions(change) {
    try {
      const { videoId, workflowAction } = change;

      for (const action of workflowAction) {
        logger.info(`🚀 Executing workflow action: ${action} for ${videoId}`);

        switch (action) {
        case 'TRIGGER_APPROVED_SCRIPT_WORKFLOW':
          await this.handleScriptApproved(videoId, change);
          break;

        case 'TRIGGER_SCRIPT_REGENERATION':
          await this.handleScriptNeedsChanges(videoId, change.title, change.detailWorkbookUrl);
          break;

        case 'UPDATE_VOICE_COMPLETION_STATUS':
          await this.handleVoiceGenerationCompleted(videoId, change);
          break;

        case 'CHECK_VIDEO_EDITING_ELIGIBILITY':
          await this.checkVideoEditingEligibility(videoId, change);
          break;

        case 'UPDATE_VIDEO_COMPLETION_STATUS':
          await this.handleVideoEditingCompleted(videoId, change);
          break;

        case 'NOTIFY_FINAL_COMPLETION':
          await this.handleFinalCompletion(videoId, change);
          break;

        case 'UPDATE_RELATED_COLUMNS':
          // Already handled in updateAllRelatedColumns
          break;

        case 'SYNC_WORKFLOW_STATUS':
          await this.syncWorkflowStatus(videoId, change);
          break;

        case 'UPDATE_TIMESTAMPS':
          // Already handled in updateAllRelatedColumns
          break;

        default:
          logger.warn(`Unknown workflow action: ${action} for ${videoId}`);
        }
      }

    } catch (error) {
      logger.error(`Failed to execute workflow actions for ${change.videoId}:`, error);
      throw error;
    }
  }

  /**
   * Handle script approved - trigger complete approved script workflow
   */
  async handleScriptApproved(videoId, change) {
    try {
      logger.info(`🚀 PRIORITY: Script approved for ${videoId} - triggering complete workflow`);
      
      // Get video details for processApprovedScript
      const videoRow = await this.googleSheetsService.findVideoRow(videoId);
      if (!videoRow || !videoRow.data) {
        throw new Error('Video data not found in sheets');
      }
      
      const videoInfo = {
        videoId: videoId,
        title: change.title,
        youtubeUrl: videoRow.data[this.googleSheetsService.masterColumns.youtubeUrl],
        status: 'Approved',
        voiceGenerationStatus: videoRow.data[this.googleSheetsService.masterColumns.voiceGenerationStatus] || 'Not Started'
      };
      
      // If WorkflowService is available, trigger the complete approved script workflow
      if (this.workflowService) {
        await this.workflowService.processApprovedScript(videoInfo);
        logger.info(`✅ Complete approved script workflow triggered for ${videoId}`);
      } else {
        // Fallback: Create voice script only
        logger.warn(`${videoId}: WorkflowService not available, using fallback voice script creation`);
        await this.createVoiceScriptFallback(videoId, change.title);
      }
      
    } catch (error) {
      logger.error(`Failed to handle script approved for ${videoId}:`, error);
      throw error;
    }
  }

  /**
   * Handle voice generation completed - update status and check video editing eligibility
   */
  async handleVoiceGenerationCompleted(videoId, change) {
    try {
      logger.info(`🎤 Voice generation completed for ${videoId}`);
      
      await this.telegramService.sendMessage(
        `🎤 <b>Voice Generation Completed</b>\n\n🎬 ${videoId} - ${change.title}\n✅ Voice file is ready\n💡 <i>Video editing can now begin</i>`
      );
      
    } catch (error) {
      logger.error(`Failed to handle voice generation completed for ${videoId}:`, error);
      throw error;
    }
  }

  /**
   * Check video editing eligibility after voice completion
   */
  async checkVideoEditingEligibility(videoId, change) {
    try {
      logger.info(`🎬 Checking video editing eligibility for ${videoId}`);
      
      // Video editing is now eligible since voice generation is complete
      await this.telegramService.sendMessage(
        `📹 <b>Video Editing Ready</b>\n\n🎬 ${videoId} - ${change.title}\n🎤 Voice: Completed\n🎯 Status: Ready for video editing\n\n💡 <i>Update Video Editing Status to begin</i>`
      );
      
    } catch (error) {
      logger.error(`Failed to check video editing eligibility for ${videoId}:`, error);
      throw error;
    }
  }

  /**
   * Handle video editing completed - update final status
   */
  async handleVideoEditingCompleted(videoId, change) {
    try {
      logger.info(`🎬 Video editing completed for ${videoId}`);
      
      await this.telegramService.sendMessage(
        `📹 <b>Video Editing Completed</b>\n\n🎬 ${videoId} - ${change.title}\n✅ Video editing is complete\n🎯 Status: Ready for final review`
      );
      
    } catch (error) {
      logger.error(`Failed to handle video editing completed for ${videoId}:`, error);
      throw error;
    }
  }

  /**
   * Handle final completion notification
   */
  async handleFinalCompletion(videoId, change) {
    try {
      logger.info(`🎉 Final completion notification for ${videoId}`);
      
      await this.telegramService.sendMessage(
        `🎉 <b>Production Complete</b>\n\n🎬 ${videoId} - ${change.title}\n✅ All stages completed successfully\n🎤 Voice: ✅ Complete\n📹 Video: ✅ Complete\n\n🚀 <i>Ready for upload and distribution!</i>`
      );
      
    } catch (error) {
      logger.error(`Failed to handle final completion for ${videoId}:`, error);
      throw error;
    }
  }

  /**
   * Sync workflow status across related columns
   */
  async syncWorkflowStatus(videoId, change) {
    try {
      logger.info(`🔄 Syncing workflow status for ${videoId}`);
      
      // This is handled by updateAllRelatedColumns, but we can add additional logic here if needed
      await this.telegramService.sendMessage(
        `🔄 <b>Status Updated</b>\n\n🎬 ${videoId} - ${change.title}\n📊 Status: ${Object.entries(change.changes).map(([field, change]) => `${field}: ${change.old} → ${change.new}`).join('\n')}\n\n✅ <i>All related columns updated automatically</i>`
      );
      
    } catch (error) {
      logger.error(`Failed to sync workflow status for ${videoId}:`, error);
      throw error;
    }
  }

  /**
   * Send priority processing error notification
   */
  async sendPriorityProcessingError(change, error) {
    try {
      await this.telegramService.sendMessage(
        `❌ <b>Priority Processing Error</b>\n\n🎬 ${change.videoId} - ${change.title}\n🚨 Priority: ${change.priorityLevel}\n⚠️ Error: ${error.message}\n\n🔧 Manual intervention may be required`
      );
    } catch (notificationError) {
      logger.error(`Failed to send priority processing error notification for ${change.videoId}:`, notificationError);
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
   * Send individual notifications for a video's status changes (PRIORITY-ENHANCED)
   */
  async sendIndividualChangeNotifications(change) {
    try {
      const { videoId, title, driveFolder, detailWorkbookUrl, changes: statusChanges, priorityLevel } = change;

      // Send notification for each field that changed
      for (const [field, changeInfo] of Object.entries(statusChanges)) {
        switch (field) {
        case 'scriptApproved':
          // PRIORITY ENHANCED: Send notification with priority level
          await this.telegramService.sendMessage(
            `🚨 <b>PRIORITY ${priorityLevel}: Script Status Changed</b>\n\n🎬 ${videoId} - ${title}\n📋 Script Approved: ${changeInfo.old} → ${changeInfo.new}\n\n🚀 <i>Immediate workflow continuation triggered</i>\n\n📊 [Master Sheet](${this.masterSheetUrl})${detailWorkbookUrl ? `\n📋 [Detail Workbook](${detailWorkbookUrl})` : ''}`
          );
          break;

        case 'voiceGenerationStatus':
          // PRIORITY ENHANCED: Send notification with priority level  
          await this.telegramService.sendMessage(
            `🚨 <b>PRIORITY ${priorityLevel}: Voice Status Changed</b>\n\n🎬 ${videoId} - ${title}\n🎤 Voice Generation: ${changeInfo.old} → ${changeInfo.new}\n\n🚀 <i>Related columns updated automatically</i>\n\n📊 [Master Sheet](${this.masterSheetUrl})${detailWorkbookUrl ? `\n📋 [Detail Workbook](${detailWorkbookUrl})` : ''}`
          );
          break;

        case 'videoEditingStatus':
          // PRIORITY ENHANCED: Send notification with priority level
          await this.telegramService.sendMessage(
            `🚨 <b>PRIORITY ${priorityLevel}: Video Editing Status Changed</b>\n\n🎬 ${videoId} - ${title}\n📹 Video Editing: ${changeInfo.old} → ${changeInfo.new}\n\n🚀 <i>Workflow status synchronized</i>\n\n📊 [Master Sheet](${this.masterSheetUrl})${detailWorkbookUrl ? `\n📋 [Detail Workbook](${detailWorkbookUrl})` : ''}${driveFolder ? `\n📁 [Drive Folder](${driveFolder})` : ''}`
          );
          break;

        case 'status':
          // PRIORITY ENHANCED: Handle main status changes
          await this.telegramService.sendMessage(
            `🚨 <b>PRIORITY ${priorityLevel}: Main Status Changed</b>\n\n🎬 ${videoId} - ${title}\n📊 Status: ${changeInfo.old} → ${changeInfo.new}\n\n🚀 <i>All related columns synchronized</i>\n\n📊 [Master Sheet](${this.masterSheetUrl})${detailWorkbookUrl ? `\n📋 [Detail Workbook](${detailWorkbookUrl})` : ''}`
          );
          break;

        default:
          // PRIORITY: Handle any other status field changes
          await this.telegramService.sendMessage(
            `🚨 <b>PRIORITY ${priorityLevel || 'NORMAL'}: Status Field Changed</b>\n\n🎬 ${videoId} - ${title}\n🔄 ${field}: ${changeInfo.old} → ${changeInfo.new}\n\n✅ <i>Change processed automatically</i>\n\n📊 [Master Sheet](${this.masterSheetUrl})`
          );
          logger.info(`PRIORITY: Processed unknown status field: ${field} for ${videoId}`);
        }
      }
    } catch (error) {
      logger.error(`Error sending notifications for video ${change.videoId}:`, error);
      throw error;
    }
  }

  /**
   * Handle script needs changes - trigger complete AI script regeneration with backup
   */
  async handleScriptNeedsChanges(videoId, _title, detailWorkbookUrl) {
    try {
      logger.info(`${videoId}: Starting complete AI script regeneration process`);
      
      // Get video title for backup and logging
      const videoData = await this.metadataService.getVideoData(videoId);
      const title = videoData.title;
      
      // 1. Create backup of existing script content before regeneration
      await this.createScriptBackup(videoId, title);
      
      // 2. Reset main automation status to "Processing" 
      await this.googleSheetsService.updateVideoStatus(videoId, 'Processing');
      
      // 3. Reset Script Approved to "Pending"
      await this.googleSheetsService.updateVideoField(videoId, 'scriptApproved', 'Pending');
      
      // 4. Mark video as being regenerated for voice script force recreation
      await this.googleSheetsService.updateVideoFields(videoId, {
        lastRegenTime: new Date().toISOString(),
        scriptRegenAttempts: (parseInt(await this.googleSheetsService.getVideoField(videoId, 'scriptRegenAttempts') || '0') + 1).toString()
      });
      
      // 5. Send initial regeneration notification
      await this.telegramService.sendMessage(
        `🔄 <b>Script Regeneration Started</b>\n\n🎬 ${videoId} - ${title}\n🤖 Generating new faceless script with AI\n⏳ Please wait for completion...\n\n📊 [Master Sheet](${this.masterSheetUrl})${detailWorkbookUrl ? `\n📋 [Detail Workbook](${detailWorkbookUrl})` : ''}`
      );
      
      // 6. **NEW**: Generate completely new script content with AI using faceless prompts
      await this.regenerateScriptWithAI(videoId, title);
      
      // 7. Create voice script from newly generated faceless content
      await this.createVoiceScriptFromNewContent(videoId, title);
      
      // 8. Send completion notification
      await this.telegramService.sendMessage(
        `✅ <b>Script Regeneration Completed</b>\n\n🎬 ${videoId} - ${title}\n🤖 New faceless script generated successfully\n📄 Voice script created and uploaded\n🔄 Ready for approval\n\n📊 [Master Sheet](${this.masterSheetUrl})${detailWorkbookUrl ? `\n📋 [Detail Workbook](${detailWorkbookUrl})` : ''}`
      );
      
      logger.info(`${videoId}: Complete AI script regeneration finished successfully`);
      
    } catch (error) {
      logger.error(`Error handling script needs changes for ${videoId}:`, error);
      
      // Send error notification
      await this.telegramService.sendMessage(
        `❌ <b>Script Regeneration Failed</b>\n\n🎬 ${videoId}\n🔄 Failed to regenerate script with AI\n📋 Error: ${error.message}\n\n🔧 Manual intervention required`
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
   * Generate completely new script content using AI with faceless prompts
   */
  async regenerateScriptWithAI(videoId, _title) {
    try {
      logger.info(`${videoId}: Generating new script content with AI and faceless prompts`);
      
      // Get original video data for AI processing
      const videoRow = await this.googleSheetsService.findVideoRow(videoId);
      if (!videoRow || !videoRow.data) {
        throw new Error(`Video data not found in sheets for ${videoId}`);
      }
      
      const youtubeUrl = videoRow.data[this.googleSheetsService.masterColumns.youtubeUrl];
      if (!youtubeUrl) {
        throw new Error(`YouTube URL not found for ${videoId}`);
      }
      
      // Get complete video data from YouTube
      const videoData = await this.youtubeService.getCompleteVideoData(youtubeUrl);
      videoData.videoId = videoId;
      
      logger.info(`${videoId}: Retrieved video data - Title: ${videoData.title}, Duration: ${videoData.duration}`);
      
      // Generate new enhanced content with AI (this applies all faceless channel prompts)
      logger.info(`${videoId}: Calling AI service to generate new faceless script content...`);
      const enhancedContent = await this.aiService.enhanceContentWithAI(videoData, this.metadataService);
      
      if (!enhancedContent || !enhancedContent.attractiveScript) {
        throw new Error(`AI failed to generate new script content for ${videoId}`);
      }
      
      // PRODUCTION SAFETY: Prevent test content from being used in production
      if (enhancedContent.attractiveScript.includes('TEST') || 
          (enhancedContent.scriptSentences && enhancedContent.scriptSentences.some(s => s.includes('TEST')))) {
        logger.warn(`${videoId}: Test content detected in AI response - regenerating with production prompts`);
        throw new Error('Test content detected in AI response. Please ensure production AI service is configured correctly.');
      }
      
      logger.info(`${videoId}: AI generated new script content successfully`);
      logger.info(`  • Script sections: ${enhancedContent.scriptSentences?.length || 'unknown'} sentences`);
      logger.info(`  • Script content: ${enhancedContent.attractiveScript ? 'Generated' : 'Missing'}`);
      logger.info(`  • Script length: ${enhancedContent.attractiveScript?.length || 0} characters`);
      
      // Update Google Sheets with new script content
      await this.updateSheetsWithNewScript(videoId, enhancedContent);
      
      logger.info(`${videoId}: Successfully updated Google Sheets with new faceless script content`);
      return enhancedContent;
      
    } catch (error) {
      logger.error(`${videoId}: Failed to regenerate script with AI:`, error);
      throw error;
    }
  }

  /**
   * Update Google Sheets with newly generated script content
   * FIX: Clear and reconstruct complete Video Info sheet to prevent content duplication
   */
  async updateSheetsWithNewScript(videoId, enhancedContent) {
    try {
      logger.info(`${videoId}: Updating Google Sheets with new script content - CLEARING AND RECONSTRUCTING`);
      
      // Get detail workbook URL
      const videoRow = await this.googleSheetsService.findVideoRow(videoId);
      const workbookUrl = videoRow.data[this.googleSheetsService.masterColumns.detailWorkbookUrl];
      
      if (!workbookUrl) {
        throw new Error(`Detail workbook URL not found for ${videoId}`);
      }
      
      const workbookId = workbookUrl.split('/d/')[1].split('/')[0];
      
      // STEP 1: CLEAR THE ENTIRE VIDEO INFO SHEET to prevent duplication
      logger.info(`${videoId}: Clearing Video Info sheet to prevent content duplication`);
      await this.clearVideoInfoSheet(workbookId);
      
      // STEP 2: Get original video data for complete reconstruction
      const originalVideoData = await this.getOriginalVideoData(videoId);
      
      // STEP 3: RECONSTRUCT COMPLETE VIDEO INFO SHEET with new script content
      logger.info(`${videoId}: Reconstructing complete Video Info sheet with regenerated content`);
      await this.reconstructCompleteVideoInfoSheet(workbookId, videoId, originalVideoData, enhancedContent);
      
      // STEP 4: Update Script Details sheet with script sentences
      if (enhancedContent.scriptSentences && enhancedContent.scriptSentences.length > 0) {
        logger.info(`${videoId}: Updating Script Breakdown sheet with ${enhancedContent.scriptSentences.length} new sentences`);
        
        const scriptDetailsHeaders = ['Sentence #', 'Script Text', 'Image Prompt', 'Status', 'Image URL'];
        const scriptDetailsData = [scriptDetailsHeaders];
        
        enhancedContent.scriptSentences.forEach((sentence, index) => {
          scriptDetailsData.push([
            `${index + 1}`, // Sentence number (1, 2, 3, etc.)
            sentence || '',
            '', // Image Prompt - empty for regenerated content
            'Pending', // Status - pending for new content
            '' // Image URL - empty for regenerated content
          ]);
        });
        
        // Clear and update Script Breakdown sheet
        await this.googleSheetsService.sheets.spreadsheets.values.clear({
          spreadsheetId: workbookId,
          range: `${this.googleSheetsService.detailSheets.scriptBreakdown}!A1:Z1000`
        });
        
        await this.googleSheetsService.sheets.spreadsheets.values.update({
          spreadsheetId: workbookId,
          range: `${this.googleSheetsService.detailSheets.scriptBreakdown}!A1:E${scriptDetailsData.length}`,
          valueInputOption: 'RAW',
          resource: {
            values: scriptDetailsData
          }
        });
        
        logger.info(`${videoId}: Updated Script Breakdown sheet with ${enhancedContent.scriptSentences.length} sentences`);
      }
      
      logger.info(`${videoId}: Google Sheets updated successfully with new script content - NO DUPLICATION`);
      
    } catch (error) {
      logger.error(`${videoId}: Failed to update Google Sheets with new script:`, error);
      throw error;
    }
  }

  /**
   * Clear the entire Video Info sheet to prevent content duplication
   */
  async clearVideoInfoSheet(workbookId) {
    try {
      // Clear the entire Video Info sheet (up to 500 rows to be safe)
      await this.googleSheetsService.sheets.spreadsheets.values.clear({
        spreadsheetId: workbookId,
        range: `${this.googleSheetsService.detailSheets.videoInfo}!A1:Z500`
      });
      
      logger.info(`Video Info sheet cleared successfully for workbook ${workbookId}`);
    } catch (error) {
      logger.error('Failed to clear Video Info sheet:', error);
      throw error;
    }
  }

  /**
   * Get original video data needed for Video Info sheet reconstruction
   */
  async getOriginalVideoData(videoId) {
    try {
      // Get video data from master sheet
      const videoRow = await this.googleSheetsService.findVideoRow(videoId);
      if (!videoRow || !videoRow.data) {
        throw new Error(`Video data not found for ${videoId}`);
      }
      
      const data = videoRow.data;
      const columns = this.googleSheetsService.masterColumns;
      
      // Extract original video metadata
      const originalVideoData = {
        videoId: data[columns.videoId],
        title: data[columns.title],
        youtubeUrl: data[columns.youtubeUrl],
        channelTitle: data[columns.channel],
        duration: data[columns.duration],
        viewCount: data[columns.viewCount],
        publishedAt: data[columns.publishedDate],
        id: data[columns.youtubeVideoId]
      };
      
      logger.info(`Retrieved original video data for ${videoId}: ${originalVideoData.title}`);
      return originalVideoData;
      
    } catch (error) {
      logger.error(`Failed to get original video data for ${videoId}:`, error);
      throw error;
    }
  }

  /**
   * Reconstruct complete Video Info sheet with regenerated content
   * This maintains the same structure as the original populateVideoInfoSheet but with new script content
   */
  async reconstructCompleteVideoInfoSheet(workbookId, videoId, originalVideoData, enhancedContent) {
    try {
      // PRODUCTION SAFETY: Validate content before processing
      if (enhancedContent.attractiveScript.includes('TEST') || 
          (enhancedContent.scriptSentences && enhancedContent.scriptSentences.some(s => s.includes('TEST')))) {
        throw new Error(`${videoId}: Test content detected - aborting Video Info sheet update`);
      }
      
      // Convert sentences array to formatted string for Google Sheets display
      const cleanVoiceScript = enhancedContent.scriptSentences && enhancedContent.scriptSentences.length > 0 
        ? enhancedContent.scriptSentences.map(sentence => sentence.trim()).join('\n\n')
        : (enhancedContent.attractiveScript || '');

      // Prepare complete video info data for the Video Info sheet (same structure as original)
      const videoInfoData = [
        ['Video Title', originalVideoData.title],
        ['YouTube URL', originalVideoData.youtubeUrl || ''],
        ['YouTube Video ID', originalVideoData.id || ''],
        ['Channel', originalVideoData.channelTitle || ''],
        ['Duration', originalVideoData.duration || ''],
        ['View Count', originalVideoData.viewCount || ''],
        ['Published Date', originalVideoData.publishedAt || ''],
        ['Processing Status', '🔄 Script Regenerated - Ready for Approval'],
        ['', ''], // Empty row
        
        // Enhanced script content (NEW REGENERATED CONTENT)
        ['🤖 AI-GENERATED SCRIPT CONTENT', '✨ NEWLY REGENERATED'],
        ['', ''], // Empty row
        ['Attractive Script', enhancedContent.attractiveScript || ''],
        ['Script Sentences', enhancedContent.scriptSentences?.join('\n') || ''],
        ['Clean Voice Script', cleanVoiceScript],
        ['', ''], // Empty row
        
        // Add YouTube Video Description section for regenerated content
        ['📝 YOUTUBE VIDEO DESCRIPTION', '✨ NEWLY REGENERATED'],
        ['', ''], // Empty row
        ['Description Content', enhancedContent.optimizedDescription || ''],
        ['', ''], // Empty row
        ['Description Guidelines', 'This description is optimized for YouTube SEO and engagement. Copy-paste directly to YouTube description box.'],
        ['Features', '✓ YouTube-optimized hook (first 125 characters)\n✓ Natural keyword integration\n✓ Engagement CTAs\n✓ Faceless channel appropriate\n✓ NO external links'],
        ['', ''], // Empty row
        
        // Regeneration metadata
        ['🔄 REGENERATION INFO', ''],
        ['Regenerated At', this.getCurrentTimestamp()],
        ['Regeneration Type', 'Complete AI Script Regeneration'],
        ['Status', 'Pending Approval'],
        ['', ''], // Empty row
      ];

      // Add enhanced keyword research data if available from regeneration
      if (enhancedContent.keywords) {
        const keywords = enhancedContent.keywords;
        
        videoInfoData.push(['🎯 ENHANCED KEYWORD STRATEGY', '✨ REGENERATED']);
        videoInfoData.push(['', '']); // Empty row
        
        // Core SEO Keywords
        if (keywords.primaryKeywords?.length > 0) {
          videoInfoData.push(['🔑 Primary Keywords', keywords.primaryKeywords.join(', ')]);
        }
        if (keywords.longTailKeywords?.length > 0) {
          videoInfoData.push(['🎯 Long-tail Keywords', keywords.longTailKeywords.join(', ')]);
        }
        if (keywords.semanticKeywords?.length > 0) {
          videoInfoData.push(['🔗 Semantic Keywords', keywords.semanticKeywords.join(', ')]);
        }
        
        videoInfoData.push(['', '']); // Empty row
        
        // YouTube Algorithm Optimization
        if (keywords.youtubeSearchKeywords?.length > 0) {
          videoInfoData.push(['🔍 YouTube Search Keywords', keywords.youtubeSearchKeywords.join(', ')]);
        }
        if (keywords.browseFeedKeywords?.length > 0) {
          videoInfoData.push(['📺 Browse Feed Keywords', keywords.browseFeedKeywords.join(', ')]);
        }
        if (keywords.shortsOptimizedKeywords?.length > 0) {
          videoInfoData.push(['📱 Shorts Optimized Keywords', keywords.shortsOptimizedKeywords.join(', ')]);
        }
        
        videoInfoData.push(['', '']); // Empty row
        
        // Engagement & Performance
        if (keywords.algorithmBoostKeywords?.length > 0) {
          videoInfoData.push(['🚀 Algorithm Boost Keywords', keywords.algorithmBoostKeywords.join(', ')]);
        }
        if (keywords.engagementTriggerKeywords?.length > 0) {
          videoInfoData.push(['💬 Engagement Trigger Keywords', keywords.engagementTriggerKeywords.join(', ')]);
        }
        if (keywords.retentionKeywords?.length > 0) {
          videoInfoData.push(['⏱️ Retention Keywords', keywords.retentionKeywords.join(', ')]);
        }
        
        videoInfoData.push(['', '']); // Empty row
        
        // Discovery & Competition
        if (keywords.questionKeywords?.length > 0) {
          videoInfoData.push(['❓ Question Keywords', keywords.questionKeywords.join(', ')]);
        }
        if (keywords.competitiveKeywords?.length > 0) {
          videoInfoData.push(['🎯 Competitive Gap Keywords', keywords.competitiveKeywords.join(', ')]);
        }
        if (keywords.trendingHashtags?.length > 0) {
          videoInfoData.push(['#️⃣ Trending Hashtags', keywords.trendingHashtags.join(', ')]);
        }
        if (keywords.relatedTopics?.length > 0) {
          videoInfoData.push(['📊 Related Topics', keywords.relatedTopics.join(', ')]);
        }
      }

      // Add optimized title options if available from regeneration
      if (enhancedContent.optimizedTitles && enhancedContent.optimizedTitles.options) {
        videoInfoData.push(['', '']); // Empty row
        videoInfoData.push(['🎬 OPTIMIZED TITLE OPTIONS', '✨ REGENERATED']);
        videoInfoData.push(['Click-Through Rate Optimized Titles', '']);
        videoInfoData.push(['', '']); // Empty row
        videoInfoData.push(['Recommended Title:', enhancedContent.optimizedTitles.recommended || '']);
        videoInfoData.push(['', '']); // Empty row separator
        enhancedContent.optimizedTitles.options.forEach((title, index) => {
          videoInfoData.push([`Title Option ${index + 1}`, title || '']);
        });
      }

      // Generate new thumbnail suggestions for regenerated content
      try {
        const thumbnailSuggestions = await this.aiService.generateThumbnailSuggestions(
          originalVideoData, 
          enhancedContent.attractiveScript
        );
        
        videoInfoData.push(['', '']); // Empty row
        videoInfoData.push(['🎨 THUMBNAIL DESIGN SUGGESTIONS', '✨ REGENERATED']);
        videoInfoData.push(['2 Different Styles for Maximum Impact:', '']);
        videoInfoData.push(['', '']); // Empty row
        videoInfoData.push(['Thumbnail Concepts:', thumbnailSuggestions || 'Unable to generate thumbnail suggestions']);
      } catch (error) {
        logger.warn(`Failed to generate thumbnail suggestions for regenerated ${videoId}:`, error.message);
        videoInfoData.push(['', '']); // Empty row
        videoInfoData.push(['🎨 THUMBNAIL DESIGN SUGGESTIONS', '✨ REGENERATED']);
        videoInfoData.push(['Error:', 'Unable to generate thumbnail suggestions. Please create thumbnails manually.']);
        videoInfoData.push(['Style 1:', 'Emotional/Dramatic - Use bright colors, close-up faces, and emotional expressions']);
        videoInfoData.push(['Style 2:', 'Professional/Clean - Use minimal design, clear typography, and visual metaphors']);
      }

      // Update Video Info sheet with complete reconstructed data
      await this.googleSheetsService.sheets.spreadsheets.values.update({
        spreadsheetId: workbookId,
        range: `${this.googleSheetsService.detailSheets.videoInfo}!A1:B${videoInfoData.length}`,
        valueInputOption: 'USER_ENTERED',
        resource: {
          values: videoInfoData
        }
      });

      logger.info(`Successfully reconstructed complete Video Info sheet for ${videoId} with ${videoInfoData.length} rows - NO DUPLICATION`);
      
    } catch (error) {
      logger.error(`Failed to reconstruct Video Info sheet for ${videoId}:`, error);
      throw error;
    }
  }

  /**
   * Create voice script from newly generated faceless content
   */
  async createVoiceScriptFromNewContent(videoId, title) {
    try {
      logger.info(`${videoId}: Creating voice script from new faceless content`);
      
      // Force recreate voice script with new content (isRegenerating = true)
      const voiceScriptResult = await this.googleSheetsService.createAndUploadVoiceScript(videoId, true);
      
      if (voiceScriptResult && !voiceScriptResult.skipped) {
        logger.info(`${videoId}: Voice script created successfully from new content: ${voiceScriptResult.fileName}`);
        
        await this.telegramService.sendMessage(
          `📄 <b>Voice Script Updated</b>\n\n🎬 ${videoId} - ${title}\n📄 File: ${voiceScriptResult.fileName}\n📁 [View File](${voiceScriptResult.viewLink})\n\n✨ <i>Generated from new faceless script content</i>`
        );
      } else {
        logger.warn(`${videoId}: Voice script creation was skipped: ${voiceScriptResult?.message || 'Unknown reason'}`);
      }
      
    } catch (error) {
      logger.error(`${videoId}: Failed to create voice script from new content:`, error);
      throw error;
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