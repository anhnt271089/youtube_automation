import fs from 'fs/promises';
import path from 'path';
import { config } from '../../config/config.js';
import logger from '../utils/logger.js';
import GoogleDriveService from './googleDriveService.js';

class InteractiveContentService {
  constructor() {
    this.googleDriveService = new GoogleDriveService();
    
    // Queue file paths
    this.queueDir = path.join(process.cwd(), 'queue');
    this.pendingQueueFile = path.join(this.queueDir, 'pending-generations.json');
    this.completedQueueFile = path.join(this.queueDir, 'completed-generations.json');
    
    // Content storage paths
    this.contentDir = path.join(process.cwd(), 'content');
    this.generatedContentDir = path.join(this.contentDir, 'generated');
    this.scriptsDir = path.join(this.contentDir, 'scripts');
    this.thumbnailsDir = path.join(this.contentDir, 'thumbnails');
    this.descriptionsDir = path.join(this.contentDir, 'descriptions');
    
    // Templates directory
    this.templatesDir = path.join(process.cwd(), 'templates');
    
    // Initialize directories
    this.initializeDirectories();
  }

  /**
   * Initialize required directories
   */
  async initializeDirectories() {
    try {
      const dirs = [
        this.queueDir,
        this.contentDir,
        this.generatedContentDir,
        this.scriptsDir,
        this.thumbnailsDir,
        this.descriptionsDir,
        this.templatesDir
      ];

      for (const dir of dirs) {
        try {
          await fs.access(dir);
        } catch {
          await fs.mkdir(dir, { recursive: true });
          logger.info(`Created directory: ${dir}`);
        }
      }

      // Initialize queue files if they don't exist
      await this.initializeQueueFiles();
    } catch (error) {
      logger.error('Failed to initialize directories:', error);
      throw error;
    }
  }

  /**
   * Initialize queue files with empty arrays
   */
  async initializeQueueFiles() {
    const queueFiles = [this.pendingQueueFile, this.completedQueueFile];
    
    for (const file of queueFiles) {
      try {
        await fs.access(file);
      } catch {
        await fs.writeFile(file, JSON.stringify([], null, 2));
        logger.info(`Created queue file: ${file}`);
      }
    }
  }

  /**
   * Check if interactive generation is enabled for a content type
   */
  isInteractiveMode(contentType) {
    if (!config.app.useInteractiveGeneration) return false;
    
    const enabledTypes = config.app.interactiveContentTypes || [];
    return enabledTypes.includes(contentType) || enabledTypes.includes('all');
  }

