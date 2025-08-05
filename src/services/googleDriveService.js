import { google } from 'googleapis';
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

      logger.info(`Created Google Drive folder: ${folderName}`);

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
        logger.info(`Created subfolder: ${folderName}`);
      }

      return createdFolders;
    } catch (error) {
      logger.error('Error creating subfolders:', error);
      throw error;
    }
  }

  async uploadFile(filePath, fileName, parentFolderId, mimeType = 'application/octet-stream') {
    try {
      const fileMetadata = {
        name: fileName,
        parents: [parentFolderId]
      };

      const media = {
        mimeType: mimeType,
        body: filePath
      };

      const file = await this.drive.files.create({
        resource: fileMetadata,
        media: media,
        fields: 'id, name, webViewLink'
      });

      logger.info(`Uploaded file: ${fileName} to Drive`);
      return file.data;
    } catch (error) {
      logger.error('Error uploading file to Drive:', error);
      throw error;
    }
  }

  async createScriptBreakdownSheet(videoTitle, videoId, parentFolderId) {
    try {
      const sheetTitle = `${this.sanitizeFolderName(videoTitle)} - Script Breakdown`;
      
      // First check if Google Sheets API is available
      try {
        await this.testSheetsAPI();
      } catch (apiError) {
        if (apiError.message.includes('has not been used') || apiError.message.includes('disabled')) {
          const detailedError = new Error('Google Sheets API is not enabled. Please enable it in Google Cloud Console:\n' +
            '1. Go to: https://console.cloud.google.com/apis/library\n' +
            '2. Search for "Google Sheets API"\n' +
            '3. Click "ENABLE"\n' +
            `Original error: ${apiError.message}`);
          detailedError.code = 'SHEETS_API_DISABLED';
          throw detailedError;
        }
        throw apiError;
      }
      
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

      // Create spreadsheet directly in the target folder
      const spreadsheet = await this.sheets.spreadsheets.create({
        resource,
        fields: 'spreadsheetId,properties.title,sheets.properties'
      });

      // Move spreadsheet to the target folder and remove from root
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

      // Add headers to the spreadsheet
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

      logger.info(`Created script breakdown sheet: ${sheetTitle}`);
      
      return {
        spreadsheetId: spreadsheet.data.spreadsheetId,
        spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheet.data.spreadsheetId}`,
        title: sheetTitle
      };
    } catch (error) {
      if (error.code === 'SHEETS_API_DISABLED') {
        logger.error('Google Sheets API is not enabled. See GOOGLE_SHEETS_SETUP.md for instructions.');
        logger.error(error.message);
      } else {
        logger.error('Error creating script breakdown sheet:', error);
      }
      throw error;
    }
  }

  async updateScriptBreakdown(spreadsheetId, scriptSentences, imagePrompts = []) {
    try {
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

      logger.info(`Updated script breakdown with ${scriptSentences.length} sentences`);
      return true;
    } catch (error) {
      logger.error('Error updating script breakdown:', error);
      throw error;
    }
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