import TelegramBot from 'node-telegram-bot-api';
import { config } from '../../config/config.js';
import logger from '../utils/logger.js';

class TelegramService {
  constructor() {
    this.bot = new TelegramBot(config.telegram.botToken, { polling: false });
    this.chatId = config.telegram.chatId;
  }

  async sendMessage(message, options = {}) {
    try {
      const response = await this.bot.sendMessage(this.chatId, message, {
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        ...options
      });
      
      logger.info('Telegram sent');
      return response;
    } catch (error) {
      logger.error('Error sending Telegram message:', error);
      throw error;
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
🎉 <b>Video Processing Completed!</b>

🎬 <b>Title:</b> ${title}
📹 <b>Original:</b> ${videoData.originalUrl}

📊 <b>Generated Content:</b>
✅ Optimized script
✅ SEO description  
✅ Keyword research
✅ Generated images
✅ Custom thumbnail`;

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

  formatVideoTitle(title, maxLength = 40) {
    return title.length > maxLength ? 
      title.substring(0, maxLength) + '...' : 
      title;
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

  async healthCheck() {
    try {
      // Test Telegram bot by getting bot info
      const botInfo = await this.bot.getMe();
      
      if (botInfo && botInfo.username) {
        logger.info(`Bot: @${botInfo.username}`);
        return true;
      } else {
        throw new Error('Invalid response from Telegram API');
      }
    } catch (error) {
      logger.error('Telegram service health check failed:', error);
      throw error;
    }
  }
}

export default TelegramService;