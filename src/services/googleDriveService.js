import { google } from 'googleapis';
import fs from 'fs';
import { config } from '../../config/config.js';
import logger from '../utils/logger.js';

class GoogleDriveService {
  constructor() {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: config.google.clientEmail,
        private_key: config.google.privateKey,
      },
      scopes: [
        'https://www.googleapis.com/auth/drive',
        'https://www.googleapis.com/auth/spreadsheets'
      ],
    });

    this.drive = google.drive({ version: 'v3', auth });
    this.sheets = google.sheets({ version: 'v4', auth });
  }

  async createVideoFolder(videoTitle, videoId) {
    try {
      const sanitizedTitle = this.sanitizeFolderName(videoTitle);
      const folderName = `${sanitizedTitle} (${videoId})`;

      const folderMetadata = {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [config.google.driveFolderId]
      };

      const folder = await this.drive.files.create({
        resource: folderMetadata,
        fields: 'id, name, webViewLink'
      });

      logger.info(`Drive folder: ${folderName}`);

      await this.createSubfolders(folder.data.id);

      return {
        folderId: folder.data.id,
        folderName: folder.data.name,
        folderUrl: folder.data.webViewLink
      };
    } catch (error) {
      logger.error('Error creating Google Drive folder:', error);
      throw error;
    }
  }

  async createSubfolders(parentFolderId) {
    const subfolders = [
      'Original Assets',
      'Generated Scripts',
      'Generated Images',
      'Generated Thumbnails',
      'Final Output'
    ];

    try {
      const createdFolders = {};
      
      for (const folderName of subfolders) {
        const folderMetadata = {
          name: folderName,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [parentFolderId]
        };

        const folder = await this.drive.files.create({
          resource: folderMetadata,
          fields: 'id, name'
        });

        createdFolders[folderName] = folder.data.id;
        logger.info(`Subfolder: ${folderName}`);
      }

      return createdFolders;
    } catch (error) {
      logger.error('Error creating subfolders:', error);
      throw error;
    }
  }

  async uploadFile(filePathOrStream, fileName, parentFolderId, mimeType = 'application/octet-stream') {
    try {
      const fileMetadata = {
        name: fileName,
        parents: [parentFolderId]
      };

      let body;
      if (typeof filePathOrStream === 'string') {
        // It's a file path
        body = fs.createReadStream(filePathOrStream);
      } else {
        // It's already a stream
        body = filePathOrStream;
      }

      const media = {
        mimeType: mimeType,
        body: body
      };

      const file = await this.drive.files.create({
        resource: fileMetadata,
        media: media,
        fields: 'id, name, webViewLink, webContentLink'
      });

      logger.info(`Uploaded: ${fileName}`);
      return file.data;
    } catch (error) {
      logger.error('Error uploading file to Drive:', error);
      throw error;
    }
  }

  async createScriptBreakdownSheet(videoTitle, videoId, parentFolderId) {
    try {
      const sheetTitle = `${this.sanitizeFolderName(videoTitle)} - Script Breakdown`;
      
      // Try Google Sheets API first
      try {
        await this.testSheetsAPI();
        return await this.createNativeGoogleSheet(sheetTitle, parentFolderId);
      } catch (sheetsError) {
        logger.warn('Sheets API unavailable, using CSV:', sheetsError.message);
        
        // Fallback: Create as CSV and upload to Google Drive (will auto-convert to Sheet)
        return await this.createSheetViaCSVUpload(sheetTitle, parentFolderId);
      }
    } catch (error) {
      logger.error('Error creating script breakdown sheet:', error);
      throw error;
    }
  }

  async createNativeGoogleSheet(sheetTitle, parentFolderId) {
    const resource = {
      properties: {
        title: sheetTitle
      },
      sheets: [
        {
          properties: {
            title: 'Script Breakdown',
            gridProperties: {
              rowCount: 1000,
              columnCount: 5
            }
          }
        }
      ]
    };

    // Create spreadsheet first
    const spreadsheet = await this.sheets.spreadsheets.create({
      resource,
      fields: 'spreadsheetId,properties.title,sheets.properties'
    });

    // Try to move to target folder
    try {
      const file = await this.drive.files.get({
        fileId: spreadsheet.data.spreadsheetId,
        fields: 'parents'
      });

      const previousParents = file.data.parents.join(',');
      
      await this.drive.files.update({
        fileId: spreadsheet.data.spreadsheetId,
        addParents: parentFolderId,
        removeParents: previousParents,
        fields: 'id, parents'
      });
      
      logger.info('Spreadsheet moved');
    } catch (moveError) {
      logger.warn('Spreadsheet move failed:', moveError.message);
    }

    // Add headers
    const headers = [
      ['Sentence #', 'Script Text', 'Image Prompt', 'Generated Image URL', 'Status']
    ];

    await this.sheets.spreadsheets.values.update({
      spreadsheetId: spreadsheet.data.spreadsheetId,
      range: 'Script Breakdown!A1:E1',
      valueInputOption: 'RAW',
      resource: {
        values: headers
      }
    });

    logger.info(`Created native Google Sheet: ${sheetTitle}`);
    
    return {
      spreadsheetId: spreadsheet.data.spreadsheetId,
      spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheet.data.spreadsheetId}`,
      title: sheetTitle,
      method: 'native'
    };
  }

  async createSheetViaCSVUpload(sheetTitle, parentFolderId) {
    // Create CSV content with headers
    const csvContent = 'Sentence #,Script Text,Image Prompt,Generated Image URL,Status\n';
    
    // Create the file metadata
    const fileMetadata = {
      name: `${sheetTitle}.csv`,
      parents: [parentFolderId],
      mimeType: 'application/vnd.google-apps.spreadsheet' // This will convert CSV to Google Sheets
    };

    // Upload the CSV as a Google Sheet
    const file = await this.drive.files.create({
      resource: fileMetadata,
      media: {
        mimeType: 'text/csv',
        body: csvContent
      },
      fields: 'id, name, webViewLink'
    });

    logger.info(`Created Google Sheet via CSV upload: ${sheetTitle}`);
    
    return {
      spreadsheetId: file.data.id,
      spreadsheetUrl: file.data.webViewLink,
      title: sheetTitle,
      method: 'csv_upload'
    };
  }

  async updateScriptBreakdown(spreadsheetId, scriptSentences, imagePrompts = [], method = 'native') {
    try {
      if (method === 'native') {
        // Use Sheets API for native Google Sheets
        const values = scriptSentences.map((sentence, index) => [
          index + 1,
          sentence,
          imagePrompts[index] || '',
          '',
          'Pending'
        ]);

        await this.sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `Script Breakdown!A2:E${values.length + 1}`,
          valueInputOption: 'RAW',
          resource: {
            values
          }
        });

        logger.info(`Updated native Google Sheet with ${scriptSentences.length} sentences`);
      } else {
        // For CSV-uploaded sheets, recreate the content and update the file
        await this.updateCSVSheet(spreadsheetId, scriptSentences, imagePrompts);
        logger.info(`Updated CSV-based Google Sheet with ${scriptSentences.length} sentences`);
      }
      
      return true;
    } catch (error) {
      logger.error('Error updating script breakdown:', error);
      throw error;
    }
  }

  async updateCSVSheet(fileId, scriptSentences, imagePrompts = []) {
    // Create CSV content with headers and data
    let csvContent = 'Sentence #,Script Text,Image Prompt,Generated Image URL,Status\n';
    
    scriptSentences.forEach((sentence, index) => {
      const escapedSentence = `"${sentence.replace(/"/g, '""')}"`;
      const escapedPrompt = `"${(imagePrompts[index] || '').replace(/"/g, '""')}"`;
      csvContent += `${index + 1},${escapedSentence},${escapedPrompt},"","Pending"\n`;
    });

    // Update the file content
    await this.drive.files.update({
      fileId: fileId,
      media: {
        mimeType: 'text/csv',
        body: csvContent
      }
    });
  }

  async updateImageUrl(spreadsheetId, rowIndex, imageUrl) {
    try {
      await this.sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `Script Breakdown!D${rowIndex + 2}:E${rowIndex + 2}`,
        valueInputOption: 'RAW',
        resource: {
          values: [[imageUrl, 'Generated']]
        }
      });

      logger.info(`Updated image URL for row ${rowIndex + 2}`);
      return true;
    } catch (error) {
      logger.error('Error updating image URL:', error);
      throw error;
    }
  }

  async updateMultipleImageUrls(spreadsheetId, imageUrls) {
    try {
      if (!imageUrls || imageUrls.length === 0) {
        logger.warn('No image URLs to update');
        return false;
      }

      // Create batch update data
      const updates = imageUrls.map((imageUrl, index) => ({
        range: `Script Breakdown!D${index + 2}:E${index + 2}`,
        values: [[imageUrl || '', imageUrl ? 'Generated' : 'Pending']]
      }));

      // Batch update all image URLs at once
      await this.sheets.spreadsheets.values.batchUpdate({
        spreadsheetId,
        resource: {
          valueInputOption: 'RAW',
          data: updates
        }
      });

      logger.info(`Updated ${imageUrls.length} image URLs in batch`);
      return true;
    } catch (error) {
      logger.error('Error updating multiple image URLs:', error);
      throw error;
    }
  }

  async getSpreadsheetData(spreadsheetId, range = 'Script Breakdown!A:E') {
    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId,
        range
      });

      return response.data.values || [];
    } catch (error) {
      logger.error('Error getting spreadsheet data:', error);
      throw error;
    }
  }

  async updateScriptStatus(spreadsheetId, rowIndex, status) {
    try {
      await this.sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `Script Breakdown!E${rowIndex + 2}`,
        valueInputOption: 'RAW',
        resource: {
          values: [[status]]
        }
      });

      logger.info(`Updated status for row ${rowIndex + 2} to: ${status}`);
      return true;
    } catch (error) {
      logger.error('Error updating script status:', error);
      throw error;
    }
  }

  sanitizeFolderName(name) {
    return name
      .replace(/[<>:"/\\|?*]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 100);
  }

  async getFolderContents(folderId) {
    try {
      const response = await this.drive.files.list({
        q: `'${folderId}' in parents and trashed=false`,
        fields: 'files(id, name, mimeType, webViewLink, createdTime)'
      });

      return response.data.files;
    } catch (error) {
      logger.error('Error fetching folder contents:', error);
      throw error;
    }
  }

  async shareFolder(folderId, email, role = 'reader') {
    try {
      const permission = {
        type: 'user',
        role: role,
        emailAddress: email
      };

      await this.drive.permissions.create({
        fileId: folderId,
        resource: permission
      });

      logger.info(`Shared folder ${folderId} with ${email} as ${role}`);
      return true;
    } catch (error) {
      logger.error('Error sharing folder:', error);
      throw error;
    }
  }

  async testSheetsAPI() {
    try {
      // Test Sheets API availability by accessing a public test spreadsheet
      await this.sheets.spreadsheets.get({
        spreadsheetId: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms', // Public Google sample sheet
        fields: 'properties.title'
      });
      return true;
    } catch (error) {
      logger.warn('Google Sheets API test failed:', error.message);
      throw error;
    }
  }

  async healthCheck() {
    try {
      // Test basic Drive API access by getting user info
      const response = await this.drive.about.get({
        fields: 'user, storageQuota'
      });
      
      if (response.data && response.data.user) {
        logger.info('Google Drive health check passed');
        
        // Test Sheets API availability (optional)
        try {
          await this.testSheetsAPI();
          logger.info('Google Sheets API is available');
        } catch (sheetsError) {
          if (sheetsError.message.includes('has not been used') || sheetsError.message.includes('disabled')) {
            logger.warn('Google Sheets API is not enabled. Script breakdown sheets will not be created.');
            logger.warn('To enable: Go to https://console.cloud.google.com/apis/library and enable Google Sheets API');
          } else {
            logger.warn('Google Sheets API is not available:', sheetsError.message);
          }
          // Don't fail health check just because Sheets is not available
        }
        
        return true;
      } else {
        throw new Error('Invalid response from Google Drive API');
      }
    } catch (error) {
      logger.error('Google Drive health check failed:', error);
      throw error;
    }
  }
}

export default GoogleDriveService;