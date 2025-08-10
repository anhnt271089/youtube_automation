#!/usr/bin/env node

import GoogleSheetsService from '../src/services/googleSheetsService.js';
import GoogleDriveService from '../src/services/googleDriveService.js';
import logger from '../src/utils/logger.js';

class ThumbnailFolderChecker {
  constructor() {
    this.sheetsService = new GoogleSheetsService();
    this.driveService = new GoogleDriveService();
  }

  async checkVideoFolderStructure(videoId) {
    logger.info(`🔍 Checking folder structure for ${videoId}...`);
    
    try {
      // Get video details from Sheets
      const videoDetails = await this.sheetsService.getVideoDetails(videoId);
      if (!videoDetails) {
        logger.warn(`Video ${videoId} not found in sheets`);
        return null;
      }
      
      logger.info(`📹 Video: ${videoDetails.title}`);
      logger.info(`📁 Drive Folder URL: ${videoDetails.driveFolder || 'Not Set'}`);
      
      if (!videoDetails.driveFolder) {
        logger.warn(`No drive folder URL found for ${videoId}`);
        return null;
      }
      
      // Extract folder ID
      const folderIdMatch = videoDetails.driveFolder.match(/\/folders\/([a-zA-Z0-9-_]+)/);
      if (!folderIdMatch) {
        logger.warn(`Could not extract folder ID from: ${videoDetails.driveFolder}`);
        return null;
      }
      
      const folderId = folderIdMatch[1];
      logger.info(`📂 Folder ID: ${folderId}`);
      
      // List all files and folders in the video folder
      const response = await this.driveService.drive.files.list({
        q: `parents in '${folderId}' and trashed=false`,
        fields: 'files(id, name, mimeType, webViewLink, size)'
      });
      
      const items = response.data.files || [];
      logger.info(`📋 Found ${items.length} items in video folder:`);
      
      let thumbnailCount = 0;
      let thumbnailFolderId = null;
      let thumbnailsInRoot = [];
      let subfolders = [];
      
      items.forEach(item => {
        if (item.mimeType === 'application/vnd.google-apps.folder') {
          logger.info(`  📁 FOLDER: ${item.name}`);
          subfolders.push(item);
          if (item.name.toLowerCase().includes('thumbnail') || item.name === 'Generated Thumbnails') {
            thumbnailFolderId = item.id;
          }
        } else {
          const isImage = item.mimeType && item.mimeType.startsWith('image/');
          const isThumbnail = item.name.toLowerCase().includes('thumbnail') || 
                            item.name.toLowerCase().includes('thumb') ||
                            (isImage && item.name.match(/\.(jpg|jpeg|png|webp)$/i));
          
          if (isThumbnail) {
            thumbnailsInRoot.push(item);
            thumbnailCount++;
            logger.info(`  🖼️  THUMBNAIL (ROOT): ${item.name} (${item.size} bytes)`);
          } else {
            logger.info(`  📄 FILE: ${item.name} ${isImage ? '(image)' : ''}`);
          }
        }
      });
      
      // Check thumbnail subfolder if it exists
      let thumbnailsInSubfolder = [];
      if (thumbnailFolderId) {
        logger.info(`\n🔍 Checking Generated Thumbnails subfolder...`);
        const thumbnailResponse = await this.driveService.drive.files.list({
          q: `parents in '${thumbnailFolderId}' and trashed=false`,
          fields: 'files(id, name, mimeType, webViewLink, size)'
        });
        
        const thumbnailFiles = thumbnailResponse.data.files || [];
        logger.info(`  📋 Found ${thumbnailFiles.length} items in thumbnail subfolder:`);
        
        thumbnailFiles.forEach(file => {
          const isImage = file.mimeType && file.mimeType.startsWith('image/');
          if (isImage) {
            thumbnailsInSubfolder.push(file);
            logger.info(`    🖼️  ${file.name} (${file.size} bytes)`);
          } else {
            logger.info(`    📄 ${file.name}`);
          }
        });
      }
      
      // Summary
      logger.info(`\n📊 Summary for ${videoId}:`);
      logger.info(`  Total subfolders: ${subfolders.length}`);
      logger.info(`  Thumbnails in root folder: ${thumbnailsInRoot.length}`);
      logger.info(`  Thumbnails in subfolder: ${thumbnailsInSubfolder.length}`);
      logger.info(`  Generated Thumbnails folder exists: ${thumbnailFolderId ? 'YES' : 'NO'}`);
      
      // Determine if there's an issue
      let issues = [];
      if (thumbnailsInRoot.length > 0) {
        issues.push(`${thumbnailsInRoot.length} thumbnails found in root folder (should be in subfolder)`);
      }
      
      if (thumbnailsInSubfolder.length > 0 && thumbnailsInRoot.length > 0) {
        issues.push('Thumbnails scattered across both root and subfolder');
      }
      
      if (!thumbnailFolderId && (thumbnailsInRoot.length > 0 || thumbnailsInSubfolder.length > 0)) {
        issues.push('Thumbnails present but no "Generated Thumbnails" subfolder');
      }
      
      if (issues.length > 0) {
        logger.warn(`❗ Issues found:`);
        issues.forEach(issue => logger.warn(`  - ${issue}`));
      } else if (thumbnailsInSubfolder.length > 0) {
        logger.info(`✅ Folder structure looks correct - thumbnails properly organized in subfolder`);
      } else {
        logger.info(`ℹ️  No thumbnails found yet (may not be generated)`);
      }
      
      return {
        videoId,
        folderId,
        subfolders: subfolders.length,
        thumbnailsInRoot: thumbnailsInRoot.length,
        thumbnailsInSubfolder: thumbnailsInSubfolder.length,
        hasThumbnailFolder: !!thumbnailFolderId,
        issues
      };
      
    } catch (error) {
      logger.error(`❌ Failed to check folder structure for ${videoId}:`, error);
      return { videoId, error: error.message };
    }
  }

  async run() {
    try {
      logger.info('🔍 Checking thumbnail folder structure...');
      
      // Check videos that should have thumbnails
      const videosToCheck = ['VID-0001', 'VID-0002', 'VID-0003'];
      
      const results = [];
      
      for (const videoId of videosToCheck) {
        logger.info(`\n${'='.repeat(60)}`);
        const result = await this.checkVideoFolderStructure(videoId);
        if (result) {
          results.push(result);
        }
      }
      
      logger.info(`\n${'='.repeat(60)}`);
      logger.info('📊 Overall Summary:');
      
      results.forEach(result => {
        if (result.error) {
          logger.error(`${result.videoId}: ERROR - ${result.error}`);
        } else {
          const status = result.issues.length > 0 ? '❗ ISSUES' : '✅ OK';
          logger.info(`${result.videoId}: ${status}`);
          logger.info(`  Subfolders: ${result.subfolders}, Root thumbnails: ${result.thumbnailsInRoot}, Subfolder thumbnails: ${result.thumbnailsInSubfolder}`);
          if (result.issues.length > 0) {
            result.issues.forEach(issue => logger.warn(`    - ${issue}`));
          }
        }
      });
      
    } catch (error) {
      logger.error('❌ Check failed:', error);
      process.exit(1);
    }
  }
}

// Run the check
const checker = new ThumbnailFolderChecker();
checker.run().catch(error => {
  logger.error('Fatal error:', error);
  process.exit(1);
});