import logger from '../utils/logger.js';

class VoiceIntegrationService {
  constructor(googleDriveService) {
    this.googleDriveService = googleDriveService;
    this.voiceFileExtensions = ['.mp3', '.wav', '.m4a', '.aac', '.ogg'];
  }

  async detectVoiceFile(videoFolderId) {
    try {
      logger.info(`Scanning for voice files in folder: ${videoFolderId}`);
      
      const folderContents = await this.googleDriveService.getFolderContents(videoFolderId);
      
      // Look for voice files in main folder and subfolders
      const voiceFiles = folderContents.filter(file => 
        this.isVoiceFile(file.name) && !file.name.startsWith('.')
      );
      
      if (voiceFiles.length === 0) {
        logger.info('No voice files found in video folder');
        return null;
      }
      
      if (voiceFiles.length > 1) {
        logger.warn(`Multiple voice files found (${voiceFiles.length}), using first one: ${voiceFiles[0].name}`);
      }
      
      const selectedVoice = voiceFiles[0];
      logger.info(`Voice file detected: ${selectedVoice.name}`);
      
      return {
        fileId: selectedVoice.id,
        fileName: selectedVoice.name,
        downloadUrl: `https://drive.google.com/uc?id=${selectedVoice.id}`,
        webViewLink: selectedVoice.webViewLink,
        createdTime: selectedVoice.createdTime
      };
    } catch (error) {
      logger.error('Error detecting voice file:', error);
      return null;
    }
  }

  async downloadVoiceFile(voiceFileInfo, localPath) {
    try {
      logger.info(`Downloading voice file: ${voiceFileInfo.fileName}`);
      
      // Use Google Drive API to download the file
      const response = await this.googleDriveService.drive.files.get({
        fileId: voiceFileInfo.fileId,
        alt: 'media'
      }, {
        responseType: 'stream'
      });
      
      const fs = await import('fs');
      const path = await import('path');
      
      // Ensure directory exists
      const dir = path.dirname(localPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      // Download file
      const writer = fs.createWriteStream(localPath);
      response.data.pipe(writer);
      
      return new Promise((resolve, reject) => {
        writer.on('finish', () => {
          logger.info(`Voice file downloaded to: ${localPath}`);
          resolve(localPath);
        });
        writer.on('error', reject);
      });
    } catch (error) {
      logger.error('Error downloading voice file:', error);
      throw error;
    }
  }

  isVoiceFile(filename) {
    const lowercaseName = filename.toLowerCase();
    return this.voiceFileExtensions.some(ext => lowercaseName.endsWith(ext));
  }

  async getVoiceFileInfo(fileId) {
    try {
      const file = await this.googleDriveService.drive.files.get({
        fileId,
        fields: 'id, name, size, mimeType, createdTime, webViewLink'
      });
      
      return file.data;
    } catch (error) {
      logger.error('Error getting voice file info:', error);
      throw error;
    }
  }
}

export default VoiceIntegrationService;