  /**
   * Add content generation request to queue
   */
  async addToQueue(videoId, contentType, data, priority = 'normal') {
    try {
      const queueItem = {
        id: `${videoId}_${contentType}_${Date.now()}`,
        videoId,
        contentType,
        data,
        priority,
        status: 'pending',
        createdAt: new Date().toISOString(),
        attempts: 0,
        maxAttempts: 3
      };

      const pendingQueue = await this.loadPendingQueue();
      pendingQueue.push(queueItem);
      
      // Sort by priority (high -> normal -> low)
      pendingQueue.sort((a, b) => {
        const priorityOrder = { high: 3, normal: 2, low: 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      });

      await fs.writeFile(this.pendingQueueFile, JSON.stringify(pendingQueue, null, 2));
      
      logger.info(`Added ${contentType} generation for ${videoId} to queue with priority: ${priority}`);
      
      // Update status in Google Sheets
      await this.updateVideoStatus(videoId, `Awaiting Manual ${contentType} Generation`);
      
      return queueItem.id;
    } catch (error) {
      logger.error(`Failed to add ${contentType} to queue:`, error);
      throw error;
    }
  }

  /**
   * Load pending queue
   */
  async loadPendingQueue() {
    try {
      const content = await fs.readFile(this.pendingQueueFile, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      logger.warn('Failed to load pending queue, returning empty array');
      return [];
    }
  }

  /**
   * Load completed queue
   */
  async loadCompletedQueue() {
    try {
      const content = await fs.readFile(this.completedQueueFile, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      logger.warn('Failed to load completed queue, returning empty array');
      return [];
    }
  }

  /**
   * Get queue status
   */
  async getQueueStatus() {
    try {
      const pendingQueue = await this.loadPendingQueue();
      const completedQueue = await this.loadCompletedQueue();
      
      return {
        pending: pendingQueue.length,
        completed: completedQueue.length,
        byType: {
          script: pendingQueue.filter(item => item.contentType === 'script').length,
          thumbnails: pendingQueue.filter(item => item.contentType === 'thumbnails').length,
          description: pendingQueue.filter(item => item.contentType === 'description').length,
          title: pendingQueue.filter(item => item.contentType === 'title').length
        },
        byPriority: {
          high: pendingQueue.filter(item => item.priority === 'high').length,
          normal: pendingQueue.filter(item => item.priority === 'normal').length,
          low: pendingQueue.filter(item => item.priority === 'low').length
        }
      };
    } catch (error) {
      logger.error('Failed to get queue status:', error);
      throw error;
    }
  }

  /**
   * Get next item from queue
   */
  async getNextQueueItem() {
    try {
      const pendingQueue = await this.loadPendingQueue();
      if (pendingQueue.length === 0) return null;
      
      return pendingQueue[0]; // Already sorted by priority
    } catch (error) {
      logger.error('Failed to get next queue item:', error);
      throw error;
    }
  }

  /**
   * Mark queue item as completed
   */
  async completeQueueItem(itemId, generatedContent = null) {
    try {
      const pendingQueue = await this.loadPendingQueue();
      const completedQueue = await this.loadCompletedQueue();
      
      const itemIndex = pendingQueue.findIndex(item => item.id === itemId);
      if (itemIndex === -1) {
        throw new Error(`Queue item ${itemId} not found`);
      }
      
      const item = pendingQueue[itemIndex];
      item.status = 'completed';
      item.completedAt = new Date().toISOString();
      item.generatedContent = generatedContent;
      
      // Move to completed queue
      completedQueue.push(item);
      pendingQueue.splice(itemIndex, 1);
      
      await fs.writeFile(this.pendingQueueFile, JSON.stringify(pendingQueue, null, 2));
      await fs.writeFile(this.completedQueueFile, JSON.stringify(completedQueue, null, 2));
      
      logger.info(`Completed queue item: ${itemId}`);
      
      return item;
    } catch (error) {
      logger.error(`Failed to complete queue item ${itemId}:`, error);
      throw error;
    }
  }

  /**
   * Remove item from queue (failed/cancelled)
   */
  async removeQueueItem(itemId, reason = 'failed') {
    try {
      const pendingQueue = await this.loadPendingQueue();
      const itemIndex = pendingQueue.findIndex(item => item.id === itemId);
      
      if (itemIndex === -1) {
        throw new Error(`Queue item ${itemId} not found`);
      }
      
      const item = pendingQueue[itemIndex];
      item.status = reason;
      item.removedAt = new Date().toISOString();
      
      // Move to completed queue for tracking
      const completedQueue = await this.loadCompletedQueue();
      completedQueue.push(item);
      pendingQueue.splice(itemIndex, 1);
      
      await fs.writeFile(this.pendingQueueFile, JSON.stringify(pendingQueue, null, 2));
      await fs.writeFile(this.completedQueueFile, JSON.stringify(completedQueue, null, 2));
      
      logger.info(`Removed queue item: ${itemId} (reason: ${reason})`);
      
      return item;
    } catch (error) {
      logger.error(`Failed to remove queue item ${itemId}:`, error);
      throw error;
    }
  }

  /**
   * Check if content exists for a video
   */
  async checkGeneratedContent(videoId, contentType) {
    try {
      let filePath;
      
      switch (contentType) {
        case 'script':
          filePath = path.join(this.scriptsDir, `${videoId}_script.json`);
          break;
        case 'thumbnails':
          filePath = path.join(this.thumbnailsDir, `${videoId}_thumbnails.json`);
          break;
        case 'description':
          filePath = path.join(this.descriptionsDir, `${videoId}_description.json`);
          break;
        case 'title':
          filePath = path.join(this.descriptionsDir, `${videoId}_title.json`);
          break;
        default:
          return null;
      }
      
      try {
        await fs.access(filePath);
        const content = await fs.readFile(filePath, 'utf8');
        return JSON.parse(content);
      } catch {
        return null;
      }
    } catch (error) {
      logger.error(`Failed to check generated content for ${videoId}:`, error);
      return null;
    }
  }

  /**
   * Save generated content to file
   */
  async saveGeneratedContent(videoId, contentType, content) {
    try {
      let filePath;
      
      switch (contentType) {
        case 'script':
          filePath = path.join(this.scriptsDir, `${videoId}_script.json`);
          break;
        case 'thumbnails':
          filePath = path.join(this.thumbnailsDir, `${videoId}_thumbnails.json`);
          break;
        case 'description':
          filePath = path.join(this.descriptionsDir, `${videoId}_description.json`);
          break;
        case 'title':
          filePath = path.join(this.descriptionsDir, `${videoId}_title.json`);
          break;
        default:
          throw new Error(`Unknown content type: ${contentType}`);
      }
      
      const data = {
        videoId,
        contentType,
        content,
        generatedAt: new Date().toISOString(),
        method: 'interactive'
      };
      
      await fs.writeFile(filePath, JSON.stringify(data, null, 2));
      logger.info(`Saved ${contentType} content for ${videoId} to: ${filePath}`);
      
      return filePath;
    } catch (error) {
      logger.error(`Failed to save ${contentType} content for ${videoId}:`, error);
      throw error;
    }
  }

  /**
   * Load content template
   */
  async loadTemplate(templateName) {
    try {
      const templatePath = path.join(this.templatesDir, `${templateName}.json`);
      const content = await fs.readFile(templatePath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      logger.error(`Failed to load template ${templateName}:`, error);
      throw error;
    }
  }

  /**
   * Format prompt from template
   */
  async formatPrompt(templateName, variables) {
    try {
      const template = await this.loadTemplate(templateName);
      let prompt = template.prompt;
      
      // Replace variables in prompt
      for (const [key, value] of Object.entries(variables)) {
        const regex = new RegExp(`{{${key}}}`, 'g');
        prompt = prompt.replace(regex, value);
      }
      
      return {
        prompt,
        instructions: template.instructions || [],
        expectedFormat: template.expectedFormat || {},
        examples: template.examples || []
      };
    } catch (error) {
      logger.error(`Failed to format prompt from template ${templateName}:`, error);
      throw error;
    }
  }

  /**
   * Update video status in Google Sheets
   */
  async updateVideoStatus(videoId, status) {
    try {
      // Dynamically import to avoid circular dependency
      const { default: GoogleSheetsService } = await import('./googleSheetsService.js');
      const googleSheetsService = new GoogleSheetsService();
      await googleSheetsService.updateVideoStatus(videoId, status);
    } catch (error) {
      logger.warn(`Failed to update status for ${videoId}:`, error);
    }
  }

  /**
   * Process content and upload to Google Drive if needed
   */
  async processAndUploadContent(videoId, contentType, content) {
    try {
      // Save locally first
      const filePath = await this.saveGeneratedContent(videoId, contentType, content);
      
      // For thumbnails, upload images to Google Drive
      if (contentType === 'thumbnails' && content.thumbnails) {
        const uploadedThumbnails = [];
        
        for (const thumbnail of content.thumbnails) {
          if (thumbnail.imageData || thumbnail.imagePath) {
            try {
              // Upload to Google Drive
              const driveFile = await this.googleDriveService.uploadThumbnail(
                videoId,
                thumbnail.imageData || thumbnail.imagePath,
                thumbnail.title || 'Thumbnail'
              );
              
              uploadedThumbnails.push({
                ...thumbnail,
                driveFileId: driveFile.id,
                driveUrl: driveFile.webViewLink,
                uploadedAt: new Date().toISOString()
              });
            } catch (uploadError) {
              logger.error(`Failed to upload thumbnail for ${videoId}:`, uploadError);
              uploadedThumbnails.push({
                ...thumbnail,
                error: uploadError.message
              });
            }
          }
        }
        
        // Update content with Drive URLs
        content.thumbnails = uploadedThumbnails;
        await this.saveGeneratedContent(videoId, contentType, content);
      }
      
      logger.info(`Processed and saved ${contentType} content for ${videoId}`);
      return content;
    } catch (error) {
      logger.error(`Failed to process content for ${videoId}:`, error);
      throw error;
    }
  }

  /**
   * Get content generation statistics
   */
  async getGenerationStats() {
    try {
      const completedQueue = await this.loadCompletedQueue();
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const thisWeek = new Date(today.getTime() - (7 * 24 * 60 * 60 * 1000));
      
      const todayCompletions = completedQueue.filter(item => 
        item.completedAt && new Date(item.completedAt) >= today
      );
      
      const weekCompletions = completedQueue.filter(item => 
        item.completedAt && new Date(item.completedAt) >= thisWeek
      );
      
      return {
        total: completedQueue.length,
        today: todayCompletions.length,
        thisWeek: weekCompletions.length,
        byType: {
          script: completedQueue.filter(item => item.contentType === 'script').length,
          thumbnails: completedQueue.filter(item => item.contentType === 'thumbnails').length,
          description: completedQueue.filter(item => item.contentType === 'description').length,
          title: completedQueue.filter(item => item.contentType === 'title').length
        },
        avgTimeToComplete: this.calculateAverageCompletionTime(completedQueue),
        successRate: this.calculateSuccessRate(completedQueue)
      };
    } catch (error) {
      logger.error('Failed to get generation stats:', error);
      throw error;
    }
  }

  /**
   * Calculate average completion time
   */
  calculateAverageCompletionTime(completedItems) {
    const completedWithTimes = completedItems.filter(item => 
      item.createdAt && item.completedAt && item.status === 'completed'
    );
    
    if (completedWithTimes.length === 0) return 0;
    
    const totalTime = completedWithTimes.reduce((sum, item) => {
      const created = new Date(item.createdAt);
      const completed = new Date(item.completedAt);
      return sum + (completed - created);
    }, 0);
    
    return Math.round(totalTime / completedWithTimes.length / 1000 / 60); // minutes
  }

  /**
   * Calculate success rate
   */
  calculateSuccessRate(completedItems) {
    if (completedItems.length === 0) return 100;
    
    const successful = completedItems.filter(item => item.status === 'completed').length;
    return Math.round((successful / completedItems.length) * 100);
  }

  /**
   * Clean up old queue items
   */
  async cleanupOldQueueItems(maxAgeHours = 168) { // 7 days default
    try {
      const cutoffTime = new Date(Date.now() - (maxAgeHours * 60 * 60 * 1000));
      const completedQueue = await this.loadCompletedQueue();
      
      const recentItems = completedQueue.filter(item => {
        const itemTime = new Date(item.completedAt || item.createdAt);
        return itemTime > cutoffTime;
      });
      
      const removedCount = completedQueue.length - recentItems.length;
      
      if (removedCount > 0) {
        await fs.writeFile(this.completedQueueFile, JSON.stringify(recentItems, null, 2));
        logger.info(`Cleaned up ${removedCount} old queue items`);
      }
      
      return removedCount;
    } catch (error) {
      logger.error('Failed to cleanup old queue items:', error);
      throw error;
    }
  }
}

export default InteractiveContentService;