import { google } from 'googleapis';
import { config } from '../../config/config.js';
import logger from '../utils/logger.js';

class GoogleSheetsService {
  constructor() {
    // Use OAuth JWT for authentication (avoids service account storage quota issue)
    const auth = new google.auth.OAuth2({
      clientId: config.google.clientId,
      clientSecret: config.google.clientSecret,
      redirectUri: config.google.redirectUri
    });

    // Set credentials from stored tokens
    auth.setCredentials({
      access_token: config.google.accessToken,
      refresh_token: config.google.refreshToken
    });

    this.sheets = google.sheets({ version: 'v4', auth });
    this.drive = google.drive({ version: 'v3', auth });
    
    // Master sheet for video tracking
    this.masterSheetId = config.google.masterSheetId;
    
    // Template workbook ID for creating video detail workbooks
    this.templateWorkbookId = config.google.templateWorkbookId;
    
    // Master sheet column mapping (A=0, B=1, etc.)
    this.masterColumns = {
      videoId: 0,           // A: Video ID (VID-XX format)
      youtubeUrl: 1,        // B: YouTube URL
      title: 2,             // C: Title
      status: 3,            // D: Status
      channel: 4,           // E: Channel
      duration: 5,          // F: Duration
      viewCount: 6,         // G: View Count
      publishedDate: 7,     // H: Published Date
      youtubeVideoId: 8,    // I: YouTube Video ID
      optimizedTitle: 9,    // J: Optimized Title
      optimizedDescription: 10, // K: Optimized Description
      keywords: 11,         // L: Keywords
      totalSentences: 12,   // M: Total Sentences
      completedSentences: 13, // N: Completed Sentences
      thumbnailUrls: 14,    // O: Thumbnail URLs
      thumbnailPrompt: 15,  // P: Thumbnail Prompt
      scriptApproved: 16,   // Q: Script Approved (checkbox)
      voiceStatus: 17,      // R: Voice Status (checkbox)
      voiceGenerationStatus: 18, // S: Voice Generation Status
      videoEditingStatus: 19, // T: Video Editing Status
      driveFolder: 20,      // U: Drive Folder Link
      detailWorkbookUrl: 21, // V: Detail Workbook URL
      createdTime: 22,      // W: Created Time
      lastEditedTime: 23    // X: Last Edited Time
    };

    // Detail workbook sheet structure
    this.detailSheets = {
      videoInfo: 'Video Info',
      scriptBreakdown: 'Script Breakdown',
      analytics: 'Analytics'
    };

    // Script breakdown columns
    this.scriptColumns = {
      sentenceNumber: 0,    // A: Sentence Number
      scriptText: 1,        // B: Script Text
      imagePrompt: 2,       // C: Image Prompt
      imageUrl: 3,          // D: Generated Image URL
      editorKeywords: 4,    // E: Editor Keywords
      status: 5,            // F: Status
      wordCount: 6          // G: Word Count
    };
  }

