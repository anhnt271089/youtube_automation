import { Client } from '@notionhq/client';
import { config } from '../../config/config.js';
import logger from '../utils/logger.js';

class NotionService {
  constructor() {
    this.notion = new Client({
      auth: config.notion.token,
    });
    this.databaseId = config.notion.databaseId;
    // Note: No longer using a shared details database - each video gets its own
    
    // Define protected properties that cannot be edited by users
    this.protectedMainDbProperties = new Set([
      '🔒 VideoID',
      '🔒 Title', 
      '🔒 Status',
      '🔒 Channel',
      '🔒 Duration',
      '🔒 View Count',
      '🔒 Published Date',
      '🔒 YouTube Video ID',
      '🔒 Optimized Title',
      '🔒 Optimized Description',
      '🔒 Keywords',
      '🔒 Total Sentences',
      '🔒 Completed Sentences',
      '🔒 Thumbnail',
      '🔒 New Thumbnail Prompt',
      '🔒 Sentence Status',
      '🔒 Drive Folder',
      '🔒 Created Time',
      '🔒 Last Edited Time'
    ]);
    
    // Protected properties in video detail databases
    this.protectedDetailDbProperties = new Set([
      '🔒 Sentence Number',
      '🔒 Script Text', 
      '🔒 Image Prompt',
      '🔒 Generated Image URL',
      '🔒 Status',
      '🔒 Word Count',
      '🔒 Created Time',
      '🔒 Last Edited Time'
    ]);
    
    // Allowed user-editable properties
    this.allowedMainDbProperties = new Set([
      'YouTube URL',
      'Script Approved'
    ]);
    
    // Allowed properties in detail databases
    this.allowedDetailDbProperties = new Set([
      'Sentence' // Only the title field in detail databases
    ]);
  }

  // === PROPERTY VALIDATION AND PROTECTION ===

  /**
   * Validates that only allowed properties are being updated in main database
   * @param {Object} properties - Properties object from Notion API call
   * @param {boolean} isSystemUpdate - True if this is a system/automation update
   * @returns {Object} - Filtered properties object containing only allowed properties
   */
  validateMainDatabaseUpdate(properties, isSystemUpdate = true) {
    if (!properties || typeof properties !== 'object') {
      return properties;
    }

    const filteredProperties = {};
    const rejectedProperties = [];

    for (const [propertyName, value] of Object.entries(properties)) {
      if (isSystemUpdate) {
        // System updates can modify any property
        filteredProperties[propertyName] = value;
      } else {
        // User updates can only modify allowed properties
        if (this.allowedMainDbProperties.has(propertyName)) {
          filteredProperties[propertyName] = value;
          logger.info(`User update allowed for property: ${propertyName}`);
        } else if (this.protectedMainDbProperties.has(propertyName)) {
          rejectedProperties.push(propertyName);
          logger.warn(`User attempted to modify protected property: ${propertyName} - BLOCKED`);
        } else {
          // Unknown property - allow it (might be a new field)
          filteredProperties[propertyName] = value;
          logger.info(`Unknown property allowed: ${propertyName}`);
        }
      }
    }

    if (rejectedProperties.length > 0) {
      logger.warn(`Blocked ${rejectedProperties.length} protected property updates: ${rejectedProperties.join(', ')}`);
    }

    return filteredProperties;
  }

  /**
   * Validates that only allowed properties are being updated in video detail databases
   * @param {Object} properties - Properties object from Notion API call
   * @param {boolean} isSystemUpdate - True if this is a system/automation update
   * @returns {Object} - Filtered properties object containing only allowed properties
   */
  validateDetailDatabaseUpdate(properties, isSystemUpdate = true) {
    if (!properties || typeof properties !== 'object') {
      return properties;
    }

    const filteredProperties = {};
    const rejectedProperties = [];

    for (const [propertyName, value] of Object.entries(properties)) {
      if (isSystemUpdate) {
        // System updates can modify any property
        filteredProperties[propertyName] = value;
      } else {
        // User updates can only modify allowed properties
        if (this.allowedDetailDbProperties.has(propertyName)) {
          filteredProperties[propertyName] = value;
          logger.info(`User update allowed for detail property: ${propertyName}`);
        } else if (this.protectedDetailDbProperties.has(propertyName)) {
          rejectedProperties.push(propertyName);
          logger.warn(`User attempted to modify protected detail property: ${propertyName} - BLOCKED`);
        } else {
          // Unknown property - allow it (might be a new field)
          filteredProperties[propertyName] = value;
          logger.info(`Unknown detail property allowed: ${propertyName}`);
        }
      }
    }

    if (rejectedProperties.length > 0) {
      logger.warn(`Blocked ${rejectedProperties.length} protected detail property updates: ${rejectedProperties.join(', ')}`);
    }

    return filteredProperties;
  }

  /**
   * Creates a validated page update call with property protection
   * @param {string} pageId - Notion page ID
   * @param {Object} properties - Properties to update
   * @param {boolean} isSystemUpdate - Whether this is a system update
   * @param {boolean} isDetailDatabase - Whether this is a detail database update
   * @returns {Promise} - Notion API response
   */
  async safePageUpdate(pageId, properties, isSystemUpdate = true, isDetailDatabase = false) {
    try {
      const validatedProperties = isDetailDatabase 
        ? this.validateDetailDatabaseUpdate(properties, isSystemUpdate)
        : this.validateMainDatabaseUpdate(properties, isSystemUpdate);

      const response = await this.notion.pages.update({
        page_id: pageId,
        properties: validatedProperties
      });

      const updateType = isSystemUpdate ? 'System' : 'User';
      const dbType = isDetailDatabase ? 'detail database' : 'main database';
      logger.info(`${updateType} update completed successfully on ${dbType} page: ${pageId}`);
      
      return response;
    } catch (error) {
      logger.error(`Error in safe page update (${isSystemUpdate ? 'system' : 'user'}):`, error);
      throw error;
    }
  }

  // === MAIN VIDEOS DATABASE OPERATIONS ===

