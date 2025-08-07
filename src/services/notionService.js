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
      '🔒 Editor Keywords',
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

  /**
   * Utility method to add delays between API calls
   * @param {number} ms - Milliseconds to delay
   * @returns {Promise}
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Retry mechanism for Notion API operations with exponential backoff
   * @param {Function} operation - The async operation to retry
   * @param {string} operationName - Name for logging purposes
   * @param {number} maxRetries - Maximum number of retry attempts
   * @returns {Promise} - Result of the operation
   */
  async retryNotionOperation(operation, operationName = 'NotionOperation', maxRetries = 3) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        // Check if it's a conflict error or rate limit error
        const isRetriableError = this.isRetriableNotionError(error);
        
        if (!isRetriableError || attempt === maxRetries) {
          logger.error(`${operationName} failed after ${attempt} attempts:`, error);
          throw error;
        }
        
        // Calculate delay with exponential backoff
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000); // Max 10 seconds
        
        logger.warn(`${operationName} failed (attempt ${attempt}/${maxRetries}), retrying in ${delay}ms:`, {
          error: error.message,
          code: error.code,
          status: error.status
        });
        
        await this.delay(delay);
      }
    }
    
    throw lastError;
  }

  /**
   * Check if a Notion API error is retriable
   * @param {Error} error - The error to check
   * @returns {boolean} - Whether the error should be retried
   */
  isRetriableNotionError(error) {
    // Notion API conflict errors
    if (error.message && error.message.includes('Conflict occurred while saving')) {
      return true;
    }
    
    // Rate limit errors
    if (error.code === 'rate_limited' || error.status === 429) {
      return true;
    }
    
    // Temporary server errors
    if (error.status >= 500 && error.status < 600) {
      return true;
    }
    
    // Network timeout errors
    if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
      return true;
    }
    
    return false;
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
          logger.info(`Allow: ${propertyName}`);
        } else if (this.protectedMainDbProperties.has(propertyName)) {
          rejectedProperties.push(propertyName);
          logger.warn(`Block: ${propertyName}`);
        } else {
          // Unknown property - allow it (might be a new field)
          filteredProperties[propertyName] = value;
          logger.info(`Allow new: ${propertyName}`);
        }
      }
    }

    if (rejectedProperties.length > 0) {
      logger.warn(`Blocked ${rejectedProperties.length} protected updates`);
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
          logger.info(`Allow detail: ${propertyName}`);
        } else if (this.protectedDetailDbProperties.has(propertyName)) {
          rejectedProperties.push(propertyName);
          logger.warn(`Block detail: ${propertyName}`);
        } else {
          // Unknown property - allow it (might be a new field)
          filteredProperties[propertyName] = value;
          logger.info(`Allow new detail: ${propertyName}`);
        }
      }
    }

    if (rejectedProperties.length > 0) {
      logger.warn(`Blocked ${rejectedProperties.length} detail updates`);
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
    const updateType = isSystemUpdate ? 'System' : 'User';
    const dbType = isDetailDatabase ? 'detail database' : 'main database';
    
    return this.retryNotionOperation(async () => {
      const validatedProperties = isDetailDatabase 
        ? this.validateDetailDatabaseUpdate(properties, isSystemUpdate)
        : this.validateMainDatabaseUpdate(properties, isSystemUpdate);

      const response = await this.notion.pages.update({
        page_id: pageId,
        properties: validatedProperties
      });

      logger.info(`${updateType} update completed`);
      return response;
    }, `safePageUpdate_${updateType}_${dbType}`);
  }

  // === MAIN VIDEOS DATABASE OPERATIONS ===

  async createVideoEntry(videoData) {
    try {
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

      const response = await this.notion.pages.create({
        parent: { database_id: this.databaseId },
        properties
      });

      logger.info(`Created entry: ${videoData.title}`);
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
        logger.info(`Status: ${status}`);
      } else {
        logger.info('Properties updated');
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

      return response.results.map(page => {
        // Extract the unique_id for VideoID (already has VID prefix)
        const uniqueIdData = page.properties['ID']?.unique_id;
        const videoId = uniqueIdData ? `${uniqueIdData.prefix}-${uniqueIdData.number}` : page.id; // Fallback to page ID if no unique ID
        
        return {
          id: page.id, // Keep the Notion page ID for internal operations
          videoId: videoId, // Use formatted VideoID (VID-XX) for display
          uniqueIdNumber: uniqueIdData?.number, // Store the raw number for reference
          title: page.properties['🔒 Title']?.title[0]?.text?.content || '',
          youtubeUrl: page.properties['YouTube URL']?.url || '',
          youtubeVideoId: page.properties['🔒 YouTube Video ID']?.rich_text[0]?.text?.content || '',
          status: page.properties['🔒 Status']?.select?.name || '',
          scriptApproved: page.properties['Script Approved']?.checkbox || false,
          // Missing critical fields that should be populated by autoPopulateVideoData
          channel: page.properties['🔒 Channel']?.rich_text[0]?.text?.content || '',
          duration: page.properties['🔒 Duration']?.rich_text[0]?.text?.content || '',
          viewCount: page.properties['🔒 View Count']?.number || 0,
          publishedDate: page.properties['🔒 Published Date']?.date?.start || '',
          // AI-generated content fields
          optimizedTitle: page.properties['🔒 Optimized Title']?.rich_text[0]?.text?.content || '',
          optimizedDescription: page.properties['🔒 Optimized Description']?.rich_text[0]?.text?.content || '',
          keywords: page.properties['🔒 Keywords']?.multi_select?.map(option => option.name) || [],
          // Script processing fields
          totalSentences: page.properties['🔒 Total Sentences']?.number || 0,
          completedSentences: page.properties['🔒 Completed Sentences']?.number || 0,
          thumbnail: page.properties['🔒 Thumbnail']?.url || '',
          thumbnailPrompt: page.properties['🔒 New Thumbnail Prompt']?.rich_text[0]?.text?.content || '',
          scriptStatus: page.properties['🔒 Sentence Status']?.select?.name || '',
          createdTime: page.created_time
        };
      });
    } catch (error) {
      logger.error('Error fetching videos by status:', error);
      throw error;
    }
  }

  // Removed: Sequential VideoID generation - now using Notion's built-in page ID

  // Updated: Use Notion's built-in page ID instead of custom VideoID
  // This method is now a no-op since we use page.id directly
  async getNextVideoId() {
    logger.debug('Using Notion built-in page ID instead of custom VideoID');
    return null; // No longer needed - page ID is generated by Notion
  }

  async addVideoUrl(url) {
    try {
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

      logger.info(`Added new YouTube URL to Notion: ${url} with page ID: ${response.id}`);
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
   * Extracts clean script text suitable for voice generation
   * Removes headings, formatting, stage directions, speaker labels, and other non-speech elements
   * Specifically removes **Host:** prefixes and similar speaker markers for clean voice output
   * @param {string} scriptText - Original formatted script text
   * @returns {string} - Clean text ready for voice generation
   */
  extractCleanScriptText(scriptText) {
    if (!scriptText) {
      return '';
    }

    let cleanText = scriptText;

    // Remove ALL stage directions in brackets: [intro], [music plays], [conclusion], etc.
    cleanText = cleanText.replace(/\[[\s\S]*?\]/g, '');
    
    // Remove stage directions in parentheses: (music fades), (dramatic pause), etc.
    cleanText = cleanText.replace(/\([\s\S]*?\)/g, '');
    
    // Remove common markdown-style headings
    cleanText = cleanText.replace(/^#{1,6}\s+.*/gm, '');
    
    // Remove common heading patterns like "Introduction:", "Main Point:", etc.
    cleanText = cleanText.replace(/^[A-Za-z\s]+:\s*$/gm, '');
    
    // Remove lines that are just formatting or section dividers
    cleanText = cleanText.replace(/^[-=_*]{3,}.*$/gm, '');
    
    // Remove bullet points and numbered lists formatting (keep content)
    cleanText = cleanText.replace(/^[\s]*[-*•]\s+/gm, '');
    cleanText = cleanText.replace(/^[\s]*\d+\.\s+/gm, '');
    
    // Remove **Host:** and similar speaker labels (for voice generation)
    cleanText = cleanText.replace(/\*\*\s*Host\s*:\s*\*\*/gi, '');
    cleanText = cleanText.replace(/\*\*\s*Narrator\s*:\s*\*\*/gi, '');
    cleanText = cleanText.replace(/\*\*\s*Speaker\s*:\s*\*\*/gi, '');
    
    // Remove other speaker label patterns: **[Name]:**, *[Name]:*, [Name]:
    cleanText = cleanText.replace(/\*\*\s*[A-Za-z\s]+\s*:\s*\*\*/gi, '');  // **Speaker Name:**
    cleanText = cleanText.replace(/\*\s*[A-Za-z\s]+\s*:\s*\*/gi, '');     // *Speaker Name:*
    
    // Remove speaker labels at line start or after periods (but be more specific to avoid removing content)
    cleanText = cleanText.replace(/^(Host|Narrator|Speaker|Interviewer|Guest):\s*/gmi, '');  // At line start
    cleanText = cleanText.replace(/\.\s+(Host|Narrator|Speaker|Interviewer|Guest):\s*/gi, '. ');  // After periods
    
    // Remove common stage direction patterns that might not be in brackets
    cleanText = cleanText.replace(/\b(intro|conclusion|outro|music plays|music fades|dramatic pause|upbeat music|background music|sound effect|voice over|narrator|speaker|cue|fade in|fade out|cut to)\b[\s\S]*?(?=\.|$)/gi, '');
    
    // Remove excessive whitespace and normalize
    cleanText = cleanText.replace(/\n\s*\n\s*\n/g, '\n\n'); // Max 2 consecutive newlines
    cleanText = cleanText.replace(/^\s+/gm, ''); // Remove leading spaces
    cleanText = cleanText.replace(/\s{2,}/g, ' '); // Replace multiple spaces with single space
    cleanText = cleanText.trim();

    // Ensure proper sentence spacing for voice generation
    cleanText = cleanText.replace(/([.!?])\s*([A-Z])/g, '$1 $2');
    
    // Final cleanup: remove any remaining empty lines or orphaned punctuation
    cleanText = cleanText.replace(/^\s*[.,:;!?]\s*$/gm, ''); // Remove lines with only punctuation
    cleanText = cleanText.replace(/\n\s*\n/g, '\n\n'); // Normalize line breaks again
    cleanText = cleanText.trim();
    
    return cleanText;
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

      // Extract clean text for voice generation (remove headings, markdown, etc.)
      const cleanScript = this.extractCleanScriptText(scriptText);
      const cleanScriptChunks = this.splitTextIntoChunks(cleanScript);

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

      // Add paragraph blocks for formatted script
      const contentBlocks = this.createParagraphBlocks(textChunks);

      // Add voice generation section
      const voiceGenerationSection = [
        {
          object: 'block',
          type: 'divider',
          divider: {}
        },
        {
          object: 'block',
          type: 'heading_2',
          heading_2: {
            rich_text: [
              {
                text: {
                  content: '🎤 Voice Generation Script'
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
              emoji: '🔥'
            },
            rich_text: [
              {
                text: {
                  content: 'Clean script text ready for voice generation tools. Simply copy and paste the text below into your preferred voice generation software.'
                }
              }
            ]
          }
        }
      ];

      // Add clean script blocks for voice generation
      const cleanScriptBlocks = this.createParagraphBlocks(cleanScriptChunks);

      const allChildren = [...initialChildren, ...contentBlocks, ...voiceGenerationSection, ...cleanScriptBlocks];

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
   * Fixed: Sequential page creation instead of concurrent to avoid Notion API conflicts
   * Includes retry logic with exponential backoff and proper error handling
   * @param {string} videoPageId - Main video record page ID
   * @param {string} videoTitle - Video title
   * @param {string} originalTranscript - Raw YouTube transcript
   * @param {string} optimizedScript - AI-enhanced script
   * @param {Array} scriptSentences - Breakdown sentences for database
   * @param {Array} imagePrompts - Image prompts for each sentence
   * @param {Array} editorKeywords - Editor keywords for each sentence
   * @returns {Promise<Object>} - Complete structure information
   */
  async createCompleteScriptStructure(videoPageId, videoTitle, originalTranscript, optimizedScript, scriptSentences = [], imagePrompts = [], editorKeywords = []) {
    try {
      logger.info(`Creating complete script structure for video: ${videoTitle}`);

      // Create script sub-pages sequentially to avoid API conflicts
      logger.info('Creating original script page...');
      const originalScriptPage = await this.retryNotionOperation(
        () => this.createOriginalScriptPage(videoPageId, originalTranscript, videoTitle),
        'createOriginalScriptPage'
      );
      
      // Add delay between API calls to avoid rate limiting
      await this.delay(1000);
      
      logger.info('Creating optimized script page...');
      const optimizedScriptPage = await this.retryNotionOperation(
        () => this.createOptimizedScriptPage(videoPageId, optimizedScript, videoTitle),
        'createOptimizedScriptPage'
      );

      // Add delay before creating database
      await this.delay(1000);

      // Create script breakdown database as child if sentences are provided
      let scriptDatabase = null;
      if (scriptSentences.length > 0) {
        logger.info('Creating script breakdown database...');
        const breakdownResult = await this.retryNotionOperation(
          () => this.createScriptBreakdown(videoPageId, scriptSentences, imagePrompts, editorKeywords),
          'createScriptBreakdown'
        );
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
        '🔒 Editor Keywords': {
          rich_text: {}
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

  async createScriptBreakdown(videoPageId, scriptSentences, imagePrompts, editorKeywords = []) {
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
        // Extract prompt string from imagePrompts object (fix for validation error)
        const imagePromptObj = imagePrompts[i] || {};
        const imagePrompt = typeof imagePromptObj === 'string' ? imagePromptObj : (imagePromptObj.prompt || '');
        const editorKeywordText = editorKeywords[i] || '';
        
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
          '🔒 Editor Keywords': {
            rich_text: [
              {
                text: {
                  content: editorKeywordText
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
      
      // Find the detail record for this sentence with retries
      const detailRecord = await this.retryNotionOperation(
        () => this.getVideoDetailBySentence(videoPageId, sentenceNumber),
        `getVideoDetailBySentence_${videoPageId}_${sentenceNumber}`
      );
      
      if (!detailRecord) {
        throw new Error(`Detail record not found for sentence ${sentenceNumber} in video ${videoPageId}`);
      }

      const updateProperties = {
        '🔒 Status': {
          select: {
            name: status
          }
        }
      };

      if (imageUrl) {
        logger.info(`Adding image URL to sentence ${sentenceNumber}: ${imageUrl.substring(0, 50)}...`);
        updateProperties['🔒 Generated Image URL'] = {
          url: imageUrl
        };
      }

      // Update the sentence record with enhanced error handling
      await this.retryNotionOperation(
        () => this.safePageUpdate(detailRecord.id, updateProperties, true, true),
        `updateSentenceStatus_${videoPageId}_${sentenceNumber}`
      );

      // Verify the update was successful if imageUrl was provided
      if (imageUrl) {
        const updatedRecord = await this.getVideoDetailBySentence(videoPageId, sentenceNumber);
        if (updatedRecord && updatedRecord.imageUrl === imageUrl) {
          logger.info(`Successfully verified image URL update for sentence ${sentenceNumber}`);
        } else {
          logger.warn(`Image URL verification failed for sentence ${sentenceNumber}. Expected: ${imageUrl}, Got: ${updatedRecord?.imageUrl || 'null'}`);
        }
      }

      // Update completed count in main video record if status is Complete
      if (status === 'Complete') {
        await this.updateVideoCompletedCount(videoPageId);
      }
      
      logger.info(`Sentence status updated successfully: ${sentenceNumber} -> ${status}`);
      return true;
      
    } catch (error) {
      logger.error(`Error updating sentence status for sentence ${sentenceNumber} in video ${videoPageId}:`, error);
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
        editorKeywords: page.properties['🔒 Editor Keywords']?.rich_text[0]?.text?.content || '',
        status: page.properties['🔒 Status']?.select?.name || 'Pending'
      };
      
    } catch (error) {
      logger.error('Error retrieving video detail by sentence:', error);
      throw error;
    }
  }

  async findScriptDatabaseForVideo(videoPageId) {
    try {
      // Search all databases and filter by parent manually since search API doesn't support parent filtering reliably
      const response = await this.notion.search({
        filter: {
          value: 'database',
          property: 'object'
        },
        page_size: 100
      });

      // Look for databases that are children of our video page
      for (const database of response.results) {
        try {
          // Check if this database has our video page as parent
          if (database.parent && 
              database.parent.type === 'page_id' && 
              database.parent.page_id === videoPageId &&
              database.title && 
              database.title[0]?.text?.content?.toLowerCase().includes('script')) {
            
            logger.info(`Found script database: ${database.id} for video: ${videoPageId}`);
            return database.id;
          }
        } catch (dbError) {
          logger.debug(`Skipping database ${database.id}: ${dbError.message}`);
        }
      }

      logger.warn(`No script database found for video: ${videoPageId}`);
      return null;
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
        editorKeywords: page.properties['🔒 Editor Keywords']?.rich_text[0]?.text?.content || '',
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
   * Uses direct page retrieval when known IDs are provided, otherwise falls back to search
   * @param {string} videoPageId - Main video record page ID
   * @param {Object} knownChildIds - Optional object with known child IDs: { originalScriptId, optimizedScriptId, scriptDatabaseId }
   * @returns {Promise<Object>} - Structure with all children
   */
  async getVideoScriptStructure(videoPageId, knownChildIds = {}) {
    try {
      logger.info(`Retrieving script structure for video: ${videoPageId}`);

      const structure = {
        mainVideoPage: videoPageId,
        children: {
          originalScript: null,
          optimizedScript: null,
          scriptBreakdown: null
        },
        pages: []
      };

      // If we have known child IDs, retrieve them directly (more reliable)
      if (knownChildIds.originalScriptId || knownChildIds.optimizedScriptId || knownChildIds.scriptDatabaseId) {
        logger.info('Using known child IDs for direct retrieval');
        
        const retrievalPromises = [];
        
        if (knownChildIds.originalScriptId) {
          retrievalPromises.push(
            this.notion.pages.retrieve({ page_id: knownChildIds.originalScriptId })
              .then(page => ({ type: 'originalScript', data: page }))
              .catch(error => {
                logger.warn(`Failed to retrieve original script page ${knownChildIds.originalScriptId}:`, error.message);
                return null;
              })
          );
        }
        
        if (knownChildIds.optimizedScriptId) {
          retrievalPromises.push(
            this.notion.pages.retrieve({ page_id: knownChildIds.optimizedScriptId })
              .then(page => ({ type: 'optimizedScript', data: page }))
              .catch(error => {
                logger.warn(`Failed to retrieve optimized script page ${knownChildIds.optimizedScriptId}:`, error.message);
                return null;
              })
          );
        }
        
        if (knownChildIds.scriptDatabaseId) {
          retrievalPromises.push(
            this.notion.databases.retrieve({ database_id: knownChildIds.scriptDatabaseId })
              .then(database => ({ type: 'scriptDatabase', data: database }))
              .catch(error => {
                logger.warn(`Failed to retrieve script database ${knownChildIds.scriptDatabaseId}:`, error.message);
                return null;
              })
          );
        }
        
        const retrievalResults = await Promise.allSettled(retrievalPromises);
        
        for (const result of retrievalResults) {
          if (result.status === 'fulfilled' && result.value) {
            const { type, data } = result.value;
            
            const title = data.properties?.title?.[0]?.text?.content || 
                         data.title?.[0]?.text?.content || 
                         'Untitled';
            
            const childInfo = {
              id: data.id,
              title: title,
              type: data.object, // 'page' or 'database'
              url: data.url,
              created_time: data.created_time,
              last_edited_time: data.last_edited_time
            };
            
            structure.pages.push(childInfo);
            
            if (type === 'originalScript') {
              structure.children.originalScript = childInfo;
            } else if (type === 'optimizedScript') {
              structure.children.optimizedScript = childInfo;
            } else if (type === 'scriptDatabase') {
              structure.children.scriptBreakdown = childInfo;
            }
          }
        }
        
        logger.info(`Retrieved ${structure.pages.length} child items via direct retrieval`);
        return structure;
      }

      // Fallback to search method (less reliable due to indexing delays)
      logger.info('Falling back to search method (may have indexing delays)');
      
      // Search for pages that might be children of this video
      const searchResponse = await this.notion.search({
        query: '',
        filter: {
          value: 'page',
          property: 'object'
        },
        page_size: 100
      });

      // Check each result to see if it's a child of our video page
      for (const result of searchResponse.results) {
        try {
          // Check if this page has our video page as parent
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

      logger.info(`Found ${structure.pages.length} child items for video ${videoPageId} (search method)`);
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
   * @param {Object} knownChildIds - Optional known child IDs for direct verification
   * @returns {Promise<Object>} - Verification result
   */
  async verifyVideoHierarchy(videoPageId, knownChildIds = {}) {
    try {
      const structure = await this.getVideoScriptStructure(videoPageId, knownChildIds);
      
      const verification = {
        isComplete: false,
        hasOriginalScript: !!structure.children.originalScript,
        hasOptimizedScript: !!structure.children.optimizedScript,
        hasScriptBreakdown: !!structure.children.scriptBreakdown,
        totalChildren: structure.pages.length,
        missingComponents: [],
        children: structure.children,
        usedDirectRetrieval: !!(knownChildIds.originalScriptId || knownChildIds.optimizedScriptId || knownChildIds.scriptDatabaseId)
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

      const methodUsed = verification.usedDirectRetrieval ? '(direct retrieval)' : '(search method)';
      logger.info(`Hierarchy verification for ${videoPageId} ${methodUsed}: Complete=${verification.isComplete}, Missing=${verification.missingComponents.join(', ')}`);
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