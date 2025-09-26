import fs from 'fs/promises';
import path from 'path';
import { config } from '../../config/config.js';
import logger from '../utils/logger.js';
import GoogleSheetsService from './googleSheetsService.js';
import GoogleDriveService from './googleDriveService.js';

/**
 * PexelsService - Handles Pexels asset search, download, and Google Drive upload
 * Integrates with Script Breakdown sheet for automatic asset processing
 */
class PexelsService {
  constructor() {
    this.apiKey = config.pexels.apiKey;
    this.baseUrl = config.pexels.baseUrl;
    this.resultsPerPage = config.pexels.searchResultsPerPage;
    this.downloadTimeout = config.pexels.downloadTimeout;
    this.maxRetries = config.pexels.maxRetries;
    this.retryDelay = config.pexels.retryDelay;

    // Initialize dependent services
    this.sheetsService = new GoogleSheetsService();
    this.driveService = new GoogleDriveService();

    // Validate API key
    if (!this.apiKey) {
      throw new Error('PEXELS_API_KEY is required in environment variables');
    }

    logger.info('PexelsService initialized successfully');
  }

  /**
   * Search for photos on Pexels
   * @param {string} query - Search query
   * @param {number} perPage - Number of results per page (default: 10)
   * @returns {Promise<Array>} Array of photo objects
   */
  async searchPhotos(query, perPage = 10) {
    return this.retryOperation(async () => {
      const url = `${this.baseUrl}/search?query=${encodeURIComponent(query)}&per_page=${perPage}&orientation=landscape`;

      const response = await fetch(url, {
        headers: {
          'Authorization': this.apiKey
        },
        timeout: this.downloadTimeout
      });

      if (!response.ok) {
        throw new Error(`Pexels API error: ${response.status} - ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.photos || data.photos.length === 0) {
        logger.warn(`No photos found for query: "${query}"`);
        return [];
      }

      logger.info(`Found ${data.photos.length} photos for query: "${query}"`);
      return data.photos.map(photo => ({
        id: photo.id,
        width: photo.width,
        height: photo.height,
        url: photo.url,
        photographer: photo.photographer,
        photographer_url: photo.photographer_url,
        avg_color: photo.avg_color,
        src: photo.src,
        alt: photo.alt || query
      }));
    }, `searchPhotos-${query}`);
  }

  /**
   * Search for videos on Pexels
   * @param {string} query - Search query
   * @param {number} perPage - Number of results per page (default: 10)
   * @returns {Promise<Array>} Array of video objects
   */
  async searchVideos(query, perPage = 10) {
    return this.retryOperation(async () => {
      const url = `${this.baseUrl}/videos/search?query=${encodeURIComponent(query)}&per_page=${perPage}`;

      const response = await fetch(url, {
        headers: {
          'Authorization': this.apiKey
        },
        timeout: this.downloadTimeout
      });

      if (!response.ok) {
        throw new Error(`Pexels API error: ${response.status} - ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.videos || data.videos.length === 0) {
        logger.warn(`No videos found for query: "${query}"`);
        return [];
      }

      logger.info(`Found ${data.videos.length} videos for query: "${query}"`);

      // Filter videos to landscape orientation only (width > height)
      const landscapeVideos = data.videos.filter(video => video.width > video.height);

      logger.info(`Filtered to ${landscapeVideos.length} landscape videos for query: "${query}"`);

      return landscapeVideos.map(video => ({
        id: video.id,
        width: video.width,
        height: video.height,
        url: video.url,
        image: video.image,
        duration: video.duration,
        user: video.user,
        video_files: video.video_files,
        video_pictures: video.video_pictures
      }));
    }, `searchVideos-${query}`);
  }

  /**
   * Download asset from URL to a temporary location
   * @param {string} downloadUrl - URL to download from
   * @param {string} filename - Local filename to save as
   * @returns {Promise<string>} Path to downloaded file
   */
  async downloadAsset(downloadUrl, filename) {
    return this.retryOperation(async () => {
      logger.info(`Downloading asset: ${filename} from ${downloadUrl}`);

      const response = await fetch(downloadUrl, {
        timeout: this.downloadTimeout
      });

      if (!response.ok) {
        throw new Error(`Download failed: ${response.status} - ${response.statusText}`);
      }

      // Create temp directory if it doesn't exist
      const tempDir = '/tmp/pexels-assets';
      try {
        await fs.mkdir(tempDir, { recursive: true });
      } catch (error) {
        if (error.code !== 'EEXIST') {
          throw error;
        }
      }

      const tempFilePath = path.join(tempDir, filename);
      const buffer = await response.arrayBuffer();
      await fs.writeFile(tempFilePath, Buffer.from(buffer));

      logger.info(`Asset downloaded successfully: ${tempFilePath}`);
      return tempFilePath;
    }, `downloadAsset-${filename}`);
  }

  /**
   * Get the best quality source URL for a photo
   * @param {Object} photo - Photo object from Pexels API
   * @returns {string} Best quality image URL
   */
  getBestPhotoUrl(photo) {
    // Prefer original, fallback to large2x, large, medium
    if (photo.src.original) return photo.src.original;
    if (photo.src.large2x) return photo.src.large2x;
    if (photo.src.large) return photo.src.large;
    return photo.src.medium;
  }

  /**
   * Get the best quality video URL for a video
   * @param {Object} video - Video object from Pexels API
   * @returns {string} Best quality video URL
   */
  getBestVideoUrl(video) {
    if (!video.video_files || video.video_files.length === 0) {
      throw new Error('No video files available');
    }

    // Sort by quality preference: hd, sd, mobile
    const qualityOrder = ['hd', 'sd', 'mobile'];

    for (const quality of qualityOrder) {
      const videoFile = video.video_files.find(file => file.quality === quality);
      if (videoFile) {
        return videoFile.link;
      }
    }

    // Fallback to first available video file
    return video.video_files[0].link;
  }

  /**
   * Determine asset type based on word count
   * @param {number} wordCount - Number of words in the sentence
   * @returns {string} 'video' or 'photo'
   */
  getAssetTypeByWordCount(wordCount) {
    return wordCount > 6 ? 'video' : 'photo';
  }

  /**
   * Get appropriate file extension based on asset type
   * @param {string} assetType - 'video' or 'photo'
   * @returns {string} File extension
   */
  getFileExtension(assetType) {
    return assetType === 'video' ? '.mp4' : '.jpg';
  }

  /**
   * Randomly select one asset from search results
   * @param {Array} assets - Array of assets from search
   * @returns {Object|null} Selected asset or null if empty
   */
  randomlySelectAsset(assets) {
    if (!assets || assets.length === 0) {
      return null;
    }

    const randomIndex = Math.floor(Math.random() * assets.length);
    const selectedAsset = assets[randomIndex];

    logger.info(`Randomly selected asset ${randomIndex + 1}/${assets.length}: ${selectedAsset.id}`);
    return selectedAsset;
  }

  /**
   * Process a single sentence for asset download and upload
   * @param {string} videoId - Video ID
   * @param {Object} sentence - Sentence data from Script Breakdown
   * @param {string} folderId - Google Drive folder ID for uploads
   * @returns {Promise<Object>} Processing result
   */
  async processSentenceAsset(videoId, sentence, folderId) {
    try {
      const sentenceNumber = sentence.sentenceNumber;
      const searchPhrase = sentence.searchPhrase;
      const wordCount = parseInt(sentence.wordCount) || 0;

      if (!searchPhrase || searchPhrase.trim() === '') {
        logger.warn(`No search phrase for sentence ${sentenceNumber} in ${videoId}, skipping`);
        return { success: false, reason: 'No search phrase' };
      }

      logger.info(`Processing sentence ${sentenceNumber} for ${videoId}: "${searchPhrase}" (${wordCount} words)`);

      // Determine asset type based on word count
      const assetType = this.getAssetTypeByWordCount(wordCount);
      const fileExtension = this.getFileExtension(assetType);
      const filename = `S-${sentenceNumber}${fileExtension}`;

      logger.info(`Asset type for sentence ${sentenceNumber}: ${assetType}`);

      // Search for assets
      let assets;
      if (assetType === 'video') {
        assets = await this.searchVideos(searchPhrase, this.resultsPerPage);
      } else {
        assets = await this.searchPhotos(searchPhrase, this.resultsPerPage);
      }

      if (!assets || assets.length === 0) {
        logger.warn(`No ${assetType} assets found for "${searchPhrase}"`);
        return { success: false, reason: `No ${assetType} assets found` };
      }

      // Randomly select one asset
      const selectedAsset = this.randomlySelectAsset(assets);
      if (!selectedAsset) {
        return { success: false, reason: 'Asset selection failed' };
      }

      // Get download URL
      let downloadUrl;
      if (assetType === 'video') {
        downloadUrl = this.getBestVideoUrl(selectedAsset);
      } else {
        downloadUrl = this.getBestPhotoUrl(selectedAsset);
      }

      // Download asset to temporary location
      const tempFilePath = await this.downloadAsset(downloadUrl, filename);

      try {
        // Create Assets subfolder if it doesn't exist and get its ID
        const assetsFolderId = await this.driveService.findOrCreateSubfolder(folderId, 'Assets');

        // Upload to Google Drive in the Assets subfolder
        const mimeType = assetType === 'video' ? 'video/mp4' : 'image/jpeg';
        const uploadResult = await this.driveService.uploadFile(
          tempFilePath,
          filename,
          assetsFolderId,
          mimeType
        );

        // Make file publicly accessible
        const shareableLink = await this.driveService.createShareableLink(uploadResult.id);

        // Clean up temporary file
        try {
          await fs.unlink(tempFilePath);
        } catch (cleanupError) {
          logger.warn(`Failed to cleanup temp file ${tempFilePath}:`, cleanupError.message);
        }

        // Update Google Sheets with the image URL
        await this.sheetsService.updateSentenceWithImage(
          videoId,
          sentenceNumber,
          shareableLink.publicUrl,
          'Complete'
        );

        logger.info(`Successfully processed sentence ${sentenceNumber} for ${videoId}: ${filename}`);

        return {
          success: true,
          sentenceNumber: sentenceNumber,
          filename: filename,
          assetType: assetType,
          pexelsId: selectedAsset.id,
          driveUrl: shareableLink.publicUrl,
          uploadResult: uploadResult
        };

      } catch (uploadError) {
        // Clean up temporary file on upload failure
        try {
          await fs.unlink(tempFilePath);
        } catch (cleanupError) {
          logger.warn(`Failed to cleanup temp file after upload error:`, cleanupError.message);
        }
        throw uploadError;
      }

    } catch (error) {
      logger.error(`Failed to process sentence ${sentence.sentenceNumber} for ${videoId}:`, error.message);

      // Update status to indicate failure
      try {
        await this.sheetsService.updateSentenceWithImage(
          videoId,
          sentence.sentenceNumber,
          '',
          'Asset Download Failed'
        );
      } catch (statusUpdateError) {
        logger.error(`Failed to update failure status:`, statusUpdateError.message);
      }

      return {
        success: false,
        sentenceNumber: sentence.sentenceNumber,
        reason: error.message,
        error: error
      };
    }
  }

  /**
   * Main method: Process all Script Breakdown sentences for asset download
   * @param {string} videoId - Video ID to process
   * @returns {Promise<Object>} Processing results summary
   */
  async processScriptBreakdownAssets(videoId) {
    try {
      logger.info(`Starting Pexels asset processing for ${videoId}`);

      // Get video details to find Drive folder
      const videoDetails = await this.sheetsService.getVideoDetails(videoId);
      if (!videoDetails || !videoDetails.driveFolder) {
        throw new Error(`Drive folder not found for video: ${videoId}`);
      }

      // Extract folder ID from Drive folder URL
      const folderId = videoDetails.driveFolder.split('/folders/')[1];
      if (!folderId) {
        throw new Error(`Invalid Drive folder URL: ${videoDetails.driveFolder}`);
      }

      logger.info(`Using Drive folder: ${videoDetails.driveFolder}`);

      // Get Script Breakdown data
      const scriptBreakdown = await this.sheetsService.getScriptBreakdown(videoId);
      if (!scriptBreakdown || scriptBreakdown.length === 0) {
        throw new Error(`No script breakdown found for video: ${videoId}`);
      }

      logger.info(`Found ${scriptBreakdown.length} sentences to process for ${videoId}`);

      const results = {
        videoId: videoId,
        totalSentences: scriptBreakdown.length,
        processedCount: 0,
        successCount: 0,
        failureCount: 0,
        videoAssets: 0,
        photoAssets: 0,
        results: [],
        errors: []
      };

      // Process each sentence
      for (const sentence of scriptBreakdown) {
        results.processedCount++;

        logger.info(`Processing ${results.processedCount}/${results.totalSentences}: Sentence ${sentence.sentenceNumber}`);

        const result = await this.processSentenceAsset(videoId, sentence, folderId);
        results.results.push(result);

        if (result.success) {
          results.successCount++;
          if (result.assetType === 'video') {
            results.videoAssets++;
          } else {
            results.photoAssets++;
          }
        } else {
          results.failureCount++;
          results.errors.push({
            sentenceNumber: sentence.sentenceNumber,
            reason: result.reason,
            searchPhrase: sentence.searchPhrase
          });
        }

        // Add a small delay between requests to be respectful to Pexels API
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      logger.info(`Completed Pexels asset processing for ${videoId}:`);
      logger.info(`  • Total sentences: ${results.totalSentences}`);
      logger.info(`  • Successful downloads: ${results.successCount}`);
      logger.info(`  • Failed downloads: ${results.failureCount}`);
      logger.info(`  • Video assets: ${results.videoAssets}`);
      logger.info(`  • Photo assets: ${results.photoAssets}`);

      return results;

    } catch (error) {
      logger.error(`Failed to process script breakdown assets for ${videoId}:`, error.message);
      throw error;
    }
  }

  /**
   * Retry operation with exponential backoff
   * @param {Function} operation - Function to retry
   * @param {string} operationName - Name for logging
   * @returns {Promise<any>} Operation result
   */
  async retryOperation(operation, operationName = 'PexelsOperation') {
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        if (attempt === this.maxRetries) {
          logger.error(`${operationName} failed after ${this.maxRetries} attempts:`, error.message);
          throw error;
        }

        const delay = this.retryDelay * Math.pow(2, attempt - 1); // Exponential backoff
        logger.warn(`${operationName} attempt ${attempt} failed, retrying in ${delay}ms:`, error.message);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  /**
   * Clean existing assets for a video - removes all files from Assets folder and resets status
   * @param {string} videoId - Video ID to clean
   * @returns {Promise<Object>} Cleanup results
   */
  async cleanExistingAssets(videoId) {
    try {
      logger.info(`Starting cleanup of existing assets for ${videoId}`);

      // Get video details to find Drive folder
      const videoDetails = await this.sheetsService.getVideoDetails(videoId);
      if (!videoDetails || !videoDetails.driveFolder) {
        throw new Error(`Drive folder not found for video: ${videoId}`);
      }

      // Extract folder ID from Drive folder URL
      const folderId = videoDetails.driveFolder.split('/folders/')[1];
      if (!folderId) {
        throw new Error(`Invalid Drive folder URL: ${videoDetails.driveFolder}`);
      }

      const results = {
        videoId: videoId,
        deletedFiles: 0,
        resetStatuses: 0,
        errors: []
      };

      try {
        // Check if Assets folder exists
        const assetsFolder = await this.driveService.drive.files.list({
          q: `name = 'Assets' and mimeType = 'application/vnd.google-apps.folder' and parents in '${folderId}' and trashed = false`,
          fields: 'files(id, name)',
          pageSize: 1
        });

        if (assetsFolder.data.files && assetsFolder.data.files.length > 0) {
          const assetsFolderId = assetsFolder.data.files[0].id;
          logger.info(`Found Assets folder: ${assetsFolderId}`);

          // Get all files in Assets folder
          const assetFiles = await this.driveService.drive.files.list({
            q: `parents in '${assetsFolderId}' and trashed = false`,
            fields: 'files(id, name)',
            pageSize: 1000
          });

          // Delete all files in Assets folder
          if (assetFiles.data.files && assetFiles.data.files.length > 0) {
            logger.info(`Deleting ${assetFiles.data.files.length} files from Assets folder`);

            for (const file of assetFiles.data.files) {
              try {
                await this.driveService.drive.files.delete({
                  fileId: file.id
                });
                results.deletedFiles++;
                logger.info(`Deleted file: ${file.name}`);
              } catch (deleteError) {
                logger.error(`Failed to delete file ${file.name}:`, deleteError.message);
                results.errors.push(`Failed to delete ${file.name}: ${deleteError.message}`);
              }
            }
          }
        } else {
          logger.info('No Assets folder found - nothing to delete');
        }
      } catch (driveError) {
        logger.error('Drive cleanup error:', driveError.message);
        results.errors.push(`Drive cleanup error: ${driveError.message}`);
      }

      // Reset all sentence statuses and clear image URLs in Script Breakdown
      try {
        const scriptBreakdown = await this.sheetsService.getScriptBreakdown(videoId);
        if (scriptBreakdown && scriptBreakdown.length > 0) {
          logger.info(`Resetting status for ${scriptBreakdown.length} sentences`);

          for (const sentence of scriptBreakdown) {
            try {
              await this.sheetsService.updateSentenceWithImage(
                videoId,
                sentence.sentenceNumber,
                '', // Clear image URL
                'Pending' // Reset status
              );
              results.resetStatuses++;
            } catch (statusError) {
              logger.error(`Failed to reset status for sentence ${sentence.sentenceNumber}:`, statusError.message);
              results.errors.push(`Failed to reset sentence ${sentence.sentenceNumber}: ${statusError.message}`);
            }
          }
        }
      } catch (sheetsError) {
        logger.error('Sheets cleanup error:', sheetsError.message);
        results.errors.push(`Sheets cleanup error: ${sheetsError.message}`);
      }

      logger.info(`Cleanup completed for ${videoId}:`);
      logger.info(`  • Files deleted: ${results.deletedFiles}`);
      logger.info(`  • Statuses reset: ${results.resetStatuses}`);
      logger.info(`  • Errors: ${results.errors.length}`);

      return results;

    } catch (error) {
      logger.error(`Failed to clean existing assets for ${videoId}:`, error.message);
      throw error;
    }
  }

  /**
   * Health check for Pexels API
   * @returns {Promise<Object>} Health status
   */
  async healthCheck() {
    try {
      // Test API connection with a simple search
      const testResults = await this.searchPhotos('business', 1);

      if (Array.isArray(testResults)) {
        logger.info('Pexels API health check passed');
        return {
          status: 'healthy',
          service: 'Pexels API',
          resultsFound: testResults.length > 0
        };
      } else {
        throw new Error('Invalid response format');
      }
    } catch (error) {
      logger.error('Pexels API health check failed:', error.message);
      return {
        status: 'unhealthy',
        service: 'Pexels API',
        error: error.message
      };
    }
  }

  /**
   * Get processing statistics for a video
   * @param {string} videoId - Video ID
   * @returns {Promise<Object>} Processing statistics
   */
  async getProcessingStats(videoId) {
    try {
      const scriptBreakdown = await this.sheetsService.getScriptBreakdown(videoId);
      if (!scriptBreakdown || scriptBreakdown.length === 0) {
        return {
          videoId: videoId,
          totalSentences: 0,
          processed: 0,
          pending: 0,
          failed: 0
        };
      }

      let processed = 0;
      let pending = 0;
      let failed = 0;

      for (const sentence of scriptBreakdown) {
        const status = sentence.status || 'Pending';
        if (status === 'Complete' || status === 'Asset Downloaded' || status === 'Generated') {
          processed++;
        } else if (status === 'Asset Download Failed') {
          failed++;
        } else {
          pending++;
        }
      }

      return {
        videoId: videoId,
        totalSentences: scriptBreakdown.length,
        processed: processed,
        pending: pending,
        failed: failed
      };
    } catch (error) {
      logger.error(`Failed to get processing stats for ${videoId}:`, error.message);
      throw error;
    }
  }
}

export default PexelsService;