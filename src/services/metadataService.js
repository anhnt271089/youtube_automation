import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import logger from '../utils/logger.js';

/**
 * MetadataService - Provides bulletproof metadata storage and retrieval
 * 
 * This service ensures that critical video metadata is never lost due to:
 * - Human modification of Google Sheets
 * - Sheet sync issues or corruption  
 * - Network failures during data retrieval
 * 
 * Strategy: Store immutable copies of original YouTube metadata in JSON files
 * and use Google Sheets only as a "view layer" for human interaction.
 */
class MetadataService {
  constructor(sheetsService = null, youtubeService = null) {
    this.metadataDir = path.join(process.cwd(), 'data', 'metadata');
    this.backupDir = path.join(process.cwd(), 'data', 'metadata', 'backups');
    this.sheetsService = sheetsService;
    this.youtubeService = youtubeService;
    
    this.ensureDirectories();
  }

  /**
   * Ensure metadata directories exist
   */
  ensureDirectories() {
    [this.metadataDir, this.backupDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        logger.info(`Created metadata directory: ${dir}`);
      }
    });
  }

  /**
   * Get the file path for a video's metadata
   */
  getMetadataFilePath(videoId) {
    return path.join(this.metadataDir, `${videoId}.json`);
  }

  /**
   * Get the backup file path for a video's metadata
   */
  getBackupFilePath(videoId, timestamp = null) {
    const ts = timestamp || new Date().toISOString().replace(/[:.]/g, '-');
    return path.join(this.backupDir, `${videoId}_${ts}.json`);
  }

  /**
   * Calculate checksum for metadata integrity validation
   */
  calculateChecksum(metadata) {
    const dataString = JSON.stringify(metadata, Object.keys(metadata).sort());
    return crypto.createHash('sha256').update(dataString).digest('hex');
  }

  /**
   * Save original YouTube metadata to immutable file
   */
  async saveOriginalMetadata(videoId, youtubeMetadata) {
    try {
      const filePath = this.getMetadataFilePath(videoId);
      
      // Check if file already exists - don't overwrite original metadata
      if (fs.existsSync(filePath)) {
        const existing = await this.loadFromFile(videoId);
        if (existing && existing.originalMetadata) {
          logger.info(`Original metadata already exists for ${videoId}, skipping overwrite`);
          return existing;
        }
      }

      // Calculate checksum on original YouTube data before adding our fields
      const originalChecksum = this.calculateChecksum(youtubeMetadata);
      
      const metadataRecord = {
        videoId,
        version: '1.0',
        createdAt: new Date().toISOString(),
        originalMetadata: {
          ...youtubeMetadata,
          fetchedAt: new Date().toISOString(),
          checksum: originalChecksum
        },
        workflowMetadata: {
          processedAt: null,
          workflowVersion: '1.0',
          aiEnhancedTitle: null,
          scriptGenerated: false,
          costTracking: {},
          processingAttempts: 0
        },
        systemIntegrity: {
          lastValidated: new Date().toISOString(),
          validationStatus: 'verified',
          backupCreated: false
        }
      };

      // Save to main file
      fs.writeFileSync(filePath, JSON.stringify(metadataRecord, null, 2), 'utf8');
      
      // Create backup
      const backupPath = this.getBackupFilePath(videoId);
      fs.writeFileSync(backupPath, JSON.stringify(metadataRecord, null, 2), 'utf8');
      metadataRecord.systemIntegrity.backupCreated = true;
      
      // Update main file with backup flag
      fs.writeFileSync(filePath, JSON.stringify(metadataRecord, null, 2), 'utf8');
      
      logger.info(`Saved immutable metadata for ${videoId}: ${youtubeMetadata.title}`);
      return metadataRecord;

    } catch (error) {
      logger.error(`Failed to save metadata for ${videoId}:`, error);
      throw error;
    }
  }

  /**
   * Load metadata from file
   */
  async loadFromFile(videoId) {
    try {
      const filePath = this.getMetadataFilePath(videoId);
      
      if (!fs.existsSync(filePath)) {
        return null;
      }

      const data = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(data);

    } catch (error) {
      logger.error(`Failed to load metadata for ${videoId}:`, error);
      return null;
    }
  }

  /**
   * Validate metadata integrity using checksum
   */
  validateIntegrity(metadataRecord) {
    try {
      if (!metadataRecord || !metadataRecord.originalMetadata) {
        return false;
      }

      // Extract checksum and fetchedAt (both are added after original data)
      // eslint-disable-next-line no-unused-vars
      const { checksum, fetchedAt, ...dataToValidate } = metadataRecord.originalMetadata;
      
      // Calculate checksum on original data (without our added fields)
      const calculatedChecksum = this.calculateChecksum(dataToValidate);
      
      return checksum === calculatedChecksum;

    } catch (error) {
      logger.error('Failed to validate metadata integrity:', error);
      return false;
    }
  }

  /**
   * Get reliable video metadata - THE CORE METHOD
   * 
   * This method implements the bulletproof metadata retrieval strategy:
   * 1. Try immutable file first (most reliable)
   * 2. Fallback to Google Sheets if file missing
   * 3. Re-fetch from YouTube as last resort
   * 4. Always save reliable data for future use
   */
  async getReliableVideoMetadata(videoId) {
    try {
      logger.info(`Getting reliable metadata for ${videoId}...`);

      // 1. Try immutable file first
      const fileMetadata = await this.loadFromFile(videoId);
      if (fileMetadata && this.validateIntegrity(fileMetadata)) {
        logger.info(`Using validated metadata from file for ${videoId}`);
        return fileMetadata.originalMetadata;
      }

      if (fileMetadata && !this.validateIntegrity(fileMetadata)) {
        logger.warn(`Metadata file corrupted for ${videoId}, attempting recovery`);
      }

      // 2. Fallback to Google Sheets (if services available)
      if (this.sheetsService) {
        try {
          const sheetData = await this.sheetsService.findVideoRow(videoId);
          if (sheetData && sheetData.data && sheetData.data[this.sheetsService.masterColumns.youtubeUrl]) {
            const youtubeUrl = sheetData.data[this.sheetsService.masterColumns.youtubeUrl];
            
            // 3. Re-fetch from YouTube using sheet URL
            if (this.youtubeService) {
              logger.info(`Re-fetching metadata from YouTube for ${videoId}`);
              const freshData = await this.youtubeService.getCompleteVideoData(youtubeUrl);
              
              // Save for future use
              await this.saveOriginalMetadata(videoId, freshData);
              return freshData;
            }
          }
        } catch (error) {
          logger.warn(`Failed to recover metadata from sheets for ${videoId}:`, error);
        }
      }

      throw new Error(`No reliable metadata source available for ${videoId}`);

    } catch (error) {
      logger.error(`Failed to get reliable metadata for ${videoId}:`, error);
      throw error;
    }
  }

  /**
   * Validate integrity between file and sheet data
   */
  async validateSheetIntegrity(videoId) {
    try {
      if (!this.sheetsService) {
        return { isValid: true, discrepancies: [], note: 'No sheet service configured' };
      }

      const fileMetadata = await this.loadFromFile(videoId);
      if (!fileMetadata) {
        return { isValid: true, discrepancies: [], note: 'No file metadata to compare' };
      }

      const sheetData = await this.sheetsService.findVideoRow(videoId);
      if (!sheetData || !sheetData.data) {
        return { isValid: false, discrepancies: ['sheet_missing'], note: 'Video not found in sheet' };
      }

      const discrepancies = [];
      const original = fileMetadata.originalMetadata;
      const sheet = sheetData.data;

      // Check critical fields
      const checks = [
        { field: 'youtubeUrl', original: original.youtubeUrl, sheet: sheet[this.sheetsService.masterColumns.youtubeUrl] },
        { field: 'title', original: original.title, sheet: sheet[this.sheetsService.masterColumns.title] },
        { field: 'youtubeVideoId', original: original.videoId, sheet: sheet[this.sheetsService.masterColumns.youtubeVideoId] },
        { field: 'channelTitle', original: original.channelTitle, sheet: sheet[this.sheetsService.masterColumns.channel] },
        { field: 'duration', original: original.duration, sheet: sheet[this.sheetsService.masterColumns.duration] }
      ];

      for (const check of checks) {
        if (check.original !== check.sheet) {
          discrepancies.push({
            field: check.field,
            original: check.original,
            sheet: check.sheet
          });
        }
      }

      return { 
        isValid: discrepancies.length === 0, 
        discrepancies,
        note: discrepancies.length > 0 ? 'Sheet data differs from original metadata' : 'Sheet data matches original metadata'
      };

    } catch (error) {
      logger.error(`Failed to validate sheet integrity for ${videoId}:`, error);
      return { isValid: false, discrepancies: [], error: error.message };
    }
  }

  /**
   * Update workflow metadata (non-immutable data)
   */
  async updateWorkflowMetadata(videoId, updates) {
    try {
      const filePath = this.getMetadataFilePath(videoId);
      
      if (!fs.existsSync(filePath)) {
        throw new Error(`No metadata file exists for ${videoId}`);
      }

      const metadataRecord = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      
      // Update workflow metadata only (never touch original metadata)
      metadataRecord.workflowMetadata = {
        ...metadataRecord.workflowMetadata,
        ...updates,
        lastUpdated: new Date().toISOString()
      };

      fs.writeFileSync(filePath, JSON.stringify(metadataRecord, null, 2), 'utf8');
      
      logger.info(`Updated workflow metadata for ${videoId}`);
      return metadataRecord;

    } catch (error) {
      logger.error(`Failed to update workflow metadata for ${videoId}:`, error);
      throw error;
    }
  }

  /**
   * Get list of all videos with metadata files
   */
  async getAllVideoIds() {
    try {
      const files = fs.readdirSync(this.metadataDir);
      return files
        .filter(file => file.endsWith('.json') && !file.includes('_'))
        .map(file => file.replace('.json', ''));
    } catch (error) {
      logger.error('Failed to get video IDs:', error);
      return [];
    }
  }

  /**
   * Health check for metadata service
   */
  async healthCheck() {
    try {
      const testVideoId = 'HEALTH_CHECK_TEST';
      const testMetadata = {
        title: 'Health Check Test Video',
        youtubeUrl: 'https://youtube.com/watch?v=test',
        videoId: 'test123'
      };

      // Test write
      await this.saveOriginalMetadata(testVideoId, testMetadata);
      
      // Test read
      const loaded = await this.loadFromFile(testVideoId);
      
      // Test validation
      const isValid = this.validateIntegrity(loaded);
      
      // Cleanup
      const filePath = this.getMetadataFilePath(testVideoId);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      return {
        status: 'healthy',
        service: 'MetadataService',
        canWrite: true,
        canRead: loaded !== null,
        integrityValidation: isValid,
        metadataDir: this.metadataDir
      };

    } catch (error) {
      return {
        status: 'unhealthy',
        service: 'MetadataService',
        error: error.message,
        metadataDir: this.metadataDir
      };
    }
  }
}

export default MetadataService;