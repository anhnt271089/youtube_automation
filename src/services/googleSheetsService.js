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
    
    // Master sheet column mapping (A=0, B=1, etc.) - Fixed voice status conflict
    this.masterColumns = {
      videoId: 0,           // A: 🤖 Auto: Video ID (VID-XXXX format)
      youtubeUrl: 1,        // B: 🔧 Input: YouTube URL
      title: 2,             // C: 🤖 Auto: Title
      status: 3,            // D: 🤖 Auto: Status
      channel: 4,           // E: 🤖 Auto: Channel
      duration: 5,          // F: 🤖 Auto: Duration
      viewCount: 6,         // G: 🤖 Auto: View Count
      publishedDate: 7,     // H: 🤖 Auto: Published Date
      youtubeVideoId: 8,    // I: 🤖 Auto: YouTube Video ID
      scriptApproved: 9,    // J: 👤 Manual: Script Approved (dropdown: 'Pending', 'Approved', 'Needs Changes')
      voiceGenerationStatus: 10, // K: 👤 Manual: Voice Generation Status
      videoEditingStatus: 11, // L: 👤 Manual: Video Editing Status
      driveFolder: 12,      // M: 🤖 Auto: Drive Folder Link
      detailWorkbookUrl: 13, // N: 🤖 Auto: Detail Workbook URL
      createdTime: 14,      // O: 🤖 Auto: Created Time
      lastEditedTime: 15    // P: 🤖 Auto: Last Edited Time
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
   * Get next available Video ID (VID-XXXX format)
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

      return `VID-${(maxId + 1).toString().padStart(4, '0')}`;
    }, 'getNextVideoId');
  }

  /**
   * Create new video entry in master sheet
   */
  async createVideoEntry(videoData) {
    return this.retryOperation(async () => {
      const videoId = await this.getNextVideoId();
      const timestamp = new Date().toISOString();

      const rowData = new Array(16).fill(''); // Initialize 16 columns (A-P)
      rowData[this.masterColumns.videoId] = videoId;
      rowData[this.masterColumns.youtubeUrl] = videoData.youtubeUrl;
      rowData[this.masterColumns.title] = videoData.title || '';
      rowData[this.masterColumns.status] = 'New';
      rowData[this.masterColumns.channel] = videoData.channelTitle || '';
      rowData[this.masterColumns.duration] = videoData.duration || '';
      rowData[this.masterColumns.viewCount] = videoData.viewCount || 0;
      rowData[this.masterColumns.publishedDate] = videoData.publishedAt || '';
      rowData[this.masterColumns.youtubeVideoId] = videoData.videoId || '';
      rowData[this.masterColumns.scriptApproved] = 'Pending'; // Default to Pending instead of checkbox
      rowData[this.masterColumns.createdTime] = timestamp;
      rowData[this.masterColumns.lastEditedTime] = timestamp;

      await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.masterSheetId,
        range: 'Videos!A:P', // Updated to P column (16 columns)
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
        range: 'Videos!A:P' // Updated to P column
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
        range: `Videos!P${videoRow.rowIndex}`, // Updated to P column
        values: [[timestamp]]
      });

      // Add any additional data updates
      for (const [field, value] of Object.entries(additionalData)) {
        if (this.masterColumns[field] !== undefined) {
          const column = String.fromCharCode(65 + this.masterColumns[field]); // Convert to A, B, C...
          
          // Convert arrays to comma-separated strings for Google Sheets compatibility
          let processedValue = value;
          if (Array.isArray(value)) {
            processedValue = value.join(', ');
          }
          
          updates.push({
            range: `Videos!${column}${videoRow.rowIndex}`,
            values: [[processedValue]]
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
        range: 'Videos!A:P' // Updated to P column
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
      // Create individual video folder inside the root folder
      const folderName = `(${videoId}) ${videoTitle}`;
      const folderResponse = await this.drive.files.create({
        resource: {
          name: folderName,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [config.google.videosRootFolderId]
        }
      });

      const folderId = folderResponse.data.id;
      const folderUrl = `https://drive.google.com/drive/folders/${folderId}`;
      logger.info(`Created video folder: ${folderName} - ${folderUrl}`);

      // Copy template workbook with new naming format
      const workbookName = `(${videoId}) ${videoTitle} - Video Detail`;
      const copyResponse = await this.drive.files.copy({
        fileId: this.templateWorkbookId,
        resource: {
          name: workbookName,
          parents: [folderId] // Place workbook inside the video folder
        }
      });

      const workbookId = copyResponse.data.id;
      const workbookUrl = `https://docs.google.com/spreadsheets/d/${workbookId}`;

      // Update master sheet with both workbook and folder URLs
      await this.updateVideoStatus(videoId, null, {
        detailWorkbookUrl: workbookUrl,
        driveFolder: folderUrl
      });

      logger.info(`Created detail workbook for ${videoId}: ${workbookUrl}`);
      logger.info(`Workbook placed in folder: ${folderUrl}`);
      
      return {
        workbookId,
        workbookUrl,
        folderId,
        folderUrl
      };
    }, 'createVideoDetailWorkbook');
  }

  /**
   * Populate Video Info sheet in detail workbook with metadata and optimized content
   */
  async populateVideoInfoSheet(videoId, videoData, enhancedContent) {
    return this.retryOperation(async () => {
      const videoRow = await this.findVideoRow(videoId);
      if (!videoRow || !videoRow.data[this.masterColumns.detailWorkbookUrl]) {
        throw new Error(`Detail workbook not found for video: ${videoId}`);
      }

      const workbookUrl = videoRow.data[this.masterColumns.detailWorkbookUrl];
      const workbookId = workbookUrl.split('/d/')[1].split('/')[0];

      // Prepare video info data for the Video Info sheet
      const videoInfoData = [
        ['Video Title', videoData.title],
        ['YouTube URL', videoData.youtubeUrl || ''],
        ['YouTube Video ID', videoData.videoId || videoData.id],
        ['Channel', videoData.channelTitle || ''],
        ['Duration', videoData.duration || ''],
        ['View Count', videoData.viewCount || ''],
        ['Published Date', videoData.publishedAt || ''],
        ['', ''], // Empty row
        ['Script Style', enhancedContent.videoStyle?.style || ''],
        ['Processing Date', new Date().toISOString()]
      ];

      // Update Video Info sheet
      await this.sheets.spreadsheets.values.update({
        spreadsheetId: workbookId,
        range: `${this.detailSheets.videoInfo}!A1:B${videoInfoData.length}`,
        valueInputOption: 'USER_ENTERED',
        resource: {
          values: videoInfoData
        }
      });

      // Also add full scripts to separate areas with detailed sections
      const fullScriptData = [];
      if (enhancedContent.attractiveScript) {
        // Video Editor Section
        fullScriptData.push(['', '']); // Empty row for spacing
        fullScriptData.push(['FULL SCRIPT FOR VIDEO EDITOR', '']);
        fullScriptData.push(['Instructions:', 'Use this optimized script for video editing. Match visuals to each segment.']);
        fullScriptData.push(['Script Length:', `${enhancedContent.scriptSentences ? enhancedContent.scriptSentences.length : 'N/A'} sentences`]);
        fullScriptData.push(['Estimated Duration:', '2-3 minutes']);
        fullScriptData.push(['', '']); // Empty row
        fullScriptData.push(['OPTIMIZED SCRIPT:', enhancedContent.attractiveScript]);
        
        // Voice Generator Section
        fullScriptData.push(['', '']); // Empty row for spacing
        fullScriptData.push(['', '']); // Extra spacing
        fullScriptData.push(['SCRIPT FOR VOICE GENERATOR', '']);
        fullScriptData.push(['Instructions:', 'Clean transcript only - no music, no timestamps, no voiceover instructions']);
        fullScriptData.push(['Voice Style:', 'Conversational, engaging, clear pronunciation']);
        fullScriptData.push(['Pacing:', 'Natural speech speed with pauses for emphasis']);
        fullScriptData.push(['', '']); // Empty row
        fullScriptData.push(['CLEAN VOICE SCRIPT:', enhancedContent.attractiveScript]);
      }

      if (fullScriptData.length > 0) {
        await this.sheets.spreadsheets.values.update({
          spreadsheetId: workbookId,
          range: `${this.detailSheets.videoInfo}!A${videoInfoData.length + 2}:B${videoInfoData.length + 2 + fullScriptData.length}`,
          valueInputOption: 'USER_ENTERED',
          resource: {
            values: fullScriptData
          }
        });
      }

      logger.info(`Populated Video Info sheet for ${videoId}`);
      return workbookId;
    }, 'populateVideoInfoSheet');
  }

  /**
   * Update Analytics sheet in detail workbook
   */
  async updateAnalyticsSheet(videoId, videoData) {
    return this.retryOperation(async () => {
      const videoRow = await this.findVideoRow(videoId);
      if (!videoRow || !videoRow.data[this.masterColumns.detailWorkbookUrl]) {
        throw new Error(`Detail workbook not found for video: ${videoId}`);
      }

      const workbookUrl = videoRow.data[this.masterColumns.detailWorkbookUrl];
      const workbookId = workbookUrl.split('/d/')[1].split('/')[0];

      const analyticsData = [
        ['Metric', 'Value', 'Date'],
        ['View Count', videoData.viewCount || 0, videoData.publishedAt || new Date().toISOString()],
        ['Duration', videoData.duration || 'N/A', ''],
        ['Channel', videoData.channelTitle || 'N/A', ''],
        ['Category', videoData.category || 'N/A', ''],
        ['Language', videoData.language || 'N/A', ''],
        ['Processing Cost', '$0.00', new Date().toISOString()],
        ['Generated Images', '0 (Image generation disabled)', new Date().toISOString()]
      ];

      await this.sheets.spreadsheets.values.update({
        spreadsheetId: workbookId,
        range: `${this.detailSheets.analytics}!A1:C${analyticsData.length}`,
        valueInputOption: 'USER_ENTERED',
        resource: {
          values: analyticsData
        }
      });

      logger.info(`Updated Analytics sheet for ${videoId}`);
      return workbookId;
    }, 'updateAnalyticsSheet');
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
        
        // Ensure full script text is preserved (Google Sheets supports up to 50,000 characters per cell)
        const fullScriptText = scriptSentences[i] ? scriptSentences[i].toString().trim() : '';
        row[this.scriptColumns.scriptText] = fullScriptText;
        
        // Extract image prompt text properly (handle both string and object formats)
        let fullImagePrompt = '';
        if (imagePrompts[i]) {
          if (typeof imagePrompts[i] === 'string') {
            fullImagePrompt = imagePrompts[i].trim();
          } else if (imagePrompts[i].prompt) {
            fullImagePrompt = imagePrompts[i].prompt.trim();
          } else if (imagePrompts[i].toString) {
            fullImagePrompt = imagePrompts[i].toString().trim();
          }
        }
        row[this.scriptColumns.imagePrompt] = fullImagePrompt;
        
        // Ensure editor keywords are preserved
        const fullKeywords = editorKeywords[i] ? editorKeywords[i].toString().trim() : '';
        row[this.scriptColumns.editorKeywords] = fullKeywords;
        
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

      // Note: totalSentences and completedSentences removed as they are no longer used

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

      // Note: completedSentences removed as it's no longer used in master sheet

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
        scriptApproved: data[this.masterColumns.scriptApproved], // Now a dropdown value
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
   * Approve script (set dropdown to 'Approved')
   */
  async approveScript(videoId) {
    return this.retryOperation(async () => {
      await this.updateVideoStatus(videoId, 'Approved', {
        scriptApproved: 'Approved'
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