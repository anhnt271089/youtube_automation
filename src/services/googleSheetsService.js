import { google } from 'googleapis';
import { config } from '../../config/config.js';
import logger from '../utils/logger.js';
import GoogleDriveService from './googleDriveService.js';
import AIService from './aiService.js';

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
    this.driveService = new GoogleDriveService();
    this.aiService = new AIService();
    
    // Master sheet for video tracking
    this.masterSheetId = config.google.masterSheetId;
    
    // Template workbook ID for creating video detail workbooks
    this.templateWorkbookId = config.google.templateWorkbookId;
    
    // Master sheet column mapping (A=0, B=1, etc.) - Simplified icon-only headers
    this.masterColumns = {
      videoId: 0,           // A: 🤖 Video ID (VID-XXXX format)
      youtubeUrl: 1,        // B: 🔧 YouTube URL
      status: 2,            // C: 🤖 Status
      title: 3,             // D: 🤖 Title
      channel: 4,           // E: 🤖 Channel
      duration: 5,          // F: 🤖 Duration
      viewCount: 6,         // G: 🤖 View Count
      publishedDate: 7,     // H: 🤖 Published Date
      youtubeVideoId: 8,    // I: 🤖 YouTube Video ID
      scriptApproved: 9,    // J: 👤 Script Approved (dropdown: 'Pending', 'Approved', 'Needs Changes')
      voiceGenerationStatus: 10, // K: 👤 Voice Generation Status
      videoEditingStatus: 11, // L: 👤 Video Editing Status
      driveFolder: 12,      // M: 🤖 Drive Folder Link
      detailWorkbookUrl: 13, // N: 🤖 Detail Workbook URL
      createdTime: 14,      // O: 🤖 Created Time
      lastEditedTime: 15,   // P: 🤖 Last Edited Time
      isRegenerating: 16    // Q: 🤖 Is Regenerating Flag (internal use)
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
      rowData[this.masterColumns.title] = videoData.title || 'YouTube API Error - Run fix-missing-titles.js';
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
        range: `Videos!C${videoRow.rowIndex}`,
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
   * Update a specific field for a video
   */
  async updateVideoField(videoId, fieldName, value) {
    return this.retryOperation(async () => {
      const videoRow = await this.findVideoRow(videoId);
      if (!videoRow) {
        throw new Error(`Video not found: ${videoId}`);
      }

      if (this.masterColumns[fieldName] === undefined) {
        throw new Error(`Unknown field: ${fieldName}`);
      }

      const column = String.fromCharCode(65 + this.masterColumns[fieldName]); // Convert to A, B, C...
      const timestamp = new Date().toISOString();

      const updates = [
        // Update the specified field
        {
          range: `Videos!${column}${videoRow.rowIndex}`,
          values: [[value]]
        },
        // Update last edited time
        {
          range: `Videos!P${videoRow.rowIndex}`, // P column for lastEditedTime
          values: [[timestamp]]
        }
      ];

      await this.sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: this.masterSheetId,
        resource: {
          valueInputOption: 'USER_ENTERED',
          data: updates
        }
      });

      logger.info(`Updated video ${videoId} field ${fieldName} to: ${value}`);
      return true;
    }, 'updateVideoField');
  }

  /**
   * Get existing script content from Video Info sheet
   */
  async getExistingScriptContent(videoId) {
    return this.retryOperation(async () => {
      const videoRow = await this.findVideoRow(videoId);
      if (!videoRow || !videoRow.data[this.masterColumns.detailWorkbookUrl]) {
        throw new Error(`Detail workbook not found for video: ${videoId}`);
      }

      const workbookUrl = videoRow.data[this.masterColumns.detailWorkbookUrl];
      const workbookId = workbookUrl.split('/d/')[1].split('/')[0];

      try {
        // Get Video Info sheet content
        const response = await this.sheets.spreadsheets.values.get({
          spreadsheetId: workbookId,
          range: `${this.detailSheets.videoInfo}!A1:B20` // Get first 20 rows
        });

        const values = response.data.values || [];
        let cleanVoiceScript = '';

        // Find the CLEAN VOICE SCRIPT row
        for (let i = 0; i < values.length; i++) {
          if (values[i][0] === 'CLEAN VOICE SCRIPT' && values[i][1]) {
            cleanVoiceScript = values[i][1];
            break;
          }
        }

        return {
          cleanVoiceScript: cleanVoiceScript,
          workbookId: workbookId
        };
      } catch (error) {
        logger.warn(`Failed to get existing script content for ${videoId}:`, error.message);
        return null;
      }
    }, 'getExistingScriptContent');
  }

  /**
   * Create backup voice script file in Google Drive
   */
  async createBackupVoiceScript(videoId, backupFileName, scriptContent) {
    return this.retryOperation(async () => {
      const videoRow = await this.findVideoRow(videoId);
      if (!videoRow || !videoRow.data[this.masterColumns.driveFolder]) {
        throw new Error(`Drive folder not found for video: ${videoId}`);
      }

      // Get video title for header
      const videoTitle = videoRow.data[this.masterColumns.title] || 'Unknown Title';
      
      // Extract folder ID from folder URL
      const folderUrl = videoRow.data[this.masterColumns.driveFolder];
      const folderId = folderUrl.split('/folders/')[1];
      
      // Create the backup file content with header
      const timestamp = new Date().toISOString();
      const fileContent = `BACKUP - Voice Script for ${videoTitle}
Generated: ${timestamp}
Video ID: ${videoId}
Reason: Script regeneration requested

========================================

${scriptContent}

========================================
END OF BACKUP - Original script preserved before regeneration`;

      // Create a readable stream from the content
      const { Readable } = await import('stream');
      const stream = new Readable();
      stream.push(fileContent);
      stream.push(null); // End the stream

      // Upload to Google Drive in the video's folder
      const uploadResult = await this.driveService.uploadFile(
        stream,
        backupFileName,
        folderId,
        'text/plain'
      );

      logger.info(`Backup voice script uploaded for ${videoId}: ${backupFileName}`);
      
      return {
        fileName: backupFileName,
        fileId: uploadResult.id,
        fileUrl: uploadResult.webViewLink
      };
    }, 'createBackupVoiceScript');
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
      const folderName = `(${videoId}) ${videoTitle}`;
      let folderId;
      let folderUrl;
      
      // Check if folder already exists
      const existingFolders = await this.drive.files.list({
        q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and parents in '${config.google.videosRootFolderId}' and trashed=false`,
        fields: 'files(id, name, webViewLink)'
      });

      if (existingFolders.data.files.length > 0) {
        // Use existing folder
        folderId = existingFolders.data.files[0].id;
        folderUrl = `https://drive.google.com/drive/folders/${folderId}`;
        logger.info(`Using existing video folder: ${folderName} - ${folderUrl}`);
      } else {
        // Create new folder
        const folderResponse = await this.drive.files.create({
          resource: {
            name: folderName,
            mimeType: 'application/vnd.google-apps.folder',
            parents: [config.google.videosRootFolderId]
          }
        });

        folderId = folderResponse.data.id;
        folderUrl = `https://drive.google.com/drive/folders/${folderId}`;
        logger.info(`Created video folder: ${folderName} - ${folderUrl}`);
      }

      // Check for existing workbook before creating new one
      const workbookName = `(${videoId}) ${videoTitle} - Video Detail`;

      const existingWorkbooks = await this.drive.files.list({
        q: `name='${workbookName}' and parents in '${folderId}' and trashed=false and mimeType='application/vnd.google-apps.spreadsheet'`,
        fields: 'files(id, name, webViewLink)'
      });

      let workbookId;
      let workbookUrl;

      if (existingWorkbooks.data.files.length > 0) {
        // Use existing workbook
        const existingWorkbook = existingWorkbooks.data.files[0];
        workbookId = existingWorkbook.id;
        workbookUrl = `https://docs.google.com/spreadsheets/d/${workbookId}`;
        
        logger.info(`Using existing detail workbook for ${videoId}: ${workbookName}`);
      } else {
        // Copy template workbook with new naming format
        const copyResponse = await this.drive.files.copy({
          fileId: this.templateWorkbookId,
          resource: {
            name: workbookName,
            parents: [folderId] // Place workbook inside the video folder
          }
        });

        workbookId = copyResponse.data.id;
        workbookUrl = `https://docs.google.com/spreadsheets/d/${workbookId}`;
        
        logger.info(`Created new detail workbook for ${videoId}: ${workbookName}`);
      }

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

      // Extract clean voice script from script breakdown
      const scriptSentences = await this.extractCleanVoiceScript(videoId);
      
      // Convert sentences array to formatted string for Google Sheets display
      const cleanVoiceScript = scriptSentences && scriptSentences.length > 0 
        ? scriptSentences.map(sentence => sentence.trim()).join('\n\n')
        : (enhancedContent.attractiveScript || '');

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
        ['Processing Date', new Date().toISOString()],
        ['', ''], // Empty row
        ['CLEAN VOICE SCRIPT', cleanVoiceScript + '\n\n(Use this clean version for voice generation - no editing instructions)']
      ];

      // Add enhanced keyword research data if available
      if (enhancedContent.keywords) {
        const keywords = enhancedContent.keywords;
        
        videoInfoData.push(['', '']); // Empty row
        videoInfoData.push(['🎯 ENHANCED KEYWORD STRATEGY', '']);
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

      // Add optimized title options if available
      if (enhancedContent.optimizedTitles && enhancedContent.optimizedTitles.options) {
        videoInfoData.push(['', '']); // Empty row
        videoInfoData.push(['OPTIMIZED TITLE OPTIONS', 'Click-Through Rate Optimized Titles']);
        videoInfoData.push(['', '']); // Empty row
        videoInfoData.push(['Recommended Title:', enhancedContent.optimizedTitles.recommended || '']);
        videoInfoData.push(['', '']); // Empty row separator
        enhancedContent.optimizedTitles.options.forEach((title, index) => {
          videoInfoData.push([`Title Option ${index + 1}`, title || '']);
        });
      }

      // Generate thumbnail suggestions
      try {
        const thumbnailSuggestions = await this.aiService.generateThumbnailSuggestions(
          videoData, 
          enhancedContent.attractiveScript
        );
        
        videoInfoData.push(['', '']); // Empty row
        videoInfoData.push(['THUMBNAIL DESIGN SUGGESTIONS', '']);
        videoInfoData.push(['2 Different Styles for Maximum Impact:', '']);
        videoInfoData.push(['', '']); // Empty row
        videoInfoData.push(['Thumbnail Concepts:', thumbnailSuggestions || 'Unable to generate thumbnail suggestions']);
      } catch (error) {
        logger.warn(`Failed to generate thumbnail suggestions for ${videoId}:`, error.message);
        videoInfoData.push(['', '']); // Empty row
        videoInfoData.push(['THUMBNAIL DESIGN SUGGESTIONS', '']);
        videoInfoData.push(['Error:', 'Unable to generate thumbnail suggestions. Please create thumbnails manually.']);
        videoInfoData.push(['Style 1:', 'Emotional/Dramatic - Use bright colors, close-up faces, and emotional expressions']);
        videoInfoData.push(['Style 2:', 'Professional/Clean - Use minimal design, clear typography, and visual metaphors']);
      }

      // Update Video Info sheet
      await this.sheets.spreadsheets.values.update({
        spreadsheetId: workbookId,
        range: `${this.detailSheets.videoInfo}!A1:B${videoInfoData.length}`,
        valueInputOption: 'USER_ENTERED',
        resource: {
          values: videoInfoData
        }
      });

      // Create and upload voice script file to Google Drive
      try {
        // Check if this video is being regenerated (force recreate voice script)
        const isRegenerating = videoRow.data[this.masterColumns.isRegenerating] === 'true';
        const voiceScriptFile = await this.createAndUploadVoiceScript(videoId, isRegenerating);
        
        if (voiceScriptFile) {
          if (voiceScriptFile.skipped) {
            logger.info(`Voice script already exists for ${videoId}: ${voiceScriptFile.fileName} (skipped duplicate creation)`);
          } else {
            logger.info(`Voice script file created for ${videoId}: ${voiceScriptFile.fileName}`);
          }
        }
        
        // Clear regeneration flag after successful voice script creation
        if (isRegenerating) {
          await this.updateVideoField(videoId, 'isRegenerating', '');
          logger.info(`${videoId}: Regeneration flag cleared after voice script recreation`);
        }
      } catch (error) {
        logger.warn(`Failed to create voice script file for ${videoId}:`, error.message);
      }

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
        
        // Voice Generator Section - Script text removed, available in separate file
        fullScriptData.push(['', '']); // Empty row for spacing
        fullScriptData.push(['', '']); // Extra spacing
        fullScriptData.push(['SCRIPT FOR VOICE GENERATOR', '']);
        fullScriptData.push(['Instructions:', 'Voice script available as separate .txt file in Drive folder']);
        fullScriptData.push(['File Location:', 'Check Drive folder for voice_script.txt file']);
        fullScriptData.push(['Voice Style:', 'Conversational, engaging, clear pronunciation']);
        fullScriptData.push(['Pacing:', 'Natural speech speed with pauses for emphasis']);
        // Voice Script Text removed - available as separate file
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
   * Extract clean voice script from script breakdown sentences
   */
  async extractCleanVoiceScript(videoId) {
    return this.retryOperation(async () => {
      const videoRow = await this.findVideoRow(videoId);
      if (!videoRow || !videoRow.data[this.masterColumns.detailWorkbookUrl]) {
        logger.warn(`Detail workbook not found for video: ${videoId}`);
        return null;
      }

      const workbookUrl = videoRow.data[this.masterColumns.detailWorkbookUrl];
      const workbookId = workbookUrl.split('/d/')[1].split('/')[0];

      try {
        // Get all script text from Script Breakdown sheet
        const response = await this.sheets.spreadsheets.values.get({
          spreadsheetId: workbookId,
          range: `${this.detailSheets.scriptBreakdown}!B:B` // Column B contains Script Text
        });

        const scriptTextValues = response.data.values || [];
        
        // Skip header row (first row) and combine all script sentences
        const scriptSentences = scriptTextValues.slice(1)
          .filter(row => row[0] && row[0].trim()) // Filter out empty rows
          .map(row => row[0].trim());

        if (scriptSentences.length === 0) {
          logger.warn(`No script sentences found in breakdown for video: ${videoId}`);
          return null;
        }

        // Return array of sentences for one-sentence-per-line formatting
        logger.info(`Extracted clean voice script for ${videoId}: ${scriptSentences.length} sentences`);
        return scriptSentences;

      } catch (error) {
        logger.warn(`Could not extract script breakdown for ${videoId}:`, error.message);
        return null;
      }
    }, 'extractCleanVoiceScript');
  }

  /**
   * Generate and upload voice script file to Google Drive
   */
  async createAndUploadVoiceScript(videoId, forceRecreate = false) {
    return this.retryOperation(async () => {
      const videoRow = await this.findVideoRow(videoId);
      if (!videoRow || !videoRow.data[this.masterColumns.driveFolder]) {
        throw new Error(`Drive folder not found for video: ${videoId}`);
      }

      // Get the clean voice script sentences array
      const scriptSentences = await this.extractCleanVoiceScript(videoId);
      if (!scriptSentences || scriptSentences.length === 0) {
        logger.warn(`No clean voice script available for ${videoId}`);
        return null;
      }

      // Extract folder ID from folder URL
      const folderUrl = videoRow.data[this.masterColumns.driveFolder];
      const folderId = folderUrl.split('/folders/')[1];
      
      if (!folderId) {
        throw new Error(`Invalid drive folder URL for video: ${videoId}`);
      }

      // Check for existing voice_script.txt file to prevent duplicates
      if (!forceRecreate) {
        try {
          const existingFiles = await this.drive.files.list({
            q: `name='voice_script.txt' and parents in '${folderId}' and trashed=false`,
            fields: 'files(id, name, webViewLink, webContentLink)'
          });

          if (existingFiles.data.files.length > 0) {
            const existingFile = existingFiles.data.files[0];
            logger.info(`Voice script already exists for ${videoId}, skipping creation: ${existingFile.name}`);
            
            return {
              fileId: existingFile.id,
              fileName: existingFile.name,
              viewLink: existingFile.webViewLink,
              downloadLink: existingFile.webContentLink,
              publicUrl: `https://drive.google.com/uc?id=${existingFile.id}`,
              skipped: true
            };
          }
        } catch (error) {
          logger.warn(`Failed to check for existing voice script file for ${videoId}, proceeding with creation:`, error.message);
        }
      }

      // Create text file content - script content only
      const fileContent = scriptSentences.map(sentence => sentence.trim()).join('\n\n');

      // Upload as text file to Google Drive
      const fileMetadata = {
        name: 'voice_script.txt',
        parents: [folderId]
      };

      const media = {
        mimeType: 'text/plain',
        body: fileContent
      };

      const response = await this.drive.files.create({
        resource: fileMetadata,
        media: media,
        fields: 'id, name, webViewLink, webContentLink'
      });

      // Make file publicly viewable for easy access
      await this.drive.permissions.create({
        fileId: response.data.id,
        resource: {
          role: 'reader',
          type: 'anyone'
        }
      });

      const fileResult = {
        fileId: response.data.id,
        fileName: response.data.name,
        viewLink: response.data.webViewLink,
        downloadLink: response.data.webContentLink,
        publicUrl: `https://drive.google.com/uc?id=${response.data.id}`
      };

      logger.info(`Created and uploaded voice script file for ${videoId}: ${scriptSentences.length} sentences, ${fileResult.viewLink}`);
      return fileResult;

    }, 'createAndUploadVoiceScript');
  }

  /**
   * Get all videos with their current status values for change monitoring
   */
  async getAllVideosStatus() {
    return this.retryOperation(async () => {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.masterSheetId,
        range: 'Videos!A:P' // Get all columns
      });

      const values = response.data.values || [];
      const videosStatus = [];

      // Skip header row (index 0)
      for (let i = 1; i < values.length; i++) {
        const row = values[i];
        if (row[this.masterColumns.videoId]) {
          videosStatus.push({
            videoId: row[this.masterColumns.videoId],
            title: row[this.masterColumns.title] || 'Unknown Title',
            status: row[this.masterColumns.status],
            scriptApproved: row[this.masterColumns.scriptApproved],
            voiceGenerationStatus: row[this.masterColumns.voiceGenerationStatus],
            videoEditingStatus: row[this.masterColumns.videoEditingStatus],
            driveFolder: row[this.masterColumns.driveFolder],
            detailWorkbookUrl: row[this.masterColumns.detailWorkbookUrl],
            lastEditedTime: row[this.masterColumns.lastEditedTime]
          });
        }
      }

      return videosStatus;
    }, 'getAllVideosStatus');
  }

  /**
   * Compare current status with cached status to detect changes
   */
  detectStatusChanges(currentVideos, cachedVideos) {
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

      // Check for changes in monitored fields
      const changedFields = {};
      
      if (currentVideo.scriptApproved !== cachedVideo.scriptApproved) {
        changedFields.scriptApproved = {
          old: cachedVideo.scriptApproved,
          new: currentVideo.scriptApproved
        };
      }

      if (currentVideo.voiceGenerationStatus !== cachedVideo.voiceGenerationStatus) {
        changedFields.voiceGenerationStatus = {
          old: cachedVideo.voiceGenerationStatus,
          new: currentVideo.voiceGenerationStatus
        };
      }

      if (currentVideo.videoEditingStatus !== cachedVideo.videoEditingStatus) {
        changedFields.videoEditingStatus = {
          old: cachedVideo.videoEditingStatus,
          new: currentVideo.videoEditingStatus
        };
      }

      // Only report if there are actual changes and the change appears to be manual
      // (Skip if it's an automated status change like 'Not Ready' -> 'Not Started')
      if (Object.keys(changedFields).length > 0) {
        // Filter out automated status changes
        const manualChanges = {};
        
        Object.entries(changedFields).forEach(([field, change]) => {
          // Skip automated transitions
          if (this.isAutomatedTransition(field, change.old, change.new)) {
            return;
          }
          manualChanges[field] = change;
        });

        if (Object.keys(manualChanges).length > 0) {
          changes.push({
            videoId: currentVideo.videoId,
            title: (currentVideo.title && currentVideo.title.trim()) || 'Title Unavailable',
            driveFolder: currentVideo.driveFolder,
            detailWorkbookUrl: currentVideo.detailWorkbookUrl,
            changes: manualChanges
          });
        }
      }
    }

    return changes;
  }

  /**
   * Check if a status change is an automated transition (should not trigger notification)
   */
  isAutomatedTransition(field, oldValue, newValue) {
    // Automated Voice Generation Status transitions
    if (field === 'voiceGenerationStatus') {
      return (oldValue === 'Not Ready' && newValue === 'Not Started');
    }

    // Automated Video Editing Status transitions  
    if (field === 'videoEditingStatus') {
      return (oldValue === 'Not Ready' && newValue === 'Not Started');
    }

    // No automated transitions for scriptApproved
    return false;
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

  /**
   * Clean up duplicate Drive folders and update main sheet URLs
   */
  async cleanupDuplicateDriveFolders() {
    return this.retryOperation(async () => {
      logger.info('🧹 Starting Drive folder cleanup process...');
      
      // Get all videos from master sheet
      const allVideos = await this.getAllVideos();
      const videosByName = new Map();
      const duplicateGroups = [];
      let processedCount = 0;
      let cleanedCount = 0;

      // Group videos by folder name to find duplicates
      for (const video of allVideos) {
        if (!video.videoId || !video.title) continue;
        
        const folderName = `(${video.videoId}) ${video.title}`;
        if (!videosByName.has(folderName)) {
          videosByName.set(folderName, []);
        }
        videosByName.get(folderName).push(video);
      }

      // Find groups with potential duplicates
      for (const [folderName, videos] of videosByName) {
        if (videos.length > 1) {
          logger.info(`🔍 Found ${videos.length} videos with folder name: ${folderName}`);
          duplicateGroups.push({ folderName, videos });
        }
      }

      if (duplicateGroups.length === 0) {
        logger.info('✅ No duplicate folder groups found');
        return { processedCount: 0, cleanedCount: 0 };
      }

      logger.info(`🔧 Found ${duplicateGroups.length} potential duplicate folder groups`);

      // Check and clean each group
      for (const group of duplicateGroups) {
        try {
          processedCount++;
          logger.info(`\n🔍 Processing group ${processedCount}/${duplicateGroups.length}: ${group.folderName}`);
          
          // Search for actual folders in Google Drive with this name
          const driveResponse = await this.drive.files.list({
            q: `name='${group.folderName}' and mimeType='application/vnd.google-apps.folder' and parents in '${config.google.videosRootFolderId}' and trashed=false`,
            fields: 'files(id, name, webViewLink, createdTime, modifiedTime)',
            orderBy: 'createdTime desc'
          });

          const folders = driveResponse.data.files || [];
          
          if (folders.length > 1) {
            logger.info(`❗ Found ${folders.length} duplicate folders in Drive for: ${group.folderName}`);
            
            // Keep the most recent folder (first in desc order)
            const keepFolder = folders[0];
            const foldersToDelete = folders.slice(1);
            
            logger.info(`✅ Keeping folder: ${keepFolder.id} (created: ${keepFolder.createdTime})`);
            
            // Delete duplicate folders
            for (const folderToDelete of foldersToDelete) {
              try {
                await this.drive.files.delete({ fileId: folderToDelete.id });
                logger.info(`🗑️ Deleted duplicate folder: ${folderToDelete.id}`);
                cleanedCount++;
              } catch (deleteError) {
                logger.error(`❌ Failed to delete folder ${folderToDelete.id}:`, deleteError.message);
              }
            }

            // Update master sheet URLs for all videos in this group
            const correctUrl = `https://drive.google.com/drive/folders/${keepFolder.id}`;
            
            for (const video of group.videos) {
              try {
                await this.updateVideoStatus(video.videoId, null, {
                  driveFolder: correctUrl
                });
                logger.info(`📝 Updated ${video.videoId} Drive folder URL`);
              } catch (updateError) {
                logger.error(`❌ Failed to update ${video.videoId}:`, updateError.message);
              }
            }
          } else if (folders.length === 1) {
            // Single folder exists, ensure all videos point to it
            const correctUrl = `https://drive.google.com/drive/folders/${folders[0].id}`;
            
            for (const video of group.videos) {
              const currentUrl = video.data ? video.data[this.masterColumns.driveFolder] : null;
              if (currentUrl !== correctUrl) {
                try {
                  await this.updateVideoStatus(video.videoId, null, {
                    driveFolder: correctUrl
                  });
                  logger.info(`📝 Updated ${video.videoId} Drive folder URL to correct one`);
                } catch (updateError) {
                  logger.error(`❌ Failed to update ${video.videoId}:`, updateError.message);
                }
              }
            }
          } else {
            logger.warn(`⚠️ No folders found in Drive for: ${group.folderName}`);
          }
          
        } catch (error) {
          logger.error(`❌ Error processing group ${group.folderName}:`, error.message);
        }
      }

      logger.info('\n🎉 Drive folder cleanup completed:');
      logger.info(`   📊 Groups processed: ${processedCount}`);
      logger.info(`   🗑️ Duplicate folders cleaned: ${cleanedCount}`);
      
      return { processedCount, cleanedCount };
      
    }, 'cleanupDuplicateDriveFolders');
  }

  /**
   * Get all videos from master sheet
   */
  async getAllVideos() {
    return this.retryOperation(async () => {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.masterSheetId,
        range: 'Videos!A:P'
      });

      const values = response.data.values || [];
      if (values.length <= 1) {
        return [];
      }

      const videos = [];
      const dataRows = values.slice(1); // Skip header row

      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        const rowIndex = i + 2; // Adjust for 1-based indexing and header row

        if (row[this.masterColumns.videoId]) {
          videos.push({
            videoId: row[this.masterColumns.videoId],
            youtubeUrl: row[this.masterColumns.youtubeUrl],
            status: row[this.masterColumns.status],
            title: row[this.masterColumns.title] || 'Unknown Title',
            channel: row[this.masterColumns.channel],
            duration: row[this.masterColumns.duration],
            viewCount: row[this.masterColumns.viewCount],
            publishedDate: row[this.masterColumns.publishedDate],
            youtubeVideoId: row[this.masterColumns.youtubeVideoId],
            scriptApproved: row[this.masterColumns.scriptApproved],
            voiceGenerationStatus: row[this.masterColumns.voiceGenerationStatus],
            videoEditingStatus: row[this.masterColumns.videoEditingStatus],
            driveFolder: row[this.masterColumns.driveFolder],
            detailWorkbookUrl: row[this.masterColumns.detailWorkbookUrl],
            createdTime: row[this.masterColumns.createdTime],
            lastEditedTime: row[this.masterColumns.lastEditedTime],
            rowIndex: rowIndex,
            data: row
          });
        }
      }

      return videos;
    }, 'getAllVideos');
  }
}

export default GoogleSheetsService;