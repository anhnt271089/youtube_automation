import TelegramBot from 'node-telegram-bot-api';
import { config } from '../../config/config.js';
import logger from '../utils/logger.js';

class TelegramService {
  constructor() {
    this.bot = new TelegramBot(config.telegram.botToken, { 
      polling: false,
      request: {
        timeout: config.telegram.requestTimeout,
        // Enable connection reuse
        forever: true,
        pool: {
          maxSockets: 5
        },
        // Additional network resilience
        keepAlive: true,
        keepAliveMsecs: 30000,
        // DNS settings
        family: 0, // Allow both IPv4 and IPv6
        lookup: undefined // Use default DNS lookup
      }
    });
    this.chatId = config.telegram.chatId;
    this.maxRetries = Math.max(config.telegram.maxRetries, 5); // Minimum 5 retries for network issues
    this.retryDelay = config.telegram.retryDelay;
    this.fallbackEnabled = true;
    this.networkTimeoutCount = 0;
    this.lastSuccessfulMessage = null;
  }

  /**
   * Send message with enhanced retry logic and network error handling
   */
  async sendMessage(message, options = {}) {
    // Track network timeout occurrences for adaptive behavior
    let isTimeoutRetry = false;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        // Use longer timeout for retry attempts after network failures
        const adaptiveTimeout = isTimeoutRetry ? 
          Math.min(config.telegram.requestTimeout * 2, 60000) : 
          config.telegram.requestTimeout;
        
        // Create a fresh bot instance for critical retries
        const botInstance = attempt > 2 ? 
          new TelegramBot(config.telegram.botToken, {
            polling: false,
            request: {
              timeout: adaptiveTimeout,
              forever: false, // Disable connection reuse for retries
              keepAlive: false
            }
          }) : this.bot;
        
        const response = await botInstance.sendMessage(this.chatId, message, {
          parse_mode: 'HTML',
          disable_web_page_preview: true,
          ...options
        });
        
        // Reset timeout counter on success
        this.networkTimeoutCount = 0;
        this.lastSuccessfulMessage = Date.now();
        
        if (attempt > 1) {
          logger.info(`✅ Telegram sent successfully on attempt ${attempt} (timeout: ${adaptiveTimeout}ms)`);
        } else {
          logger.info('✅ Telegram sent successfully');
        }
        return response;
      } catch (error) {
        const isNetworkError = this.isNetworkError(error);
        const isRetryable = this.isRetryableError(error);
        const isTimeoutError = this.isTimeoutError(error);
        const isLastAttempt = attempt === this.maxRetries;
        
        // Track timeout occurrences for adaptive behavior
        if (isTimeoutError) {
          this.networkTimeoutCount++;
          isTimeoutRetry = true;
        }
        
        if (isNetworkError || isRetryable) {
          logger.warn(`🔄 Telegram attempt ${attempt}/${this.maxRetries} failed:`, {
            error: error.message,
            code: error.code,
            response: error.response?.status,
            isNetworkError,
            isRetryable,
            isTimeoutError,
            timeoutCount: this.networkTimeoutCount
          });
          
          if (!isLastAttempt) {
            const delay = this.calculateRetryDelay(attempt, isTimeoutError);
            logger.info(`⏳ Retrying Telegram message in ${delay}ms (adaptive timeout: ${isTimeoutRetry})...`);
            await this.sleep(delay);
            continue;
          }
        }
        
        // Enhanced error logging with network analysis
        logger.error('❌ Telegram message failed after all retries:', {
          attempts: attempt,
          error: error.message,
          code: error.code,
          errno: error.errno,
          syscall: error.syscall,
          address: error.address,
          port: error.port,
          networkTimeoutCount: this.networkTimeoutCount,
          lastSuccess: this.lastSuccessfulMessage,
          response: error.response ? {
            status: error.response.status,
            statusText: error.response.statusText,
            data: error.response.data
          } : 'No response',
          diagnosticSuggestion: this.getDiagnosticSuggestion(error)
        });
        
        // Enable fallback logging if all retries failed
        this.logToFallback(message, error);
        
        throw error;
      }
    }
  }

  async sendVideoProcessingStarted(videoData, masterSheetUrl = null) {
    const title = videoData.displayTitle || videoData.title;
    let message = `🎬 <b>Processing Started</b>\n\n📹 ${title}\n📺 ${videoData.channelTitle}\n⏱️ ${videoData.duration}`;
    
    // Add Master Sheet link for status tracking
    if (masterSheetUrl) {
      message += `\n\n📊 <a href="${masterSheetUrl}">View Master Sheet</a>`;
    }
    
    return await this.sendMessage(message);
  }

  async sendScriptGenerated(videoTitle, _scriptPreview, workbookUrl = null, masterSheetUrl = null) {
    let message = `✍️ <b>Script Separated</b>\n\n🎬 ${videoTitle}\n✅ Ready for approval`;
    
    // Add relevant links
    const links = [];
    if (workbookUrl) {
      links.push(`📋 <a href="${workbookUrl}">Review Script Details</a>`);
    }
    if (masterSheetUrl) {
      links.push(`📊 <a href="${masterSheetUrl}">View Master Sheet</a>`);
    }
    
    if (links.length > 0) {
      message += `\n\n${links.join('\n')}`;
    }
    
    return await this.sendMessage(message);
  }

  async sendScriptApprovalRequest(videoTitle, workbookUrl, masterSheetUrl = null) {
    let message = `⚠️ <b>Approval Required</b>\n\n🎬 ${videoTitle}`;
    
    // Add workbook link for detailed review
    if (workbookUrl) {
      message += `\n\n📋 <a href="${workbookUrl}">Review Script in Google Sheets</a>`;
    } else {
      message += '\n\n📋 Review script in video detail workbook';
    }
    
    // Add master sheet link for status updates
    if (masterSheetUrl) {
      message += `\n📊 <a href="${masterSheetUrl}">Update Status in Master Sheet</a>`;
    }
    
    return await this.sendMessage(message);
  }

  async sendImageGenerationUpdate(videoTitle, completedImages, totalImages, driveFolderUrl = null, workbookUrl = null) {
    let message = `
🖼️ <b>Image Generation Progress</b>

🎬 <b>Video:</b> ${videoTitle}
📊 <b>Progress:</b> ${completedImages}/${totalImages} images generated

${completedImages === totalImages ? '✅ All images generated successfully!' : '⏳ Generating remaining images...'}`;
    
    // Add relevant links when images are being generated
    const links = [];
    if (driveFolderUrl && completedImages > 0) {
      links.push(`📁 <a href="${driveFolderUrl}">View Images in Drive</a>`);
    }
    if (workbookUrl) {
      links.push(`📋 <a href="${workbookUrl}">View Script Breakdown</a>`);
    }
    
    if (links.length > 0) {
      message += `\n\n${links.join('\n')}`;
    }
    
    return await this.sendMessage(message);
  }

  async sendImageGenerationCompleted(videoTitle, imageCount, driveFolderUrl = null, workbookUrl = null) {
    let message;
    
    if (imageCount === 0) {
      message = `🖼️ <b>Image Generation</b>\n\n🎬 ${videoTitle}\n⚠️ No images generated`;
    } else {
      message = `🖼️ <b>Images Generated</b>\n\n🎬 ${videoTitle}\n✅ ${imageCount} images created and saved`;
    }
    
    // Add relevant links
    const links = [];
    if (driveFolderUrl && imageCount > 0) {
      links.push(`📁 <a href="${driveFolderUrl}">View Images in Drive</a>`);
    }
    if (workbookUrl) {
      links.push(`📋 <a href="${workbookUrl}">View Script Breakdown</a>`);
    }
    
    if (links.length > 0) {
      message += `\n\n${links.join('\n')}`;
    }
    
    return await this.sendMessage(message);
  }

  async sendThumbnailGenerated(videoTitle, thumbnailUrl, driveFolderUrl = null, workbookUrl = null) {
    let message = `
🖼️ <b>Thumbnail Generated</b>

🎬 <b>Video:</b> ${videoTitle}
🎨 <b>Thumbnail:</b> <a href="${thumbnailUrl}">View Generated Thumbnail</a>

✅ <b>Status:</b> Ready for final video assembly`;

    // Add relevant links
    const links = [];
    if (driveFolderUrl) {
      links.push(`📁 <a href="${driveFolderUrl}">View All Assets in Drive</a>`);
    }
    if (workbookUrl) {
      links.push(`📋 <a href="${workbookUrl}">View Video Details</a>`);
    }
    
    if (links.length > 0) {
      message += `\n\n${links.join('\n')}`;
    }

    return await this.sendMessage(message);
  }

  async sendVideoCompleted(videoData, driveFolder, finalVideoUrl, workbookUrl = null, masterSheetUrl = null, voiceScriptUrl = null) {
    const title = videoData.displayTitle || videoData.optimizedTitle || videoData.title;
    const costSummary = videoData.costSummary;
    
    let message = `
🤖 <b>Video Automation Flow Complete!</b>

🎬 <b>Title:</b> ${title}
📹 <b>Original:</b> ${videoData.originalUrl}

📊 <b>Generated Content:</b>
✅ Optimized script
✅ SEO description  
✅ Keyword research
✅ Generated images
✅ Voice script (ready for voice generation)

👥 <b>Next Steps (Manual):</b>
🎙️ Voice generation using provided script
🎬 Video editing and assembly`;

    // Add full flow cost breakdown if available
    if (costSummary) {
      message += `\n\n💰 <b>Full Flow Cost Summary:</b>
📈 Total Cost: $${costSummary.totalCost.toFixed(4)}
🖼️ Images Generated: ${costSummary.totalImagesGenerated}
📊 Average Cost/Video: $${costSummary.averageCostPerVideo.toFixed(4)}
💡 Savings vs DALL-E 3: $${costSummary.costSavingsVsDallE3.toFixed(4)}`;
    }

    // Add all relevant links
    message += '\n\n📋 <b>Access Your Content:</b>';
    const links = [];
    if (driveFolder) {
      links.push(`📁 <a href="${driveFolder}">Drive Folder - All Assets</a>`);
    }
    if (voiceScriptUrl) {
      links.push(`🎙️ <a href="${voiceScriptUrl}">Voice Script File</a>`);
    }
    if (workbookUrl) {
      links.push(`📋 <a href="${workbookUrl}">Video Detail Workbook</a>`);
    }
    if (masterSheetUrl) {
      links.push(`📊 <a href="${masterSheetUrl}">Master Sheet</a>`);
    }
    
    if (links.length > 0) {
      message += `\n${links.join('\n')}`;
    }

    message += '\n\n<b>Ready for voice generation and editing!</b> 🎬';

    return await this.sendMessage(message);
  }

  async sendError(videoTitle, errorMessage, stage, masterSheetUrl = null, workbookUrl = null) {
    let message = `
❌ <b>Processing Error</b>

🎬 <b>Video:</b> ${videoTitle}
🔧 <b>Stage:</b> ${stage}
⚠️ <b>Error:</b> ${errorMessage}

<i>Please check the logs for more details. The process has been paused.</i>`;
    
    // Add relevant links for error investigation
    const links = [];
    if (masterSheetUrl) {
      links.push(`📊 <a href="${masterSheetUrl}">Check Status in Master Sheet</a>`);
    }
    if (workbookUrl) {
      links.push(`📋 <a href="${workbookUrl}">View Video Details</a>`);
    }
    
    if (links.length > 0) {
      message += `\n\n${links.join('\n')}`;
    }

    return await this.sendMessage(message);
  }

  async sendProcessingSummary(stats) {
    const message = `
📊 <b>Daily Processing Summary</b>

📅 <b>Date:</b> ${new Date().toLocaleDateString()}
🎬 <b>Videos Processed:</b> ${stats.totalProcessed}
✅ <b>Successful:</b> ${stats.successful}
❌ <b>Failed:</b> ${stats.failed}
⏳ <b>Pending:</b> ${stats.pending}

⏱️ <b>Average Processing Time:</b> ${stats.avgProcessingTime} minutes
💰 <b>Estimated Costs:</b> $${stats.estimatedCosts.toFixed(2)}

<i>Automation is running smoothly! 🤖</i>`;

    return await this.sendMessage(message);
  }

  async sendKeywordResearchResults(videoTitle, keywords) {
    const primaryKeywords = keywords.primaryKeywords.slice(0, 5).join(', ');
    const hashtags = keywords.trendingHashtags.slice(0, 5).join(' ');

    const message = `
🔍 <b>Keyword Research Completed</b>

🎬 <b>Video:</b> ${videoTitle}

🎯 <b>Primary Keywords:</b>
<code>${primaryKeywords}</code>

📱 <b>Trending Hashtags:</b>
${hashtags}

✅ <b>Keywords applied to optimized content</b>`;

    return await this.sendMessage(message);
  }

  // MERGED METHOD: Replaces sendScriptGenerated + sendKeywordResearchResults + sendScriptApprovalRequest
  async sendScriptGeneratedWithApproval(videoTitle, workbookUrl = null, masterSheetUrl = null, keywords = null) {
    let message = `✍️ <b>Script Generated & Approval Required</b>

🎬 ${videoTitle}
✅ Script separated and ready for review`;

    // Add keyword information if available
    if (keywords) {
      const primaryKeywords = keywords.primaryKeywords?.slice(0, 3).join(', ') || '';
      const hashtags = keywords.trendingHashtags?.slice(0, 3).join(' ') || '';
      
      if (primaryKeywords || hashtags) {
        message += '\n\n🔍 <b>Keywords Applied:</b>';
        if (primaryKeywords) {
          message += `\n🎯 <code>${primaryKeywords}</code>`;
        }
        if (hashtags) {
          message += `\n📱 ${hashtags}`;
        }
      }
    }

    message += '\n\n⚠️ <b>Action Required:</b> Please review and approve script';

    // Add relevant links
    const links = [];
    if (workbookUrl) {
      links.push(`📋 <a href="${workbookUrl}">Review & Approve Script</a>`);
    }
    if (masterSheetUrl) {
      links.push(`📊 <a href="${masterSheetUrl}">Update Status in Master Sheet</a>`);
    }
    
    if (links.length > 0) {
      message += `\n\n${links.join('\n')}`;
    }
    
    return await this.sendMessage(message);
  }

  async sendDriveFilesCreated(videoTitle, driveFolder, subfolders, workbookUrl = null) {
    const folderList = Object.keys(subfolders).map(folder => `📁 ${folder}`).join('\n');

    let message = `
📁 <b>Drive Files Created</b>

🎬 <b>Video:</b> ${videoTitle}
🔗 <b>Main Folder:</b> <a href="${driveFolder}">View Folder</a>

📂 <b>Subfolders Created:</b>
${folderList}

✅ <b>Ready for file uploads</b>`;
    
    // Add workbook link for detailed tracking
    if (workbookUrl) {
      message += `\n\n📋 <a href="${workbookUrl}">Track Progress in Workbook</a>`;
    }

    return await this.sendMessage(message);
  }

  async sendApprovalTimeout(videoTitle, timeoutHours = 24, workbookUrl = null, masterSheetUrl = null) {
    let message = `
⏰ <b>Approval Timeout Warning</b>

🎬 <b>Video:</b> ${videoTitle}

The script has been waiting for approval for ${timeoutHours} hours. 

Please review and approve the script to continue processing, or the video will be marked as failed.

<i>Automation paused until approval received.</i>`;
    
    // Add relevant links for quick approval
    const links = [];
    if (workbookUrl) {
      links.push(`📋 <a href="${workbookUrl}">Review Script in Workbook</a>`);
    }
    if (masterSheetUrl) {
      links.push(`📊 <a href="${masterSheetUrl}">Update Approval in Master Sheet</a>`);
    }
    
    if (links.length > 0) {
      message += `\n\n${links.join('\n')}`;
    }

    return await this.sendMessage(message);
  }

  // New methods for manual status change notifications
  
  async sendVoiceGenerationStatusChanged(videoId, title, oldStatus, newStatus, masterSheetUrl = null, workbookUrl = null) {
    const formattedTitle = this.formatReliableTitle(title, videoId);
    let statusIcon = '🎙️';
    
    // Add status-specific icons and context
    switch (newStatus) {
    case 'In Progress':
      statusIcon = '⏳';
      break;
    case 'Completed':
      statusIcon = '✅';
      break;
    case 'Need Changes':
      statusIcon = '🔄';
      break;
    default:
      statusIcon = '🎙️';
    }
    
    let message = `${statusIcon} <b>Voice Generation Status Updated</b>

🎬 <b>${videoId} - ${formattedTitle}</b>
📊 <b>Status:</b> ${oldStatus || 'Not Set'} → ${newStatus}

👤 Manual update detected`;

    // Add contextual message based on status
    if (newStatus === 'Completed') {
      message += '\n\n🎉 Voice generation complete! Ready for video editing.';
    } else if (newStatus === 'In Progress') {
      message += '\n\n⚡ Voice generation in progress...';
    } else if (newStatus === 'Need Changes') {
      message += '\n\n🔄 Voice needs revision. Check workbook for details.';
    }

    // Add relevant links
    const links = [];
    if (workbookUrl) {
      links.push(`📋 <a href="${workbookUrl}">View Script Details</a>`);
    }
    if (masterSheetUrl) {
      links.push(`📊 <a href="${masterSheetUrl}">Update Other Statuses</a>`);
    }
    
    if (links.length > 0) {
      message += `\n\n${links.join('\n')}`;
    }

    return await this.sendMessage(message);
  }

  async sendVideoEditingStatusChanged(videoId, title, oldStatus, newStatus, masterSheetUrl = null, workbookUrl = null, driveFolderUrl = null) {
    const formattedTitle = this.formatReliableTitle(title, videoId);
    let statusIcon = '🎬';
    
    // Add status-specific icons and context
    switch (newStatus) {
    case 'In Progress':
      statusIcon = '⏳';
      break;
    case 'First Draft':
      statusIcon = '📝';
      break;
    case 'Completed':
      statusIcon = '✅';
      break;
    case 'Published':
      statusIcon = '🚀';
      break;
    default:
      statusIcon = '🎬';
    }
    
    let message = `${statusIcon} <b>Video Editing Status Updated</b>

🎬 <b>${videoId} - ${formattedTitle}</b>
📊 <b>Status:</b> ${oldStatus || 'Not Set'} → ${newStatus}

👤 Manual update detected`;

    // Add contextual message based on status
    if (newStatus === 'Published') {
      message += '\n\n🚀 Video published! Great work!';
    } else if (newStatus === 'Completed') {
      message += '\n\n🎉 Video editing complete! Ready for publication.';
    } else if (newStatus === 'First Draft') {
      message += '\n\n📝 First draft ready for review.';
    } else if (newStatus === 'In Progress') {
      message += '\n\n⚡ Video editing in progress...';
    }

    // Add relevant links
    const links = [];
    if (driveFolderUrl) {
      links.push(`📁 <a href="${driveFolderUrl}">View Assets in Drive</a>`);
    }
    if (workbookUrl) {
      links.push(`📋 <a href="${workbookUrl}">View Video Details</a>`);
    }
    if (masterSheetUrl) {
      links.push(`📊 <a href="${masterSheetUrl}">Update Other Statuses</a>`);
    }
    
    if (links.length > 0) {
      message += `\n\n${links.join('\n')}`;
    }

    return await this.sendMessage(message);
  }

  async sendScriptApprovedChanged(videoId, title, oldStatus, newStatus, masterSheetUrl = null, workbookUrl = null) {
    const formattedTitle = this.formatReliableTitle(title, videoId);
    let statusIcon = '📝';
    
    // Add status-specific icons and context
    switch (newStatus) {
    case 'Approved':
      statusIcon = '✅';
      break;
    case 'Needs Changes':
      statusIcon = '🔄';
      break;
    case 'Pending':
      statusIcon = '⏳';
      break;
    default:
      statusIcon = '📝';
    }
    
    let message = `${statusIcon} <b>Script Approval Updated</b>

🎬 <b>${videoId} - ${formattedTitle}</b>
📊 <b>Status:</b> ${oldStatus || 'Not Set'} → ${newStatus}

👤 Manual update detected`;

    // Add contextual message based on status
    if (newStatus === 'Approved') {
      message += '\n\n🎉 Script approved! Automation will continue processing.';
    } else if (newStatus === 'Needs Changes') {
      message += '\n\n🔄 Script needs revision. Processing paused.';
    } else if (newStatus === 'Pending') {
      message += '\n\n⏳ Script pending review.';
    }

    // Add relevant links
    const links = [];
    if (workbookUrl) {
      links.push(`📋 <a href="${workbookUrl}">Review Script Details</a>`);
    }
    if (masterSheetUrl) {
      links.push(`📊 <a href="${masterSheetUrl}">View Master Sheet</a>`);
    }
    
    if (links.length > 0) {
      message += `\n\n${links.join('\n')}`;
    }

    return await this.sendMessage(message);
  }

  /**
   * Send notification about script regeneration started
   */
  async sendScriptRegenerationStarted(videoId, title, masterSheetUrl = null, workbookUrl = null) {
    const formattedTitle = this.formatReliableTitle(title, videoId);
    
    let message = `🔄 <b>Script Regeneration Started</b>

🎬 <b>${videoId} - ${formattedTitle}</b>
📊 <b>Status:</b> Processing
👤 Triggered by "Needs Changes" request

🔄 <b>Action Taken:</b>
• Main Status reset to "Processing"
• Script Approved reset to "Pending"
• New script generation will begin automatically

⏳ <b>Next Steps:</b>
• System will regenerate script with AI
• New script will be populated in sheets
• Manual review will be requested when complete`;

    // Add relevant links
    const links = [];
    if (workbookUrl) {
      links.push(`📋 <a href="${workbookUrl}">View Script Details</a>`);
    }
    if (masterSheetUrl) {
      links.push(`📊 <a href="${masterSheetUrl}">Monitor Progress</a>`);
    }
    
    if (links.length > 0) {
      message += `\n\n${links.join('\n')}`;
    }

    return await this.sendMessage(message);
  }

  async sendStatusChangesSummary(changes) {
    let message = `📊 <b>Multiple Status Changes Detected</b>

🕒 <b>Time:</b> ${new Date().toLocaleString()}
📋 <b>Videos Updated:</b> ${changes.length}

`;

    // Add summary of changes
    changes.forEach(change => {
      const videoLine = `🎬 <b>${change.videoId}</b> - ${this.formatReliableTitle(change.title, change.videoId)}`;
      message += `${videoLine}\n`;
      
      Object.entries(change.changes).forEach(([field, changeInfo]) => {
        const fieldName = this.getFieldDisplayName(field);
        message += `   ${fieldName}: ${changeInfo.old || 'Not Set'} → ${changeInfo.new}\n`;
      });
      message += '\n';
    });

    message += '👤 <i>All changes detected from manual updates</i>';

    return await this.sendMessage(message);
  }

  getFieldDisplayName(field) {
    const fieldNames = {
      scriptApproved: '📝 Script Approval',
      voiceGenerationStatus: '🎙️ Voice Generation',
      videoEditingStatus: '🎬 Video Editing'
    };
    return fieldNames[field] || field;
  }

  formatVideoTitle(title, maxLength = 40) {
    if (!title || typeof title !== 'string') {
      return 'Unknown Title';
    }
    
    // Handle edge cases that indicate corrupted/missing titles
    const cleanTitle = title.trim();
    if (cleanTitle === '' || cleanTitle.toLowerCase() === 'not set' || cleanTitle.toLowerCase() === 'unknown') {
      return 'Processing Video';
    }
    
    return cleanTitle.length > maxLength ? 
      cleanTitle.substring(0, maxLength) + '...' : 
      cleanTitle;
  }

  /**
   * Enhanced title formatting that provides better fallbacks for corrupted data
   * This helps prevent "Unknown Title, Not Set" display issues
   */
  formatReliableTitle(title, videoId = null, maxLength = 40) {
    // First attempt: use provided title if valid
    if (title && typeof title === 'string') {
      const cleanTitle = title.trim();
      if (cleanTitle && 
          cleanTitle.toLowerCase() !== 'not set' && 
          cleanTitle.toLowerCase() !== 'unknown' &&
          cleanTitle.toLowerCase() !== 'processing...' &&
          cleanTitle !== '') {
        return cleanTitle.length > maxLength ? 
          cleanTitle.substring(0, maxLength) + '...' : 
          cleanTitle;
      }
    }
    
    // Fallback: use video ID if available
    if (videoId) {
      return `Video ${videoId}`;
    }
    
    // Ultimate fallback
    return 'Processing Video';
  }

  formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }

  formatFileSize(bytes) {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }

  // Helper methods for generating Google Sheets and Drive URLs
  generateMasterSheetUrl(masterSheetId) {
    return `https://docs.google.com/spreadsheets/d/${masterSheetId}`;
  }

  generateWorkbookUrl(workbookId) {
    return `https://docs.google.com/spreadsheets/d/${workbookId}`;
  }

  generateDriveFolderUrl(folderId) {
    return `https://drive.google.com/drive/folders/${folderId}`;
  }

  generateDriveFileUrl(fileId) {
    return `https://drive.google.com/file/d/${fileId}/view`;
  }

  // Extract IDs from URLs for reverse operations
  extractSpreadsheetId(url) {
    if (!url) return null;
    const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : null;
  }

  extractDriveId(url) {
    if (!url) return null;
    const match = url.match(/\/folders\/([a-zA-Z0-9-_]+)|\/d\/([a-zA-Z0-9-_]+)/);
    return match ? (match[1] || match[2]) : null;
  }

  /**
   * Enhanced network error detection
   */
  isNetworkError(error) {
    const networkCodes = [
      'ECONNRESET',
      'ECONNREFUSED', 
      'ETIMEDOUT',
      'ENOTFOUND',
      'ENETUNREACH',
      'EHOSTUNREACH',
      'EPIPE',
      'EAI_AGAIN',
      'EFATAL' // Additional Telegram-specific error
    ];
    
    // Check error code
    if (error.code && networkCodes.includes(error.code)) {
      return true;
    }
    
    // Check error message for network-related keywords
    const message = error.message?.toLowerCase() || '';
    return message.includes('timeout') ||
           message.includes('socket hang up') ||
           message.includes('network') ||
           message.includes('connection') ||
           message.includes('etimedout') ||
           message.includes('efatal');
  }
  
  /**
   * Check if error is specifically a timeout
   */
  isTimeoutError(error) {
    const timeoutCodes = ['ETIMEDOUT', 'EFATAL'];
    const message = error.message?.toLowerCase() || '';
    
    return (error.code && timeoutCodes.includes(error.code)) ||
           message.includes('timeout') ||
           message.includes('etimedout') ||
           message.includes('efatal');
  }
  
  /**
   * Check if error is retryable
   */
  isRetryableError(error) {
    if (this.isNetworkError(error)) return true;
    
    // HTTP status codes that are retryable
    const retryableHttpCodes = [429, 500, 502, 503, 504];
    const statusCode = error.response?.status;
    
    return retryableHttpCodes.includes(statusCode);
  }
  
  /**
   * Calculate adaptive retry delay based on error type
   */
  calculateRetryDelay(attempt, isTimeoutError = false) {
    const baseDelay = this.retryDelay;
    
    if (isTimeoutError || this.networkTimeoutCount > 0) {
      // Longer delays for timeout errors: 5s, 10s, 15s, 20s, 30s
      const timeoutDelay = Math.min(baseDelay * 5 * attempt, 30000);
      const jitter = Math.random() * 2000; // Up to 2s jitter
      return timeoutDelay + jitter;
    }
    
    // Standard exponential backoff: 1s, 2s, 4s, 8s...
    const exponentialDelay = baseDelay * Math.pow(2, attempt - 1);
    // Add jitter to prevent thundering herd
    const jitter = Math.random() * baseDelay;
    return Math.min(exponentialDelay + jitter, 30000); // Max 30 seconds
  }
  
  /**
   * Provide diagnostic suggestions based on error type
   */
  getDiagnosticSuggestion(error) {
    if (this.isTimeoutError(error)) {
      return 'Network timeout detected. Consider increasing TELEGRAM_REQUEST_TIMEOUT or checking firewall/proxy settings.';
    }
    
    if (error.code === 'ENOTFOUND') {
      return 'DNS resolution failed. Check internet connection and DNS settings.';
    }
    
    if (error.code === 'ECONNREFUSED') {
      return 'Connection refused. Check proxy settings or network restrictions.';
    }
    
    if (error.response?.status === 401) {
      return 'Unauthorized. Check TELEGRAM_BOT_TOKEN validity.';
    }
    
    if (error.response?.status === 403) {
      return 'Forbidden. Bot may be blocked or lacks permissions.';
    }
    
    if (error.response?.status === 429) {
      return 'Rate limited. Reduce message frequency.';
    }
    
    return 'Unknown error. Run diagnostic tool: node tools/diagnose-telegram-connectivity.js';
  }
  
  /**
   * Log failed messages to fallback system (file-based)
   */
  logToFallback(message, error, context = 'Unknown') {
    if (!this.fallbackEnabled) return;
    
    try {
      const fallbackEntry = {
        timestamp: new Date().toISOString(),
        context: context,
        message: message.substring(0, 200) + (message.length > 200 ? '...' : ''),
        error: {
          message: error.message,
          code: error.code,
          type: 'telegram_failure'
        },
        networkTimeoutCount: this.networkTimeoutCount,
        lastSuccess: this.lastSuccessfulMessage
      };
      
      logger.warn('📁 Logging failed Telegram message to fallback system', fallbackEntry);
      
      // TODO: Could implement file-based logging or alternative notification here
      // For now, we just log it extensively for debugging
      
    } catch (fallbackError) {
      logger.error('❌ Fallback logging also failed:', fallbackError.message);
    }
  }
  
  /**
   * Sleep utility
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Safe message sending - never throws, logs errors instead with enhanced fallback
   */
  async sendMessageSafe(message, options = {}) {
    try {
      return await this.sendMessage(message, options);
    } catch (error) {
      logger.warn('🔄 Failed to send Telegram message (non-critical - workflow continues):', {
        message: message.substring(0, 100) + '...',
        error: error.message,
        code: error.code,
        networkTimeouts: this.networkTimeoutCount,
        lastSuccess: this.lastSuccessfulMessage ? new Date(this.lastSuccessfulMessage).toISOString() : 'Never'
      });
      
      // Log to fallback system for manual review
      this.logToFallback(message, error);
      
      return null;
    }
  }
  
  /**
   * Send message with graceful degradation - workflow continues regardless
   */
  async sendNotificationSafe(message, options = {}, context = 'Unknown') {
    try {
      const result = await this.sendMessage(message, options);
      logger.info(`📱 Telegram notification sent successfully (${context})`);
      return result;
    } catch (error) {
      logger.warn(`⚠️ Telegram notification failed for ${context}, but workflow continues:`, {
        error: error.message,
        code: error.code,
        suggestion: this.getDiagnosticSuggestion(error)
      });
      
      // Store for potential batch retry later
      this.logToFallback(message, error, context);
      
      // Return success indicator so workflow doesn't fail
      return { graceful_degradation: true, context, timestamp: Date.now() };
    }
  }
  
  async healthCheck() {
    try {
      // Test Telegram bot by getting bot info with timeout
      const botInfo = await this.bot.getMe();
      
      if (botInfo && botInfo.username) {
        logger.info(`Bot: @${botInfo.username} (timeout: ${config.telegram.requestTimeout}ms)`);
        return true;
      } else {
        throw new Error('Invalid response from Telegram API');
      }
    } catch (error) {
      logger.error('Telegram service health check failed:', {
        error: error.message,
        code: error.code,
        isNetworkError: this.isNetworkError(error),
        timeout: config.telegram.requestTimeout
      });
      throw error;
    }
  }
}

export default TelegramService;