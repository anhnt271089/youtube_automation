import { Client } from '@notionhq/client';
import { config } from '../../config/config.js';
import logger from '../utils/logger.js';

class NotionService {
  constructor() {
    this.notion = new Client({
      auth: config.notion.token,
    });
    this.databaseId = config.notion.databaseId;
  }

  async createVideoEntry(videoData) {
    try {
      // Generate next sequential VideoID
      const nextVideoId = await this.getNextVideoId();
      
      const properties = {
        'Title': {
          title: [
            {
              text: {
                content: videoData.title || 'Untitled Video'
              }
            }
          ]
        },
        'YouTube URL': {
          url: videoData.originalUrl
        },
        'VideoID': {
          rich_text: [
            {
              text: {
                content: nextVideoId
              }
            }
          ]
        },
        'Status': {
          select: {
            name: 'New'
          }
        },
        'Channel': {
          rich_text: [
            {
              text: {
                content: videoData.channelTitle || ''
              }
            }
          ]
        },
        'Duration': {
          rich_text: [
            {
              text: {
                content: videoData.duration || ''
              }
            }
          ]
        },
        'View Count': {
          number: parseInt(videoData.viewCount) || 0
        },
        'Published Date': {
          date: {
            start: videoData.publishedAt
          }
        },
        'YouTube Video ID': {
          rich_text: [
            {
              text: {
                content: videoData.videoId || ''
              }
            }
          ]
        }
      };

      const response = await this.notion.pages.create({
        parent: { database_id: this.databaseId },
        properties
      });

      logger.info(`Created Notion entry for video: ${videoData.title}`);
      return response;
    } catch (error) {
      logger.error('Error creating Notion entry:', error);
      throw error;
    }
  }

  async updateVideoStatus(pageId, status, additionalData = {}) {
    try {
      const properties = {
        'Status': {
          select: {
            name: status
          }
        }
      };

      if (additionalData.optimizedTitle) {
        properties['Optimized Title'] = {
          rich_text: [
            {
              text: {
                content: additionalData.optimizedTitle
              }
            }
          ]
        };
      }

      if (additionalData.optimizedDescription) {
        properties['Optimized Description'] = {
          rich_text: [
            {
              text: {
                content: additionalData.optimizedDescription.substring(0, 2000)
              }
            }
          ]
        };
      }

      if (additionalData.keywords) {
        properties['Keywords'] = {
          multi_select: additionalData.keywords.slice(0, 10).map(keyword => ({ name: keyword }))
        };
      }

      if (additionalData.scriptApproved !== undefined) {
        properties['Script Approved'] = {
          checkbox: additionalData.scriptApproved
        };
      }

      if (additionalData.driveFolder) {
        properties['Drive Folder'] = {
          url: additionalData.driveFolder
        };
      }

      const response = await this.notion.pages.update({
        page_id: pageId,
        properties
      });

      logger.info(`Updated Notion entry status to: ${status}`);
      return response;
    } catch (error) {
      logger.error('Error updating Notion entry:', error);
      throw error;
    }
  }

  async getPendingVideos() {
    try {
      const response = await this.notion.databases.query({
        database_id: this.databaseId,
        filter: {
          property: 'Status',
          select: {
            equals: 'Pending'
          }
        },
        sorts: [
          {
            property: 'Created Time',
            direction: 'ascending'
          }
        ]
      });

      return response.results.map(page => ({
        id: page.id,
        videoId: page.properties.VideoID?.rich_text[0]?.text?.content || page.id,
        internalVideoId: page.id, // Use Notion page ID as internal VideoID
        title: page.properties.Title?.title[0]?.text?.content || '',
        youtubeUrl: page.properties['YouTube URL']?.url || '',
        youtubeVideoId: page.properties['YouTube Video ID']?.rich_text[0]?.text?.content || '',
        status: page.properties.Status?.select?.name || '',
        createdTime: page.created_time
      }));
    } catch (error) {
      logger.error('Error fetching pending videos:', error);
      throw error;
    }
  }

