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
      
      logger.info('Telegram message sent successfully');
      return response;
    } catch (error) {
      logger.error('Error sending Telegram message:', error);
      throw error;
    }
  }

  async sendVideoProcessingStarted(videoData) {
    const message = `
🎬 <b>Video Processing Started</b>

📹 <b>Title:</b> ${videoData.title}
🔗 <b>URL:</b> ${videoData.originalUrl}
📺 <b>Channel:</b> ${videoData.channelTitle}
👀 <b>Views:</b> ${parseInt(videoData.viewCount).toLocaleString()}
⏱️ <b>Duration:</b> ${videoData.duration}

<i>Starting automation workflow...</i>`;

    return await this.sendMessage(message);
  }

  async sendScriptGenerated(videoTitle, scriptPreview) {
    const preview = scriptPreview.length > 200 ? 
      scriptPreview.substring(0, 200) + '...' : 
      scriptPreview;

    const message = `
✍️ <b>Script Generated</b>

🎬 <b>Video:</b> ${videoTitle}

📝 <b>Script Preview:</b>
<i>${preview}</i>

✅ <b>Status:</b> Awaiting approval for script breakdown`;

    return await this.sendMessage(message);
  }

  async sendScriptApprovalRequest(videoTitle, notionPageUrl) {
    const message = `
⚠️ <b>Script Approval Required</b>

🎬 <b>Video:</b> ${videoTitle}

📋 Please review the generated script and approve it in Notion to continue with the automation process.

🔗 <a href="${notionPageUrl}">View in Notion</a>

<i>The process will continue automatically once approved.</i>`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: '✅ Approve Script', callback_data: 'approve_script' },
          { text: '❌ Reject Script', callback_data: 'reject_script' }
        ]
      ]
    };

    return await this.sendMessage(message, { reply_markup: keyboard });
  }

  async sendImageGenerationUpdate(videoTitle, completedImages, totalImages) {
    const message = `
🖼️ <b>Image Generation Progress</b>

🎬 <b>Video:</b> ${videoTitle}
📊 <b>Progress:</b> ${completedImages}/${totalImages} images generated

${completedImages === totalImages ? '✅ All images generated successfully!' : '⏳ Generating remaining images...'}`;

    return await this.sendMessage(message);
  }

  async sendThumbnailGenerated(videoTitle, thumbnailUrl) {
    const message = `
🖼️ <b>Thumbnail Generated</b>

🎬 <b>Video:</b> ${videoTitle}
🎨 <b>Thumbnail:</b> <a href="${thumbnailUrl}">View Generated Thumbnail</a>

✅ <b>Status:</b> Ready for final video assembly`;

    return await this.sendMessage(message);
  }

  async sendVideoCompleted(videoData, driveFolder, finalVideoUrl) {
    const message = `
🎉 <b>Video Processing Completed!</b>

🎬 <b>Title:</b> ${videoData.optimizedTitle || videoData.title}
📹 <b>Original:</b> ${videoData.originalUrl}
📁 <b>Drive Folder:</b> <a href="${driveFolder}">View Files</a>
🎥 <b>Final Video:</b> <a href="${finalVideoUrl}">Download</a>

📊 <b>Generated Content:</b>
✅ Optimized script
✅ SEO description  
✅ Keyword research
✅ Generated images
✅ Custom thumbnail
✅ 2-3 minute video

<b>Ready for upload!</b> 🚀`;

    return await this.sendMessage(message);
  }

  async sendError(videoTitle, errorMessage, stage) {
    const message = `
❌ <b>Processing Error</b>

🎬 <b>Video:</b> ${videoTitle}
🔧 <b>Stage:</b> ${stage}
⚠️ <b>Error:</b> ${errorMessage}

<i>Please check the logs for more details. The process has been paused.</i>`;

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

  async sendDriveFilesCreated(videoTitle, driveFolder, subfolders) {
    const folderList = Object.keys(subfolders).map(folder => `📁 ${folder}`).join('\n');

    const message = `
📁 <b>Drive Files Created</b>

🎬 <b>Video:</b> ${videoTitle}
🔗 <b>Main Folder:</b> <a href="${driveFolder}">View Folder</a>

📂 <b>Subfolders Created:</b>
${folderList}

✅ <b>Ready for file uploads</b>`;

    return await this.sendMessage(message);
  }

  async sendApprovalTimeout(videoTitle, timeoutHours = 24) {
    const message = `
⏰ <b>Approval Timeout Warning</b>

🎬 <b>Video:</b> ${videoTitle}

The script has been waiting for approval for ${timeoutHours} hours. 

Please review and approve the script to continue processing, or the video will be marked as failed.

<i>Automation paused until approval received.</i>`;

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

  async healthCheck() {
    try {
      // Test Telegram bot by getting bot info
      const botInfo = await this.bot.getMe();
      
      if (botInfo && botInfo.username) {
        logger.info(`Telegram service health check passed - Bot: @${botInfo.username}`);
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