  /**
   * Retry operation with exponential backoff
   */
  async retryOperation(operation, operationName = 'GoogleSheetsOperation', maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        if (attempt === maxRetries) {
          logger.error(`${operationName} failed after ${maxRetries} attempts:`, error);
          throw error;
        }
        
        const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
        logger.warn(`${operationName} attempt ${attempt} failed, retrying in ${delay}ms:`, error.message);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  /**
   * Get next available Video ID (VID-XX format)
   */
  async getNextVideoId() {
    return this.retryOperation(async () => {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.masterSheetId,
        range: 'Videos!A:A'
      });

      const values = response.data.values || [];
      let maxId = 0;

      // Find highest existing VID number
      for (const row of values) {
        if (row[0] && row[0].startsWith('VID-')) {
          const idNumber = parseInt(row[0].replace('VID-', ''));
          if (idNumber > maxId) {
            maxId = idNumber;
          }
        }
      }

      return `VID-${(maxId + 1).toString().padStart(2, '0')}`;
    }, 'getNextVideoId');
  }

  /**
   * Create new video entry in master sheet
   */
  async createVideoEntry(videoData) {
    return this.retryOperation(async () => {
      const videoId = await this.getNextVideoId();
      const timestamp = new Date().toISOString();

      const rowData = new Array(24).fill(''); // Initialize 24 columns
      rowData[this.masterColumns.videoId] = videoId;
      rowData[this.masterColumns.youtubeUrl] = videoData.youtubeUrl;
      rowData[this.masterColumns.title] = videoData.title || '';
      rowData[this.masterColumns.status] = 'New';
      rowData[this.masterColumns.channel] = videoData.channelTitle || '';
      rowData[this.masterColumns.duration] = videoData.duration || '';
      rowData[this.masterColumns.viewCount] = videoData.viewCount || 0;
      rowData[this.masterColumns.publishedDate] = videoData.publishedAt || '';
      rowData[this.masterColumns.youtubeVideoId] = videoData.videoId || '';
      rowData[this.masterColumns.createdTime] = timestamp;
      rowData[this.masterColumns.lastEditedTime] = timestamp;

      await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.masterSheetId,
        range: 'Videos!A:X',
        valueInputOption: 'USER_ENTERED',
        resource: {
          values: [rowData]
        }
      });

      logger.info(`Created video entry: ${videoId} - ${videoData.title}`);
      return videoId;
    }, 'createVideoEntry');
  }

  /**
   * Find video row by Video ID
   */
  async findVideoRow(videoId) {
    return this.retryOperation(async () => {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.masterSheetId,
        range: 'Videos!A:X'
      });

      const values = response.data.values || [];
      for (let i = 0; i < values.length; i++) {
        if (values[i][this.masterColumns.videoId] === videoId) {
          return {
            rowIndex: i + 1, // 1-based for Google Sheets
            data: values[i]
          };
        }
      }
      return null;
    }, 'findVideoRow');
  }

  /**
   * Update video status
   */
  async updateVideoStatus(videoId, status, additionalData = {}) {
    return this.retryOperation(async () => {
      const videoRow = await this.findVideoRow(videoId);
      if (!videoRow) {
        throw new Error(`Video not found: ${videoId}`);
      }

      const updates = [];
      const timestamp = new Date().toISOString();

      // Update status
      updates.push({
        range: `Videos!D${videoRow.rowIndex}`,
        values: [[status]]
      });

      // Update last edited time
      updates.push({
        range: `Videos!X${videoRow.rowIndex}`,
        values: [[timestamp]]
      });

      // Add any additional data updates
      for (const [field, value] of Object.entries(additionalData)) {
        if (this.masterColumns[field] !== undefined) {
          const column = String.fromCharCode(65 + this.masterColumns[field]); // Convert to A, B, C...
          updates.push({
            range: `Videos!${column}${videoRow.rowIndex}`,
            values: [[value]]
          });
        }
      }

      await this.sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: this.masterSheetId,
        resource: {
          valueInputOption: 'USER_ENTERED',
          data: updates
        }
      });

      logger.info(`Updated video ${videoId} status to: ${status}`);
      return true;
    }, 'updateVideoStatus');
  }

  /**
   * Get videos by status
   */
  async getVideosByStatus(status) {
    return this.retryOperation(async () => {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.masterSheetId,
        range: 'Videos!A:X'
      });

      const values = response.data.values || [];
      const videos = [];

      for (const row of values) {
        if (row[this.masterColumns.status] === status) {
          videos.push({
            videoId: row[this.masterColumns.videoId],
            title: row[this.masterColumns.title],
            youtubeUrl: row[this.masterColumns.youtubeUrl],
            status: row[this.masterColumns.status],
            detailWorkbookUrl: row[this.masterColumns.detailWorkbookUrl]
          });
        }
      }

      return videos;
    }, 'getVideosByStatus');
  }

  /**
   * Create detail workbook for video from template
   */
  async createVideoDetailWorkbook(videoId, videoTitle) {
    return this.retryOperation(async () => {
      // Copy template workbook
      const copyResponse = await this.drive.files.copy({
        fileId: this.templateWorkbookId,
        resource: {
          name: `${videoTitle} (${videoId}) - Video Details`
        }
      });

      const workbookId = copyResponse.data.id;
      const workbookUrl = `https://docs.google.com/spreadsheets/d/${workbookId}`;

      // Update master sheet with workbook URL
      await this.updateVideoStatus(videoId, null, {
        detailWorkbookUrl: workbookUrl
      });

      logger.info(`Created detail workbook for ${videoId}: ${workbookUrl}`);
      return {
        workbookId,
        workbookUrl
      };
    }, 'createVideoDetailWorkbook');
  }

  /**
   * Create script breakdown in detail workbook
   */
  async createScriptBreakdown(videoId, scriptSentences, imagePrompts, editorKeywords = []) {
    return this.retryOperation(async () => {
      const videoRow = await this.findVideoRow(videoId);
      if (!videoRow || !videoRow.data[this.masterColumns.detailWorkbookUrl]) {
        throw new Error(`Detail workbook not found for video: ${videoId}`);
      }

      const workbookUrl = videoRow.data[this.masterColumns.detailWorkbookUrl];
      const workbookId = workbookUrl.split('/d/')[1].split('/')[0];

      // Prepare script breakdown data
      const breakdownData = [];
      for (let i = 0; i < scriptSentences.length; i++) {
        const row = new Array(7).fill(''); // Initialize 7 columns
        row[this.scriptColumns.sentenceNumber] = i + 1;
        row[this.scriptColumns.scriptText] = scriptSentences[i];
        row[this.scriptColumns.imagePrompt] = imagePrompts[i] || '';
        row[this.scriptColumns.editorKeywords] = editorKeywords[i] || '';
        row[this.scriptColumns.status] = 'Pending';
        row[this.scriptColumns.wordCount] = `=LEN(TRIM(B${i + 2}))-LEN(SUBSTITUTE(TRIM(B${i + 2})," ",""))+1`; // Word count formula
        breakdownData.push(row);
      }

      // Update script breakdown sheet
      await this.sheets.spreadsheets.values.update({
        spreadsheetId: workbookId,
        range: `${this.detailSheets.scriptBreakdown}!A2:G${breakdownData.length + 1}`,
        valueInputOption: 'USER_ENTERED',
        resource: {
          values: breakdownData
        }
      });

      // Update master sheet with total sentences
      await this.updateVideoStatus(videoId, null, {
        totalSentences: scriptSentences.length,
        completedSentences: 0
      });

      logger.info(`Created script breakdown for ${videoId}: ${scriptSentences.length} sentences`);
      return workbookId;
    }, 'createScriptBreakdown');
  }

  /**
   * Update sentence with generated image
   */
  async updateSentenceStatus(videoId, sentenceNumber, status, imageUrl = null) {
    return this.retryOperation(async () => {
      const videoRow = await this.findVideoRow(videoId);
      if (!videoRow || !videoRow.data[this.masterColumns.detailWorkbookUrl]) {
        throw new Error(`Detail workbook not found for video: ${videoId}`);
      }

      const workbookUrl = videoRow.data[this.masterColumns.detailWorkbookUrl];
      const workbookId = workbookUrl.split('/d/')[1].split('/')[0];

      const updates = [];
      const rowIndex = sentenceNumber + 1; // +1 because row 1 is header

      // Update status
      updates.push({
        range: `${this.detailSheets.scriptBreakdown}!F${rowIndex}`,
        values: [[status]]
      });

      // Update image URL if provided
      if (imageUrl) {
        updates.push({
          range: `${this.detailSheets.scriptBreakdown}!D${rowIndex}`,
          values: [[imageUrl]]
        });
      }

      await this.sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: workbookId,
        resource: {
          valueInputOption: 'USER_ENTERED',
          data: updates
        }
      });

      // Update completed count in master sheet if status is complete
      if (status === 'Complete') {
        await this.updateCompletedCount(videoId);
      }

      return true;
    }, 'updateSentenceStatus');
  }

  /**
   * Update completed sentences count
   */
  async updateCompletedCount(videoId) {
    return this.retryOperation(async () => {
      const videoRow = await this.findVideoRow(videoId);
      if (!videoRow || !videoRow.data[this.masterColumns.detailWorkbookUrl]) {
        return;
      }

      const workbookUrl = videoRow.data[this.masterColumns.detailWorkbookUrl];
      const workbookId = workbookUrl.split('/d/')[1].split('/')[0];

      // Get all sentences status
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: workbookId,
        range: `${this.detailSheets.scriptBreakdown}!F:F`
      });

      const statusValues = response.data.values || [];
      const completedCount = statusValues.filter(row => row[0] === 'Complete').length;

      // Update master sheet
      await this.updateVideoStatus(videoId, null, {
        completedSentences: completedCount
      });

      return completedCount;
    }, 'updateCompletedCount');
  }

  /**
   * Get video details by ID
   */
  async getVideoDetails(videoId) {
    return this.retryOperation(async () => {
      const videoRow = await this.findVideoRow(videoId);
      if (!videoRow) {
        return null;
      }

      const data = videoRow.data;
      return {
        id: data[this.masterColumns.videoId],
        title: data[this.masterColumns.title],
        youtubeUrl: data[this.masterColumns.youtubeUrl],
        status: data[this.masterColumns.status],
        channel: data[this.masterColumns.channel],
        duration: data[this.masterColumns.duration],
        viewCount: parseInt(data[this.masterColumns.viewCount]) || 0,
        publishedDate: data[this.masterColumns.publishedDate],
        youtubeVideoId: data[this.masterColumns.youtubeVideoId],
        optimizedTitle: data[this.masterColumns.optimizedTitle],
        optimizedDescription: data[this.masterColumns.optimizedDescription],
        keywords: data[this.masterColumns.keywords],
        totalSentences: parseInt(data[this.masterColumns.totalSentences]) || 0,
        completedSentences: parseInt(data[this.masterColumns.completedSentences]) || 0,
        thumbnailUrls: data[this.masterColumns.thumbnailUrls],
        thumbnailPrompt: data[this.masterColumns.thumbnailPrompt],
        scriptApproved: data[this.masterColumns.scriptApproved] === 'TRUE',
        voiceStatus: data[this.masterColumns.voiceStatus] === 'TRUE',
        voiceGenerationStatus: data[this.masterColumns.voiceGenerationStatus],
        videoEditingStatus: data[this.masterColumns.videoEditingStatus],
        driveFolder: data[this.masterColumns.driveFolder],
        detailWorkbookUrl: data[this.masterColumns.detailWorkbookUrl],
        createdTime: data[this.masterColumns.createdTime],
        lastEditedTime: data[this.masterColumns.lastEditedTime]
      };
    }, 'getVideoDetails');
  }

  /**
   * Approve script (set checkbox to true)
   */
  async approveScript(videoId) {
    return this.retryOperation(async () => {
      await this.updateVideoStatus(videoId, 'Approved', {
        scriptApproved: 'TRUE'
      });
      logger.info(`Approved script for video: ${videoId}`);
      return true;
    }, 'approveScript');
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      await this.retryOperation(async () => {
        const response = await this.sheets.spreadsheets.get({
          spreadsheetId: this.masterSheetId
        });
        return response.data;
      }, 'healthCheck');
      
      return { status: 'healthy', service: 'GoogleSheets' };
    } catch (error) {
      return { status: 'unhealthy', service: 'GoogleSheets', error: error.message };
    }
  }
}

export default GoogleSheetsService;