  async getVideosByStatus(status) {
    try {
      const response = await this.notion.databases.query({
        database_id: this.databaseId,
        filter: {
          property: 'Status',
          select: {
            equals: status
          }
        }
      });

      return response.results.map(page => ({
        id: page.id,
        videoId: page.properties.VideoID?.rich_text[0]?.text?.content || page.id,
        internalVideoId: page.id, // Use Notion page ID as internal VideoID
        title: page.properties.Title?.title[0]?.text?.content || '',
        youtubeUrl: page.properties['YouTube URL']?.url || '',
        youtubeVideoId: page.properties['YouTube Video ID']?.rich_text[0]?.text?.content || '',
        status: page.properties.Status?.select?.name || '',
        scriptApproved: page.properties['Script Approved']?.checkbox || false,
        driveFolder: page.properties['Drive Folder']?.url || '',
        optimizedTitle: page.properties['Optimized Title']?.rich_text[0]?.text?.content || '',
        createdTime: page.created_time
      }));
    } catch (error) {
      logger.error('Error fetching videos by status:', error);
      throw error;
    }
  }

  async getNextVideoId() {
    try {
      // Query all existing VideoIDs to find the highest number
      const response = await this.notion.databases.query({
        database_id: this.databaseId,
        filter: {
          property: 'VideoID',
          rich_text: {
            is_not_empty: true
          }
        }
      });

      let maxId = 0;
      
      // Parse existing VideoIDs to find the highest number
      response.results.forEach(page => {
        const videoId = page.properties.VideoID?.rich_text[0]?.text?.content || '';
        if (videoId.startsWith('VID_')) {
          const numberPart = parseInt(videoId.substring(4));
          if (!isNaN(numberPart) && numberPart > maxId) {
            maxId = numberPart;
          }
        }
      });

      // Generate next sequential ID
      const nextId = maxId + 1;
      const formattedId = `VID_${nextId.toString().padStart(4, '0')}`;
      
      logger.info(`Generated next VideoID: ${formattedId}`);
      return formattedId;
    } catch (error) {
      logger.error('Error generating next VideoID:', error);
      // Fallback to timestamp-based ID if something goes wrong
      const timestamp = Date.now().toString().slice(-4);
      return `VID_${timestamp}`;
    }
  }

  async addVideoUrl(url) {
    try {
      // Generate next sequential VideoID
      const nextVideoId = await this.getNextVideoId();
      
      // Create initial entry with just the URL
      const properties = {
        'Title': {
          title: [
            {
              text: {
                content: 'Processing...'
              }
            }
          ]
        },
        'YouTube URL': {
          url: url
        },
        'VideoID': {
          rich_text: [
            {
              text: {
                content: nextVideoId
              }
            }
          ]
        },
        'Status': {
          select: {
            name: 'New'
          }
        }
      };

      const response = await this.notion.pages.create({
        parent: { database_id: this.databaseId },
        properties
      });

      logger.info(`Added new YouTube URL to Notion: ${url} with VideoID: ${nextVideoId}`);
      return response;
    } catch (error) {
      logger.error('Error adding video URL to Notion:', error);
      throw error;
    }
  }

  async approveScript(pageId) {
    try {
      await this.updateVideoStatus(pageId, 'Approved', {
        scriptApproved: true
      });
      
      logger.info(`Script approved for page: ${pageId}`);
      return true;
    } catch (error) {
      logger.error('Error approving script:', error);
      throw error;
    }
  }

  async autoPopulateVideoData(pageId, youtubeData) {
    try {
      const properties = {
        'Title': {
          title: [
            {
              text: {
                content: youtubeData.title || 'Untitled Video'
              }
            }
          ]
        },
        'Channel': {
          rich_text: [
            {
              text: {
                content: youtubeData.channelTitle || ''
              }
            }
          ]
        },
        'Duration': {
          rich_text: [
            {
              text: {
                content: youtubeData.duration || ''
              }
            }
          ]
        },
        'View Count': {
          number: parseInt(youtubeData.viewCount) || 0
        },
        'Published Date': {
          date: {
            start: youtubeData.publishedAt || new Date().toISOString().split('T')[0]
          }
        },
        'YouTube Video ID': {
          rich_text: [
            {
              text: {
                content: youtubeData.videoId || ''
              }
            }
          ]
        },
        'Status': {
          select: {
            name: 'Processing'
          }
        }
      };

      const response = await this.notion.pages.update({
        page_id: pageId,
        properties
      });

      logger.info(`Auto-populated video data for: ${youtubeData.title}`);
      return response;
    } catch (error) {
      logger.error('Error auto-populating video data:', error);
      throw error;
    }
  }

  async healthCheck() {
    try {
      // Test Notion API by getting database info
      const response = await this.notion.databases.retrieve({
        database_id: this.databaseId
      });
      
      if (response && response.id) {
        logger.info('Notion service health check passed');
        return true;
      } else {
        throw new Error('Invalid response from Notion API');
      }
    } catch (error) {
      logger.error('Notion service health check failed:', error);
      throw error;
    }
  }
}

export default NotionService;