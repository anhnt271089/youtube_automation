import { 
  S3Client, 
  PutObjectCommand, 
  ListObjectsV2Command, 
  DeleteObjectCommand, 
  HeadBucketCommand, 
  HeadObjectCommand 
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { config } from '../../config/config.js';
import logger from '../utils/logger.js';
import fs from 'fs';
import path from 'path';

class DigitalOceanService {
  constructor() {
    // Configure AWS SDK v3 to work with Digital Ocean Spaces
    this.s3Client = new S3Client({
      endpoint: `https://${config.digitalOcean.endpoint}`,
      credentials: {
        accessKeyId: config.digitalOcean.accessKey,
        secretAccessKey: config.digitalOcean.secretKey,
      },
      region: config.digitalOcean.region,
      forcePathStyle: false, // Configures to use subdomain/virtual calling format
    });
    
    this.bucketName = config.digitalOcean.bucketName;
    this.cdnUrl = config.digitalOcean.cdnUrl;
  }

  /**
   * Upload image to Digital Ocean Spaces
   * @param {Buffer|string} imageData - Image buffer or file path
   * @param {string} fileName - Name for the uploaded file
   * @param {string} folder - Folder path in the bucket
   * @returns {Promise<{url: string, cdnUrl: string}>}
   */
  async uploadImage(imageData, fileName, folder = 'images') {
    try {
      let imageBuffer;
      let contentType = 'image/png';
      
      // Handle both file path and buffer input
      if (typeof imageData === 'string') {
        imageBuffer = fs.readFileSync(imageData);
        const ext = path.extname(fileName).toLowerCase();
        contentType = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/png';
      } else {
        imageBuffer = imageData;
      }

      const key = `${folder}/${fileName}`;
      
      const uploadCommand = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: imageBuffer,
        ACL: 'public-read',
        ContentType: contentType,
        CacheControl: 'max-age=31536000', // 1 year cache
        Metadata: {
          'uploaded-by': 'youtube-automation',
          'upload-date': new Date().toISOString()
        }
      });

      logger.info(`DO upload: ${key}`);
      const result = await this.s3Client.send(uploadCommand);
      
      // Generate URLs (AWS SDK v3 doesn't return Location, construct it manually)
      const baseUrl = `https://${this.bucketName}.${config.digitalOcean.region}.digitaloceanspaces.com/${key}`;
      const cdnUrl = this.cdnUrl ? 
        `${this.cdnUrl}/${key}` : 
        baseUrl;

      logger.info(`DO image: ${cdnUrl}`);
      
      return {
        url: baseUrl,
        cdnUrl: cdnUrl,
        key: key,
        etag: result.ETag
      };
    } catch (error) {
      logger.error('Error uploading image to Digital Ocean Spaces:', error);
      throw error;
    }
  }

  /**
   * Upload video file to Digital Ocean Spaces
   * @param {string} filePath - Local file path
   * @param {string} fileName - Name for the uploaded file
   * @param {string} folder - Folder path in the bucket
   * @returns {Promise<{url: string, cdnUrl: string}>}
   */
  async uploadVideo(filePath, fileName, folder = 'videos') {
    try {
      const fileBuffer = fs.readFileSync(filePath);
      const key = `${folder}/${fileName}`;
      
      const uploadCommand = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: fileBuffer,
        ACL: 'public-read',
        ContentType: 'video/mp4',
        CacheControl: 'max-age=31536000', // 1 year cache
        Metadata: {
          'uploaded-by': 'youtube-automation',
          'upload-date': new Date().toISOString()
        }
      });

      logger.info(`DO video upload: ${key}`);
      const result = await this.s3Client.send(uploadCommand);
      
      // Generate URLs (AWS SDK v3 doesn't return Location, construct it manually)
      const baseUrl = `https://${this.bucketName}.${config.digitalOcean.region}.digitaloceanspaces.com/${key}`;
      const cdnUrl = this.cdnUrl ? 
        `${this.cdnUrl}/${key}` : 
        baseUrl;

      logger.info(`DO video: ${cdnUrl}`);
      
      return {
        url: baseUrl,
        cdnUrl: cdnUrl,
        key: key,
        etag: result.ETag
      };
    } catch (error) {
      logger.error('Error uploading video to Digital Ocean Spaces:', error);
      throw error;
    }
  }

  /**
   * Create a folder structure for a video project
   * @param {string} videoId - Video identifier
   * @returns {Promise<{folderPath: string, urls: object}>}
   */
  async createVideoFolder(videoId) {
    try {
      const folderPath = `videos/${videoId}`;
      const subfolders = ['images', 'thumbnails', 'final'];
      
      // Create folder structure by uploading placeholder files
      const folderUrls = {};
      
      for (const subfolder of subfolders) {
        const placeholderKey = `${folderPath}/${subfolder}/.placeholder`;
        
        const putCommand = new PutObjectCommand({
          Bucket: this.bucketName,
          Key: placeholderKey,
          Body: '',
          ACL: 'public-read',
          ContentType: 'text/plain'
        });
        
        await this.s3Client.send(putCommand);
        
        folderUrls[subfolder] = this.cdnUrl ? 
          `${this.cdnUrl}/${folderPath}/${subfolder}/` : 
          `https://${this.bucketName}.${config.digitalOcean.region}.digitaloceanspaces.com/${folderPath}/${subfolder}/`;
      }

      logger.info(`DO folders: ${videoId}`);
      
      return {
        folderPath,
        urls: folderUrls
      };
    } catch (error) {
      logger.error('Error creating video folder structure:', error);
      throw error;
    }
  }

  /**
   * List files in a folder
   * @param {string} folderPath - Folder path to list
   * @returns {Promise<Array>}
   */
  async listFiles(folderPath) {
    try {
      const listCommand = new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: folderPath.endsWith('/') ? folderPath : `${folderPath}/`
      });

      const result = await this.s3Client.send(listCommand);
      
      return result.Contents.map(item => ({
        key: item.Key,
        size: item.Size,
        lastModified: item.LastModified,
        url: this.cdnUrl ? 
          `${this.cdnUrl}/${item.Key}` : 
          `https://${this.bucketName}.${config.digitalOcean.region}.digitaloceanspaces.com/${item.Key}`
      }));
    } catch (error) {
      logger.error('Error listing files from Digital Ocean Spaces:', error);
      throw error;
    }
  }

  /**
   * Delete a file from Digital Ocean Spaces
   * @param {string} key - File key to delete
   * @returns {Promise<boolean>}
   */
  async deleteFile(key) {
    try {
      const deleteCommand = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key
      });
      
      await this.s3Client.send(deleteCommand);
      
      logger.info(`DO deleted: ${key}`);
      return true;
    } catch (error) {
      logger.error('Error deleting file from Digital Ocean Spaces:', error);
      throw error;
    }
  }

  /**
   * Generate a presigned URL for private file access
   * @param {string} key - File key
   * @param {number} expiresIn - URL expiration time in seconds (default: 1 hour)
   * @returns {Promise<string>}
   */
  async getPresignedUrl(key, expiresIn = 3600) {
    try {
      const getObjectCommand = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key
      });

      return await getSignedUrl(this.s3Client, getObjectCommand, { expiresIn });
    } catch (error) {
      logger.error('Error generating presigned URL:', error);
      throw error;
    }
  }

  /**
   * Get file metadata
   * @param {string} key - File key
   * @returns {Promise<object>}
   */
  async getFileMetadata(key) {
    try {
      const headCommand = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: key
      });
      
      const result = await this.s3Client.send(headCommand);
      
      return {
        contentType: result.ContentType,
        contentLength: result.ContentLength,
        lastModified: result.LastModified,
        etag: result.ETag,
        metadata: result.Metadata
      };
    } catch (error) {
      logger.error('Error getting file metadata:', error);
      throw error;
    }
  }

  /**
   * Health check for Digital Ocean Spaces connection
   * @returns {Promise<boolean>}
   */
  async healthCheck() {
    try {
      const headBucketCommand = new HeadBucketCommand({ Bucket: this.bucketName });
      await this.s3Client.send(headBucketCommand);
      logger.info('DO health check passed');
      return true;
    } catch (error) {
      logger.error('Digital Ocean Spaces health check failed:', error);
      throw error;
    }
  }

  /**
   * Get storage usage statistics
   * @returns {Promise<object>}
   */
  async getStorageStats() {
    try {
      const listCommand = new ListObjectsV2Command({ Bucket: this.bucketName });
      const result = await this.s3Client.send(listCommand);
      
      const stats = {
        totalFiles: result.Contents.length,
        totalSize: result.Contents.reduce((sum, obj) => sum + obj.Size, 0),
        folders: {}
      };

      // Group by top-level folders
      result.Contents.forEach(obj => {
        const folder = obj.Key.split('/')[0];
        if (!stats.folders[folder]) {
          stats.folders[folder] = { count: 0, size: 0 };
        }
        stats.folders[folder].count++;
        stats.folders[folder].size += obj.Size;
      });

      // Convert bytes to human readable format
      stats.totalSizeFormatted = this.formatBytes(stats.totalSize);
      Object.keys(stats.folders).forEach(folder => {
        stats.folders[folder].sizeFormatted = this.formatBytes(stats.folders[folder].size);
      });

      return stats;
    } catch (error) {
      logger.error('Error getting storage statistics:', error);
      throw error;
    }
  }

  /**
   * Format bytes to human readable format
   * @param {number} bytes
   * @returns {string}
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

export default DigitalOceanService;