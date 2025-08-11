#!/usr/bin/env node

/**
 * Fix VID-0001 Thumbnail Folder Structure
 * 
 * This tool fixes the thumbnail folder structure issue for VID-0001 by:
 * 1. Finding the correct video detail folder for VID-0001
 * 2. Locating any incorrectly placed thumbnails
 * 3. Moving/re-uploading thumbnails to the correct location
 * 4. Updating Google Sheets with proper folder structure
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { config } from '../config/config.js';
import logger from '../src/utils/logger.js';
import GoogleSheetsService from '../src/services/googleSheetsService.js';
import GoogleDriveService from '../src/services/googleDriveService.js';
import ThumbnailService from '../src/services/thumbnailService.js';
import AIService from '../src/services/aiService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class VID0001ThumbnailFixer {
  constructor() {
    this.googleSheetsService = new GoogleSheetsService();
    this.googleDriveService = new GoogleDriveService();
    this.aiService = new AIService();
    this.thumbnailService = new ThumbnailService(this.aiService, this.googleDriveService);
    this.videoId = 'VID-0001';
  }

  /**
   * Main execution function
   */
  async run() {
    try {
      logger.info('🔧 Starting VID-0001 thumbnail folder structure fix...');
      
      // Step 1: Get VID-0001 details from Google Sheets
      logger.info('📋 Step 1: Getting VID-0001 details from Google Sheets...');
      const videoDetails = await this.googleSheetsService.getVideoDetails(this.videoId);
      
      if (!videoDetails) {
        throw new Error(`VID-0001 not found in Google Sheets`);
      }
      
      logger.info(`✅ Found VID-0001: "${videoDetails.title}"`);
      logger.info(`📁 Current Drive folder: ${videoDetails.driveFolder || 'Not set'}`);
      
      // Step 2: Find the correct video folder structure
      logger.info('📁 Step 2: Finding correct video folder structure...');
      const correctFolder = await this.findCorrectVideoFolder(videoDetails);
      
      if (!correctFolder) {
        throw new Error('Could not find or create correct video folder for VID-0001');
      }
      
      logger.info(`✅ Correct video folder: ${correctFolder.folderName}`);
      logger.info(`🔗 Folder URL: ${correctFolder.folderUrl}`);
      
      // Step 3: Find or create "Generated Thumbnails" subfolder
      logger.info('🖼️ Step 3: Setting up Generated Thumbnails subfolder...');
      const thumbnailFolder = await this.findOrCreateThumbnailFolder(correctFolder.folderId);
      
      logger.info(`✅ Thumbnail folder ready: ${thumbnailFolder.folderName}`);
      logger.info(`🔗 Thumbnail folder URL: ${thumbnailFolder.folderUrl}`);
      
      // Step 4: Check for existing thumbnails in the correct location
      logger.info('🔍 Step 4: Checking for existing thumbnails in correct location...');
      const existingThumbnails = await this.checkThumbnailsInFolder(thumbnailFolder.folderId);
      
      if (existingThumbnails.length > 0) {
        logger.info(`✅ Found ${existingThumbnails.length} existing thumbnails in correct location:`);
        existingThumbnails.forEach(thumb => {
          logger.info(`  - ${thumb.fileName}: ${thumb.directLink}`);
        });
      } else {
        logger.info('📋 No thumbnails found in correct location - will need to generate/move them');
      }
      
      // Step 5: Search for misplaced thumbnails
      logger.info('🔍 Step 5: Searching for any misplaced VID-0001 thumbnails...');
      const misplacedThumbnails = await this.findMisplacedThumbnails();
      
      if (misplacedThumbnails.length > 0) {
        logger.info(`⚠️ Found ${misplacedThumbnails.length} potentially misplaced thumbnails:`);
        misplacedThumbnails.forEach(thumb => {
          logger.info(`  - ${thumb.fileName} in folder: ${thumb.parentName || 'Unknown'}`);
        });
        
        // Step 6: Move misplaced thumbnails to correct location
        logger.info('📦 Step 6: Moving misplaced thumbnails to correct location...');
        await this.moveThumbnailsToCorrectLocation(misplacedThumbnails, thumbnailFolder.folderId);
      }
      
      // Step 7: Generate new thumbnails if none exist
      if (existingThumbnails.length === 0 && misplacedThumbnails.length === 0) {
        logger.info('🎨 Step 7: No thumbnails found anywhere - generating new ones...');
        await this.generateFreshThumbnails(videoDetails);
      } else {
        logger.info('✅ Step 7: Thumbnails already exist - skipping generation');
      }
      
      // Step 8: Update Google Sheets with correct folder URLs
      logger.info('📝 Step 8: Updating Google Sheets with correct folder structure...');
      await this.updateGoogleSheetsFolder(correctFolder.folderUrl);
      
      // Step 9: Final verification
      logger.info('🔍 Step 9: Final verification...');
      const finalCheck = await this.checkThumbnailsInFolder(thumbnailFolder.folderId);
      
      logger.info('\n🎉 VID-0001 Thumbnail Folder Fix Complete!');
      logger.info('═══════════════════════════════════════');
      logger.info(`📁 Video Folder: ${correctFolder.folderUrl}`);
      logger.info(`🖼️ Thumbnail Folder: ${thumbnailFolder.folderUrl}`);
      logger.info(`✅ Thumbnails in correct location: ${finalCheck.length}`);
      
      if (finalCheck.length > 0) {
        logger.info('\n📋 Final Thumbnail List:');
        finalCheck.forEach((thumb, index) => {
          logger.info(`${index + 1}. ${thumb.fileName}`);
          logger.info(`   📎 Direct Link: ${thumb.directLink}`);
          logger.info(`   👁️ View Link: ${thumb.viewLink}`);
        });
      }
      
      return {
        success: true,
        videoFolder: correctFolder,
        thumbnailFolder: thumbnailFolder,
        thumbnailCount: finalCheck.length,
        thumbnails: finalCheck
      };
      
    } catch (error) {
      logger.error('❌ VID-0001 thumbnail folder fix failed:', error);
      throw error;
    }
  }

  /**
   * Find or create the correct video folder for VID-0001
   */
  async findCorrectVideoFolder(videoDetails) {
    try {
      // First, check if the current Drive folder URL is valid
      if (videoDetails.driveFolder) {
        const folderIdMatch = videoDetails.driveFolder.match(/\/folders\/([a-zA-Z0-9-_]+)/);
        if (folderIdMatch) {
          const folderId = folderIdMatch[1];
          
          try {
            const folderInfo = await this.googleDriveService.drive.files.get({
              fileId: folderId,
              fields: 'id, name, webViewLink, parents'
            });
            
            logger.info(`✅ Current Drive folder is valid: ${folderInfo.data.name}`);
            return {
              folderId: folderInfo.data.id,
              folderName: folderInfo.data.name,
              folderUrl: folderInfo.data.webViewLink
            };
          } catch (folderError) {
            logger.warn(`❌ Current Drive folder is invalid: ${folderError.message}`);
          }
        }
      }
      
      // Search for video folder by expected name pattern
      const sanitizedTitle = this.googleDriveService.sanitizeFolderName(videoDetails.title);
      const expectedFolderName = `(${this.videoId}) ${sanitizedTitle}`;
      
      logger.info(`🔍 Searching for folder: "${expectedFolderName}"`);
      
      // Search in videosRootFolderId
      const searchParents = [
        config.google.videosRootFolderId,
        config.google.driveFolderId
      ].filter(id => id);
      
      for (const parentId of searchParents) {
        try {
          const response = await this.googleDriveService.drive.files.list({
            q: `name='${expectedFolderName}' and mimeType='application/vnd.google-apps.folder' and parents in '${parentId}' and trashed=false`,
            fields: 'files(id, name, webViewLink)'
          });

          if (response.data.files.length > 0) {
            const folder = response.data.files[0];
            logger.info(`✅ Found existing video folder: ${folder.name}`);
            return {
              folderId: folder.id,
              folderName: folder.name,
              folderUrl: folder.webViewLink
            };
          }
        } catch (searchError) {
          logger.warn(`Failed to search in parent ${parentId}: ${searchError.message}`);
        }
      }
      
      // Create new folder if not found
      logger.info(`📁 Video folder not found, creating: "${expectedFolderName}"`);
      const parentFolderId = config.google.videosRootFolderId || config.google.driveFolderId;
      
      const folderMetadata = {
        name: expectedFolderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentFolderId]
      };

      const response = await this.googleDriveService.drive.files.create({
        resource: folderMetadata,
        fields: 'id, name, webViewLink'
      });

      logger.info(`✅ Created new video folder: ${response.data.name}`);
      return {
        folderId: response.data.id,
        folderName: response.data.name,
        folderUrl: response.data.webViewLink
      };
      
    } catch (error) {
      logger.error('Error finding/creating video folder:', error);
      throw error;
    }
  }

  /**
   * Find or create "Generated Thumbnails" subfolder
   */
  async findOrCreateThumbnailFolder(parentFolderId) {
    const thumbnailFolderName = 'Generated Thumbnails';
    
    try {
      // Look for existing "Generated Thumbnails" folder
      const response = await this.googleDriveService.drive.files.list({
        q: `name='${thumbnailFolderName}' and mimeType='application/vnd.google-apps.folder' and parents in '${parentFolderId}' and trashed=false`,
        fields: 'files(id, name, webViewLink)'
      });

      if (response.data.files.length > 0) {
        const folder = response.data.files[0];
        logger.info(`✅ Found existing "Generated Thumbnails" folder`);
        return {
          folderId: folder.id,
          folderName: folder.name,
          folderUrl: folder.webViewLink
        };
      }

      // Create folder if it doesn't exist
      logger.info(`📁 Creating "Generated Thumbnails" subfolder`);
      const folderMetadata = {
        name: thumbnailFolderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentFolderId]
      };

      const folder = await this.googleDriveService.drive.files.create({
        resource: folderMetadata,
        fields: 'id, name, webViewLink'
      });

      logger.info(`✅ Created "Generated Thumbnails" folder`);
      return {
        folderId: folder.data.id,
        folderName: folder.data.name,
        folderUrl: folder.data.webViewLink
      };
      
    } catch (error) {
      logger.error('Error with thumbnail folder:', error);
      throw error;
    }
  }

  /**
   * Check for thumbnails in a specific folder
   */
  async checkThumbnailsInFolder(folderId) {
    try {
      const response = await this.googleDriveService.drive.files.list({
        q: `parents in '${folderId}' and (name contains 'thumbnail' or mimeType contains 'image') and trashed=false`,
        fields: 'files(id, name, webViewLink, size, createdTime, mimeType)',
        orderBy: 'createdTime desc'
      });

      return response.data.files.map(file => ({
        fileId: file.id,
        fileName: file.name,
        viewLink: file.webViewLink,
        directLink: `https://drive.google.com/uc?id=${file.id}`,
        size: file.size,
        createdTime: file.createdTime,
        mimeType: file.mimeType
      }));
      
    } catch (error) {
      logger.error('Error checking thumbnails in folder:', error);
      return [];
    }
  }

  /**
   * Search for misplaced VID-0001 thumbnails across Drive
   */
  async findMisplacedThumbnails() {
    try {
      logger.info('🔍 Searching for VID-0001 thumbnails across all folders...');
      
      // Search for thumbnails that might contain VID-0001 in filename
      const searchQueries = [
        `name contains 'VID-0001' and mimeType contains 'image' and trashed=false`,
        `name contains 'thumbnail' and mimeType contains 'image' and trashed=false`
      ];
      
      const allResults = [];
      
      for (const query of searchQueries) {
        try {
          const response = await this.googleDriveService.drive.files.list({
            q: query,
            fields: 'files(id, name, webViewLink, parents, size, createdTime, mimeType)',
            orderBy: 'createdTime desc'
          });

          // Get parent folder names for context
          for (const file of response.data.files) {
            if (file.parents && file.parents.length > 0) {
              try {
                const parentInfo = await this.googleDriveService.drive.files.get({
                  fileId: file.parents[0],
                  fields: 'name'
                });
                file.parentName = parentInfo.data.name;
              } catch (parentError) {
                file.parentName = 'Unknown Parent';
              }
            }
            
            allResults.push({
              fileId: file.id,
              fileName: file.name,
              viewLink: file.webViewLink,
              directLink: `https://drive.google.com/uc?id=${file.id}`,
              parentFolderId: file.parents?.[0],
              parentName: file.parentName,
              size: file.size,
              createdTime: file.createdTime,
              mimeType: file.mimeType
            });
          }
          
        } catch (searchError) {
          logger.warn(`Search query failed: ${query}`, searchError.message);
        }
      }
      
      // Filter for likely VID-0001 thumbnails (avoid duplicates)
      const uniqueResults = [];
      const seenIds = new Set();
      
      for (const result of allResults) {
        if (!seenIds.has(result.fileId)) {
          seenIds.add(result.fileId);
          
          // Check if this is likely a VID-0001 thumbnail
          const isLikelyVID0001 = 
            result.fileName.includes('VID-0001') ||
            result.fileName.includes('thumbnail') ||
            (result.parentName && (
              result.parentName.includes('VID-0001') ||
              result.parentName.toLowerCase().includes('thumbnail')
            ));
            
          if (isLikelyVID0001) {
            uniqueResults.push(result);
          }
        }
      }
      
      return uniqueResults;
      
    } catch (error) {
      logger.error('Error searching for misplaced thumbnails:', error);
      return [];
    }
  }

  /**
   * Move thumbnails to correct location
   */
  async moveThumbnailsToCorrectLocation(misplacedThumbnails, targetFolderId) {
    try {
      let movedCount = 0;
      
      for (const thumbnail of misplacedThumbnails) {
        try {
          logger.info(`📦 Moving "${thumbnail.fileName}" to correct location...`);
          
          // Move file to correct folder
          await this.googleDriveService.drive.files.update({
            fileId: thumbnail.fileId,
            addParents: targetFolderId,
            removeParents: thumbnail.parentFolderId,
            fields: 'id, parents'
          });
          
          logger.info(`✅ Moved "${thumbnail.fileName}"`);
          movedCount++;
          
        } catch (moveError) {
          logger.error(`❌ Failed to move "${thumbnail.fileName}":`, moveError.message);
        }
      }
      
      logger.info(`📦 Successfully moved ${movedCount}/${misplacedThumbnails.length} thumbnails`);
      return movedCount;
      
    } catch (error) {
      logger.error('Error moving thumbnails:', error);
      throw error;
    }
  }

  /**
   * Generate fresh thumbnails if none exist
   */
  async generateFreshThumbnails(videoDetails) {
    try {
      logger.info('🎨 Generating fresh thumbnails for VID-0001...');
      
      // Prepare video data for thumbnail generation
      const videoData = {
        title: videoDetails.title,
        youtubeUrl: videoDetails.youtubeUrl,
        optimizedScript: 'Generating thumbnail for existing video',
        transcriptText: null
      };
      
      // Use the existing thumbnail service to generate and upload
      const result = await this.thumbnailService.processVideoThumbnails(
        videoData,
        this.videoId,
        true, // force regenerate
        this.googleSheetsService
      );
      
      if (result.success) {
        logger.info(`✅ Successfully generated ${result.uploaded} thumbnails`);
      } else {
        logger.error(`❌ Thumbnail generation failed: ${result.error}`);
      }
      
      return result;
      
    } catch (error) {
      logger.error('Error generating fresh thumbnails:', error);
      throw error;
    }
  }

  /**
   * Update Google Sheets with correct folder URL
   */
  async updateGoogleSheetsFolder(correctFolderUrl) {
    try {
      await this.googleSheetsService.updateVideoField(this.videoId, 'driveFolder', correctFolderUrl);
      logger.info(`📝 Updated Google Sheets with correct folder URL for ${this.videoId}`);
      
    } catch (error) {
      logger.error('Error updating Google Sheets folder URL:', error);
      throw error;
    }
  }
}

// Run the fix if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const fixer = new VID0001ThumbnailFixer();
  
  fixer.run()
    .then((result) => {
      logger.info('\n✅ VID-0001 thumbnail folder fix completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('\n❌ VID-0001 thumbnail folder fix failed:', error);
      process.exit(1);
    });
}

export default VID0001ThumbnailFixer;