  async createVideoEntry(videoData) {
    try {
      // Generate sequential VideoID
      const nextVideoId = await this.getNextVideoId();
      
      const properties = {
        '🔒 Title': {
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
        '🔒 VideoID': {
          rich_text: [
            {
              text: {
                content: nextVideoId
              }
            }
          ]
        },
        '🔒 Status': {
          select: {
            name: 'New'
          }
        },
        '🔒 Channel': {
          rich_text: [
            {
              text: {
                content: videoData.channelTitle || ''
              }
            }
          ]
        },
        '🔒 Duration': {
          rich_text: [
            {
              text: {
                content: videoData.duration || ''
              }
            }
          ]
        },
        '🔒 View Count': {
          number: parseInt(videoData.viewCount) || 0
        },
        '🔒 Published Date': {
          date: {
            start: videoData.publishedAt
          }
        },
        '🔒 YouTube Video ID': {
          rich_text: [
            {
              text: {
                content: videoData.videoId || ''
              }
            }
          ]
        }
      };

      // Note: VideoID is handled by the formula property in Notion database schema
      // Sequential VideoID generation is available via getNextSequentialVideoId() if needed
      logger.debug('VideoID will be auto-generated by Notion formula property');

      const response = await this.notion.pages.create({
        parent: { database_id: this.databaseId },
        properties
      });

      logger.info(`Created Notion entry for video: ${videoData.title} with VideoID: ${nextVideoId}`);
      return response;
    } catch (error) {
      logger.error('Error creating Notion entry:', error);
      throw error;
    }
  }

  async updateVideoStatus(pageId, status, additionalData = {}) {
    try {
      const properties = {};

      // Only add Status property if status is provided and not null/undefined
      if (status !== null && status !== undefined && status !== '') {
        properties['🔒 Status'] = {
          select: {
            name: status
          }
        };
      }

      if (additionalData.optimizedTitle) {
        properties['🔒 Optimized Title'] = {
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
        properties['🔒 Optimized Description'] = {
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
        properties['🔒 Keywords'] = {
          multi_select: additionalData.keywords.slice(0, 10).map(keyword => ({ name: keyword }))
        };
      }

      if (additionalData.scriptApproved !== undefined) {
        properties['Script Approved'] = {
          checkbox: additionalData.scriptApproved
        };
      }

      if (additionalData.totalSentences !== undefined) {
        properties['🔒 Total Sentences'] = {
          number: additionalData.totalSentences
        };
      }

      if (additionalData.completedSentences !== undefined) {
        properties['🔒 Completed Sentences'] = {
          number: additionalData.completedSentences
        };
      }

      if (additionalData.thumbnail) {
        properties['🔒 Thumbnail'] = {
          url: additionalData.thumbnail
        };
      }

      if (additionalData.thumbnailPrompt) {
        properties['🔒 New Thumbnail Prompt'] = {
          rich_text: [
            {
              text: {
                content: additionalData.thumbnailPrompt
              }
            }
          ]
        };
      }

      if (additionalData.scriptStatus) {
        properties['🔒 Sentence Status'] = {
          select: {
            name: additionalData.scriptStatus
          }
        };
      }

      // Use safe page update for system updates (isSystemUpdate = true by default)
      const response = await this.safePageUpdate(pageId, properties, true, false);

      if (status) {
        logger.info(`Updated Notion entry status to: ${status}`);
      } else {
        logger.info('Updated Notion entry properties (no status change)');
      }
      return response;
    } catch (error) {
      logger.error('Error updating Notion entry:', error);
      throw error;
    }
  }

  async getVideosByStatus(status) {
    try {
      const response = await this.notion.databases.query({
        database_id: this.databaseId,
        filter: {
          property: '🔒 Status',
          select: {
            equals: status
          }
        }
      });

      return response.results.map(page => ({
        id: page.id,
        videoId: page.properties['🔒 VideoID']?.formula?.string || page.properties['🔒 VideoID']?.rich_text[0]?.text?.content || page.id,
        title: page.properties['🔒 Title']?.title[0]?.text?.content || '',
        youtubeUrl: page.properties['YouTube URL']?.url || '',
        youtubeVideoId: page.properties['🔒 YouTube Video ID']?.rich_text[0]?.text?.content || '',
        status: page.properties['🔒 Status']?.select?.name || '',
        scriptApproved: page.properties['Script Approved']?.checkbox || false,
        optimizedTitle: page.properties['🔒 Optimized Title']?.rich_text[0]?.text?.content || '',
        totalSentences: page.properties['🔒 Total Sentences']?.number || 0,
        completedSentences: page.properties['🔒 Completed Sentences']?.number || 0,
        thumbnail: page.properties['🔒 Thumbnail']?.url || '',
        thumbnailPrompt: page.properties['🔒 New Thumbnail Prompt']?.rich_text[0]?.text?.content || '',
        scriptStatus: page.properties['🔒 Sentence Status']?.select?.name || '',
        createdTime: page.created_time
      }));
    } catch (error) {
      logger.error('Error fetching videos by status:', error);
      throw error;
    }
  }

  // Generate sequential VideoID with 4-digit padding
  async getNextSequentialVideoId() {
    try {
      // Query all pages to get the highest existing VideoID
      const response = await this.notion.databases.query({
        database_id: this.databaseId,
        sorts: [
          {
            property: 'Created Time',
            direction: 'descending'
          }
        ]
      });

      let highestNumber = 0;
      
      // Extract numeric part from existing VideoIDs
      response.results.forEach(page => {
        const videoId = page.properties.VideoID?.formula?.string || '';
        const match = videoId.match(/VID_(\d+)/);
        if (match) {
          const number = parseInt(match[1], 10);
          if (number > highestNumber) {
            highestNumber = number;
          }
        }
      });

      // Generate next sequential number with 4-digit padding
      const nextNumber = highestNumber + 1;
      const paddedNumber = nextNumber.toString().padStart(4, '0');
      return `VID_${paddedNumber}`;
      
    } catch (error) {
      logger.error('Error generating sequential VideoID:', error);
      // Fallback to timestamp-based ID
      const timestamp = Date.now().toString().slice(-4);
      return `VID_${timestamp}`;
    }
  }

  // Updated: Generate sequential VideoID from VID_0001 to VID_9999
  async getNextVideoId() {
    try {
      // Get all entries and filter VideoIDs on the client side
      // since we can't reliably filter on VideoID (could be formula or rich_text)
      const response = await this.notion.databases.query({
        database_id: this.databaseId,
        sorts: [
          {
            property: '🔒 Created Time',
            direction: 'descending'
          }
        ]
      });

      let maxId = 0;
      
      response.results.forEach(page => {
        // Handle both formula and rich_text formats for VideoID
        const videoId = page.properties['🔒 VideoID']?.formula?.string || 
                       page.properties['🔒 VideoID']?.rich_text?.[0]?.text?.content || '';
        
        if (videoId.startsWith('VID_')) {
          const numberPart = parseInt(videoId.substring(4));
          if (!isNaN(numberPart) && numberPart > maxId) {
            maxId = numberPart;
          }
        }
      });

      const nextId = maxId + 1;
      
      // Ensure we don't exceed 9999
      if (nextId > 9999) {
        logger.warn('VideoID limit reached (9999), cycling back to 1');
        return 'VID_0001';
      }
      
      const formattedId = `VID_${nextId.toString().padStart(4, '0')}`;
      
      logger.info(`Generated next VideoID: ${formattedId}`);
      return formattedId;
    } catch (error) {
      logger.error('Error generating next VideoID:', error);
      const timestamp = Date.now().toString().slice(-4);
      return `VID_${timestamp}`;
    }
  }

  async addVideoUrl(url) {
    try {
      // Generate sequential VideoID
      const nextVideoId = await this.getNextVideoId();
      
      const properties = {
        '🔒 Title': {
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
        '🔒 VideoID': {
          rich_text: [
            {
              text: {
                content: nextVideoId
              }
            }
          ]
        },
        '🔒 Status': {
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

  async autoPopulateVideoData(pageId, youtubeData) {
    try {
      const properties = {
        '🔒 Title': {
          title: [
            {
              text: {
                content: youtubeData.title || 'Untitled Video'
              }
            }
          ]
        },
        '🔒 Channel': {
          rich_text: [
            {
              text: {
                content: youtubeData.channelTitle || ''
              }
            }
          ]
        },
        '🔒 Duration': {
          rich_text: [
            {
              text: {
                content: youtubeData.duration || ''
              }
            }
          ]
        },
        '🔒 View Count': {
          number: parseInt(youtubeData.viewCount) || 0
        },
        '🔒 Published Date': {
          date: {
            start: youtubeData.publishedAt || new Date().toISOString().split('T')[0]
          }
        },
        '🔒 YouTube Video ID': {
          rich_text: [
            {
              text: {
                content: youtubeData.videoId || ''
              }
            }
          ]
        },
        '🔒 Status': {
          select: {
            name: 'Processing'
          }
        }
      };

      const response = await this.safePageUpdate(pageId, properties, true, false);

      logger.info(`Auto-populated video data for: ${youtubeData.title}`);
      return response;
    } catch (error) {
      logger.error('Error auto-populating video data:', error);
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

  // === SCRIPT SUB-PAGES OPERATIONS ===

  /**
   * Splits long text into chunks at natural breakpoints while respecting Notion's 2000 char limit
   * @param {string} text - Text to split
   * @param {number} maxLength - Maximum length per chunk (default: 1900 to be safe)
   * @returns {Array<string>} - Array of text chunks
   */
  splitTextIntoChunks(text, maxLength = 1900) {
    if (!text || text.length <= maxLength) {
      return [text || ''];
    }

    const chunks = [];
    let currentIndex = 0;

    while (currentIndex < text.length) {
      const endIndex = currentIndex + maxLength;
      
      if (endIndex >= text.length) {
        // Last chunk
        chunks.push(text.substring(currentIndex));
        break;
      }

      // Try to find a natural breakpoint
      const chunk = text.substring(currentIndex, endIndex);
      let breakPoint = endIndex;
      
      // Look for natural breakpoints in order of preference
      const breakChars = ['\n\n', '\n', '. ', '? ', '! ', ', ', ' '];
      
      for (const breakChar of breakChars) {
        const lastBreakIndex = chunk.lastIndexOf(breakChar);
        if (lastBreakIndex > maxLength * 0.7) { // At least 70% of max length to avoid tiny chunks
          breakPoint = currentIndex + lastBreakIndex + breakChar.length;
          break;
        }
      }
      
      chunks.push(text.substring(currentIndex, breakPoint).trim());
      currentIndex = breakPoint;
    }

    return chunks.filter(chunk => chunk.length > 0);
  }

  /**
   * Creates paragraph blocks from text chunks
   * @param {Array<string>} textChunks - Array of text chunks
   * @returns {Array<Object>} - Array of Notion paragraph blocks
   */
  createParagraphBlocks(textChunks) {
    return textChunks.map(chunk => ({
      object: 'block',
      type: 'paragraph',
      paragraph: {
        rich_text: [
          {
            text: {
              content: chunk
            }
          }
        ]
      }
    }));
  }

  /**
   * Creates the Original Script sub-page under the main video record
   * @param {string} videoPageId - Main video record page ID
   * @param {string} originalTranscript - Raw YouTube transcript
   * @param {string} videoTitle - Video title for page naming
   * @returns {Promise<Object>} - Created page information
   */
  async createOriginalScriptPage(videoPageId, originalTranscript, videoTitle) {
    try {
      logger.info(`Creating Original Script sub-page for video: ${videoTitle}`);

      const pageTitle = `${videoTitle} - Original Script`.substring(0, 100);
      const transcriptText = originalTranscript || 'No transcript available';
      
      // Split transcript into chunks to handle Notion's 2000 character limit
      const textChunks = this.splitTextIntoChunks(transcriptText);
      logger.info(`Split transcript into ${textChunks.length} chunks for Notion compatibility`);

      // Create initial page structure
      const initialChildren = [
        {
          object: 'block',
          type: 'heading_1',
          heading_1: {
            rich_text: [
              {
                text: {
                  content: '📝 Original YouTube Transcript'
                }
              }
            ]
          }
        },
        {
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [
              {
                text: {
                  content: 'This is the raw transcript extracted from the YouTube video. Review this content before the AI optimization process.'
                }
              }
            ]
          }
        },
        {
          object: 'block',
          type: 'divider',
          divider: {}
        }
      ];

      // Add paragraph blocks for each text chunk
      const contentBlocks = this.createParagraphBlocks(textChunks);
      const allChildren = [...initialChildren, ...contentBlocks];

      const page = await this.notion.pages.create({
        parent: {
          type: 'page_id',
          page_id: videoPageId
        },
        properties: {
          title: [
            {
              text: {
                content: pageTitle
              }
            }
          ]
        },
        children: allChildren
      });

      logger.info(`Original Script page created: ${page.id} with ${textChunks.length} text blocks`);
      return {
        pageId: page.id,
        pageUrl: page.url,
        title: pageTitle
      };
    } catch (error) {
      logger.error('Error creating original script page:', error);
      throw error;
    }
  }

  /**
   * Creates the Optimized Script sub-page under the main video record
   * @param {string} videoPageId - Main video record page ID
   * @param {string} optimizedScript - AI-enhanced script
   * @param {string} videoTitle - Video title for page naming
   * @returns {Promise<Object>} - Created page information
   */
  async createOptimizedScriptPage(videoPageId, optimizedScript, videoTitle) {
    try {
      logger.info(`Creating Optimized Script sub-page for video: ${videoTitle}`);

      const pageTitle = `${videoTitle} - Optimized Script`.substring(0, 100);
      const scriptText = optimizedScript || 'No optimized script available';
      
      // Split script into chunks to handle Notion's 2000 character limit
      const textChunks = this.splitTextIntoChunks(scriptText);
      logger.info(`Split optimized script into ${textChunks.length} chunks for Notion compatibility`);

      // Create initial page structure
      const initialChildren = [
        {
          object: 'block',
          type: 'heading_1',
          heading_1: {
            rich_text: [
              {
                text: {
                  content: '✨ AI-Optimized Script'
                }
              }
            ]
          }
        },
        {
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [
              {
                text: {
                  content: 'This is the AI-enhanced script optimized for engagement and short-form content. Review and approve this script before proceeding to the detailed breakdown.'
                }
              }
            ]
          }
        },
        {
          object: 'block',
          type: 'callout',
          callout: {
            icon: {
              emoji: '📋'
            },
            rich_text: [
              {
                text: {
                  content: 'Review this script carefully and check the "Script Approved" checkbox in the main video record when ready to proceed.'
                }
              }
            ]
          }
        },
        {
          object: 'block',
          type: 'divider',
          divider: {}
        }
      ];

      // Add paragraph blocks for each text chunk
      const contentBlocks = this.createParagraphBlocks(textChunks);
      const allChildren = [...initialChildren, ...contentBlocks];

      const page = await this.notion.pages.create({
        parent: {
          type: 'page_id',
          page_id: videoPageId
        },
        properties: {
          title: [
            {
              text: {
                content: pageTitle
              }
            }
          ]
        },
        children: allChildren
      });

      logger.info(`Optimized Script page created: ${page.id} with ${textChunks.length} text blocks`);
      return {
        pageId: page.id,
        pageUrl: page.url,
        title: pageTitle
      };
    } catch (error) {
      logger.error('Error creating optimized script page:', error);
      throw error;
    }
  }

  /**
   * Creates the complete hierarchical script structure for a video
   * @param {string} videoPageId - Main video record page ID
   * @param {string} videoTitle - Video title
   * @param {string} originalTranscript - Raw YouTube transcript
   * @param {string} optimizedScript - AI-enhanced script
   * @param {Array} scriptSentences - Breakdown sentences for database
   * @param {Array} imagePrompts - Image prompts for each sentence
   * @returns {Promise<Object>} - Complete structure information
   */
  async createCompleteScriptStructure(videoPageId, videoTitle, originalTranscript, optimizedScript, scriptSentences = [], imagePrompts = []) {
    try {
      logger.info(`Creating complete script structure for video: ${videoTitle}`);

      // Create script sub-pages in parallel
      const [originalScriptPage, optimizedScriptPage] = await Promise.all([
        this.createOriginalScriptPage(videoPageId, originalTranscript, videoTitle),
        this.createOptimizedScriptPage(videoPageId, optimizedScript, videoTitle)
      ]);

      // Create script breakdown database as child if sentences are provided
      let scriptDatabase = null;
      if (scriptSentences.length > 0) {
        const breakdownResult = await this.createScriptBreakdown(videoPageId, scriptSentences, imagePrompts);
        scriptDatabase = breakdownResult.scriptDatabase;
      }

      const result = {
        originalScriptPage,
        optimizedScriptPage,
        scriptDatabase,
        structure: {
          mainVideoPage: videoPageId,
          children: {
            originalScript: originalScriptPage.pageId,
            optimizedScript: optimizedScriptPage.pageId,
            ...(scriptDatabase && { scriptBreakdown: scriptDatabase.databaseId })
          }
        }
      };

      logger.info(`Complete script structure created successfully for: ${videoTitle}`);
      return result;
    } catch (error) {
      logger.error('Error creating complete script structure:', error);
      throw error;
    }
  }

  // === PER-VIDEO DATABASE OPERATIONS ===

  async createVideoScriptDatabase(videoTitle, videoPageId) {
    try {
      logger.info(`Creating dedicated script database for video: ${videoTitle}`);
      
      const databaseTitle = `${videoTitle} - Script Details`.substring(0, 100); // Notion title limit
      
      // Create database properties schema with optimized configuration and protection indicators
      const properties = {
        'Sentence': {
          title: {} // Only user-editable field (no 🔒 prefix)
        },
        '🔒 Sentence Number': {
          number: {
            format: 'number'
          }
        },
        '🔒 Script Text': {
          rich_text: {}
        },
        '🔒 Image Prompt': {
          rich_text: {}
        },
        '🔒 Generated Image URL': {
          url: {}
        },
        '🔒 Status': {
          select: {
            options: [
              { name: 'Pending', color: 'gray' },
              { name: 'Processing', color: 'yellow' },
              { name: 'Image Generated', color: 'blue' },
              { name: 'Complete', color: 'green' }
            ]
          }
        },
        '🔒 Word Count': {
          formula: {
            expression: 'length(prop("🔒 Script Text"))'  // Updated to reference the new property name
          }
        },
        '🔒 Created Time': {
          created_time: {}
        },
        '🔒 Last Edited Time': {
          last_edited_time: {}
        }
      };

      // Create the database
      const database = await this.notion.databases.create({
        parent: {
          type: 'page_id',
          page_id: videoPageId
        },
        title: [
          {
            type: 'text',
            text: {
              content: databaseTitle
            }
          }
        ],
        properties: properties
      });

      logger.info(`Created dedicated script database: ${database.id} with URL: ${database.url}`);
      
      // Note: Due to Notion API limitations, we cannot set the default view's sort order programmatically.
      // However, all queries to this database will use proper sorting by Sentence Number ascending.
      logger.info('Note: Default view sort order must be set manually in Notion UI (API limitation)');
      
      return {
        databaseId: database.id,
        databaseUrl: database.url,
        title: databaseTitle
      };
      
    } catch (error) {
      logger.error('Error creating video script database:', error);
      throw error;
    }
  }

  async createScriptBreakdown(videoPageId, scriptSentences, imagePrompts) {
    try {
      // First get the video title for database naming
      const videoPage = await this.notion.pages.retrieve({ page_id: videoPageId });
      const videoTitle = videoPage.properties['🔒 Title']?.title[0]?.text?.content || 'Unknown Video';
      
      logger.info(`Creating script breakdown for video: ${videoTitle}`);
      
      // Create dedicated database for this video
      const scriptDatabase = await this.createVideoScriptDatabase(videoTitle, videoPageId);
      
      const detailRecords = [];
      
      // Create a record for each sentence in the dedicated database
      for (let i = 0; i < scriptSentences.length; i++) {
        const sentenceNumber = i + 1;
        const scriptText = scriptSentences[i] || '';
        const imagePrompt = imagePrompts[i] || '';
        
        const detailProperties = {
          'Sentence': {
            title: [
              {
                text: {
                  content: `Sentence ${sentenceNumber}`
                }
              }
            ]
          },
          '🔒 Sentence Number': {
            number: sentenceNumber
          },
          '🔒 Script Text': {
            rich_text: [
              {
                text: {
                  content: scriptText
                }
              }
            ]
          },
          '🔒 Image Prompt': {
            rich_text: [
              {
                text: {
                  content: imagePrompt
                }
              }
            ]
          },
          '🔒 Status': {
            select: {
              name: 'Pending'
            }
          }
        };

        const detailRecord = await this.notion.pages.create({
          parent: { database_id: scriptDatabase.databaseId },
          properties: detailProperties
        });

        detailRecords.push(detailRecord);
      }

      // Update main video record with sentence count and initial script status
      logger.info(`Updating main video record with script breakdown info: ${videoPageId}`);
      
      await this.updateVideoStatus(videoPageId, null, {
        totalSentences: scriptSentences.length,
        completedSentences: 0,
        scriptStatus: 'Script Created'
      });

      // Verify the script status was updated successfully
      const updatedVideoPage = await this.notion.pages.retrieve({ page_id: videoPageId });
      const scriptStatus = updatedVideoPage.properties['🔒 Sentence Status']?.select?.name;
      
      if (scriptStatus === 'Script Created') {
        logger.info(`Successfully updated script status to: ${scriptStatus}`);
      } else {
        logger.warn('Script status update may have failed');
      }

      logger.info(`Script breakdown created successfully with ${scriptSentences.length} sentences and ${imagePrompts.length} image prompts`);
      
      return {
        success: true,
        sentenceCount: scriptSentences.length,
        imagePromptCount: imagePrompts.length,
        detailRecords,
        scriptDatabase,
        message: `Script breakdown stored in dedicated database: ${scriptDatabase.title}`
      };
      
    } catch (error) {
      logger.error('Error creating script breakdown:', error);
      throw error;
    }
  }

  async updateSentenceStatus(videoPageId, sentenceNumber, status, imageUrl = null) {
    try {
      logger.info(`Updating sentence ${sentenceNumber} status to: ${status} for video: ${videoPageId}`);
      
      // Find the detail record for this sentence
      const detailRecord = await this.getVideoDetailBySentence(videoPageId, sentenceNumber);
      
      if (!detailRecord) {
        throw new Error(`Detail record not found for sentence ${sentenceNumber}`);
      }

      const updateProperties = {
        '🔒 Status': {
          select: {
            name: status
          }
        }
      };

      if (imageUrl) {
        updateProperties['🔒 Generated Image URL'] = {
          url: imageUrl
        };
      }

      await this.safePageUpdate(detailRecord.id, updateProperties, true, true);

      // Update completed count in main video record if status is Complete
      if (status === 'Complete') {
        await this.updateVideoCompletedCount(videoPageId);
      }
      
      logger.info('Sentence status updated successfully');
      return true;
      
    } catch (error) {
      logger.error('Error updating sentence status:', error);
      throw error;
    }
  }

  async getVideoDetailBySentence(videoPageId, sentenceNumber) {
    try {
      // Since we no longer store script database ID in main DB, 
      // we need to find the script database that's a child of the video page
      const scriptDatabaseId = await this.findScriptDatabaseForVideo(videoPageId);
      
      if (!scriptDatabaseId) {
        logger.warn(`No script database found for video: ${videoPageId}`);
        return null;
      }

      const response = await this.notion.databases.query({
        database_id: scriptDatabaseId,
        filter: {
          property: '🔒 Sentence Number',
          number: {
            equals: sentenceNumber
          }
        }
      });

      if (response.results.length === 0) {
        return null;
      }

      const page = response.results[0];
      return {
        id: page.id,
        sentenceNumber: page.properties['🔒 Sentence Number']?.number || 0,
        scriptText: page.properties['🔒 Script Text']?.rich_text[0]?.text?.content || '',
        imagePrompt: page.properties['🔒 Image Prompt']?.rich_text[0]?.text?.content || '',
        imageUrl: page.properties['🔒 Generated Image URL']?.url || '',
        status: page.properties['🔒 Status']?.select?.name || 'Pending'
      };
      
    } catch (error) {
      logger.error('Error retrieving video detail by sentence:', error);
      throw error;
    }
  }

  async findScriptDatabaseForVideo(videoPageId) {
    try {
      // Search for databases that are children of the video page
      const response = await this.notion.search({
        filter: {
          value: 'database',
          property: 'object'
        },
        parent: {
          type: 'page_id',
          page_id: videoPageId
        }
      });

      // Look for a database with "Script" in the title
      const scriptDatabase = response.results.find(db => 
        db.title && db.title[0]?.text?.content?.toLowerCase().includes('script')
      );

      return scriptDatabase ? scriptDatabase.id : null;
    } catch (error) {
      logger.error('Error finding script database for video:', error);
      return null;
    }
  }

  async getVideoDetails(videoPageId) {
    try {
      // Find the video's dedicated database ID
      const scriptDatabaseId = await this.findScriptDatabaseForVideo(videoPageId);
      
      if (!scriptDatabaseId) {
        logger.warn(`No script database found for video: ${videoPageId}`);
        return [];
      }

      const response = await this.notion.databases.query({
        database_id: scriptDatabaseId,
        sorts: [
          {
            property: '🔒 Sentence Number',
            direction: 'ascending'
          }
        ]
      });

      logger.debug(`Retrieved ${response.results.length} script details for video ${videoPageId}, sorted by Sentence Number ascending`);

      return response.results.map(page => ({
        id: page.id,
        sentenceNumber: page.properties['🔒 Sentence Number']?.number || 0,
        scriptText: page.properties['🔒 Script Text']?.rich_text[0]?.text?.content || '',
        imagePrompt: page.properties['🔒 Image Prompt']?.rich_text[0]?.text?.content || '',
        imageUrl: page.properties['🔒 Generated Image URL']?.url || '',
        status: page.properties['🔒 Status']?.select?.name || 'Pending',
        wordCount: page.properties['🔒 Word Count']?.formula?.number || 0,
        createdTime: page.created_time
      }));
      
    } catch (error) {
      logger.error('Error retrieving video details:', error);
      throw error;
    }
  }

  async updateVideoCompletedCount(videoPageId) {
    try {
      // Get all details for this video
      const details = await this.getVideoDetails(videoPageId);
      const completedCount = details.filter(detail => detail.status === 'Complete').length;
      
      // Update the main video record
      await this.updateVideoStatus(videoPageId, null, {
        completedSentences: completedCount
      });
      
      logger.info(`Updated completed sentence count to ${completedCount} for video ${videoPageId}`);
      return completedCount;
      
    } catch (error) {
      logger.error('Error updating video completed count:', error);
      throw error;
    }
  }

  async updateScriptStatus(videoPageId, scriptStatus) {
    try {
      await this.updateVideoStatus(videoPageId, null, {
        scriptStatus: scriptStatus
      });
      
      logger.info(`Updated script status to: ${scriptStatus} for video: ${videoPageId}`);
      return true;
      
    } catch (error) {
      logger.error('Error updating script status:', error);
      throw error;
    }
  }

  async updateMultipleImageUrls(videoPageId, imageUrls) {
    try {
      logger.info(`Updating ${imageUrls.length} image URLs for video: ${videoPageId}`);
      
      const details = await this.getVideoDetails(videoPageId);
      
      for (let i = 0; i < Math.min(details.length, imageUrls.length); i++) {
        if (imageUrls[i]) {
          await this.updateSentenceStatus(videoPageId, i + 1, 'Image Generated', imageUrls[i]);
        }
      }
      
      logger.info(`Updated ${imageUrls.length} image URLs successfully`);
      return true;
      
    } catch (error) {
      logger.error('Error updating multiple image URLs:', error);
      throw error;
    }
  }

  // === USER-SAFE UPDATE METHODS ===

  /**
   * Allow users to safely update only permitted properties in main database
   * This method blocks protected properties and only allows YouTube URL and Script Approved changes
   * @param {string} pageId - Notion page ID
   * @param {Object} properties - Properties to update (will be filtered)
   * @returns {Promise} - Notion API response
   */
  async userUpdateVideoProperties(pageId, properties) {
    logger.info(`User-initiated update for page: ${pageId}`);
    return this.safePageUpdate(pageId, properties, false, false);
  }

  /**
   * Allow users to safely update only permitted properties in detail databases
   * This method blocks protected properties and only allows Sentence title changes
   * @param {string} pageId - Detail database page ID  
   * @param {Object} properties - Properties to update (will be filtered)
   * @returns {Promise} - Notion API response
   */
  async userUpdateDetailProperties(pageId, properties) {
    logger.info(`User-initiated detail update for page: ${pageId}`);
    return this.safePageUpdate(pageId, properties, false, true);
  }

  /**
   * Get list of properties users are allowed to modify in main database
   * @returns {Array} - Array of allowed property names
   */
  getAllowedMainDbProperties() {
    return Array.from(this.allowedMainDbProperties);
  }

  /**
   * Get list of properties users are allowed to modify in detail databases
   * @returns {Array} - Array of allowed property names  
   */
  getAllowedDetailDbProperties() {
    return Array.from(this.allowedDetailDbProperties);
  }

  /**
   * Get list of protected properties in main database
   * @returns {Array} - Array of protected property names
   */
  getProtectedMainDbProperties() {
    return Array.from(this.protectedMainDbProperties);
  }

  /**
   * Get list of protected properties in detail databases
   * @returns {Array} - Array of protected property names
   */
  getProtectedDetailDbProperties() {
    return Array.from(this.protectedDetailDbProperties);
  }

  /**
   * Check if a property is allowed for user editing in main database
   * @param {string} propertyName - Name of the property to check
   * @returns {boolean} - True if user can edit this property
   */
  isUserAllowedMainDbProperty(propertyName) {
    return this.allowedMainDbProperties.has(propertyName);
  }

  /**
   * Check if a property is allowed for user editing in detail databases
   * @param {string} propertyName - Name of the property to check
   * @returns {boolean} - True if user can edit this property
   */
  isUserAllowedDetailDbProperty(propertyName) {
    return this.allowedDetailDbProperties.has(propertyName);
  }

  // === NAVIGATION HELPER METHODS ===

  /**
   * Retrieves all child pages and databases for a video record
   * @param {string} videoPageId - Main video record page ID
   * @returns {Promise<Object>} - Structure with all children
   */
  async getVideoScriptStructure(videoPageId) {
    try {
      logger.info(`Retrieving script structure for video: ${videoPageId}`);

      // Search for pages and databases that might be children of this video
      // We'll use a combination of search and manual filtering
      const searchResponse = await this.notion.search({
        query: '',
        filter: {
          value: 'page',
          property: 'object'
        },
        page_size: 100
      });

      const structure = {
        mainVideoPage: videoPageId,
        children: {
          originalScript: null,
          optimizedScript: null,
          scriptBreakdown: null
        },
        pages: []
      };

      // Since Notion API doesn't allow direct parent filtering in search,
      // we'll need to check each result to see if it's a child of our video page
      for (const result of searchResponse.results) {
        try {
          // Check if this page/database has our video page as parent
          if (result.parent && 
              result.parent.type === 'page_id' && 
              result.parent.page_id === videoPageId) {
            
            const title = result.properties?.title?.[0]?.text?.content || 
                         result.title?.[0]?.text?.content || 
                         'Untitled';

            const childInfo = {
              id: result.id,
              title: title,
              type: result.object, // 'page' or 'database'
              url: result.url,
              created_time: result.created_time,
              last_edited_time: result.last_edited_time
            };

            structure.pages.push(childInfo);

            // Categorize by content
            const titleLower = title.toLowerCase();
            if (titleLower.includes('original script')) {
              structure.children.originalScript = childInfo;
            } else if (titleLower.includes('optimized script')) {
              structure.children.optimizedScript = childInfo;
            } else if (titleLower.includes('script') && result.object === 'database') {
              structure.children.scriptBreakdown = childInfo;
            }
          }
        } catch (childError) {
          // Skip this result if we can't process it
          logger.debug(`Skipping result ${result.id}: ${childError.message}`);
        }
      }

      // Also search for databases specifically
      const databaseSearchResponse = await this.notion.search({
        query: '',
        filter: {
          value: 'database',
          property: 'object'
        },
        page_size: 100
      });

      for (const database of databaseSearchResponse.results) {
        try {
          if (database.parent && 
              database.parent.type === 'page_id' && 
              database.parent.page_id === videoPageId) {
            
            const title = database.title?.[0]?.text?.content || 'Untitled Database';

            const childInfo = {
              id: database.id,
              title: title,
              type: 'database',
              url: database.url,
              created_time: database.created_time,
              last_edited_time: database.last_edited_time
            };

            // Only add if not already found in pages search
            const alreadyExists = structure.pages.some(page => page.id === database.id);
            if (!alreadyExists) {
              structure.pages.push(childInfo);

              const titleLower = title.toLowerCase();
              if (titleLower.includes('script')) {
                structure.children.scriptBreakdown = childInfo;
              }
            }
          }
        } catch (dbError) {
          logger.debug(`Skipping database ${database.id}: ${dbError.message}`);
        }
      }

      logger.info(`Found ${structure.pages.length} child items for video ${videoPageId}`);
      return structure;
    } catch (error) {
      logger.error('Error retrieving video script structure:', error);
      throw error;
    }
  }

  /**
   * Gets quick navigation links for a video's script components
   * @param {string} videoPageId - Main video record page ID
   * @param {Object} knownUrls - Optional known URLs to use instead of searching
   * @returns {Promise<Object>} - Navigation links
   */
  async getVideoNavigationLinks(videoPageId, knownUrls = {}) {
    try {
      let structure;
      
      // If known URLs are provided, use them directly (more reliable)
      if (knownUrls.originalScript || knownUrls.optimizedScript || knownUrls.scriptBreakdown) {
        structure = {
          children: {
            originalScript: knownUrls.originalScript ? { url: knownUrls.originalScript } : null,
            optimizedScript: knownUrls.optimizedScript ? { url: knownUrls.optimizedScript } : null,
            scriptBreakdown: knownUrls.scriptBreakdown ? { url: knownUrls.scriptBreakdown } : null
          }
        };
        logger.info('Using provided URLs for navigation links');
      } else {
        // Fallback to searching (less reliable due to API limitations)
        structure = await this.getVideoScriptStructure(videoPageId);
      }

      const links = {
        mainVideo: `https://notion.so/${videoPageId.replace(/-/g, '')}`,
        originalScript: structure.children.originalScript?.url || null,
        optimizedScript: structure.children.optimizedScript?.url || null,
        scriptBreakdown: structure.children.scriptBreakdown?.url || null
      };

      // Generate formatted navigation text
      const navigationText = [
        '📋 **Video Navigation**',
        '',
        `🎬 [Main Video Record](${links.mainVideo})`,
        links.originalScript ? `📝 [Original Script](${links.originalScript})` : '📝 Original Script: Available as sub-page',
        links.optimizedScript ? `✨ [Optimized Script](${links.optimizedScript})` : '✨ Optimized Script: Available as sub-page', 
        links.scriptBreakdown ? `🎯 [Script Breakdown](${links.scriptBreakdown})` : '🎯 Script Breakdown: Available as child database',
        '',
        '💡 *All components are accessible as children of the main video record*'
      ].join('\n');

      return {
        links,
        navigationText,
        structure: structure.children
      };
    } catch (error) {
      logger.error('Error getting video navigation links:', error);
      throw error;
    }
  }

  /**
   * Verifies the complete hierarchical structure for a video
   * @param {string} videoPageId - Main video record page ID
   * @returns {Promise<Object>} - Verification result
   */
  async verifyVideoHierarchy(videoPageId) {
    try {
      const structure = await this.getVideoScriptStructure(videoPageId);
      
      const verification = {
        isComplete: false,
        hasOriginalScript: !!structure.children.originalScript,
        hasOptimizedScript: !!structure.children.optimizedScript,
        hasScriptBreakdown: !!structure.children.scriptBreakdown,
        totalChildren: structure.pages.length,
        missingComponents: []
      };

      // Check what's missing
      if (!verification.hasOriginalScript) {
        verification.missingComponents.push('Original Script');
      }
      if (!verification.hasOptimizedScript) {
        verification.missingComponents.push('Optimized Script');
      }
      if (!verification.hasScriptBreakdown) {
        verification.missingComponents.push('Script Breakdown Database');
      }

      // Structure is complete if all components are present
      verification.isComplete = verification.missingComponents.length === 0;

      logger.info(`Hierarchy verification for ${videoPageId}: Complete=${verification.isComplete}, Missing=${verification.missingComponents.join(', ')}`);
      return verification;
    } catch (error) {
      logger.error('Error verifying video hierarchy:', error);
      throw error;
    }
  }

  // === UTILITY FUNCTIONS ===

  async verifyScriptDatabaseLinking(videoPageId) {
    try {
      const scriptDatabaseId = await this.findScriptDatabaseForVideo(videoPageId);
      
      if (scriptDatabaseId) {
        // Verify the database actually exists and is accessible
        try {
          const database = await this.notion.databases.retrieve({ database_id: scriptDatabaseId });
          logger.info(`Script database found for video ${videoPageId}: ${database.url}`);
          return {
            isLinked: true,
            scriptDatabaseUrl: database.url,
            scriptDatabaseId: scriptDatabaseId,
            accessible: true
          };
        } catch (error) {
          logger.error(`Script database found but not accessible: ${scriptDatabaseId}`, error);
          return {
            isLinked: true,
            scriptDatabaseUrl: null,
            scriptDatabaseId: scriptDatabaseId,
            accessible: false,
            error: error.message
          };
        }
      } else {
        logger.warn(`No script database found for video ${videoPageId}`);
        return {
          isLinked: false,
          scriptDatabaseUrl: null,
          scriptDatabaseId: null,
          accessible: false
        };
      }
    } catch (error) {
      logger.error('Error verifying script database linking:', error);
      throw error;
    }
  }

  async getScriptDatabaseInfo(videoPageId) {
    try {
      const linkInfo = await this.verifyScriptDatabaseLinking(videoPageId);
      
      if (!linkInfo.isLinked) {
        return {
          hasScriptDatabase: false,
          error: 'No script database found for this video'
        };
      }
      
      if (!linkInfo.accessible) {
        return {
          hasScriptDatabase: true,
          accessible: false,
          error: linkInfo.error || 'Script database not accessible'
        };
      }
      
      // Get additional info about the script database
      const database = await this.notion.databases.retrieve({ 
        database_id: linkInfo.scriptDatabaseId 
      });
      
      const sentenceCount = await this.getVideoDetails(videoPageId);
      
      return {
        hasScriptDatabase: true,
        accessible: true,
        databaseId: linkInfo.scriptDatabaseId,
        databaseUrl: linkInfo.scriptDatabaseUrl,
        title: database.title[0]?.text?.content || 'Unknown',
        sentenceCount: sentenceCount.length,
        createdTime: database.created_time,
        lastEditedTime: database.last_edited_time
      };
      
    } catch (error) {
      logger.error('Error getting script database info:', error);
      throw error;
    }
  }

  // === LEGACY COMPATIBILITY (for smooth transition) ===

  async createScriptBreakdown_LEGACY(pageId, scriptSentences, imagePrompts) {
    // This is the old method - redirect to new method
    return await this.createScriptBreakdown(pageId, scriptSentences, imagePrompts);
  }

  async getScriptBreakdown(pageId) {
    try {
      // Get all details for this video and format them as a single breakdown text
      const details = await this.getVideoDetails(pageId);
      
      if (details.length === 0) {
        return {
          breakdown: '',
          statuses: [],
          hasBreakdown: false
        };
      }

      // Format as a readable breakdown text (similar to old format)
      let breakdownText = '📋 SCRIPT BREAKDOWN\n\n';
      breakdownText += `📊 Overview: ${details.length} sentences\n\n`;
      
      details.forEach((detail, _index) => {
        breakdownText += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
        breakdownText += `🎬 SENTENCE ${detail.sentenceNumber}\n`;
        breakdownText += `📝 Text: ${detail.scriptText}\n`;
        breakdownText += `🎨 Image Prompt: ${detail.imagePrompt}\n`;
        breakdownText += `✅ Status: ${detail.status}\n`;
        if (detail.imageUrl) {
          breakdownText += `🖼️ Image: ${detail.imageUrl}\n`;
        }
        breakdownText += '\n';
      });
      
      const statuses = details.map(detail => `S${detail.sentenceNumber}: ${detail.status}`);
      
      return {
        breakdown: breakdownText,
        statuses,
        hasBreakdown: details.length > 0,
        details // Include raw details for advanced usage
      };
      
    } catch (error) {
      logger.error('Error retrieving script breakdown:', error);
      throw error;
    }
  }

  async healthCheck() {
    try {
      // Test main database only (per-video databases are created dynamically)
      const mainDbResponse = await this.notion.databases.retrieve({ database_id: this.databaseId });
      
      if (mainDbResponse?.id) {
        logger.info('Notion service health check passed (main database accessible)');
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